# Offline Speech-to-Speech Tutor Limitations on an Intel Mac

This document explains why the offline voice tutor can feel slower, less reliable, or less natural on an Intel-based Mac. It describes the current implementation in this repository, the hardware constraints that matter, and the mitigations that are practical without sending audio or tutor data to a cloud service.

## Executive Summary

The tutor is not one model. It is a sequence of local workloads:

```text
Microphone
  -> browser AudioWorklet and resampling
  -> Electron IPC
  -> Sherpa-ONNX streaming speech recognition
  -> local Ollama language model
  -> Piper speech synthesis or macOS speech fallback
  -> audio playback
```

On an Intel Mac, the main limitation is that every stage competes for general-purpose CPU and system memory. Apple Silicon systems have a newer CPU design, higher memory bandwidth, and dedicated media/AI acceleration options that are not available to an Intel Mac in the same way. However, the repository does not establish that CPU architecture alone changes recognition accuracy. Accuracy must be measured with the same audio set, model, and configuration.

The most important current findings are:

1. **STT is explicitly CPU-only.** Sherpa is configured with `provider: "cpu"`; the Intel binary is the x64 package `sherpa-onnx-node`.
2. **The voice loop is serial from the user's perspective.** Recording must finish before the final transcript is sent to the local LLM, and TTS follows LLM output.
3. **Ollama may be the largest latency source.** Candidate local models include 1.5B, 3B, 4B, 7B, and 8B models. Larger models are expensive on an Intel CPU and may compete with other processes.
4. **The current checkout may not have a native macOS Piper executable.** It contains a 61 MB TTS model and Windows DLLs, but no visible `piper` binary. The code therefore falls back to the macOS Web Speech API when Piper is unavailable.
5. **The application already sets thread variables, but STT also has its own thread setting.** Electron sets `ORT_INTRA_OP_NUM_THREADS=10` and `ORT_INTER_OP_NUM_THREADS=1`; Sherpa separately defaults to `STT_NUM_THREADS || 8`.
6. **Some previous reports overstate the evidence.** Claims such as “Intel floating-point rounding causes recognition errors,” “Apple Silicon always uses the Neural Engine,” or fixed WER and latency numbers should not be treated as established without a controlled benchmark.

## What “Offline” Means Here

Offline means that speech recognition, language generation, and speech synthesis are intended to run on the device. It does not mean that the work is free:

- Audio is captured and transformed locally, but still moves between the renderer and Electron main process through IPC.
- Sherpa-ONNX runs an acoustic model locally.
- Ollama loads and evaluates a local LLM.
- Piper, when its native binary and voice assets are present, evaluates a local voice model.
- If Piper is unavailable, the renderer uses `window.speechSynthesis`; the voice and implementation then depend on voices installed by macOS.

The privacy benefit is substantial, but the device must provide all compute, memory bandwidth, storage, and thermal headroom that a hosted service would otherwise provide remotely.

## Current Pipeline and Its Cost

### 1. Capture and audio preparation

The renderer's `AudioWorklet` receives microphone audio, computes RMS levels, downsamples it to 16 kHz mono, converts samples to signed 16-bit PCM, and sends buffers over Electron IPC. The worklet performs the conversion in JavaScript for each audio frame.

This work is normally smaller than model inference, but it still contributes to CPU scheduling and message traffic. The current voice mode uses tap-to-talk behavior with VAD disabled, so the user normally records until an explicit stop action. A longer recording increases the amount of audio that must be finalized and delays the next stage.

Relevant implementation: [`apps/renderer/public/stt-worklet.js`](apps/renderer/public/stt-worklet.js) and [`apps/renderer/src/pages/useVoiceMode.ts`](apps/renderer/src/pages/useVoiceMode.ts).

### 2. Sherpa-ONNX streaming STT

The STT package uses a Sherpa streaming Zipformer model with an 80-dimensional feature configuration and a 16 kHz sample rate. It loads encoder, decoder, joiner, and token files from a model bundle. The recognizer is configured as follows:

- `provider: "cpu"`
- `numThreads: Number(process.env.STT_NUM_THREADS) || 8`
- greedy search decoding
- endpoint silence rules of 1.2 to 2.4 seconds, depending on the rule
- a minimum endpoint utterance length of 20 frames

The x64 native dependency is appropriate for an Intel Mac, but it is still an x86-64 CPU implementation. It cannot use Apple Silicon's ARM execution path or Neural Engine. It also cannot use the Intel integrated GPU because the current Sherpa configuration does not request a GPU provider.

The repository includes multiple model bundles. The measured local sizes from this checkout are approximately:

| Asset | Approximate size | Consequence |
| --- | ---: | --- |
| English streaming model | 132 MB | More disk and model-loading work |
| Indian English streaming model | 70 MB | Smaller local footprint; accuracy depends on speaker and accent |
| Hinglish model directory | 7 MB | Separate model/token assets; verify that it is a complete compatible runtime bundle |

The size is not the same as runtime memory. ONNX model tensors, allocator buffers, thread stacks, audio queues, Electron, and Ollama can together consume substantially more RAM than the files on disk.

Relevant implementation: [`packages/backend/stt-engine/sherpa.ts`](packages/backend/stt-engine/sherpa.ts).

### 3. Local LLM generation

The transcript is sent to Ollama on `127.0.0.1:11434`. The application selects the first installed model from this list:

- `qwen2.5:1.5b`
- `qwen2.5-coder:7b`
- `qwen2.5:7b`
- `llama3.2:3b`
- `llama3.1:8b`
- `gemma3:4b`

This is often the dominant delay on an Intel Mac. A local 7B or 8B model requires considerably more CPU work and memory than a 1.5B or 3B model. When the model is not already resident, model loading creates an additional cold-start delay.

The app streams the main response when a chunk callback is supplied, but other work can still compete for the same Ollama service. Session-title generation and background summaries are additional local LLM requests. On CPU-only hardware, concurrent requests generally increase queueing instead of improving throughput.

Relevant implementation: [`packages/backend/ai-tutor/src/index.ts`](packages/backend/ai-tutor/src/index.ts) and [`ollama_performance_analysis.md`](ollama_performance_analysis.md).

### 4. TTS and playback

The intended offline engine is Piper. The TypeScript code starts a persistent Piper process and sends JSON text through its stdin, which avoids intentionally loading a new Piper process for every sentence.

There is an important platform check for this repository state:

- On macOS, the code looks for a file named `piper`.
- In the inspected checkout, the TTS directory contains the ONNX voice model, `onnxruntime.dll`, and other Windows DLLs, but no visible macOS `piper` executable.
- If the binary or model is missing, the main process returns no Piper audio and the renderer falls back to `window.speechSynthesis`.

That fallback is not equivalent to a fully bundled offline Piper voice. It can vary with installed macOS voices, may not support the desired Indian or Hinglish pronunciation, and may have different latency and voice quality.

Relevant implementation: [`packages/backend/tts-engine/index.ts`](packages/backend/tts-engine/index.ts) and [`apps/renderer/src/pages/useVoiceMode.ts`](apps/renderer/src/pages/useVoiceMode.ts).

## Why Intel macOS Feels More Limited

### CPU architecture and native binaries

The Intel path uses the Darwin x64 native package. Apple Silicon uses a separate arm64 path. A binary compiled for x64 cannot use ARM-specific instruction sets, and an Intel Mac does not have the Apple Neural Engine.

This establishes a capability difference, not a guaranteed accuracy difference. CPU architecture is expected to affect throughput and latency more directly than recognition correctness. Recognition accuracy can change indirectly if slower processing causes dropped audio, delayed endpointing, thermal throttling, or a different model/configuration to be selected.

### Memory bandwidth and contention

Speech models repeatedly read and transform large tensor buffers. Intel Mac models with older system memory arrangements generally provide less memory bandwidth than current Apple Silicon systems. The effect becomes more visible when Sherpa, Ollama, Electron, the renderer, and the OS are active together.

The practical symptoms are:

- higher time-to-first-token from Ollama;
- delayed transcript finalization;
- audio playback starting later;
- UI animation or input feeling less responsive;
- more frequent model eviction and reloads when RAM is tight;
- lower sustained performance after the fan and thermal limits engage.

### No configured GPU inference

The Intel UHD GPU may be useful for display composition, but the current STT code explicitly selects the CPU provider. There is no evidence in this repository that Sherpa, Piper, or Ollama is configured with a working Intel GPU inference backend. Therefore, the GPU should not be counted as available speech acceleration.

Installing an arbitrary GPU package is not a guaranteed fix. It would require a compatible backend, a matching native build, supported operators for the selected model, and a benchmark showing that transfer overhead does not erase the benefit.

### Thermal throttling and sustained workloads

Speech-to-speech interaction is a sustained workload rather than a one-time computation. An Intel notebook can initially respond acceptably and then slow down as temperature, fan speed, power mode, and background processes change. Battery mode can make this more visible.

For this reason, a single cold-start measurement is not enough. Compare cold and warm runs, plugged-in and battery runs, and short and repeated sessions.

### Model size and language coverage

The tutor supports English, Hindi, Hinglish, Tamil, Telugu, Marathi, Gujarati, and Kannada aliases. This convenience creates a model-selection tradeoff: language-specific models may improve recognition for a speaker, but each model adds storage and potentially another memory footprint. Falling back to the English model can silently change behavior when a requested bundle is absent or incompatible.

Relevant fallback logic: [`packages/backend/stt-engine/sherpa.ts`](packages/backend/stt-engine/sherpa.ts).

## User-Visible Limitations

| Limitation | Likely cause on Intel Mac | User-visible result |
| --- | --- | --- |
| Slow first reply | Ollama model load plus STT finalization | Long pause after speaking |
| Slow replies after idle | Ollama unload/reload or OS memory pressure | First turn is much slower than later turns |
| Transcript appears late | Recording is finalized before the LLM request | No answer can begin until stop/finalization |
| Choppy UI or fan activity | Sherpa, Ollama, TTS, Electron, and renderer share CPU | Orb animation or typing feels uneven |
| Inconsistent recognition | Model/language fallback, microphone conditions, endpoint timing, or overload | Missing words or wrong language interpretation |
| Unexpected macOS voice | Piper binary/model unavailable | Voice quality and accent differ from the bundled voice |
| Slow language switching | Different model bundle must be located and loaded | Delay when changing speech language |
| Background work interrupts a turn | Summary/title requests share Ollama | Streaming response pauses or queues |

## Accuracy: What Is Known and What Is Not

The repository contains earlier notes reporting lower WER on Intel and attributing it to generic x86 kernels, quantization rounding, or floating-point differences. Those are useful hypotheses, but they are not sufficient proof.

Do not conclude that Intel inherently produces a fixed 2-3 percentage-point WER penalty until all of these are held constant:

- identical microphone input files;
- identical STT model directory and model files;
- identical sample rate and channel conversion;
- identical thread count and decoding method;
- identical language selection and fallback behavior;
- identical endpointing rules;
- repeated runs on a warm process;
- a labeled reference transcript and the same WER calculation.

The safest current explanation for observed accuracy problems is a combination of acoustic conditions, model-language mismatch, endpoint behavior, and system load. Architecture may contribute through timing and throughput, but CPU floating-point behavior should not be presented as the root cause without measurements.

See [`STT_ACCURACY_INTEL_ANALYSIS.md`](STT_ACCURACY_INTEL_ANALYSIS.md) for the earlier hypothesis set and [`apps/poc/sherpa-stt/wer-test.mjs`](apps/poc/sherpa-stt/wer-test.mjs) for the local WER test entry point.

## Practical Mitigations

### Highest-value changes

1. **Use a smaller Ollama model on Intel.** Prefer a tested 1.5B or 3B model for voice mode. Measure answer quality before making it the default.
2. **Keep one user-facing LLM request at a time.** Queue or defer session titles, summaries, and other background calls while voice interaction is active.
3. **Keep Piper truly platform-native.** Ship and verify a macOS-compatible Piper binary, matching voice model, config JSON, and phonemization data. Confirm that logs show Piper audio rather than fallback speech.
4. **Benchmark STT thread counts.** Test `STT_NUM_THREADS` values such as 2, 4, 6, and 8. More threads are not always faster when Ollama and Electron are also busy.
5. **Prefer the model that matches the speaker.** Compare English, Indian English, and Hinglish using the same labeled recordings. Do not choose only by file size.
6. **Reduce avoidable IPC overhead.** Base64 audio responses increase the represented payload size by roughly one third. Returning binary data through an appropriate Electron IPC path can reduce memory copying, though this is not likely to be the largest delay.

### Operational mitigations

- Run plugged in and use a high-performance power mode for benchmark sessions.
- Close browsers, IDE indexing, video calls, and other CPU-heavy applications before comparing runs.
- Warm the selected Ollama model before a teaching session when startup latency matters.
- Avoid changing models or languages during an active voice turn.
- Keep responses concise in voice mode so TTS has less text to synthesize and play.
- Log model selection, fallback selection, model-load time, STT finalization time, LLM time-to-first-token, total LLM time, TTS startup time, and playback duration.

### Changes that need validation before adoption

- Rebuilding native dependencies with `-march=native` may improve throughput on one Intel CPU but makes the binary less portable and does not guarantee better accuracy.
- GPU acceleration is not automatically available for Intel UHD graphics and may introduce unsupported operators or data-transfer overhead.
- Forcing INT8 is not automatically more accurate or faster on every Intel generation. Compare it with the full-precision model on the same corpus.
- Increasing thread counts can make the application feel worse by starving Ollama, Electron, or audio playback.

## Recommended Measurement Plan

Run the following matrix on the target Intel Mac:

| Dimension | Values |
| --- | --- |
| STT model | English, Indian English, Hinglish if complete and compatible |
| STT threads | 2, 4, 6, 8 |
| Ollama model | Installed 1.5B/3B candidate, then larger candidate |
| Process state | Cold start, warm model, repeated turns |
| Power | Plugged in, battery |
| Workload | STT only, full voice turn, full voice turn with background tasks |

Record at least:

- STT initialization time;
- audio duration;
- time from stop-recording to final transcript;
- real-time factor for STT: processing time divided by audio duration;
- Ollama time-to-first-token and total generation time;
- TTS startup and synthesis duration;
- total turn duration;
- peak memory and CPU usage;
- WER or CER against a labeled transcript;
- whether Piper or macOS fallback speech was used.

The most useful STT threshold is real-time factor. If it is greater than 1.0, the system takes longer to process audio than the audio lasts and cannot keep up in a continuously streaming design. In the current tap-to-talk flow, a value below 1.0 still does not remove finalization or LLM latency, but it identifies whether STT itself is a bottleneck.

Useful local checks include:

```bash
sysctl -n machdep.cpu.brand_string
sysctl -n hw.ncpu
sysctl -n hw.memsize
node -p 'process.arch'
find packages/backend/tts-engine -maxdepth 1 -type f -name 'piper*' -print
```

At runtime, verify the logs for:

```text
[Sherpa] Active model directory: ...
[Sherpa] Encoder: ...
[Sherpa] Online recognizer initialized
[TTS] Available check: bin=...
```

## Recommended Priority Order

1. Verify whether the Intel Mac is using Piper or macOS fallback speech.
2. Select and benchmark a small Ollama model for voice interactions.
3. Prevent background Ollama requests from competing with active voice turns.
4. Benchmark STT thread counts and model choices using labeled recordings.
5. Add a native macOS Piper asset if bundled offline TTS is required.
6. Only then investigate native rebuilds or GPU backends with before-and-after measurements.

## Bottom Line

The Intel Mac is limited less by one isolated speech bug than by the total cost of running several AI workloads locally. CPU-only Sherpa inference, potentially large Ollama models, TTS availability, shared memory bandwidth, thermal behavior, and background requests all accumulate in one interactive turn.

The offline design remains viable for an Intel Mac when the system is configured deliberately: use a modest LLM, keep background work out of the voice path, use a verified native TTS runtime, choose the correct STT model, and measure sustained rather than ideal cold-start performance. The architecture explains why the ceiling is lower than on Apple Silicon; controlled measurements are still required to quantify the exact gap for this device.

## Repository References

- [`packages/backend/stt-engine/README.md`](packages/backend/stt-engine/README.md)
- [`packages/backend/stt-engine/sherpa.ts`](packages/backend/stt-engine/sherpa.ts)
- [`packages/backend/tts-engine/README.md`](packages/backend/tts-engine/README.md)
- [`packages/backend/tts-engine/index.ts`](packages/backend/tts-engine/index.ts)
- [`apps/renderer/public/stt-worklet.js`](apps/renderer/public/stt-worklet.js)
- [`apps/renderer/src/pages/useVoiceMode.ts`](apps/renderer/src/pages/useVoiceMode.ts)
- [`apps/desktop/src/main/index.ts`](apps/desktop/src/main/index.ts)
- [`packages/backend/ai-tutor/src/index.ts`](packages/backend/ai-tutor/src/index.ts)
- [`STT_ACCURACY_INTEL_ANALYSIS.md`](STT_ACCURACY_INTEL_ANALYSIS.md)
- [`system_issues_report.md`](system_issues_report.md)
- [`ollama_performance_analysis.md`](ollama_performance_analysis.md)