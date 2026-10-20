import type { ComponentPropsWithRef } from 'react';
import { ArticleSection, type ArticleSectionProps } from './index';
import { ArticleList } from '../article-list';
import { Article } from '../article';

type HasPublicCss<T> = 'css' extends keyof NonNullable<T> ? true : false;

function contract() {
  <ArticleSection articles={[{ id: 'one', headline: 'Headline' }]} heading="News" />;
  <ArticleSection.Heading title="News" level={2} />;
  <ArticleList items={[{ id: 'one', headline: 'Headline' }]} />;
  // @ts-expect-error Collections stay on the standalone ArticleList family.
  <Article.List />;
  // @ts-expect-error Articles require stable ids.
  <ArticleSection articles={[{ headline: 'Headline' }]} />;
  // @ts-expect-error ArticleSection owns generated children.
  <ArticleSection articles={[]}>Content</ArticleSection>;
  // @ts-expect-error No independent list part on ArticleSection.
  <ArticleSection.List />;
  // @ts-expect-error Heading levels follow HTML h1-h6.
  <ArticleSection articles={[]} level={7} />;
  // @ts-expect-error Unknown replacement parts are rejected.
  <ArticleSection articles={[]} slots={{ unknown: () => null }} />;
  // @ts-expect-error Generated title comes from heading.
  <ArticleSection articles={[]} slotProps={{ heading: { title: 'Other' } }} />;
  const bandHasCss: HasPublicCss<NonNullable<ArticleSectionProps['slotProps']>['band']> = false;
  void bandHasCss;
  <ArticleSection articles={[]} slots={{ root: (props: ComponentPropsWithRef<'section'>) => <section {...props} /> }} />;
}
void contract;
