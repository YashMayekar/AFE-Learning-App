import type { RetrievedChunk } from './types.js';

/** Longest word-sequence that is both a suffix of `a` and a prefix of `b` (capped for perf). */
function longestOverlapWords(a: string, b: string, maxWords = 80): number {
  const aWords = a.trim().split(/\s+/);
  const bWords = b.trim().split(/\s+/);
  const maxLen = Math.min(aWords.length, bWords.length, maxWords);
  for (let len = maxLen; len > 3; len--) {
    const aSuffix = aWords.slice(aWords.length - len).join(' ');
    const bPrefix = bWords.slice(0, len).join(' ');
    if (aSuffix === bPrefix) return len;
  }
  return 0;
}

/** Appends `nextText` to `text`, stripping any duplicate overlap so the same sentence isn't repeated. */
function appendDeduped(text: string, nextText: string): string {
  const overlap = longestOverlapWords(text, nextText);
  if (overlap === 0) return `${text} ${nextText}`.trim();
  const nextWords = nextText.trim().split(/\s+/);
  return `${text} ${nextWords.slice(overlap).join(' ')}`.trim();
}

/**
 * Merges chunks that are adjacent (or overlapping) in the same document into
 * single contiguous spans, stripping the chunker's built-in overlap text so
 * the LLM never sees the same sentence repeated across multiple [n] blocks.
 * Also means a concept split across a chunk boundary (e.g. an intro sentence
 * followed by a numbered list) reads as one continuous block instead of two
 * disconnected fragments.
 */
export function mergeAdjacentChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const byDoc = new Map<string, RetrievedChunk[]>();
  for (const c of chunks) {
    const arr = byDoc.get(c.docId) ?? [];
    arr.push(c);
    byDoc.set(c.docId, arr);
  }

  const merged: RetrievedChunk[] = [];
  for (const docChunks of byDoc.values()) {
    docChunks.sort((a, b) => a.seq - b.seq);

    let run: RetrievedChunk | null = null;
    for (const c of docChunks) {
      if (run && c.seq <= run.seq + 1) {
        const current: RetrievedChunk = run;
        if (c.seq > current.seq) {
          run = {
            ...current,
            seq: c.seq,
            text: appendDeduped(current.text, c.text),
            score: Math.max(current.score, c.score),
            matchedVia: Array.from(new Set([...current.matchedVia, ...c.matchedVia])),
          };
        }
        continue;
      }
      if (run) merged.push(run);
      run = { ...c };
    }
    if (run) merged.push(run);
  }

  return merged.sort((a, b) => b.score - a.score);
}
