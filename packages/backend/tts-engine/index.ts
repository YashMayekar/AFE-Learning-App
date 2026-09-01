import { execFile, ChildProcess } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When running inside the desktop app, init() sets this; otherwise use package dir
let packageRoot = path.resolve(__dirname, "..");

// Track active Piper process for cancellation and reuse it across sentence-level requests.
let activeProcess: ChildProcess | null = null;
let piperReady = false;
let piperStartupPromise: Promise<void> | null = null;

function ensureEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };
    if (process.platform === "win32") {
        const pathEnv = process.env.PATH || "";
        env.PATH = [packageRoot, pathEnv].filter(Boolean).join(path.delimiter);
    } else {
        const libPath = process.platform === "darwin" ? "DYLD_LIBRARY_PATH" : "LD_LIBRARY_PATH";
        const existing = process.env[libPath] || "";
        env[libPath] = [packageRoot, existing].filter(Boolean).join(path.delimiter);
    }

    const espeakDataPath = path.join(packageRoot, "espeak-ng-data");
    if (fs.existsSync(espeakDataPath)) {
        env.ESPEAK_DATA_PATH = espeakDataPath;
    }

    return env;
}

function startPiperProcess(): Promise<void> {
    if (activeProcess && !activeProcess.killed) {
        return Promise.resolve();
    }

    if (piperStartupPromise) {
        return piperStartupPromise;
    }

    piperStartupPromise = new Promise((resolve, reject) => {
        const piperBin = getPiperBin();
        const modelPath = getModelPath();
        const configPath = getConfigPath(modelPath);
        const env = ensureEnv();

        const args = ["--model", modelPath, "--json-input"];
        if (configPath) args.push("--config", configPath);

        const espeakDataPath = path.join(packageRoot, "espeak-ng-data");
        if (fs.existsSync(espeakDataPath)) {
            args.push("--espeak_data", espeakDataPath);
        }

        try {
            const proc = execFile(piperBin, args, { env }, (err) => {
                if (err && !err.killed) {
                    console.error("[TTS] Piper process error:", err.message);
                }
                activeProcess = null;
                piperReady = false;
                piperStartupPromise = null;
            });

            activeProcess = proc;
            piperReady = true;
            resolve();
        } catch (error) {
            console.error("[TTS] Failed to start persistent Piper process:", error);
            piperStartupPromise = null;
            reject(error);
        }
    });

    return piperStartupPromise;
}

function getModelPath(): string {
    // Look for any .onnx voice model file
    const files = fs.readdirSync(packageRoot).filter(f => f.endsWith(".onnx"));
    if (files.length > 0) return path.join(packageRoot, files[0]);
    return path.join(packageRoot, "en_US-lessac-medium.onnx");
}

function getConfigPath(modelPath: string): string | null {
    // 1. Try conventional <model>.onnx.json
    const conventionalConfig = modelPath + ".json";
    if (fs.existsSync(conventionalConfig)) return conventionalConfig;

    // 2. Fallback: find any JSON file that looks like a Piper voice config
    const jsonFiles = fs.readdirSync(packageRoot).filter(f =>
        f.endsWith(".json") && f !== "package.json" && f !== "tsconfig.json"
    );
    if (jsonFiles.length > 0) return path.join(packageRoot, jsonFiles[0]);

    return null;
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

    try {
        await startPiperProcess();
    } catch (error) {
        console.error("[TTS] Could not start persistent Piper process:", error);
        return null;
    }

    const proc = activeProcess;
    if (!proc) {
        console.error("[TTS] Persistent Piper process not ready.");
        return null;
    }

    const stdout = proc.stdout;
    const stdin = proc.stdin;
    if (!stdout || !stdin) {
        console.error("[TTS] Persistent Piper IO streams not ready.");
        return null;
    }

    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let settled = false;

        const cleanup = () => {
            stdout.off("data", onData);
            proc.off("close", onClose);
            proc.off("error", onError);
        };

        const onData = (chunk: Buffer) => {
            chunks.push(Buffer.from(chunk));
        };

        const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
            if (settled) return;
            settled = true;
            cleanup();
            activeProcess = null;
            piperReady = false;
            piperStartupPromise = null;
            if (code !== 0 && signal !== "SIGTERM") {
                console.error(`[TTS] Piper exited with code=${code} signal=${signal}`);
                reject(new Error(`Piper exited with code=${code} signal=${signal}`));
                return;
            }
            resolve(Buffer.concat(chunks));
        };

        const onError = (error: Error) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(error);
        };

        stdout.on("data", onData);
        proc.once("close", onClose);
        proc.once("error", onError);

        try {
            stdin.write(JSON.stringify({ text }) + "\n");
            stdin.end();
        } catch (error) {
            cleanup();
            reject(error);
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
