import { createRef, type ComponentProps } from 'react';
import { ArticleCard } from './index';
import { ArticleList } from '../article-list';
import { ArticleKicker } from '../article-kicker';
import { ArticleMeta } from '../article-meta';

export function articleTypeContracts() {
  // @ts-expect-error Easy and compound content are mutually exclusive.
  <ArticleCard headline="Headline"><ArticleCard.Dek>Summary</ArticleCard.Dek></ArticleCard>;
  // @ts-expect-error Easy and compound lists are mutually exclusive.
  <ArticleList items={[]}><ArticleList.Item headline="Headline" /></ArticleList>;
  // @ts-expect-error Easy and compound kickers are mutually exclusive.
  <ArticleKicker items={[]}>Topic</ArticleKicker>;
  // @ts-expect-error A leaf adapter and structural link replacement are mutually exclusive.
  <ArticleCard.Headline renderLink={(props) => <a {...props} />} slots={{ link: (props) => <a {...props} /> }}>Headline</ArticleCard.Headline>;
  // @ts-expect-error A leaf adapter and structural link replacement are mutually exclusive.
  <ArticleList.Item headline="Headline" renderLink={(props) => <a {...props} />} slots={{ link: (props) => <a {...props} /> }} />;
  // @ts-expect-error A leaf adapter and structural link replacement are mutually exclusive.
  <ArticleKicker.Item renderLink={(props) => <a {...props} />} slots={{ link: (props) => <a {...props} /> }}>Topic</ArticleKicker.Item>;
  // @ts-expect-error Heading levels are finite.
  <ArticleCard.Headline level={7}>Headline</ArticleCard.Headline>;
  // @ts-expect-error Unknown slots are rejected.
  <ArticleMeta slots={{ unknown: () => null }} />;
  // @ts-expect-error Unknown slot props are rejected.
  <ArticleList slotProps={{ unknown: {} }} />;
  // @ts-expect-error Linked kicker refs target anchors, not spans.
  <ArticleKicker.Item href="#topic" ref={createRef<HTMLSpanElement>()}>Topic</ArticleKicker.Item>;
  type HasPublicCss<P> = 'css' extends keyof P ? true : false;
  const cardHasCss: HasPublicCss<ComponentProps<typeof ArticleCard>> = false;
  const headlineHasCss: HasPublicCss<ComponentProps<typeof ArticleCard.Headline>> = false;
  const itemHasCss: HasPublicCss<ComponentProps<typeof ArticleList.Item>> = false;
  return [cardHasCss, headlineHasCss, itemHasCss];
}
