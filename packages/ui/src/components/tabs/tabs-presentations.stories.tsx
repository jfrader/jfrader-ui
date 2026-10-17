import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef } from 'react';
import { expect, fireEvent, fn, spyOn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { expectTranslucentContrast } from '../../testing/contrast-assertions';
import { Tabs, type TabsEasyProps } from './tabs';

const Frame = styled.div({ boxSizing: 'border-box', inlineSize: `min(24rem, calc(100vw - ${vars.space[8]}))`, padding: vars.space[4] });
const NarrowFrame = styled.div({ maxInlineSize: '100%', inlineSize: '16rem' });
const ScrollArea = styled.div({ overflowY: 'auto', blockSize: '8rem', marginBlockStart: vars.space[4] });
const ScrollContent = styled.div({ blockSize: '40rem', backgroundColor: vars.color.surfaceRaised });
function ScrollExample(props: TabsEasyProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return <><Tabs {...props} collapseOnScroll scrollRef={scrollRef} /><ScrollArea ref={scrollRef} data-testid="scroll-host"><ScrollContent /></ScrollArea></>;
}
const Glyph = styled.svg({ fill: 'none', stroke: 'currentColor', strokeWidth: 2 });
function HomeIcon() { return <Glyph viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v11H3Z" /><path d="M9 21v-8h6v8" /></Glyph>; }
function SavedIcon() { return <Glyph viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4Z" /></Glyph>; }
function SearchIcon() { return <Glyph viewBox="0 0 24 24"><circle cx="10" cy="10" r="7" /><path d="m15 15 6 6" /></Glyph>; }

const sections = [
  { value: 'home', label: 'Home', panel: 'Recent activity', icon: <HomeIcon /> },
  { value: 'saved', label: 'Saved', panel: 'Your saved items', icon: <SavedIcon /> },
  { value: 'search', label: 'Search', panel: 'Search your library', icon: <SearchIcon /> },
];
const source = `<Tabs variant="glass" defaultValue="home" label="Library" items={[
  { value: 'home', label: 'Home', icon: <HomeIcon />, panel: 'Recent activity' },
  { value: 'saved', label: 'Saved', icon: <SavedIcon />, panel: 'Your saved items' },
  { value: 'search', label: 'Search', icon: <SearchIcon />, panel: 'Search your library' },
]} />`;
const meta = {
  title: 'Navigation/Tabs', component: Tabs, tags: ['!autodocs'],
  args: { label: 'Library', items: sections, defaultValue: 'home', variant: 'glass', onValueChange: fn() },
  parameters: { docs: { description: { component: 'Switch between panels by choosing a tab.' }, source: { language: 'tsx', code: source } } },
  decorators: [(Story) => <Frame><Story /></Frame>],
  render: (args) => <Tabs {...args} />,
} satisfies Meta<TabsEasyProps>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Keep tab targets large while labels remain available to assistive technology. */
export const GlassKeyboard: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await expectTranslucentContrast(canvas.getByRole('tablist'));
    const home = canvas.getByRole('tab', { name: 'Home' });
    await userEvent.tab();
    await expect(home).toHaveFocus();
    await expect(getComputedStyle(home).outlineStyle).not.toBe('none');
    for (const tab of canvas.getAllByRole('tab')) await expect(tab.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'Saved' })).toHaveFocus();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('tabpanel', { name: 'Saved' })).toHaveTextContent('Your saved items');
    await userEvent.keyboard('{End}{ArrowRight}');
    await expect(home).toHaveAttribute('aria-selected', 'true');
    await userEvent.tab();
    await expect(canvas.getByRole('tabpanel', { name: 'Home' })).toHaveFocus();
  },
};
/** Show only the selected label, with localized counts. */
export const LiquidLabels: Story = {
  args: { variant: 'liquid', labels: 'active', locale: 'de-DE', items: sections.map((item) => ({ ...item, badge: item.value === 'saved' ? 12345 : 0, badgeLabel: item.value === 'saved' ? '12.345 gespeicherte Einträge' : undefined })) },
  parameters: { docs: { source: { language: 'tsx', code: source.replace('variant="glass"', 'variant="liquid" labels="active" locale="de-DE"') } } },
  play: async ({ canvas, userEvent }) => {
    const saved = canvas.getByRole('tab', { name: 'Saved' });
    await expect(saved).toHaveAccessibleDescription('12.345 gespeicherte Einträge');
    await expect(canvas.queryByText('0')).not.toBeInTheDocument();
    await expect(canvas.getByText(new Intl.NumberFormat('de-DE').format(12345))).toBeVisible();
    await userEvent.click(saved);
    await expect(saved).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.getByRole('tabpanel', { name: 'Saved' }).id).toBe(saved.getAttribute('aria-controls'));
  },
};
/** Use the same material in a light theme. */
export const GlassLight: Story = { globals: { theme: 'light' }, play: async ({ canvas }) => { await expectTranslucentContrast(canvas.getByRole('tablist')); } };
/** Move to the logical next tab with Left in RTL. */
export const LiquidRTL: Story = {
  args: { variant: 'liquid', dir: 'rtl', labels: 'none' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvas.getByRole('tab', { name: 'Saved' })).toHaveFocus();
    await expect(canvas.getByRole('tab', { name: 'Saved' })).toHaveAttribute('aria-selected', 'true');
  },
};
/** Enable reduced motion in the browser to remove selection travel. */
export const LiquidReducedMotion: Story = {
  args: { variant: 'liquid' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('tab', { name: 'Search' }));
    await expect(canvas.getByRole('tabpanel', { name: 'Search' })).toBeVisible();
  },
};
/** Manual activation keeps selection on the committed panel when requests are rejected. */
export const MaterialControlledReject: Story = {
  args: { value: 'home', compact: true, activation: 'manual', onCompactChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await expect(args.onCompactChange).toHaveBeenCalledWith(false);
    await userEvent.keyboard('{ArrowRight}{Enter}');
    const saved = canvas.getByRole('tab', { name: 'Saved' });
    await expect(saved).toHaveFocus();
    await expect(getComputedStyle(saved).outlineStyle).not.toBe('none');
    await expect(saved).toHaveAttribute('aria-selected', 'false');
    await expect(canvas.getByRole('tabpanel', { name: 'Home' })).toBeVisible();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(canvas.getByRole('tablist').parentElement).toHaveAttribute('data-compact', 'true');
  },
};
/** Unknown values leave all panels and the decorative selection hidden. */
export const MaterialUnknownValue: Story = {
  args: { value: 'missing' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(canvas.queryByRole('tabpanel')).not.toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-ui="tabs-selection"]')).toBeNull();
    await userEvent.tab();
    await expect(canvas.getByRole('tab', { name: 'Home' })).toHaveFocus();
  },
};
/** Scroll long labels rather than shrinking the targets. */
export const MaterialNarrowOverflow: Story = {
  args: { items: sections.map((item) => ({ ...item, label: `${item.label} — your personal collection` })) },
  decorators: [(Story) => <NarrowFrame><Story /></NarrowFrame>],
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{End}');
    const tab = canvas.getAllByRole('tab')[2]!;
    const list = canvas.getByRole('tablist');
    await waitFor(async () => {
      await expect(tab.getBoundingClientRect().right).toBeLessThanOrEqual(list.getBoundingClientRect().right);
    });
  },
};
/** A separate action-shaped tab owns a real panel. */
export const GlassActionPanel: Story = {
  render: () => <Tabs variant="glass" defaultValue="search"><Tabs.List aria-label="Library"><Tabs.Tab value="home" icon={<HomeIcon />}>Home</Tabs.Tab><Tabs.Tab value="search" variant="action" icon={<SearchIcon />}>Search</Tabs.Tab></Tabs.List><Tabs.Panel value="home">Recent activity</Tabs.Panel><Tabs.Panel value="search">Search your library</Tabs.Panel></Tabs>,
  parameters: { docs: { source: { language: 'tsx', code: `<Tabs variant="glass" defaultValue="search">
  <Tabs.List aria-label="Library">
    <Tabs.Tab value="home">Home</Tabs.Tab>
    <Tabs.Tab value="search" variant="action">Search</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="home">Recent activity</Tabs.Panel>
  <Tabs.Panel value="search">Search your library</Tabs.Panel>
</Tabs>` } } },
};
/** Drag the selected surface to a destination; cancelling keeps the current panel. */
export const MaterialDragSelection: Story = {
  args: { variant: 'liquid', draggableIndicator: true },
  play: async ({ canvas, args }) => {
    const list = canvas.getByRole('tablist');
    const home = canvas.getByRole('tab', { name: 'Home' });
    const search = canvas.getByRole('tab', { name: 'Search' });
    const a = home.getBoundingClientRect();
    const b = search.getBoundingClientRect();
    const start = { pointerId: 1, isPrimary: true, button: 0, clientX: a.left + a.width / 2, clientY: a.top + a.height / 2 };
    const capture = spyOn(list, 'setPointerCapture').mockImplementation(() => {});
    try {
    fireEvent.pointerDown(home, start);
    fireEvent.pointerMove(list, { ...start, clientX: b.left + b.width / 2 });
    fireEvent.pointerCancel(list, start);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    fireEvent.pointerDown(home, start);
    fireEvent.pointerMove(list, { ...start, clientX: b.left + b.width / 2 });
    fireEvent.pointerUp(list, { ...start, clientX: b.left + b.width / 2 });
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('search');
    await expect(search).toHaveAttribute('aria-selected', 'true');
    await expect(list.style.getPropertyValue('--tabs-preview-x')).toBe('');
    } finally { capture.mockRestore(); }
  },
};

/** Scrolling down compacts the bar; focusing a tab expands it and pauses collapse. */
export const GlassElementScroll: Story = {
  render: (args) => <ScrollExample {...args} />,
  parameters: { docs: { source: { language: 'tsx', code: `const scrollRef = useRef<HTMLDivElement>(null);

<Tabs variant="glass" label="Library" defaultValue="home" collapseOnScroll scrollRef={scrollRef}
  items={[
    { value: 'home', label: 'Home', icon: <HomeIcon />, panel: 'Recent activity' },
    { value: 'saved', label: 'Saved', icon: <SavedIcon />, panel: 'Your saved items' },
  ]} />
<div ref={scrollRef}>Page content</div>` } } },
  play: async ({ canvas, userEvent }) => {
    const host = canvas.getByTestId('scroll-host');
    const root = canvas.getByRole('tablist').parentElement;
    host.scrollTop = 20;
    fireEvent.scroll(host);
    await expect(root).toHaveAttribute('data-compact', 'true');
    await userEvent.tab();
    await expect(root).toHaveAttribute('data-compact', 'false');
    host.scrollTop = 80;
    fireEvent.scroll(host);
    await expect(root).toHaveAttribute('data-compact', 'false');
  },
};
