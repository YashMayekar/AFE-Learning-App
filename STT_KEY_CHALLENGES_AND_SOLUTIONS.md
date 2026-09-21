# Key STT Challenges and How They Were Solved

## Purpose

This document records the main engineering challenges encountered while making
Sherpa Streaming and SraVaani Live/Offline work in the offline learning app,
especially on an Intel macOS computer. It explains the symptoms, the actual
technical cause, the solution implemented, the evidence behind the solution,
and the limitations that remain.

The challenges were not limited to model inference. They crossed model
compatibility, audio capture, native binaries, Electron IPC, UI behavior,
latency, packaging, repository size, language selection, and the larger local
AI voice loop.

## Inherited Baseline Before This Work

Before commit `6d3af815b85c120efa766acba99a8a8b9b62d561`, the repository
already contained the original Whisper pipeline, the microphone AudioWorklet,
Electron STT IPC, the local voice loop, and the initial Sherpa migration. Those
commits are the baseline for the work documented here. They are described only
to explain the starting conditions and are not counted as changes made in this
phase.

## 1. The Intel macOS Runtime Was Hard to Diagnose

### Challenge

The target computer was an Intel Mac, while much of the local AI ecosystem is
commonly tested on Apple Silicon. Sherpa-ONNX uses architecture-specific native
bindings. The Intel machine needs the Darwin x64 binary, not the arm64 binary
used on Apple Silicon.

The inherited STT implementation made it difficult to tell whether a problem
was caused by the native module, CPU throughput, model choice, audio timing, or
the larger local AI workload. The practical symptoms included slow startup,
uncertain accuracy differences, and no clear way to inspect the loaded native
binary or available CPU features.

### Solution

The Intel-specific investigation in commit `6d3af81` added platform diagnostics
and explicit CPU configuration. The work verified or exposed:

- Node platform and architecture;
- the loaded `sherpa-onnx.node` binary;
- Sherpa package version;
- CPU model and core count;
- AVX2, AVX-512, and SSE4.1 support;
- system memory and GPU information;
- available model directories and encoder files.

The application also configured ONNX Runtime environment variables in the
Electron main process:

```text
ORT_INTRA_OP_NUM_THREADS=10
ORT_INTER_OP_NUM_THREADS=1
```

Sherpa's own thread count became configurable through `STT_NUM_THREADS`, and
its provider was explicitly set to `cpu`.

The supporting tools were:

- `stt-diagnose.sh` for a shell-based Intel environment report;
- `stt-optimize.mjs` for Node-based CPU, ONNX, package, and thread checks;
- `STT_ACCURACY_INTEL_ANALYSIS.md` for architecture hypotheses;
- `MACOS_INTEL_OFFLINE_SPEECH_LIMITATIONS.md` for whole-pipeline constraints.

### Result

Sherpa could be tested as an Intel-native CPU workload instead of being treated
as an unexamined cross-platform dependency. The diagnostic output made it
possible to distinguish a missing native binding from a slow or inaccurate
model.

### Important conclusion

The work established a real performance difference between Intel x64 and Apple
Silicon execution paths, but it did not prove that Intel floating-point
behavior alone causes a universal accuracy penalty. Accuracy must be compared
with the same recordings, models, sample conversion, thread settings,
endpointing rules, and warm/cold state.

### Remaining tradeoff

The current implementation does not provide a validated Intel GPU inference
backend. Sherpa and the direct SraVaani live engine are CPU-based. Rebuilding
with `-march=native` or adding a GPU provider could improve throughput, but each
would need a compatible native build and before/after benchmarks.

## 2. The Inherited Whisper/Sherpa Path Had Runtime and Packaging Constraints

### Challenge

The pre-existing STT path had several limitations that constrained the work:

- inference depended on disk I/O;
- every recognition cycle depended on process startup;
- partial text was delayed until enough audio had accumulated;
- only one process could run at a time;
- the runtime depended on a bundled executable and model format;
- platform-specific binaries and assets complicated packaging.

The original implementation was useful as a baseline, but it was not a native
streaming recognizer. The application wanted partial captions while the user
was speaking, not repeated offline recognition of temporary files.

These constraints were inherited at the start of this phase. The work in this
document did not claim the original Whisper migration; instead, it made the
existing Sherpa path more usable on Intel macOS and extended the runtime with
SraVaani engines.

### Solution

The later work added explicit model selection, model availability checks,
runtime diagnostics, startup warmup, recognizer caching, packaging lookup, and
separate SraVaani integrations. This allowed the existing STT boundary to
support multiple model families without hiding their differences.

### Result

The inherited Sherpa streaming path became observable, configurable, and
usable as the foundation for Intel-specific tuning and SraVaani integration.

### Remaining tradeoff

The application still retains offline model options for compatibility and
language coverage. SraVaani 1.0 is intentionally final-only because its
integration invokes a Python inference script after recording completes.

## 3. Selecting the Correct Model Instead of Trusting Labels

### Challenge

The visible model choice and the model actually loaded could diverge. A UI
label such as Indian English was not enough to guarantee that the runtime used
the intended model directory. Older environment-based selection and language
fallbacks could point to a different model.

This was especially important for Indian English and Hinglish, where a generic
English model could load successfully but produce worse recognition.

### Solution

The model system was changed to use stable IDs:

```text
english
indian-english
zero-stt-hinglish
sravaani-onnx
sravaani-live
```

The runtime now:

- normalizes model aliases;
- normalizes language aliases;
- resolves explicit model directory candidates;
- checks required model files before declaring an option available;
- logs the selected model and active model directory;
- supports `STT_MODEL`, `SHERPA_STT_MODEL_DIR`,
  `SRAVAANI_MODEL_DIR`, and `SRAVAANI_LIVE_MODEL_DIR` overrides;
- prevents model changes during active recording;
- warms the newly selected model when appropriate.

The Indian-English path explicitly resolves the Indian-English Zipformer model
and maps the effective language to the Hindi-English language family where
needed.

### Result

The UI selection became authoritative and observable. Logs identify the model,
language, encoder, decoder, joiner, token file, and runtime recognizer.

### Remaining tradeoff

A missing compatible model can still trigger the standard Sherpa fallback to
English. This is preferable to a crash, but it can hide a model provisioning
problem unless the warning logs are inspected.

## 4. Preserving the First Word of an Utterance

### Challenge

Early tests exposed a first-word-skipping problem. The recognizer could begin
processing after the utterance had already started, especially when recording
started and audio delivery raced with UI state changes or when the user stopped
very quickly.

This is a high-impact problem because the first word often contains the user's
intent, language cue, or question subject.

### Solution

The audio/session path was adjusted in the accuracy improvement commits. The
renderer worklet and streaming hook were changed so initial audio samples are
preserved and delivered with the expected timing. The model selection work also
moved the application toward the Indian-English model for the target speakers.

The implementation added focused WER entry points for both the normal and
Indian-English paths:

- `apps/poc/sherpa-stt/wer-test.mjs`;
- `apps/poc/sherpa-stt/wer-test-indian.mjs`.

### Result

The first-word issue was addressed at the audio/session boundary rather than
being treated only as a language-model accuracy problem. The Indian-English
model could also be evaluated against the intended speaker population.

### Remaining tradeoff

First-word preservation still depends on microphone permission timing, the
AudioWorklet startup, user behavior, and minimum recording duration. It should
be checked with recorded reference audio, not only with a single live test.

## 5. Partial Transcripts Were Repeated or Corrupted

### Challenge

Streaming recognizers return a growing hypothesis. For example, successive
results might be:

```text
hello
hello world
hello world again
```

Sending the complete growing result as a new append event would duplicate text
in the input. A recognizer can also return a duplicate result, a temporarily
shorter result, or a result whose prefix changed.

### Solution

The shared `computeStreamingDelta()` logic compares the previous and current
hypotheses and returns only newly recognized text. It handles:

- an empty previous result;
- identical text;
- normal prefix growth;
- a current result that is temporarily shorter;
- a changed common prefix.

The same behavior is used by Sherpa and the SraVaani live CTC decoder. A
focused test file, `sherpa.streaming-delta.test.ts`, covers duplicate and
append behavior.

### Result

The main process can send `stt:partial` events without repeatedly appending
old words to the tutor input. The live SraVaani decoder can maintain its own
full CTC hypothesis while exposing only the incremental delta to Electron.

### Remaining tradeoff

Simple common-prefix comparison is appropriate for the current UI contract,
but it is not a full hypothesis alignment algorithm. If a model frequently
revises words in the middle of a sentence, a richer edit/alignment strategy
would be needed.

## 6. Recording Could Stop Before the Recognizer Had Useful Audio

### Challenge

A microphone callback can deliver very small chunks. At 16 kHz, five chunks of
128 samples contain only 0.04 seconds of audio. If a keyup or click event stops
recording immediately, the recognizer may receive too little speech to emit a
final transcript.

The visible symptom was a recording UI that appeared to work but ended with
`No final transcription`.

### Solution

The recording lifecycle was hardened with:

- minimum useful recording-duration protection;
- sample-count and duration logging;
- explicit `stt:start` success acknowledgement;
- cleanup when microphone or recognizer startup fails;
- finalization through the recognizer's `finish()` method;
- reset of the stream without reloading the model.

The logs now report values such as:

```text
[STT] Captured samples=19968 durationMs=1248
[STT] Partial events generated=...
```

### Result

The application can distinguish a real recognition failure from an accidental
40-millisecond recording. The renderer no longer assumes that recording began
when the main process failed to initialize the recognizer.

### Remaining tradeoff

Minimum-duration protection adds a small delay when the user intentionally
speaks a very short command. That tradeoff is preferable to silently producing
an empty transcript in a hold-to-talk workflow.

## 7. Renderer and Main Process Recording State Could Diverge

### Challenge

The renderer controls microphone capture, while the Electron main process owns
the recognizer. A fire-and-forget IPC call can leave the renderer showing an
active microphone even when model construction failed. Conversely, a stop event
can arrive while the recognizer is still processing an earlier audio chunk.

### Solution

The IPC lifecycle was made explicit:

- `stt:start` returns a boolean success result;
- the main process tracks `isRecording`;
- empty chunks are rejected;
- the stop handler awaits `finish()`;
- errors send an empty final result rather than leaving the UI hanging;
- `finally` blocks reset recording state and counters;
- the renderer releases AudioWorklet, microphone tracks, and AudioContext
  resources on failure.

For live SraVaani, the chunk handler became asynchronous and awaits
`processAudio()` so the caller observes the recognizer's actual completion
boundary.

### Result

The renderer and main process have a more reliable start/process/stop contract,
and failure states return the UI to a usable condition.

### Remaining tradeoff

IPC still carries frequent audio messages. The system is correct but could be
further optimized by reducing message overhead or using a more direct binary
transport.

## 8. Model Initialization Made the First Recording Feel Slow

### Challenge

Sherpa model construction loads encoder, decoder, joiner, and token assets.
On an Intel Mac, this can take noticeable time. If construction happens inside
`stt:start`, the user presses the microphone shortcut and waits before
recording appears active.

### Solution

The runtime introduced two complementary changes:

1. Recognizer caching keyed by selected model and effective language.
2. Startup/model-change warmup through `warmupSherpaSTT()`.

The model object stays alive, while each recording receives a fresh stream and
reset decoder state. This avoids reusing audio from a previous utterance while
avoiding repeated ONNX model construction.

### Result

The first application launch may pay initialization cost, but subsequent
recordings can reuse the loaded recognizer. Switching models explicitly warms
the selected model before the next recording.

### Remaining tradeoff

Warmup increases startup work and memory usage. Caching several model families
can also increase memory pressure, which matters on lower-end Intel machines.

## 9. Too Many Threads Could Hurt the Whole Voice Loop

### Challenge

STT, Ollama, Electron, the renderer, and TTS all run locally. More STT threads
can improve isolated inference while making the complete tutor feel worse by
competing with the local LLM, audio playback, and UI.

There were also separate thread controls: ONNX Runtime environment variables,
Sherpa's `numThreads`, and the direct SraVaani ONNX session's
`intraOpNumThreads`.

### Solution

Threading was made visible and configurable rather than assumed to be optimal:

- `ORT_INTRA_OP_NUM_THREADS` and `ORT_INTER_OP_NUM_THREADS` are set at startup;
- Sherpa reads `STT_NUM_THREADS`;
- SraVaani live accepts a thread count and defaults to a smaller value;
- `stt-optimize.mjs` reports available CPU cores and suggests a starting point;
- the Intel documentation recommends measuring several thread counts with the
  full voice loop, not only STT in isolation;
- local Ollama work was considered alongside STT through queueing and deferred
  background work.

### Result

The system can be benchmarked across thread settings, and the application no
longer treats maximum parallelism as automatically best.

### Remaining tradeoff

The best thread count depends on the model, CPU temperature, Ollama model, and
background workload. There is no universal Intel setting.

## 10. Sherpa's NeMo CTC Adapter Did Not Match SraVaani Live

### Challenge

SraVaani live was exported as a cache-aware NeMo CTC ONNX graph. It was
 tempting to reuse Sherpa-ONNX's built-in `nemoCtc` integration, but the
export's input/output cache layout did not match Sherpa's assumptions.

This mismatch affected more than model loading. It included frontend behavior,
cache shapes, chunk scheduling, output names, and the meaning of the returned
log probabilities.

### Solution

The live implementation bypassed Sherpa's NeMo adapter and ported the
validated Python reference behavior directly to TypeScript using
`onnxruntime-node`.

The new engine explicitly implements:

- a causal NeMo-compatible mel frontend;
- 128-dimensional mel features;
- fixed chunk and lookback behavior;
- cache tensor initialization;
- cache tensor updates after every ONNX step;
- output-name validation;
- greedy CTC decoding;
- word-piece normalization;
- streaming text delta calculation;
- final partial-step flushing.

### Result

SraVaani 0.5 live became a separate recognizer that can share the application's
IPC and UI contract without pretending to be a Sherpa transducer.

### Remaining tradeoff

The cache metadata is tied to a validated export preset. Every new latency
preset needs its own verified cache dimensions and streaming configuration.

## 11. The SraVaani Live Cache Could Be Corrupted by Concurrent Chunks

### Challenge

Microphone chunks can arrive faster than one ONNX graph execution completes.
The live recognizer updates shared cache tensors after each step. If two calls
run concurrently, the second call can read stale or partially updated cache
state, destroying the sequence of the streaming model.

### Solution

`SravaaniLiveOnnx` introduced a Promise queue. Every `processAudio()` and
`finish()` call is appended to one chain, so cache mutation happens in order.
The desktop IPC chunk handler was changed to `async` and awaits the returned
Promise. Existing synchronous recognizers remain compatible because `await`
accepts both ordinary values and Promises.

### Result

The cache-aware engine has a serialized state transition model. Rapid IPC
chunks cannot overlap ONNX inference against the same cache.

### Remaining tradeoff

Serialization can expose latency when the recognizer cannot keep up with the
arrival rate. It protects correctness, but it does not make the graph faster.
The remaining solution space is model/export optimization, thread tuning,
chunk scheduling, or a lower-latency export.

## 12. The Tail of the Utterance Could Be Lost

### Challenge

A streaming engine normally waits for a complete chunk before running the
model. When recording stops, the last audio segment may contain fewer frames
than a normal step. Simply stopping at the last complete step would discard the
end of the user's sentence.

### Solution

The SraVaani live engine has an explicit `finish()` path that:

1. flushes the mel frontend;
2. runs all remaining complete steps;
3. runs one final fixed-size step for the remaining partial audio;
4. zero-pads the missing frames;
5. returns the accumulated decoded text.

### Result

The final word or syllable at the end of a recording is included in the
recognizer's final hypothesis whenever the model can decode it.

### Remaining tradeoff

Zero-padding is a model-compatible flush strategy, not a guarantee of perfect
end-of-utterance accuracy. Endpointing and a longer trailing context can still
change the final result.

## 13. Reproducing NeMo's Frontend Without Python at Runtime

### Challenge

The live ONNX graph expects features produced by a particular NeMo frontend.
Passing raw PCM directly, or using Sherpa's ordinary frontend, would produce
inputs with different framing, normalization, or feature dimensions.

The desired live path also needed to avoid requiring PyTorch/NeMo at runtime on
the desktop application.

### Solution

`StreamingMelFrontend` was implemented as a causal TypeScript port. It keeps
sample state across calls and reproduces the required configuration:

- 16 kHz sample rate;
- 512-point FFT;
- 400-sample window;
- 160-sample stride;
- Hann window;
- 128 mel features;
- per-feature normalization;
- buffered final flush.

The implementation emits complete frames incrementally, while
`MelFrameBuffer` provides indexed lookback slices and front zero-padding.

### Result

The live engine can run through `onnxruntime-node` without importing NeMo or
PyTorch in the desktop runtime.

### Remaining tradeoff

A hand-ported frontend must remain numerically compatible with the reference
export. It requires validation against the Python implementation whenever the
export configuration changes.

## 14. CTC Decoding Required Different State Than Sherpa Transducer Decoding

### Challenge

SraVaani live uses CTC output frames and a token vocabulary, while Sherpa's
standard path uses a transducer recognizer. CTC decoding needs blank handling
and repeated-token suppression across frame and chunk boundaries.

If the previous token is forgotten at a chunk boundary, a repeated token can
be emitted twice. If the blank ID is wrong, output can become mostly noise.

### Solution

The live engine added `StreamingCtcDecoder` with state for:

- the previous token ID;
- accumulated token pieces;
- the CTC blank ID;
- word-piece conversion from U+2581 to spaces.

The decoder state is reset for each recording, not for each audio chunk. The
highest token ID from the loaded token map is used as the blank ID for this
export's vocabulary.

### Result

CTC output remains continuous across streaming chunks and is transformed into
normal text before partial deltas are sent through IPC.

### Remaining tradeoff

The blank-ID assumption is export-specific. A new vocabulary format should
supply and validate its blank ID explicitly rather than relying on the highest
ID convention.

## 15. Offline SraVaani Needed Python Process and Temporary WAV Management

### Challenge

SraVaani 1.0 was available through a Python ONNX inference script rather than
as a direct Node streaming API. The desktop application still needed to expose
it as one of the selectable offline engines.

The integration also had to avoid leaving temporary recordings on disk after
inference.

### Solution

`SravaaniOnnxSTT` provides the same start/process/finish lifecycle as the other
engines while adapting internally:

- `start()` clears the sample buffer;
- `processAudio()` buffers Float32 samples;
- `finish()` writes a temporary WAV file;
- the configured Python executable runs the CTC inference script;
- the `Transcription:` output is parsed;
- a `finally` block removes the temporary directory;
- `SRAVAANI_PYTHON`, `PYTHON`, and `SRAVAANI_MODEL_DIR` support environment
  configuration.

The required packages are recorded in `requirements-sravaani.txt`.

### Result

SraVaani 1.0 works as an offline final-transcript engine through the same
Electron model-selection and finalization path.

### Remaining tradeoff

It is not a partial-transcript engine. Startup and finalization latency include
Python process invocation and complete-recording inference.

## 16. Large Model Files Made Git and Packaging Difficult

### Challenge

Speech models and native assets are large. Keeping them in Git made commits,
clones, and branch operations expensive. Removing them entirely, however,
caused runtime directory assumptions and model resolution to fail.

Packaging created a second problem: a model could work in development but be
missing from the standalone Electron installer.

### Solution

The model-asset strategy was separated into three parts:

1. Remove large STT model weights from normal Git storage.
2. Keep expected directories with `.gitkeep` files.
3. Resolve models from development paths, configured overrides, and packaged
   `resourcesPath` locations.

The live SraVaani export was explicitly included in Electron packaging, and
runtime checks require `model.onnx` plus `tokens.txt`. Sherpa model paths,
SraVaani offline paths, and live paths each have availability checks.

### Result

The repository stays manageable while retaining a predictable model layout.
Development and packaged applications have explicit lookup paths instead of
assuming that the current working directory is the only source of assets.

### Remaining tradeoff

A fresh checkout still needs model provisioning. A correct code checkout alone
does not contain every model weight required for every model option.

## 17. Packaging Native Modules Across Platforms

### Challenge

Electron packages native dependencies differently from ordinary TypeScript.
The application needed the correct Sherpa/ONNX native binary for the target
platform, and the installer needed the correct model/runtime assets. A setup
that worked with `pnpm dev` could still fail after packaging.

### Solution

The project added and corrected:

- native package declarations and type definitions;
- Electron builder asset entries;
- postinstall native rebuild behavior;
- packaged-resource lookup;
- cross-platform smoke validation;
- STT README guidance for development and installer assets.

The runtime logs platform, architecture, version, and model paths during
startup, which makes packaged failures easier to diagnose.

### Result

Native STT support became part of the build and installer design rather than an
implicit development dependency.

### Remaining tradeoff

Every target platform still needs its own native-module and asset validation.
A build passing on Intel macOS does not automatically prove that Windows,
Linux, or Apple Silicon packaging is correct.

## 18. The UI Needed a Better Recording Interaction

### Challenge

The original voice-mode overlay introduced extra state and could make the
recording interaction feel disconnected from the tutor input. Users needed a
quick way to speak while keeping the resulting text in context.

### Solution

The relevant tutor flow moved to hold-to-talk `Ctrl+Space`:

1. hold `Ctrl+Space` to start;
2. speak while holding;
3. release to stop;
4. show partial text directly in the input;
5. submit the completed input normally.

The UI shows recording state, disables recording while the AI is generating,
and cleans up keyboard listeners.

### Result

Speech and typing share one input surface, and partial recognition is visible
without a full-screen voice overlay.

### Remaining tradeoff

Keyboard shortcuts need careful handling across operating systems and focused
input elements. The shortcut behavior should continue to be tested on the
actual deployment platforms.

## 19. The Full Offline Voice Loop Had Multiple Latency Sources

### Challenge

It was tempting to attribute every delay to STT. In reality, a complete local
turn may include:

```text
recording -> STT finalization -> Ollama model loading/generation -> TTS -> playback
```

On Intel hardware, all these stages compete for CPU, memory, and thermal headroom.
A larger Ollama model or a missing Piper binary can dominate the perceived
latency even when Sherpa is functioning correctly.

### Solution

The investigation documented the complete pipeline and separated measurements:

- STT initialization time;
- time from stop to final transcript;
- STT real-time factor;
- Ollama time to first token and total generation time;
- TTS startup/synthesis duration;
- total turn time;
- CPU and memory usage;
- whether Piper or macOS fallback speech was used.

The application also introduced STT warmup, recognizer caching, thread
configuration, and local AI queue considerations. Background title/summary
work was treated as a possible source of contention rather than being allowed
to obscure the STT diagnosis.

### Result

The project gained a system-level troubleshooting method instead of assuming
that STT was the only bottleneck.

### Remaining tradeoff

The local voice loop remains hardware-sensitive. A smaller LLM, fewer
background tasks, and a native Piper asset may improve the complete experience
more than further STT changes.

## 20. Testing Recognition Quality Was Harder Than Testing Whether It Loaded

### Challenge

A recognizer can initialize successfully and still perform poorly for the
intended speaker, language, or accent. Intel-versus-Apple-Silicon comparisons
are especially easy to misinterpret when model files, audio conversion, or
endpoint rules differ.

### Solution

The project added WER-oriented proof-of-concept scripts and explicitly recorded
the variables that must remain constant:

- same audio corpus;
- same reference transcript;
- same model files;
- same sample rate and channel conversion;
- same decoding method;
- same endpoint rules;
- same thread settings;
- cold and warm process conditions;
- repeated runs.

The English and Indian-English WER scripts provide separate comparison points,
while runtime logs expose the selected model and active files.

### Result

Model and platform changes can be evaluated with a repeatable method instead
of relying only on subjective live impressions.

### Remaining tradeoff

The repository contains test entry points, but a complete benchmark matrix
still needs to be run on the target machines with labeled audio. Initialization
success is not the same as measured accuracy.

## Summary of the Solutions

The key solutions were architectural, not isolated patches:

| Problem | Main solution |
| --- | --- |
| Process-based Whisper latency | Direct Sherpa streaming inference |
| Intel native compatibility | Darwin x64 validation, CPU configuration, diagnostics |
| Wrong model selection | Stable IDs, aliases, availability checks, explicit paths |
| First word skipped | Audio/session timing fixes and model-specific evaluation |
| Duplicate partial text | Shared streaming-delta calculation and tests |
| Empty short recordings | Minimum-duration protection and sample logging |
| Renderer/main state mismatch | Acknowledged start, awaited stop, cleanup paths |
| Repeated model startup cost | Recognizer cache and warmup |
| Thread contention | Configurable thread counts and whole-pipeline measurement |
| Sherpa/SraVaani incompatibility | Direct `onnxruntime-node` SraVaani engine |
| Live cache races | Serialized Promise queue |
| Dropped final audio | Final partial step with zero padding |
| NeMo frontend dependency | Causal TypeScript mel frontend port |
| Offline SraVaani integration | Temporary WAV plus configurable Python runner |
| Large model files | External provisioning and retained empty directories |
| Installer failures | Explicit Electron packaging and packaged-resource lookup |
| Weak voice UX | Hold-to-talk input integration |
| Misdiagnosed latency | Separate STT, LLM, TTS, and total-turn measurements |

## Final Assessment

The central challenge was making several different speech systems behave like a
single dependable desktop feature. Sherpa Streaming, SraVaani Offline, and
SraVaani Live do not share the same model format, preprocessing, decoder, or
latency profile. The solution was to standardize the boundaries that should be
shared - 16 kHz mono audio, start/process/finish lifecycle, model selection,
partial/final IPC events, logging, and cleanup - while keeping each model's
internal inference contract separate.

The most difficult problem was SraVaani Live. Its exported NeMo CTC cache
layout did not fit Sherpa's built-in adapter, so the working solution required
porting the frontend, reproducing cache-aware chunking, decoding CTC outputs,
flushing trailing audio, and serializing asynchronous ONNX calls. That solved
compatibility and correctness, while leaving latency tuning as the next
engineering problem.

The Intel Mac work also changed the way performance was understood. The goal
was not merely to make a model load, but to identify whether failures came from
architecture, model selection, audio timing, IPC ordering, endpointing, local
LLM contention, packaging, or missing assets. That diagnostic framing is what
made the final system supportable rather than just demonstrable.
