// debug-sravaani-live.ts
//
// Standalone diagnostic: feeds a WAV file straight into the SraVaani-live
// OnlineRecognizer (nemo_ctc) in small simulated chunks, exactly like your
// app does in processAudio(), but completely outside Electron/IPC. Logs
// isReady()/decode() behavior and getResult().text after every chunk so
// you can see whether the live model is producing anything at all.
//
// Run with:  npx tsx debug-sravaani-live.ts path/to/test.wav [model-dir]
// (tsx runs TS directly; or compile with tsc like the rest of this package)
//
// Good test files: any 16kHz mono 16-bit PCM wav, e.g. one of the files
// already in sherpa-onnx-streaming-zipformer-indian-en/test_wavs/*.wav

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
// @ts-ignore - same import pattern as sherpa.ts
import sherpaOnnx from "sherpa-onnx-node";

const { OnlineRecognizer } = sherpaOnnx;

// Same pattern as sherpa.ts - reliable under ESM, unlike bare __dirname under tsx.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAMPLE_RATE = 16000;
const CHUNK_MS = 100; // simulate ~100ms audio chunks, like a real mic stream
const CHUNK_SAMPLES = Math.round((SAMPLE_RATE * CHUNK_MS) / 1000);

const WAV_PATH = process.argv[2];
const MODEL_DIR = process.argv[3]
    ? path.resolve(process.cwd(), process.argv[3])
    : path.join(__dirname, "SraVaani-live-0.5-onnx-export-v2/latency_80ms");

if (!WAV_PATH) {
    console.error("Usage: npx tsx debug-sravaani-live.ts <path-to-16k-mono-wav> [model-dir]");
    process.exit(1);
}

function readWavFloat32(filePath: string): { samples: Float32Array; sampleRate: number } {
    const buf = fs.readFileSync(filePath);

    if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
        throw new Error("Not a RIFF/WAVE file");
    }

    let offset = 12;
    let fmt: { channels: number; sampleRate: number; bitsPerSample: number } | null = null;
    let dataStart = -1;
    let dataLength = 0;

    while (offset < buf.length - 8) {
        const chunkId = buf.toString("ascii", offset, offset + 4);
        const chunkSize = buf.readUInt32LE(offset + 4);
        const chunkStart = offset + 8;

        if (chunkId === "fmt ") {
            fmt = {
                channels: buf.readUInt16LE(chunkStart + 2),
                sampleRate: buf.readUInt32LE(chunkStart + 4),
                bitsPerSample: buf.readUInt16LE(chunkStart + 14),
            };
        } else if (chunkId === "data") {
            dataStart = chunkStart;
            dataLength = chunkSize;
        }

        offset = chunkStart + chunkSize + (chunkSize % 2);
    }

    if (!fmt || dataStart < 0) {
        throw new Error("Could not find fmt/data chunks in WAV file");
    }

    if (fmt.channels !== 1 || fmt.bitsPerSample !== 16) {
        throw new Error(
            `Expected mono 16-bit PCM, got channels=${fmt.channels} bitsPerSample=${fmt.bitsPerSample}. ` +
            `Convert first, e.g.: ffmpeg -i in.wav -ac 1 -ar 16000 -sample_fmt s16 out.wav`
        );
    }

    const sampleCount = dataLength / 2;
    const samples = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
        samples[i] = buf.readInt16LE(dataStart + i * 2) / 32768;
    }

    return { samples, sampleRate: fmt.sampleRate };
}

// Naive linear-interpolation resampler. Good enough for a diagnostic script;
// for production audio pipelines prefer a proper anti-aliased resampler
// (e.g. ffmpeg, or whatever your mic-capture pipeline already uses).
function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) return input;

    const ratio = fromRate / toRate;
    const outputLength = Math.floor(input.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
        const srcIndex = i * ratio;
        const srcIndexFloor = Math.floor(srcIndex);
        const frac = srcIndex - srcIndexFloor;
        const s0 = input[srcIndexFloor] ?? 0;
        const s1 = input[srcIndexFloor + 1] ?? s0;
        output[i] = s0 + (s1 - s0) * frac;
    }

    return output;
}

function main() {
    const modelFile = path.join(MODEL_DIR, "model.onnx");
    const tokensFile = path.join(MODEL_DIR, "tokens.txt");

    console.log("[debug] Model:", modelFile);
    console.log("[debug] Tokens:", tokensFile);
    console.log("[debug] WAV:", WAV_PATH);

    const recognizer = new OnlineRecognizer({
        featConfig: { sampleRate: SAMPLE_RATE, featureDim: 128 },
        modelConfig: {
            nemoCtc: { model: modelFile },
            tokens: tokensFile,
            numThreads: 1,
            provider: "cpu",
        },
        decodingMethod: "greedy_search",
        enableEndpoint: true,
        rule1MinTrailingSilence: 1.2,
        rule2MinTrailingSilence: 0.8,
        rule3MinUtteranceLength: 20,
    });

    const stream = recognizer.createStream();
    const wav = readWavFloat32(WAV_PATH);

    console.log(`[debug] WAV native sample rate: ${wav.sampleRate}Hz, ${wav.samples.length} samples`);

    const samples = resampleLinear(wav.samples, wav.sampleRate, SAMPLE_RATE);

    if (wav.sampleRate !== SAMPLE_RATE) {
        console.log(`[debug] Resampled ${wav.sampleRate}Hz -> ${SAMPLE_RATE}Hz (${wav.samples.length} -> ${samples.length} samples)`);
    }

    console.log(`[debug] Feeding ${samples.length} samples (${(samples.length / SAMPLE_RATE).toFixed(2)}s)\n`);

    let lastText = "";

    for (let start = 0; start < samples.length; start += CHUNK_SAMPLES) {
        const chunk = samples.subarray(start, start + CHUNK_SAMPLES);
        const chunkIndex = Math.floor(start / CHUNK_SAMPLES);

        stream.acceptWaveform({ samples: chunk, sampleRate: SAMPLE_RATE });

        let decodeCount = 0;
        try {
            while (recognizer.isReady(stream)) {
                recognizer.decode(stream);
                decodeCount++;
            }
        } catch (err) {
            console.error(`[chunk ${chunkIndex}] decode() THREW:`, err);
            continue;
        }

        const result = recognizer.getResult(stream);
        const text = result.text?.trim() ?? "";

        if (text !== lastText) {
            console.log(`[chunk ${chunkIndex}] decodeCount=${decodeCount}  text changed -> "${text}"`);
            lastText = text;
        } else {
            console.log(`[chunk ${chunkIndex}] decodeCount=${decodeCount}  text unchanged ("${text}")`);
        }
    }

    stream.inputFinished();
    try {
        while (recognizer.isReady(stream)) {
            recognizer.decode(stream);
        }
    } catch (err) {
        console.error("[finalize] decode() THREW:", err);
    }

    const finalResult = recognizer.getResult(stream);
    console.log("\n[debug] FINAL from LIVE recognizer only:", JSON.stringify(finalResult.text));
}

main();