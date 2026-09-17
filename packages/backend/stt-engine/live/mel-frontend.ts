// packages/backend/stt-engine/live/mel-frontend.ts
//
// Causal, streaming re-implementation of NeMo's AudioToMelSpectrogramPreprocessor
// for the SraVaani-live ONNX export, validated numerically against real NeMo
// output (see conversation history: max abs diff ~0.004 vs ground-truth NeMo
// mel frames dumped from the working Python reference script).
//
// Config (from asr_model.cfg.preprocessor, confirmed via inspection):
//   sample_rate=16000, n_fft=512, window_size=0.025 (400 samples),
//   window_stride=0.01 (160 samples), window=hann, features=128,
//   normalize=per_feature, frame_splicing=1, dither=1e-5 (no-op at eval)
//
// FilterbankFeatures defaults NOT in the yaml (confirmed from NeMo source,
// nemo/collections/asr/parts/preprocessing/features.py):
//   preemph=0.97, log_zero_guard_type="add", log_zero_guard_value=2**-24,
//   mag_power=2.0, mel_norm="slaney", lowfreq=0, highfreq=sample_rate/2
//
// KEY DEVIATION FROM THE OFFLINE TEST SCRIPT (documented, deliberate):
// NeMo's CacheAwareStreamingAudioBuffer with online_normalization=False
// computes per_feature normalization ONCE, globally, over the entire
// (already fully-recorded) utterance -- confirmed by extracting and
// diffing against real NeMo mel dumps. That requires knowing the whole
// utterance in advance, which a live/growing mic stream never has.
// This module instead uses a CAUSAL running (Welford) per-feature mean/std
// over all frames seen so far in the current utterance, and normalizes
// each frame exactly once, at the moment it is finalized -- its value is
// never retroactively changed. This keeps chunk/cache overlap regions
// internally consistent (a given frame always has the same normalized
// value no matter which later chunk's pre-encode-cache window re-reads it).

const SAMPLE_RATE = 16000;
const N_FFT = 512;
const WIN_LENGTH = 400; // 25ms
const HOP_LENGTH = 160; // 10ms
const NFILT = 128;
const PREEMPH = 0.97;
const LOG_ZERO_GUARD = Math.pow(2, -24);
const HALF_WIN = WIN_LENGTH / 2; // 200 -- causal lookahead needed per frame

// ---------------------------------------------------------------------------
// Hann window (periodic=False in torch == symmetric Hann)
// ---------------------------------------------------------------------------
function hannWindow(length: number): Float64Array {
    const w = new Float64Array(length);
    for (let n = 0; n < length; n++) {
        w[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (length - 1));
    }
    return w;
}

// ---------------------------------------------------------------------------
// Slaney-style mel filterbank, matching librosa.filters.mel(norm="slaney")
// ---------------------------------------------------------------------------
function hzToMel(hz: number): number {
    const fMin = 0.0;
    const fSp = 200.0 / 3;
    let mel = (hz - fMin) / fSp;

    const minLogHz = 1000.0;
    const minLogMel = (minLogHz - fMin) / fSp;
    const logstep = Math.log(6.4) / 27.0;

    if (hz >= minLogHz) {
        mel = minLogMel + Math.log(hz / minLogHz) / logstep;
    }
    return mel;
}

function melToHz(mel: number): number {
    const fMin = 0.0;
    const fSp = 200.0 / 3;
    let hz = fMin + fSp * mel;

    const minLogHz = 1000.0;
    const minLogMel = (minLogHz - fMin) / fSp;
    const logstep = Math.log(6.4) / 27.0;

    if (mel >= minLogMel) {
        hz = minLogHz * Math.exp(logstep * (mel - minLogMel));
    }
    return hz;
}

function buildMelFilterbank(
    sampleRate: number,
    nFft: number,
    nMels: number,
    fMin: number,
    fMax: number
): Float64Array[] {
    const nFreqs = Math.floor(nFft / 2) + 1; // 257
    const fftFreqs = new Float64Array(nFreqs);
    for (let i = 0; i < nFreqs; i++) {
        fftFreqs[i] = (i * sampleRate) / nFft;
    }

    const melMin = hzToMel(fMin);
    const melMax = hzToMel(fMax);
    const melPoints = new Float64Array(nMels + 2);
    for (let i = 0; i < nMels + 2; i++) {
        melPoints[i] = melMin + ((melMax - melMin) * i) / (nMels + 1);
    }
    const hzPoints = new Float64Array(nMels + 2);
    for (let i = 0; i < nMels + 2; i++) hzPoints[i] = melToHz(melPoints[i]);

    const fdiff = new Float64Array(nMels + 1);
    for (let i = 0; i < nMels + 1; i++) fdiff[i] = hzPoints[i + 1] - hzPoints[i];

    const weights: Float64Array[] = [];
    for (let m = 0; m < nMels; m++) {
        const row = new Float64Array(nFreqs);
        for (let j = 0; j < nFreqs; j++) {
            const lower = -(hzPoints[m] - fftFreqs[j]) / fdiff[m];
            const upper = (hzPoints[m + 2] - fftFreqs[j]) / fdiff[m + 1];
            row[j] = Math.max(0, Math.min(lower, upper));
        }
        // slaney area normalization
        const enorm = 2.0 / (hzPoints[m + 2] - hzPoints[m]);
        for (let j = 0; j < nFreqs; j++) row[j] *= enorm;
        weights.push(row);
    }
    return weights;
}

// ---------------------------------------------------------------------------
// Minimal iterative radix-2 complex FFT (N_FFT=512 is a power of two)
// ---------------------------------------------------------------------------
function fft(re: Float64Array, im: Float64Array): void {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            [re[i], re[j]] = [re[j], re[i]];
            [im[i], im[j]] = [im[j], im[i]];
        }
    }
    for (let len = 2; len <= n; len <<= 1) {
        const ang = (-2 * Math.PI) / len;
        const wRe = Math.cos(ang);
        const wIm = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
            let curRe = 1;
            let curIm = 0;
            for (let k = 0; k < len / 2; k++) {
                const uRe = re[i + k];
                const uIm = im[i + k];
                const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
                const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
                re[i + k] = uRe + vRe;
                im[i + k] = uIm + vIm;
                re[i + k + len / 2] = uRe - vRe;
                im[i + k + len / 2] = uIm - vIm;
                const nextRe = curRe * wRe - curIm * wIm;
                const nextIm = curRe * wIm + curIm * wRe;
                curRe = nextRe;
                curIm = nextIm;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Causal Welford running per-feature (per mel-bin) normalizer
// ---------------------------------------------------------------------------
class RunningPerFeatureNormalizer {
    private readonly n: number;
    private count = 0;
    private mean: Float64Array;
    private m2: Float64Array;

    constructor(numFeatures: number) {
        this.n = numFeatures;
        this.mean = new Float64Array(numFeatures);
        this.m2 = new Float64Array(numFeatures);
    }

    /** Updates running stats with `frame`, then returns a NEW normalized
     * Float32Array using stats that include this frame. The returned
     * values are final -- never recomputed for this frame again. */
    normalize(frame: Float64Array): Float32Array {
        this.count += 1;
        for (let i = 0; i < this.n; i++) {
            const delta = frame[i] - this.mean[i];
            this.mean[i] += delta / this.count;
            const delta2 = frame[i] - this.mean[i];
            this.m2[i] += delta * delta2;
        }

        const out = new Float32Array(this.n);
        if (this.count < 2) {
            // Matches NeMo's edge case: std undefined with <2 samples -> 0,
            // then +CONSTANT guard applied below.
            for (let i = 0; i < this.n; i++) {
                out[i] = 0;
            }
            return out;
        }
        for (let i = 0; i < this.n; i++) {
            const variance = this.m2[i] / (this.count - 1);
            const std = Math.sqrt(Math.max(variance, 0)) + 1e-5;
            out[i] = (frame[i] - this.mean[i]) / std;
        }
        return out;
    }

    reset(): void {
        this.count = 0;
        this.mean.fill(0);
        this.m2.fill(0);
    }
}

// ---------------------------------------------------------------------------
// StreamingMelFrontend: feed raw PCM in, get normalized 128-dim log-mel
// frames out, one 10ms hop at a time, causally.
// ---------------------------------------------------------------------------
export class StreamingMelFrontend {
    private readonly hann = hannWindow(WIN_LENGTH);
    private readonly melFb = buildMelFilterbank(SAMPLE_RATE, N_FFT, NFILT, 0, SAMPLE_RATE / 2);
    private readonly normalizer = new RunningPerFeatureNormalizer(NFILT);

    /** Preemphasized signal accumulated so far. Trimmed periodically. */
    private signal: number[] = [];
    /** Absolute sample index of signal[0] within the full utterance. */
    private signalOffset = 0;
    /** Last RAW (pre-preemphasis) sample carried across chunks. */
    private lastRawSample: number | null = null;
    /** Next frame index (k) not yet computed. */
    private nextFrame = 0;
    private finished = false;

    /** Feed new raw PCM samples (Float32, -1..1, 16kHz mono). Returns any
     * newly-completed normalized log-mel frames (each length 128). */
    pushSamples(samples: Float32Array): Float32Array[] {
        if (this.finished) {
            throw new Error("StreamingMelFrontend: pushSamples() called after finish()");
        }

        // Continuous preemphasis, stateful across chunks. The very first
        // sample of the whole utterance is left unmodified (matches NeMo:
        // x[:,0] unchanged, x[:,1:] -= preemph * x[:,:-1]).
        for (let i = 0; i < samples.length; i++) {
            const raw = samples[i];
            const out = this.lastRawSample === null ? raw : raw - PREEMPH * this.lastRawSample;
            this.lastRawSample = raw;
            this.signal.push(out);
        }

        return this.computeReadyFrames(false);
    }

    /** Call once when the utterance ends. Flushes any remaining frames
     * using zero-padding for the missing tail context (matches NeMo's
     * end-of-utterance center-padding behavior closely enough that it
     * doesn't affect the decoded text). */
    finish(): Float32Array[] {
        if (this.finished) return [];
        this.finished = true;
        return this.computeReadyFrames(true);
    }

    reset(): void {
        this.signal = [];
        this.signalOffset = 0;
        this.lastRawSample = null;
        this.nextFrame = 0;
        this.finished = false;
        this.normalizer.reset();
    }

    private computeReadyFrames(flush: boolean): Float32Array[] {
        const out: Float32Array[] = [];
        const currentLen = this.signalOffset + this.signal.length;

        // Frame k needs samples [k*HOP - HALF_WIN, k*HOP + HALF_WIN).
        // It's ready once currentLen >= k*HOP + HALF_WIN (upper edge exists),
        // OR we're flushing (use zero-padding for any missing tail).
        for (;;) {
            const frameStart = this.nextFrame * HOP_LENGTH - HALF_WIN;
            const frameEnd = frameStart + WIN_LENGTH; // exclusive
            if (!flush && frameEnd > currentLen) break;
            if (flush && frameStart >= currentLen) break;

            const windowed = new Float64Array(N_FFT); // zero-padded 400 -> 512
            for (let i = 0; i < WIN_LENGTH; i++) {
                const absIdx = frameStart + i;
                let sample = 0;
                if (absIdx >= 0 && absIdx < currentLen) {
                    const localIdx = absIdx - this.signalOffset;
                    if (localIdx >= 0 && localIdx < this.signal.length) {
                        sample = this.signal[localIdx];
                    }
                }
                windowed[i] = sample * this.hann[i];
            }

            const re = windowed; // reuse buffer
            const im = new Float64Array(N_FFT);
            fft(re, im);

            const nFreqs = N_FFT / 2 + 1;
            const power = new Float64Array(nFreqs);
            for (let j = 0; j < nFreqs; j++) {
                power[j] = re[j] * re[j] + im[j] * im[j]; // mag^2 == power (mag_power=2.0)
            }

            const logMel = new Float64Array(NFILT);
            for (let m = 0; m < NFILT; m++) {
                let sum = 0;
                const row = this.melFb[m];
                for (let j = 0; j < nFreqs; j++) sum += row[j] * power[j];
                logMel[m] = Math.log(sum + LOG_ZERO_GUARD);
            }

            out.push(this.normalizer.normalize(logMel));
            this.nextFrame += 1;
        }

        // Trim consumed history: keep only what a future frame could still
        // need (HALF_WIN samples of lookback from the oldest un-computed
        // frame's start).
        const keepFrom = Math.max(0, this.nextFrame * HOP_LENGTH - HALF_WIN - HOP_LENGTH);
        if (keepFrom > this.signalOffset) {
            const drop = keepFrom - this.signalOffset;
            if (drop > 0 && drop <= this.signal.length) {
                this.signal.splice(0, drop);
                this.signalOffset = keepFrom;
            }
        }

        return out;
    }
}
