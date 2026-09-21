import { existsSync } from 'node:fs';
import path from 'node:path';

// hnswlib-node has no first-party types; keep the surface we use narrow and typed locally.
type HierarchicalNSWCtor = new (space: 'cosine' | 'l2' | 'ip', dim: number) => HNSWIndex;
interface HNSWIndex {
  initIndex(maxElements: number, M?: number, efConstruction?: number, randomSeed?: number): void;
  readIndexSync(path: string): void;
  writeIndexSync(path: string): void;
  resizeIndex(newMaxElements: number): void;
  getMaxElements(): number;
  getCurrentCount(): number;
  addPoint(point: number[] | Float32Array, label: number): void;
  markDelete(label: number): void;
  setEf(ef: number): void;
  searchKnn(query: number[] | Float32Array, k: number): { distances: number[]; neighbors: number[] };
}

export class VectorIndex {
  private index: HNSWIndex | null = null;
  private readonly indexPath: string;
  private readonly dim: number;
  private readonly maxElementsHint: number;

  constructor(dataDir: string, dim: number, maxElementsHint = 20_000) {
    this.indexPath = path.join(dataDir, 'rag-vectors.hnsw');
    this.dim = dim;
    this.maxElementsHint = maxElementsHint;
  }

  /** Loads the persisted index if present, otherwise initializes an empty one. */
  async warmup(): Promise<void> {
    const module = (await import('hnswlib-node')) as unknown as {
      default?: { HierarchicalNSW: HierarchicalNSWCtor };
      HierarchicalNSW?: HierarchicalNSWCtor;
    };
    const HierarchicalNSW = module.HierarchicalNSW ?? module.default?.HierarchicalNSW;
    if (!HierarchicalNSW) throw new Error('hnswlib-node HierarchicalNSW export is unavailable');
    this.index = new HierarchicalNSW('cosine', this.dim);

    if (existsSync(this.indexPath)) {
      this.index.readIndexSync(this.indexPath);
      console.log(`[rag-engine] loaded HNSW index (${this.index.getCurrentCount()} vectors)`);
    } else {
      this.index.initIndex(this.maxElementsHint, 16, 200, 100);
      console.log('[rag-engine] initialized empty HNSW index');
    }
  }

  private assertReady(): HNSWIndex {
    if (!this.index) throw new Error('VectorIndex.warmup() must be called first');
    return this.index;
  }

  private ensureCapacity(additional: number) {
    const idx = this.assertReady();
    const needed = idx.getCurrentCount() + additional;
    if (needed > idx.getMaxElements()) {
      // Grow in reasonably large steps to avoid frequent, expensive resizes
      // when ingesting one large document after another.
      idx.resizeIndex(Math.max(needed, idx.getMaxElements() * 2));
    }
  }

  addVectors(items: { label: number; vector: Float32Array }[]) {
    const idx = this.assertReady();
    this.ensureCapacity(items.length);
    for (const { label, vector } of items) {
      idx.addPoint(Array.from(vector), label);
    }
  }

  /** Soft-deletes a chunk's vector (HNSW doesn't support true removal without a rebuild). */
  markDeleted(label: number) {
    this.assertReady().markDelete(label);
  }

  search(query: Float32Array, k: number): { id: number; distance: number }[] {
    const idx = this.assertReady();
    if (idx.getCurrentCount() === 0) return [];
    const effectiveK = Math.min(k, idx.getCurrentCount());
    idx.setEf(Math.max(64, effectiveK * 4)); // recall/latency tradeoff knob
    const { distances, neighbors } = idx.searchKnn(Array.from(query), effectiveK);
    return neighbors.map((id, i) => ({ id, distance: distances[i] }));
  }

  persist() {
    this.assertReady().writeIndexSync(this.indexPath);
  }
}
