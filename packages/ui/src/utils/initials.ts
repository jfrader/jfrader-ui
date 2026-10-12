// Initials for a person or an entity: the first grapheme of up to `max` words, uppercased for the
// current locale. Grapheme-aware so a name starting with a combining mark or an emoji keeps a
// whole character instead of half a surrogate pair.
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function getWordInitial(word: string): string {
  const segments = Array.from(graphemes.segment(word), ({ segment }) => segment);
  const first = segments[0] ?? '';
  if (!/\p{Extended_Pictographic}/u.test(first)) return first;

  let initial = '';
  for (const segment of segments) {
    if (!/\p{Extended_Pictographic}/u.test(segment)) break;
    initial += segment;
  }
  return initial;
}

/** First grapheme of up to `max` words of `name`, joined and uppercased for the current locale. */
export function getInitials(name: string, max: number): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max)
    .map(getWordInitial)
    .join('')
    .toLocaleUpperCase();
}
