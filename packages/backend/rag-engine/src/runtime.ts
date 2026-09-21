import { RagEngine } from './index.js';

let engine: RagEngine | null = null;
let warmupPromise: Promise<void> | null = null;
let warmedUp = false;

export function initializeRagEngine(dataDir: string, modelDir?: string): RagEngine {
  if (!engine) {
    engine = new RagEngine({ dataDir, modelDir });
  }
  return engine;
}

export async function warmupRagEngine(): Promise<void> {
  if (!engine) throw new Error('initializeRagEngine() must be called first');
  if (!warmupPromise) {
    warmupPromise = engine.warmup().then(
      () => {
        warmedUp = true;
      },
      (err) => {
        // Clear the cached promise so a future call can retry warmup
        // instead of forever awaiting the same rejected promise.
        warmupPromise = null;
        throw err;
      }
    );
  }
  await warmupPromise;
}

/**
 * Returns the RAG engine only if it has been successfully warmed up.
 * Callers can safely treat a null return as "RAG is unavailable" without
 * risking an ONNX "Session not initialized" crash.
 */
export function getRagEngine(): RagEngine | null {
  return warmedUp ? engine : null;
}