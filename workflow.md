# Application Workflow: Local AI-Tutor System

This document outlines the end-to-end workflow of the AI-Tutor application, specifically focusing on the timeline of application startup, Speech-to-Text (STT) input, uploading a PDF, asking a question with RAG, and receiving a streaming Text-to-Speech (TTS) response. It also covers background processes that run independently of the core timeline.

The application is built using Electron (Main and Renderer processes) with a local AI backend integrating STT (Sherpa ONNX), TTS (Piper), RAG (Retrieval-Augmented Generation), and an LLM (Ollama).

---

## 1. Application Startup Sequence
**Location:** `apps/desktop/src/main/index.ts`

When the user launches the application, the Electron Main process boots up and executes a series of initialization steps to prepare the local backend services before rendering the UI.

### **Timeline of Processes:**
1. **Environment Setup:** 
   - `initializeLogger()` starts the `electron-log` logging system.
   - `loadEnv()` loads environment variables (`.env`).
   - Memory limits are enforced (e.g., `max-old-space-size=512`) if the system is detected as a low-end device.
2. **App Ready Event (`app.whenReady`)**:
   - `ensureDirectories()`: Ensures critical `AppData` storage directories exist for the database, vector indexes, and content.
   - **Content Seeding:** If it's a first run, bundled `.mp4`/`.pdf` dev data is copied to the user's `AppData` folder.
3. **Database & Services Initialization:**
   - **SQLite DB:** Local database is initialized via `initializeDatabase()`, configuring tables for students, analytics, and AI Tutor sessions.
   - **RAG Engine Warmup:** `initializeRagEngine()` and `warmupRagEngine()` are called. This loads the `ONNX` embedding models (e.g., MiniLM/BGE) and loads the persistent HNSW vector index into memory from disk so that local document searches are fast.
   - **AI/LLM Warmup:** `warmupOllama()` preloads the local LLM into memory so that the first chat query doesn't have a cold-start delay.
   - **STT/TTS Warmup:** `warmupSherpaSTT()` preloads the Speech-to-Text streaming models, and `initTTS()` prepares the Piper Text-to-Speech engine.
4. **IPC Registration:**
   - `registerIPCHandlers()` connects the Electron backend to the React/Vite frontend UI, establishing listeners in `apps/desktop/src/ipc/handlers.ts`.
5. **UI Rendering:**
   - `createWindow()` launches a secure `BrowserWindow` (with context isolation and disabled node integration) and loads `index.html`.

---

## 2. Speech-to-Text (STT) Voice Input
**Locations:**
- `apps/desktop/src/ipc/handlers.ts`
- `packages/backend/stt-engine/src/index.ts`

When the user decides to ask a question via voice, the application captures microphone input and transcribes it in real-time using local ONNX STT models.

### **Timeline of Processes:**
1. **Starting Recognition (`stt:start`):**
   - The UI invokes the `stt:start` IPC channel.
   - The backend initializes a streaming instance of the STT engine (e.g., Sravaani / Sherpa ONNX) tailored to the user's preferred Indian language or English.
2. **Streaming Audio (`IPC_CHANNELS.STT_CHUNK`):**
   - As the user speaks, the UI sends raw audio buffer chunks to the backend.
   - The backend converts the audio format (`pcm16ToFloat32`) and feeds it to `sherpaSTT.processAudio(samples)`.
   - The model frequently returns partial transcripts, which are emitted back to the UI (`stt:partial`) to update the text box in real-time.
3. **Stopping Recognition (`IPC_CHANNELS.STT_STOP`):**
   - When the user stops speaking, the UI sends a stop signal.
   - The backend resolves the final accumulated transcript and performs automatic language detection (`inferIndianLanguageFromTranscript`).
   - The final text is emitted to the UI (`STT_FINAL`) and populated in the chat input box, ready to be sent to the AI.

---

## 3. PDF Upload & Ingestion Flow
**Locations:** 
- `apps/desktop/src/ipc/handlers.ts`
- `packages/backend/rag-engine/src/index.ts`

When the user clicks the "Upload PDF" button in the chat interface to provide context to the AI, the document is ingested into the local Vector Database.

### **Timeline of Processes:**
1. **File Selection (`handlers.ts`):** 
   - The UI invokes `IPC_CHANNELS.RAG_UPLOAD_PDF`.
   - The backend opens a native OS dialog (`dialog.showOpenDialog`) to select the PDF.
   - The selected PDF is copied to a safe temporary location (`temp/afe-rag-uploads`).
2. **Queueing the Upload (`handlers.ts`):**
   - `queueRagUpload()` is called asynchronously so the UI isn't blocked.
   - It signals the UI that the document is processing (`RAG_UPLOAD_STATUS: 'processing'`).
   - Text is extracted from the PDF file using the `pdf-parse` library.
3. **Document Ingestion (`rag-engine/src/index.ts` - `RagEngine.ingest`):**
   - **Clean Up:** Any stale chunks for this specific document are removed from the vector database.
   - **Chunking:** `chunkText()` splits the extracted PDF text into semantically cohesive, overlapping blocks (chunks).
   - **Embedding:** `embedder.embedBatch()` converts every text chunk into a high-dimensional vector using the local `ONNX` model (`RemoteEmbedder`).
   - **Storage:** 
     - Text chunks and metadata (title, page, source) are stored locally in SQLite (`RagStore`).
     - Vector embeddings are inserted into the HNSW vector database (`VectorIndex.addVectors`).
   - **Persistence:** `vectorIndex.persist()` saves the updated vectors to disk.
4. **Completion:**
   - A `RAG_UPLOAD_STATUS: 'complete'` IPC event is fired back to the renderer, and the temporary PDF is deleted.

---

## 4. AI Inference & Text-to-Speech (TTS) Flow
**Locations:**
- `apps/desktop/src/ipc/handlers.ts`
- `packages/backend/ai-tutor/src/index.ts`
- `packages/backend/tts-engine/index.ts`

When the user submits their transcribed or typed question, the system queries the RAG engine, streams a response from the LLM, and synthesizes speech in real-time.

### **Timeline of Processes:**
1. **Message Dispatch (`handlers.ts`):**
   - The user submits the prompt, and the renderer calls `IPC_CHANNELS.AI_VOICE_MESSAGE` (for voice interactions) or `AI_SEND_MESSAGE` (for text).
   - The backend handler delegates this to `sendVoiceMessage(studentId, message, sessionId)` in the `ai-tutor` package.
2. **Context Retrieval (`ai-tutor/src/index.ts` -> `rag-engine/src/index.ts`):**
   - `getRetrievedContext(message)` queries the RAG engine.
   - `RagEngine.query()` orchestrates a hybrid search:
     - **Semantic Search:** HNSW finds the closest matching text chunks (`vectorIndex.search`).
     - **Lexical Search:** BM25 finds chunks with exact keyword matches.
     - **Fusion:** Results are combined and scored using Reciprocal Rank Fusion.
   - A token budget is applied (`applyTokenBudget`), and `buildContextBlock()` formats the retrieved chunks into a cited, prompt-ready block (e.g., `[1] (doc.pdf)`).
3. **LLM Inference & Sentence Chunking (`ai-tutor/src/index.ts`):**
   - `buildVoiceSystemPrompt()` merges the application's base instructions, the student's learning summary, and the formatted `ragContext`.
   - The constructed payload is sent to the local Ollama client (`client.chat({ stream: true })`).
   - As Ollama generates tokens, the text is accumulated and segmented into full sentences.
4. **Text-to-Speech Synthesis (`handlers.ts` & `tts-engine/index.ts`):**
   - For every completed sentence, the `onSentence` callback is triggered.
   - The backend cleans up the text (`stripMarkdownForTTS`) and passes it into a sequential Promise chain.
   - `ttsSpeak(sentence)` spawns/utilizes a persistent local Piper TTS child process. It sends the sentence via `stdin` and reads back raw WAV bytes from `stdout`.
   - The synthesized WAV buffer is sent to the frontend via the `IPC_CHANNELS.AI_VOICE_AUDIO` channel.
   - The frontend queues and plays the audio chunks sequentially, creating a seamless conversational experience without waiting for the full LLM answer to generate.

---

## 5. Background Processes
Independent of the user's explicit actions in the chat, the application runs several crucial background loops and deferred tasks.

**Locations:** `apps/desktop/src/main/index.ts`

### **1. SyncEngine (Telemetry & Progress Sync)**
- **Startup Trigger:** Initiated at app startup inside `startSyncEngine()`.
- **Behavior:** Runs immediately and then on a `setInterval` every 30 seconds.
- **Process:**
  - Uses `net.isOnline()` to verify network connectivity.
  - Optionally updates the device's coarse location via IP (`updateLocationFromIP`).
  - Calls `getUnsyncedSessions()` to find local learning data, video progress, or chat sessions that have not been backed up.
  - Transmits this telemetry to the centralized cloud backend (`https://rms-api.thesama.in/api/afe`).
  - Updates local records to mark them as synced upon success.

### **2. AI Summary Generation**
- **Startup Trigger:** Scheduled dynamically depending on the host machine's power.
- **Behavior:** If running on a low-end device, generation is delayed via `setTimeout` by 60 seconds to prevent starving the CPU during the initial UI render. Otherwise, it starts immediately.
- **Process:**
  - Evaluates local progress databases and uses the local AI model (in the background) to build a concise summary of the student's recent weaknesses and proficiencies.
  - This summary is subsequently used in the chat system (`studentSummary` injected into system prompts) to personalize the tutor's behavior.

### **3. Silent Auto-Updater**
- **Startup Trigger:** Initiated after `app.whenReady()` if the app is packaged.
- **Behavior:** Uses `electron-updater` (`autoUpdater.checkForUpdates()`).
- **Process:** Silently checks for newer releases in the background, downloads updates over the network, and queues them for installation upon the next application quit without disrupting the student's ongoing session.
