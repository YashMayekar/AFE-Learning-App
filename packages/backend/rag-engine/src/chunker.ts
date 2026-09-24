import type { ChunkOptions, SectionPath, SectionRef } from './types.js';

export interface RawChunk {
  text: string;
  seq: number;
  /** Chapter/topic/subtopic this chunk falls under, if any headings were detected above it. */
  section: SectionPath;
}

const HEADER_RE = /^(#{1,6})\s+(.*)$/;

// Plain-text textbook heading heuristics (PDFs have no markdown syntax).
// Ordered most-specific-first: a "3.1.2 Title" line must not also match the
// 2-segment or chapter patterns below it.
const SUBTOPIC_NUM_RE = /^(\d+\.\d+\.\d+)\.?\s+(\S.*)$/;
const TOPIC_NUM_RE = /^(\d+\.\d+)\.?\s+(\S.*)$/;
const CHAPTER_KEYWORD_RE = /^(chapter|unit)\s+(\d+)\b[:.\-]?\s*(.*)$/i;
const CHAPTER_NUM_RE = /^(\d+)\.?\s+([A-Z]\S.*)$/;
// Heading lines are short (textbook headings, not wrapped sentences) — used to
// reject accidental matches like "3.1 apples were harvested that year in..."
const MAX_HEADING_LEN = 90;

// Matches a sentence boundary: terminal punctuation followed by whitespace and
// the start of the next sentence (capital letter, digit, quote, or opening paren).
// Deliberately simple — good enough to avoid cutting chunks mid-sentence without
// running a full NLP sentence tokenizer over potentially huge documents.
const SENTENCE_BOUNDARY_RE = /(?<=[.!?])\s+(?=["'“(]?[A-Z0-9])/;

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
 * Normalizes raw extracted text before paragraph detection.
 * PDF text extraction (pdf-parse) commonly:
 *  - wraps words with a trailing hyphen at the line break ("infor-\nmation")
 *  - emits a form-feed between pages instead of a blank line
 * Left unfixed, these break paragraph detection (which relies on blank lines)
 * and word integrity, causing overly large "paragraphs" that later degrade
 * into arbitrarily-cut chunks.
 */
function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n\n')
    .replace(/([a-z])-\n([a-z])/g, '$1$2');
}

/** Splits a paragraph into sentences. Falls back to the whole paragraph if no boundary is found. */
function splitIntoSentences(paragraph: string): string[] {
  const sentences = paragraph.split(SENTENCE_BOUNDARY_RE).map((s) => s.trim()).filter(Boolean);
  return sentences.length > 0 ? sentences : [paragraph];
}

type HeadingLevel = 'chapter' | 'topic' | 'subtopic';
interface HeadingMatch {
  level: HeadingLevel;
  title: string;
}

/**
 * Rejects numbered-list items and ordinary sentences from being mistaken for
 * headings. "1. The electrons revolve around the nucleus in circular orbits."
 * matches the same "number + capitalized text" shape as a heading, but it's a
 * list item, not a heading. Two independent PDF-extraction realities make
 * this hard to catch with a single check:
 *  - real headings don't end in sentence punctuation, BUT
 *  - PDF text is hard-wrapped at ~80 chars, so a list item's line can *also*
 *    happen to end without punctuation (the sentence just continues on the
 *    next line) — the punctuation check alone isn't reliable.
 * So numbered patterns additionally require the title to be Title Case
 * (most significant words capitalized), which real textbook headings are and
 * ordinary sentences are not — "Bohr's Atomic Model" vs "The electrons
 * revolve around the nucleus". Left unguarded, list items get misdetected as
 * new chapter/topic/subtopic boundaries, fragmenting real content away from
 * its section (and away from each other).
 */
function looksLikeHeadingTitle(title: string): boolean {
  if (/[.!?]$/.test(title.trim())) return false;
  const wordCount = title.trim().split(/\s+/).filter(Boolean).length;
  return wordCount > 0 && wordCount <= 14;
}

const CONNECTOR_WORDS = new Set([
  'of', 'in', 'on', 'at', 'to', 'a', 'an', 'the', 'and', 'or', 'for', 'is',
  'are', 'with', 'by', 'from', 'as', 'this', 'that', 'these', 'those',
]);

/** True if most "significant" (non-connector, len>2) words start with a capital letter. */
function isLikelyTitleCase(title: string): boolean {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const significant = words.filter(
    (w) => w.replace(/[^a-zA-Z]/g, '').length > 2 && !CONNECTOR_WORDS.has(w.toLowerCase())
  );
  if (significant.length === 0) return true; // too short/generic to judge — don't block on it
  const capitalized = significant.filter((w) => /^[A-Z]/.test(w));
  return capitalized.length / significant.length >= 0.8;
}

function looksLikeNumberedHeadingTitle(title: string): boolean {
  return looksLikeHeadingTitle(title) && isLikelyTitleCase(title);
}

/**
 * Detects a chapter/topic/subtopic heading on a single line, using markdown
 * headers (# / ## / ###+) when present, and plain-text textbook numbering
 * conventions (e.g. "Chapter 3", "3.1 Cell Theory", "3.1.2 Prokaryotes")
 * otherwise — PDF-extracted text has no markdown syntax to rely on.
 * Order matters: most specific (subtopic) pattern is tried first so a
 * "3.1.2 ..." line isn't also caught by the 2-segment topic pattern.
 */
function matchHeading(line: string): HeadingMatch | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > MAX_HEADING_LEN) return null;

  const headerMatch = trimmed.match(HEADER_RE);
  if (headerMatch) {
    const depth = headerMatch[1].length;
    const level: HeadingLevel = depth === 1 ? 'chapter' : depth === 2 ? 'topic' : 'subtopic';
    return { level, title: headerMatch[2].trim() };
  }

  const subtopicMatch = trimmed.match(SUBTOPIC_NUM_RE);
  if (subtopicMatch && looksLikeNumberedHeadingTitle(subtopicMatch[2])) return { level: 'subtopic', title: trimmed };

  const topicMatch = trimmed.match(TOPIC_NUM_RE);
  if (topicMatch && looksLikeNumberedHeadingTitle(topicMatch[2])) return { level: 'topic', title: trimmed };

  const chapterKeywordMatch = trimmed.match(CHAPTER_KEYWORD_RE);
  if (chapterKeywordMatch && looksLikeHeadingTitle(chapterKeywordMatch[3] || trimmed)) {
    return { level: 'chapter', title: trimmed };
  }

  const chapterNumMatch = trimmed.match(CHAPTER_NUM_RE);
  if (chapterNumMatch && looksLikeNumberedHeadingTitle(chapterNumMatch[2])) return { level: 'chapter', title: trimmed };


  return null;
}

/**
 * Splits raw document text into structure-respecting sections first
 * (chapter/topic/subtopic headings, or blank-line paragraph breaks if no
 * headings exist), then further splits each paragraph into sentences so no
 * unit of text is larger than a sentence. Sentences are then packed into
 * ~targetTokens chunks with overlap, preferring to break at paragraph
 * boundaries once a chunk is reasonably full — this keeps a paragraph's
 * information together when it fits, and guarantees chunks never end
 * mid-sentence when it doesn't.
 *
 * Every chunk is tagged with the chapter/topic/subtopic it falls under
 * (RawChunk.section), so the query layer can later answer "everything in
 * chapter 3" / "everything about topic 3.1" by fetching all chunks that
 * share a section id, instead of only the top-K semantically closest chunks.
 */
export function chunkText(text: string, opts: ChunkOptions = {}): RawChunk[] {
  const targetTokens = opts.targetTokens ?? 400;
  const overlapRatio = opts.overlapRatio ?? 0.15;

  const lines = normalizeExtractedText(text).split('\n');

  // Group into (section, paragraphs[]) blocks, tracking which chapter/topic/
  // subtopic heading was most recently seen at each level.
  type Block = { section: SectionPath; paragraphs: string[] };
  let chapterCounter = 0;
  let topicCounter = 0;
  let subtopicCounter = 0;
  let currentChapter: SectionRef | undefined;
  let currentTopic: SectionRef | undefined;
  let currentSubtopic: SectionRef | undefined;

  const snapshotSection = (): SectionPath => ({
    chapter: currentChapter,
    topic: currentTopic,
    subtopic: currentSubtopic,
  });

  const blocks: Block[] = [{ section: snapshotSection(), paragraphs: [] }];
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length) {
      blocks[blocks.length - 1].paragraphs.push(currentParagraph.join(' ').trim());
      currentParagraph = [];
    }
  };

  for (const line of lines) {
    const heading = matchHeading(line);
    if (heading) {
      flushParagraph();
      if (heading.level === 'chapter') {
        currentChapter = { id: ++chapterCounter, title: heading.title };
        currentTopic = undefined;
        currentSubtopic = undefined;
      } else if (heading.level === 'topic') {
        currentTopic = { id: ++topicCounter, title: heading.title };
        currentSubtopic = undefined;
      } else {
        currentSubtopic = { id: ++subtopicCounter, title: heading.title };
      }
      blocks.push({ section: snapshotSection(), paragraphs: [] });
      continue;
    }
    if (line.trim() === '') {
      flushParagraph();
      continue;
    }
    currentParagraph.push(line.trim());
  }
  flushParagraph();

  // Flatten each block's paragraphs into sentences, tagging the last sentence
  // of each paragraph so the packer can prefer breaking there.
  type Unit = { text: string; tokens: number; paragraphEnd: boolean };

  const rawChunks: RawChunk[] = [];
  let seq = 0;

  for (const block of blocks) {
    const paragraphs = block.paragraphs.filter(Boolean);
    if (paragraphs.length === 0) continue;

    const units: Unit[] = [];
    for (const para of paragraphs) {
      const sentences = splitIntoSentences(para);
      sentences.forEach((sentence, i) => {
        units.push({
          text: sentence,
          tokens: approxTokenCount(sentence),
          paragraphEnd: i === sentences.length - 1,
        });
      });
    }

    let current: Unit[] = [];
    let currentTokens = 0;
    const minTokensBeforeBoundaryBreak = targetTokens * 0.6;

    const pushChunk = () => {
      if (current.length === 0) return;
      rawChunks.push({
        text: current.map((u) => u.text).join(' '),
        seq: seq++,
        section: block.section,
      });
    };


    const overlapTokenBudget = Math.floor(targetTokens * overlapRatio);
    const buildOverlapTail = (): Unit[] => {
      const tail: Unit[] = [];
      let tailTokens = 0;
      for (let i = current.length - 1; i >= 0 && tailTokens < overlapTokenBudget; i--) {
        tailTokens += current[i].tokens;
        tail.unshift(current[i]);
      }
      return tail;
    };

    for (const unit of units) {
      // Hard limit: never let a chunk exceed target size (except a single
      // over-long unit, which is kept whole to avoid cutting mid-sentence).
      const wouldOverflow = currentTokens + unit.tokens > targetTokens && current.length > 0;
      if (wouldOverflow) {
        pushChunk();
        current = buildOverlapTail();
        currentTokens = current.reduce((sum, u) => sum + u.tokens, 0);
      }

      current.push(unit);
      currentTokens += unit.tokens;

      // Soft preference: once a chunk is reasonably full, break at the next
      // paragraph boundary instead of packing all the way to targetTokens —
      // keeps a paragraph's sentences together in one chunk when possible.
      if (unit.paragraphEnd && currentTokens >= minTokensBeforeBoundaryBreak) {
        pushChunk();
        current = buildOverlapTail();
        currentTokens = current.reduce((sum, u) => sum + u.tokens, 0);
      }
    }
    pushChunk();
  }

  return rawChunks;
}
