/**
 * Shared types for the RAG engine.
 *
 * Mirrors the STT engine's separation of concerns:
 *  - "Model/session state": embedder session, HNSW index, sqlite handle -> loaded once, cached.
 *  - "Per-call state": none. Query is stateless. Ingest mutates the persisted index/db, not memory.
 */

export interface DocumentInput {
  /** Stable, caller-assigned ID (e.g. content-engine's manifest item id, or file path hash). */
  id: string;
  /** Raw extracted text of the whole document. */
  text: string;
  /** Free-form metadata attached to every chunk derived from this doc. */
  metadata?: {
    title?: string;
    source?: string; // e.g. "Python-Tutorial.pdf"
    language?: string; // "en" | "hi" | "hinglish" etc, for future filtering
    [key: string]: unknown;
  };
}

export interface ChunkRecord {
  id: number; // sqlite rowid, also used as the HNSW label
  docId: string;
  text: string;
  seq: number; // position within the document, for citation / neighbor expansion
  metadata: Record<string, unknown>;
}

/** A chapter/topic/subtopic heading detected while chunking, with a doc-scoped stable id. */
export interface SectionRef {
  id: number;
  title: string;
}

/** Textbook hierarchy a chunk falls under, as detected at ingest time. Absent levels are undefined. */
export interface SectionPath {
  chapter?: SectionRef;
  topic?: SectionRef;
  subtopic?: SectionRef;
}

/** A distinct section (chapter/topic/subtopic) found in a document, for query-time lookup. */
export interface SectionInfo {
  docId: string;
  level: 'chapter' | 'topic' | 'subtopic';
  id: number;
  title: string;
  parentChapterId?: number;
  parentTopicId?: number;
}

export interface RetrievedChunk extends ChunkRecord {
  score: number; // fused RRF score, higher is better
  matchedVia: ('dense' | 'lexical' | 'section')[];
}

export interface RagQueryOptions {
  /** How many chunks to pull from each index before fusion. Default 10. */
  candidateK?: number;
  /** How many fused chunks to return after RRF + token budgeting. Default 5. */
  topK?: number;
  /** Hard cap on total context tokens (approx, whitespace-based). Default 700. */
  maxContextTokens?: number;
  /**
   * Hard cap on total context tokens when the query resolves to a whole
   * chapter/topic/subtopic (see SectionInfo) — this path intentionally
   * returns everything in the matched section, not just the top-K best
   * matching fragments, so it needs a much larger budget. Default 6000.
   */
  maxSectionTokens?: number;
  /** Restrict to a language tag if present in metadata. */
  language?: string;
}


export interface RagEngineOptions {
  /** Directory to store the sqlite db + hnsw index file. Must be writable (userData dir). */
  dataDir: string;
  /**
   * Directory containing the embedding model files (ONNX + tokenizer).
   * Resolution order documented in resolveModelDir() — mirrors the STT model
   * path resolution rules (env override -> dev path -> packaged resourcesPath).
   */
  modelDir?: string;
  /** Embedding vector dimensionality. Must match the model. Default 384 (MiniLM-L6 / bge-small). */
  embeddingDim?: number;
  /** Max elements the HNSW index is pre-allocated for. Grows in batches if exceeded. */
  maxElements?: number;
}

export interface ChunkOptions {
  /** Approx target chunk size in "tokens" (whitespace-word based approximation). Default 400. */
  targetTokens?: number;
  /** Overlap fraction between consecutive chunks. Default 0.15. */
  overlapRatio?: number;
}
