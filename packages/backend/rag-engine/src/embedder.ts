import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Model path resolution, mirroring section 6 of the STT implementation guide:
 *   1. explicit environment override
 *   2. package/development path
 *   3. packaged resourcesPath path
 * A fallback (letting transformers.js download from the HF hub) is only used
 * in dev, and is always logged loudly since it must not happen in a packaged,
 * offline app.
 */
function resolveModelDir(explicit?: string): { dir: string | null; source: string } {
  if (explicit && existsSync(explicit)) {
    return { dir: explicit, source: 'explicit option' };
  }

  const envOverride = process.env.RAG_EMBEDDING_MODEL_DIR;
  if (envOverride && existsSync(envOverride)) {
    return { dir: envOverride, source: 'RAG_EMBEDDING_MODEL_DIR' };
  }

  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const devPath = path.join(packageRoot, 'models', 'all-MiniLM-L6-v2');
  if (existsSync(devPath)) {
    return { dir: devPath, source: 'dev path' };
  }

  const packagedPath = process.resourcesPath
    ? path.join(process.resourcesPath, 'rag', 'all-MiniLM-L6-v2')
    : null;
  if (packagedPath && existsSync(packagedPath)) {
    return { dir: packagedPath, source: 'packaged resourcesPath' };
  }

  return { dir: null, source: 'none found' };
}

export interface EmbedderOptions {
  modelDir?: string;
  /** Model id used only for the remote-fallback path in dev; irrelevant once bundled locally. */
  hubModelId?: string;
}

export class Embedder {
  private extractor: any = null;
  private readonly hubModelId: string;
  private readonly explicitModelDir?: string;

  constructor(opts: EmbedderOptions = {}) {
    this.hubModelId = opts.hubModelId ?? 'Xenova/all-MiniLM-L6-v2';
    this.explicitModelDir = opts.modelDir;
  }

  /** Loads the ONNX session once. Call at app startup, same as recognizer warmup. */
  async warmup(): Promise<void> {
    if (this.extractor) return;

    const { pipeline, env } = await import('@xenova/transformers');
    const { dir, source } = resolveModelDir(this.explicitModelDir);

    if (dir) {
      // Fully offline: point transformers.js at the local model directory and
      // forbid any network fallback, matching the "local-first, no cloud" goal.
      env.allowRemoteModels = false;
      env.localModelPath = path.dirname(dir);
      const modelId = path.basename(dir);
      console.log(`[rag-engine] loading embedding model from ${source}: ${dir}`);
      this.extractor = await pipeline('feature-extraction', modelId, {
        quantized: true,
      });
    } else {
      // Dev-only fallback: download once, then cache under transformers.js's
      // default cache dir. This must never be reached in a packaged build —
      // log loudly so it's impossible to miss in dev testing.
      console.warn(
        `[rag-engine] WARNING: no local embedding model found, falling back to ` +
          `remote download of "${this.hubModelId}". This will fail offline and ` +
          `must not happen in a packaged build. Run the model bundling step.`
      );
      this.extractor = await pipeline('feature-extraction', this.hubModelId, {
        quantized: true,
      });
    }
  }

  private assertReady() {
    if (!this.extractor) {
      throw new Error('Embedder.warmup() must be called before embed()');
    }
  }

  /** Embeds a single string. Mean-pooled, L2-normalized -> plain cosine works directly. */
  async embed(text: string): Promise<Float32Array> {
    this.assertReady();
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    return Float32Array.from(output.data as Float32Array);
  }

  /**
   * Embeds many strings. Used only at ingest time (batch), never in the
   * real-time voice loop, so throughput matters more than per-call latency here.
   */
  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    this.assertReady();
    const results: Float32Array[] = [];
    // transformers.js batches internally reasonably well for short inputs;
    // keep an explicit loop with a small concurrency cap to bound peak RAM
    // on constrained devices rather than embedding hundreds of chunks at once.
    const CONCURRENCY = 4;
    for (let i = 0; i < texts.length; i += CONCURRENCY) {
      const batch = texts.slice(i, i + CONCURRENCY);
      const embedded = await Promise.all(batch.map((t) => this.embed(t)));
      results.push(...embedded);
    }
    return results;
  }
}
