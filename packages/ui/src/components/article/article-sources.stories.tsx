import { createRef, type ComponentPropsWithRef, type MouseEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { Article } from './index';
import { expectArticleHydration } from '../../testing/article-assertions';
import type { PresentationHeadingProps } from '../../utils/presentation-slot';
import { createRefCleanupTracker } from '../../testing/interior-slot-assertions';

const items = [{ id: 'edition', label: 'Morning edition', href: '#edition' }, { id: 'record', label: 'Station record' }];
const meta = {
  title: 'Media/Article', component: Article.Sources, tags: ['!autodocs'],
  args: { title: 'Coverage', items },
  parameters: { docs: {
    description: { component: 'List an article’s coverage or primary documents as linked or plain labels.' },
    source: { language: 'tsx', code: `import { Article } from '@jfrader/ui';

<Article.Sources title="Coverage" items={[{ id: 'edition', label: 'Morning edition', href: '#edition' }, { id: 'record', label: 'Station record' }]} />` },
    sections: [
      { title: 'Source lists', stories: ['SourcesInline', 'SourcesStacked', 'SourcesPlain'] },
      { title: 'Accessibility', stories: ['SourcesExternalName'] },
      { title: 'Links', stories: ['SourcesLinkAdapter'] },
    ],
    usage: `### Sources
Supply prepared source labels and destinations with stable ids. Empty collections render nothing.

### Accessibility
Give the source section an accessible name, even when it has no visible title. Choose a title heading level that fits the article outline. Tab moves between links and Enter follows them; plain source labels are not keyboard stops.`,
  } },
} satisfies Meta<typeof Article.Sources>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SourcesInline: Story = { name: 'Inline coverage', parameters: { docs: { description: { story: 'Mix linked and plain sources in a wrapping list.' } } }, play: async ({ canvasElement }) => {
  const section = canvasElement.querySelector('section')!; const heading = section.querySelector('h2')!;
  await expect(section).toHaveAttribute('aria-labelledby', heading.id);
  await expect(section.querySelectorAll('ul > li')).toHaveLength(2);
  await expect(section.querySelectorAll('a')).toHaveLength(1);
  const root = createRefCleanupTracker<HTMLElement>(); const headingTracker = createRefCleanupTracker<HTMLHeadingElement>();
  await expectArticleHydration(<Article.Sources title="Coverage" items={items} ref={root.ref} slotProps={{ heading: { ref: headingTracker.ref } }} />, canvasElement);
  for (const tracker of [root, headingTracker]) { await expect(tracker.getAttachCount()).toBeGreaterThan(0); await expect(tracker.getCleanupCount()).toBe(tracker.getAttachCount()); }
} };
export const SourcesStacked: Story = {
  name: 'Stacked documents',
  args: { variant: 'stacked', title: 'Primary documents' },
  parameters: {
    docs: {
      description: { story: 'Put each primary document on its own line.' },
      source: {
        language: 'tsx',
        code: `import { Article } from '@jfrader/ui';

<Article.Sources
  variant="stacked"
  title="Primary documents"
  items={[
    { id: 'edition', label: 'Morning edition', href: '#edition' },
    { id: 'record', label: 'Station record' },
  ]}
/>`,
      },
    },
  },
};
export const SourcesPlain: Story = {
  name: 'Unlinked source',
  args: { items: [{ id: 'record', label: 'Station record' }] },
  parameters: {
    docs: {
      description: { story: 'List a source that has no destination link.' },
      source: {
        language: 'tsx',
        code: `import { Article } from '@jfrader/ui';

<Article.Sources
  title="Coverage"
  items={[
    { id: 'record', label: 'Station record' },
  ]}
/>`,
      },
    },
  },
};
export const SourcesEmpty: Story = { args: { items: [] }, play: async ({ canvasElement }) => { await expect(canvasElement.querySelector('section')).toBeNull(); } };
export const SourcesExternalName: Story = {
  name: 'Without a visible title',
  args: { title: undefined, 'aria-label': 'Coverage' },
  parameters: { docs: { description: { story: 'Name the source section for assistive technology without a visible title.' }, source: { language: 'tsx', code: `import { Article } from '@jfrader/ui';

<Article.Sources
  aria-label="Coverage"
  items={[
    { id: 'edition', label: 'Morning edition', href: '#edition' },
    { id: 'record', label: 'Station record' },
  ]}
/>` } } },
};
export const SourcesEmptyTitle: Story = { args: { title: '', 'aria-label': 'Coverage' }, play: async ({ canvasElement }) => { await expect(canvasElement.querySelector('h2')).toBeNull(); await expect(canvasElement.querySelector('section')).toHaveAttribute('aria-label', 'Coverage'); } };
export const SourcesExternalRelationship: Story = { render: () => <div><span id="coverage-label">Coverage</span><Article.Sources aria-labelledby="coverage-label" items={items} /></div> };
export const SourcesMergedRelationships: Story = { render: () => <div><span id="external-coverage">Northline</span><span id="slot-coverage">Station</span><Article.Sources title="Coverage" aria-labelledby="external-coverage" items={items} slotProps={{ root: { 'aria-labelledby': 'slot-coverage' }, heading: { id: 'custom-coverage-title' } }} /></div>, play: async ({ canvasElement }) => {
  await expect(canvasElement.querySelector('section')).toHaveAttribute('aria-labelledby', 'custom-coverage-title external-coverage slot-coverage');
} };
export const SourcesZero: Story = { args: { title: 0, items: [{ id: 'zero', label: 0 }] } };
export const SourcesLongText: Story = { args: { items: [{ id: 'long', label: 'Northline'.repeat(60), href: '#edition' }, ...items] } };
export const SourcesRTL: Story = { args: { dir: 'rtl' } };
export const SourcesLight: Story = { globals: { theme: 'light' } };
export const SourcesHeadingLevels: Story = { render: () => <div><Article.Sources title="Edition" level={1} items={items} /><Article.Sources title="Northline" level={2} items={items} /><Article.Sources title="Station" level={3} items={items} /><Article.Sources title="Platform" level={4} items={items} /><Article.Sources title="Inspection" level={5} items={items} /><Article.Sources title="Record" level={6} items={items} /></div> };
const clicked = fn((event: MouseEvent<HTMLAnchorElement>) => event.preventDefault());
function renderLink(props: ComponentPropsWithRef<'a'>) { return <a {...props} data-adapter="router" />; }
export const SourcesLinkAdapter: Story = {
  name: 'Source link adapter',
  args: { items: [{ id: 'edition', label: 'Morning edition', href: '#edition', renderLink }], slotProps: { link: { onClick: clicked, target: '_blank', rel: 'author' } } },
  parameters: {
    docs: {
      description: { story: 'Render a source link through an app-owned anchor adapter.' },
      source: {
        language: 'tsx',
        code: `import type { ComponentPropsWithRef } from 'react';
import { Article } from '@jfrader/ui';

function RouterLink(props: ComponentPropsWithRef<'a'>) {
  return <a {...props} data-adapter="router" />;
}

<Article.Sources
  title="Coverage"
  items={[
    {
      id: 'edition',
      label: 'Morning edition',
      href: '#edition',
      renderLink: RouterLink,
    },
  ]}
  slotProps={{
    link: {
      target: '_blank',
      rel: 'author',
    },
  }}
/>`,
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    const link = canvasElement.querySelector('a')!;
    await expect(link).toHaveAttribute('data-adapter', 'router');
    await expect(link).toHaveAttribute('rel', 'author noopener noreferrer');
    await expect(canvasElement.querySelector('a a')).toBeNull();
    clicked.mockClear();
    await userEvent.tab(); await expect(link.ownerDocument.activeElement).toBe(link);
    await expect(getComputedStyle(link).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}'); await expect(clicked).toHaveBeenCalledTimes(1);
  },
};
function Section(props: ComponentPropsWithRef<'section'>) { return <section {...props} data-replacement="section" />; }
function Heading({ level = 2, ...props }: PresentationHeadingProps) { const Element = `h${level}` as const; return <Element {...props} data-replacement="heading" />; }
function List(props: ComponentPropsWithRef<'ul'>) { return <ul {...props} data-replacement="list" />; }
function Item(props: ComponentPropsWithRef<'li'>) { return <li {...props} data-replacement="item" />; }
function Link(props: ComponentPropsWithRef<'a'>) { return <a {...props} data-replacement="link" />; }
const rootRef = createRef<HTMLElement>();
export const SourcesReplacementSlots: Story = {
  args: { ref: rootRef, slots: { root: Section, heading: Heading, list: List, item: Item, link: Link }, id: 'consumer-sources', className: 'consumer', sx: { '--article-font-body': vars.font.mono }, slotProps: { root: { id: 'slot-sources', 'data-ui': 'custom article-sources', className: 'slot' }, item: { id: 'not-repeated' }, link: { id: 'not-repeated-link' } } },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import type { ComponentPropsWithRef } from 'react';
import { Article, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const MonoSources = styled(Article.Sources)({
  '--article-font-body': vars.font.mono,
});

function Section(props: ComponentPropsWithRef<'section'>) {
  return <section {...props} />;
}
function Heading({ level = 2, ...props }: ComponentPropsWithRef<'h2'> & { level?: 1 | 2 | 3 | 4 | 5 | 6 }) {
  const Element = \`h\${level}\` as const;
  return <Element {...props} />;
}
function List(props: ComponentPropsWithRef<'ul'>) {
  return <ul {...props} />;
}
function Item(props: ComponentPropsWithRef<'li'>) {
  return <li {...props} />;
}
function Link(props: ComponentPropsWithRef<'a'>) {
  return <a {...props} />;
}

<MonoSources
  title="Coverage"
  items={[
    { id: 'edition', label: 'Morning edition', href: '#edition' },
    { id: 'record', label: 'Station record' },
  ]}
  slots={{
    root: Section,
    heading: Heading,
    list: List,
    item: Item,
    link: Link,
  }}
/>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(rootRef.current).toHaveAttribute('id', 'slot-sources'); await expect(rootRef.current).toHaveClass('slot', 'consumer');
    await expect(rootRef.current).toHaveAttribute('data-ui', 'article-sources custom');
    await expect(canvasElement.querySelector('a')?.tagName).toBe('A');
    await expect(canvasElement.querySelector('#not-repeated, #not-repeated-link')).toBeNull();
    await expect(canvasElement.querySelectorAll('[data-replacement]')).toHaveLength(6);
    await expect(getComputedStyle(canvasElement.querySelector('ul')!).fontFamily).toContain('monospace');
  },
};
