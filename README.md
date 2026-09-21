# AFE Student Learning App

A production-grade, **installer-first** Electron desktop application with strict backend/frontend separation, silent installation capability, and an offline-first architecture.

## 🎯 Overview

This is a **multi-student, offline-capable learning application** designed for deployment on shared laptops in environments with limited internet connectivity.

All data persists in:

```text
C:\ProgramData\OfflineLearningApp\
```

This ensures data survives:

* App upgrades
* User account changes
* Reinstalls

## 🏗️ Architecture

### Monorepo Structure

```text
/apps
  /desktop          → Electron main process (backend runtime)
  /renderer        → React UI (frontend only)

/packages
  /backend         → Backend-only packages (NOT accessible to renderer)
    /db            → SQLite with Drizzle ORM
    /content-engine → JSON manifest loader + validators
    /analytics     → Local analytics aggregation
    /ai-tutor      → Ollama integration (optional)
    /stt-engine    → Offline Sherpa/SraVaani Speech-to-Text
    /tts-engine    → Offline Piper-based Text-to-Speech

  /shared          → Shared types, constants, IPC contracts
```

### Security & Separation

* ✅ **Renderer has NO Node.js access** (`nodeIntegration: false`, `contextIsolation: true`)
* ✅ **Backend packages cannot be imported by renderer** (enforced via ESLint)
* ✅ **Communication via secure IPC only** (whitelisted channels in preload)

## 📦 Installation

### Prerequisites

* **Node.js**: v20 LTS only (`>=20 <21`)
* **pnpm**: v9 or higher (recommended)
* **Git**: Latest version
* **Ollama**: Optional, required for AI features
* **C++ Build Tools**: Visual Studio Build Tools with Desktop development with C++, required for some native dependencies if prebuilds are missing

For macOS development, install the native dependencies for the current CPU
architecture. The Intel Mac profile used to validate the STT work is described
in the Intel macOS section below.

> **Note:** Node 24 is not currently supported because the native SQLite dependency `better-sqlite3` fails to build on that runtime.

### Setup

```bash
# Clone repository
git clone <repository-url>

cd AFE

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

## 🚀 Development

### Running in Development Mode

```bash
# Start both desktop and renderer in watch mode
pnpm dev
```

This will:

1. Start the Vite development server for the renderer (port 5173)
2. Compile and run the Electron main process
3. Open the app with DevTools enabled

### Building for Production

```bash
# Build all packages
pnpm build

# Create the installer
pnpm build:installer
```

On the supported packaging platform, the installer is written to:

```text
apps/desktop/release/
```

## 📥 Silent Installation

The installer supports **fully silent installation** for enterprise deployment:

```bash
# Silent install (no UI, no prompts)
OfflineLearningApp-Setup.exe /S
```

### Installation Paths

* **Application**: `C:\Program Files\Offline Learning App\`
* **Data**: `C:\ProgramData\OfflineLearningApp\`

  * Database: `data.db`
  * Content: `content\manifest.json`
  * Assets: `assets\videos\`, `assets\avatars\`

## 📚 Content Management

Content is stored as JSON manifests with strict schema validation.

### Content Manifest Location

```text
C:\ProgramData\OfflineLearningApp\content\manifest.json
```

### Schema Requirements

Every content item MUST include:

* `contentId` (UUID)
* `version` (semver)
* `hash` (for integrity verification)

See `installer-assets/content/manifest.json` for a sample.

## 🗄️ Database

* **Engine**: SQLite (file-based)
* **ORM**: Drizzle
* **Location**: `C:\ProgramData\OfflineLearningApp\data.db`

### Tables

* `students` - Multi-student support
* `modules`, `lessons` - Cached content
* `video_progress` - Watch tracking
* `quiz_attempts` - Quiz performance
* `analytics_events` - Event tracking (append-only)
* `ai_chat_history` - AI tutor conversations
* `sync_queue` - Future online sync

## 🎨 UI Design

**Neo-Brutalism** aesthetic:

* Bold, chunky borders
* High-contrast vibrant colors
* Strong shadows
* Playful, energetic feel

## 🤖 AI Tutor (Optional)

The app integrates with **Ollama** for offline AI tutoring.

### 🎙️ Voice Mode (Offline)

The AI Tutor supports a full **voice-to-voice** interaction mode:

* **Speech-to-Text (STT)**: Local Sherpa-ONNX streaming ASR, SraVaani live CTC, or final-only offline SraVaani/Whisper ONNX depending on the selected model
* **Text-to-Speech (TTS)**: Powered by **Piper**, providing high-quality offline voices
* **Input**: Hold-to-talk `Ctrl+Space` with partial text written directly into the tutor input

### Speech-to-Text Engines

The current STT layer shares a 16 kHz mono PCM and Electron IPC contract while
keeping each model's inference format separate:

| Model ID | Engine | Transcript behavior |
| --- | --- | --- |
| `english` | Sherpa Zipformer streaming | Partial and final transcripts |
| `indian-english` | Sherpa Indian-English Zipformer | Partial and final transcripts |
| `zero-stt-hinglish` | Whisper ONNX offline | Final transcript after recording |
| `sravaani-onnx` | SraVaani 1.0 ONNX with Python CTC runner | Final transcript after recording |
| `sravaani-live` | SraVaani 0.5 direct ONNX CTC | Partial and final transcripts |

Select an engine during development with `STT_MODEL`:

```bash
STT_MODEL=english pnpm --filter desktop dev
STT_MODEL=indian-english pnpm --filter desktop dev
STT_MODEL=sravaani-onnx pnpm --filter desktop dev
STT_MODEL=sravaani-live pnpm --filter desktop dev
```

See [packages/backend/stt-engine/README.md](packages/backend/stt-engine/README.md)
for model files, language aliases, SraVaani runtime details, packaged asset
paths, and troubleshooting.

### Intel macOS STT Device Profile

The primary Intel validation device is:

| Property | Value |
| --- | --- |
| Mac model | MacBook Pro `MacBookPro16,1` |
| CPU | 6-core Intel Core i7-9750H at 2.6 GHz |
| CPU threads | 12 logical CPUs with Hyper-Threading |
| Memory | 16 GB |
| Integrated GPU | Intel UHD Graphics 630, up to 1536 MB dynamic VRAM |
| Dedicated GPU | AMD Radeon Pro 5300M with 4 GB VRAM |
| macOS | 26.6.2, Darwin 25.6.0 |
| Node.js | v20.20.2, `x64` architecture |
| CPU features | AVX2 and SSE4.1 available; AVX-512F unavailable |

For this device, Sherpa and SraVaani Live use CPU inference. The Intel GPU is
not currently configured as an STT execution provider. The application uses:

```text
ORT_INTRA_OP_NUM_THREADS=10
ORT_INTER_OP_NUM_THREADS=1
```

Sherpa's workload can be tuned with `STT_NUM_THREADS`. More threads are not
automatically faster for the complete offline voice loop because STT, Ollama,
Electron, the renderer, and TTS share the same CPU and memory bandwidth.

The Intel-specific work began at commit
`6d3af815b85c120efa766acba99a8a8b9b62d561`. It added CPU/native-module
diagnostics, WER experiments, first-word and audio-timing fixes, model
selection improvements, startup warmup, recognizer caching, and reliability
logging. Later commits added SraVaani offline/live support and packaged model
lookup.

Run the diagnostic helpers from the repository root:

```bash
bash stt-diagnose.sh
node stt-optimize.mjs
```

These report the loaded native binding, Node architecture, CPU features,
thread configuration, model directories, memory, GPU information, and Sherpa
package version. For controlled accuracy comparisons, use the English and
Indian-English WER scripts with identical audio, models, sample conversion,
endpoint settings, and warm/cold conditions.

### Setup Ollama

```bash
# Install Ollama (optional)
# Download from: https://ollama.ai

# Pull a model
ollama pull llama2
```

If Ollama is not running, the AI tutor gracefully falls back with a friendly message.

## 📊 Analytics

All analytics are **local-only** with no external reporting:

* Time spent per module
* Video watch duration
* Quiz performance and improvement
* Append-only event system

## 🔒 Security & Compliance

### Installer-Level Security

* ✅ No runtime installation logic
* ✅ No privilege elevation at runtime
* ✅ No auto-update (installer-only updates)
* ✅ Deterministic builds
* ✅ No code download at runtime

### Runtime Security

* ✅ Renderer process fully sandboxed
* ✅ IPC channels whitelisted
* ✅ No remote code execution
* ✅ Foreign keys enforced in SQLite

## 🚫 Explicit Non-Goals

This app will **NOT**:

* Manage its own installation
* Elevate privileges at runtime
* Assume internet access during installation
* Handle device management (external concern)

## 🛠️ Development Commands

```powershell
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Type check all packages
pnpm typecheck

# Lint code
pnpm lint

# Build all packages
pnpm build

# Build installer
pnpm build:installer
```

## 📁 Project Structure

```text
AFE/
├── apps/
│   ├── desktop/              # Electron main + preload
│   │   ├── src/
│   │   │   ├── main/         # Main process
│   │   │   ├── preload/      # IPC bridge
│   │   │   └── ipc/          # IPC handlers
│   │   └── electron-builder.config.js
│   └── renderer/             # React UI
│       └── src/
│           ├── pages/         # Page components
│           ├── styles/        # Neo-Brutalism CSS
│           └── lib/           # IPC client
├── packages/
│   ├── backend/
│   │   ├── db/               # Database layer
│   │   ├── content-engine/   # Content loading
│   │   ├── analytics/        # Analytics
│   │   ├── ai-tutor/         # AI integration
│   │   │   ├── stt-engine/       # Sherpa/SraVaani STT engines
│   │   └── tts-engine/       # Piper TTS engine
│   └── shared/                # Shared types & IPC contracts
├── installer-assets/          # Files copied during install
│   ├── content/
│   │   └── manifest.json
│   └── assets/
└── pnpm-workspace.yaml
```

## 🧪 Testing

### Manual Testing Checklist

1. ✅ Install via silent installer (`/S`)
2. ✅ Create multiple students
3. ✅ Verify data persists in `C:\ProgramData\OfflineLearningApp\`
4. ✅ Browse modules
5. ✅ Check analytics dashboard
6. ✅ Upgrade to a new version and verify data survives
7. ✅ Uninstall and verify data persists

## 👥 Authors

NavGurukul Team

---

**Built with** ⚡ Electron | ⚛️ React | 🗃️ SQLite | 🎨 Neo-Brutalism
