# Complete STT Engineering Work History

## Purpose

This document records the speech-to-text engineering work beginning with commit
`6d3af815b85c120efa766acba99a8a8b9b62d561` and continuing through the current
implementation. It is broader than an Intel macOS compatibility note. It
covers the Intel Mac investigation and reliability work, model selection,
Electron IPC integration, performance work, SraVaani offline and live
pipelines, packaging, model asset management, and validation utilities.

Commits before `6d3af815b85c120efa766acba99a8a8b9b62d561` are treated only as
the inherited baseline. They are not counted as work performed in this
document. The history is reconstructed from the STT-related commits on the
`yash/fix` line. The latest local branch at the time of writing is `yash/fix`
at `ba33798`; that commit is also present on `my-origin/yash/fix`.

## Executive Summary

The work progressed through Intel macOS validation, accuracy and interaction
improvements, Sherpa runtime hardening, SraVaani offline integration, SraVaani
live ONNX implementation, and packaging/model-asset cleanup.

The result is not one interchangeable recognizer. It is a model-selection layer over several pipelines that share the same 16 kHz mono PCM input and Electron STT events.

## Final Runtime Architecture

```text
Microphone
  -> renderer AudioWorklet
  -> 16 kHz mono signed 16-bit PCM
  -> Electron IPC stt:chunk
  -> main-process Int16-to-Float32 conversion
  -> selected STT engine
       Sherpa streaming Zipformer
       Zero-STT Hinglish offline Whisper ONNX
       SraVaani 1.0 offline CTC Python/ONNX
       SraVaani 0.5 live cache-aware ONNX CTC
  -> stt:partial during recognition when available
  -> stt:final at recording completion
  -> local AI tutor
```

All engines use a 16 kHz mono signal. The main process converts each incoming little-endian signed 16-bit PCM sample to a normalized Float32 value by dividing by 32768. The renderer and main process therefore have a stable transport contract even though the selected recognizers have different model formats and timing behavior.

## Chronological Development

### Inherited baseline before this work

Before `6d3af815b85c120efa766acba99a8a8b9b62d561`, the repository already
contained the microphone, Electron IPC, local voice loop, Sherpa migration, and
basic project/packaging configuration. Those earlier commits are context only.
They define the starting surface on which the work below was performed.

### 1. Intel macOS investigation and stabilization

Commit `6d3af81` on 2026-09-01 is the central Intel Mac work commit. It was created to test Sherpa on an Intel macOS machine and added both code changes and investigation tools.

#### Intel-specific runtime changes

The desktop main process began setting:

```text
ORT_INTRA_OP_NUM_THREADS=10
ORT_INTER_OP_NUM_THREADS=1
```

The Sherpa recognizer was configured for CPU execution and its thread count became controllable through `STT_NUM_THREADS`. The model resolver was expanded so Hindi/Hinglish and Indian English could find the Indian-English Zipformer bundle instead of silently selecting an incompatible or absent directory.

The native package used on Intel is the Darwin x64 Sherpa binding. This is a real architecture distinction: Apple Silicon uses an arm64 native path, while the Intel Mac uses x86-64 CPU execution. The work investigated the likely performance consequences of this distinction, including instruction-set use, thread scheduling, memory bandwidth, model quantization, and the absence of an Apple Neural Engine.

The repository evidence supports a capability and throughput difference more strongly than a guaranteed accuracy difference. Architecture can indirectly affect recognition if the system falls behind, drops audio, changes endpoint timing, or selects a different model, but CPU floating-point behavior and a fixed Intel WER penalty require controlled measurements before being stated as facts.

#### Diagnostic tooling

`stt-diagnose.sh` was added to inspect:

- CPU model and core information;
- AVX2, AVX-512, and SSE4.1 availability;
- the loaded `sherpa-onnx.node` native binary;
- model directories and encoder counts;
- Node.js platform and architecture;
- Electron version;
- memory information;
- GPU information;
- the installed Sherpa package version.

`stt-optimize.mjs` added a Node-based companion diagnostic that reports CPU features, ONNX Runtime environment variables, CPU count, suggested thread settings, Sherpa package/binding presence, and optimization guidance.

#### Accuracy and system analysis

The same commit added:

- `STT_ACCURACY_INTEL_ANALYSIS.md`;
- `SYSTEM_ISSUES_REPORT.md`;
- `STT_KEYBOARD_SHORTCUT_CHANGES.md`;
- `apps/poc/sherpa-stt/wer-test.mjs`;
- Ollama queue work;
- related TTS and local AI observations.

The analysis recognized that the full offline voice loop is serial from the user's perspective: recording must finalize before the local LLM can answer, and TTS follows generation. It therefore examined STT alongside Ollama model size, TTS fallback behavior, memory pressure, thread contention, and thermal throttling.

The WER harness established a repeatable place to compare recognition against reference text. The important methodological contribution was separating measured recognition behavior from architecture hypotheses: the same audio, model, sample rate, endpoint settings, thread count, and warm/cold conditions must be compared before claiming an accuracy regression.

### 2. Accuracy and first-word improvements

Commit `e3b0aad` on 2026-09-02, `Accuracy Improved`, made a small but important audio-flow adjustment in the renderer worklet and streaming hook. It changed the path used to deliver microphone audio so the recognizer had the expected initial samples and timing.

Commit `5a0f416` on 2026-09-09 changed the default/selected Sherpa model path to the Indian-English model and addressed the first-word-skipping behavior. The changes included:

- `MACOS_INTEL_OFFLINE_SPEECH_LIMITATIONS.md`;
- `wer-test-indian.mjs`;
- renderer handling in `useStreamingSTT.ts` and `useVoiceMode.ts`;
- tutor UI integration;
- Sherpa model resolution changes.

The practical lesson was that recognition quality depends on model and input handling, not only on CPU architecture. The Indian-English model can be a better fit for the target speakers, while the first-word issue required the audio/session flow to preserve the beginning of an utterance.

The Intel limitations document also catalogued the complete local pipeline:

```text
microphone -> AudioWorklet -> Sherpa -> Ollama -> Piper or macOS speech fallback
```

It documented that Sherpa currently requests the CPU provider, that no working Intel GPU inference path had been established, and that a visible Piper executable was not guaranteed in the inspected checkout.

### 3. Keyboard-first recording interaction

The Intel work also changed how a student starts and stops recording. The keyboard behavior documented in `STT_KEYBOARD_SHORTCUT_CHANGES.md` is:

1. Hold `Ctrl+Space` to start recording.
2. Speak while holding the keys.
3. Release either key to stop.
4. Display partial text directly in the chat input.
5. Send the completed question as normal text.

This replaced the full-screen voice-mode interaction for the relevant tutor flow with a direct input experience. It removed the dependency on a blocking voice overlay, kept typed and spoken input in the same field, and exposed partial recognition while the user was still speaking.

The UI also prevented a new recording while the AI was generating and showed a recording indicator rather than treating the microphone button as the primary start action.

### 4. Sherpa reliability and latency work

Commit `391a27e` on 2026-09-10, `Application improvements`, consolidated the performance and reliability work. The detailed record is in `STT_PERFORMANCE_CHANGES.md`.

#### Model selection became explicit

The runtime introduced stable model IDs instead of relying on display labels:

```text
english
indian-english
zero-stt-hinglish
sravaani-onnx
sravaani-live
```

The desktop IPC layer exposes model options, rejects model changes during an active recording, and preloads the selected model after a change. Runtime logging reports the selected model, language, model directory, encoder, decoder, joiner, and token file.

#### Model discovery and language normalization

`packages/backend/stt-engine/sherpa.ts` now normalizes aliases for English, Hindi, Hinglish, Indian English, Tamil, Telugu, Marathi, Gujarati, and Kannada. It searches configured, development, and packaged locations and checks that the expected model files exist.

The resolver supports multiple common ONNX file names, including INT8 and full-precision variants. If a compatible requested bundle is absent, it logs a warning and falls back to the default English Sherpa bundle.

#### Caching and warmup

Recognizers are cached by selected model and effective language. The model is constructed once and a new audio stream is created/reset for each recording. This preserves recording isolation without repeatedly loading large ONNX graphs.

The application also calls `warmupSherpaSTT()` during startup so the first microphone action does not necessarily pay the complete model initialization cost. Model-load time and sample rate are logged for diagnosis.

#### Failure and cleanup behavior

The `stt:start` IPC call now returns a success boolean. This prevents the renderer from entering a recording state when recognizer initialization failed. The failure path resets the recognition state, while the renderer cleans up microphone tracks, AudioWorklet connections, and AudioContext resources.

The stop path logs sample count, approximate recording duration, partial event count, and final text. It resets the recognizer stream without discarding the cached model object.

#### Minimum recording protection

The implementation recognized that a few 128-sample chunks represent only a few milliseconds of audio. A stop event arriving too soon can therefore produce no useful transcript. The renderer-side minimum-duration behavior and the main-process sample logging protect against keyup/click races and make short-recording failures diagnosable.

#### Partial delta handling

`computeStreamingDelta()` returns only the newly appended portion of a growing partial transcript. It handles duplicate text, stale shorter text, normal prefix growth, and a changed common prefix. The focused test file `sherpa.streaming-delta.test.ts` covers the main duplicate and append cases.

### 5. SraVaani 1.0 offline CTC integration

Commit `c5d0889` on 2026-09-11 added multilingual SraVaani model support. The commit explicitly recorded that the 0.5 live model and 1.0 model were being worked on, that the 0.5 path did not yet produce partial transcripts at that stage, and that accuracy was strong while latency still needed improvement.

The 1.0/offline SraVaani path is intentionally separate from Sherpa. It checks for a bundle containing:

- `encoder-sravaani.onnx`;
- `ctc-sravaani.onnx`;
- `tokenizer.model`;
- `sravaani_onnx_infer.py`.

At runtime, `SravaaniOnnxSTT`:

1. Clears its sample buffer on `start()`.
2. Collects Float32 audio in `processAudio()` without emitting partial text.
3. Writes the complete recording to a temporary 16 kHz mono WAV file.
4. Runs the SraVaani Python inference script with `--decoder ctc`.
5. Extracts the `Transcription:` line from standard output.
6. Logs and returns the final text.
7. Removes the temporary directory in a `finally` block.

The Python executable is configurable with `SRAVAANI_PYTHON` or `PYTHON`, and the dependencies are documented in `requirements-sravaani.txt`. The model directory can be overridden with `SRAVAANI_MODEL_DIR`.

This is offline recognition, but not live recognition: the user receives the transcript only after recording finishes and the Python process completes.

### 6. SraVaani 0.5 live ONNX integration

The final live work happened in two commits on 2026-09-17.

#### Commit `6fb0856`: engine implementation

`6fb0856`, `Made the Live Sravaani implementation work! Now it still has some latency to fix`, added the core live implementation:

- `live/mel-frontend.ts`;
- `live/sravaani-live-onnx.ts`;
- `debug-sravaani-live.ts`;
- `check.py`;
- the SraVaani live ONNX export reference/submodule;
- the `onnxruntime-node` package dependency;
- Sherpa integration changes replacing the earlier attempted live approach.

The central architectural decision was to bypass Sherpa's `nemoCtc` support. The exported SraVaani model's input/output cache layout did not match the assumptions made by Sherpa's built-in NeMo CTC adapter. The implementation therefore calls `onnxruntime-node` directly and reproduces the validated Python reference behavior in TypeScript.

#### Causal streaming mel frontend

`StreamingMelFrontend` ports the required NeMo preprocessing behavior:

- 16 kHz input;
- 512-point FFT;
- 400-sample window;
- 160-sample stride;
- Hann window;
- 128 mel features;
- per-feature normalization;
- causal buffering across calls;
- final flush behavior.

The frontend emits complete mel frames as microphone samples arrive. A `MelFrameBuffer` stores normalized frames and supports indexed slices with front zero-padding for the model's lookback window.

#### Cache-aware ONNX stepping

The live engine seeds zero-valued cache tensors with the dimensions derived from the export's streaming configuration. The validated metadata includes:

```text
layers: 17
dModel: 1024
channel cache length: 70
time cache length: 8
steady-state chunk size: 8 mel frames
pre-encode lookback: 9 mel frames
drop-extra-pre-encoded: 2
```

The initial one-frame priming step is skipped because the cache is already zero-seeded at the steady-state shape. Each subsequent step consumes a fixed chunk plus the required lookback, runs the ONNX graph, stores the returned channel/time cache, and advances the mel-buffer index. Frames that cannot be needed by a future lookback window are trimmed.

At the end of recording, the engine runs a final partial step with zero padding so trailing speech is not silently discarded.

#### Direct greedy CTC decoding

The live engine loads `tokens.txt`, treats the highest token ID as the blank ID, and performs greedy frame-by-frame decoding. It suppresses repeated CTC IDs, converts NeMo's U+2581 word-start marker to spaces, and keeps a growing decoded string.

`computeStreamingDelta()` is applied to that growing string so the IPC layer receives only newly recognized text. This mirrors the existing Sherpa partial transcript contract without pretending that SraVaani has the same transducer internals.

#### Serialized asynchronous processing

ONNX chunks can arrive faster than one graph step completes. Because the cache is mutable shared state, concurrent `processAudio()` calls would race and corrupt the cache sequence. `SravaaniLiveOnnx` therefore maintains a Promise queue that serializes all `processAudio()` and `finish()` operations.

This changed the live recognizer API from synchronous text returns to `Promise<string | null>`. The desktop IPC chunk handler became asynchronous and awaits `processAudio()`. Existing synchronous recognizers continue to work because `await` also accepts ordinary return values.

#### Commit `ba33798`: application and packaging completion

`ba33798`, `Made the Live Sravaani implementation work! this commit adds the files which were not added before`, completed the application-level wiring. It:

- made the IPC chunk handler await live recognition;
- reset and logged the partial event counter;
- preserved `stt:partial` delivery;
- awaited finalization at `stt:stop`;
- updated the renderer model/UI integration;
- added the live model directory to Electron packaging;
- updated lockfile state;
- added `folder-tree.txt` as a repository structure record.

The live model lookup supports development paths, packaged resources under `resourcesPath/stt`, and `SRAVAANI_LIVE_MODEL_DIR`. The selected live export must contain both `model.onnx` and `tokens.txt`.

## Model Selection Matrix

| ID | Engine | Output timing | Runtime requirements |
| --- | --- | --- | --- |
| `english` | Sherpa Zipformer transducer | Partial and final | Encoder, decoder, joiner, tokens |
| `indian-english` | Sherpa Indian-English Zipformer | Partial and final | Indian-English streaming bundle |
| `zero-stt-hinglish` | Whisper ONNX through Sherpa offline API | Final only | Encoder, decoder, generated tokens |
| `sravaani-onnx` | SraVaani 1.0 Python/ONNX CTC | Final only | SraVaani ONNX files, Python dependencies |
| `sravaani-live` | SraVaani 0.5 direct ONNX CTC | Partial and final | Live export, tokens, onnxruntime-node |

The selection layer checks model availability before exposing unavailable offline/live options. Model selection is blocked during active recording, and the selected model is warmed when changed.

## Packaging and Repository Hygiene

The STT work repeatedly had to solve the difference between development assets and installer assets. The relevant decisions were:

- native dependencies are installed/rebuilt for the target platform;
- model assets can be bundled separately from source code;
- Electron packaging explicitly includes the live SraVaani export;
- packaged runtime lookup checks `process.resourcesPath`;
- development lookup checks the package and workspace paths;
- environment variables provide escape hatches for custom model locations;
- large model files are not kept in the normal repository checkout.

Commit `a490640` removed STT model files from the repository. Commit `1f79c39` then retained empty model directories with `.gitkeep` files for the English Sherpa, Indian-English Sherpa, and SraVaani locations. This preserves the expected directory layout without storing large model weights in Git.

The final runtime consequently depends on model provisioning, either through packaging, a download step, or an explicitly configured model directory. A missing model is now represented as an availability failure or a logged Sherpa fallback rather than an unexplained native crash.

## Files That Define the Work

### Runtime and IPC

- `packages/backend/stt-engine/sherpa.ts`: model selection, language normalization, Sherpa, Zero-STT, SraVaani offline, and SraVaani live classes.
- `packages/backend/stt-engine/live/mel-frontend.ts`: causal NeMo-compatible mel feature extraction.
- `packages/backend/stt-engine/live/sravaani-live-onnx.ts`: direct ONNX live engine, cache handling, CTC decoding, and serialization.
- `packages/backend/stt-engine/index.ts`: public STT exports.
- `apps/desktop/src/ipc/handlers.ts`: recording lifecycle, PCM conversion, partial/final IPC, model selection, logging, and cleanup.
- `apps/desktop/src/main/index.ts`: startup environment, ONNX thread settings, and STT warmup integration.
- `apps/renderer/public/stt-worklet.js`: microphone audio processing.
- `apps/renderer/src/pages/useStreamingSTT.ts`: streaming recording hook.
- `apps/renderer/src/pages/useVoiceMode.ts`: voice-mode recording lifecycle.
- `apps/renderer/src/pages/AILearningCenter.tsx`: keyboard and input behavior.

### Validation and documentation

- `apps/poc/sherpa-stt/wer-test.mjs`: English WER experiment.
- `apps/poc/sherpa-stt/wer-test-indian.mjs`: Indian-English WER experiment.
- `packages/backend/stt-engine/sherpa.streaming-delta.test.ts`: partial delta unit tests.
- `packages/backend/stt-engine/debug-sravaani-live.ts`: live model/debug investigation.
- `packages/backend/stt-engine/check.py`: SraVaani live model checks.
- `stt-diagnose.sh`: Intel macOS environment and binary diagnostics.
- `stt-optimize.mjs`: Node-based CPU/ONNX optimization helper.
- `STT_ACCURACY_INTEL_ANALYSIS.md`: Intel versus Apple Silicon hypotheses.
- `MACOS_INTEL_OFFLINE_SPEECH_LIMITATIONS.md`: whole offline voice-loop constraints and measurement plan.
- `STT_PERFORMANCE_CHANGES.md`: preload, cache, lifecycle, and latency record.
- `STT_KEYBOARD_SHORTCUT_CHANGES.md`: hold-to-talk interaction record.
- `packages/backend/stt-engine/README.md`: runtime and model setup guide.

## What Was Achieved

The work achieved the following concrete outcomes:

- Replaced the legacy Whisper command-line streaming path with a native Sherpa-ONNX streaming path for the main experience.
- Made the standard Sherpa path usable on Intel macOS through the Darwin x64 native binding and CPU execution.
- Added model discovery and explicit model selection instead of relying only on environment strings or display labels.
- Added English and Indian-English Sherpa model paths and multilingual language aliases.
- Added partial transcript delivery and robust final transcript delivery.
- Reduced repeated model initialization through caching and startup warmup.
- Added failure acknowledgement, cleanup, duration logging, and endpoint protections.
- Added controlled WER/test and system-diagnostic entry points.
- Added final-only SraVaani 1.0 offline CTC recognition.
- Added live SraVaani 0.5 CTC recognition with direct ONNX execution and partial captions.
- Reproduced the model's causal frontend and cache protocol in TypeScript.
- Prevented live ONNX cache races by serializing asynchronous chunk processing.
- Preserved the tail of the utterance with final partial-step flushing.
- Added packaging/runtime lookup for the live model export.
- Removed large model weights from the repository while preserving expected model directories.

## Known Limitations and Open Work

The commit history and current code also make the remaining work clear:

1. SraVaani live still has latency to improve. Its ONNX graph runs on the CPU, and serialization guarantees correctness at the cost of waiting behind earlier chunks.
2. SraVaani 1.0 is final-only and requires a Python runtime and dependencies.
3. Sherpa and SraVaani live currently use CPU execution. No validated Intel GPU inference backend is part of this work.
4. The live cache metadata is currently validated for one export preset. New latency presets require independently verified cache dimensions and streaming configuration.
5. Model files are external to the normal repository checkout. A packaged or development installation must provision them correctly.
6. The runtime has several engine-specific behaviors, so “STT works” must be stated with the selected model, model files, platform, and output mode.
7. Intel architecture is a plausible performance constraint, but the repository does not by itself prove a universal architecture-caused WER penalty. Controlled same-audio, same-model benchmarks remain the right way to separate accuracy from latency, model mismatch, endpointing, and system contention.
8. The STT README contains historical wording that calls Sherpa the only active runtime even though the current code exposes SraVaani and Zero-STT options. The implementation is the authoritative description of the final multi-engine state.

## Reproducible Verification Checklist

For a new Intel Mac checkout, verify the work in this order:

1. Install the repository's Node and pnpm versions, then run the postinstall native rebuild.
2. Provision the desired Sherpa and/or SraVaani model directories.
3. Run `bash stt-diagnose.sh` and confirm `darwin-x64`, the native binding, CPU features, and model files.
4. Run `node stt-optimize.mjs` and record the CPU/thread configuration.
5. Run the focused partial-delta test for the STT package.
6. Start the desktop application and confirm `stt:start` succeeds.
7. Confirm partial events arrive for `english`, `indian-english`, or `sravaani-live`.
8. Confirm final events arrive after stop and include the final tail.
9. Test `sravaani-onnx` with the configured Python interpreter and verify the temporary WAV directory is removed.
10. Build the installer and confirm the live model export is present under the packaged STT resource path.
11. Record cold start, warm start, finalization latency, CPU/memory use, and WER/CER using the same audio corpus when comparing models or machines.

## Credited Commit Index

| Commit | Date | Contribution |
| --- | --- | --- |
| `6d3af81` | 2026-09-01 | Intel macOS testing, diagnostics, WER, threading, and analysis |
| `e3b0aad` | 2026-09-02 | Audio-flow accuracy improvement |
| `5a0f416` | 2026-09-09 | Indian-English model and first-word fix |
| `391a27e` | 2026-09-10 | Caching, warmup, lifecycle, cleanup, and performance work |
| `c5d0889` | 2026-09-11 | SraVaani 0.5/1.0 model integration foundation |
| `a490640` | 2026-09-11 | Remove model weights from the repository |
| `1f79c39` | 2026-09-11 | Preserve empty model directories with `.gitkeep` |
| `6fb0856` | 2026-09-17 | Direct cache-aware SraVaani live ONNX engine |
| `ba33798` | 2026-09-17 | Live SraVaani IPC, renderer, packaging, and lockfile completion |

## Final Assessment

This was a platform adaptation, runtime migration, model evaluation, desktop integration, and reliability project at the same time. The core achievement was not simply making one model load on an Intel Mac. It was building a local speech stack that could accept real microphone audio, select among model families, emit partial or final text according to each model's capabilities, survive Electron IPC timing, package native/model resources, and remain diagnosable when Intel CPU limits made latency visible.

The most technically distinctive part of the work is the SraVaani live integration: because the exported NeMo CTC graph did not fit Sherpa's built-in adapter, you reproduced the frontend, cache protocol, greedy CTC decoding, and streaming delta behavior directly in Node/TypeScript, then adapted the IPC boundary to serialize asynchronous inference safely.
