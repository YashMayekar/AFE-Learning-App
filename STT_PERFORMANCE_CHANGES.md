# STT Performance and Reliability Changes

## Purpose

This document explains the speech-to-text changes made to the offline tutor, why the previous implementation felt slow or sometimes returned no transcript, and how the current implementation improves responsiveness and model correctness.

The changes apply to the Electron desktop application, the renderer microphone flow, and the Sherpa-ONNX STT package.

## Previous Flow

Before the changes, pressing `Ctrl + Space` or the microphone button could trigger this sequence:

```text
User presses microphone
  -> renderer requests microphone permission
  -> renderer creates AudioContext
  -> renderer loads the AudioWorklet
  -> renderer calls stt:start
  -> main process constructs the selected ONNX recognizer
  -> ONNX model files are loaded and initialized
  -> recognizer creates an audio stream
  -> renderer begins sending microphone samples
```

The expensive step was recognizer construction. Sherpa-ONNX synchronously loads and initializes the encoder, decoder, joiner, and token files. On an Intel Mac, this can take noticeable time because inference is CPU-based and model initialization involves reading and preparing large ONNX graphs.

The renderer waited for `stt:start` to finish before it marked recording as active. This was behaviorally safe, but it made the microphone feel unresponsive because the user had to wait for model initialization before seeing the active recording state.

## Main Performance Change: Preloading

The default English recognizer is now warmed up during Electron application initialization:

```text
Application startup
  -> initialize Sherpa STT
  -> construct default English recognizer
  -> cache recognizer
  -> create application window
```

The startup path calls `warmupSherpaSTT('en')` before the main window is created. This moves the model-loading cost to application startup instead of placing it directly on the first microphone interaction.

Relevant implementation:

- `apps/desktop/src/main/index.ts`
- `packages/backend/stt-engine/sherpa.ts`
- `packages/backend/stt-engine/index.ts`

The application logs the result:

```text
[Sherpa] Online recognizer initialized
[Sherpa] Init time: 1053ms | Sample rate: 16000Hz
✓ Default STT model preloaded
```

The exact time depends on the selected model, disk speed, CPU load, and system temperature.

## Recognizer Caching

The STT engine now keeps recognizers in a cache instead of constructing a new ONNX recognizer for every recording.

The cache key is:

```text
selected model id + effective speech language
```

For example:

```text
english:en
indian-english:hi-en
```

The current code uses a cache similar to:

```typescript
const recognizerCache = new Map<string, SherpaStreamingSTT | ZeroSttHinglishSTT>();
```

When recording starts:

1. The selected model is read.
2. The effective language is calculated.
3. The cache is checked.
4. An existing recognizer is reused when available.
5. A new recognizer is constructed only when that model/language combination has not been loaded yet.
6. A fresh audio stream is created for the recording.

This preserves recording isolation without repeatedly reloading the ONNX model.

The recognizer object is reused, but the audio stream is reset for every recording. This is important: cached model state is reused for speed, while microphone audio from previous recordings is not reused.

## Measured Improvement

A direct runtime check showed the following behavior:

```text
First recognizer initialization: approximately 1053ms
Second initialization for the same model: same cached recognizer
```

The important improvement is not that ONNX inference became faster. The model still performs the same inference. The improvement is that model construction is no longer repeated on every recording.

For a user:

### Before

```text
Press Ctrl + Space
  -> wait for model initialization
  -> recording becomes active
```

### After startup preload

```text
Application startup
  -> model initializes once

Press Ctrl + Space
  -> reuse cached recognizer
  -> create a new audio stream
  -> recording becomes active quickly
```

The first application launch may take longer during initialization, but every subsequent recording starts with much lower latency.

## Model Selection Correctness

The UI exposes these model options:

- English streaming
- Indian English streaming
- Zero-STT Hinglish

The selection flow is:

```text
UI select element
  -> ipc.setSttModel(modelId)
  -> secure preload IPC bridge
  -> desktop ipcMain handler
  -> setSttModel(modelId)
  -> selectedModelId is updated
  -> selected model is preloaded
  -> next recording uses that model
```

The model is selected by a stable id, not by the visible label. Examples:

```text
english
indian-english
zero-stt-hinglish
```

This prevents a display-label change from accidentally selecting the wrong runtime model.

The model is changed only when no recording is active. Changing a model during an active recording could mix one model's recognizer state with another model's audio stream, so the UI disables the selector while recording.

## Indian English Fix

The Indian English option previously had a model-resolution problem. The UI selected `indian-english`, but the recognizer could still read the old environment-based model value or receive the wrong language path.

The current implementation makes the selected model id authoritative. When `indian-english` is selected:

```text
selectedModelId = indian-english
effective language = hi-en
model directory = sherpa-onnx-streaming-zipformer-indian-en
```

The runtime now logs the selected model and resolved directory:

```text
[Sherpa] Selected STT model: indian-english
[Sherpa] Model directory: .../sherpa-onnx-streaming-zipformer-indian-en
```

This means the model chosen in the UI is the model used to construct the recognizer, rather than merely a preference that can be overridden by an older environment variable.

The bundled Indian-English WER test also confirms that the model initializes and produces transcripts from audio files.

## Microphone Reliability Changes

Performance improvements must not cause the renderer and main process to disagree about recording state. Several safeguards were added.

### Acknowledged recognizer startup

The renderer now waits for a boolean result from `stt:start`:

```text
true  -> recognizer initialized; begin recording
false -> recognizer failed; clean up microphone resources
```

Previously, a fire-and-forget IPC call could make the renderer believe recording had started even when the main process failed to initialize the recognizer.

### Cleanup on failure

If microphone permission, AudioContext creation, AudioWorklet loading, or recognizer startup fails, the renderer now:

- disconnects the AudioWorklet;
- stops microphone tracks;
- closes the AudioContext;
- clears stored audio references;
- resets the recording state;
- returns the UI to a usable state.

This avoids the state where the UI says the microphone is active but no audio is reaching STT.

### Minimum useful recording duration

A previous log showed this sequence:

```text
Received chunk bytes=256 samples=128
Received chunk bytes=256 samples=128
Received chunk bytes=256 samples=128
Received chunk bytes=256 samples=128
Received chunk bytes=256 samples=128
Stopping Sherpa streaming recognition
No final transcription
```

At 16 kHz, five chunks of 128 samples equal only:

```text
5 × 128 / 16000 = 0.04 seconds
```

Forty milliseconds is not enough speech for a reliable recognizer result. The renderer now delays stop requests until at least one second has elapsed. This protects against fast keyup/click events and React event timing races.

The actual duration is logged:

```text
[STT] Stopping recording after 1248ms
[STT] Captured samples=19968 durationMs=1248
```

The main process also logs the number of received samples before finalization.

## Audio and Inference Pipeline

The active audio path remains:

```text
Microphone
  -> AudioContext
  -> AudioWorklet
  -> downsample to 16 kHz mono
  -> convert Float32 to Int16 PCM
  -> Electron IPC
  -> convert Int16 PCM back to Float32
  -> Sherpa-ONNX recognizer
  -> partial/final transcript
```

The AudioWorklet continues to do the real-time audio conversion. The main process converts the incoming Int16 PCM to normalized Float32 samples because Sherpa expects Float32 waveform input.

The preloading and caching changes do not remove or bypass this pipeline. They only move expensive model construction out of the time-sensitive microphone interaction.

## Zero-STT Hinglish Behavior

Zero-STT Hinglish uses a different architecture from the streaming Zipformer models:

- English and Indian English use `OnlineRecognizer` and can emit partial transcripts.
- Zero-STT Hinglish uses Whisper ONNX through `OfflineRecognizer`.
- Zero-STT buffers the recording and produces its transcript when recording stops.

Therefore, Zero-STT does not provide the same partial-transcript behavior as the streaming models. Its expected flow is:

```text
Start recording
  -> collect audio
  -> stop recording
  -> run Whisper encoder/decoder
  -> emit final transcript
```

The UI reports Zero-STT as unavailable until the real ONNX weights are present. The model repository initially contained Git LFS pointer files of approximately 134 bytes instead of the actual model files. The expected files are hundreds of megabytes:

- encoder: approximately 313 MB;
- decoder: approximately 512 MB;
- decoder with past: approximately 462 MB.

The runtime checks file sizes before allowing Zero-STT to be selected. This prevents an invalid ONNX pointer file from being passed to Sherpa and crashing the Electron process.

## Runtime Verification

When a recording starts, the desktop process logs the authoritative runtime information:

```text
[STT] Recognition started {
  selectedModel: 'indian-english',
  recognizer: 'online-sherpa',
  available: true
}
```

The corresponding Sherpa logs identify the actual bundle:

```text
[Sherpa] Selected STT model: indian-english
[Sherpa] Model directory: .../sherpa-onnx-streaming-zipformer-indian-en
[Sherpa] Encoder: .../encoder-epoch-10-avg-5-chunk-64-left-256.int8.onnx
```

For English:

```text
[Sherpa] Selected STT model: english
[Sherpa] Model directory: .../sherpa-onnx-streaming-zipformer-en-20M-2023-02-17
```

For Zero-STT after its weights are installed:

```text
[STT] Recognition started {
  selectedModel: 'zero-stt-hinglish',
  recognizer: 'offline-whisper',
  available: true
}
[Sherpa] Selected STT model: zero-stt-hinglish
[Sherpa] Zero-STT Hinglish recognizer initialized
```

These logs prove which model was selected and which runtime was initialized. The UI label alone is not sufficient evidence.

## What Improved Performance

The changes improve perceived performance in four ways:

1. **Startup preload:** the default model loads before microphone interaction.
2. **Recognizer cache:** repeated recordings reuse the loaded ONNX graph.
3. **Model-specific preload:** changing the UI model loads that model before the next recording.
4. **Short-recording protection:** the recognizer receives enough audio to produce a result instead of immediately finalizing an unusable 40 ms stream.

The changes improve perceived latency and reliability. They do not make the Intel CPU execute ONNX operators faster. The underlying model still consumes CPU during actual decoding.

## What Has Not Changed

The following limitations remain:

- Sherpa STT is configured for CPU inference.
- The Intel Mac does not use the Apple Neural Engine.
- The local LLM and TTS workloads can still compete for CPU and memory.
- Larger models remain slower than smaller models.
- Zero-STT offline Whisper inference is expected to take longer at finalization than a streaming Zipformer model.
- Recognition accuracy still depends on microphone quality, speaker accent, background noise, model choice, and utterance length.

## Recommended Test Procedure

1. Restart the app so the default model is preloaded.
2. Wait for:

```text
✓ Default STT model preloaded
```

3. Select `English streaming`.
4. Hold `Ctrl + Space` and speak for at least two seconds.
5. Release the key.
6. Confirm logs show the English model directory and a capture duration above 1000 ms.
7. Repeat with `Indian English streaming`.
8. Confirm the model directory changes to `sherpa-onnx-streaming-zipformer-indian-en`.
9. Test Zero-STT only after its ONNX files are larger than 1 KB and preferably match the expected hundreds-of-megabytes sizes.

Useful file check:

```bash
ls -lh packages/backend/stt-engine/zero-stt-hinglish-onnx-int8/*.onnx
```

Useful runtime checks:

```text
[STT] Recognition started ...
[Sherpa] Selected STT model: ...
[Sherpa] Model directory: ...
[STT] Captured samples=... durationMs=...
[STT] Final: ...
```

## Validation Performed

The following checks passed after the changes:

- STT package TypeScript typecheck;
- STT package build;
- desktop TypeScript check;
- renderer TypeScript check;
- generated STT module import smoke test;
- model registry selection test;
- recognizer cache reuse test;
- Indian-English bundled WER test;
- `git diff --check`.

The cache test verified that repeated initialization for the same model returns the same recognizer instance, while selecting Indian English creates a separate model-specific recognizer.

## Summary

The main performance problem was not the microphone hardware. It was placing synchronous ONNX model initialization on the critical path of the first microphone interaction.

The current design separates three operations:

```text
Model loading      -> application startup or model selection
Stream creation    -> each recording
Audio inference    -> while recording or at finalization, depending on model type
```

That separation makes the microphone responsive, keeps model selection explicit, avoids invalid Zero-STT startup, and provides logs that prove which model is actually being used.

## Change History

This document includes both the changes from the last commit and the changes currently present in the working tree.

### Last Commit: Indian-English Model and First-Word Fix

The last commit, `60e09fb`, changed the default Sherpa model path from the general English Zipformer bundle to the Indian-English bundle:

```text
sherpa-onnx-streaming-zipformer-indian-en
```

It also reduced the default Sherpa CPU thread count from 10 to 8. This lowers CPU contention on Intel Macs while retaining the Indian-English model's recognition behavior.

The commit fixed a first-word skipping and recording-start race in the renderer. The audio graph is now connected only after the backend recognizer has been asked to start and the recording state is ready. This prevents the first audio chunk from being produced before the backend stream exists or from being discarded by the renderer's recording guard.

The same commit also improved the interaction flow by:

- adding mouse or touch hold-to-talk behavior to the AI Learning Center microphone control;
- coordinating delayed stop requests when the user releases the control before asynchronous microphone startup finishes;
- keeping voice mode in a neutral state until the microphone pipeline is ready;
- disabling automatic silence-based stopping for tap-to-talk voice mode;
- adding Indian-English WER test audio and a bundled WER test script;
- documenting Intel macOS offline speech limitations;
- adding the Zero-STT Hinglish model repository reference.

### Current Working-Tree Changes

The current uncommitted changes extend that fix into a complete model lifecycle and reliability flow:

- The STT engine exposes three stable model ids: `english`, `indian-english`, and `zero-stt-hinglish`.
- The selected model id, rather than a visible label or stale environment value, controls recognizer construction.
- The desktop process preloads the default English streaming recognizer during startup and preloads a newly selected model before the next recording.
- Recognizers are cached by model and language, while each recording receives a fresh audio stream.
- The UI can query model options and availability through secure IPC and persists the selected model locally.
- Zero-STT uses Sherpa's offline Whisper recognizer and is marked unavailable until valid ONNX weights larger than the Git LFS pointer files are present. Its transcript is emitted only after recording stops.
- `stt:start` now uses acknowledged IPC and returns success or failure, allowing the renderer to clean up correctly when recognizer startup fails.
- The desktop process records received sample counts and reports the captured duration during finalization.
- Renderer cleanup now covers microphone permission, AudioContext, AudioWorklet, recognizer startup, and stop failures so the UI cannot remain stuck in a recording state.
- Recording stops are protected against extremely short captures, such as the earlier 40 ms case that could not produce a useful transcript.

Together, the committed changes address the Indian-English model selection and first-word race, while the current changes add startup warming, model-specific caching, explicit model selection, offline-model validation, and end-to-end failure handling.
