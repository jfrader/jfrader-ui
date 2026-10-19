import { createRef, type ComponentPropsWithRef, type MouseEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { SectionHeading } from './index';
import { expectArticleHydration } from '../../testing/article-assertions';
import type { PresentationHeadingProps } from '../../utils/presentation-slot';
import { createRefCleanupTracker } from '../../testing/interior-slot-assertions';

const meta = {
  title: 'Media/SectionHeading', component: SectionHeading, tags: ['autodocs'], args: { title: 'Northline' },
  parameters: { docs: { description: { component: 'Introduce a section with a title, optional kicker and supporting content.' }, source: { code: '<SectionHeading title="Northline" kicker="Morning edition" href="#northline" accessory="Station record" />' }, usage: `### Heading
Choose level 1–6 to match the page outline; level 2 is the default. Use ruled for a bottom rule or plain for text alone. Kicker and accessory are optional. Accessory adds no heading, navigation or section semantics.

### Links
Supply href or renderLink for the title link. A renderLink adapter forwards the resolved native anchor props, className, children and ref. Use slots.link instead for structural replacement, not alongside renderLink. Tab and Enter retain native behavior. Keep linked titles free of nested links.

### Customization
Use sx on the header, component or slots.root for root replacement, and matching slots/slotProps for root, kicker, heading, link and accessory. slots.root wins over component. Forward native props, ref, className and data-ui. Inherited --article-font-heading, --article-font-label and --article-rule-color use token fallbacks.` } },
} satisfies Meta<typeof SectionHeading>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ruled: Story = { play: async ({ canvasElement }) => {
  await expect(canvasElement.querySelector('header > h2')).toHaveTextContent('Northline');
  await expect(canvasElement.querySelector('a, p, [data-ui~="section-heading-accessory"]')).toBeNull();
  const root = createRefCleanupTracker<HTMLElement>(); const link = createRefCleanupTracker<HTMLAnchorElement>();
  await expectArticleHydration(<SectionHeading title="Northline" href="#northline" ref={root.ref} slotProps={{ link: { ref: link.ref } }} />, canvasElement);
  for (const tracker of [root, link]) { await expect(tracker.getAttachCount()).toBeGreaterThan(0); await expect(tracker.getCleanupCount()).toBe(tracker.getAttachCount()); }
} };
export const Plain: Story = { args: { variant: 'plain', level: 1 } };
export const Kicker: Story = { args: { kicker: 'Morning edition' } };
export const Linked: Story = { args: { href: '#northline' } };
export const Accessory: Story = { args: { accessory: 'Station record' } };
export const Complete: Story = { args: { kicker: 'Morning edition', href: '#northline', accessory: 'Station record' } };
export const Zero: Story = { args: { title: 0, kicker: 0, accessory: 0 } };
export const EmptyOptionals: Story = { args: { kicker: null, accessory: false } };
export const EmptyTitle: Story = { args: { title: '' }, play: async ({ canvasElement }) => { await expect(canvasElement.querySelector('header, h2')).toBeNull(); } };
export const LongText: Story = { args: { title: 'Northline'.repeat(60), kicker: 'Morning edition', href: '#northline', accessory: 'Station record' } };
export const RTL: Story = { args: { dir: 'rtl', kicker: 'Morning edition', href: '#northline', accessory: 'Station record' } };
export const Light: Story = { globals: { theme: 'light' }, args: { kicker: 'Morning edition', href: '#northline' } };
export const HeadingLevels: Story = { render: () => <article><SectionHeading title="Edition" level={1} /><SectionHeading title="Northline" level={2} /><SectionHeading title="Station" level={3} /><SectionHeading title="Platform" level={4} /><SectionHeading title="Inspection" level={5} /><SectionHeading title="Record" level={6} /></article>, play: async ({ canvasElement }) => { for (const level of [1, 2, 3, 4, 5, 6]) await expect(canvasElement.querySelector(`h${level}`)).not.toBeNull(); } };
const clicked = fn((event: MouseEvent<HTMLAnchorElement>) => event.preventDefault());
function renderLink(props: ComponentPropsWithRef<'a'>) { return <a {...props} data-adapter="router" />; }
export const LinkAdapter: Story = { args: { renderLink, href: '#northline', slotProps: { link: { onClick: clicked } } }, play: async ({ canvasElement, userEvent }) => {
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
export const ReplacementSlots: Story = { args: { ref: rootRef, kicker: 'Morning edition', accessory: 'Station record', href: '#northline', slots: { root: Header, kicker: P, heading: H, link: A, accessory: Div }, className: 'consumer', id: 'consumer-heading', slotProps: { root: { id: 'slot-heading', className: 'slot', 'data-ui': 'custom section-heading' }, heading: { ref: headingRef }, link: { ref: linkRef, target: '_blank', rel: 'author' } } }, play: async ({ canvasElement }) => {
  await expect(rootRef.current).toHaveAttribute('id', 'slot-heading'); await expect(rootRef.current).toHaveClass('slot', 'consumer'); await expect(rootRef.current).toHaveAttribute('data-ui', 'section-heading custom');
  await expect(headingRef.current?.tagName).toBe('H2'); await expect(linkRef.current).toHaveAttribute('rel', 'author noopener noreferrer');
  await expect(canvasElement.querySelectorAll('[data-replacement]')).toHaveLength(5);
} };
