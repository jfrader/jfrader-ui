import { createRef, type ComponentProps } from 'react';
import { Article } from './index';
import { ArticleSection } from '../article-section';

export function articleBodyTypeContracts() {
  // @ts-expect-error Sources require a title or external accessible name.
  <Article.Sources items={[]} />;
  // @ts-expect-error Section headings require a title.
  <ArticleSection.Heading />;
  // @ts-expect-error Heading levels are finite.
  <Article.Body.Heading level={7}>Edition</Article.Body.Heading>;
  // @ts-expect-error Paragraph variants are finite.
  <Article.Body.Paragraph variant="lede">Edition</Article.Body.Paragraph>;
  // @ts-expect-error Fact items and child anatomy are mutually exclusive.
  <Article.Body.Fact items={[]}>Edition</Article.Body.Fact>;
  // @ts-expect-error Split requires exactly two cells.
  <Article.Body.Split><Article.Body.Cell>Edition</Article.Body.Cell></Article.Body.Split>;
  // @ts-expect-error Unknown slots are rejected.
  <Article.Body.Quote slots={{ unknown: () => null }}>Edition</Article.Body.Quote>;
  // @ts-expect-error Unknown slot props are rejected.
  <Article.Sources title="Coverage" items={[]} slotProps={{ unknown: {} }} />;
  // @ts-expect-error Link adapter and structural link replacement are mutually exclusive.
  <ArticleSection.Heading title="Edition" renderLink={(props) => <a {...props} />} slots={{ link: (props) => <a {...props} /> }} />;
  // @ts-expect-error Source link adapters and structural link replacement are mutually exclusive.
  <Article.Sources title="Coverage" items={[{ id: 'edition', label: 'Edition', renderLink: (props) => <a {...props} /> }]} slots={{ link: (props) => <a {...props} /> }} />;
  // @ts-expect-error Quote refs target native blockquotes.
  <Article.Body.Quote ref={createRef<HTMLDivElement>()}>Edition</Article.Body.Quote>;
  type HasPublicCss<P> = 'css' extends keyof P ? true : false;
  const bodyHasCss: HasPublicCss<ComponentProps<typeof Article.Body>> = false;
  const paragraphHasCss: HasPublicCss<ComponentProps<typeof Article.Body.Paragraph>> = false;
  const headingHasCss: HasPublicCss<ComponentProps<typeof Article.Body.Heading>> = false;
  const factHasCss: HasPublicCss<ComponentProps<typeof Article.Body.Fact>> = false;
  const quoteHasCss: HasPublicCss<ComponentProps<typeof Article.Body.Quote>> = false;
  const splitHasCss: HasPublicCss<ComponentProps<typeof Article.Body.Split>> = false;
  const cellHasCss: HasPublicCss<ComponentProps<typeof Article.Body.Cell>> = false;
  const sourcesHaveCss: HasPublicCss<ComponentProps<typeof Article.Sources>> = false;
  const sectionHasCss: HasPublicCss<ComponentProps<typeof ArticleSection.Heading>> = false;
  return [bodyHasCss, paragraphHasCss, headingHasCss, factHasCss, quoteHasCss, splitHasCss, cellHasCss, sourcesHaveCss, sectionHasCss];
}
