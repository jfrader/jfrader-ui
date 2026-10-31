import { Profiler, useId, useState, type ProfilerOnRenderCallback } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { AutoEllipsis } from './index';

const LONG = 'Quarterly revenue report for the northern region, final draft with comments';
const SHORT = 'Invoice 2041';
const RTL_TEXT = 'דוח הכנסות רבעוני לאזור הצפון, טיוטה סופית עם הערות';
const ELLIPSIS = '…';
// Tooltip's default hover delay is 300ms; wait past it before asserting that nothing opened.
const PAST_OPEN_DELAY_MS = 450;

const Lane = styled.div({
  inlineSize: 240,
  maxInlineSize: '100%',
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.md,
  lineHeight: vars.lineHeight.base,
});
const NarrowLane = styled(Lane)({ inlineSize: 120 });
const ResizableLane = styled(Lane)({ inlineSize: 360, '&[data-narrow]': { inlineSize: 140 } });
const Heading = styled.h3({
  margin: 0,
  inlineSize: 240,
  maxInlineSize: '100%',
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.lg,
  fontWeight: vars.fontWeight.semibold,
});
const Column = styled.div({ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: vars.space[3] });

const laneSource = `import { AutoEllipsis, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Lane = styled.div({ inlineSize: 240, maxInlineSize: '100%', color: vars.color.text,
   fontFamily: vars.font.sans, fontSize: vars.textSize.md, lineHeight: vars.lineHeight.base });`;

function parts(canvasElement: HTMLElement) {
  const root = canvasElement.querySelector<HTMLElement>('[data-ui~="auto-ellipsis"]')!;
  const visible = root.querySelector<HTMLElement>('[data-ui="auto-ellipsis-text"]');
  const full = root.querySelector<HTMLElement>('[data-ui="auto-ellipsis-full"]')!;
  return { root, visible, full };
}

function tooltipOf(canvasElement: HTMLElement) {
  return canvasElement.ownerDocument.querySelector<HTMLElement>('[data-ui="tooltip"]');
}

async function pastOpenDelay() {
  await new Promise((resolve) => setTimeout(resolve, PAST_OPEN_DELAY_MS));
}

// The cut string fits the root's content box, and no more than about one glyph of room is left over.
async function expectTightFit(canvasElement: HTMLElement, text: string) {
  const { root, visible } = parts(canvasElement);
  await waitFor(() => expect(visible?.textContent?.endsWith(ELLIPSIS)).toBe(true));
  const shown = visible!.textContent!;
  await expect(shown.length).toBeLessThan(text.length);
  await expect(text.startsWith(shown.slice(0, -1).trimEnd())).toBe(true);
  const available = root.clientWidth;
  const used = visible!.getBoundingClientRect().width;
  const style = getComputedStyle(root);
  const slack = Number.parseFloat(style.fontSize) * 1.5 + (Number.parseFloat(style.letterSpacing) || 0) * 2;
  await expect(used).toBeLessThanOrEqual(available + 0.5);
  await expect(available - used).toBeLessThan(slack);
}

const meta = {
  title: 'Data display/AutoEllipsis',
  component: AutoEllipsis,
  tags: ['autodocs'],
  args: { text: LONG },
  render: (args) => (
    <Lane>
      <AutoEllipsis {...args} />
    </Lane>
  ),
  parameters: {
    docs: {
      sections: [
        { title: 'Fit', stories: ['Default', 'ShortText', 'Narrow', 'FixedWidth', 'LetterSpacing'] },
        { title: 'Full text', stories: ['HoverAndFocus', 'InHeading', 'WithoutTooltip'] },
        { title: 'Layout', stories: ['Resize', 'RTL'] },
        { title: 'States', stories: ['WithoutTruncation', 'LightTheme'] },
      ],
      description: {
        component: 'Fit one line of text to its space, ending in an ellipsis, with the full text in a tooltip.',
      },
      usage: `### When to use

Use for one line of text in a shared or fixed column: table cells, list rows, file names, and breadcrumbs.

### Keyboard and accessibility

Assistive technology reads the full text; the cut string is hidden from it. While the text is cut, Tab focuses it and the tooltip shows the full text on hover and focus. Press Escape to close the tooltip. When the text fits, or with \`tooltip={false}\`, it is not focusable and shows no tooltip.

### Values and constraints

The root fills the inline size its container gives it. The cut falls on a character boundary and the ellipsis sits at the inline end, which is the left edge in right-to-left text. Measurement uses the computed font, letter spacing, word spacing, and uppercase or lowercase \`text-transform\`, and runs after mount, on resize, on text change, and when web fonts load. Server output shows the full text on one line, clipped. Nothing animates, so reduced motion changes nothing; in forced colors the text and focus outline take system colors.`,
      source: { language: 'tsx', code: `${laneSource}

<Lane>
  <AutoEllipsis text="${LONG}" />
</Lane>` },
    },
  },
} satisfies Meta<typeof AutoEllipsis>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Cut long text',
  parameters: { docs: { description: { story: 'Cut a long title to the width of its 240px column.' } } },
  play: async ({ canvasElement }) => {
    await expectTightFit(canvasElement, LONG);
    const { root, visible, full } = parts(canvasElement);
    await expect(root).toHaveAttribute('data-truncated', 'true');
    await expect(root).toHaveAttribute('tabindex', '0');
    await expect(visible).toHaveAttribute('aria-hidden', 'true');
    await expect(full).toHaveTextContent(LONG);
    await expect(getComputedStyle(full).position).toBe('absolute');
    await expect(getComputedStyle(full).opacity).toBe('1');
    await expect(full.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    await expect(visible!.getBoundingClientRect().height).toBeGreaterThan(1);
  },
};

export const ShortText: Story = {
  name: 'Fit short text',
  args: { text: SHORT },
  parameters: { docs: {
    description: { story: 'Short text keeps every character and shows no tooltip.' },
    source: { language: 'tsx', code: `${laneSource}

<Lane>
  <AutoEllipsis text="${SHORT}" />
</Lane>` },
  } },
  play: async ({ canvasElement, userEvent }) => {
    const { root, visible } = parts(canvasElement);
    await expect(visible).toHaveTextContent(SHORT);
    await expect(visible!.textContent).toBe(SHORT);
    await expect(root).not.toHaveAttribute('data-truncated');
    await expect(root).not.toHaveAttribute('tabindex');
    await expect(parts(canvasElement).full).toBeNull();
    await expect(visible).not.toHaveAttribute('aria-hidden');
    await expect(root.textContent).toBe(SHORT);
    await userEvent.hover(root);
    await pastOpenDelay();
    await expect(tooltipOf(canvasElement)).toBeNull();
    await userEvent.unhover(root);
  },
};

export const Narrow: Story = {
  name: 'Narrow column',
  render: (args) => (
    <NarrowLane>
      <AutoEllipsis {...args} />
    </NarrowLane>
  ),
  parameters: { docs: {
    description: { story: 'Cut the same title to a 120px column.' },
    source: { language: 'tsx', code: `${laneSource}
const NarrowLane = styled(Lane)({ inlineSize: 120 });

<NarrowLane>
  <AutoEllipsis text="${LONG}" />
</NarrowLane>` },
  } },
  play: async ({ canvasElement }) => {
    await expectTightFit(canvasElement, LONG);
    await expect(parts(canvasElement).root.clientWidth).toBe(120);
  },
};

export const FixedWidth: Story = {
  name: 'Fixed width',
  args: { width: 160 },
  parameters: { docs: {
    description: { story: 'Set `width` to fix the text at 160px wherever it sits.' },
    source: { language: 'tsx', code: `${laneSource}

<Lane>
  <AutoEllipsis text="${LONG}" width={160} />
</Lane>` },
  } },
  play: async ({ canvasElement }) => {
    await expectTightFit(canvasElement, LONG);
    await expect(parts(canvasElement).root.getBoundingClientRect().width).toBe(160);
  },
};

export const LetterSpacing: Story = {
  name: 'Wide uppercase tracking',
  args: { sx: { letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: vars.fontWeight.semibold } },
  parameters: { docs: {
    description: { story: 'Letter spacing, weight, and uppercase text are part of the measurement.' },
    source: { language: 'tsx', code: `${laneSource}

<Lane>
  <AutoEllipsis
    text="${LONG}"
    sx={{ letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: vars.fontWeight.semibold }}
  />
</Lane>` },
  } },
  play: async ({ canvasElement }) => {
    await expectTightFit(canvasElement, LONG);
  },
};

export const HoverAndFocus: Story = {
  name: 'Read the full text',
  parameters: { docs: { description: { story: 'Hover or Tab to the cut text to read all of it. Press Escape to close.' } } },
  play: async ({ canvasElement, userEvent }) => {
    const { root } = parts(canvasElement);
    await waitFor(() => expect(root).toHaveAttribute('data-truncated', 'true'));

    await userEvent.hover(root);
    await waitFor(() => expect(tooltipOf(canvasElement)).toHaveTextContent(LONG));
    await expect(tooltipOf(canvasElement)).toHaveAttribute('role', 'tooltip');
    await expect(tooltipOf(canvasElement)).toHaveAttribute('aria-hidden', 'true');
    await expect(tooltipOf(canvasElement)).not.toHaveAttribute('tabindex');
    await userEvent.unhover(root);
    await waitFor(() => expect(tooltipOf(canvasElement)).toBeNull());

    await userEvent.tab();
    await expect(root.ownerDocument.activeElement).toBe(root);
    await expect(getComputedStyle(root).outlineStyle).not.toBe('none');
    await waitFor(() => expect(tooltipOf(canvasElement)).toHaveTextContent(LONG));
    await expect(root).not.toHaveAttribute('aria-describedby');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(tooltipOf(canvasElement)).toBeNull());
    await expect(root.ownerDocument.activeElement).toBe(root);
    await userEvent.tab();
    await expect(root.ownerDocument.activeElement).not.toBe(root);
  },
};

export const InHeading: Story = {
  name: 'Cut a heading',
  render: (args) => (
    <Heading>
      <AutoEllipsis {...args} />
    </Heading>
  ),
  parameters: { docs: {
    description: { story: 'The heading keeps the full title as its accessible name.' },
    source: { language: 'tsx', code: `import { AutoEllipsis, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Heading = styled.h3({ margin: 0, inlineSize: 240, maxInlineSize: '100%', color: vars.color.text,
  fontFamily: vars.font.sans, fontSize: vars.textSize.lg, fontWeight: vars.fontWeight.semibold });

<Heading>
  <AutoEllipsis text="${LONG}" />
</Heading>` },
  } },
  play: async ({ canvas, canvasElement }) => {
    await expectTightFit(canvasElement, LONG);
    const heading = canvas.getByRole('heading', { level: 3 });
    await expect(heading).toHaveAccessibleName(LONG);
    await expect(canvas.getByRole('heading', { name: LONG })).toBe(heading);
    await expect(canvas.queryByRole('heading', { name: parts(canvasElement).visible!.textContent! })).toBeNull();
  },
};

export const WithoutTooltip: Story = {
  name: 'Without tooltip',
  args: { tooltip: false },
  parameters: { docs: {
    description: { story: 'Set `tooltip={false}` when the full text is shown elsewhere, for example in a details panel.' },
    source: { language: 'tsx', code: `${laneSource}

<Lane>
  <AutoEllipsis text="${LONG}" tooltip={false} />
</Lane>` },
  } },
  play: async ({ canvasElement, userEvent }) => {
    await expectTightFit(canvasElement, LONG);
    const { root } = parts(canvasElement);
    await expect(root).not.toHaveAttribute('tabindex');
    await userEvent.hover(root);
    await pastOpenDelay();
    await expect(tooltipOf(canvasElement)).toBeNull();
    await userEvent.unhover(root);
    await userEvent.tab();
    await expect(root.ownerDocument.activeElement).not.toBe(root);
  },
};

function DescribedHeading() {
  const descriptionId = useId();
  return (
    <Column>
      <Heading><AutoEllipsis text={LONG} aria-describedby={descriptionId} /></Heading>
      <span id={descriptionId}>Draft report</span>
    </Column>
  );
}

export const AccessibleDescription: Story = {
  tags: ['!autodocs'],
  render: () => <DescribedHeading />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expectTightFit(canvasElement, LONG);
    const { root } = parts(canvasElement);
    const descriptionId = root.getAttribute('aria-describedby');
    await userEvent.tab();
    await expect(root).toHaveFocus();
    await waitFor(() => expect(tooltipOf(canvasElement)).toHaveTextContent(LONG));
    await expect(canvas.getByRole('heading', { name: LONG })).toHaveAccessibleName(LONG);
    await expect(root).toHaveAccessibleDescription('Draft report');
    await expect(root).toHaveAttribute('aria-describedby', descriptionId!);
    await expect(tooltipOf(canvasElement)).toHaveAttribute('aria-hidden', 'true');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(tooltipOf(canvasElement)).toBeNull());
    await userEvent.tab({ shift: true });
    await expect(root).not.toHaveFocus();
  },
};

function ResizeDemo(args: Story['args']) {
  const [narrow, setNarrow] = useState(false);
  return (
    <Column>
      <ResizableLane data-narrow={narrow || undefined}>
        <AutoEllipsis text={LONG} {...args} />
      </ResizableLane>
      <Button onClick={() => setNarrow(!narrow)}>{narrow ? 'Widen column' : 'Narrow column'}</Button>
    </Column>
  );
}

export const Resize: Story = {
  name: 'Resize the column',
  args: { text: 'Northern region revenue report' },
  render: (args) => <ResizeDemo {...args} />,
  parameters: { docs: {
    description: { story: 'Narrow and widen the column; the cut follows its width.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { AutoEllipsis, Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Column = styled.div({ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: vars.space[3] });
const ResizableLane = styled.div({ inlineSize: 360, maxInlineSize: '100%', '&[data-narrow]': { inlineSize: 140 } });

function ResizeDemo() {
  const [narrow, setNarrow] = useState(false);
  return (
    <Column>
      <ResizableLane data-narrow={narrow || undefined}>
        <AutoEllipsis text="Northern region revenue report" />
      </ResizableLane>
      <Button onClick={() => setNarrow(!narrow)}>{narrow ? 'Widen column' : 'Narrow column'}</Button>
    </Column>
  );
}` },
  } },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const { root, visible } = parts(canvasElement);
    await expect(visible!.textContent).toBe(args.text);
    await userEvent.click(canvas.getByRole('button', { name: 'Narrow column' }));
    await expectTightFit(canvasElement, args.text!);
    await expect(root).toHaveAttribute('data-truncated', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'Widen column' }));
    await waitFor(() => expect(visible!.textContent).toBe(args.text));
    await expect(root).not.toHaveAttribute('data-truncated');
  },
};

export const RTL: Story = {
  name: 'Right to left',
  args: { text: RTL_TEXT, dir: 'rtl', lang: 'he' },
  parameters: { docs: {
    description: { story: 'In right-to-left text the ellipsis ends the line on the left.' },
    source: { language: 'tsx', code: `${laneSource}

<Lane>
  <AutoEllipsis dir="rtl" lang="he" text="${RTL_TEXT}" />
</Lane>` },
  } },
  play: async ({ canvasElement, userEvent }) => {
    await expectTightFit(canvasElement, RTL_TEXT);
    const { root, visible } = parts(canvasElement);
    const rootBox = root.getBoundingClientRect();
    const textBox = visible!.getBoundingClientRect();
    await expect(Math.abs(rootBox.right - textBox.right)).toBeLessThanOrEqual(1);
    const node = visible!.firstChild!;
    const range = root.ownerDocument.createRange();
    range.setStart(node, node.textContent!.length - 1);
    range.setEnd(node, node.textContent!.length);
    const ellipsisBox = range.getBoundingClientRect();
    await expect(ellipsisBox.left - textBox.left).toBeLessThanOrEqual(1);
    await userEvent.hover(root);
    await waitFor(() => expect(tooltipOf(canvasElement)).toHaveAttribute('dir', 'rtl'));
    await userEvent.unhover(root);
    await waitFor(() => expect(tooltipOf(canvasElement)).toBeNull());
  },
};

export const WithoutTruncation: Story = {
  name: 'Measurement off',
  args: { truncate: false },
  parameters: { docs: {
    description: { story: 'Set `truncate={false}` to show the full text, wrapping onto more lines.' },
    source: { language: 'tsx', code: `${laneSource}

<Lane>
  <AutoEllipsis text="${LONG}" truncate={false} />
</Lane>` },
  } },
  play: async ({ canvasElement, userEvent }) => {
    const { root, visible, full } = parts(canvasElement);
    await expect(full).toBeNull();
    await expect(visible).toBeVisible();
    await expect(visible).toHaveTextContent(LONG);
    await expect(visible).not.toHaveAttribute('aria-hidden');
    await expect(root.textContent).toBe(LONG);
    await expect(root).not.toHaveAttribute('data-truncated');
    await expect(root).not.toHaveAttribute('tabindex');
    await expect(root.getBoundingClientRect().height).toBeGreaterThan(
      Number.parseFloat(getComputedStyle(root).lineHeight) * 1.5,
    );
    await userEvent.hover(root);
    await pastOpenDelay();
    await expect(tooltipOf(canvasElement)).toBeNull();
    await userEvent.unhover(root);
  },
};

export const LightTheme: Story = {
  name: 'Light theme',
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  parameters: { docs: { description: { story: 'Cut text in the light theme.' } } },
};

function ProfiledLane({ text, onRender }: { text: string; onRender: ProfilerOnRenderCallback }) {
  return (
    <Profiler id="auto-ellipsis" onRender={onRender}>
      <Lane>
        <AutoEllipsis text={text} />
      </Lane>
    </Profiler>
  );
}

export const StableRender: StoryObj<typeof ProfiledLane> = {
  tags: ['!autodocs'],
  render: (args) => <ProfiledLane {...args} />,
  args: { text: LONG, onRender: fn() },
  play: async ({ canvasElement, args }) => {
    const onRender = args.onRender as ReturnType<typeof fn>;
    await expectTightFit(canvasElement, LONG);
    const { root, visible } = parts(canvasElement);
    const shown = visible!.textContent;
    const frames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await frames();
    onRender.mockClear();
    // Shrinking into the leftover room and back keeps the same string, so React does not render.
    const width = root.getBoundingClientRect().width;
    const slack = width - visible!.getBoundingClientRect().width;
    root.style.inlineSize = `${width - slack / 2}px`;
    await frames();
    root.style.inlineSize = `${width}px`;
    await frames();
    await expect(visible!.textContent).toBe(shown);
    await expect(onRender).not.toHaveBeenCalled();
    // A resize that changes the string renders once more.
    root.style.inlineSize = '100px';
    await waitFor(() => expect(visible!.textContent).not.toBe(shown));
    await expect(onRender).toHaveBeenCalled();
  },
};

export const Hydration: Story = {
  tags: ['!autodocs'],
  play: async ({ canvasElement }) => {
    const app = (
      <Lane>
        <AutoEllipsis text={LONG} />
      </Lane>
    );
    const host = canvasElement.ownerDocument.createElement('div');
    host.innerHTML = renderToString(app);
    await expect(host.querySelector('[data-ui="auto-ellipsis-text"]')?.textContent).toBe(LONG);
    await expect(host.querySelector('[data-ui~="auto-ellipsis"]')).not.toHaveAttribute('data-truncated');
    canvasElement.append(host);
    const onRecoverableError = fn();
    const root = hydrateRoot(host, app, { onRecoverableError });
    try {
      await expectTightFit(host, LONG);
      await expect(onRecoverableError).not.toHaveBeenCalled();
    } finally {
      root.unmount();
      host.remove();
    }
  },
};

function MountToggle(args: Story['args']) {
  const [mounted, setMounted] = useState(false);
  return (
    <Column>
      {mounted && (
        <Lane>
          <AutoEllipsis text={LONG} {...args} />
        </Lane>
      )}
      <Button onClick={() => setMounted(!mounted)}>{mounted ? 'Remove' : 'Mount'}</Button>
    </Column>
  );
}

export const Cleanup: Story = {
  tags: ['!autodocs'],
  render: (args) => <MountToggle {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const view = canvasElement.ownerDocument.defaultView!;
    const observe = spyOn(view.ResizeObserver.prototype, 'observe');
    const disconnect = spyOn(view.ResizeObserver.prototype, 'disconnect');
    const addListener = spyOn(canvasElement.ownerDocument.fonts, 'addEventListener');
    const removeListener = spyOn(canvasElement.ownerDocument.fonts, 'removeEventListener');
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Mount' }));
      await waitFor(() => expect(parts(canvasElement).root).toHaveAttribute('data-truncated', 'true'));
      const observed = observe.mock.calls.findIndex(([element]) => element === parts(canvasElement).root);
      await expect(observed).toBeGreaterThanOrEqual(0);
      const observer = observe.mock.contexts[observed];
      const listener = addListener.mock.calls.filter(([type]) => type === 'loadingdone').at(-1)?.[1];
      await expect(typeof listener).toBe('function');
      await userEvent.click(canvas.getByRole('button', { name: 'Remove' }));
      await expect(canvasElement.querySelector('[data-ui~="auto-ellipsis"]')).toBeNull();
      await expect(disconnect.mock.contexts).toContain(observer);
      await expect(removeListener.mock.calls.some(([type, removed]) => type === 'loadingdone' && removed === listener)).toBe(true);
    } finally {
      observe.mockRestore();
      disconnect.mockRestore();
      addListener.mockRestore();
      removeListener.mockRestore();
    }
  },
};

export const OutsideFocusOrder: Story = {
  tags: ['!autodocs'],
  args: { text: SHORT },
  render: (args) => (
    <Column>
      <Lane>
        <AutoEllipsis {...args} />
      </Lane>
      <Button>Next</Button>
    </Column>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Next' }));
  },
};

export const MeasurementEdges: Story = {
  tags: ['!autodocs'],
  render: () => (
    <Column>
      <Lane><AutoEllipsis text="" data-case="empty" /></Lane>
      <Lane><AutoEllipsis text="W" width={1} data-case="single" /></Lane>
      <Lane><AutoEllipsis text={LONG} width={0} data-case="zero" /></Lane>
      <Lane><AutoEllipsis text={SHORT} data-case="exact" /></Lane>
    </Column>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const empty = canvasElement.querySelector<HTMLElement>('[data-case="empty"]')!;
    await expect(empty.textContent).toBe('');
    await expect(empty).not.toHaveAttribute('data-truncated');
    await expect(empty).not.toHaveAttribute('tabindex');
    for (const name of ['single', 'zero']) {
      const root = canvasElement.querySelector<HTMLElement>(`[data-case="${name}"]`)!;
      await waitFor(() => expect(root).toHaveAttribute('data-truncated', 'true'));
      await expect(root.querySelector('[data-ui="auto-ellipsis-text"]')?.textContent).toBe('');
      await expect(root.querySelector('[data-ui="auto-ellipsis-full"]')).toHaveTextContent(name === 'single' ? 'W' : LONG);
      await expect(root.getBoundingClientRect().height).toBeGreaterThan(0);
    }
    const exact = canvasElement.querySelector<HTMLElement>('[data-case="exact"]')!;
    const visible = exact.querySelector<HTMLElement>('[data-ui="auto-ellipsis-text"]')!;
    const range = exact.ownerDocument.createRange();
    range.selectNodeContents(visible);
    const width = range.getBoundingClientRect().width;
    exact.style.inlineSize = `${width}px`;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await expect(visible.textContent).toBe(SHORT);
    await expect(exact).not.toHaveAttribute('data-truncated');
    exact.style.inlineSize = `${width - 1}px`;
    await waitFor(() => expect(exact).toHaveAttribute('data-truncated', 'true'));
    await expect(visible.textContent?.endsWith(ELLIPSIS)).toBe(true);
    await userEvent.hover(exact);
    await waitFor(() => expect(tooltipOf(canvasElement)).toHaveTextContent(SHORT));
    await userEvent.unhover(exact);
    await waitFor(() => expect(tooltipOf(canvasElement)).toBeNull());
  },
};

export const FontLifecycle: Story = {
  tags: ['!autodocs'],
  render: (args) => <MountToggle {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const view = canvasElement.ownerDocument.defaultView!;
    const fonts = canvasElement.ownerDocument.fonts;
    let resolveReady!: (fonts: FontFaceSet) => void;
    const pending = new Promise<FontFaceSet>((resolve) => { resolveReady = resolve; });
    const ready = spyOn(fonts, 'ready', 'get').mockReturnValue(pending);
    const measure = spyOn(view.CanvasRenderingContext2D.prototype, 'measureText');
    const computed = spyOn(view, 'getComputedStyle');
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Mount' }));
      await expectTightFit(canvasElement, LONG);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      measure.mockClear();
      computed.mockClear();
      resolveReady(fonts);
      await waitFor(() => expect(measure).toHaveBeenCalled());
      // The search measures strings on canvas, not DOM boxes at every cut point.
      await expect(computed.mock.calls.filter(([element]) => element === parts(canvasElement).root)).toHaveLength(1);
      await expect(measure.mock.calls.length).toBeLessThanOrEqual(Math.ceil(Math.log2(LONG.length)) + 3);
      measure.mockClear();
      fonts.dispatchEvent(new Event('loadingdone'));
      await expect(measure).toHaveBeenCalled();
      let resolveAfterUnmount!: (fonts: FontFaceSet) => void;
      ready.mockReturnValue(new Promise<FontFaceSet>((resolve) => { resolveAfterUnmount = resolve; }));
      await userEvent.click(canvas.getByRole('button', { name: 'Remove' }));
      await userEvent.click(canvas.getByRole('button', { name: 'Mount' }));
      await expectTightFit(canvasElement, LONG);
      const removedRoot = parts(canvasElement).root;
      await userEvent.click(canvas.getByRole('button', { name: 'Remove' }));
      measure.mockClear();
      computed.mockClear();
      resolveAfterUnmount(fonts);
      fonts.dispatchEvent(new Event('loadingdone'));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await expect(measure).not.toHaveBeenCalled();
      await expect(computed.mock.calls.filter(([element]) => element === removedRoot)).toHaveLength(0);
    } finally {
      ready.mockRestore();
      measure.mockRestore();
      computed.mockRestore();
    }
  },
};
