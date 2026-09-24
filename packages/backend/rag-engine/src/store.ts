import Database from 'better-sqlite3';
import path from 'node:path';
import type { ChunkRecord, DocumentInput, SectionInfo, SectionPath } from './types.js';

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
        metadata_json TEXT,
        chapter_id INTEGER,
        chapter_title TEXT,
        topic_id INTEGER,
        topic_title TEXT,
        subtopic_id INTEGER,
        subtopic_title TEXT
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
    // Must run before any index/query referencing the hierarchy columns —
    // they don't exist yet on a chunks table created before hierarchy tracking existed.
    this.migrateAddHierarchyColumns();
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chunks_chapter ON chunks(doc_id, chapter_id);
      CREATE INDEX IF NOT EXISTS idx_chunks_topic ON chunks(doc_id, topic_id);
      CREATE INDEX IF NOT EXISTS idx_chunks_subtopic ON chunks(doc_id, subtopic_id);
    `);
  }

  /** Adds the chapter/topic/subtopic columns to a chunks table created before hierarchy tracking existed. */
  private migrateAddHierarchyColumns() {
    const existing = new Set(
      (this.db.prepare(`PRAGMA table_info(chunks)`).all() as { name: string }[]).map((r) => r.name)
    );
    const wanted: [string, string][] = [
      ['chapter_id', 'INTEGER'],
      ['chapter_title', 'TEXT'],
      ['topic_id', 'INTEGER'],
      ['topic_title', 'TEXT'],
      ['subtopic_id', 'INTEGER'],
      ['subtopic_title', 'TEXT'],
    ];
    for (const [col, type] of wanted) {
      if (!existing.has(col)) {
        this.db.exec(`ALTER TABLE chunks ADD COLUMN ${col} ${type}`);
      }
    }
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

  insertChunk(
    docId: string,
    seq: number,
    text: string,
    metadata: Record<string, unknown>,
    section: SectionPath = {}
  ): number {
    const info = this.db
      .prepare(
        `INSERT INTO chunks
           (doc_id, seq, text, metadata_json, chapter_id, chapter_title, topic_id, topic_title, subtopic_id, subtopic_title)
         VALUES (@doc_id, @seq, @text, @metadata_json, @chapter_id, @chapter_title, @topic_id, @topic_title, @subtopic_id, @subtopic_title)`
      )
      .run({
        doc_id: docId,
        seq,
        text,
        metadata_json: JSON.stringify(metadata),
        chapter_id: section.chapter?.id ?? null,
        chapter_title: section.chapter?.title ?? null,
        topic_id: section.topic?.id ?? null,
        topic_title: section.topic?.title ?? null,
        subtopic_id: section.subtopic?.id ?? null,
        subtopic_title: section.subtopic?.title ?? null,
      });
    return Number(info.lastInsertRowid);
  }

  private rowToChunkRecord(r: any): ChunkRecord {
    return {
      id: r.id,
      docId: r.doc_id,
      seq: r.seq,
      text: r.text,
      metadata: {
        ...JSON.parse(r.metadata_json ?? '{}'),
        chapterTitle: r.chapter_title ?? undefined,
        topicTitle: r.topic_title ?? undefined,
        subtopicTitle: r.subtopic_title ?? undefined,
      },
    };
  }

  getChunksByIds(ids: number[]): ChunkRecord[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db
      .prepare(
        `SELECT id, doc_id, seq, text, metadata_json, chapter_title, topic_title, subtopic_title
         FROM chunks WHERE id IN (${placeholders})`
      )
      .all(...ids) as any[];
    const byId = new Map(rows.map((r) => [r.id, this.rowToChunkRecord(r)]));
    // Preserve caller's ordering (important: caller passes ids in fused-rank order).
    return ids.map((id) => byId.get(id)).filter((c): c is ChunkRecord => !!c);
  }

  /**
   * Fetches specific (docId, seq) chunks — used to pull in the immediate
   * neighbors of a matched chunk, since a concept (e.g. a numbered list) can
   * span a chunk boundary and be missed by top-K semantic search alone.
   */
  getChunksBySeqs(docId: string, seqs: number[]): ChunkRecord[] {
    if (seqs.length === 0) return [];
    const placeholders = seqs.map(() => '?').join(',');
    const rows = this.db
      .prepare(
        `SELECT id, doc_id, seq, text, metadata_json, chapter_title, topic_title, subtopic_title
         FROM chunks WHERE doc_id = ? AND seq IN (${placeholders}) ORDER BY seq`
      )
      .all(docId, ...seqs) as any[];
    return rows.map((r) => this.rowToChunkRecord(r));
  }

  /**
   * Returns every chunk under a chapter/topic/subtopic, ordered by seq (i.e.
   * document reading order) — used to answer "everything in this
   * chapter/topic/subtopic" queries instead of just the top-K best matching
   * fragments.
   */
  getChunksBySection(docId: string, level: 'chapter' | 'topic' | 'subtopic', id: number): ChunkRecord[] {
    const column = level === 'chapter' ? 'chapter_id' : level === 'topic' ? 'topic_id' : 'subtopic_id';
    const rows = this.db
      .prepare(
        `SELECT id, doc_id, seq, text, metadata_json, chapter_title, topic_title, subtopic_title
         FROM chunks WHERE doc_id = ? AND ${column} = ? ORDER BY seq`
      )
      .all(docId, id) as any[];
    return rows.map((r) => this.rowToChunkRecord(r));
  }

  /** Lists every distinct chapter/topic/subtopic detected across ingested documents, for query-time matching. */
  listSections(): SectionInfo[] {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT doc_id, chapter_id, chapter_title, topic_id, topic_title, subtopic_id, subtopic_title
         FROM chunks
         WHERE chapter_id IS NOT NULL OR topic_id IS NOT NULL OR subtopic_id IS NOT NULL`
      )
      .all() as any[];

    const sections: SectionInfo[] = [];
    const seen = new Set<string>();
    const add = (s: SectionInfo) => {
      const key = `${s.docId}:${s.level}:${s.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        sections.push(s);
      }
    };
    for (const r of rows) {
      if (r.chapter_id != null) {
        add({ docId: r.doc_id, level: 'chapter', id: r.chapter_id, title: r.chapter_title });
      }
      if (r.topic_id != null) {
        add({
          docId: r.doc_id,
          level: 'topic',
          id: r.topic_id,
          title: r.topic_title,
          parentChapterId: r.chapter_id ?? undefined,
        });
      }
      if (r.subtopic_id != null) {
        add({
          docId: r.doc_id,
          level: 'subtopic',
          id: r.subtopic_id,
          title: r.subtopic_title,
          parentChapterId: r.chapter_id ?? undefined,
          parentTopicId: r.topic_id ?? undefined,
        });
      }
    }
    return sections;
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
