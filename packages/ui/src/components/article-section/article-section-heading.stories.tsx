import { createRef, type ComponentPropsWithRef, type MouseEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { ArticleSection } from './index';
import { expectArticleHydration } from '../../testing/article-assertions';
import type { PresentationHeadingProps } from '../../utils/presentation-slot';
import { createRefCleanupTracker } from '../../testing/interior-slot-assertions';

const meta = {
  title: 'Media/ArticleSection', component: ArticleSection.Heading, tags: ['!autodocs'], args: { title: 'Northline' },
  parameters: { docs: { description: { component: 'Introduce a section with a title, optional kicker and supporting content.' }, source: { language: 'tsx', code: `import { ArticleSection } from '@jfrader/ui';

<ArticleSection.Heading title="Northline" />` }, sections: [
    { title: 'Section titles', stories: ['HeadingComplete', 'HeadingRuled', 'HeadingPlain'] },
    { title: 'Links', stories: ['HeadingLinked', 'HeadingLinkAdapter'] },
  ], usage: `### Heading hierarchy
Choose a heading level that fits the page outline. Supporting content adds no section, navigation or heading semantics of its own. An empty title renders nothing.

### Links

Tab focuses the title link and Enter follows it. Keep linked titles free of nested links.` } },
} satisfies Meta<typeof ArticleSection.Heading>;
export default meta;
type Story = StoryObj<typeof meta>;
export const HeadingRuled: Story = { name: 'Ruled title', parameters: { docs: { description: { story: 'Separate the section title from its articles with a bottom rule.' } } }, play: async ({ canvasElement }) => {
  await expect(canvasElement.querySelector('header > h2')).toHaveTextContent('Northline');
  await expect(canvasElement.querySelector('a, p, [data-ui~="article-section-heading-accessory"]')).toBeNull();
  const root = createRefCleanupTracker<HTMLElement>(); const link = createRefCleanupTracker<HTMLAnchorElement>();
  await expectArticleHydration(<ArticleSection.Heading title="Northline" href="#northline" ref={root.ref} slotProps={{ link: { ref: link.ref } }} />, canvasElement);
  for (const tracker of [root, link]) { await expect(tracker.getAttachCount()).toBeGreaterThan(0); await expect(tracker.getCleanupCount()).toBe(tracker.getAttachCount()); }
} };
export const HeadingPlain: Story = {
  name: 'Plain title',
  args: { variant: 'plain', level: 1 },
  parameters: { docs: { description: { story: 'Introduce a top-level section without a rule.' }, source: { language: 'tsx', code: `import { ArticleSection } from '@jfrader/ui';

<ArticleSection.Heading title="Northline" variant="plain" level={1} />` } } },
};
export const HeadingKicker: Story = { args: { kicker: 'Morning edition' } };
export const HeadingLinked: Story = {
  name: 'Linked title',
  args: { href: '#northline' },
  parameters: { docs: { description: { story: 'Link the section title to its coverage.' }, source: { language: 'tsx', code: `import { ArticleSection } from '@jfrader/ui';

<ArticleSection.Heading title="Northline" href="#northline" />` } } },
};
export const HeadingAccessory: Story = { args: { accessory: 'Station record' } };
export const HeadingComplete: Story = {
  name: 'Section introduction',
  args: { kicker: 'Morning edition', href: '#northline', accessory: 'Station record' },
  parameters: { docs: { description: { story: 'Pair a linked section title with an edition label and supporting text.' }, source: { language: 'tsx', code: `import { ArticleSection } from '@jfrader/ui';

<ArticleSection.Heading
  title="Northline"
  kicker="Morning edition"
  href="#northline"
  accessory="Station record"
/>` } } },
};
export const HeadingZero: Story = { args: { title: 0, kicker: 0, accessory: 0 } };
export const HeadingEmptyOptionals: Story = { args: { kicker: null, accessory: false } };
export const HeadingEmptyTitle: Story = { args: { title: '' }, play: async ({ canvasElement }) => { await expect(canvasElement.querySelector('header, h2')).toBeNull(); } };
export const HeadingLongText: Story = { args: { title: 'Northline'.repeat(60), kicker: 'Morning edition', href: '#northline', accessory: 'Station record' } };
export const HeadingRTL: Story = { args: { dir: 'rtl', kicker: 'Morning edition', href: '#northline', accessory: 'Station record' } };
export const HeadingLight: Story = { globals: { theme: 'light' }, args: { kicker: 'Morning edition', href: '#northline' } };
export const HeadingLevels: Story = { render: () => <article><ArticleSection.Heading title="Edition" level={1} /><ArticleSection.Heading title="Northline" level={2} /><ArticleSection.Heading title="Station" level={3} /><ArticleSection.Heading title="Platform" level={4} /><ArticleSection.Heading title="Inspection" level={5} /><ArticleSection.Heading title="Record" level={6} /></article>, play: async ({ canvasElement }) => { for (const level of [1, 2, 3, 4, 5, 6]) await expect(canvasElement.querySelector(`h${level}`)).not.toBeNull(); } };
const clicked = fn((event: MouseEvent<HTMLAnchorElement>) => event.preventDefault());
function renderLink(props: ComponentPropsWithRef<'a'>) { return <a {...props} data-adapter="router" />; }
export const HeadingLinkAdapter: Story = {
  name: 'Title link adapter',
  parameters: { docs: { description: { story: 'Render the title link through an app-owned anchor adapter.' }, source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { ArticleSection } from '@jfrader/ui';

function renderLink(props: ComponentPropsWithRef<'a'>) {
  return <a {...props} data-adapter="router" />;
}

<ArticleSection.Heading
  title="Northline"
  href="#northline"
  renderLink={renderLink}
  slotProps={{ link: { onClick: (event) => event.preventDefault() } }}
/>` } } },
  args: { renderLink, href: '#northline', slotProps: { link: { onClick: clicked } } }, play: async ({ canvasElement, userEvent }) => {
  const link = canvasElement.querySelector('a')!; clicked.mockClear();
  await expect(link).toHaveAttribute('href', '#northline'); await expect(link).toHaveAttribute('data-adapter', 'router'); await expect(canvasElement.querySelector('a a')).toBeNull();
  await userEvent.tab(); await expect(link.ownerDocument.activeElement).toBe(link); await expect(getComputedStyle(link).outlineStyle).not.toBe('none');
  await userEvent.keyboard('{Enter}'); await expect(clicked).toHaveBeenCalledTimes(1);
} };
function Header(props: ComponentPropsWithRef<'header'>) { return <header {...props} data-replacement="root" />; }
function P(props: ComponentPropsWithRef<'p'>) { return <p {...props} data-replacement="kicker" />; }
function H({ level = 2, ...props }: PresentationHeadingProps) { const Element = `h${level}` as const; return <Element {...props} data-replacement="heading" />; }
function A(props: ComponentPropsWithRef<'a'>) { return <a {...props} data-replacement="link" />; }
function Div(props: ComponentPropsWithRef<'div'>) { return <div {...props} data-replacement="accessory" />; }
const rootRef = createRef<HTMLElement>(); const headingRef = createRef<HTMLHeadingElement>(); const linkRef = createRef<HTMLAnchorElement>();
export const HeadingReplacementSlots: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useRef, type ComponentPropsWithRef } from 'react';
import { ArticleSection } from '@jfrader/ui';

function Header(props: ComponentPropsWithRef<'header'>) {
  return <header {...props} data-replacement="root" />;
}
function Kicker(props: ComponentPropsWithRef<'p'>) {
  return <p {...props} data-replacement="kicker" />;
}
function Heading({ level = 2, ...props }: ComponentPropsWithRef<'h2'> & { level?: 1 | 2 | 3 | 4 | 5 | 6 }) {
  const Element = ('h' + level) as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return <Element {...props} data-replacement="heading" />;
}
function Link(props: ComponentPropsWithRef<'a'>) {
  return <a {...props} data-replacement="link" />;
}
function Accessory(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="accessory" />;
}

export function StationHeading() {
  const rootRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  return (
    <ArticleSection.Heading
      ref={rootRef}
      title="Northline"
      kicker="Morning edition"
      accessory="Station record"
      href="#northline"
      slots={{ root: Header, kicker: Kicker, heading: Heading, link: Link, accessory: Accessory }}
      className="consumer"
      id="consumer-heading"
      slotProps={{
        root: { id: 'slot-heading', className: 'slot', 'data-ui': 'custom article-section-heading' },
        heading: { ref: headingRef },
        link: { ref: linkRef, target: '_blank', rel: 'author' },
      }}
    />
  );
}` } } },
  args: { ref: rootRef, kicker: 'Morning edition', accessory: 'Station record', href: '#northline', slots: { root: Header, kicker: P, heading: H, link: A, accessory: Div }, className: 'consumer', id: 'consumer-heading', slotProps: { root: { id: 'slot-heading', className: 'slot', 'data-ui': 'custom article-section-heading' }, heading: { ref: headingRef }, link: { ref: linkRef, target: '_blank', rel: 'author' } } }, play: async ({ canvasElement }) => {
  await expect(rootRef.current).toHaveAttribute('id', 'slot-heading'); await expect(rootRef.current).toHaveClass('slot', 'consumer'); await expect(rootRef.current).toHaveAttribute('data-ui', 'article-section-heading custom');
  await expect(headingRef.current?.tagName).toBe('H2'); await expect(linkRef.current).toHaveAttribute('rel', 'author noopener noreferrer');
  await expect(canvasElement.querySelectorAll('[data-replacement]')).toHaveLength(5);
} };
