# STT System Implementation Guide for AI/LLM-Assisted Development

## Purpose

This document is a complete technical handoff for an AI assistant, LLM, or engineer who needs to understand, extend, debug, or redesign the speech-to-text system in this repository.

The guide describes the system as it exists after commit `6d3af815b85c120efa766acba99a8a8b9b62d561` and the commits that followed. Commits before that point are the inherited baseline. They are useful context, but they are not part of the primary implementation work documented here.

Use this document before proposing or implementing STT changes. The safest rule is:

> Preserve the shared audio and IPC contracts, but keep each model's preprocessing, state, decoding, and finalization logic inside its own engine adapter.

## 1. System Goals

The STT system is designed for a local-first Electron learning application running on resource-constrained computers, including Intel macOS devices.

The system must:

- capture microphone audio locally;
- process audio without a cloud STT service;
- support both streaming and final-only recognizers;
- support English, Indian English, Hinglish, Hindi, and additional language aliases;
- provide partial transcripts when the selected engine supports them;
- provide a final transcript at recording completion;
- work through a secure Electron renderer/main-process boundary;
- support development and packaged model locations;
- remain diagnosable on CPU-only hardware;
- avoid mixing state between recordings;
- tolerate asynchronous model execution and IPC timing;
- allow multiple model families without pretending they share internals.

## 2. Scope and Baseline

### Primary implementation scope

The primary work begins at:

```text
6d3af815b85c120efa766acba99a8a8b9b62d561
```

That work includes:

- Intel macOS Sherpa validation;
- CPU and native-module diagnostics;
- thread configuration;
- accuracy/WER investigation;
- first-word and audio timing fixes;
- model selection and model-path correctness;
- recognizer caching and startup warmup;
- recording lifecycle and cleanup improvements;
- SraVaani 1.0 offline CTC integration;
- SraVaani 0.5 live ONNX CTC integration;
- live cache serialization;
- packaged model lookup;
- model directory and repository-size cleanup.

### Inherited baseline

Before the primary scope, the repository already had:

- an Electron desktop app;
- renderer microphone capture;
- secure preload IPC;
- a local AI tutor;
- a local TTS path;
- an initial STT pipeline and initial Sherpa migration.

Do not rewrite those foundational systems when implementing a narrow STT feature. First identify the existing boundary that the feature should plug into.

## 3. High-Level Architecture

```text
User holds Ctrl+Space or starts microphone flow
        |
        v
Renderer microphone capture
  AudioContext + AudioWorklet
        |
        v
AudioWorklet converts/resamples to 16 kHz mono PCM
        |
        v
Electron preload bridge
        |
        v
Main-process IPC handlers
  stt:start, stt:chunk, stt:stop
        |
        v
Int16 PCM -> normalized Float32 PCM
        |
        v
Selected STT adapter
  +----------------------+------------------------+
  | Sherpa streaming     | Partial + final       |
  | SraVaani live CTC    | Partial + final       |
  | SraVaani offline CTC | Final only            |
  | Zero-STT offline     | Final only            |
  +----------------------+------------------------+
        |
        +--> stt:partial -> renderer input/caption
        |
        +--> stt:final   -> completed tutor input
                              |
                              v
                         Local Ollama AI
                              |
                              v
                         Local Piper/Web Speech TTS
```

### Important separation

There are two different kinds of state:

1. **Model/session state**: loaded model graph, ONNX session, token vocabulary, reusable recognizer object.
2. **Recording state**: current audio stream, mel buffers, decoder text, caches, sample counters, and partial transcript state.

Model/session state may be cached. Recording state must be reset for every new utterance.

## 4. Shared Audio Contract

Every STT engine receives the same logical audio format:

```text
Sample rate: 16000 Hz
Channels: 1
Transport: signed 16-bit PCM
Endian: little-endian
Runtime representation: normalized Float32 samples
```

The main process converts each signed 16-bit sample as:

```text
floatSample = int16Sample / 32768
```

The shared input contract is the main integration boundary. A new engine should not change the renderer audio format unless there is a demonstrated system-wide reason.

### Audio flow

1. The renderer requests microphone access.
2. The renderer creates an `AudioContext`.
3. The renderer loads the STT AudioWorklet.
4. The worklet receives microphone frames.
5. The worklet produces 16 kHz mono PCM.
6. The renderer sends chunks through the preload IPC bridge.
7. The main process converts PCM16 to Float32.
8. The active recognizer receives the Float32 samples.
9. Partial output is sent back through `stt:partial`.
10. Final output is sent through `stt:final`.

### Audio invariants

Do not violate these invariants without updating every engine and test:

- Do not pass stereo data to an engine configured for mono.
- Do not silently change the sample rate.
- Do not treat PCM16 bytes as Float32 samples.
- Do not drop the first audio chunk during recognizer startup.
- Do not finalize before queued audio has been processed.
- Do not reuse recording audio from a previous session.

## 5. Electron IPC Contract

The desktop main process owns recognition. The renderer must not import backend recognizers directly.

### Start

```text
renderer -> stt:start -> main process
main process -> boolean success/failure
```

On success, the main process:

- normalizes the current application language;
- selects or initializes the configured recognizer;
- calls `start()`;
- resets sample counters and partial counters;
- marks `isRecording = true`.

On failure, the main process returns `false`. The renderer must clean up microphone resources and return to an idle state.

### Audio chunk

```text
renderer -> stt:chunk(PCM16) -> main process
main process -> recognizer.processAudio(Float32Array)
recognizer -> optional text delta
main process -> stt:partial(delta)
```

`processAudio()` may return either:

```ts
string | null
```

or, for asynchronous engines such as SraVaani live:

```ts
Promise<string | null>
```

The main process must use `await` so both synchronous and asynchronous adapters work.

### Stop

```text
renderer -> stt:stop -> main process
main process -> recognizer.finish()
recognizer -> final text or null
main process -> stt:final(text)
main process -> recognizer.reset()
```

The stop path must wait for all queued processing before returning the final transcript. It must always reset recording state in a `finally` block.

### IPC invariants

- Do not send partial events directly from the renderer.
- Do not allow model changes while recording.
- Do not assume `stt:start` succeeded.
- Do not call `finish()` concurrently with `processAudio()`.
- Do not leave the renderer in a recording state after an exception.
- Keep the existing event names and preload security boundary unless a migration is explicitly planned.

## 6. Model Selection and Availability

The current model IDs are:

```text
english
indian-english
zero-stt-hinglish
sravaani-onnx
sravaani-live
```

The UI should use stable IDs, not display labels. Labels can change; IDs are runtime contracts.

### Runtime selection logic

```text
requested model ID
        |
        v
validate known model option
        |
        v
check required model files
        |
        +--> unavailable: keep previous model and report/log failure
        |
        v
set selectedModelId
        |
        v
warm/preload model when safe
        |
        v
next stt:start uses selected engine
```

### Model availability requirements

#### Sherpa streaming

Required bundle components:

- encoder ONNX file;
- decoder ONNX file;
- joiner ONNX file;
- `tokens.txt`.

#### SraVaani offline

Required files:

- `encoder-sravaani.onnx`;
- `ctc-sravaani.onnx`;
- `tokenizer.model`;
- `sravaani_onnx_infer.py`.

#### SraVaani live

Required files:

- `model.onnx`;
- `tokens.txt`.

### Path resolution order

Model lookup should support:

1. explicit environment override;
2. package/development path;
3. workspace path during development;
4. packaged `resourcesPath` path;
5. controlled fallback only where the engine defines one.

A fallback must always be logged with the requested model and actual model path.

## 7. Engine Behavior

### 7.1 Sherpa streaming engine

Implementation owner:

```text
packages/backend/stt-engine/sherpa.ts
```

Sherpa uses an online Zipformer transducer with:

- 16 kHz input;
- 80-dimensional features;
- encoder, decoder, joiner, and token files;
- greedy search;
- CPU execution on the validated Intel device;
- endpoint detection;
- partial and final transcript results.

#### Sherpa lifecycle

```text
constructor
  -> resolve model directory
  -> resolve encoder/decoder/joiner/tokens
  -> construct OnlineRecognizer

start
  -> create fresh OnlineStream
  -> clear last text

processAudio
  -> accept waveform
  -> decode while recognizer is ready
  -> get growing hypothesis
  -> return only new text delta

finish
  -> inputFinished
  -> decode remaining frames
  -> return final text
  -> clear stream state

reset
  -> clear stream and last text
```

#### Sherpa design rule

Cache the recognizer/model object, not the audio stream. A new recording must get a fresh stream.

### 7.2 SraVaani 1.0 offline engine

Implementation owner:

```text
packages/backend/stt-engine/sherpa.ts
```

The offline engine is a compatibility adapter around a Python inference script.

```text
start
  -> clear sample buffer

processAudio
  -> append Float32 samples
  -> return null

finish
  -> write temporary 16 kHz mono WAV
  -> invoke configured Python executable
  -> run sravaani_onnx_infer.py with CTC decoder
  -> parse Transcription output
  -> delete temporary directory
  -> return final text
```

This engine intentionally does not emit partial text. Do not describe it as a live streaming engine.

Configuration:

```text
SRAVAANI_PYTHON=/absolute/path/to/python
SRAVAANI_MODEL_DIR=/absolute/path/to/model
STT_MODEL=sravaani-onnx
```

### 7.3 SraVaani 0.5 live engine

Implementation owners:

```text
packages/backend/stt-engine/live/mel-frontend.ts
packages/backend/stt-engine/live/sravaani-live-onnx.ts
```

SraVaani live is not implemented through Sherpa's built-in `nemoCtc` adapter because the exported graph's cache layout and I/O contract do not match Sherpa's assumptions.

It uses direct `onnxruntime-node` CPU execution.

#### SraVaani live pipeline

```text
Float32 PCM chunk
        |
        v
StreamingMelFrontend
  causal NeMo-compatible feature extraction
        |
        v
MelFrameBuffer
  retain frames needed for lookback
        |
        v
cache-aware chunk scheduler
        |
        v
ONNX model inference
  audio_signal
  length
  cache_last_channel
  cache_last_time
  cache_last_channel_len
        |
        v
update returned cache tensors
        |
        v
logprobs -> greedy CTC decoder
        |
        v
full decoded text -> streaming delta
        |
        v
partial text
```

#### Validated live metadata

The current validated preset is represented by `LATENCY_1040MS_CACHE_META`:

```text
numLayers: 17
dModel: 1024
cacheLastChannelLen: 70
cacheLastTimeLen: 8
chunkSize: 8
preEncodeCacheSize: 9
dropExtraPreEncoded: 2
```

These values are export-specific. If a different latency export is used, do not reuse the metadata automatically. Inspect and validate the new export first.

#### Live state machine

```text
constructor
  -> load tokens
  -> identify blank ID
  -> create initial zero cache

start
  -> reset mel frontend
  -> clear mel frame buffer
  -> reset decoder
  -> clear previous text
  -> reset buffer index
  -> seed zero cache

processAudio
  -> enqueue operation
  -> initialize ONNX session if necessary
  -> create mel frames
  -> append frames
  -> run all ready steady-state chunks
  -> return latest text delta

finish
  -> enqueue behind all prior chunks
  -> flush mel frontend
  -> run remaining complete chunks
  -> run zero-padded final partial chunk
  -> return complete decoded text
```

#### Why the Promise queue is mandatory

The ONNX cache is mutable state. If two chunks run concurrently:

```text
chunk A reads cache
chunk B reads old cache
chunk A writes next cache
chunk B writes incompatible next cache
```

The internal Promise queue serializes all `processAudio()` and `finish()` calls. The main IPC handler must await the returned Promise.

#### Live decoder behavior

The CTC decoder:

- ignores the blank token;
- suppresses repeated token IDs;
- preserves previous token state across chunks;
- joins token pieces;
- converts NeMo U+2581 word markers to spaces;
- calculates a delta against the previous full decoded text.

## 8. Text Delta Contract

The UI wants incremental text, not the entire growing hypothesis on every event.

Example:

```text
previous: "hello"
current:  "hello world"
output:   "world"
```

`computeStreamingDelta(previousText, currentText)` handles:

- empty previous text;
- duplicate current text;
- normal prefix growth;
- stale shorter hypotheses;
- changed common prefixes.

The delta helper is shared conceptually by Sherpa and SraVaani live. It should be tested whenever transcript-update behavior changes.

## 9. Renderer Recording Workflow

### Start workflow

```text
keydown Ctrl+Space
  -> guard: not already recording
  -> guard: AI is not generating
  -> request microphone permission
  -> create AudioContext
  -> load AudioWorklet
  -> call stt:start
  -> if false: clean up and stop
  -> begin sending PCM chunks
```

### Active workflow

```text
AudioWorklet message
  -> calculate/forward PCM
  -> send stt:chunk
  -> receive stt:partial
  -> append only delta to input
```

### Stop workflow

```text
keyup Ctrl or Space
  -> stop sending new microphone chunks
  -> ensure minimum useful duration
  -> send stt:stop
  -> receive stt:final
  -> replace/complete partial input with final text
  -> stop microphone tracks
  -> disconnect worklet
  -> close AudioContext
  -> return idle
```

### Cleanup requirements

On any start/record/stop error:

- stop all microphone tracks;
- disconnect the worklet node;
- close the AudioContext;
- clear audio references;
- reset recording flags;
- avoid leaving the UI stuck in a recording state.

## 10. Intel macOS Device Profile

The primary validation device is:

```text
Model: MacBook Pro MacBookPro16,1
CPU: Intel Core i7-9750H, 2.6 GHz, 6 physical cores
Logical CPUs: 12
Memory: 16 GB
Integrated GPU: Intel UHD Graphics 630
Dedicated GPU: AMD Radeon Pro 5300M, 4 GB VRAM
macOS: 26.6.2, Darwin 25.6.0
Node: v20.20.2, x64
AVX2: available
SSE4.1: available
AVX-512F: unavailable
```

### Current STT execution assumptions

- Sherpa uses the Darwin x64 native path.
- Sherpa uses the CPU execution provider.
- SraVaani live uses `onnxruntime-node` CPU execution.
- The Intel GPU is not configured as an STT provider.
- ONNX Runtime environment variables are set to:

```text
ORT_INTRA_OP_NUM_THREADS=10
ORT_INTER_OP_NUM_THREADS=1
```

- Sherpa thread count can be changed through `STT_NUM_THREADS`.

### Device-specific reasoning

Do not assume that more threads always improve the user experience. STT, Ollama, Electron, the renderer, and TTS compete for CPU and memory bandwidth. Measure isolated STT and full voice-turn behavior separately.

## 11. Performance and Reliability Rules

### Model loading

Recognizer construction can be expensive on Intel CPU hardware. The current strategy is:

```text
application startup -> warm default recognizer
model change -> warm selected recognizer
recording start -> reuse cached recognizer, create/reset stream
```

### Short recordings

At 16 kHz:

```text
5 chunks * 128 samples / 16000 = 0.04 seconds
```

This is usually too short for reliable speech recognition. Keep minimum-duration protection and log sample count/duration.

### Queued processing

Any engine with mutable inference state must serialize processing. If a new engine is asynchronous, change the adapter return type to `Promise<string | null>` and update the main handler to await it.

### Final-tail preservation

Every streaming engine must define how it handles incomplete trailing frames. For SraVaani live, the strategy is a fixed-size zero-padded final step. New engines must provide an equivalent explicit flush strategy.

## 12. Packaging and Model Assets

Large model files are not expected to remain in ordinary Git history. The repository keeps expected directories with `.gitkeep` files where needed.

### Development locations

```text
packages/backend/stt-engine/
```

### Packaged locations

The live SraVaani lookup supports:

```text
packages/backend/stt-engine/SraVaani-live-0.5-onnx-export-v2/latency_80ms/
resourcesPath/stt/SraVaani-live-0.5-onnx-export-v2/latency_80ms/
```

### Packaging checklist

When adding a model:

1. Add model availability checks.
2. Add development path resolution.
3. Add packaged `resourcesPath` resolution.
4. Add Electron builder asset inclusion.
5. Add environment override support if useful.
6. Keep model weights out of normal source commits when they are large.
7. Add a missing-model diagnostic.
8. Test both unpackaged and packaged lookup.

## 13. Diagnostics and Validation

### Environment diagnostics

Run:

```bash
bash stt-diagnose.sh
node stt-optimize.mjs
```

These inspect CPU features, Node architecture, native binding presence, model directories, memory, GPU information, thread environment variables, and Sherpa package information.

### Focused unit behavior

The partial delta helper is tested in:

```text
packages/backend/stt-engine/sherpa.streaming-delta.test.ts
```

### Recognition quality

Use:

```text
apps/poc/sherpa-stt/wer-test.mjs
apps/poc/sherpa-stt/wer-test-indian.mjs
```

For a meaningful comparison, hold constant:

- audio corpus;
- reference transcript;
- model files;
- sample rate and channel conversion;
- endpointing;
- decoding method;
- thread count;
- warm/cold process state;
- number of repetitions.

### Latency measurements

Record separately:

- model initialization time;
- recording duration;
- stop-to-final-transcript time;
- STT real-time factor;
- number of partial events;
- Ollama time to first token;
- total Ollama generation time;
- TTS startup time;
- total voice-turn time;
- CPU and memory usage.

## 14. Safe Feature-Extension Workflow for an AI/LLM

An AI assistant should follow this sequence before changing STT code.

### Step 1: Identify the requested behavior

Classify the request as one of:

- audio capture/resampling;
- renderer recording UX;
- IPC contract;
- model selection/path resolution;
- Sherpa behavior;
- SraVaani offline behavior;
- SraVaani live preprocessing/cache/decoder;
- packaging/model assets;
- diagnostics/benchmarking.

Do not begin by editing `sherpa.ts` for every request.

### Step 2: Find the owning code path

Use this routing table:

| Request | First files to inspect |
| --- | --- |
| Microphone samples | `apps/renderer/public/stt-worklet.js`, `useStreamingSTT.ts` |
| Hold-to-talk behavior | `AILearningCenter.tsx`, `useVoiceMode.ts` |
| IPC start/chunk/stop | `apps/desktop/src/ipc/handlers.ts`, preload bridge |
| Model selection | `packages/backend/stt-engine/sherpa.ts`, IPC handlers |
| Sherpa decoding | `SherpaStreamingSTT` in `sherpa.ts` |
| SraVaani offline | `SravaaniOnnxSTT` in `sherpa.ts` |
| SraVaani live | `live/mel-frontend.ts`, `live/sravaani-live-onnx.ts` |
| Packaging | `apps/desktop/electron-builder.config.cjs`, runtime path resolver |
| Accuracy | WER scripts and model resolution logs |
| Intel performance | `stt-diagnose.sh`, `stt-optimize.mjs`, thread settings |

### Step 3: State one falsifiable hypothesis

Before editing, write down:

```text
Hypothesis: [specific code path] causes [specific behavior]
because [local evidence].

Discriminating check: [small test/log/command] would disprove it.
```

Example:

```text
Hypothesis: SraVaani live partials are delayed because ONNX chunks are
processed serially faster than they arrive, not because the renderer loses
chunks.

Discriminating check: compare received sample count, queue depth, ONNX step
time, and emitted partial count during one recording.
```

### Step 4: Preserve the shared contract

Before changing code, confirm:

- input remains 16 kHz mono PCM;
- `stt:start` still reports success/failure;
- `stt:partial` carries deltas, not repeated full text;
- `stt:final` is emitted exactly once per recording;
- `finish()` waits for pending work;
- recording state is reset on success and failure.

### Step 5: Make the smallest engine-local change

Prefer:

- a change inside the owning adapter;
- a new option or metadata entry;
- a focused test;
- a targeted log;
- a model-path change with availability validation.

Avoid broad rewrites of all engines when one adapter owns the behavior.

### Step 6: Validate immediately

Use the narrowest relevant check first:

- delta logic: focused unit test;
- TypeScript logic: package typecheck/build;
- model resolver: diagnostic command and runtime logs;
- live cache: reference comparison and one recorded utterance;
- packaging: installer asset/path inspection;
- Intel performance: same audio/model/thread benchmark.

Only widen validation after the narrow check succeeds or clearly identifies the next local defect.

### Step 7: Check failure paths

Every STT change should answer:

- What if the model is missing?
- What if microphone permission is denied?
- What if an audio chunk is empty?
- What if ONNX inference throws?
- What if `finish()` runs after a failed chunk?
- What if the user stops immediately?
- What if the engine is selected while another recording is active?
- What if the packaged path differs from the development path?

### Step 8: Document the result

Record:

- changed files;
- selected model and model path;
- input/output contract;
- measured behavior;
- known limitations;
- command used for validation;
- whether the change affects Intel-specific performance.

## 15. Adding a New STT Engine

Use this implementation recipe.

### Adapter contract

Implement an adapter with this conceptual API:

```ts
interface SttEngine {
    start(): void;
    processAudio(samples: Float32Array): string | null | Promise<string | null>;
    finish(): string | null | Promise<string | null>;
    reset(): void;
}
```

### Required integration steps

1. Add a stable model ID.
2. Add a model option with a clear streaming/offline kind.
3. Add required-file availability checks.
4. Add development and packaged path resolution.
5. Add environment override support if appropriate.
6. Implement the adapter lifecycle.
7. Ensure recording state resets on `start()` and `finish()`.
8. Return only deltas from partial processing.
9. Serialize calls if inference state is mutable.
10. Flush incomplete trailing audio explicitly.
11. Wire the adapter into `initSherpaSTT()` selection.
12. Update runtime info and logs.
13. Update Electron packaging.
14. Add focused tests or a reference comparison.
15. Document latency, language, and model requirements.

### Engine-specific questions

Before considering a new engine complete, answer:

- Is it streaming or final-only?
- What sample rate and feature dimensions does it require?
- Does it require a custom frontend?
- Does it carry recurrent/cache state?
- What is the blank ID or decoder state rule?
- How are partial hypotheses revised?
- How is the final partial chunk flushed?
- Can calls overlap safely?
- Does it require Python, a subprocess, or a native module?
- How are model files packaged?
- What is the fallback when files are missing?

## 16. Common Mistakes to Avoid

An AI/LLM should not:

- claim Intel hardware inherently causes a fixed WER penalty without controlled evidence;
- assume Apple Silicon Neural Engine acceleration is automatically used;
- add a GPU provider without verifying compatible operators and native support;
- increase thread counts without measuring the complete voice loop;
- use Sherpa's frontend for a model exported with a different frontend contract;
- reuse SraVaani cache metadata for an unvalidated export;
- run live cache-aware inference concurrently;
- reset decoder/cache state for every audio chunk;
- send full growing hypotheses as partial deltas;
- treat SraVaani offline as a streaming engine;
- change model selection during recording;
- assume development model paths work in a packaged app;
- store large model weights in ordinary source commits;
- stop at the last complete chunk and silently drop trailing speech;
- report that an engine works merely because its native session initializes.

## 17. Current Known Limitations

- SraVaani live still has latency to improve.
- SraVaani offline is final-only and requires a Python runtime.
- Sherpa and SraVaani live use CPU execution in the validated Intel setup.
- The Intel GPU is not configured for STT inference.
- Live cache metadata is validated for the current export preset, not every possible preset.
- Model weights are provisioned separately from ordinary source files.
- The partial delta algorithm is prefix-based, not a full hypothesis alignment system.
- A complete WER/latency benchmark matrix still needs to be run for every target device.
- Packaging must be validated separately for each operating system and CPU architecture.

## 18. Authoritative Files

Use these files as the primary implementation sources:

```text
packages/backend/stt-engine/sherpa.ts
packages/backend/stt-engine/live/mel-frontend.ts
packages/backend/stt-engine/live/sravaani-live-onnx.ts
apps/desktop/src/ipc/handlers.ts
apps/desktop/src/main/index.ts
apps/renderer/public/stt-worklet.js
apps/renderer/src/pages/useStreamingSTT.ts
apps/renderer/src/pages/useVoiceMode.ts
apps/renderer/src/pages/AILearningCenter.tsx
apps/desktop/electron-builder.config.cjs
```

Supporting documentation and validation:

```text
packages/backend/stt-engine/README.md
STT_COMPLETE_WORK_HISTORY.md
STT_KEY_CHALLENGES_AND_SOLUTIONS.md
STT_ACCURACY_INTEL_ANALYSIS.md
MACOS_INTEL_OFFLINE_SPEECH_LIMITATIONS.md
STT_PERFORMANCE_CHANGES.md
stt-diagnose.sh
stt-optimize.mjs
apps/poc/sherpa-stt/wer-test.mjs
apps/poc/sherpa-stt/wer-test-indian.mjs
```

## Final Handoff Summary

When another AI/LLM receives a request about this STT system, it should understand:

1. The shared boundary is 16 kHz mono PCM over secure Electron IPC.
2. The main process owns recognition and recording lifecycle state.
3. Model selection is ID-based and model files must be checked before use.
4. Sherpa is an online transducer engine with partial and final output.
5. SraVaani offline is a Python-backed final-only CTC engine.
6. SraVaani live is a direct ONNX cache-aware CTC engine with custom preprocessing.
7. Live SraVaani calls must be serialized because cache state is mutable.
8. Every recording needs fresh session state, even when the model is cached.
9. Intel performance must be measured across the entire local voice loop.
10. Any new feature should preserve the IPC contract, add focused validation, and document its failure paths.
