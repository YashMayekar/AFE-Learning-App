# RAG Engine — Integration Guide

## What this package is

A self-contained retrieval adapter, structured the same way as `stt-engine`:

- **Model/session state** (embedding model, HNSW index, sqlite handle) is loaded
  once via `warmup()` and cached — never reloaded per query.
- **Ingestion** (chunk → embed → index) is the only expensive path. It must run
  outside the real-time voice loop — from a background queue or a one-off CLI,
  never from `stt:final`.
- **Query** is stateless and cheap (~10–30ms target): embed the short user
  utterance, hybrid search (dense + lexical), fuse with RRF, return a
  token-budgeted context block.

No LangChain/LlamaIndex, no reranker model, no second ML runtime — see the
design rationale from the planning discussion for why.

## 1. Install & build

Add the package to the workspace (pnpm will pick it up via `pnpm-workspace.yaml`
since it already globs `packages/*/*`):

```bash
cd packages/backend/rag-engine
pnpm install
pnpm build
```

## 2. Bundle the embedding model (do this before packaging)

The engine expects a local ONNX embedding model directory so it never hits the
network at runtime — same rule as Sherpa/SraVaani model bundling in section 12
of the STT guide.

```bash
# One-time, in dev, with network access:
mkdir -p packages/backend/rag-engine/models
git clone --depth 1 \
  https://huggingface.co/Xenova/all-MiniLM-L6-v2 \
  packages/backend/rag-engine/models/all-MiniLM-L6-v2

# Confirm the quantized ONNX model and tokenizer files were downloaded:
ls packages/backend/rag-engine/models/all-MiniLM-L6-v2
```

This produces `packages/backend/rag-engine/models/all-MiniLM-L6-v2/` containing
the quantized ONNX weights + tokenizer files. Commit this the same way you
handle other model assets (keep large binaries out of ordinary source commits
per your existing `.gitkeep` convention — see section 12 of the STT guide).

Add to `electron-builder.config.cjs` (mirroring however Sherpa/SraVaani model
directories are already included) so `models/all-MiniLM-L6-v2` ships under
`resourcesPath/rag/all-MiniLM-L6-v2` in packaged builds. `embedder.ts`'s
`resolveModelDir()` already checks that path.

## 3. Wire ingestion into content-sync

`content-sync.ts` already owns bringing documents into the app (per the folder
structure — `dev-data/content/manifest.json`, `dev-data/assets/readables/`).
Hook RAG ingestion at the point where a document is confirmed synced/available,
not on every app start:

```ts
// apps/desktop/src/main/content-sync.ts (illustrative — adapt to actual shape)
import { RagEngine } from '@backend/rag-engine';
import { getUserDataPath } from './paths.js'; // however you resolve dev-data dir today

const ragEngine = new RagEngine({ dataDir: path.join(getUserDataPath(), 'rag') });
await ragEngine.warmup(); // once, at app startup — same slot as STT recognizer warmup

// ...inside your existing "document synced" handler:
async function onReadableSynced(item: ManifestReadableItem) {
  const text = await extractText(item.filePath); // pdf-parse, or reuse existing extraction if content-engine already has one
  await ragEngine.ingest({
    id: item.id,
    text,
    metadata: { title: item.title, source: item.filePath, language: item.language },
  });
}
```

Run ingestion **off** the main thread if your corpus is large — either a
worker thread or simply accept the one-time synchronous cost at sync time,
since it never touches the voice loop.

## 4. Wire retrieval into the tutor prompt

This is the only change that touches the real-time path. In
`packages/backend/ai-tutor/src/ollamaQueue.ts` / `prompts.ts`, insert a
retrieval step between `stt:final` and the Ollama call:

```ts
// packages/backend/ai-tutor/src/index.ts (illustrative — adapt to actual call site)
import { RagEngine } from '@backend/rag-engine';

const ragEngine = new RagEngine({ dataDir: ragDataDir });
await ragEngine.warmup(); // at app startup, alongside STT/TTS warmup

async function handleFinalTranscript(transcript: string) {
  const retrieved = await ragEngine.query(transcript, {
    topK: 5,
    maxContextTokens: 700,
  });
  const contextBlock = ragEngine.buildContextBlock(retrieved);

  const prompt = buildTutorPrompt({
    userText: transcript,
    ragContext: contextBlock, // '' if nothing relevant was retrieved — prompt template should handle that gracefully
  });

  return ollamaQueue.enqueue(prompt);
}
```

In `prompts.ts`, add a context slot to the system/user prompt template, e.g.:

```
Relevant course material (cite by [n] if you use it, ignore if irrelevant):
{ragContext}

Student said: {userText}
```

Keep the instruction explicit that the model should ignore the context block
if it's empty or irrelevant — don't force citation.

## 5. IPC surface (optional)

Only add an IPC handler if the renderer needs to trigger anything directly
(e.g. a "reindex this document" button, or a settings-page ingestion
progress view). The core query path does **not** need a new IPC event — it's
an internal step inside the existing `stt:final` → Ollama flow in the main
process, so `apps/desktop/src/ipc/handlers.ts` doesn't need new wiring for
retrieval itself. If you do add manual reindex controls, follow the existing
`stt:*` naming convention, e.g. `rag:ingest`, `rag:status`.

## 6. Validation checklist (mirrors STT's Step 6/7)

- [ ] `pnpm --filter @backend/rag-engine typecheck`
- [ ] `RAG_DATA_DIR=./dev-data/rag pnpm --filter @backend/rag-engine ingest ../../../dev-data/assets/readables` — confirm chunk counts and timing logged
- [ ] Query latency: log `Date.now()` around `ragEngine.query()` during a real voice turn; confirm it stays in the tens-of-ms range, not hundreds
- [ ] What if the model directory is missing? → `embedder.ts` falls back to a loud console warning + remote download in dev; **must** be caught before packaging (checklist item above)
- [ ] What if a document has zero extractable text (e.g. scanned PDF)? → `ingest()` returns `{ chunkCount: 0 }`, no crash
- [ ] What if `query()` runs before any document has been ingested? → `vectorIndex.search()` returns `[]` when the index is empty; lexical search likewise returns `[]`; `buildContextBlock([])` returns `''`
- [ ] What if two documents are ingested concurrently? → each `ingest()` call fully awaits before returning; avoid firing many ingests in parallel on a low-RAM device — ingest sequentially in the CLI/background queue, not with `Promise.all`

## 7. Known limitations (mirrors STT's "Current Known Limitations")

- HNSW does not support true deletion — `removeDocument()` soft-deletes
  (`markDelete`) but the index file will slowly accumulate tombstones under
  heavy add/remove churn. Periodically rebuild the index from `chunks` table
  if the app supports frequent document removal.
- The lexical index assumes `better-sqlite3` was compiled with FTS5 support
  (true by default on modern versions, but verify with
  `db.pragma('compile_options')` on first setup on a new build machine).
- The chunker's token counting is a whitespace-word heuristic, not the actual
  embedding model's tokenizer — fine for chunk-size control, not exact.
- No multilingual embedding model is wired in by default; if Hindi/Hinglish
  query volume is significant, evaluate a multilingual MiniLM variant and
  re-ingest (embeddings from different models are not compatible — a model
  swap requires a full re-ingest).
