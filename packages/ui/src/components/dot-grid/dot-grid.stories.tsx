import { StrictMode, useState, type RefCallback } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { Card } from '../card';
import { ThemeRoot } from '../theme-root';
import { DotGrid, type DotGridProps } from './index';

const labels = { pause: 'Pause motion', resume: 'Resume motion' };
const fieldStyle = { inlineSize: 'min(100%, 40rem)', minBlockSize: '16rem' };
const observationMs = 100;
const delay = () => new Promise((resolve) => setTimeout(resolve, observationMs));
const dotCounts = new WeakMap<HTMLCanvasElement, { value: number }>();

function observeCanvas(element: HTMLCanvasElement | null) {
  if (!element) return;
  const context = element.getContext('2d');
  if (!context) return;
  const fill = context.fill;
  const arc = context.arc;
  const dotCount = { value: 0 };
  dotCounts.set(element, dotCount);
  context.fill = fn(() => Reflect.apply(fill, context, [])) as typeof fill;
  context.arc = (x, y, radius, start, end, counterclockwise) => {
    dotCount.value++;
    arc.call(context, x, y, radius, start, end, counterclockwise);
  };
  return () => { context.fill = fill; context.arc = arc; };
}

function sceneIn(element: HTMLElement) { return element.querySelector('canvas')!; }
function fillSpy(element: HTMLCanvasElement) { return element.getContext('2d')!.fill as ReturnType<typeof fn>; }

const meta = {
  title: 'Surfaces/DotGrid', component: DotGrid, tags: ['autodocs'],
  args: {
    controlLabels: labels, style: fieldStyle, onPausedChange: fn(),
    children: <h2>Explore the workspace</h2>, slotProps: { scene: { ref: observeCanvas } },
  },
  parameters: {
    docs: {
      description: { component: 'A decorative dot field with an independent foreground and native pause button. Children size the surface; supply a blockSize for an empty field. maxDots increases effective spacing when necessary. label names only the decoration. Reduced motion is static; forced colors clears the canvas. Tab follows foreground controls and the pause button; Enter and Space toggle pause. The canvas has no keyboard shortcuts.' },
      source: { code: '<DotGrid controlLabels={{ pause: "Pause motion", resume: "Resume motion" }} style={{ minBlockSize: "16rem" }}>\n  <h2>Explore the workspace</h2>\n</DotGrid>' },
    },
  },
} satisfies Meta<typeof DotGrid>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, canvas }) => {
    await expect(sceneIn(canvasElement)).toHaveAttribute('aria-hidden', 'true');
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument();
    await expect(canvas.getByRole('heading', { name: 'Explore the workspace' })).toBeVisible();
    await waitFor(async () => { await expect(sceneIn(canvasElement).width).toBeGreaterThan(0); });
    const scene = sceneIn(canvasElement);
    await expect(scene.width / scene.getBoundingClientRect().width).toBeLessThanOrEqual(2.01);
  },
};
export const Static: Story = {
  args: { interactive: false },
  play: async ({ canvasElement, canvas }) => {
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
    await delay();
    const draw = fillSpy(sceneIn(canvasElement));
    const count = draw.mock.calls.length;
    await delay();
    await expect(draw).toHaveBeenCalledTimes(count);
  },
};
export const NoRipple: Story = { args: { ripple: false } };
export const NoFade: Story = {
  args: { fade: false },
  play: async ({ canvasElement }) => {
    await expect(getComputedStyle(sceneIn(canvasElement)).maskImage).toBe('none');
  },
};
export const DenseBudget: Story = {
  args: { gap: 1, maxDots: 2000, interactive: false },
  play: async ({ canvasElement }) => {
    await delay();
    const scene = sceneIn(canvasElement);
    const arcs = dotCounts.get(scene)!;
    const draw = fillSpy(scene);
    await expect(arcs.value / (draw.mock.calls.length / 2)).toBeLessThanOrEqual(2000);
    await expect(arcs.value).toBeGreaterThan(0);
  },
};
export const Labelled: Story = {
  args: { label: 'Violet dot field', children: <Button>Open workspace</Button> },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Violet dot field' })).not.toHaveAttribute('aria-hidden');
    await expect(canvas.getByRole('button', { name: 'Open workspace' })).toBeVisible();
  },
};
export const ForegroundActions: Story = {
  args: { children: <Button onClick={fn()}>Open workspace</Button>, onClick: fn(), strength: 0 },
  render: (args) => <Card><DotGrid {...args} /></Card>,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open workspace' }));
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    await delay();
    const draw = fillSpy(sceneIn(canvasElement));
    const count = draw.mock.calls.length;
    await delay();
    await expect(draw).toHaveBeenCalledTimes(count);
    await userEvent.click(canvas.getByRole('button', { name: 'Pause motion' }));
  },
};
export const ForegroundLabel: Story = {
  args: { strength: 0, children: <label><input type="checkbox" style={{ inlineSize: vars.space[8], blockSize: vars.space[8] }} />Enable notifications</label> },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByText('Enable notifications'));
    await expect(canvas.getByRole('checkbox', { name: 'Enable notifications' })).toBeChecked();
    await delay();
    const draw = fillSpy(sceneIn(canvasElement));
    const count = draw.mock.calls.length;
    await delay();
    await expect(draw).toHaveBeenCalledTimes(count);
    await userEvent.click(canvas.getByRole('button', { name: 'Pause motion' }));
  },
};
export const LightTheme: Story = { globals: { theme: 'light' }, decorators: [withLightTheme] };
export const RTL: Story = {
  args: { dir: 'rtl', defaultPaused: true, children: <Button>Open workspace</Button> },
  play: async ({ canvasElement }) => {
    const controls = canvasElement.querySelector<HTMLElement>('[data-ui="dot-grid-controls"]')!;
    await expect(getComputedStyle(controls).direction).toBe('rtl');
    await expect(getComputedStyle(controls).justifyContent).toBe('flex-end');
  },
};
export const ReducedMotion: Story = {
  parameters: { docs: { description: { story: 'Enable prefers-reduced-motion: reduce in browser rendering tools. This story checks structure; media emulation is verified separately.' } } },
  play: async ({ canvasElement }) => {
    await expect(sceneIn(canvasElement)).toHaveAttribute('aria-hidden', 'true');
  },
};
export const ForcedColors: Story = {
  args: { label: 'Dot field' },
  parameters: { docs: { description: { story: 'Enable forced-colors: active in browser rendering tools. The named canvas remains an image with cleared pixels; this play checks its semantics only.' } } },
  play: async ({ canvas }) => { await expect(canvas.getByRole('img', { name: 'Dot field' })).toBeInTheDocument(); },
};
export const ZeroSize: Story = {
  args: { interactive: false, children: null, style: { inlineSize: 0, blockSize: 0 }, slotProps: { scene: { ref: observeCanvas }, content: { css: { padding: 0 } } } },
  play: async ({ canvasElement }) => {
    await delay();
    const scene = sceneIn(canvasElement);
    await expect(scene.width).toBe(0);
    await expect(scene.height).toBe(0);
    await expect(fillSpy(scene)).not.toHaveBeenCalled();
  },
};

function ResizeExample(args: DotGridProps) {
  const [expanded, setExpanded] = useState(false);
  return <><Button onClick={() => setExpanded(!expanded)}>Resize field</Button>
    <DotGrid {...args} style={{ inlineSize: expanded ? 500 : 300, blockSize: expanded ? 300 : 180 }} /></>;
}
export const Resize: Story = {
  args: { interactive: false }, render: (args) => <ResizeExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Resize field' }));
    const scene = sceneIn(canvasElement);
    await waitFor(async () => { await expect(Math.abs(scene.getBoundingClientRect().width - 500)).toBeLessThan(1); });
    await waitFor(async () => { await expect(Math.abs(scene.width / Math.min(devicePixelRatio, 2) - 500)).toBeLessThan(1); });
  },
};
export const Paused: Story = {
  args: { defaultPaused: true },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(canvas.getByRole('button', { name: 'Resume motion' })).toBeVisible();
    await userEvent.hover(canvas.getByRole('heading'));
    await delay();
    const draw = fillSpy(sceneIn(canvasElement));
    const count = draw.mock.calls.length;
    await delay();
    await expect(draw).toHaveBeenCalledTimes(count);
  },
};
export const ImmediateFreeze: Story = {
  play: async ({ canvasElement, canvas, userEvent, args }) => {
    await userEvent.hover(canvas.getByRole('heading'));
    await delay();
    await userEvent.click(canvas.getByRole('button', { name: 'Pause motion' }));
    await delay();
    const draw = fillSpy(sceneIn(canvasElement));
    const count = draw.mock.calls.length;
    await delay();
    await expect(draw).toHaveBeenCalledTimes(count);
    await expect(args.onPausedChange).toHaveBeenCalledTimes(1);
    await expect(args.onPausedChange).toHaveBeenLastCalledWith(true);
  },
};
export const Keyboard: Story = {
  args: { children: <Button>Open workspace</Button> },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const action = canvas.getByRole('button', { name: 'Open workspace' });
    await userEvent.tab();
    await expect(action.ownerDocument.activeElement).toBe(action);
    await userEvent.tab();
    const pause = canvas.getByRole('button', { name: 'Pause motion' });
    await expect(pause.ownerDocument.activeElement).toBe(pause);
    await expect(getComputedStyle(pause).outlineStyle).not.toBe('none');
    await expect(Math.abs(parseFloat(getComputedStyle(pause).outlineWidth) - 2)).toBeLessThan(1.1);
    await userEvent.keyboard('{Enter}');
    await expect(args.onPausedChange).toHaveBeenCalledTimes(1);
    await expect(args.onPausedChange).toHaveBeenNthCalledWith(1, true);
    await expect(canvas.getByRole('button', { name: 'Resume motion' })).toBe(pause);
    await expect(pause.ownerDocument.activeElement).toBe(pause);
    await userEvent.keyboard(' ');
    await expect(args.onPausedChange).toHaveBeenCalledTimes(2);
    await expect(args.onPausedChange).toHaveBeenNthCalledWith(2, false);
    await userEvent.keyboard('{ArrowLeft}{Home}{End}{Escape}');
    await expect(args.onPausedChange).toHaveBeenCalledTimes(2);
    await userEvent.tab({ shift: true });
    await expect(action.ownerDocument.activeElement).toBe(action);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expect(args.onPausedChange).toHaveBeenCalledTimes(3);
    await expect(canvasElement.querySelector('[data-ui="dot-grid"]')).toHaveAttribute('data-paused', 'true');
  },
};

function ControlledExample(args: DotGridProps) {
  const [paused, setPaused] = useState(true);
  return <><Button onClick={() => setPaused(!paused)}>Set external pause</Button><DotGrid {...args} paused={paused} /></>;
}
export const ControlledPausedRejects: Story = {
  render: (args) => <ControlledExample {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const resume = canvas.getByRole('button', { name: 'Resume motion' });
    await userEvent.click(resume);
    await expect(args.onPausedChange).toHaveBeenCalledTimes(1);
    await expect(args.onPausedChange).toHaveBeenLastCalledWith(false);
    await expect(canvas.getByRole('button', { name: 'Resume motion' })).toBe(resume);
    await userEvent.click(canvas.getByRole('button', { name: 'Set external pause' }));
    await expect(canvas.getByRole('button', { name: 'Pause motion' })).toBe(resume);
    await expect(args.onPausedChange).toHaveBeenCalledTimes(1);
    await userEvent.click(resume);
    await expect(args.onPausedChange).toHaveBeenCalledTimes(2);
    await expect(args.onPausedChange).toHaveBeenLastCalledWith(true);
    await expect(canvas.getByRole('button', { name: 'Pause motion' })).toBe(resume);
    await userEvent.click(canvas.getByRole('button', { name: 'Set external pause' }));
  },
};
function DefaultSeedExample(args: DotGridProps) {
  const [seed, setSeed] = useState(true);
  return <><Button onClick={() => setSeed(!seed)}>Change default pause</Button><DotGrid {...args} defaultPaused={seed} /></>;
}
export const DefaultPauseSeed: Story = {
  render: (args) => <DefaultSeedExample {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Change default pause' }));
    await expect(canvas.getByRole('button', { name: 'Resume motion' })).toBeVisible();
    await expect(args.onPausedChange).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Resume motion' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Change default pause' }));
    await expect(canvas.getByRole('button', { name: 'Pause motion' })).toBeVisible();
    await expect(args.onPausedChange).toHaveBeenCalledTimes(1);
  },
};
export const ExternalAria: Story = {
  args: { label: 'Dot field', 'aria-labelledby': 'field-name missing-name', 'aria-describedby': 'field-description missing-description', slotProps: { scene: { 'aria-labelledby': 'field-name', 'aria-describedby': 'field-description' } } },
  render: (args) => <><p id="field-name">Workspace backdrop</p><p id="field-description">Workspace overview</p>
    <DotGrid {...args} /><DotGrid {...args} /></>,
  play: async ({ canvasElement }) => {
    const roots = canvasElement.querySelectorAll('[data-ui="dot-grid"]');
    for (const root of roots) {
      await expect(root).toHaveAttribute('aria-labelledby', 'field-name missing-name');
      await expect(root).toHaveAttribute('aria-describedby', 'field-description missing-description');
      await expect(root.querySelector('canvas')).toHaveAttribute('aria-labelledby', 'field-name');
      await expect(root.querySelector('canvas')).toHaveAttribute('aria-describedby', 'field-description');
    }
    const scenes = canvasElement.querySelectorAll('canvas');
    await expect(scenes[0]!.id).not.toBe(scenes[1]!.id);
  },
};
export const FalsyChildren: Story = {
  args: { interactive: false, style: { minBlockSize: 48 } },
  render: (args) => <>{[false, null, 0, ''].map((child, index) => <DotGrid {...args} key={index}>{child}</DotGrid>)}</>,
  play: async ({ canvasElement }) => {
    const contents = canvasElement.querySelectorAll('[data-ui="dot-grid-content"]');
    await expect(contents[0]).toBeEmptyDOMElement();
    await expect(contents[1]).toBeEmptyDOMElement();
    await expect(contents[2]).toHaveTextContent('0');
    await expect(contents[3]).toBeEmptyDOMElement();
  },
};

const refCleanup = fn();
const attachRoot = fn<RefCallback<HTMLDivElement>>(() => refCleanup);
function CleanupExample(args: DotGridProps) {
  const [mounted, setMounted] = useState(true);
  return <><Button onClick={() => setMounted(!mounted)}>Toggle field</Button>
    {mounted && <StrictMode><DotGrid {...args} ref={attachRoot} /></StrictMode>}</>;
}
export const StrictModeCleanup: Story = {
  render: (args) => <CleanupExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const root = canvasElement.querySelector('[data-ui="dot-grid"]');
    await expect(attachRoot).toHaveBeenCalledWith(root);
    const scene = sceneIn(canvasElement);
    const draw = fillSpy(scene);
    await userEvent.hover(canvas.getByRole('heading'));
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle field' }));
    await expect(refCleanup).toHaveBeenCalled();
    const count = draw.mock.calls.length;
    const pixels = scene.toDataURL();
    await delay();
    await expect(draw).toHaveBeenCalledTimes(count);
    await expect(scene.toDataURL()).toBe(pixels);
    await expect(canvasElement.querySelector('canvas')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle field' }));
  },
};
export const CanvasUnavailable: Story = {
  args: { label: 'Dot field', children: <Button>Open workspace</Button>, slotProps: { scene: { ref: (element) => {
    if (!element) return;
    const original = element.getContext;
    element.getContext = (() => null) as typeof original;
    return () => { element.getContext = original; };
  } } } },
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getByRole('img', { name: 'Dot field' })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Pause motion' }));
    await expect(args.onPausedChange).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('button', { name: 'Resume motion' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Open workspace' })).toBeVisible();
  },
};

function ThemeExample(args: DotGridProps) {
  const [light, setLight] = useState(false);
  return <><Button onClick={() => setLight(!light)}>Change field theme</Button>
    <ThemeRoot theme={light ? 'light' : 'dark'}><DotGrid {...args} /></ThemeRoot></>;
}
export const ScopedTheme: Story = {
  args: { defaultPaused: true }, render: (args) => <ThemeExample {...args} />,
  play: async ({ canvasElement, canvas, userEvent }) => {
    await delay();
    const scene = sceneIn(canvasElement);
    const before = getComputedStyle(scene).getPropertyValue('--dot-grid-color');
    await userEvent.click(canvas.getByRole('button', { name: 'Change field theme' }));
    await waitFor(async () => { await expect(getComputedStyle(scene).getPropertyValue('--dot-grid-color')).not.toBe(before); });
    await expect(scene.getContext('2d')!.fillStyle).toBe(getComputedStyle(scene).getPropertyValue('--dot-grid-active-color').trim());
  },
};
export const SlotStyles: Story = {
  args: { defaultPaused: true, sx: { paddingInline: vars.space[3] }, slotProps: {
    scene: { css: { '--dot-grid-color': vars.color.accent } },
    content: { css: { paddingInline: vars.space[8] } }, controls: { css: { justifyContent: 'flex-start' } },
    pauseButton: { css: { minInlineSize: '10rem' } },
  } },
  play: async ({ canvasElement, canvas }) => {
    const content = canvasElement.querySelector('[data-ui="dot-grid-content"]')!;
    await expect(getComputedStyle(content).paddingInlineStart).toBe('32px');
    await expect(getComputedStyle(canvasElement.querySelector('[data-ui="dot-grid-controls"]')!).justifyContent).toBe('flex-start');
    await expect(canvas.getByRole('button', { name: 'Resume motion' }).getBoundingClientRect().width).toBeGreaterThanOrEqual(159);
  },
};
export const InvalidParameters: Story = {
  args: { interactive: false, style: { inlineSize: 320, blockSize: 200 } },
  render: (args) => <><DotGrid {...args} gap={-1} dotSize={0} radius={NaN} strength={Infinity} maxDots={2001} />
    <DotGrid {...args} /></>,
  play: async ({ canvasElement }) => {
    await delay();
    const scenes = canvasElement.querySelectorAll('canvas');
    await expect(dotCounts.get(scenes[0]!)!.value).toBeGreaterThan(0);
    await expect(scenes[0]!.toDataURL()).toBe(scenes[1]!.toDataURL());
  },
};
export const Offscreen: Story = {
  play: async ({ canvasElement, canvas, userEvent, args }) => {
    await userEvent.hover(canvas.getByRole('heading'));
    await delay();
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="dot-grid"]')!;
    root.style.marginBlockStart = '3000px';
    await delay();
    const draw = fillSpy(sceneIn(canvasElement));
    const count = draw.mock.calls.length;
    await delay();
    await expect(draw).toHaveBeenCalledTimes(count);
    root.style.marginBlockStart = '';
    await waitFor(async () => { await expect(draw.mock.calls.length).toBeGreaterThan(count + 2); });
    await expect(args.onPausedChange).not.toHaveBeenCalled();
  },
};
export const VisibilityGate: Story = {
  parameters: { docs: { description: { story: 'This test simulates the document visibility signal; it does not claim a physical background-tab check.' } } },
  play: async ({ canvasElement, canvas, userEvent, args }) => {
    await userEvent.hover(canvas.getByRole('heading'));
    await delay();
    const scene = sceneIn(canvasElement);
    const doc = scene.ownerDocument;
    const descriptor = Object.getOwnPropertyDescriptor(doc, 'hidden');
    const draw = fillSpy(scene);
    try {
      Object.defineProperty(doc, 'hidden', { configurable: true, value: true });
      doc.dispatchEvent(new Event('visibilitychange'));
      const count = draw.mock.calls.length;
      await delay();
      await expect(draw).toHaveBeenCalledTimes(count);
      await expect(args.onPausedChange).not.toHaveBeenCalled();
    } finally {
      if (descriptor) Object.defineProperty(doc, 'hidden', descriptor);
      else Reflect.deleteProperty(doc, 'hidden');
      doc.dispatchEvent(new Event('visibilitychange'));
    }
    await expect(canvas.getByRole('button', { name: 'Pause motion' })).toBeVisible();
  },
};
