// packages/backend/stt-engine/live/sravaani-live-onnx.ts
//
// Direct onnxruntime-node port of the validated Python reference script's
// v4 chunking + cache-carrying logic for the SraVaani-live cache-aware
// streaming CTC ONNX export. Bypasses sherpa-onnx's `nemoCtc` support
// entirely (see fix history in the reference script -- this export's
// cache layout/I-O doesn't match sherpa-onnx's built-in assumptions).
//
// Mel features come from StreamingMelFrontend (causal port of NeMo's
// AudioToMelSpectrogramPreprocessor), not from sherpa-onnx's frontend.
//
// Cache handling: get_initial_cache_state() in NeMo just returns zero
// tensors of the correct SIZE -- there's no learned state, only shape.
// So we hardcode shapes per latency preset instead of needing NeMo/PyTorch
// at runtime.

import fs from "fs";
import type * as ort from "onnxruntime-node";
import { StreamingMelFrontend } from "./mel-frontend.js";

// ---------------------------------------------------------------------------
// Per-preset cache metadata. Derived directly from the reference script's
// --debug output for each latency_*ms export. Add entries here as you
// validate additional presets the same way (rerun the Python script with
// --debug against that preset and copy the printed shapes/streaming_cfg).
// ---------------------------------------------------------------------------
export interface SravaaniLiveCacheMeta {
    numLayers: number;
    dModel: number;
    /** cache_last_channel: [1, numLayers, cacheLastChannelLen, dModel] */
    cacheLastChannelLen: number;
    /** cache_last_time: [1, numLayers, dModel, cacheLastTimeLen] */
    cacheLastTimeLen: number;
    /** streaming_cfg.chunk_size[1] -- new mel frames consumed per step */
    chunkSize: number;
    /** streaming_cfg.pre_encode_cache_size[1] -- lookback mel frames per step */
    preEncodeCacheSize: number;
    /** streaming_cfg.drop_extra_pre_encoded */
    dropExtraPreEncoded: number;
}

export const LATENCY_1040MS_CACHE_META: SravaaniLiveCacheMeta = {
    numLayers: 17,
    dModel: 1024,
    cacheLastChannelLen: 70,
    cacheLastTimeLen: 8,
    chunkSize: 8,
    preEncodeCacheSize: 9,
    dropExtraPreEncoded: 2,
};

/** Same export as LATENCY_1040MS_CACHE_META but doubling chunkSize (16 mel
 * frames/step instead of 8). The model's own per-step compute is too slow
 * relative to real time at chunkSize=8 on CPU-only hardware (measured
 * ~2x real-time, i.e. partials never catch up to live speech and only
 * surface once recording stops); doubling the chunk halves the number of
 * (expensive) session.run() calls per second of audio, which brings this
 * down to comfortably real-time (~0.8x measured) with no accuracy loss.
 * Larger multiples (24+) do measurably degrade accuracy, so 16 is the
 * validated sweet spot -- don't bump this further without re-validating
 * transcripts against the 8-frame baseline. */
export const LATENCY_1040MS_REALTIME_CACHE_META: SravaaniLiveCacheMeta = {
    ...LATENCY_1040MS_CACHE_META,
    chunkSize: 16,
};


function loadTokens(path: string): Map<number, string> {
    const tokens = new Map<number, string>();
    const lines = fs.readFileSync(path, "utf-8").split("\n");
    for (const line of lines) {
        const trimmed = line.replace(/\r$/, "");
        if (!trimmed) continue;
        const idx = trimmed.lastIndexOf(" ");
        if (idx === -1) continue;
        const piece = trimmed.slice(0, idx);
        const id = Number(trimmed.slice(idx + 1));
        tokens.set(id, piece);
    }
    return tokens;
}

/** Greedy CTC decode, accumulated across chunks, tracking the last-seen
 * token id across chunk boundaries (mirrors the reference script). */
class StreamingCtcDecoder {
    private prevToken: number | null = null;
    private pieces: string[] = [];

    constructor(private readonly tokens: Map<number, string>, private readonly blankId: number) {}

    addFrameIds(ids: number[]): void {
        for (const id of ids) {
            if (id !== this.blankId && id !== this.prevToken) {
                this.pieces.push(this.tokens.get(id) ?? `<${id}>`);
            }
            this.prevToken = id;
        }
    }

    text(): string {
        // NeMo BPE pieces use U+2581 as the word-start marker.
        return this.pieces.join("").replace(/\u2581/g, " ").trim();
    }

    reset(): void {
        this.prevToken = null;
        this.pieces = [];
    }
}



/** Growing store of normalized mel frames (128-dim each), with cheap
 * random-access slicing by frame index, matching NeMo's `self.buffer`. */
class MelFrameBuffer {
    private frames: Float32Array[] = [];
    private offset = 0; // absolute index of frames[0]

    push(frame: Float32Array): void { this.frames.push(frame); }
    get length(): number { return this.offset + this.frames.length; }

    sliceZeroPadFront(start: number, end: number, featureDim: number): Float32Array {
        const total = end - start;
        const out = new Float32Array(featureDim * total);
        for (let t = 0; t < total; t++) {
            const frameIdx = start + t - this.offset;
            if (frameIdx < 0 || frameIdx >= this.frames.length) continue;
            const frame = this.frames[frameIdx];
            for (let f = 0; f < featureDim; f++) out[f * total + t] = frame[f];
        }
        return out;
    }

    /** Drop frames no future step will need. */
    trim(keepFromAbsoluteIdx: number): void {
        const drop = keepFromAbsoluteIdx - this.offset;
        if (drop > 0 && drop <= this.frames.length) {
            this.frames.splice(0, drop);
            this.offset += drop;
        }
    }
}

export interface SravaaniLiveOnnxOptions {
    modelPath: string;
    tokensPath: string;
    cacheMeta?: SravaaniLiveCacheMeta;
    numThreads?: number;
}

export class SravaaniLiveOnnx {
    private session: ort.InferenceSession | null = null;
    private runtime: typeof import("onnxruntime-node") | null = null;
    private readonly tokens: Map<number, string>;
    private readonly blankId: number;
    private readonly meta: SravaaniLiveCacheMeta;

    private mel = new StreamingMelFrontend();
    private melBuffer = new MelFrameBuffer();
    private decoder: StreamingCtcDecoder;
    private lastText = "";

    /** Position in melBuffer of the next unconsumed frame -- mirrors
     * CacheAwareStreamingAudioBuffer.buffer_idx. */
    private bufferIdx = 0;
    private startedSteadyState = false;

    private cacheLastChannel!: Float32Array;
    private cacheLastTime!: Float32Array;
    private cacheLastChannelLen!: BigInt64Array;

    /** Serializes processAudio/finish calls onto a single chain so rapid
     * back-to-back IPC chunk events (which arrive faster than a chunk
     * takes to run through the ONNX graph) can never overlap and race on
     * the shared cache tensors. */
    private queue: Promise<unknown> = Promise.resolve();

    private enqueue<T>(fn: () => Promise<T>): Promise<T> {
        const result = this.queue.then(fn, fn);
        this.queue = result.then(
            () => undefined,
            () => undefined
        );
        return result;
    }

    constructor(private readonly options: SravaaniLiveOnnxOptions) {
        this.tokens = loadTokens(options.tokensPath);
        this.blankId = Math.max(...this.tokens.keys());
        this.meta = options.cacheMeta ?? LATENCY_1040MS_CACHE_META;
        this.decoder = new StreamingCtcDecoder(this.tokens, this.blankId);
        this.seedCache();
    }

    private seedCache(): void {
        const { numLayers, dModel, cacheLastChannelLen, cacheLastTimeLen } = this.meta;
        this.cacheLastChannel = new Float32Array(1 * numLayers * cacheLastChannelLen * dModel);
        this.cacheLastTime = new Float32Array(1 * numLayers * dModel * cacheLastTimeLen);
        this.cacheLastChannelLen = new BigInt64Array([0n]);
    }

    /** Guards against concurrent init() calls — multiple queued
     * processAudio entries can all see this.session === null and race
     * into InferenceSession.create, corrupting ONNX runtime state. */
    private initPromise: Promise<void> | null = null;

    async init(): Promise<void> {
        if (this.session) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            this.runtime = await import("onnxruntime-node");
            const t0 = Date.now();
            // onnxruntime-node's native session init can fail transiently
            // (e.g. "Session already disposed" from its process-wide ORT
            // env bookkeeping) even for a brand-new session; one retry
            // after a short delay clears this up in practice.
            try {
                this.session = await this.runtime.InferenceSession.create(this.options.modelPath, {
                    executionProviders: ["cpu"],
                    intraOpNumThreads: this.options.numThreads ?? 4,
                });
            } catch (err) {
                console.warn(
                    `[SraVaani-ONNX] Session create failed (${(err as Error).message}); retrying once.`
                );
                await new Promise((resolve) => setTimeout(resolve, 250));
                this.session = await this.runtime.InferenceSession.create(this.options.modelPath, {
                    executionProviders: ["cpu"],
                    intraOpNumThreads: this.options.numThreads ?? 4,
                });
            }
            console.log(`[SraVaani-ONNX] Session loaded in ${Date.now() - t0}ms:`, this.options.modelPath);
        })();

        try {
            await this.initPromise;
        } finally {
            this.initPromise = null;
        }
    }

    /** Eagerly load the ONNX model so processAudio doesn't block on
     * a multi-second model load during live recording. */
    async warmup(): Promise<void> {
        await this.init();
    }

    start(): void {
        this.mel.reset();
        this.melBuffer = new MelFrameBuffer();
        this.decoder.reset();
        this.lastText = "";
        this.bufferIdx = 0;
        this.startedSteadyState = false;
        this.seedCache();
    }

    /** Feed raw PCM (Float32, 16kHz mono). Returns the newly-recognized
     * text delta since the last call, or null if nothing new. Safe to
     * call rapidly/concurrently -- internally serialized. */
    processAudio(samples: Float32Array): Promise<string | null> {
        return this.enqueue(async () => {
            if (!this.session) await this.init();

            const newFrames = this.mel.pushSamples(samples);
            for (const frame of newFrames) this.melBuffer.push(frame);

            return this.runReadySteps();
        });
    }

    finish(): Promise<string | null> {
        return this.enqueue(async () => {
            if (!this.session) await this.init();

            const newFrames = this.mel.finish();
            for (const frame of newFrames) this.melBuffer.push(frame);

            // Run any remaining full steps, then flush a final partial step
            // (padded with whatever frames exist) so trailing audio isn't lost.
            await this.runReadySteps();
            await this.runFinalPartialStep();

            const finalText = this.decoder.text();
            return finalText || null;
        });
    }

    reset(): void {
        this.start();
    }

   private async runReadySteps(): Promise<string | null> {
    let latestText: string | null = null;

    for (;;) {
        if (!this.startedSteadyState) {
            // Mirrors the reference script's step-0 skip: the special
            // tiny priming chunk (chunk_size[0]=1, pre_encode_cache[0]=0)
            // is redundant since our cache is already zero-seeded at
            // steady-state size.
            if (this.melBuffer.length < 1) return latestText;
            this.bufferIdx = 1; // shift_size[0] == chunk_size[0] == 1
            this.startedSteadyState = true;
            continue;
        }

        const { chunkSize, preEncodeCacheSize } = this.meta;
        if (this.melBuffer.length < this.bufferIdx + chunkSize) {
            return latestText; // not enough new frames yet
        }

        const text = await this.runStep(this.bufferIdx, chunkSize, preEncodeCacheSize);
        if (text) latestText = text;
        this.bufferIdx += chunkSize; // shift_size[1] == chunk_size[1]

        // Drop mel frames no future step can still need -- everything
        // before (bufferIdx - preEncodeCacheSize) is out of every future
        // step's lookback window. Long-range context beyond that is
        // already carried in cache_last_channel/cache_last_time, not here.
        this.melBuffer.trim(this.bufferIdx - preEncodeCacheSize);
    }
}

    /** At end-of-utterance, run one last step over whatever trailing
     * frames remain (even if fewer than a full chunk), so the tail of
     * speech isn't silently dropped. */
private async runFinalPartialStep(): Promise<void> {
    if (!this.startedSteadyState) return;
    const remaining = this.melBuffer.length - this.bufferIdx;
    if (remaining <= 0) return;
    const { chunkSize, preEncodeCacheSize } = this.meta;
    await this.runStep(this.bufferIdx, chunkSize, preEncodeCacheSize); // fixed length, tail zero-padded
    this.bufferIdx = this.melBuffer.length;
}

    private async runStep(
        chunkStart: number,
        chunkLen: number,
        preEncodeCacheSize: number
    ): Promise<string | null> {
        const featureDim = 128;
        const totalLen = preEncodeCacheSize + chunkLen;
        const audioChunk = this.melBuffer.sliceZeroPadFront(
            chunkStart - preEncodeCacheSize,
            chunkStart + chunkLen,
            featureDim
        );

        const { numLayers, dModel, cacheLastChannelLen, cacheLastTimeLen } = this.meta;
        const runtime = this.runtime;
        if (!runtime || !this.session) {
            return null;
        }

        const feeds: Record<string, ort.Tensor> = {
            audio_signal: new runtime.Tensor("float32", audioChunk, [1, featureDim, totalLen]),
            length: new runtime.Tensor("int64", new BigInt64Array([BigInt(totalLen)]), [1]),
            cache_last_channel: new runtime.Tensor(
                "float32",
                this.cacheLastChannel,
                [1, numLayers, cacheLastChannelLen, dModel]
            ),
            cache_last_time: new runtime.Tensor(
                "float32",
                this.cacheLastTime,
                [1, numLayers, dModel, cacheLastTimeLen]
            ),
            cache_last_channel_len: new runtime.Tensor("int64", this.cacheLastChannelLen, [1]),
        };

        let results: ort.InferenceSession.OnnxValueMapType;
        try {
            results = await this.session!.run(feeds);
        } catch (err) {
            console.warn(
                `[SraVaani-ONNX] chunk at frame ${chunkStart} failed (${(err as Error).message}); skipping, cache unchanged.`
            );
            return null;
        }

        const logprobs = results["logprobs"];
        const cacheLastChannelNext = results["cache_last_channel_next"];
        const cacheLastTimeNext = results["cache_last_time_next"];
        const cacheLastChannelNextLen = results["cache_last_channel_next_len"];

        if (!logprobs || !cacheLastChannelNext || !cacheLastTimeNext || !cacheLastChannelNextLen) {
            console.warn("[SraVaani-ONNX] Unexpected output names:", Object.keys(results));
            return null;
        }

        this.cacheLastChannel = cacheLastChannelNext.data as Float32Array;
        this.cacheLastTime = cacheLastTimeNext.data as Float32Array;
        this.cacheLastChannelLen = cacheLastChannelNextLen.data as BigInt64Array;

        // logprobs shape: (1, T, vocab). Mirrors the reference script's
        // drop_extra_pre_encoded logic (a no-op whenever T <= dropExtra,
        // which is the common case for this export where T==1 per step).
        const [, timeSteps, vocab] = logprobs.dims as number[];
        const data = logprobs.data as Float32Array;

        let startT = 0;
        const dropExtra = this.meta.dropExtraPreEncoded;
        if (dropExtra && dropExtra < timeSteps) startT = dropExtra;

        const ids: number[] = [];
        for (let t = startT; t < timeSteps; t++) {
            let bestId = 0;
            let bestVal = -Infinity;
            const base = t * vocab;
            for (let v = 0; v < vocab; v++) {
                const val = data[base + v];
                if (val > bestVal) {
                    bestVal = val;
                    bestId = v;
                }
            }
            ids.push(bestId);
        }
        this.decoder.addFrameIds(ids);

        const text = this.decoder.text();
        if (text === this.lastText) return null;
        this.lastText = text;
        return text || null;
    }
}
