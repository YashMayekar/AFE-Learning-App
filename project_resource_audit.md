# System Resource Efficiency Audit (April 2026)

This report identifies issues related to disk bloat, CPU overhead, and performance bottlenecks across the AFE application.

## 1. Disk Usage & Bloat

### 🔴 Critical: TTS Dictionary Bloat
- **Issue**: The `espeak-ng-data` directory inside `packages/backend/tts-engine` contains **118 language dictionaries**.
- **Impact**: Approximate bloat of **20-30MB**. Files like `ru_dict` (8.5MB), `cmn_dict` (1.5MB), and others are likely unnecessary for the target region.
- **Location**: [`packages/backend/tts-engine/espeak-ng-data/`](file:///c:/Mukul/Navgurukul/RMS/AFE/packages/backend/tts-engine/espeak-ng-data/)

### 🟡 Large Temp Files (TTS/STT)
- **Issue**: Both TTS and STT engines use temporary WAV files for every interaction.
- **Impact**: Increased Disk I/O. Frequent writing/deleting of 100KB-1MB files.
- **Location**: `packages/backend/tts-engine/index.ts` and `packages/backend/stt-engine/index.ts`.

---

## 2. CPU & Performance Bottlenecks

### 🔴 Critical: TTS Engine Lifecycle Inefficiency
- **Issue**: The `Piper` TTS engine is spawned via `execFile`, and the **63MB ONNX model is re-loaded** for every single sentence.
- **Impact**: Significant CPU spikes and a "latency floor" (100-300ms) for every sentence spoken by the AI.
- **Location**: [`packages/backend/tts-engine/index.ts`](file:///c:/Mukul/Navgurukul/RMS/AFE/packages/backend/tts-engine/index.ts)

### 🔴 Critical: Missing Database Indexes
- **Issue**: Several high-traffic tables lack indexes on foreign keys and filter columns.
- **Impact**: As the `analytics_events` and `ai_chat_history` tables grow, queries will become exponentially slower.
- **Required Indexes**:
    - `analytics_events`: `student_id`, `event_type`
    - `ai_chat_history`: `session_id`
    - `video_progress`: `student_id`
    - `quiz_attempts`: `student_id`
- **Location**: [`packages/backend/db/src/schema/index.ts`](file:///c:/Mukul/Navgurukul/RMS/AFE/packages/backend/db/src/schema/index.ts)

### 🟡 Event Loop Blocking (Manifest Loading)
- **Issue**: `loadContentManifest` uses `fs.readFileSync` and `JSON.parse` on every request to `getManifest()`.
- **Impact**: Blocks the main process event loop. If the manifest reaches 5-10MB, this will cause noticeable UI freezes during IPC calls.
- **Location**: [`packages/backend/content-engine/src/index.ts`](file:///c:/Mukul/Navgurukul/RMS/AFE/packages/backend/content-engine/src/index.ts)

---

## 3. IPC & Memory Efficiency

### 🟡 IPC Payload Overhead
- **Issue**: Audio buffers are converted to **Base64** for IPC transfer between Main and Renderer.
- **Impact**: ~33% increase in payload size. For long voice responses, this adds unnecessary memory pressure and serialization time.
- **Location**: [`apps/desktop/src/ipc/handlers.ts`](file:///c:/Mukul/Navgurukul/RMS/AFE/apps/desktop/src/ipc/handlers.ts)

### 🟡 Redundant JSON in DB
- **Issue**: The `modules` and `lessons` tables store full `data` blobs as JSON strings.
- **Impact**: Duplicate data storage (already exists in `manifest.json`). Increases `data.db` size.
- **Location**: `packages/backend/db/src/schema/index.ts`

---

## Recommendations

1.  **TTS Optimization**: Transition Piper from `execFile` (single-shot) to a long-lived process using `spawn` + `stdin` control.
2.  **Prune Dictionaries**: Remove unused `*_dict` files from `espeak-ng-data` in the build process.
3.  **DB Performance**: Apply migration to add missing indexes.
4.  **Async Manifest**: Switch to `fs.promises.readFile` or a singleton cache for the manifest to avoid redundant I/O.
5.  **IPC Buffers**: Use `Uint8Array`/`Buffer` directly for IPC instead of Base64 strings.
