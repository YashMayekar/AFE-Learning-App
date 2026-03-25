import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { isLowEndDevice } from '@afe/shared/hardware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When running inside the desktop app, init() sets this; otherwise use package dir (parent of dist/)
let packageRoot = path.resolve(__dirname, "..");

function getModelPath(): string {
    return path.join(packageRoot, "ggml-base-q5_1.bin");
}
/** Prefer whisper-whisper-cli (Dec 2024+), fallback to whisper-cli (legacy). */
function getWhisperBin(): string {
    const ext = process.platform === "win32" ? ".exe" : "";
    const candidates = [`whisper-whisper-cli${ext}`, `whisper-cli${ext}`];
    for (const name of candidates) {
        const bin = path.join(packageRoot, name);
        if (fs.existsSync(bin)) return bin;
    }
    return path.join(packageRoot, candidates[1]); // default for "not found" error
}

/**
 * Set the directory containing whisper-cli, model, and (on Linux) libwhisper.
 * Call this from the Electron main process with getSttRoot() so packaged builds use resources/stt.
 */
export function init(sttRoot: string): void {
    packageRoot = path.resolve(sttRoot);
}

let audioBuffer: Buffer[] = [];

// =============================
// Push Audio Chunk
// =============================
export function pushAudioChunk(chunk: Buffer) {
    if (!chunk || chunk.length === 0) return;

    // Optional safety: prevent unbounded memory growth
    if (audioBuffer.length > 10000) {
        console.warn("[STT] Too many audio chunks. Resetting buffer.");
        audioBuffer = [];
        return;
    }

    audioBuffer.push(chunk);
}

// =============================
// Create WAV File
// =============================
function createWavFile(pcmData: Buffer, sampleRate: number) {
    const header = Buffer.alloc(44);
    const fileSize = 36 + pcmData.length;

    header.write("RIFF", 0);
    header.writeUInt32LE(fileSize, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(1, 22); // Mono
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28); // Byte rate
    header.writeUInt16LE(2, 32); // Block align
    header.writeUInt16LE(16, 34); // Bits per sample
    header.write("data", 36);
    header.writeUInt32LE(pcmData.length, 40);

    return Buffer.concat([header, pcmData]);
}

// =============================
// Process Audio (Push-to-Talk)
// =============================
export async function processAudio(): Promise<string | null> {
    console.log("[STT] Processing audio...");
    if (audioBuffer.length === 0) {
        console.log("[STT] No audio chunks to process.");
        return null;
    }

    const modelPath = getModelPath();
    const whisperBin = getWhisperBin();
    if (!fs.existsSync(modelPath)) {
        console.error("[STT] Model file not found:", modelPath);
        return null;
    }

    if (!fs.existsSync(whisperBin)) {
        console.error("[STT] Whisper binary not found. Looked for whisper-whisper-cli or whisper-cli in:", packageRoot);
        return null;
    }

    console.log(`[STT] Processing audio... Chunks: ${audioBuffer.length}`);

    const merged = Buffer.concat(audioBuffer);
    audioBuffer = [];

    if (merged.length === 0) {
        console.warn("[STT] Merged audio is empty.");
        return null;
    }

    const wavFile = createWavFile(merged, 16000);

    // Unique temp filename to avoid race condition
    const tempFile = path.join(
        os.tmpdir(),
        `recording-${crypto.randomUUID()}.wav`
    );

    try {
        await fs.promises.writeFile(tempFile, wavFile);
    } catch (err) {
        console.error("[STT] Failed to write temp WAV:", err);
        return null;
    }

    console.log(`[STT] Temp WAV created: ${tempFile}`);

    // So the binary finds its shared library: Linux/macOS use LD_LIBRARY_PATH/DYLD_LIBRARY_PATH;
    // Windows finds DLLs next to the .exe if we add packageRoot to PATH
    let env: NodeJS.ProcessEnv = { ...process.env };
    if (process.platform === "win32") {
        const pathEnv = process.env.PATH || "";
        env.PATH = [packageRoot, pathEnv].filter(Boolean).join(path.delimiter);
    } else {
        const libPath = process.platform === "darwin" ? "DYLD_LIBRARY_PATH" : "LD_LIBRARY_PATH";
        const existing = process.env[libPath] || "";
        env[libPath] = [packageRoot, existing].filter(Boolean).join(path.delimiter);
    }

    return new Promise((resolve) => {
        execFile(
            whisperBin,
            [
                "-m", modelPath,
                "-f", tempFile,
                "--no-timestamps",
                "--language", "auto",
                "--threads", isLowEndDevice() ? "2" : "4" // Reduce threads on low-end
            ],
            { maxBuffer: 10 * 1024 * 1024, env }, // 10MB stdout limit
            async (err, stdout, stderr) => {

                // Clean temp file always
                try {
                    await fs.promises.unlink(tempFile);
                } catch {
                    // ignore cleanup error
                }

                if (err) {
                    console.error("[STT] whisper-cli execution error:", err.message);
                    if (stderr && stderr.trim()) console.error("[STT] stderr:", stderr);
                    if (stdout && stdout.trim()) console.error("[STT] stdout:", stdout);
                    resolve(null);
                    return;
                }

                if (!stdout || stdout.trim().length === 0) {
                    console.warn("[STT] No transcription output.");
                    resolve(null);
                    return;
                }

                // Clean up transcript: remove Whisper tags like [BLANK_AUDIO], [TEXT], [MUSIC], etc.
                let result = stdout.trim();

                // Remove [...] tags and extra whitespace
                result = result
                    .replace(/\[[A-Z_ \.]+\]/g, "") // Remove tags like [BLANK_AUDIO] or [ TEXT ]
                    .replace(/\(.*\)/g, "")         // Remove tags like (silence)
                    .replace(/\s+/g, " ")           // Collapse extra spaces
                    .trim();

                if (!result) {
                    console.warn("[STT] Transcription only contained tags.");
                    resolve(null);
                    return;
                }

                console.log(`[STT] Transcription (cleaned): "${result}"`);
                resolve(result);
            }
        );
    });
}

// =============================
// Reset Audio
// =============================
export function resetAudio() {
    audioBuffer = [];
}
