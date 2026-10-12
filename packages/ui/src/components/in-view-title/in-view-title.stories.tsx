import { StrictMode, act, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { ThemeRoot } from '../theme-root';
import { InViewTitle, type InViewTitleProps } from './index';

const meta = {
  title: 'Typography/InViewTitle', component: InViewTitle, tags: ['autodocs'],
  args: { text: 'Tools for teams that ship', sx: { fontSize: vars.textSize['3xl'], fontWeight: vars.fontWeight.semibold, lineHeight: vars.lineHeight.tight } },
  parameters: {
    docs: {
      description: {
        component: 'Reveal a heading as it scrolls into view. Choose the level for the page outline.',
      },
      usage: `**Behavior**

- The entrance runs once, at 45% viewport visibility. A heading that leaves and re-enters stays visible.
- Server-rendered, no-JS and idle content is readable immediately.

**Keyboard**

- No widget keyboard map: Tab skips the heading and every key keeps its native behaviour.`,
      source: { code: '<InViewTitle level={2} variant="line" text={\'Tools for teams\\nthat ship\'} />' },
    },
  },
} satisfies Meta<typeof InViewTitle>;
export default meta;
type Story = StoryObj<typeof meta>;

const observers: ObserverDouble[] = [];
class ObserverDouble implements IntersectionObserver {
  root = null;
  rootMargin = '0px';
  scrollMargin = '0px';
  thresholds: number[];
  target?: Element;
  disconnect = fn();
  observe = fn((target: Element) => { this.target = target; });
  unobserve = fn();
  takeRecords = () => [];
  constructor(private callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.thresholds = Array.isArray(options?.threshold) ? options.threshold : [options?.threshold ?? 0];
    observers.push(this);
  }
  async enter(ratio: number) {
    if (!this.target) throw new Error('Observer has no target');
    const rect = this.target.getBoundingClientRect();
    await act(async () => this.callback([{ target: this.target!, isIntersecting: ratio > 0, intersectionRatio: ratio, boundingClientRect: rect, intersectionRect: rect, rootBounds: null, time: 0 }], this));
  }
}
const observerSetup = () => {
  const original = window.IntersectionObserver;
  observers.length = 0;
  window.IntersectionObserver = ObserverDouble;
  return () => { window.IntersectionObserver = original; observers.length = 0; };
};
const belowRef = (node: HTMLHeadingElement | null) => {
  if (!node) return;
  const original = node.getBoundingClientRect;
  node.getBoundingClientRect = () => new DOMRect(0, (node.ownerDocument.defaultView?.innerHeight ?? 0) + 100, 300, 60);
  return () => { node.getBoundingClientRect = original; };
};
function below(args: InViewTitleProps) { return <InViewTitle {...args} ref={belowRef} />; }
const activeObserver = () => observers[observers.length - 1]!;
const SETTLE_TIMEOUT_MS = 5000;
async function settled(heading: HTMLElement) {
  await waitFor(async () => { await expect(heading).toHaveAttribute('data-state', 'settled'); }, { timeout: SETTLE_TIMEOUT_MS });
}

export const Default: Story = { play: async ({ canvas }) => {
  const heading = canvas.getByRole('heading', { level: 2, name: 'Tools for teams that ship' });
  await expect(heading.querySelector('[data-ui="in-view-title-visual"]')).toHaveAttribute('aria-hidden', 'true');
  await expect(heading).toHaveAttribute('data-state', 'settled');
} };
export const Word: Story = { args: { variant: 'word' } };
export const Line: Story = { args: { variant: 'line', text: 'Tools for teams\nthat ship' } };
export const Blur: Story = {
  args: { variant: 'blur' },
  play: async ({ canvas }) => {
    const clip = getComputedStyle(canvas.getByRole('heading').querySelector('[data-in-view-segment]')!.parentElement!);
    await expect(clip.overflowY).toBe('clip');
    await expect(clip.overflowX).toBe('visible');
  },
};
export const Tracking: Story = { args: { variant: 'tracking' } };
export const Wipe: Story = { args: { variant: 'wipe' } };
export const ScrollIntoView: Story = {
  args: { once: false, variant: 'word', id: 'scroll-section-title' },
  render: (args) => <div><div aria-hidden="true" style={{ minBlockSize: '110vh' }} /><InViewTitle {...args} /></div>,
  parameters: { docs: { description: { story: 'Scroll to the heading to trigger the native observer. Scroll completely past it and return to replay.' } } },
};
export const InViewReveal: Story = {
  beforeEach: observerSetup, render: below,
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading');
    const observer = activeObserver();
    await expect(observer.thresholds).toEqual([0, 0.45]);
    await expect(observer.observe).toHaveBeenCalledTimes(1);
    await expect(observer.observe).toHaveBeenCalledWith(heading);
    await expect(heading).toHaveAttribute('data-state', 'idle');
    await expect(getComputedStyle(heading.querySelector('[data-in-view-segment]')!).opacity).toBe('1');
    await observer.enter(0.44);
    await expect(heading).toHaveAttribute('data-state', 'idle');
    await observer.enter(0.45);
    await expect(heading).toHaveAttribute('data-state', 'revealing');
    await settled(heading);
    await expect(observer.disconnect).toHaveBeenCalledTimes(1);
    await observer.enter(0);
    await observer.enter(1);
    await expect(heading).toHaveAttribute('data-state', 'settled');
  },
};
export const RepeatedEntry: Story = {
  beforeEach: observerSetup, args: { once: false }, render: below,
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading');
    const observer = activeObserver();
    await observer.enter(1);
    await expect(heading).toHaveAttribute('data-state', 'revealing');
    await observer.enter(0);
    await expect(heading).toHaveAttribute('data-state', 'settled');
    await observer.enter(0.45);
    await expect(heading).toHaveAttribute('data-state', 'revealing');
    await settled(heading);
    await expect(observer.disconnect).not.toHaveBeenCalled();
    await observer.enter(0.2);
    await observer.enter(0.8);
    await expect(heading).toHaveAttribute('data-state', 'settled');
    await observer.enter(0);
    await observer.enter(1);
    await expect(heading).toHaveAttribute('data-state', 'revealing');
    await settled(heading);
  },
};
export const WordReveal: Story = { ...InViewReveal, args: { variant: 'word' } };
export const PartialEntry: Story = {
  beforeEach: observerSetup, render: below,
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading');
    const observer = activeObserver();
    await observer.enter(0.2);
    await observer.enter(0);
    await expect(observer.disconnect).not.toHaveBeenCalled();
    await observer.enter(0.45);
    await expect(heading).toHaveAttribute('data-state', 'revealing');
    await settled(heading);
    await expect(observer.disconnect).toHaveBeenCalledTimes(1);
  },
};
export const LineReveal: Story = { ...InViewReveal, args: { variant: 'line', text: 'Tools for teams\nthat ship' } };
export const TrackingReveal: Story = { ...InViewReveal, args: { variant: 'tracking' } };
export const WipeReveal: Story = { ...InViewReveal, args: { variant: 'wipe' } };
export const RTLReveal: Story = { ...InViewReveal, args: { variant: 'wipe', dir: 'rtl', text: 'أدوات للفرق التي تبني' } };
function ResetFixture(args: InViewTitleProps) {
  const [updated, setUpdated] = useState(false);
  return <><Button onClick={() => setUpdated(true)}>Change title</Button><InViewTitle {...args} ref={belowRef} text={updated ? 'Next chapter' : args.text} variant={updated ? 'line' : args.variant} /></>;
}
export const PropReset: Story = {
  beforeEach: observerSetup, render: (args) => <ResetFixture {...args} />,
  play: async ({ canvas, userEvent }) => {
    const previous = activeObserver();
    await previous.enter(1);
    await expect(canvas.getByRole('heading')).toHaveAttribute('data-state', 'revealing');
    await userEvent.click(canvas.getByRole('button', { name: 'Change title' }));
    const heading = canvas.getByRole('heading', { name: 'Next chapter' });
    await expect(previous.disconnect).toHaveBeenCalledTimes(1);
    await expect(heading).toHaveAttribute('data-state', 'idle');
    await previous.enter(1);
    await expect(heading).toHaveAttribute('data-state', 'idle');
    await activeObserver().enter(1);
    await settled(heading);
  },
};
export const ObserverSetupError: Story = {
  beforeEach: () => {
    const original = window.IntersectionObserver;
    window.IntersectionObserver = class extends ObserverDouble { observe = fn(() => { throw new Error('Observer unavailable'); }); };
    return () => { window.IntersectionObserver = original; observers.length = 0; };
  },
  render: below,
  play: async ({ canvas }) => { await expect(canvas.getByRole('heading')).toHaveAttribute('data-state', 'settled'); },
};
export const AlreadyVisible: Story = { ...Default, beforeEach: observerSetup };
export const AlreadyPassed: Story = {
  beforeEach: observerSetup,
  render: (args) => <InViewTitle {...args} ref={(node) => {
    if (!node) return;
    const original = node.getBoundingClientRect;
    node.getBoundingClientRect = () => new DOMRect(0, -100, 300, 60);
    return () => { node.getBoundingClientRect = original; };
  }} />,
  play: async ({ canvas }) => { await expect(canvas.getByRole('heading')).toHaveAttribute('data-state', 'settled'); await expect(observers).toHaveLength(0); },
};
export const HeadingLevels: Story = {
  render: (args) => <>{([1, 2, 3, 4, 5, 6] as const).map((level) => <InViewTitle {...args} key={level} level={level} text={`Level ${level}`} />)}</>,
  play: async ({ canvas }) => { for (const level of [1, 2, 3, 4, 5, 6]) await expect(canvas.getByRole('heading', { level, name: `Level ${level}` })).toBeVisible(); },
};
export const LightTheme: Story = { decorators: [withLightTheme], globals: { theme: 'light' } };
export const ScopedTheme: Story = {
  render: (args) => <ThemeRoot theme="light" sx={{ backgroundColor: vars.color.bg, padding: vars.space[4] }}><InViewTitle {...args} /></ThemeRoot>,
};
export const RTL: Story = { args: { dir: 'rtl', variant: 'wipe', text: 'أدوات للفرق التي تبني' }, play: async ({ canvas }) => { await expect(getComputedStyle(canvas.getByRole('heading')).direction).toBe('rtl'); } };
export const NarrowLines: Story = {
  args: { variant: 'line', text: 'Tools for international teams building thoughtful products\nReady to ship' },
  render: (args) => <div style={{ inlineSize: '12rem', maxInlineSize: '100%' }}><InViewTitle {...args} /></div>,
  play: async ({ canvas }) => { const heading = canvas.getByRole('heading'); await expect(heading.scrollWidth).toBeLessThanOrEqual(heading.clientWidth + 1); },
};
export const Unicode: Story = { args: { text: 'Cafe\u0301 — مرحبًا بالعالم — नमस्ते', locale: 'ar' } };
export const NoSegmenter: Story = {
  args: { text: 'Cafe\u0301 مرحبًا بالعالم' },
  beforeEach: () => {
    const original = Intl.Segmenter;
    Object.defineProperty(Intl, 'Segmenter', { configurable: true, writable: true, value: undefined });
    return () => { Object.defineProperty(Intl, 'Segmenter', { configurable: true, writable: true, value: original }); };
  },
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading', { name: 'Cafe\u0301 مرحبًا بالعالم' });
    await expect(heading.querySelectorAll('[data-in-view-segment]')).toHaveLength(1);
    await expect(heading.querySelector('[data-in-view-segment]')).toHaveTextContent('Cafe\u0301 مرحبًا بالعالم');
  },
};
export const Empty: Story = { args: { text: '', 'aria-label': 'Empty section' }, parameters: { docs: { description: { story: 'Empty visual text requires a consumer-provided accessible name to avoid an empty semantic heading.' } } }, play: async ({ canvasElement }) => { await expect(canvasElement.querySelector('[data-ui="in-view-title-visual"]')?.textContent).toBe(''); } };
export const ZeroString: Story = { args: { text: '0' }, play: async ({ canvas }) => { await expect(canvas.getByRole('heading', { name: '0' })).toBeVisible(); } };
export const Whitespace: Story = { args: { text: '  Tools   for\n\n teams\tthat ship  ' }, play: async ({ canvas }) => { await expect(canvas.getByRole('heading', { name: 'Tools for teams that ship' })).toBeVisible(); } };
export const ExternalAria: Story = {
  render: (args) => <><span id="title-label">External title</span><p id="title-description">Section description</p><InViewTitle {...args} id="section-title" aria-label="Alternate" aria-labelledby="title-label missing-label" aria-describedby="title-description missing-description" /></>,
  play: async ({ canvas }) => { const heading = canvas.getByRole('heading', { name: 'External title' }); await expect(heading).toHaveAttribute('aria-label', 'Alternate'); await expect(heading).toHaveAttribute('aria-labelledby', 'title-label missing-label'); await expect(heading).toHaveAttribute('aria-describedby', 'title-description missing-description'); await expect(heading).toHaveAttribute('id', 'section-title'); },
};
const refSpy = fn();
export const RootRef: Story = { args: { ref: refSpy }, play: async ({ canvas }) => { await expect(refSpy).toHaveBeenCalledWith(canvas.getByRole('heading')); } };
const refCleanup = fn();
const cleanupRef = fn((node: HTMLHeadingElement | null) => node ? refCleanup : undefined);
function RefCleanupFixture(args: InViewTitleProps) {
  const [mounted, setMounted] = useState(true);
  return <><Button onClick={() => setMounted(false)}>Remove title</Button>{mounted && <StrictMode><InViewTitle {...args} /></StrictMode>}</>;
}
export const RefCleanup: Story = {
  args: { ref: cleanupRef }, render: (args) => <RefCleanupFixture {...args} />,
  beforeEach: () => { cleanupRef.mockClear(); refCleanup.mockClear(); },
  play: async ({ canvas, userEvent }) => {
    const heading = canvas.getByRole('heading');
    await expect(cleanupRef).toHaveBeenLastCalledWith(heading);
    const cleanupsBeforeRemoval = refCleanup.mock.calls.length;
    await userEvent.click(canvas.getByRole('button', { name: 'Remove title' }));
    await expect(canvas.queryByRole('heading')).not.toBeInTheDocument();
    await expect(refCleanup).toHaveBeenCalledTimes(cleanupsBeforeRemoval + 1);
    await expect(cleanupRef.mock.calls.some(([node]) => node === null)).toBe(false);
  },
};
export const CustomSx: Story = {
  args: { sx: { fontSize: vars.textSize['2xl'] }, slotProps: { visual: { css: { textDecorationLine: 'underline' } }, segment: { css: { fontStyle: 'italic' } } } },
  render: (args) => <InViewTitle {...args} css={{ fontSize: '1rem' }} />,
  play: async ({ canvas }) => { const heading = canvas.getByRole('heading'); await expect(parseFloat(getComputedStyle(heading).fontSize)).toBeCloseTo(28, 0); await expect(getComputedStyle(heading.querySelector('[data-ui="in-view-title-visual"]')!).textDecorationLine).toBe('underline'); await expect(getComputedStyle(heading.querySelector('[data-in-view-segment]')!).fontStyle).toBe('italic'); },
};
export const KeyboardFlow: StoryObj<InViewTitleProps & { onControlClick: () => void }> = {
  args: { ...meta.args, onControlClick: fn() },
  render: ({ onControlClick, ...args }) => <><Button onClick={onControlClick}>Before</Button><InViewTitle {...args} /><Button onClick={onControlClick}>After</Button></>,
  play: async ({ canvas, userEvent, args }) => {
    const before = canvas.getByRole('button', { name: 'Before' });
    const after = canvas.getByRole('button', { name: 'After' });
    await userEvent.tab(); await expect(before.ownerDocument.activeElement).toBe(before);
    await expect(getComputedStyle(before).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}'); await expect(args.onControlClick).toHaveBeenCalledTimes(1);
    await userEvent.tab(); await expect(after.ownerDocument.activeElement).toBe(after);
    await expect(getComputedStyle(after).outlineStyle).not.toBe('none');
    await userEvent.keyboard(' '); await expect(args.onControlClick).toHaveBeenCalledTimes(2);
    await userEvent.tab({ shift: true }); await expect(before.ownerDocument.activeElement).toBe(before);
    await userEvent.keyboard('{ArrowDown}{Escape}'); await expect(args.onControlClick).toHaveBeenCalledTimes(2);
  },
};
export const NoObserver: Story = {
  beforeEach: () => { const original = window.IntersectionObserver; Object.defineProperty(window, 'IntersectionObserver', { configurable: true, writable: true, value: undefined }); return () => { window.IntersectionObserver = original; }; },
  render: below,
  play: async ({ canvas }) => { const heading = canvas.getByRole('heading'); await expect(heading).toHaveAttribute('data-state', 'settled'); await expect(getComputedStyle(heading.querySelector('[data-in-view-segment]')!).opacity).toBe('1'); },
};
export const ReducedMotion: Story = { parameters: { docs: { description: { story: 'Enable reduced motion in the browser to inspect the plain-text presentation. This story does not emulate the browser media preference; ReducedMotionPreference covers the behavior with a stubbed preference.' } } }, ...Default };
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const reducedMotionPreference = { set: (_matches: boolean) => {} };
function stubReducedMotion(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  const realMatchMedia = window.matchMedia.bind(window);
  const spy = spyOn(window, 'matchMedia').mockImplementation((query: string) => query === REDUCED_MOTION_QUERY
    ? ({
        media: query,
        get matches() { return matches; },
        addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
      } as unknown as MediaQueryList)
    : realMatchMedia(query));
  reducedMotionPreference.set = (next) => { matches = next; listeners.forEach((listener) => listener()); };
  return () => spy.mockRestore();
}
async function expectStill(heading: HTMLElement) {
  await expect(heading).toHaveAttribute('data-state', 'settled');
  for (const segment of heading.querySelectorAll('[data-in-view-segment]')) {
    const style = getComputedStyle(segment);
    await expect(style.animationName).toBe('none');
    await expect(style.opacity).toBe('1');
    await expect(style.transform).toBe('none');
    await expect(style.filter).toBe('none');
    await expect(style.maskImage).toBe('none');
  }
}
function PreferenceFixture(args: InViewTitleProps) {
  const [later, setLater] = useState(false);
  return <><InViewTitle {...args} ref={belowRef} /><Button onClick={() => setLater(true)}>Add title</Button>{later && <InViewTitle {...args} ref={belowRef} text="Next chapter" />}</>;
}
export const ReducedMotionPreference: Story = {
  args: { once: false },
  beforeEach: () => {
    const restoreObserver = observerSetup();
    const restoreMedia = stubReducedMotion(true);
    return () => { restoreMedia(); restoreObserver(); };
  },
  render: (args) => <PreferenceFixture {...args} />,
  parameters: { docs: { description: { story: 'The play stubs `matchMedia`: a reduced-motion preference before mount leaves the heading settled with no observer; switching it on mid-entrance settles the heading and stops replays. Real media emulation is verified in browser QA.' } } },
  play: async ({ canvas, userEvent }) => {
    const first = canvas.getByRole('heading', { name: 'Tools for teams that ship' });
    await expect(window.matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);
    await expect(observers).toHaveLength(0);
    await expectStill(first);
    reducedMotionPreference.set(false);
    await userEvent.click(canvas.getByRole('button', { name: 'Add title' }));
    const second = canvas.getByRole('heading', { name: 'Next chapter' });
    const observer = activeObserver();
    await expect(observers).toHaveLength(1);
    await expect(second).toHaveAttribute('data-state', 'idle');
    await observer.enter(1);
    await expect(second).toHaveAttribute('data-state', 'revealing');
    await act(async () => reducedMotionPreference.set(true));
    await expectStill(second);
    await expect(observer.disconnect).toHaveBeenCalledTimes(1);
    await observer.enter(0);
    await observer.enter(1);
    await expectStill(second);
    await expectStill(first);
  },
};
export const ForcedColors: Story = { parameters: { docs: { description: { story: 'Enable forced colors in the browser to inspect CanvasText and the plain-text presentation. This story does not emulate forced colors.' } } } };
export const StrictModeCleanup: Story = {
  beforeEach: observerSetup, args: { ref: belowRef, once: false },
  render: (args) => <RefCleanupFixture {...args} />,
  play: async ({ canvas, userEvent }) => {
    const heading = canvas.getByRole('heading');
    const observer = activeObserver();
    await expect(heading).toHaveAttribute('data-state', 'idle');
    await expect(observers.slice(0, -1).every((previous) => previous.disconnect.mock.calls.length > 0)).toBe(true);
    await observer.enter(1);
    await settled(heading);
    const disconnectsBeforeRemoval = observer.disconnect.mock.calls.length;
    await userEvent.click(canvas.getByRole('button', { name: 'Remove title' }));
    await expect(observer.disconnect).toHaveBeenCalledTimes(disconnectsBeforeRemoval + 1);
    await observer.enter(0);
    await observer.enter(1);
    await expect(heading).toHaveAttribute('data-state', 'settled');
  },
};
export const SelectionKeepsReadable: Story = {
  beforeEach: observerSetup, render: below, args: { once: false },
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading');
    await activeObserver().enter(1);
    await expect(heading).toHaveAttribute('data-state', 'revealing');
    const range = heading.ownerDocument.createRange();
    range.selectNodeContents(heading);
    const selection = heading.ownerDocument.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    await settled(heading);
    await activeObserver().enter(0);
    await activeObserver().enter(1);
    await expect(heading).toHaveAttribute('data-state', 'settled');
    selection?.removeAllRanges();
  },
};
