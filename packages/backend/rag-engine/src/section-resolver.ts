import type { SectionInfo } from './types.js';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'in', 'on', 'to', 'and', 'or', 'for', 'about',
  'what', 'is', 'are', 'me', 'my', 'tell', 'explain', 'chapter', 'unit',
  'topic', 'section', 'subtopic', 'everything', 'know', 'all', 'from',
  'this', 'that', 'can', 'you', 'please', 'give', 'summary', 'summarize',
]);

function significantWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9.\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function overlapScore(queryWords: string[], titleWords: string[]): number {
  if (titleWords.length === 0) return 0;
  const querySet = new Set(queryWords);
  const matched = titleWords.filter((w) => querySet.has(w)).length;
  return matched / titleWords.length;
}

const LEVEL_KEYWORD_RE = /\b(chapter|unit)\s*(\d+)\b/i;
const DOTTED_NUM_RE = /\b(\d+\.\d+(?:\.\d+)?)\b/;
const LEVEL_RANK: Record<SectionInfo['level'], number> = { subtopic: 3, topic: 2, chapter: 1 };

/**
 * Resolves a free-form student question ("what's in chapter 3", "explain
 * 3.1", "tell me about photosynthesis") to a specific chapter/topic/subtopic
 * detected at ingest time, so the caller can fetch *all* of that section's
 * chunks instead of just the top-K semantically closest fragments.
 * Returns undefined when no section is confidently referenced, so the
 * caller can fall back to normal top-K retrieval.
 */
export function resolveSection(query: string, sections: SectionInfo[]): SectionInfo | undefined {
  if (sections.length === 0) return undefined;

  // 1. Explicit "chapter N" / "unit N" reference — match by leading number in title.
  const levelMatch = query.match(LEVEL_KEYWORD_RE);
  if (levelMatch) {
    const num = levelMatch[2];
    const candidate = sections.find(
      (s) => s.level === 'chapter' && new RegExp(`^(chapter|unit)\\s+0*${num}\\b`, 'i').test(s.title)
    );
    if (candidate) return candidate;
  }

  // 2. Explicit dotted numbering ("3.1" or "3.1.2") — match by title prefix.
  const dottedMatch = query.match(DOTTED_NUM_RE);
  if (dottedMatch) {
    const num = dottedMatch[1];
    const segments = num.split('.').length;
    const level: SectionInfo['level'] = segments >= 3 ? 'subtopic' : 'topic';
    const candidate = sections.find((s) => s.level === level && s.title.startsWith(num));
    if (candidate) return candidate;
  }

  // 3. Fuzzy title match — word-overlap between the query and each known title,
  // preferring the most specific level (subtopic > topic > chapter) on ties.
  const queryWords = significantWords(query);
  if (queryWords.length === 0) return undefined;

  let best: SectionInfo | undefined;
  let bestScore = 0;
  for (const section of sections) {
    const titleWords = significantWords(section.title);
    const score = overlapScore(queryWords, titleWords);
    if (
      score > bestScore ||
      (score === bestScore && score > 0 && best && LEVEL_RANK[section.level] > LEVEL_RANK[best.level])
    ) {
      bestScore = score;
      best = section;
    }
  }

  const CONFIDENCE_THRESHOLD = 0.6;
  return bestScore >= CONFIDENCE_THRESHOLD ? best : undefined;
}
