import { createRef, type ComponentProps } from 'react';
import { ArticleBody } from './index';
import { ArticleSources } from '../article-sources';
import { SectionHeading } from '../section-heading';

export function articleBodyTypeContracts() {
  // @ts-expect-error Sources require a title or external accessible name.
  <ArticleSources items={[]} />;
  // @ts-expect-error Section headings require a title.
  <SectionHeading />;
  // @ts-expect-error Heading levels are finite.
  <ArticleBody.Heading level={7}>Edition</ArticleBody.Heading>;
  // @ts-expect-error Paragraph variants are finite.
  <ArticleBody.Paragraph variant="lede">Edition</ArticleBody.Paragraph>;
  // @ts-expect-error Fact items and child anatomy are mutually exclusive.
  <ArticleBody.Fact items={[]}>Edition</ArticleBody.Fact>;
  // @ts-expect-error Split requires exactly two cells.
  <ArticleBody.Split><ArticleBody.Cell>Edition</ArticleBody.Cell></ArticleBody.Split>;
  // @ts-expect-error Unknown slots are rejected.
  <ArticleBody.Quote slots={{ unknown: () => null }}>Edition</ArticleBody.Quote>;
  // @ts-expect-error Unknown slot props are rejected.
  <ArticleSources title="Coverage" items={[]} slotProps={{ unknown: {} }} />;
  // @ts-expect-error Link adapter and structural link replacement are mutually exclusive.
  <SectionHeading title="Edition" renderLink={(props) => <a {...props} />} slots={{ link: (props) => <a {...props} /> }} />;
  // @ts-expect-error Source link adapters and structural link replacement are mutually exclusive.
  <ArticleSources title="Coverage" items={[{ id: 'edition', label: 'Edition', renderLink: (props) => <a {...props} /> }]} slots={{ link: (props) => <a {...props} /> }} />;
  // @ts-expect-error Quote refs target native blockquotes.
  <ArticleBody.Quote ref={createRef<HTMLDivElement>()}>Edition</ArticleBody.Quote>;
  type HasPublicCss<P> = 'css' extends keyof P ? true : false;
  const bodyHasCss: HasPublicCss<ComponentProps<typeof ArticleBody>> = false;
  const paragraphHasCss: HasPublicCss<ComponentProps<typeof ArticleBody.Paragraph>> = false;
  const headingHasCss: HasPublicCss<ComponentProps<typeof ArticleBody.Heading>> = false;
  const factHasCss: HasPublicCss<ComponentProps<typeof ArticleBody.Fact>> = false;
  const quoteHasCss: HasPublicCss<ComponentProps<typeof ArticleBody.Quote>> = false;
  const splitHasCss: HasPublicCss<ComponentProps<typeof ArticleBody.Split>> = false;
  const cellHasCss: HasPublicCss<ComponentProps<typeof ArticleBody.Cell>> = false;
  const sourcesHaveCss: HasPublicCss<ComponentProps<typeof ArticleSources>> = false;
  const sectionHasCss: HasPublicCss<ComponentProps<typeof SectionHeading>> = false;
  return [bodyHasCss, paragraphHasCss, headingHasCss, factHasCss, quoteHasCss, splitHasCss, cellHasCss, sourcesHaveCss, sectionHasCss];
}
