# Latency Measurement Guide

The desktop application records latency samples for its local AI pipeline. Each
sample is emitted as one JSON log line prefixed with `[Latency]`; the existing
Electron logger persists those lines to `main.log`.

## Metrics

| Metric | What it measures |
| --- | --- |
| `stt.warmup` | Model creation and preload time. |
| `stt.start` | Time for a recording session to become ready. |
| `stt.audio_chunk` | Decode time for one incoming PCM chunk. |
| `stt.first_partial` | Time from recording start to the first transcript partial. |
| `stt.finalization` | Time from pressing stop to emitting the final transcript. |
| `rag.warmup` | Embedding model and vector-index initialization time. |
| `rag.query` | Retrieval time for a tutor question, including query embedding and search. |
| `llm.first_token` | Time from Ollama request to the first streamed token. |
| `llm.completion` | Full Ollama generation time. |
| `tts.synthesis` | Piper synthesis time for a sentence or explicit TTS request. |

Samples include an ISO timestamp, duration in milliseconds, success status, and
non-sensitive metadata such as model, stream mode, result count, audio duration,
and output character count. Transcript and prompt contents are not recorded by
the latency mechanism.

## Collecting Results

In development, the log is written to `dev-data/logs/main.log`. In a packaged
application, it is written to:

```text
~/Library/Application Support/OfflineLearningApp/logs/main.log
```

Run a realistic scenario several times, then extract raw samples with:

```sh
grep '^.*\[Latency\]' dev-data/logs/main.log
```

The current process also maintains the latest 1,000 samples in memory. Query its
aggregate p50/p95 report from renderer code with:

```ts
const summary = await ipc.getLatencySummary();
```

Each summary has `count`, `failures`, `minMs`, `p50Ms`, `p95Ms`, `maxMs`, and
`averageMs`. Use p50 to describe typical local performance and p95 to describe
the slower experience a student is likely to encounter. Report the device,
selected STT model, Ollama model, app version, and number of repeated runs
alongside these values.