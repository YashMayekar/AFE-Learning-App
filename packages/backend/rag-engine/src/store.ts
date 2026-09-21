import Database from 'better-sqlite3';
import path from 'node:path';
import type { ChunkRecord, DocumentInput } from './types.js';

export class RagStore {
  readonly db: Database.Database;

  constructor(dataDir: string) {
    this.db = new Database(path.join(dataDir, 'rag-index.db'));
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT,
        source TEXT,
        metadata_json TEXT,
        created_at INTEGER DEFAULT (strftime('%s','now'))
      );

      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        text TEXT NOT NULL,
        metadata_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON chunks(doc_id);

      -- External-content FTS5 table: stores no text itself, references chunks.text,
      -- kept in sync via triggers so BM25 ranking is always current.
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        text,
        content='chunks',
        content_rowid='id'
      );

      CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
        INSERT INTO chunks_fts(rowid, text) VALUES (new.id, new.text);
      END;

      CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
        INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES ('delete', old.id, old.text);
      END;

      CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
        INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES ('delete', old.id, old.text);
        INSERT INTO chunks_fts(rowid, text) VALUES (new.id, new.text);
      END;
    `);
  }

  upsertDocument(doc: DocumentInput) {
    this.db
      .prepare(
        `INSERT INTO documents (id, title, source, metadata_json)
         VALUES (@id, @title, @source, @metadata_json)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           source = excluded.source,
           metadata_json = excluded.metadata_json`
      )
      .run({
        id: doc.id,
        title: doc.metadata?.title ?? null,
        source: doc.metadata?.source ?? null,
        metadata_json: JSON.stringify(doc.metadata ?? {}),
      });
  }

  /** Deletes any existing chunks for a doc id — call before re-ingesting an updated document. */
  deleteChunksForDoc(docId: string): number[] {
    const ids = this.db
      .prepare(`SELECT id FROM chunks WHERE doc_id = ?`)
      .all(docId) as { id: number }[];
    this.db.prepare(`DELETE FROM chunks WHERE doc_id = ?`).run(docId);
    return ids.map((r) => r.id);
  }

  insertChunk(docId: string, seq: number, text: string, metadata: Record<string, unknown>): number {
    const info = this.db
      .prepare(`INSERT INTO chunks (doc_id, seq, text, metadata_json) VALUES (?, ?, ?, ?)`)
      .run(docId, seq, text, JSON.stringify(metadata));
    return Number(info.lastInsertRowid);
  }

  getChunksByIds(ids: number[]): ChunkRecord[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT id, doc_id, seq, text, metadata_json FROM chunks WHERE id IN (${placeholders})`)
      .all(...ids) as any[];
    const byId = new Map(
      rows.map((r) => [
        r.id,
        {
          id: r.id,
          docId: r.doc_id,
          seq: r.seq,
          text: r.text,
          metadata: JSON.parse(r.metadata_json ?? '{}'),
        } as ChunkRecord,
      ])
    );
    // Preserve caller's ordering (important: caller passes ids in fused-rank order).
    return ids.map((id) => byId.get(id)).filter((c): c is ChunkRecord => !!c);
  }

  /** BM25 lexical search. Returns chunk ids ranked best-first. */
  lexicalSearch(query: string, k: number): number[] {
    // FTS5 query syntax breaks on raw punctuation; keep it to a simple
    // OR-of-terms query rather than trying to expose full FTS5 syntax to callers.
    const terms = query
      .replace(/["*^]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `${t}*`);
    if (terms.length === 0) return [];
    const matchQuery = terms.join(' OR ');

    try {
      const rows = this.db
        .prepare(
          `SELECT rowid AS id, bm25(chunks_fts) AS rank
           FROM chunks_fts
           WHERE chunks_fts MATCH ?
           ORDER BY rank
           LIMIT ?`
        )
        .all(matchQuery, k) as { id: number; rank: number }[];
      return rows.map((r) => r.id);
    } catch {
      // Malformed query terms (rare, edge-case punctuation) -> no lexical matches
      // rather than throwing and breaking the whole retrieval call.
      return [];
    }
  }

  documentCount(): number {
    return (this.db.prepare(`SELECT COUNT(*) AS c FROM documents`).get() as any).c;
  }

  close() {
    this.db.close();
  }
}
