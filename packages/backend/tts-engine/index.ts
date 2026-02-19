import { execFile, ChildProcess } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

// When running inside the desktop app, init() sets this; otherwise use package dir
let packageRoot = path.resolve(__dirname, "..");

// Track active Piper process for cancellation
let activeProcess: ChildProcess | null = null;

function getModelPath(): string {
    // Look for any .onnx voice model file
    const files = fs.readdirSync(packageRoot).filter(f => f.endsWith(".onnx"));
    if (files.length > 0) return path.join(packageRoot, files[0]);
    return path.join(packageRoot, "en_US-lessac-medium.onnx");
}

function getPiperBin(): string {
    const ext = process.platform === "win32" ? ".exe" : "";
    const bin = path.join(packageRoot, `piper${ext}`);
    return bin;
}

/**
 * Set the directory containing piper binary and voice model.
 * Call this from the Electron main process.
 */
export function init(ttsRoot: string): void {
    packageRoot = path.resolve(ttsRoot);
    console.log("[TTS] Initialized with root:", packageRoot);
}

/**
 * Check if Piper TTS is available (binary + model exist)
 */
export function isAvailable(): boolean {
    const bin = getPiperBin();
    const model = getModelPath();
    const binExists = fs.existsSync(bin);
    const modelExists = fs.existsSync(model);
    console.log(`[TTS] Available check: bin=${binExists} (${bin}), model=${modelExists} (${model})`);
    return binExists && modelExists;
}

/**
 * Synthesize speech from text using Piper TTS.
 * Returns a WAV buffer, or null if Piper is unavailable.
 */
export async function speak(text: string): Promise<Buffer | null> {
    if (!text || text.trim().length === 0) {
        console.warn("[TTS] Empty text, skipping.");
        return null;
    }

    if (!isAvailable()) {
        console.warn("[TTS] Piper not available, falling back to OS TTS.");
        return null;
    }

    const piperBin = getPiperBin();
    const modelPath = getModelPath();

    // Output to a temp WAV file
    const tempFile = path.join(
        os.tmpdir(),
        `tts-${crypto.randomUUID()}.wav`
    );

    console.log(`[TTS] Synthesizing: "${text.substring(0, 50)}..."`);

    // Set up environment for lib discovery
    let env: NodeJS.ProcessEnv = { ...process.env };
    if (process.platform === "win32") {
        const pathEnv = process.env.PATH || "";
        env.PATH = [packageRoot, pathEnv].filter(Boolean).join(path.delimiter);
    } else {
        const libPath = process.platform === "darwin" ? "DYLD_LIBRARY_PATH" : "LD_LIBRARY_PATH";
        const existing = process.env[libPath] || "";
        env[libPath] = [packageRoot, existing].filter(Boolean).join(path.delimiter);
    }

    // Point Piper to espeak-ng-data if it exists locally
    const espeakDataPath = path.join(packageRoot, "espeak-ng-data");
    if (fs.existsSync(espeakDataPath)) {
        env.ESPEAK_DATA_PATH = espeakDataPath;
    }

    return new Promise((resolve) => {
        const proc = execFile(
            piperBin,
            [
                "--model", modelPath,
                "--output_file", tempFile
            ],
            { maxBuffer: 50 * 1024 * 1024, env, timeout: 30000 },
            async (err, stdout, stderr) => {
                activeProcess = null;

                if (err) {
                    console.error("[TTS] Piper execution error:", err.message);
                    if (stderr && stderr.trim()) console.error("[TTS] stderr:", stderr);
                    // Cleanup temp file
                    try { await fs.promises.unlink(tempFile); } catch { }
                    resolve(null);
                    return;
                }

                // Read the WAV file
                try {
                    const wavBuffer = await fs.promises.readFile(tempFile);
                    await fs.promises.unlink(tempFile);
                    console.log(`[TTS] Generated WAV: ${wavBuffer.length} bytes`);
                    resolve(wavBuffer);
                } catch (readErr) {
                    console.error("[TTS] Failed to read WAV output:", readErr);
                    try { await fs.promises.unlink(tempFile); } catch { }
                    resolve(null);
                }
            }
        );

        activeProcess = proc;

        // Pipe text to Piper's stdin
        if (proc.stdin) {
            proc.stdin.write(text);
            proc.stdin.end();
        }
    });
}

/**
 * Stop any active TTS synthesis.
 */
export function stop(): void {
    if (activeProcess) {
        console.log("[TTS] Stopping active synthesis.");
        try {
            activeProcess.kill();
        } catch {
            // ignore
        }
        activeProcess = null;
    }
}
