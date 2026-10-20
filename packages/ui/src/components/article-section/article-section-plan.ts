import type { ArticleVariant } from '../article';
import type { ArticleListItemVariant } from '../article-list';

type BandKind = 'wide' | 'pair' | 'headlines' | 'feature';
export type ArticleSectionTreatment = ArticleVariant | Extract<ArticleListItemVariant, `headline-${string}`>;
export type ArticleSectionBand = {
  kind: BandKind;
  start: number;
  end: number;
  treatments: ArticleSectionTreatment[];
};

const featureTreatments = ['wide', 'time-column', 'rule-top'] as const;
const cardTreatments = ['standard', 'no-dek', 'rule-bottom', 'centered'] as const;
const headlineTreatments = ['headline-time', 'headline-tag', 'headline-place'] as const;
const bandCycle = [
  { kind: 'pair', count: 2 },
  { kind: 'headlines', count: 4 },
  { kind: 'feature', count: 4 },
] as const;

export function planArticleSection(count: number): ArticleSectionBand[] {
  const bands: ArticleSectionBand[] = [];
  let start = 0;
  let feature = 0;
  let card = 0;
  let headline = 0;

  function append(kind: BandKind, size: number) {
    const end = Math.min(start + size, count);
    const treatments = Array.from({ length: end - start }, (_, index) => {
      if (kind === 'headlines' || (kind === 'feature' && index > 0)) {
        return headlineTreatments[headline++ % headlineTreatments.length]!;
      }
      if (kind === 'pair') return cardTreatments[card++ % cardTreatments.length]!;
      return featureTreatments[feature++ % featureTreatments.length]!;
    });
    bands.push({ kind, start, end, treatments });
    start = end;
  }

  if (count === 0) return bands;
  append('wide', 1);
  while (start < count) {
    for (const { kind, count: size } of bandCycle) {
      if (start >= count) break;
      append(kind, size);
    }
  }
  return bands;
}
