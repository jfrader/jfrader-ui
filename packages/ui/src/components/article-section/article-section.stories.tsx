import { createRef, useState, type ComponentPropsWithRef, type MouseEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { Article } from '../article';
import { Stack } from '../stack';
import { Button } from '../button';
import { ArticleSection, type ArticleSectionEntry } from './index';
import { planArticleSection } from './article-section-plan';
import { expectArticleHydration } from '../../testing/article-assertions';
import { createRefCleanupTracker } from '../../testing/interior-slot-assertions';

const headlines = [
  'The night service returns to Northline',
  'A new entrance opens at the central station',
  'Library hours extend into the evening',
  'The river path reopens after repairs',
  'Council publishes the station survey',
  'Northline market adds a Saturday service',
  'The archive opens its reading room',
  'A second platform enters service',
  'The school crossing gets new signals',
  'A public garden opens beside the depot',
  'Work begins on the eastbound track',
  'The museum extends its winter programme',
  'Residents review the transport plan',
  'The ferry adds an early departure',
  'A restored clock returns to the square',
  'Engineers inspect the northern bridge',
  'The city adds a direct bus connection',
  'The old mill opens for guided visits',
  'A weekend timetable takes effect',
  'The community kitchen moves to a larger space',
  'The harbour reports its annual results',
  'The west line completes a signalling trial',
  'The station hosts an archive exhibition',
  'A new footbridge connects the neighbourhoods',
];
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeStyle: 'short', timeZone: 'UTC' });
const articles: readonly ArticleSectionEntry[] = headlines.map((headline, index) => {
  const published = new Date(Date.UTC(2026, 9, 20, 9, index));
  const time = { dateTime: published.toISOString(), label: timeFormat.format(published) };
  return {
    id: `record-${index}`,
    headline,
    href: `#record-${index}`,
    dek: 'The morning edition follows the changes to public services across the city and its neighbourhoods.',
    kicker: <Article.Kicker items={[{ id: 'city', label: 'The city' }]} />,
    meta: <Article.Meta place="Northline" published={time} />,
    time,
    label: 'The city',
    place: 'Northline',
  };
});
function sectionCode(count = articles.length, element = '<ArticleSection heading="Northline" articles={articles} />', setup = '') {
  return `import { Article, ArticleSection } from '@jfrader/ui';

const headlines = ${JSON.stringify(headlines.slice(0, count), null, 2)};
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeStyle: 'short', timeZone: 'UTC' });
const articles = headlines.map((headline, index) => {
  const published = new Date(Date.UTC(2026, 9, 20, 9, index));
  const time = { dateTime: published.toISOString(), label: timeFormat.format(published) };
  return {
    id: \`record-\${index}\`,
    headline,
    href: \`#record-\${index}\`,
    dek: 'The morning edition follows the changes to public services across the city and its neighbourhoods.',
    kicker: <Article.Kicker items={[{ id: 'city', label: 'The city' }]} />,
    meta: <Article.Meta place="Northline" published={time} />,
    time,
    label: 'The city',
    place: 'Northline',
  };
});
${setup}
${element}`;
}

const meta = {
  title: 'Media/ArticleSection',
  component: ArticleSection,
  tags: ['autodocs'],
  args: { articles, heading: 'Northline' },
  parameters: {
    layout: 'padded',
    docs: {
      description: { component: 'Render a section of articles with leads, card pairs and headline lists.' },
      usage: `### Content
Articles appear once, in the supplied order. Prepare text, links and printed times in your app. Empty collections render nothing.

### Headings and links

The section title names the section. Article headlines default to the next heading level, capped at 6; without a section title they default to level 2. Set an article's level when its place in the page outline differs. Links use native Tab and Enter behavior.`,
      sections: [
        { title: 'Sections', stories: ['Mixed', 'WithoutHeading', 'SingleArticle'] },
        { title: 'Heading', stories: ['CustomHeading', 'StandaloneHeading'] },
        { title: 'Customization', stories: ['ReplacementSlots'] },
      ],
      source: { language: 'tsx', code: sectionCode() },
    },
  },
} satisfies Meta<typeof ArticleSection>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Mixed: Story = {
  play: async ({ canvas, canvasElement }) => {
    const section = canvas.getByRole('region', { name: 'Northline' });
    await expect(canvas.getByRole('heading', { level: 2, name: 'Northline' })).toHaveAttribute('id', section.getAttribute('aria-labelledby'));
    await expect(canvas.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(headlines);
    await expect(canvas.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(articles.map(({ href }) => href));
    const variants = [...canvasElement.querySelectorAll('[data-ui~="article"], [data-ui~="article-list-item"]')].map((item) => item.getAttribute('data-variant'));
    await expect([...new Set(variants)].sort()).toEqual(['centered', 'headline-place', 'headline-tag', 'headline-time', 'no-dek', 'rule-bottom', 'rule-top', 'standard', 'time-column', 'wide'].sort());
    for (const article of canvasElement.querySelectorAll('[data-ui~="article"]')) {
      await expect(article.querySelector(':scope > time') !== null).toBe(article.getAttribute('data-variant') === 'time-column');
    }
  },
};

export const WithoutHeading: Story = {
  args: { articles: articles.slice(0, 4), heading: undefined },
  parameters: { docs: { source: { code: sectionCode(4, '<ArticleSection articles={articles} />') } } },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector('header')).toBeNull();
    await expect(canvasElement.querySelector('[data-ui~="article-section"]')).not.toHaveAttribute('aria-labelledby');
    await expect(canvas.getAllByRole('heading', { level: 2 })).toHaveLength(4);
  },
};

export const SingleArticle: Story = {
  args: { articles: articles.slice(0, 1) },
  parameters: { docs: { source: { code: sectionCode(1) } } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-ui~="article-section-band"]')).toHaveLength(1);
    await expect(canvasElement.querySelectorAll('article')).toHaveLength(1);
    await expect(canvasElement.querySelector('ul')).toBeNull();
  },
};

export const CustomHeading: Story = {
  args: { articles: articles.slice(0, 4), slotProps: { heading: { level: 1, kicker: 'Morning edition', href: '#northline', accessory: 'Station record' } } },
  parameters: { docs: { source: { code: sectionCode(4, `<ArticleSection
  heading="Northline"
  articles={articles}
  slotProps={{ heading: { level: 1, kicker: 'Morning edition', href: '#northline', accessory: 'Station record' } }}
/>`) } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent('Northline');
    await expect(canvas.getAllByRole('heading', { level: 2 })).toHaveLength(4);
  },
};

export const StandaloneHeading: Story = {
  render: () => <ArticleSection.Heading title="Northline" kicker="Morning edition" href="#northline" accessory="Station record" />,
  parameters: { docs: { source: { code: `import { ArticleSection } from '@jfrader/ui';

<ArticleSection.Heading
  title="Northline"
  kicker="Morning edition"
  href="#northline"
  accessory="Station record"
/>` } } },
};

function SectionRoot(props: ComponentPropsWithRef<'section'>) { return <section {...props} data-replacement="section" />; }
function HeaderRoot(props: ComponentPropsWithRef<'header'>) { return <header {...props} data-replacement="heading" />; }
function OtherHeaderRoot(props: ComponentPropsWithRef<'header'>) { return <header {...props} data-replacement="other-heading" />; }
function BandRoot(props: ComponentPropsWithRef<'div'>) { return <div {...props} data-replacement="band" />; }
function CardRoot(props: ComponentPropsWithRef<'article'>) { return <article {...props} data-replacement="article" />; }
function ListRoot(props: ComponentPropsWithRef<'ul'>) { return <ul {...props} data-replacement="list" />; }
function ItemRoot(props: ComponentPropsWithRef<'li'>) { return <li {...props} data-replacement="item" />; }
const rootRef = createRef<HTMLElement>();
const repeatedRef = fn();
export const ReplacementContracts: Story = {
  tags: ['!autodocs'],
  args: {
    ref: rootRef,
    className: 'consumer',
    slots: { root: SectionRoot, heading: HeaderRoot, band: BandRoot, article: CardRoot, list: ListRoot, listItem: ItemRoot },
    slotProps: {
      root: { className: 'slot', 'aria-labelledby': 'external-heading' },
      heading: { slots: { root: OtherHeaderRoot } },
      band: { id: 'must-not-repeat', className: 'band' },
      article: { id: 'must-not-repeat', slotProps: { root: { id: 'must-not-repeat', ref: repeatedRef }, headline: { slotProps: { root: { id: 'must-not-repeat', ref: repeatedRef }, link: { id: 'must-not-repeat', ref: repeatedRef } } } } },
      list: { id: 'must-not-repeat', slotProps: { root: { id: 'must-not-repeat', ref: repeatedRef } } },
      listItem: { id: 'must-not-repeat', slotProps: { root: { id: 'must-not-repeat', ref: repeatedRef }, link: { id: 'must-not-repeat', ref: repeatedRef } } },
    },
  },
  render: (args) => <><ArticleSection.Heading id="external-heading" title="Morning edition" variant="plain" /><ArticleSection {...args} /></>,
  parameters: { docs: { source: { code: `import type { ComponentPropsWithRef } from 'react';
import { ArticleSection } from '@jfrader/ui';

function Band(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-edition-band="true" />;
}

<ArticleSection
  heading="Northline"
  articles={[{ id: 'station', headline: 'A new entrance opens at the central station' }]}
  slots={{ band: Band }}
/>` } } },
  play: async ({ canvasElement }) => {
    await expect(rootRef.current).toHaveClass('slot', 'consumer');
    await expect(rootRef.current?.getAttribute('aria-labelledby')?.split(' ')).toContain('external-heading');
    for (const part of ['section', 'heading', 'band', 'article', 'list', 'item']) {
      await expect(canvasElement.querySelector(`[data-replacement="${part}"]`)).not.toBeNull();
    }
    await expect(canvasElement.querySelector('[id="must-not-repeat"]')).toBeNull();
    await expect(canvasElement.querySelector('[data-replacement="other-heading"]')).toBeNull();
    await expect(repeatedRef).not.toHaveBeenCalled();
  },
};

export const ReplacementSlots: Story = {
  args: { articles: articles.slice(0, 4), slots: { band: BandRoot } },
  parameters: { docs: { source: { code: `import type { ComponentPropsWithRef } from 'react';
${sectionCode(4, '<ArticleSection heading="Northline" articles={articles} slots={{ band: Band }} />', `
function Band(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="band" />;
}`)}` } } },
};

export const Empty: Story = {
  args: { articles: [] }, tags: ['!autodocs'],
  play: async ({ canvasElement }) => { await expect(canvasElement.querySelector('section, header')).toBeNull(); },
};
export const ZeroHeading: Story = { args: { articles: articles.slice(0, 1), heading: 0 }, tags: ['!autodocs'], play: async ({ canvas }) => { await expect(canvas.getByRole('region', { name: '0' })).toBeInTheDocument(); } };
export const EmptyHeading: Story = { args: { articles: articles.slice(0, 1), heading: '' }, tags: ['!autodocs'], play: async ({ canvasElement }) => { await expect(canvasElement.querySelector('header')).toBeNull(); } };
export const Light: Story = { globals: { theme: 'light' }, tags: ['!autodocs'] };
export const RTL: Story = { args: { dir: 'rtl' }, tags: ['!autodocs'] };
export const LongText: Story = { args: { articles: articles.map((article) => ({ ...article, headline: `${article.headline} — ${article.headline}`, label: 'Northline'.repeat(20), place: 'Northline'.repeat(20) })), heading: 'Northline'.repeat(20) }, tags: ['!autodocs'] };
export const Styling: Story = {
  tags: ['!autodocs'],
  args: { articles: articles.slice(0, 4), sx: { paddingInline: vars.space[4] }, slotProps: { root: { sx: { paddingInline: vars.space[2] } }, heading: { sx: { color: vars.color.accentText } }, band: { sx: { paddingBlock: vars.space[4] } }, article: { sx: { paddingInline: vars.space[2] } }, listItem: { sx: { paddingBlock: vars.space[4] } } } },
  play: async ({ canvasElement }) => {
    const section = canvasElement.querySelector('[data-ui~="article-section"]')!;
    const band = canvasElement.querySelectorAll('[data-ui~="article-section-band"]')[1]!;
    const article = canvasElement.querySelector('[data-ui~="article"]')!;
    const item = canvasElement.querySelector('[data-ui~="article-list-item"]')!;
    await expect(getComputedStyle(section).paddingInlineStart).toBe(base.space[4]);
    await expect(getComputedStyle(band).paddingBlockStart).toBe(base.space[4]);
    await expect(getComputedStyle(article).paddingInlineStart).toBe(base.space[2]);
    await expect(getComputedStyle(item).paddingBlockStart).toBe(base.space[4]);
    await expect(canvasElement.querySelector('[sx]')).toBeNull();
  },
};

function ReorderExample() {
  const [items, setItems] = useState(articles.slice(0, 3));
  return <Stack>
    <Button onClick={() => setItems(([lead, first, second]) => [lead!, second!, first!])}>Swap pair</Button>
    <ArticleSection heading="Northline" articles={items} />
  </Stack>;
}
export const Reorder: Story = {
  tags: ['!autodocs'], render: () => <ReorderExample />,
  play: async ({ canvas, userEvent }) => {
    const before = canvas.getAllByRole('link');
    await userEvent.click(canvas.getByRole('button', { name: 'Swap pair' }));
    const after = canvas.getAllByRole('link');
    await expect(after).toHaveLength(3);
    await expect(after[0]).toBe(before[0]);
    await expect(after[1]).toBe(before[2]);
    await expect(after[2]).toBe(before[1]);
  },
};
export const PartialBands: Story = {
  tags: ['!autodocs'],
  render: () => <Stack>{[1, 2, 3, 4, 7, 8, 9, 10, 11, 12].map((count) => <ArticleSection key={count} articles={articles.slice(0, count)} data-count={count} />)}</Stack>,
  play: async ({ canvasElement }) => {
    await expect(planArticleSection(11).map(({ kind, start, end }) => ({ kind, start, end }))).toEqual([
      { kind: 'wide', start: 0, end: 1 },
      { kind: 'pair', start: 1, end: 3 },
      { kind: 'headlines', start: 3, end: 7 },
      { kind: 'feature', start: 7, end: 11 },
    ]);
    for (const section of canvasElement.querySelectorAll('[data-ui~="article-section"]')) {
      await expect(section.querySelectorAll('a')).toHaveLength(Number(section.getAttribute('data-count')));
    }
    for (let count = 0; count <= 100; count++) {
      const plan = planArticleSection(count);
      await expect(plan).toEqual(planArticleSection(count));
      await expect(plan.flatMap(({ start, end }) => Array.from({ length: end - start }, (_, index) => start + index))).toEqual(Array.from({ length: count }, (_, index) => index));
      for (const band of plan) {
        await expect(band.end).toBeGreaterThan(band.start);
        await expect(band.treatments).toHaveLength(band.end - band.start);
      }
    }
  },
};
const clicked = fn((event: MouseEvent<HTMLAnchorElement>) => event.preventDefault());
function renderLink(props: ComponentPropsWithRef<'a'>) { return <a {...props} data-router="true" onClick={clicked} />; }
export const ArticleLinks: Story = {
  tags: ['!autodocs'],
  args: { articles: articles.slice(0, 11).map((article) => ({ ...article, renderLink })) },
  play: async ({ canvasElement, userEvent }) => {
    clicked.mockClear();
    const links = [...canvasElement.querySelectorAll<HTMLAnchorElement>('a')];
    await expect(links).toHaveLength(11);
    for (const link of links) {
      await userEvent.tab();
      await expect(link.ownerDocument.activeElement).toBe(link);
      await expect(getComputedStyle(link).outlineStyle).not.toBe('none');
      await expect(link).toHaveAttribute('data-router', 'true');
    }
    await userEvent.keyboard('{Enter}');
    await expect(clicked).toHaveBeenCalledTimes(1);
  },
};
export const Hydration: Story = {
  tags: ['!autodocs'], args: { articles: articles.slice(0, 4) },
  play: async ({ canvasElement }) => {
    const tracker = createRefCleanupTracker<HTMLElement>();
    await expectArticleHydration(<ArticleSection articles={articles.slice(0, 4)} heading="Northline" ref={tracker.ref} />, canvasElement);
    await expect(tracker.getAttachCount()).toBeGreaterThan(0);
    await expect(tracker.getCleanupCount()).toBe(tracker.getAttachCount());
  },
};
