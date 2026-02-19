# STT Engine (Speech-to-Text)

This package runs **Whisper** ([whisper.cpp](https://github.com/ggerganov/whisper.cpp)) for **push-to-talk** transcription. It is used by the desktop app in development and in packaged installers.

---

## Why Whisper instead of the Web Speech API?

We use **Whisper** (run locally via whisper.cpp) rather than the browser’s **Web Speech API** (e.g. `webkitSpeechRecognition` / `SpeechRecognition`) for these reasons:

| Concern | Web Speech API | Whisper (this package) |
|--------|----------------|-------------------------|
| **Offline** | Usually requires internet; many implementations send audio to a cloud service. | Runs fully on the device; no network needed after the model is downloaded. |
| **Privacy** | Audio is typically sent to a third party (e.g. Google). | Audio stays on the user’s machine; no data leaves the device. |
| **Control & consistency** | Depends on the browser and vendor; behavior and quality can change or differ by browser/region. | Same binary and model everywhere; we control the version and behaviour. |
| **Desktop / Electron** | Tied to the renderer process and browser implementation; not ideal for a packaged desktop app that should work the same on all installs. | Runs in the main process with a fixed CLI and model; same experience across supported platforms. |
| **Languages & quality** | Support and quality vary by provider and locale. | One open model (e.g. small) with broad language support and predictable quality. |

So we use Whisper to keep speech-to-text **offline**, **private**, and **consistent** in the desktop app, instead of relying on the Web Speech API and cloud-based recognition.

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Desktop App (Electron main process)                                        │
│  apps/desktop/src/ipc/handlers.ts                                           │
│  • Listens: STT_START, STT_CHUNK, STT_STOP                                  │
│  • Replies: STT_FINAL (transcript)                                          │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │ calls
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STT Engine (this package)  packages/backend/stt-engine/                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ index.ts    │  │ streaming.ts │  │ wavWriter.ts│  │ Native assets       │ │
│  │             │  │             │  │             │  │                      │ │
│ • init()    │  │ StreamingSTT│  │ createWav   │  │ whisper-cli         │ │
│  │ • push…()   │  │ • pushChunk │  │ Header/File │  │ ggml-base.en-q5_1.bin │ │
│  │ • process   │  │ • process() │  │ (16 kHz     │  │ libwhisper.so*      │ │
│  │   Audio()   │  │ • reset()   │  │  mono PCM)  │  │ (Linux, if shared)   │ │
│  │ • reset…()  │  │             │  │             │  │                      │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                │                     │           │
│         └────────────────┴────────────────┴─────────────────────┘           │
│                                    │                                         │
│                          WAV file + execFile(whisper-cli)                    │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  whisper-cli (whisper.cpp binary)                                           │
│  • Loads ggml-base.en-q5_1.bin                                               │
│  • Reads WAV from path                                                       │
│  • Writes transcription to stdout                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Module roles

| Module        | Role |
|---------------|------|
| **index.ts**  | Push-to-talk API: in-memory buffer of PCM chunks, build WAV, run `whisper-cli`, return transcript. Exposes `init()`, `pushAudioChunk()`, `processAudio()`, `resetAudio()`. Used by the desktop app. |
| **streaming.ts** | Optional streaming-style API: `StreamingSTT` class with `pushChunk()`, `process()` (min ~1 s audio), `reset()`. Uses `wavWriter` and a fixed temp path. |
| **wavWriter.ts** | Builds 16-bit mono WAV from raw PCM (e.g. 16 kHz). Used by `streaming.ts`; `index.ts` has its own inline WAV builder. |

### Where files are loaded from

| Mode | Root directory |
|------|-----------------|
| **Development** (`pnpm run dev`) | `packages/backend/stt-engine/` |
| **Packaged app** (installer) | Set via `init(sttRoot)` from Electron (e.g. `resources/stt`); assets usually come from `apps/desktop/stt-assets/win/` or `stt-assets/linux/` at build time. |

---

## Data flow (push-to-talk)

End-to-end flow from “hold to talk” to transcript:

1. **Renderer**  
   User holds push-to-talk → capture audio (e.g. from microphone).

2. **IPC**  
   - **STT_START** → main process: “start recording.”  
   - Main calls `resetAudio()` and sets `isRecording = true`.

3. **Audio chunks**  
   Renderer sends **STT_CHUNK** with `ArrayBuffer` (PCM, 16-bit mono, typically 16 kHz).  
   Main calls `pushAudioChunk(Buffer.from(chunk))`; chunks are appended in memory.

4. **STT_STOP**  
   User releases button → **STT_STOP** to main.  
   Main sets `isRecording = false` and calls `processAudio()`.

5. **processAudio() (index.ts)**  
   - Merge all chunks into one PCM buffer.  
   - Build a WAV (44-byte header + PCM) at 16 kHz mono.  
   - Write WAV to a temp file (e.g. `/tmp/recording-<uuid>.wav`).  
   - Set `LD_LIBRARY_PATH` (Linux) or `PATH` (Windows) so `whisper-cli` finds libs.  
   - Run: `whisper-cli -m <model> -f <wav> --no-timestamps --threads 4`.  
   - Read transcript from stdout.  
   - Delete temp WAV.  
   - Return transcript string or `null`.

6. **Reply**  
   Main sends **STT_FINAL** to renderer with the transcript (or empty string).  
   Then calls `resetAudio()`.

7. **Renderer**  
   Displays or uses the transcript.

---

## Steps to run

### 1. Prerequisites in this folder

For **development** (`pnpm run dev`), put these under `packages/backend/stt-engine/`:

| Asset   | Linux              | Windows        |
|---------|--------------------|----------------|
| Model   | `ggml-base.en-q5_1.bin` | `ggml-base.en-q5_1.bin` |
| CLI     | `whisper-cli`      | `whisper-cli.exe` |
| Library | `libwhisper.so` + `libwhisper.so.1` (optional if static build) | Not needed for static build |

### 2. Get the model

If you see “invalid model data (bad magic)”, re-download the model:

```bash
# From repo root
bash packages/backend/stt-engine/download-model.sh
```

Or manually from Hugging Face (~54 MiB):

- https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin  

Save as `packages/backend/stt-engine/ggml-base.en-q5_1.bin`.

### 3. Get the whisper binary (Linux)

**Option A – Use the copy script (recommended)**  
Build whisper.cpp locally, then copy the binary (and optional .so) into this package:

```bash
# Build (static = no .so needed)
cd ~/Desktop/whisper.cpp   # or your clone path
mkdir -p build && cd build
cmake .. -DBUILD_SHARED_LIBS=OFF
cmake --build . --config Release

# Copy into this package (default path in script: ~/Desktop/whisper.cpp)
bash /path/to/AFE-Learning-App/packages/backend/stt-engine/copy-whisper-from-idesktop.sh
```

Override the whisper source if needed:

```bash
WHISPER_SRC=/home/phantom/Desktop/whisper.cpp bash packages/backend/stt-engine/copy-whisper-from-idesktop.sh
```

**Option B – Shared lib build**  
If you built with `-DBUILD_SHARED_LIBS=ON`:

```bash
STT=packages/backend/stt-engine
WB=~/whisper.cpp/build
cp "$WB/bin/whisper-cli" "$STT/whisper-cli"
chmod +x "$STT/whisper-cli"
cp "$WB/libwhisper.so" "$STT/" 2>/dev/null || cp "$WB/lib/libwhisper.so" "$STT/"
cd "$STT" && ln -sf libwhisper.so libwhisper.so.1
```

### 4. Get the whisper binary (Windows)

Build whisper.cpp (e.g. Visual Studio 2022, “x64 Native Tools”):

```cmd
cd %USERPROFILE%\whisper.cpp
mkdir build && cd build
cmake .. -DBUILD_SHARED_LIBS=OFF -A x64
cmake --build . --config Release
```

Copy the CLI (adjust path if your `main.exe` is under `build\bin`):

```cmd
set STT=packages\backend\stt-engine
set WB=%USERPROFILE%\whisper.cpp\build
copy "%WB%\bin\Release\main.exe" "%STT%\whisper-cli.exe"
```

Or copy `whisper-cli.exe` if your build names it that way.

### 5. Verify

**Linux:**

```bash
cd packages/backend/stt-engine
export LD_LIBRARY_PATH="$PWD:$LD_LIBRARY_PATH"
./whisper-cli -m ggml-base.en-q5_1.bin -f /tmp/test.wav --no-timestamps --threads 4
```

**Windows:**

```cmd
cd packages\backend\stt-engine
whisper-cli.exe -m ggml-base.en-q5_1.bin -f C:\path\to\test.wav --no-timestamps --threads 4
```

If this runs without errors, STT in the app will work.

### 6. Run the app (development)

From the **repo root**:

```bash
pnpm run dev
```

The desktop app will load `whisper-cli`, the model, and (on Linux) the shared library from `packages/backend/stt-engine/`.

### 7. Packaged build (installer)

For the **standalone installer**, STT assets go in **`apps/desktop/stt-assets/`**, not in this folder. The desktop app bundles them at build time.

- Put model and binaries in `stt-assets/win/` and `stt-assets/linux/` (see `apps/desktop/stt-assets/README.md` if present).
- Then from repo root: `pnpm run build:installer`.

---

## Quick reference

| Task | Command or location |
|------|----------------------|
| Run app (dev) | `pnpm run dev` (from repo root) |
| STT assets (dev) | `packages/backend/stt-engine/` |
| STT assets (installer) | `apps/desktop/stt-assets/win/` and `stt-assets/linux/` |
| Download model | `bash packages/backend/stt-engine/download-model.sh` |
| Copy whisper binary | `bash packages/backend/stt-engine/copy-whisper-from-idesktop.sh` |
| Build installer | `pnpm run build:installer` |
