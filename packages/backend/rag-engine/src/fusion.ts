/**
 * Reciprocal Rank Fusion. Combines multiple ranked lists (e.g. dense-search
 * order and BM25 order) into one ranking using only each item's *rank*
 * within each list, not raw scores — this sidesteps the "cosine distance
 * and BM25 score are on different scales" problem entirely, with no extra
 * model or normalization step. Cost is O(n), effectively free.
 */
export function reciprocalRankFusion(
  rankedLists: { id: number; source: 'dense' | 'lexical' }[][],
  k = 60
): { id: number; score: number; matchedVia: ('dense' | 'lexical')[] }[] {
  const scores = new Map<number, number>();
  const sources = new Map<number, Set<'dense' | 'lexical'>>();

  for (const list of rankedLists) {
    list.forEach((item, rank) => {
      const contribution = 1 / (k + rank + 1);
      scores.set(item.id, (scores.get(item.id) ?? 0) + contribution);
      if (!sources.has(item.id)) sources.set(item.id, new Set());
      sources.get(item.id)!.add(item.source);
    });
  }

  return [...scores.entries()]
    .map(([id, score]) => ({ id, score, matchedVia: [...(sources.get(id) ?? [])] }))
    .sort((a, b) => b.score - a.score);
}
