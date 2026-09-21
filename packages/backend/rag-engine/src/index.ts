import { mkdirSync } from 'node:fs';
import { chunkText } from './chunker.js';
import { RemoteEmbedder } from './remote-embedder.js';
import { reciprocalRankFusion } from './fusion.js';
import { RagStore } from './store.js';
import { VectorIndex } from './vector-index.js';
import type {
  DocumentInput,
  RagEngineOptions,
  RagQueryOptions,
  RetrievedChunk,
} from './types.js';

export type { DocumentInput, RagEngineOptions, RagQueryOptions, RetrievedChunk };
export { getRagEngine, initializeRagEngine, warmupRagEngine } from './runtime.js';

const DEFAULT_DIM = 384; // matches all-MiniLM-L6-v2 / bge-small-en-v1.5

export class RagEngine {
  private readonly embedder: RemoteEmbedder;
  private readonly store: RagStore;
  private readonly vectorIndex: VectorIndex;
  private warmed = false;

  constructor(opts: RagEngineOptions) {
    mkdirSync(opts.dataDir, { recursive: true });
    this.store = new RagStore(opts.dataDir);
    this.embedder = new RemoteEmbedder({ modelDir: opts.modelDir });
    this.vectorIndex = new VectorIndex(
      opts.dataDir,
      opts.embeddingDim ?? DEFAULT_DIM,
      opts.maxElements ?? 20_000
    );
  }

  /**
   * Loads the embedding model and opens/loads the persisted index.
   * Call once at app startup (same slot as STT recognizer warmup) —
   * never inside the request path.
   */
  async warmup(): Promise<void> {
    if (this.warmed) return;
    const start = Date.now();
    await Promise.all([this.embedder.warmup(), this.vectorIndex.warmup()]);
    this.warmed = true;
    console.log(`[rag-engine] warmup complete in ${Date.now() - start}ms`);
  }

  private assertWarm() {
    if (!this.warmed) {
      throw new Error('RagEngine.warmup() must be called before ingest()/query()');
    }
  }

  /**
   * Ingests (or re-ingests) one document: chunk -> embed -> persist.
   * This is the expensive path. It must run off the real-time voice loop —
   * call it from your content-sync pipeline when a document is added or
   * updated, or from a background ingestion queue, never from stt:final.
   */
  async ingest(doc: DocumentInput): Promise<{ chunkCount: number; ms: number }> {
    this.assertWarm();
    const start = Date.now();

    // Re-ingestion: drop old chunks/vectors for this doc id first so updates
    // don't leave stale duplicates in either index.
    const staleIds = this.store.deleteChunksForDoc(doc.id);
    for (const id of staleIds) this.vectorIndex.markDeleted(id);

    this.store.upsertDocument(doc);

    const rawChunks = chunkText(doc.text);
    if (rawChunks.length === 0) {
      return { chunkCount: 0, ms: Date.now() - start };
    }

    const vectors = await this.embedder.embedBatch(rawChunks.map((c) => c.text));

    const insertedIds: number[] = [];
    for (let i = 0; i < rawChunks.length; i++) {
      const chunk = rawChunks[i];
      const id = this.store.insertChunk(doc.id, chunk.seq, chunk.text, {
        ...doc.metadata,
        sectionTitle: chunk.sectionTitle,
      });
      insertedIds.push(id);
    }

    this.vectorIndex.addVectors(
      insertedIds.map((id, i) => ({ label: id, vector: vectors[i] }))
    );
    this.vectorIndex.persist();

    const ms = Date.now() - start;
    console.log(
      `[rag-engine] ingested "${doc.metadata?.title ?? doc.id}": ${rawChunks.length} chunks in ${ms}ms`
    );
    return { chunkCount: rawChunks.length, ms };
  }

  async removeDocument(docId: string): Promise<void> {
    this.assertWarm();
    const staleIds = this.store.deleteChunksForDoc(docId);
    for (const id of staleIds) this.vectorIndex.markDeleted(id);
    this.vectorIndex.persist();
  }

  /**
   * Real-time query path. Target cost: low tens of ms.
   *   1. embed the (short) query
   *   2. dense search (HNSW) + lexical search (BM25) in parallel
   *   3. fuse rankings with RRF (no reranker model)
   *   4. fetch chunk text, trim to a hard token budget
   */
  async query(text: string, opts: RagQueryOptions = {}): Promise<RetrievedChunk[]> {
    this.assertWarm();
    const candidateK = opts.candidateK ?? 10;
    const topK = opts.topK ?? 5;

    const [queryVector, lexicalIds] = await Promise.all([
      this.embedder.embed(text),
      Promise.resolve(this.store.lexicalSearch(text, candidateK)),
    ]);

    const denseResults = this.vectorIndex.search(queryVector, candidateK);

    const fused = reciprocalRankFusion([
      denseResults.map((r) => ({ id: r.id, source: 'dense' as const })),
      lexicalIds.map((id) => ({ id, source: 'lexical' as const })),
    ]);

    const topIds = fused.slice(0, topK).map((f) => f.id);
    const chunks = this.store.getChunksByIds(topIds);
    const fusedById = new Map(fused.map((f) => [f.id, f]));

    let results: RetrievedChunk[] = chunks.map((c) => ({
      ...c,
      score: fusedById.get(c.id)?.score ?? 0,
      matchedVia: fusedById.get(c.id)?.matchedVia ?? [],
    }));

    if (opts.language) {
      results = results.filter((r) => (r.metadata as any)?.language === opts.language);
    }

    return this.applyTokenBudget(results, opts.maxContextTokens ?? 700);
  }

  private applyTokenBudget(chunks: RetrievedChunk[], maxTokens: number): RetrievedChunk[] {
    const approxTokens = (s: string) => Math.ceil(s.trim().split(/\s+/).filter(Boolean).length / 0.75);
    const out: RetrievedChunk[] = [];
    let used = 0;
    for (const c of chunks) {
      const t = approxTokens(c.text);
      if (used + t > maxTokens && out.length > 0) break;
      out.push(c);
      used += t;
    }
    return out;
  }

  /**
   * Renders retrieved chunks into a prompt-ready context block with source
   * tags, ready to splice into your Ollama prompt in prompts.ts.
   */
  buildContextBlock(chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) return '';
    return chunks
      .map((c, i) => {
        const source = (c.metadata as any)?.title ?? (c.metadata as any)?.source ?? c.docId;
        const section = (c.metadata as any)?.sectionTitle;
        const tag = section ? `${source} — ${section}` : source;
        return `[${i + 1}] (${tag})\n${c.text}`;
      })
      .join('\n\n');
  }

  /** No per-call mutable state to clear — present for symmetry with SttEngine's contract. */
  reset(): void {}

  documentCount(): number {
    return this.store.documentCount();
  }
}
