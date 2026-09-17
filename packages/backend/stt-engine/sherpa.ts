// packages/backend/stt-engine/sherpa.ts
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import sherpaOnnx from "sherpa-onnx-node";
import { SravaaniLiveOnnx, LATENCY_1040MS_CACHE_META } from "./live/sravaani-live-onnx.js";

const { OnlineRecognizer, OfflineRecognizer } = sherpaOnnx;
type OnlineRecognizerInstance = InstanceType<typeof OnlineRecognizer>;
type OfflineRecognizerInstance = InstanceType<typeof OfflineRecognizer>;
type OnlineStream = ReturnType<OnlineRecognizerInstance["createStream"]>;
type OfflineStream = ReturnType<OfflineRecognizerInstance["createStream"]>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_MODEL_DIR = path.join(
    __dirname,
    "../sherpa-onnx-streaming-zipformer-indian-en"
);

const OVERRIDE_MODEL_DIR = process.env.SHERPA_STT_MODEL_DIR
    ? path.resolve(process.env.SHERPA_STT_MODEL_DIR)
    : null;

const REQUESTED_MODEL_NAME =
    (process.env.STT_MODEL ?? process.env.SHERPA_STT_MODEL ?? "english")
        .trim()
        .toLowerCase();

const MODEL_NAME_ALIASES: Record<string, string[]> = {
    english: ["english", "en", "zipformer-en"],
    "indian-english": ["indian-english", "indian english", "indian-en", "zipformer-indian-en"],
    hinglish: ["hinglish", "hi-en", "hindi-english", "hindi english", "zipformer-hi-en"],
    hindi: ["hindi", "hi", "zipformer-hi"],
    tamil: ["tamil", "ta", "zipformer-ta"],
    telugu: ["telugu", "te", "zipformer-te"],
    marathi: ["marathi", "mr", "zipformer-mr"],
    gujarati: ["gujarati", "gu", "zipformer-gu"],
    kannada: ["kannada", "kn", "zipformer-kn"],
};

export const SUPPORTED_SPEECH_LANGUAGES = [
    "en",
    "hi",
    "hi-en",
    "ta",
    "te",
    "mr",
    "gu",
    "kn",
] as const;

export type SupportedSpeechLanguage =
    (typeof SUPPORTED_SPEECH_LANGUAGES)[number];

const LANGUAGE_ALIASES: Record<string, SupportedSpeechLanguage> = {
    en: "en",
    english: "en",
    "en-in": "en",
    "english-in": "en",
    hi: "hi",
    hindi: "hi",
    "hi-in": "hi",
    "hindi-in": "hi",
    "hi-en": "hi-en",
    "hinglish": "hi-en",
    "hindi-english": "hi-en",
    "english-hindi": "hi-en",
    "hi/en": "hi-en",
    "hin-eng": "hi-en",
    "hindi english": "hi-en",
    "english hindi": "hi-en",
    "hindi / hinglish": "hi-en",
    "hindi / english": "hi-en",
    "english / hindi": "hi-en",
    "hi / hinglish": "hi-en",
    "hi / english": "hi-en",
    "indian english": "hi-en",
    "english indian": "hi-en",
    bilingual: "hi-en",
    mixed: "hi-en",
    ta: "ta",
    tamil: "ta",
    "ta-in": "ta",
    te: "te",
    telugu: "te",
    "te-in": "te",
    mr: "mr",
    marathi: "mr",
    "mr-in": "mr",
    gu: "gu",
    gujarati: "gu",
    "gu-in": "gu",
    kn: "kn",
    kannada: "kn",
    "kn-in": "kn",
};

export function normalizeSpeechLanguage(
    language?: string | null
): SupportedSpeechLanguage {
    if (!language) {
        return "en";
    }

    const normalized = language.trim().toLowerCase();
    const compact = normalized
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (
        compact.includes("hinglish") ||
        compact.includes("indian english") ||
        compact.includes("mixed") ||
        (compact.includes("hindi") && compact.includes("english")) ||
        (compact.includes("hi") && compact.includes("english")) ||
        (compact.includes("hindi") && compact.includes("eng")) ||
        (compact.includes("hi") && compact.includes("eng"))
    ) {
        return "hi-en";
    }

    if (compact.includes("hindi") || compact.includes("hi")) {
        return "hi";
    }

    if (compact.includes("english") || compact.includes("eng")) {
        return "en";
    }

    return LANGUAGE_ALIASES[normalized] ?? LANGUAGE_ALIASES[compact] ?? "hi-en";
}

const SAMPLE_RATE = 16000;

export function computeStreamingDelta(previousText: string, currentText: string): string {
    const prev = previousText.trim();
    const curr = currentText.trim();

    if (!curr) {
        return "";
    }

    if (!prev) {
        return curr;
    }

    if (curr === prev) {
        return "";
    }

    if (curr.startsWith(prev)) {
        return curr.slice(prev.length).trim();
    }

    if (prev.startsWith(curr)) {
        return "";
    }

    let commonPrefixLength = 0;
    const maxLength = Math.min(prev.length, curr.length);

    while (commonPrefixLength < maxLength && prev[commonPrefixLength] === curr[commonPrefixLength]) {
        commonPrefixLength += 1;
    }

    return curr.slice(commonPrefixLength).trim();
}

export const STT_MODEL_OPTIONS = [
    {
        id: "english",
        label: "English streaming",
        description: "Sherpa Zipformer with partial transcripts",
        kind: "streaming",
    },
    {
        id: "indian-english",
        label: "Indian English streaming",
        description: "Sherpa Zipformer tuned for Indian English",
        kind: "streaming",
    },
    {
        id: "zero-stt-hinglish",
        label: "Zero-STT Hinglish",
        description: "Whisper ONNX; transcript is produced after recording",
        kind: "offline",
    },
    {
        id: "sravaani-onnx",
        label: "Sravaani ONNX",
        description: "SraVaani ONNX CTC; transcript is produced after recording",
        kind: "offline",
    },
    {
        id: "sravaani-live",
        label: "Sravaani live",
        description: "SraVaani 0.5 streaming CTC with partial transcripts",
        kind: "streaming",
    },
] as const;

export type SttModelId = (typeof STT_MODEL_OPTIONS)[number]["id"];

let selectedModelId: SttModelId = "english";

function resolveZeroSttModelDir(): string {
    const candidates = [
        process.env.ZERO_STT_MODEL_DIR,
        path.join(__dirname, "../zero-stt-hinglish-onnx-int8"),
        path.join(process.cwd(), "packages/backend/stt-engine/zero-stt-hinglish-onnx-int8"),
    ].filter((candidate): candidate is string => Boolean(candidate));

    const modelDir = candidates.find((candidate) =>
        fs.existsSync(path.join(candidate, "encoder_model.onnx")) &&
        fs.existsSync(path.join(candidate, "decoder_model.onnx"))
    );

    if (!modelDir) {
        throw new Error("Zero-STT Hinglish model directory was not found");
    }

    return modelDir;
}

function hasZeroSttWeights(): boolean {
    try {
        const modelDir = resolveZeroSttModelDir();
        return ["encoder_model.onnx", "decoder_model.onnx"].every((fileName) => {
            return fs.statSync(path.join(modelDir, fileName)).size > 1024;
        });
    } catch {
        return false;
    }
}

function resolveSravaaniModelDir(): string {
    const candidates = [
        process.env.SRAVAANI_MODEL_DIR,
        path.join(__dirname, "../sravaani_onnx"),
        path.join(process.cwd(), "packages/backend/stt-engine/sravaani_onnx"),
    ].filter((candidate): candidate is string => Boolean(candidate));

    const modelDir = candidates.find((candidate) =>
        [
            "encoder-sravaani.onnx",
            "ctc-sravaani.onnx",
            "tokenizer.model",
            "sravaani_onnx_infer.py",
        ].every((fileName) => fs.existsSync(path.join(candidate, fileName)))
    );

    if (!modelDir) {
        throw new Error("Sravaani ONNX model directory was not found");
    }

    return modelDir;
}

function hasSravaaniWeights(): boolean {
    try {
        const modelDir = resolveSravaaniModelDir();
        return [
            "encoder-sravaani.onnx",
            "ctc-sravaani.onnx",
            "tokenizer.model",
            "sravaani_onnx_infer.py",
        ].every((fileName) => fs.statSync(path.join(modelDir, fileName)).size > 1024);
    } catch {
        return false;
    }
}

function resolveSravaaniLiveModelDir(): string {
    const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
    const configured = process.env.SRAVAANI_LIVE_MODEL_DIR
        ? [path.resolve(process.env.SRAVAANI_LIVE_MODEL_DIR)]
        : [
                path.join(__dirname, "../SraVaani-live-0.5-onnx-export-v2/latency_80ms"),
                path.join(process.cwd(), "packages/backend/stt-engine/SraVaani-live-0.5-onnx-export-v2/latency_80ms"),
            ...(resourcesPath
                    ? [path.join(resourcesPath, "stt/SraVaani-live-0.5-onnx-export-v2/latency_80ms")]
                : []),
        ];

    const modelDir = configured.find((candidate) => [
        path.join(candidate, "model.onnx"),
        path.join(candidate, "tokens.txt"),
    ].every((filePath) => fs.existsSync(filePath)));

    if (!modelDir) {
        throw new Error("SraVaani live model files were not found");
    }

    return modelDir;
}

function hasSravaaniLiveWeights(): boolean {
    try {
        const modelDir = resolveSravaaniLiveModelDir();
        return fs.statSync(path.join(modelDir, "model.onnx")).size > 1024 &&
            fs.statSync(path.join(modelDir, "tokens.txt")).size > 0;
    } catch {
        return false;
    }
}

function ensureZeroSttTokens(modelDir: string): string {
    const tokensPath = path.join(modelDir, "tokens.txt");
    if (fs.existsSync(tokensPath)) return tokensPath;

    const vocabPath = path.join(modelDir, "vocab.json");
    const vocabulary = JSON.parse(fs.readFileSync(vocabPath, "utf8")) as Record<string, number>;
    const tokens = Object.entries(vocabulary)
        .sort(([, firstId], [, secondId]) => firstId - secondId)
        .map(([token]) => token.replace(/\n/g, "\\n"));

    fs.writeFileSync(tokensPath, `${tokens.join("\n")}\n`, "utf8");
    return tokensPath;
}

export function getSttModel(): SttModelId {
    return selectedModelId;
}

export function setSttModel(modelId: string): SttModelId {
    const option = STT_MODEL_OPTIONS.find((candidate) => candidate.id === modelId);
    if (option &&
        (option.id !== "zero-stt-hinglish" || hasZeroSttWeights()) &&
        (option.id !== "sravaani-onnx" || hasSravaaniWeights()) &&
        (option.id !== "sravaani-live" || hasSravaaniLiveWeights())) {
        selectedModelId = option.id;
    }
    return selectedModelId;
}

export function getSttModelOptions() {
    return STT_MODEL_OPTIONS.map((option) => ({
        ...option,
        available: option.id === "zero-stt-hinglish"
            ? hasZeroSttWeights()
            : option.id === "sravaani-onnx"
                ? hasSravaaniWeights()
                : option.id === "sravaani-live"
                    ? hasSravaaniLiveWeights()
                : true,
    }));
}

export function getSttRuntimeInfo() {
    return {
        selectedModel: selectedModelId,
        recognizer: selectedModelId === "zero-stt-hinglish"
            ? "offline-whisper"
            : selectedModelId === "sravaani-onnx"
                ? "offline-sravaani-onnx"
                : selectedModelId === "sravaani-live"
                    ? "online-sravaani-onnx"
                : "online-sherpa",
        available: selectedModelId === "zero-stt-hinglish"
            ? hasZeroSttWeights()
            : selectedModelId === "sravaani-onnx"
                ? hasSravaaniWeights()
                : selectedModelId === "sravaani-live"
                    ? hasSravaaniLiveWeights()
                : true,
    };
}

function normalizeModelSelector(rawName?: string): string {
    const value = (rawName ?? REQUESTED_MODEL_NAME ?? "english")
        .trim()
        .toLowerCase();

    if (!value) {
        return "english";
    }

    for (const [key, aliases] of Object.entries(MODEL_NAME_ALIASES)) {
        if (aliases.includes(value) || key === value) {
            return key;
        }
    }

    return value.replace(/[^a-z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

function findMatchingModelDirs(prefixes: string[]): string[] {
    const roots = [
        __dirname,
        path.resolve(__dirname, ".."),
        process.cwd(),
    ];

    const results: string[] = [];

    for (const root of roots) {
        try {
            const entries = fs.readdirSync(root, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) {
                    continue;
                }

                for (const prefix of prefixes) {
                    if (entry.name.startsWith(prefix)) {
                        results.push(path.join(root, entry.name));
                    }
                }
            }
        } catch {
            // ignore missing directories in the current runtime location
        }
    }

    return Array.from(new Set(results));
}

function resolveModelDir(language: SupportedSpeechLanguage): string {
    const configuredModel = normalizeModelSelector(selectedModelId);
    const candidateNames: string[] = [];

    if (OVERRIDE_MODEL_DIR) {
        candidateNames.push(path.basename(OVERRIDE_MODEL_DIR));
    }

    const explicitBaseNames = new Set<string>();

    if (configuredModel === "english") {
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-en");
    } else if (configuredModel === "indian-english") {
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-indian-en");
    } else if (configuredModel === "hinglish") {
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-hi-en");
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-hi");
    } else if (configuredModel === "hindi") {
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-hi");
    } else if (configuredModel === "tamil") {
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-ta");
    } else if (configuredModel === "telugu") {
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-te");
    } else if (configuredModel === "marathi") {
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-mr");
    } else if (configuredModel === "gujarati") {
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-gu");
    } else if (configuredModel === "kannada") {
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-kn");
    }

    if (language === "en") {
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-en");
    } else if (language === "hi-en") {
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-hi-en");
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-indian-en");
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-hi");
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-en");
    } else if (language === "hi") {
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-hi");
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-indian-en");
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-en");
    } else if (language === "ta") {
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-ta");
    } else if (language === "te") {
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-te");
    } else if (language === "mr") {
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-mr");
    } else if (language === "gu") {
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-gu");
    } else if (language === "kn") {
        explicitBaseNames.add("sherpa-onnx-streaming-zipformer-kn");
    }

    for (const prefix of explicitBaseNames) {
        candidateNames.push(prefix);
    }

    const candidateDirs: string[] = [];

    if (OVERRIDE_MODEL_DIR) {
        candidateDirs.push(OVERRIDE_MODEL_DIR);
    }

    for (const candidate of candidateNames) {
        candidateDirs.push(
            path.join(__dirname, `../${candidate}`),
            path.join(process.cwd(), `./${candidate}`),
            ...findMatchingModelDirs([candidate])
        );
    }

    const seen = new Set<string>();
    let foundDir: string | null = null;

    for (const candidateDir of candidateDirs) {
        if (!candidateDir || seen.has(candidateDir)) {
            continue;
        }
        seen.add(candidateDir);

        if (fs.existsSync(candidateDir) && fs.existsSync(path.join(candidateDir, "tokens.txt"))) {
            foundDir = candidateDir;
            break;
        }
    }

    if (foundDir) {
        console.log(`[Sherpa] Requested model: ${configuredModel}`);
        console.log(`[Sherpa] Active model directory: ${foundDir}`);
        return foundDir;
    }

    console.warn(
        `[Sherpa] No compatible streaming model found for language="${language}" and model="${configuredModel}". Falling back to English model at ${DEFAULT_MODEL_DIR}. ` +
        `Set STT_MODEL or SHERPA_STT_MODEL_DIR to a valid Sherpa streaming bundle to bypass the fallback.`
    );

    return DEFAULT_MODEL_DIR;
}

function findModelFile(modelDir: string, basename: string): string | null {
    if (!fs.existsSync(modelDir)) {
        return null;
    }

    const entries = fs.readdirSync(modelDir);
    const candidates = [
        `${basename}.int8.onnx`,
        `${basename}.onnx`,
        `${basename}-int8.onnx`,
        `${basename}-epoch-99-avg-1.int8.onnx`,
        `${basename}-epoch-10-avg-5-chunk-64-left-256.int8.onnx`,
        `${basename}-epoch-10-avg-5-chunk-64-left-256.onnx`,
    ];

    for (const candidate of candidates) {
        const filePath = path.join(modelDir, candidate);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
    }

    const prefixMatches = entries.filter((entry) => entry.startsWith(`${basename}`) && entry.endsWith(".onnx"));
    if (prefixMatches.length > 0) {
        return path.join(modelDir, prefixMatches[0]);
    }

    return null;
}

export class SherpaStreamingSTT {
    private recognizer: OnlineRecognizerInstance;
    private stream: OnlineStream | null = null;
    private lastText = "";
    private readonly language: SupportedSpeechLanguage;

    constructor(language: SupportedSpeechLanguage = "en") {
        const initStart = Date.now();
        this.language = language;

        const configuredModel = selectedModelId;

        console.log(`[Sherpa] Configured model selector: ${configuredModel}`);

        const modelDir = resolveModelDir(language);

        const encoder = findModelFile(modelDir, "encoder") ?? path.join(modelDir, "encoder-epoch-99-avg-1.int8.onnx");
        const decoder = findModelFile(modelDir, "decoder") ?? path.join(modelDir, "decoder-epoch-99-avg-1.int8.onnx");
        const joiner = findModelFile(modelDir, "joiner") ?? path.join(modelDir, "joiner-epoch-99-avg-1.int8.onnx");

        const tokens =
            fs.existsSync(path.join(modelDir, "tokens.txt"))
                ? path.join(modelDir, "tokens.txt")
                : null;

        if (!encoder || !decoder || !joiner || !tokens) {
            throw new Error(
                `[Sherpa] Missing required ONNX files in model directory: ${modelDir}. ` +
                `Expected encoder/decoder/joiner + tokens.txt with a valid Sherpa streaming bundle.`
            );
        }

        console.log("[Sherpa] Language:", language);
        console.log("[Sherpa] Selected STT model:", selectedModelId);
        console.log("[Sherpa] Model directory:", modelDir);
        console.log("[Sherpa] Encoder:", encoder);
        console.log("[Sherpa] Decoder:", decoder);
        console.log("[Sherpa] Joiner:", joiner);
        console.log("[Sherpa] Tokens:", tokens);

        this.recognizer = new OnlineRecognizer({
            featConfig: {
                sampleRate: SAMPLE_RATE,
                featureDim: 80,
            },

            modelConfig: {
                transducer: {
                    encoder,
                    decoder,
                    joiner,
                },

                tokens,

                numThreads: Number(process.env.STT_NUM_THREADS) || 8,

                provider: "cpu",
            },

            decodingMethod: "greedy_search",

            enableEndpoint: true,

            rule1MinTrailingSilence: 2.4,

            rule2MinTrailingSilence: 1.2,

            rule3MinUtteranceLength: 20,
        });

        const initTime = Date.now() - initStart;
        console.log("[Sherpa] Online recognizer initialized");
        console.log(`[Sherpa] Init time: ${initTime}ms | Sample rate: ${SAMPLE_RATE}Hz`);
    }

    start() {
        this.stream = this.recognizer.createStream();
        this.lastText = "";

        console.log("[Sherpa] Streaming session started");
    }

    processAudio(samples: Float32Array): string | null {
        if (!this.stream) {
            this.start();
        }

        if (!this.stream) {
            return null;
        }

        if (samples.length === 0) {
            return null;
        }

        this.stream.acceptWaveform({
            samples,
            sampleRate: SAMPLE_RATE,
        });

        while (this.recognizer.isReady(this.stream)) {
            this.recognizer.decode(this.stream);
        }

        const result = this.recognizer.getResult(this.stream);
        const text = result.text?.trim() || "";

        if (!text) {
            return null;
        }

        const delta = computeStreamingDelta(this.lastText, text);
        this.lastText = text;

        return delta || null;
    }

    finish(): string | null {
        if (!this.stream) {
            return null;
        }

        this.stream.inputFinished();

        while (this.recognizer.isReady(this.stream)) {
            this.recognizer.decode(this.stream);
        }

        const result = this.recognizer.getResult(this.stream);

        const text = result.text?.trim() || "";

        this.stream = null;
        this.lastText = "";

        if (!text) {
            return null;
        }

        console.log("[Sherpa] Final:", text);

        return text;
    }

    reset() {
        this.stream = null;
        this.lastText = "";

        console.log("[Sherpa] Streaming session reset");
    }
}

export class ZeroSttHinglishSTT {
    private readonly recognizer: OfflineRecognizerInstance;
    private stream: OfflineStream | null = null;
    private samples: number[] = [];

    constructor() {
        const modelDir = resolveZeroSttModelDir();
        this.recognizer = new OfflineRecognizer({
            featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
            modelConfig: {
                whisper: {
                    encoder: path.join(modelDir, "encoder_model.onnx"),
                    decoder: path.join(modelDir, "decoder_model.onnx"),
                    language: "hi",
                    task: "transcribe",
                },
                tokens: ensureZeroSttTokens(modelDir),
                numThreads: Number(process.env.STT_NUM_THREADS) || 4,
                provider: "cpu",
            },
        });
        console.log("[Sherpa] Selected STT model: zero-stt-hinglish");
        console.log("[Sherpa] Zero-STT Hinglish recognizer initialized");
    }

    start() {
        this.samples = [];
        this.stream = this.recognizer.createStream();
    }

    processAudio(samples: Float32Array): string | null {
        this.samples.push(...samples);
        return null;
    }

    finish(): string | null {
        if (!this.stream) return null;
        this.stream.acceptWaveform({
            samples: Float32Array.from(this.samples),
            sampleRate: SAMPLE_RATE,
        });
        this.recognizer.decode(this.stream);
        const text = this.recognizer.getResult(this.stream).text?.trim() || "";
        this.stream = null;
        this.samples = [];
        return text || null;
    }

    reset() {
        this.stream = null;
        this.samples = [];
    }
}

function writePcmWav(filePath: string, samples: number[]): void {
    const dataSize = samples.length * 2;
    const wav = Buffer.alloc(44 + dataSize);

    wav.write("RIFF", 0, "ascii");
    wav.writeUInt32LE(36 + dataSize, 4);
    wav.write("WAVE", 8, "ascii");
    wav.write("fmt ", 12, "ascii");
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(SAMPLE_RATE, 24);
    wav.writeUInt32LE(SAMPLE_RATE * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write("data", 36, "ascii");
    wav.writeUInt32LE(dataSize, 40);

    samples.forEach((sample, index) => {
        const clamped = Math.max(-1, Math.min(1, sample));
        wav.writeInt16LE(Math.round(clamped * (clamped < 0 ? 32768 : 32767)), 44 + index * 2);
    });

    fs.writeFileSync(filePath, wav);
}

export class SravaaniOnnxSTT {
    private recordingStarted = false;
    private samples: number[] = [];

    constructor() {
        const modelDir = resolveSravaaniModelDir();
        console.log("[SraVaani] Model directory:", modelDir);
        console.log("[SraVaani] Decoder: CTC");
    }

    start() {
        this.samples = [];
        this.recordingStarted = true;
    }

    processAudio(samples: Float32Array): string | null {
        this.samples.push(...samples);
        return null;
    }

    finish(): string | null {
        if (!this.recordingStarted) return null;

        const modelDir = resolveSravaaniModelDir();
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sravaani-stt-"));
        const wavPath = path.join(tempDir, "recording.wav");

        try {
            writePcmWav(wavPath, this.samples);

            const python = process.env.SRAVAANI_PYTHON || process.env.PYTHON || "python3";
            const scriptPath = path.join(modelDir, "sravaani_onnx_infer.py");
            const result = spawnSync(python, [scriptPath, wavPath, "--decoder", "ctc"], {
                cwd: modelDir,
                encoding: "utf8",
                maxBuffer: 1024 * 1024,
            });

            if (result.error) {
                throw new Error(`Unable to run ${python}: ${result.error.message}`);
            }

            if (result.status !== 0) {
                throw new Error((result.stderr || result.stdout || "SraVaani inference failed").trim());
            }

            const transcription = result.stdout
                .match(/Transcription:\s*(.*)/)?.[1]
                ?.trim() || "";

            if (transcription) {
                console.log("[SraVaani] Final:", transcription);
            }

            return transcription || null;
        } finally {
            this.recordingStarted = false;
            this.samples = [];
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }

    reset() {
        this.recordingStarted = false;
        this.samples = [];
    }
}

export class SravaaniLiveSTT {
    private readonly engine: SravaaniLiveOnnx;

    constructor() {
        const modelDir = resolveSravaaniLiveModelDir();
        this.engine = new SravaaniLiveOnnx({
            modelPath: path.join(modelDir, "model.onnx"),
            tokensPath: path.join(modelDir, "tokens.txt"),
            cacheMeta: LATENCY_1040MS_CACHE_META,
            numThreads: Number(process.env.STT_NUM_THREADS) || 2,
        });
        console.log("[SraVaani] Live ONNX recognizer initialized:", modelDir);
    }

    start() {
        this.engine.start();
    }

    processAudio(samples: Float32Array): Promise<string | null> {
        return this.engine.processAudio(samples);
    }

    finish(): Promise<string | null> {
        return this.engine.finish();
    }

    reset() {
        this.engine.reset();
    }
}

const recognizerCache = new Map<string, SherpaStreamingSTT | ZeroSttHinglishSTT | SravaaniOnnxSTT | SravaaniLiveSTT>();
let sherpaSTT: SherpaStreamingSTT | ZeroSttHinglishSTT | SravaaniOnnxSTT | SravaaniLiveSTT | null = null;

export function initSherpaSTT(language: SupportedSpeechLanguage = "en") {
    const effectiveLanguage = selectedModelId === "indian-english" ? "hi-en" : language;
    const cacheKey = `${selectedModelId}:${effectiveLanguage}`;
    let recognizer = recognizerCache.get(cacheKey);

    if (!recognizer) {
        recognizer = selectedModelId === "zero-stt-hinglish"
            ? new ZeroSttHinglishSTT()
            : selectedModelId === "sravaani-onnx"
                ? new SravaaniOnnxSTT()
                : selectedModelId === "sravaani-live"
                    ? new SravaaniLiveSTT()
                : new SherpaStreamingSTT(effectiveLanguage);
        recognizerCache.set(cacheKey, recognizer);
    }

    sherpaSTT = recognizer;
    return recognizer;
}

export function warmupSherpaSTT(language: SupportedSpeechLanguage = "en") {
    return initSherpaSTT(language);
}

export function getSherpaSTT() {
    return sherpaSTT;
}