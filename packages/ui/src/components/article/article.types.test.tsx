import { createRef, type ComponentProps } from 'react';
import { Article } from './index';
import { ArticleList } from '../article-list';

export function articleTypeContracts() {
  // @ts-expect-error Shorthand and composed content are mutually exclusive.
  <Article headline="Headline"><Article.Dek>Summary</Article.Dek></Article>;
  // @ts-expect-error Shorthand and composed lists are mutually exclusive.
  <ArticleList items={[]}><ArticleList.Item headline="Headline" /></ArticleList>;
  // @ts-expect-error Shorthand and composed kickers are mutually exclusive.
  <Article.Kicker items={[]}>Topic</Article.Kicker>;
  // @ts-expect-error A leaf adapter and structural link replacement are mutually exclusive.
  <Article.Headline renderLink={(props) => <a {...props} />} slots={{ link: (props) => <a {...props} /> }}>Headline</Article.Headline>;
  // @ts-expect-error A leaf adapter and structural link replacement are mutually exclusive.
  <ArticleList.Item headline="Headline" renderLink={(props) => <a {...props} />} slots={{ link: (props) => <a {...props} /> }} />;
  // @ts-expect-error A leaf adapter and structural link replacement are mutually exclusive.
  <Article.Kicker.Item renderLink={(props) => <a {...props} />} slots={{ link: (props) => <a {...props} /> }}>Topic</Article.Kicker.Item>;
  // @ts-expect-error Heading levels are finite.
  <Article.Headline level={7}>Headline</Article.Headline>;
  // @ts-expect-error Unknown slots are rejected.
  <Article.Meta slots={{ unknown: () => null }} />;
  // @ts-expect-error Unknown slot props are rejected.
  <ArticleList slotProps={{ unknown: {} }} />;
  // @ts-expect-error Linked kicker refs target anchors, not spans.
  <Article.Kicker.Item href="#topic" ref={createRef<HTMLSpanElement>()}>Topic</Article.Kicker.Item>;
  type HasPublicCss<P> = 'css' extends keyof P ? true : false;
  const cardHasCss: HasPublicCss<ComponentProps<typeof Article>> = false;
  const headlineHasCss: HasPublicCss<ComponentProps<typeof Article.Headline>> = false;
  const itemHasCss: HasPublicCss<ComponentProps<typeof ArticleList.Item>> = false;
  return [cardHasCss, headlineHasCss, itemHasCss];
}
