import type { ChunkOptions } from './types.js';

export interface RawChunk {
  text: string;
  seq: number;
  /** Nearest markdown/section header above this chunk, if any — useful for citations. */
  sectionTitle?: string;
}

const HEADER_RE = /^(#{1,6})\s+(.*)$/;

/**
 * Approximate token count. We deliberately avoid running a real tokenizer here —
 * this function runs at ingest time over potentially large documents and a
 * whitespace-word heuristic (x0.75 to roughly account for subword splitting)
 * is accurate enough for chunk-size control and costs ~nothing.
 */
function approxTokenCount(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words / 0.75);
}

/**
 * Splits raw document text into structure-respecting sections first
 * (markdown headers, or blank-line paragraph breaks if no headers exist),
 * then packs sections into ~targetTokens chunks with overlap so a single
 * concept isn't cut mid-sentence at a chunk boundary.
 */
export function chunkText(text: string, opts: ChunkOptions = {}): RawChunk[] {
  const targetTokens = opts.targetTokens ?? 400;
  const overlapRatio = opts.overlapRatio ?? 0.15;

  const lines = text.replace(/\r\n/g, '\n').split('\n');

  // Group into (sectionTitle, paragraphs[]) blocks.
  type Block = { sectionTitle?: string; paragraphs: string[] };
  const blocks: Block[] = [{ sectionTitle: undefined, paragraphs: [] }];
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length) {
      blocks[blocks.length - 1].paragraphs.push(currentParagraph.join(' ').trim());
      currentParagraph = [];
    }
  };

  for (const line of lines) {
    const headerMatch = line.match(HEADER_RE);
    if (headerMatch) {
      flushParagraph();
      blocks.push({ sectionTitle: headerMatch[2].trim(), paragraphs: [] });
      continue;
    }
    if (line.trim() === '') {
      flushParagraph();
      continue;
    }
    currentParagraph.push(line.trim());
  }
  flushParagraph();

  // Pack paragraphs within each block into target-sized chunks with overlap.
  const rawChunks: RawChunk[] = [];
  let seq = 0;

  for (const block of blocks) {
    const paragraphs = block.paragraphs.filter(Boolean);
    if (paragraphs.length === 0) continue;

    let current: string[] = [];
    let currentTokens = 0;

    const pushChunk = () => {
      if (current.length === 0) return;
      rawChunks.push({
        text: current.join('\n\n'),
        seq: seq++,
        sectionTitle: block.sectionTitle,
      });
    };

    for (const para of paragraphs) {
      const paraTokens = approxTokenCount(para);

      if (currentTokens + paraTokens > targetTokens && current.length > 0) {
        pushChunk();

        // Build overlap: carry the tail of the previous chunk forward.
        const overlapTokenBudget = Math.floor(targetTokens * overlapRatio);
        const tail: string[] = [];
        let tailTokens = 0;
        for (let i = current.length - 1; i >= 0 && tailTokens < overlapTokenBudget; i--) {
          tailTokens += approxTokenCount(current[i]);
          tail.unshift(current[i]);
        }
        current = tail;
        currentTokens = tailTokens;
      }

      current.push(para);
      currentTokens += paraTokens;
    }
    pushChunk();
  }

  return rawChunks;
}
