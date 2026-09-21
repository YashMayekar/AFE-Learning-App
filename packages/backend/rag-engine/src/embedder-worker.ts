/**
 * Runs the @xenova/transformers embedding model in an isolated Node process.
 *
 * Why: @xenova/transformers bundles its own onnxruntime-node@1.14.x native
 * addon, which is a *different* build than the onnxruntime-node version used
 * by the STT engine. Loading two different onnxruntime-node native addons in
 * the same Electron process corrupts shared native state (observed as
 * "Session was not initialized" mid-run, even though the session loaded
 * successfully). Forcing both to the same package version isn't viable
 * either: @xenova/transformers@2.17.2's own Tensor implementation is pinned
 * to the older onnxruntime-node wire format and breaks against 1.23.2's
 * backend. Running the embedder in its own process avoids both problems.
 *
 * Spawned via child_process.fork() with ELECTRON_RUN_AS_NODE=1 so this runs
 * as plain Node even when the parent is the Electron binary.
 */
import { Embedder } from './embedder.js';

type WorkerRequest =
  | { type: 'warmup'; reqId: number; modelDir?: string }
  | { type: 'embed'; reqId: number; text: string }
  | { type: 'embedBatch'; reqId: number; texts: string[] };

type WorkerResponse =
  | { type: 'warmup:ok'; reqId: number }
  | { type: 'embed:ok'; reqId: number; vector: Float32Array }
  | { type: 'embedBatch:ok'; reqId: number; vectors: Float32Array[] }
  | { type: 'error'; reqId: number; message: string };

let embedder: Embedder | null = null;

function reply(msg: WorkerResponse) {
  process.send?.(msg);
}

process.on('message', async (msg: WorkerRequest) => {
  try {
    if (msg.type === 'warmup') {
      embedder = new Embedder({ modelDir: msg.modelDir });
      await embedder.warmup();
      reply({ type: 'warmup:ok', reqId: msg.reqId });
    } else if (msg.type === 'embed') {
      const vector = await embedder!.embed(msg.text);
      reply({ type: 'embed:ok', reqId: msg.reqId, vector });
    } else if (msg.type === 'embedBatch') {
      const vectors = await embedder!.embedBatch(msg.texts);
      reply({ type: 'embedBatch:ok', reqId: msg.reqId, vectors });
    }
  } catch (err) {
    reply({ type: 'error', reqId: msg.reqId, message: err instanceof Error ? err.message : String(err) });
  }
});

// Exit cleanly if the parent process disconnects (e.g. app quit) instead of lingering.
process.on('disconnect', () => process.exit(0));
