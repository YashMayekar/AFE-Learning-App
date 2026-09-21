import { fork, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface RemoteEmbedderOptions {
  modelDir?: string;
}

/**
 * Proxies embedding calls to a forked child process (see embedder-worker.ts)
 * so the @xenova/transformers onnxruntime-node native addon never shares a
 * process with the STT engine's onnxruntime-node native addon.
 */
export class RemoteEmbedder {
  private child: ChildProcess | null = null;
  private nextReqId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: Error) => void }
  >();
  private readonly modelDir?: string;
  private warmedUp = false;

  constructor(opts: RemoteEmbedderOptions = {}) {
    this.modelDir = opts.modelDir;
  }

  private spawn(): ChildProcess {
    const workerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'embedder-worker.js');
    const child = fork(workerPath, [], {
      // Runs the Electron binary as plain Node so it doesn't pull in Electron's
      // module resolution/renderer machinery, just an isolated V8 + Node process.
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      serialization: 'advanced', // supports Float32Array over IPC
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });

    child.on('message', (msg: any) => {
      const pending = this.pending.get(msg.reqId);
      if (!pending) return;
      this.pending.delete(msg.reqId);
      if (msg.type === 'error') {
        pending.reject(new Error(msg.message));
      } else {
        pending.resolve(msg);
      }
    });

    child.on('exit', (code) => {
      const err = new Error(`rag-engine embedder worker exited (code ${code})`);
      for (const { reject } of this.pending.values()) reject(err);
      this.pending.clear();
      this.child = null;
      this.warmedUp = false;
    });

    return child;
  }

  private send(msg: Record<string, unknown>): Promise<any> {
    if (!this.child) throw new Error('RemoteEmbedder worker is not running');
    const reqId = this.nextReqId++;
    return new Promise((resolve, reject) => {
      this.pending.set(reqId, { resolve, reject });
      this.child!.send({ ...msg, reqId });
    });
  }

  async warmup(): Promise<void> {
    if (this.warmedUp) return;
    this.child = this.spawn();
    await this.send({ type: 'warmup', modelDir: this.modelDir });
    this.warmedUp = true;
  }

  private assertReady() {
    if (!this.warmedUp) throw new Error('RemoteEmbedder.warmup() must be called before embed()');
  }

  async embed(text: string): Promise<Float32Array> {
    this.assertReady();
    const res = await this.send({ type: 'embed', text });
    return Float32Array.from(res.vector);
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    this.assertReady();
    const res = await this.send({ type: 'embedBatch', texts });
    return (res.vectors as Float32Array[]).map((v) => Float32Array.from(v));
  }

  dispose(): void {
    this.child?.disconnect();
    this.child = null;
    this.warmedUp = false;
  }
}
