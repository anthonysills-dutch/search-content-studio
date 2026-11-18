// Topic terms: the words and two-word phrases a page uses most.

const STOPWORDS = new Set(
  `a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our ours out over own same she should so some such than that the their theirs them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself one two get got make made use used using may might must us like well way even much many new also every via per its it's don't can't won't you're we're they're i'm`.split(
    /\s+/,
  ),
);

export interface TermCount {
  term: string;
  count: number;
}

export function words(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).map((w) =>
    w.replace(/['’]s$/, ""),
  );
}

function isContentWord(word: string): boolean {
  return word.length > 2 && !STOPWORDS.has(word) && !/^\d+$/.test(word);
}

/** The most frequent content words and two-word phrases. */
export function topTerms(text: string, limit = 40): TermCount[] {
  const list = words(text);
  const counts = new Map<string, number>();
  const add = (term: string) => counts.set(term, (counts.get(term) ?? 0) + 1);
  list.forEach((word, i) => {
    if (!isContentWord(word)) return;
    add(word);
    const next = list[i + 1];
    if (next && isContentWord(next)) add(`${word} ${next}`);
  });
  return [...counts]
    .filter(([term, count]) => count >= (term.includes(" ") ? 2 : 2))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

/** How many times `term` appears in `text`, as whole words. */
export function countTerm(text: string, term: string): number {
  const haystack = ` ${words(text).join(" ")} `;
  const needle = ` ${words(term).join(" ")} `;
  if (needle.trim() === "") return 0;
  let count = 0;
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    count += 1;
    at = haystack.indexOf(needle, at + needle.length - 1);
  }
  return count;
}

export interface BriefTerm {
  term: string;
  /** Sources that use it. */
  sources: number;
  /** Average uses in the sources that use it. */
  average: number;
  /** Few sources cover it. */
  gap: boolean;
}

/** Terms across the sources, most widely used first; a gap is one at most a third of them use. */
export function aggregateTerms(perSource: TermCount[][]): BriefTerm[] {
  const total = perSource.length;
  const seen = new Map<string, { sources: number; uses: number }>();
  for (const terms of perSource) {
    for (const { term, count } of terms) {
      const entry = seen.get(term) ?? { sources: 0, uses: 0 };
      entry.sources += 1;
      entry.uses += count;
      seen.set(term, entry);
    }
  }
  return [...seen]
    .map(([term, { sources, uses }]) => ({
      term,
      sources,
      average: Math.max(1, Math.round(uses / sources)),
      gap: total >= 2 && sources <= Math.max(1, Math.floor(total / 3)),
    }))
    .sort((a, b) => b.sources - a.sources || b.average - a.average || a.term.localeCompare(b.term))
    .slice(0, 60);
}
