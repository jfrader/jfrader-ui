import { StrictMode, useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { MotionConfig } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { dockIcons } from '../../../../../apps/storybook/src/fixtures/dock-icons';
import { motionDurationMs } from '../../styling/motion-timings';
import { styled } from '../../styling/styled';
import { withLightTheme } from '../../testing/story-decorators';
import { expectAligned, expectInside, expectNoOverlap } from '../../testing/geometry-assertions';
import { settleMotion } from '../../testing/motion-assertions';
import { Button } from '../button';
import { Dialog } from '../dialog';
import { ThemeRoot } from '../theme-root';
import { Dock, type DockItem, type DockProps, type DockSlots } from './index';

const icon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
  <path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h3" />
</svg>;
const tools: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: dockIcons.select, shortcut: 'V' },
  { id: 'hand', label: 'Hand', icon: dockIcons.hand, shortcut: 'H' },
  { id: 'locked', label: 'Locked', icon: dockIcons.locked, disabled: true },
  { id: 'text', label: 'Text', icon: dockIcons.text, shortcut: 'T' },
];
const grouped: readonly DockItem[] = [
  tools[0]!,
  { id: 'shapes', label: 'Shapes', items: [
    { id: 'rectangle', label: 'Rectangle', icon: dockIcons.rectangle, shortcut: 'R' },
    { id: 'unavailable', label: 'Polygon', icon: dockIcons.unavailable, disabled: true },
    { id: 'ellipse', label: 'Ellipse', icon: dockIcons.ellipse, shortcut: 'O' },
    { id: 'line', label: 'Line', icon: dockIcons.line },
  ] },
  tools[1]!,
];
const runningTools: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: dockIcons.select, shortcut: 'V', running: true },
  { id: 'hand', label: 'Hand', icon: dockIcons.hand, shortcut: 'H', running: true },
  { id: 'locked', label: 'Locked', icon: dockIcons.locked, disabled: true },
  { id: 'text', label: 'Text', icon: dockIcons.text, shortcut: 'T' },
];
const meta = {
  title: 'Inputs/Dock',
  component: Dock,
  tags: ['autodocs'],
  args: {
    items: tools,
    defaultValue: 'select',
    onValueChange: fn(),
    onOrderChange: fn(),
    onOpenChange: fn(),
    onTrayChange: fn(),
    ref: fn((node: HTMLDivElement | null) => (node ? fn() : undefined)),
  },
  parameters: {
    docs: {
      sections: [
        { title: 'Basic', stories: ['Default'] },
        { title: 'Items', stories: ['RunningTools', 'AlwaysLabelsTouch', 'BadgesLarge', 'BadgesZero', 'LongLabels'] },
        { title: 'Groups', stories: ['Grouped', 'DisabledEmptyGroups'] },
        { title: 'Selection', stories: ['NoSelection', 'RemovedOrDisabledSelection'] },
        { title: 'Reorder', stories: ['Reorderable', 'MoveOptions'] },
        { title: 'Overflow', stories: ['NarrowOverflow'] },
        { title: 'States', stories: ['Controlled', 'Empty'] },
        { title: 'Composition', stories: ['WorkspaceTools'] },
      ],
      description: {
        component: 'Select tools and actions from a dock toolbar with expandable trays.',
      },
      usage: `### When to use
Use Dock for persistent or floating toolbars that hold creative canvas tools, drawing modes, and quick actions. Group related sub-tools into trays to keep primary navigation compact.

### Values and constraints

- Each item and group requires a unique \`id\` across the dock. Nested groups are not supported.
- Trays support one level of grouping and open above or adjacent to their trigger.
- Shortcut badges are visual hints and do not register global keyboard shortcuts.
- \`running\` puts a dot beneath a tool and adds "Running" to its name. The selected tool's dot stretches into a bar.

### Motion

Icons near the pointer grow and rise; the buttons keep their size and position. Touch, persistent labels and reduced motion turn magnification off.

### Keyboard and accessibility

- Left and Right arrow keys move focus through toolbar items and wrap at ends (direction reverses in RTL); Home and End jump to the first and last item.
- Enter or Space activates a tool; on a group, it activates the active child and toggles the tray.
- Arrow Up opens a group tray and focuses the active child item.
- Inside a tray, Left, Right, Home, and End navigate items. Arrow Down or Escape closes the tray and restores focus to the group trigger. Tab or Shift+Tab closes the tray without refocusing the trigger.
- When \`reorderable\` is enabled, Alt+Left and Alt+Right shift the focused item, and the item options menu provides non-drag Move Before and Move After actions.`,
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Hand, Lock, MousePointer2, Type } from 'lucide-react';

const tools: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
  { id: 'locked', label: 'Locked', icon: <Lock size={base.space[5]} />, disabled: true },
  { id: 'text', label: 'Text', icon: <Type size={base.space[5]} />, shortcut: 'T' },
];

<Dock items={tools} defaultValue="select" />`,
      },
    },
  },
} satisfies Meta<typeof Dock>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WorkspaceTools: Story = {
  name: 'Tools in a dialog',
  parameters: { docs: {
    description: { story: 'Open a task dialog containing a named tool dock.' },
    source: { language: 'tsx', code: `import { Dialog, Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Hand, Lock, MousePointer2, Type } from 'lucide-react';

const tools: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
  { id: 'locked', label: 'Locked', icon: <Lock size={base.space[5]} />, disabled: true },
  { id: 'text', label: 'Text', icon: <Type size={base.space[5]} />, shortcut: 'T' },
];

<Dialog triggerLabel="Open drawing tools" title="Drawing tools"
  content={<Dock label="Drawing tools" items={tools} defaultValue="select" />}
  closeLabel="Close" />` },
  } },
  render: () => <Dialog triggerLabel="Open drawing tools" title="Drawing tools"
    content={<Dock label="Drawing tools" items={tools} defaultValue="select" />}
    closeLabel="Close" />,
};

async function assertFocus(button: HTMLElement) {
  await expect(button.ownerDocument.activeElement).toBe(button);
  await expect(getComputedStyle(button).outlineStyle).not.toBe('none');
  await expect(parseFloat(getComputedStyle(button).outlineWidth)).toBeGreaterThan(0.5);
}
function page(canvasElement: HTMLElement) { return within(canvasElement.ownerDocument.body); }
function ids(toolbar: HTMLElement) {
  return Array.from(toolbar.querySelectorAll<HTMLElement>('[data-dock-item]'), (button) => button.dataset.dockItem);
}

async function expectPersistentLabels(container: HTMLElement, placement: 'below' | 'beside' = 'below') {
  await settleMotion(container);
  const buttons = container.querySelectorAll<HTMLButtonElement>('[data-dock-item]');
  await expect(buttons.length).toBeGreaterThan(0);
  for (const button of buttons) {
    const icon = button.querySelector<HTMLElement>('[data-ui="dock-icon"]')!;
    const label = button.querySelector<HTMLElement>('[data-ui="dock-label"]')!;
    await expect(label).toBeVisible();
    if (placement === 'below') {
      await expect(label.getBoundingClientRect().top).toBeGreaterThanOrEqual(icon.getBoundingClientRect().bottom - 1);
    } else {
      await expectNoOverlap(icon, label);
      await expectAligned([icon, label], 'center-y');
    }
    await expectInside(icon, button);
    await expectInside(label, button);
    await expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth + 1);
  }
}

const ScrollingDockPreview = styled('div')({
  overflow: 'auto', boxSizing: 'border-box', padding: vars.space[4],
  inlineSize: `calc(${vars.space[12]} * 8)`, maxInlineSize: '100%',
  blockSize: `calc(${vars.space[12]} * 3)`,
});

export const Default: Story = {
  name: 'Tool dock',
  parameters: {
    docs: {
      description: {
        story: 'Select canvas tools with keyboard navigation and shortcut hints.',
      },
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Hand, Lock, MousePointer2, Type } from 'lucide-react';

const tools: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
  { id: 'locked', label: 'Locked', icon: <Lock size={base.space[5]} />, disabled: true },
  { id: 'text', label: 'Text', icon: <Type size={base.space[5]} />, shortcut: 'T' },
];

<Dock items={tools} defaultValue="select" />`,
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('toolbar', { name: 'Tools' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Select, V, Selected' })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
    for (const button of canvas.getAllByRole('button')) {
      await expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(39);
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(39);
    }
  },
};
export const Light: Story = { ...Default, name: 'Light theme', decorators: [withLightTheme] };
export const RunningTools: Story = {
  name: 'Running tools',
  args: { items: runningTools, defaultValue: 'select' },
  parameters: {
    docs: {
      description: { story: 'Mark tools with an active task; the selected tool shows a longer bar.' },
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Hand, Lock, MousePointer2, Type } from 'lucide-react';

const tools: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V', running: true },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H', running: true },
  { id: 'locked', label: 'Locked', icon: <Lock size={base.space[5]} />, disabled: true },
  { id: 'text', label: 'Text', icon: <Type size={base.space[5]} />, shortcut: 'T' },
];

<Dock items={tools} defaultValue="select" />`,
      },
    },
  },
  play: async ({ canvas }) => {
    const select = canvas.getByRole('button', { name: 'Select, V, Running, Selected' });
    const hand = canvas.getByRole('button', { name: 'Hand, H, Running' });
    const text = canvas.getByRole('button', { name: 'Text, T' });
    // Selected and running differ in shape: a bar against a dot, both against the same baseline.
    const bar = getComputedStyle(select.querySelector('[data-ui="dock-selection"]')!, '::after');
    const dot = hand.querySelector<HTMLElement>('[data-ui="dock-running"]')!.getBoundingClientRect();
    await expect(parseFloat(bar.width)).toBeGreaterThanOrEqual(dot.width * 3);
    await expect(parseFloat(bar.height)).toBeCloseTo(dot.height, 0);
    await expect(dot.width).toBeGreaterThanOrEqual(3);
    await expect(hand.querySelector('[data-ui="dock-selection"]')).toBeNull();
    await expect(text.querySelector('[data-ui="dock-running"]')).toBeNull();
    await expect(text.querySelector('[data-ui="dock-selection"]')).toBeNull();
  },
};
const glyphScale = (button: HTMLElement) =>
  new DOMMatrix(getComputedStyle(button.querySelector('[data-ui="dock-glyph"]')!).transform).a;
export const Magnification: Story = {
  name: 'Pointer magnification',
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    const buttons = ['Select, V, Selected', 'Hand, H', 'Locked', 'Text, T'].map((name) => canvas.getByRole('button', { name }));
    const [select, hand, locked, text] = buttons as [HTMLElement, HTMLElement, HTMLElement, HTMLElement];
    const before = buttons.map((button) => button.getBoundingClientRect());
    const center = hand.getBoundingClientRect();
    await userEvent.pointer({ target: hand, coords: { clientX: center.left + center.width / 2, clientY: center.top + center.height / 2 } });
    await waitFor(() => expect(glyphScale(hand)).toBeGreaterThan(1.38));
    await waitFor(() => expect(glyphScale(select)).toBeGreaterThan(1.15));
    // A smooth falloff: neighbors grow less than the target, the tool two tiles away barely moves.
    await expect(glyphScale(select)).toBeLessThan(glyphScale(hand));
    await expect(Math.abs(glyphScale(select) - glyphScale(locked))).toBeLessThan(0.02);
    await expect(glyphScale(text)).toBeLessThan(1.05);
    await expect(glyphScale(text)).toBeLessThan(glyphScale(select));
    // Targets never move under the pointer.
    buttons.forEach((button, index) => {
      const box = button.getBoundingClientRect();
      expect(Math.abs(box.left - before[index]!.left)).toBeLessThan(0.5);
      expect(Math.abs(box.width - before[index]!.width)).toBeLessThan(0.5);
    });
    await userEvent.pointer({ target: canvasElement.ownerDocument.body, coords: { clientX: 0, clientY: 0 } });
    await waitFor(() => { for (const button of buttons) expect(glyphScale(button)).toBeLessThan(1.01); });
  },
};
export const Grouped: Story = {
  name: 'Grouped tools',
  args: { items: grouped, defaultValue: 'rectangle' },
  parameters: {
    docs: {
      description: { story: 'Open a tray to choose a tool from a related group.' },
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Circle, Hand, Hexagon, Minus, MousePointer2, Square } from 'lucide-react';

const items: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  {
    id: 'shapes',
    label: 'Shapes',
    items: [
      { id: 'rectangle', label: 'Rectangle', icon: <Square size={base.space[5]} />, shortcut: 'R' },
      { id: 'unavailable', label: 'Polygon', icon: <Hexagon size={base.space[5]} />, disabled: true },
      { id: 'ellipse', label: 'Ellipse', icon: <Circle size={base.space[5]} />, shortcut: 'O' },
      { id: 'line', label: 'Line', icon: <Minus size={base.space[5]} /> },
    ],
  },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
];

<Dock items={items} defaultValue="rectangle" />`,
      },
    },
  },
};
export const NoSelection: Story = {
  name: 'No selected tool',
  args: { defaultValue: null },
  parameters: {
    docs: {
      description: { story: 'Start without a selected tool, then choose one.' },
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Hand, Lock, MousePointer2, Type } from 'lucide-react';

const tools: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
  { id: 'locked', label: 'Locked', icon: <Lock size={base.space[5]} />, disabled: true },
  { id: 'text', label: 'Text', icon: <Type size={base.space[5]} />, shortcut: 'T' },
];

<Dock items={tools} defaultValue={null} />`,
      },
    },
  },
};
export const NoSelectionInteraction: Story = {
  ...NoSelection,
  name: 'Select an initially unselected tool',
  tags: ['!autodocs'],
  play: async ({ canvas, userEvent, args }) => {
    for (const button of canvas.getAllByRole('button')) await expect(button).toHaveAttribute('aria-pressed', 'false');
    const select = canvas.getByRole('button', { name: 'Select, V' });
    const hand = canvas.getByRole('button', { name: 'Hand, H' });
    const text = canvas.getByRole('button', { name: 'Text, T' });
    await expect(select.tabIndex).toBe(0);
    await userEvent.tab();
    await assertFocus(select);
    await userEvent.keyboard('{ArrowRight}{Enter}');
    await expect(hand).toHaveAttribute('aria-pressed', 'true');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('hand');
    await userEvent.click(text);
    await expect(text).toHaveAttribute('aria-pressed', 'true');
    await expect(hand).toHaveAttribute('aria-pressed', 'false');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('text');
  },
};
export const AlwaysLabelsTouch: Story = {
  name: 'Persistent labels',
  args: { items: grouped, labels: 'always' },
  parameters: {
    docs: {
      description: {
        story: 'Display persistent text labels beneath tool icons.',
      },
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Circle, Hand, Hexagon, Minus, MousePointer2, Square } from 'lucide-react';

const items: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  {
    id: 'shapes',
    label: 'Shapes',
    items: [
      { id: 'rectangle', label: 'Rectangle', icon: <Square size={base.space[5]} />, shortcut: 'R' },
      { id: 'unavailable', label: 'Polygon', icon: <Hexagon size={base.space[5]} />, disabled: true },
      { id: 'ellipse', label: 'Ellipse', icon: <Circle size={base.space[5]} />, shortcut: 'O' },
      { id: 'line', label: 'Line', icon: <Minus size={base.space[5]} /> },
    ],
  },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
];

<Dock items={items} defaultValue="select" labels="always" />`,
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expectPersistentLabels(canvas.getByRole('toolbar'));
    const group = canvas.getByRole('button', { name: 'Shapes: Rectangle, R' });
    await userEvent.click(group);
    const tray = await page(canvasElement).findByRole('group');
    await expectPersistentLabels(tray, 'beside');
    await userEvent.click(within(tray).getByRole('button', { name: 'Ellipse, O' }));
    await expect(group).toHaveAccessibleName('Shapes: Ellipse, O, Selected');
    await expect(group).toHaveAttribute('aria-expanded', 'false');
    const hand = canvas.getByRole('button', { name: 'Hand, H' });
    await userEvent.click(hand);
    await expect(hand).toHaveAttribute('aria-pressed', 'true');
    await expectPersistentLabels(canvas.getByRole('toolbar'));
  },
};
export const LongLabels: Story = {
  name: 'Long item labels',
  args: { labels: 'always', items: [
    { id: 'selection', label: 'Select all visible objects on the current drawing canvas', icon },
    { id: 'comment', label: 'Add a comment for the review team', icon },
  ] },
  parameters: {
    docs: {
      description: {
        story: 'Wrap long tool label text without breaking the dock container bounds.',
      },
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';

const icon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h3" />
  </svg>
);

const items: readonly DockItem[] = [
  { id: 'selection', label: 'Select all visible objects on the current drawing canvas', icon },
  { id: 'comment', label: 'Add a comment for the review team', icon },
];

<Dock items={items} labels="always" />`,
      },
    },
  },
  play: async ({ canvas }) => {
    await expectPersistentLabels(canvas.getByRole('toolbar'));
  },
};
export const TrayEscapesClipping: Story = {
  ...AlwaysLabelsTouch,
  name: 'Tray in a scrolling container',
  tags: ['!autodocs'],
  render: (args) => <ScrollingDockPreview><Dock {...args} /></ScrollingDockPreview>,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const toolbar = canvas.getByRole('toolbar');
    await userEvent.click(canvas.getByRole('button', { name: 'Shapes: Rectangle, R' }));
    const tray = await page(canvasElement).findByRole('group');
    await waitFor(async () => { await expectNoOverlap(tray, toolbar); });
    await expect(tray.scrollWidth).toBeLessThanOrEqual(tray.clientWidth + 1);
    await expectPersistentLabels(tray, 'beside');
  },
};
export const TrayLabelPriority: Story = {
  ...Grouped,
  name: 'Tray controls stay above toolbar labels',
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    const document = canvasElement.ownerDocument;
    const originalFontSize = document.documentElement.style.fontSize;
    document.documentElement.style.fontSize = '200%';
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Shapes: Rectangle, R, Selected' }));
      const tray = await page(canvasElement).findByRole('group');
      const ellipse = within(tray).getByRole('button', { name: 'Ellipse, O' });
      await waitFor(async () => {
        const box = ellipse.getBoundingClientRect();
        const target = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        await expect(ellipse === target || ellipse.contains(target)).toBe(true);
      });
      await userEvent.hover(ellipse);
      await waitFor(async () => {
        const label = document.querySelector('[data-ui="dock-floating-label"]');
        await expect(label).toBeVisible();
        await expect(label).toHaveTextContent('Ellipse, O');
        await expectNoOverlap(label!, ellipse);
      });
      await userEvent.click(ellipse);
      await expect(canvas.getByRole('button', { name: 'Shapes: Ellipse, O, Selected' })).toHaveAttribute('aria-expanded', 'false');
    } finally {
      document.documentElement.style.fontSize = originalFontSize;
    }
  },
};
export const NarrowOverflow: Story = {
  name: 'Overflow scrolling',
  args: { sx: { inlineSize: 320, maxInlineSize: '100%' }, items: Array.from({ length: 10 }, (_, index) => ({
    id: `tool-${index}`, label: `Tool ${new Intl.NumberFormat('en').format(index + 1)}`, icon,
  })) },
  parameters: {
    docs: {
      description: {
        story: 'Scroll overflowing tools horizontally with arrow navigation and end-key jumps.',
      },
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';

const icon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h3" />
  </svg>
);

const items: readonly DockItem[] = Array.from({ length: 10 }, (_, index) => ({
  id: \`tool-\${index}\`,
  label: \`Tool \${new Intl.NumberFormat('en').format(index + 1)}\`,
  icon,
}));

<Dock items={items} sx={{ inlineSize: 320, maxInlineSize: '100%' }} />`,
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    const toolbar = canvas.getByRole('toolbar');
    await expect(toolbar.scrollWidth).toBeGreaterThan(toolbar.clientWidth);
    await userEvent.tab(); await userEvent.keyboard('{End}');
    const last = canvas.getByRole('button', { name: 'Tool 10' });
    await assertFocus(last);
    await waitFor(async () => { await expect(last.getBoundingClientRect().right).toBeLessThanOrEqual(toolbar.getBoundingClientRect().right + 1); });
    await expect(last.getBoundingClientRect().width).toBeGreaterThanOrEqual(39);
    await userEvent.keyboard('{Home}');
    await assertFocus(canvas.getByRole('button', { name: 'Tool 1' }));
  },
};
export const BadgesZero: Story = {
  name: 'Zero badge count',
  args: { items: [{ id: 'zero', label: 'Comments', icon, badge: 0 }] },
  parameters: {
    docs: {
      description: {
        story: 'Omit numeric badge indicators when count value is zero.',
      },
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';

const icon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h3" />
  </svg>
);

const items: readonly DockItem[] = [
  { id: 'zero', label: 'Comments', icon, badge: 0 },
];

<Dock items={items} defaultValue="zero" />`,
      },
    },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('button', { name: 'Comments' })).toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-ui="dock-badge"]')).toBeNull();
  },
};
export const BadgesLarge: Story = {
  name: 'Formatted badge count',
  args: { locale: 'de-DE', items: [{ id: 'large', label: 'Comments', icon, badge: 1234567890, badgeLabel: 'comments' }] },
  parameters: {
    docs: {
      description: {
        story: 'Format large numeric notification badges using locale formatting.',
      },
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';

const icon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h3" />
  </svg>
);

const items: readonly DockItem[] = [
  { id: 'large', label: 'Comments', icon, badge: 1234567890, badgeLabel: 'comments' },
];

<Dock items={items} defaultValue="large" locale="de-DE" />`,
      },
    },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('button', { name: 'Comments, 1.234.567.890 comments' })).toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-ui="dock-badge"]')).toHaveTextContent('1.234.567.890');
    await expect(canvasElement.querySelector('[data-ui="dock-badge"]')).toHaveAttribute('aria-hidden', 'true');
    const badge = canvasElement.querySelector('[data-ui="dock-badge"]')!;
    const range = badge.ownerDocument.createRange();
    range.selectNodeContents(badge);
    const text = range.getBoundingClientRect();
    const toolbar = canvas.getByRole('toolbar').getBoundingClientRect();
    await expect(text.left).toBeGreaterThanOrEqual(toolbar.left - 1);
    await expect(text.right).toBeLessThanOrEqual(toolbar.right + 1);
  },
};
export const DisabledEmptyGroups: Story = {
  name: 'Disabled and empty groups',
  args: { items: [...tools,
    { id: 'empty', label: 'Empty shapes', items: [] },
    { id: 'disabled-group', label: 'Disabled shapes', disabled: true, items: [{ id: 'shape', label: 'Shape', icon }] },
  ] },
  parameters: {
    docs: {
      description: {
        story: 'Disable group triggers when child items are disabled or absent.',
      },
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Hand, Lock, MousePointer2, Type } from 'lucide-react';

const icon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h3" />
  </svg>
);

const items: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
  { id: 'locked', label: 'Locked', icon: <Lock size={base.space[5]} />, disabled: true },
  { id: 'text', label: 'Text', icon: <Type size={base.space[5]} />, shortcut: 'T' },
  { id: 'empty', label: 'Empty shapes', items: [] },
  { id: 'disabled-group', label: 'Disabled shapes', disabled: true, items: [{ id: 'shape', label: 'Shape', icon }] },
];

<Dock items={items} defaultValue="select" />`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getByRole('button', { name: 'Empty shapes: No tools' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Disabled shapes: Shape' })).toBeDisabled();
    await userEvent.click(canvas.getByRole('button', { name: 'Locked' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const Empty: Story = {
  name: 'Empty dock',
  args: { items: [] },
  parameters: {
    docs: {
      description: {
        story: 'Render an empty toolbar shell without items.',
      },
      source: {
        language: 'tsx',
        code: `import { Dock } from '@jfrader/ui';

<Dock items={[]} />`,
      },
    },
  },
};
export const RemovedOrDisabledSelection: Story = {
  name: 'Disabled item selection',
  args: { value: 'locked' },
  parameters: {
    docs: {
      description: {
        story: 'Handle selection targeting an inactive or disabled tool.',
      },
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Hand, Lock, MousePointer2, Type } from 'lucide-react';

const tools: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
  { id: 'locked', label: 'Locked', icon: <Lock size={base.space[5]} />, disabled: true },
  { id: 'text', label: 'Text', icon: <Type size={base.space[5]} />, shortcut: 'T' },
];

<Dock items={tools} value="locked" />`,
      },
    },
  },
  play: async ({ canvas, args }) => {
    for (const item of canvas.getAllByRole('button')) await expect(item).toHaveAttribute('aria-pressed', 'false');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const Keyboard: Story = {
  args: { defaultValue: null },
  render: (args) => <><Button>Before</Button><Dock {...args} /><Button>After</Button></>,
  play: async ({ canvas, userEvent, args }) => {
    const select = canvas.getByRole('button', { name: 'Select, V' });
    const hand = canvas.getByRole('button', { name: 'Hand, H' });
    const text = canvas.getByRole('button', { name: 'Text, T' });
    await userEvent.tab(); await userEvent.tab(); await assertFocus(select);
    for (const [key, target] of [
      ['{ArrowRight}', hand], ['{ArrowRight}', text], ['{ArrowRight}', select], ['{ArrowLeft}', text],
      ['{Home}', select], ['{End}', text],
    ] as const) { await userEvent.keyboard(key); await assertFocus(target); }
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('text');
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Home} ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('select');
    await userEvent.keyboard('h');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.tab(); await expect(canvas.getByRole('button', { name: 'After' })).toHaveFocus();
    await userEvent.tab({ shift: true }); await assertFocus(select);
    await userEvent.tab({ shift: true }); await expect(canvas.getByRole('button', { name: 'Before' })).toHaveFocus();
  },
};
export const PersistentTray: Story = { tags: ['!autodocs'], args: { items: grouped, defaultOpen: true, defaultTray: 'shapes', defaultValue: 'rectangle' } };
export const TraySelection: Story = {
  args: { items: grouped, defaultValue: null },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Circle, Hand, Hexagon, Minus, MousePointer2, Square } from 'lucide-react';

const items: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  {
    id: 'shapes',
    label: 'Shapes',
    items: [
      { id: 'rectangle', label: 'Rectangle', icon: <Square size={base.space[5]} />, shortcut: 'R' },
      { id: 'unavailable', label: 'Polygon', icon: <Hexagon size={base.space[5]} />, disabled: true },
      { id: 'ellipse', label: 'Ellipse', icon: <Circle size={base.space[5]} />, shortcut: 'O' },
      { id: 'line', label: 'Line', icon: <Minus size={base.space[5]} /> },
    ],
  },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
];

function TraySelectionDock() {
  const [value, setValue] = useState<string | null>(null);
  return <Dock items={items} value={value} onValueChange={setValue} />;
}`,
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const body = page(canvasElement);
    const group = canvas.getByRole('button', { name: 'Shapes: Rectangle, R' });
    await userEvent.tab(); await userEvent.keyboard('{ArrowRight}{ArrowUp}');
    const rectangle = await body.findByRole('button', { name: 'Rectangle, R' });
    await assertFocus(rectangle);
    await expect(group).toHaveAttribute('aria-expanded', 'true');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    const ellipse = body.getByRole('button', { name: 'Ellipse, O' });
    const line = body.getByRole('button', { name: 'Line' });
    for (const [key, target] of [
      ['{ArrowRight}', ellipse], ['{ArrowRight}', line], ['{ArrowRight}', rectangle],
      ['{ArrowLeft}', line], ['{Home}', rectangle], ['{End}', line],
    ] as const) { await userEvent.keyboard(key); await assertFocus(target); }
    await userEvent.keyboard('{Home}{ArrowRight}{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('ellipse');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(args.onValueChange!.mock.invocationCallOrder[0]).toBeLessThan(args.onOpenChange!.mock.invocationCallOrder[1]!);
    await assertFocus(group);
    const retained = body.getByRole('group', { hidden: true });
    await expect(retained).toHaveAttribute('hidden'); await expect(retained).toHaveAttribute('inert');
    await expect(retained).toHaveAttribute('aria-hidden', 'true');
    for (const button of retained.querySelectorAll('button')) await expect(button.tabIndex).toBe(-1);
    await userEvent.keyboard('{ArrowUp}');
    await assertFocus(body.getByRole('button', { name: 'Ellipse, O, Selected' }));
    await userEvent.keyboard('{ArrowDown}'); await assertFocus(group);
    await userEvent.keyboard('{ArrowUp}{Escape}'); await assertFocus(group);
  },
};
export const GroupActivation: Story = {
  args: { items: grouped, defaultValue: null },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Circle, Hand, Hexagon, Minus, MousePointer2, Square } from 'lucide-react';

const items: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  {
    id: 'shapes',
    label: 'Shapes',
    items: [
      { id: 'rectangle', label: 'Rectangle', icon: <Square size={base.space[5]} />, shortcut: 'R' },
      { id: 'unavailable', label: 'Polygon', icon: <Hexagon size={base.space[5]} />, disabled: true },
      { id: 'ellipse', label: 'Ellipse', icon: <Circle size={base.space[5]} />, shortcut: 'O' },
      { id: 'line', label: 'Line', icon: <Minus size={base.space[5]} /> },
    ],
  },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
];

function GroupActivationDock() {
  const [value, setValue] = useState<string | null>(null);
  return <Dock items={items} value={value} onValueChange={setValue} />;
}`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab(); await userEvent.keyboard('{ArrowRight}{Enter}');
    const group = canvas.getByRole('button', { name: 'Shapes: Rectangle, R, Selected' });
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('rectangle');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onTrayChange).toHaveBeenCalledTimes(1);
    await expect(args.onTrayChange).toHaveBeenLastCalledWith('shapes');
    await expect(group).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(group).toHaveAttribute('aria-expanded', 'false');
  },
};
export const TrayTab: Story = {
  args: { items: grouped },
  render: (args) => <><Button>Before</Button><Dock {...args} /><Button>After</Button></>,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const body = page(canvasElement);
    await userEvent.tab(); await userEvent.tab(); await userEvent.keyboard('{ArrowRight}{ArrowUp}');
    await assertFocus(await body.findByRole('button', { name: 'Rectangle, R' }));
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'After' })).toHaveFocus();
    await waitFor(async () => { await expect(canvas.getByRole('button', { name: 'Shapes: Rectangle, R' })).toHaveAttribute('aria-expanded', 'false'); });
    await userEvent.tab({ shift: true }); await userEvent.keyboard('{ArrowUp}');
    await userEvent.tab({ shift: true });
    await expect(canvas.getByRole('button', { name: 'Shapes: Rectangle, R' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    await expect(canvas.getByRole('button', { name: 'Before' })).toHaveFocus();
  },
};
export const ControlledRejectValue: Story = {
  args: { value: 'select', items: grouped },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Circle, Hand, Hexagon, Minus, MousePointer2, Square } from 'lucide-react';

const items: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  {
    id: 'shapes',
    label: 'Shapes',
    items: [
      { id: 'rectangle', label: 'Rectangle', icon: <Square size={base.space[5]} />, shortcut: 'R' },
      { id: 'unavailable', label: 'Polygon', icon: <Hexagon size={base.space[5]} />, disabled: true },
      { id: 'ellipse', label: 'Ellipse', icon: <Circle size={base.space[5]} />, shortcut: 'O' },
      { id: 'line', label: 'Line', icon: <Minus size={base.space[5]} /> },
    ],
  },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
];

<Dock
  items={items}
  value="select"
  onValueChange={() => {
    // Value change rejected by controller
  }}
/>`,
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.tab(); await userEvent.keyboard('{ArrowRight}{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('button', { name: 'Select, V, Selected' })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: 'Shapes: Rectangle, R' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.keyboard('{ArrowUp}{ArrowRight}{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('ellipse');
    await expect(page(canvasElement).queryByRole('button', { name: 'Ellipse, O' })).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Shapes: Rectangle, R' })).toHaveFocus();
  },
};
export const ControlledRejectOpen: Story = {
  tags: ['!autodocs'],
  args: { items: grouped, open: true, tray: 'shapes', value: 'rectangle' },
  play: async ({ canvasElement, userEvent, args }) => {
    const body = page(canvasElement);
    await userEvent.tab(); await userEvent.keyboard('{ArrowUp}{ArrowRight}{Enter}');
    const ellipse = body.getByRole('button', { name: 'Ellipse, O' });
    await assertFocus(ellipse);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(body.getByRole('button', { name: 'Rectangle, R, Selected' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard('{Escape}');
    await assertFocus(ellipse);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

export const Reorderable: Story = {
  name: 'Reorder tools',
  args: { reorderable: true },
  parameters: {
    docs: {
      description: { story: 'Move a focused toolbar item with Alt+Left or Alt+Right.' },
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Hand, Lock, MousePointer2, Type } from 'lucide-react';

const tools: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
  { id: 'locked', label: 'Locked', icon: <Lock size={base.space[5]} />, disabled: true },
  { id: 'text', label: 'Text', icon: <Type size={base.space[5]} />, shortcut: 'T' },
];

function ReorderableDock() {
  const [order, setOrder] = useState<readonly string[]>(['select', 'hand', 'locked', 'text']);
  return <Dock items={tools} defaultValue="select" reorderable order={order} onOrderChange={setOrder} />;
}`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    const toolbar = canvas.getByRole('toolbar');
    const select = canvas.getByRole('button', { name: 'Select, V, Selected' });
    await userEvent.tab(); await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    await expect(args.onOrderChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
    await expect(args.onOrderChange).toHaveBeenCalledTimes(1);
    await expect(args.onOrderChange).toHaveBeenLastCalledWith(['hand', 'select', 'locked', 'text'], { type: 'move', id: 'select', index: 1 });
    await expect(ids(toolbar)).toEqual(['hand', 'select', 'locked', 'text']);
    await expect(select.ownerDocument.activeElement).toBe(select);
    await expect(select).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('status')).toHaveTextContent('Select moved to position 2 of 4');
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    await expect(args.onOrderChange).toHaveBeenCalledTimes(2);
    await expect(ids(toolbar)).toEqual(['select', 'hand', 'locked', 'text']);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const ControlledRejectOrder: Story = {
  args: { reorderable: true, order: ['select', 'hand', 'locked', 'text'] },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Hand, Lock, MousePointer2, Type } from 'lucide-react';

const tools: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
  { id: 'locked', label: 'Locked', icon: <Lock size={base.space[5]} />, disabled: true },
  { id: 'text', label: 'Text', icon: <Type size={base.space[5]} />, shortcut: 'T' },
];

<Dock
  items={tools}
  defaultValue="select"
  reorderable
  order={['select', 'hand', 'locked', 'text']}
  onOrderChange={() => {
    // Order change rejected by controller
  }}
/>`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab(); await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
    await expect(args.onOrderChange).toHaveBeenCalledTimes(1);
    await expect(ids(canvas.getByRole('toolbar'))).toEqual(['select', 'hand', 'locked', 'text']);
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
    await assertFocus(canvas.getByRole('button', { name: 'Select, V, Selected' }));
  },
};
export const NormalizedOrder: Story = {
  args: { order: ['text', 'unknown', 'text', 'hand'] },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Hand, Lock, MousePointer2, Type } from 'lucide-react';

const tools: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
  { id: 'locked', label: 'Locked', icon: <Lock size={base.space[5]} />, disabled: true },
  { id: 'text', label: 'Text', icon: <Type size={base.space[5]} />, shortcut: 'T' },
];

<Dock items={tools} defaultValue="select" order={['text', 'unknown', 'text', 'hand']} />`,
      },
    },
  },
  play: async ({ canvas, args }) => {
    await expect(ids(canvas.getByRole('toolbar'))).toEqual(['text', 'hand', 'select', 'locked']);
    await expect(args.onOrderChange).not.toHaveBeenCalled();
  },
};
export const MoveOptions: Story = {
  name: 'Move options menu',
  args: { reorderable: true },
  parameters: {
    docs: {
      description: { story: 'Move tools before or after their neighbors without dragging.' },
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Hand, Lock, MousePointer2, Type } from 'lucide-react';

const tools: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
  { id: 'locked', label: 'Locked', icon: <Lock size={base.space[5]} />, disabled: true },
  { id: 'text', label: 'Text', icon: <Type size={base.space[5]} />, shortcut: 'T' },
];

function MoveOptionsDock() {
  const [order, setOrder] = useState<readonly string[]>(['select', 'hand', 'locked', 'text']);
  return <Dock items={tools} defaultValue="select" reorderable order={order} onOrderChange={setOrder} />;
}`,
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Move before / Move after: Select' }));
    const body = page(canvasElement);
    await expect(body.getByRole('menuitem', { name: 'Move before' })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(body.getByRole('menuitem', { name: 'Move after' }));
    await expect(args.onOrderChange).toHaveBeenCalledTimes(1);
    await expect(args.onOrderChange).toHaveBeenLastCalledWith(['hand', 'select', 'locked', 'text'], { type: 'move', id: 'select', index: 1 });
    await expect(ids(canvas.getByRole('toolbar'))).toEqual(['hand', 'select', 'locked', 'text']);
  },
};
export const PointerReorder: Story = {
  args: { reorderable: true },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Hand, Lock, MousePointer2, Type } from 'lucide-react';

const tools: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
  { id: 'locked', label: 'Locked', icon: <Lock size={base.space[5]} />, disabled: true },
  { id: 'text', label: 'Text', icon: <Type size={base.space[5]} />, shortcut: 'T' },
];

function PointerReorderDock() {
  const [order, setOrder] = useState<readonly string[]>(['select', 'hand', 'locked', 'text']);
  return <Dock items={tools} defaultValue="select" reorderable order={order} onOrderChange={setOrder} />;
}`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    const select = canvas.getByRole('button', { name: 'Select, V, Selected' });
    const rect = select.getBoundingClientRect();
    const start = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    await userEvent.pointer([{ keys: '[MouseLeft>]', target: select, coords: start },
      { target: select, coords: { x: start.x + 3, y: start.y } },
      { keys: '[/MouseLeft]', target: select, coords: { x: start.x + 3, y: start.y } }]);
    await expect(args.onOrderChange).not.toHaveBeenCalled();
    const hand = canvas.getByRole('button', { name: 'Hand, H' }).getBoundingClientRect();
    const end = { x: hand.left + hand.width / 2, y: start.y };
    await userEvent.pointer([{ keys: '[MouseLeft>]', target: select, coords: start },
      { target: select, coords: end }, { keys: '[/MouseLeft]', target: select, coords: end }]);
    await expect(args.onOrderChange).toHaveBeenCalledTimes(1);
    await expect(args.onOrderChange).toHaveBeenLastCalledWith(['hand', 'select', 'locked', 'text'], { type: 'move', id: 'select', index: 1 });
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const PointerRejectOrder: Story = {
  ...PointerReorder,
  args: { reorderable: true, order: ['select', 'hand', 'locked', 'text'] },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Hand, Lock, MousePointer2, Type } from 'lucide-react';

const tools: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
  { id: 'locked', label: 'Locked', icon: <Lock size={base.space[5]} />, disabled: true },
  { id: 'text', label: 'Text', icon: <Type size={base.space[5]} />, shortcut: 'T' },
];

<Dock
  items={tools}
  defaultValue="select"
  reorderable
  order={['select', 'hand', 'locked', 'text']}
  onOrderChange={() => {
    // Order change rejected by controller
  }}
/>`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    const select = canvas.getByRole('button', { name: 'Select, V, Selected' });
    const rect = select.getBoundingClientRect();
    const start = { x: rect.left + 20, y: rect.top + 20 };
    const end = { x: start.x + 44, y: start.y };
    await userEvent.pointer([{ keys: '[MouseLeft>]', target: select, coords: start },
      { target: select, coords: end }, { keys: '[/MouseLeft]', target: select, coords: end }]);
    await expect(args.onOrderChange).toHaveBeenCalledTimes(1);
    await expect(ids(canvas.getByRole('toolbar'))).toEqual(['select', 'hand', 'locked', 'text']);
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await waitFor(async () => { await expect(Math.abs(select.getBoundingClientRect().left - rect.left)).toBeLessThan(1.1); });
  },
};
export const VerticalGesture: Story = {
  args: { reorderable: true },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Hand, Lock, MousePointer2, Type } from 'lucide-react';

const tools: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
  { id: 'locked', label: 'Locked', icon: <Lock size={base.space[5]} />, disabled: true },
  { id: 'text', label: 'Text', icon: <Type size={base.space[5]} />, shortcut: 'T' },
];

<Dock items={tools} defaultValue="select" reorderable />`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    const select = canvas.getByRole('button', { name: 'Select, V, Selected' });
    const rect = select.getBoundingClientRect();
    const start = { x: rect.left + 20, y: rect.top + 20 };
    const end = { x: start.x + 2, y: start.y + 30 };
    await userEvent.pointer([{ keys: '[MouseLeft>]', target: select, coords: start },
      { target: select, coords: end }, { keys: '[/MouseLeft]', target: select, coords: end }]);
    await expect(args.onOrderChange).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(getComputedStyle(select).touchAction).toBe('pan-y');
  },
};
export const PointerCancel: Story = {
  args: { reorderable: true, defaultValue: null },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Hand, Lock, MousePointer2, Type } from 'lucide-react';

const tools: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
  { id: 'locked', label: 'Locked', icon: <Lock size={base.space[5]} />, disabled: true },
  { id: 'text', label: 'Text', icon: <Type size={base.space[5]} />, shortcut: 'T' },
];

<Dock items={tools} defaultValue={null} reorderable />`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    const select = canvas.getByRole('button', { name: 'Select, V' });
    const rect = select.getBoundingClientRect();
    const start = { x: rect.left + 20, y: rect.top + 20 };
    await userEvent.pointer([{ keys: '[MouseLeft>]', target: select, coords: start },
      { target: select, coords: { x: start.x + 44, y: start.y } }]);
    const Pointer = select.ownerDocument.defaultView!.PointerEvent;
    select.dispatchEvent(new Pointer('pointercancel', { pointerId: 1, bubbles: true }));
    await userEvent.pointer({ keys: '[/MouseLeft]', target: select, coords: start });
    await expect(args.onOrderChange).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(ids(canvas.getByRole('toolbar'))).toEqual(['select', 'hand', 'locked', 'text']);
    await waitFor(async () => { await expect(Math.abs(select.getBoundingClientRect().left - rect.left)).toBeLessThan(1.1); });
  },
};
export const RTL: Story = {
  args: { dir: 'rtl', reorderable: true, items: grouped },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Circle, Hand, Hexagon, Minus, MousePointer2, Square } from 'lucide-react';

const items: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  {
    id: 'shapes',
    label: 'Shapes',
    items: [
      { id: 'rectangle', label: 'Rectangle', icon: <Square size={base.space[5]} />, shortcut: 'R' },
      { id: 'unavailable', label: 'Polygon', icon: <Hexagon size={base.space[5]} />, disabled: true },
      { id: 'ellipse', label: 'Ellipse', icon: <Circle size={base.space[5]} />, shortcut: 'O' },
      { id: 'line', label: 'Line', icon: <Minus size={base.space[5]} /> },
    ],
  },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
];

<Dock items={items} defaultValue="select" dir="rtl" reorderable />`,
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.tab(); await userEvent.keyboard('{ArrowLeft}');
    const group = canvas.getByRole('button', { name: 'Shapes: Rectangle, R' });
    await assertFocus(group);
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    await expect(args.onOrderChange).toHaveBeenLastCalledWith(['select', 'hand', 'shapes'], { type: 'move', id: 'shapes', index: 2 });
    await userEvent.keyboard('{ArrowUp}{ArrowLeft}');
    await assertFocus(page(canvasElement).getByRole('button', { name: 'Ellipse, O' }));
    await userEvent.keyboard('{Escape}'); await assertFocus(group);
  },
};
export const InheritedRTL: Story = {
  ...RTL,
  args: { ...RTL.args, dir: undefined },
  render: (args) => <div dir="rtl"><Dock {...args} /></div>,
};
export const ReducedMotion: Story = {
  ...Reorderable,
  name: 'Reduced motion',
  decorators: [(Story) => <MotionConfig reducedMotion="always"><Story /></MotionConfig>],
  play: async (context) => {
    await Reorderable.play!(context);
    const { canvas, userEvent } = context;
    const hand = canvas.getByRole('button', { name: 'Hand, H' });
    const box = hand.getBoundingClientRect();
    await userEvent.pointer({ target: hand, coords: { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 } });
    await new Promise((resolve) => setTimeout(resolve, motionDurationMs.slow));
    await expect(glyphScale(hand)).toBe(1);
    await userEvent.click(hand);
    await expect(hand).toHaveAttribute('aria-pressed', 'true');
  },
  parameters: {
    docs: {
      description: { story: 'Change selection, order and trays without movement; icons do not magnify.' },
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Hand, Lock, MousePointer2, Type } from 'lucide-react';

const tools: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
  { id: 'locked', label: 'Locked', icon: <Lock size={base.space[5]} />, disabled: true },
  { id: 'text', label: 'Text', icon: <Type size={base.space[5]} />, shortcut: 'T' },
];

<Dock items={tools} defaultValue="select" reorderable />`,
      },
    },
  },
};
export const ForcedColors: Story = {
  ...PersistentTray,
  tags: ['!autodocs'],
  parameters: { docs: { description: { story: 'Enable forced colors in browser rendering settings to inspect Canvas/CanvasText boundaries and the Highlight selected marker. This story does not emulate that environment.' } } },
};

export const MultiInstance: Story = {
  tags: ['!autodocs'],
  args: { items: grouped, defaultOpen: true, defaultTray: 'shapes' },
  render: (args) => <div style={{ display: 'grid', gap: 120 }}><Dock {...args} label="Drawing tools" /><Dock {...args} label="Review tools" /></div>,
  play: async ({ canvas, canvasElement }) => {
    const controls = canvas.getAllByRole('button');
    await expect(new Set(controls.map((control) => control.id)).size).toBe(controls.length);
    const trays = page(canvasElement).getAllByRole('group');
    await expect(trays).toHaveLength(2);
    await expect(trays[0]!.id).not.toBe(trays[1]!.id);
    for (const tray of trays) await expect(tray.ownerDocument.getElementById(tray.getAttribute('aria-labelledby')!)).not.toBeNull();
  },
};
function AriaExample(args: DockProps) {
  const id = useId();
  return <>
    <span id={`${id}-name`}>Drawing</span><span id={`${id}-description`}>Current canvas</span>
    <Dock {...args} aria-label="Canvas" aria-labelledby={`${id}-name`} aria-describedby={`${id}-description`}
      slotProps={{
        toolbar: { 'aria-label': 'Tools', 'aria-labelledby': `${id}-name`, sx: { padding: 12 } },
        item: (item) => ({ 'aria-label': item.id === 'select' ? 'Selection' : item.label,
          'aria-labelledby': item.id === 'select' ? `${id}-name missing-dock-reference` : undefined,
          'aria-describedby': `${id}-description`, sx: { borderRadius: 16 } }),
      }} sx={{ gap: 12 }} />
  </>;
}
export const AriaAndSlots: Story = {
  render: (args) => <AriaExample {...args} />,
  play: async ({ canvas }) => {
    const toolbar = canvas.getByRole('toolbar', { name: 'Drawing' });
    const select = canvas.getByRole('button', { name: 'Drawing Selection' });
    await expect(select.getAttribute('aria-labelledby')).toContain('missing-dock-reference');
    await expect(select).toHaveAttribute('aria-label', 'Selection');
    await expect(select).toHaveAccessibleDescription('Current canvas');
    await expect(getComputedStyle(select).borderRadius).toBe('16px');
    await expect(getComputedStyle(toolbar).paddingTop).toBe('12px');
  },
};

const replacementSlots: DockSlots = {
  toolbar: (props) => <div {...props} data-testid="replacement-toolbar" />,
  item: (props) => <Button {...props} data-testid="replacement-item" />,
  tray: (props) => <div {...props} data-testid="replacement-tray" />,
  trayItem: (props) => <Button {...props} data-testid="replacement-tray-item" />,
  floatingLabel: (props) => <div {...props} data-testid="replacement-label" />,
  badge: (props) => <span {...props} data-testid="replacement-badge" />,
  status: (props) => <div {...props} data-testid="replacement-status" />,
};

export const ReplacementSlots: Story = {
  tags: ['!autodocs'],
  args: {
    items: [{ id: 'group', label: 'Group', items: [{ id: 'tool', label: 'Tool', icon, badge: 3 }] }],
    defaultValue: null, defaultOpen: true, defaultTray: 'group', reorderable: true,
    slots: replacementSlots,
    slotProps: {
      toolbar: { sx: { padding: 12 } },
      item: () => ({ sx: { borderRadius: 16 } }),
      tray: { sx: { padding: 14 } },
      trayItem: () => ({ sx: { borderRadius: 18 } }),
      floatingLabel: { sx: { padding: 10 } },
      badge: { sx: { fontWeight: 700 } },
      status: { title: 'Reorder announcements' },
    },
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await expect(canvas.getByTestId('replacement-toolbar')).toHaveAttribute('role', 'toolbar');
    await expect(getComputedStyle(canvas.getByTestId('replacement-toolbar')).paddingTop).toBe('12px');
    await expect(getComputedStyle(canvas.getByTestId('replacement-item')).borderRadius).toBe('16px');
    await expect(getComputedStyle(canvas.getByTestId('replacement-tray')).paddingTop).toBe('14px');
    const tool = canvas.getByTestId('replacement-tray-item');
    await expect(getComputedStyle(tool).borderRadius).toBe('18px');
    for (const badge of canvas.getAllByTestId('replacement-badge')) {
      await expect(badge).toHaveTextContent('3');
      await expect(getComputedStyle(badge).fontWeight).toBe('700');
    }
    await expect(canvas.getByTestId('replacement-status')).toHaveAttribute('aria-live', 'polite');
    await expect(canvas.getByTestId('replacement-status')).toHaveAttribute('title', 'Reorder announcements');
    await userEvent.tab();
    await assertFocus(canvas.getByTestId('replacement-item'));
    await expect(page(canvasElement).queryByTestId('replacement-label')).toBeNull();
    await userEvent.keyboard('{ArrowUp}');
    await assertFocus(tool);
    const label = await page(canvasElement).findByTestId('replacement-label');
    await expect(label).toHaveTextContent('Tool, 3 items');
    await expect(getComputedStyle(label).paddingTop).toBe('10px');
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('tool');
    await expect(canvas.getByTestId('replacement-tray')).not.toBeVisible();
    await assertFocus(canvas.getByTestId('replacement-item'));
  },
};
export const FalsyIcons: Story = {
  args: { items: [false, null, 0, ''].map((content, index) => ({ id: `falsy-${index}`, label: `Icon ${content === 0 ? 0 : index}`, icon: content })) },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Dock, type DockItem } from '@jfrader/ui';

const items: readonly DockItem[] = [
  { id: 'falsy-0', label: 'Icon 0', icon: false },
  { id: 'falsy-1', label: 'Icon 1', icon: null },
  { id: 'falsy-2', label: 'Icon 0', icon: 0 },
  { id: 'falsy-3', label: 'Icon 3', icon: '' },
];

<Dock items={items} />`,
      },
    },
  },
  play: async ({ canvas }) => {
    const buttons = canvas.getAllByRole('button');
    await expect(buttons[0]!.querySelector('[data-ui="dock-icon"]')).toBeNull();
    await expect(buttons[1]!.querySelector('[data-ui="dock-icon"]')).toBeNull();
    await expect(buttons[2]!.querySelector('[data-ui="dock-icon"]')).toHaveTextContent('0');
    await expect(buttons[3]!.querySelector('[data-ui="dock-icon"]')).toBeEmptyDOMElement();
  },
};
function ControlledExample(args: DockProps) {
  const [value, setValue] = useState<string | null>(null);
  const [order, setOrder] = useState<readonly string[]>(['select', 'shapes', 'hand']);
  const [open, setOpen] = useState(false);
  const [tray, setTray] = useState<string | null>(null);
  return <Dock {...args} value={value} order={order} open={open} tray={tray}
    onValueChange={(next) => { args.onValueChange?.(next); setValue(next); }}
    onOrderChange={(ids, change) => { args.onOrderChange?.(ids, change); setOrder(ids); }}
    onOpenChange={(next) => { args.onOpenChange?.(next); setOpen(next); }}
    onTrayChange={(next) => { args.onTrayChange?.(next); setTray(next); }} />;
}
export const Controlled: Story = {
  name: 'Controlled toolbar state',
  parameters: { docs: {
    description: { story: 'Own selection, order and tray state in the surrounding application.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { Dock, type DockItem } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { Circle, Hand, Hexagon, Minus, MousePointer2, Square } from 'lucide-react';

const items: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 size={base.space[5]} />, shortcut: 'V' },
  { id: 'shapes', label: 'Shapes', items: [
    { id: 'rectangle', label: 'Rectangle', icon: <Square size={base.space[5]} />, shortcut: 'R' },
    { id: 'unavailable', label: 'Polygon', icon: <Hexagon size={base.space[5]} />, disabled: true },
    { id: 'ellipse', label: 'Ellipse', icon: <Circle size={base.space[5]} />, shortcut: 'O' },
    { id: 'line', label: 'Line', icon: <Minus size={base.space[5]} /> },
  ] },
  { id: 'hand', label: 'Hand', icon: <Hand size={base.space[5]} />, shortcut: 'H' },
];

export function DrawingTools() {
  const [value, setValue] = useState<string | null>(null);
  const [order, setOrder] = useState<readonly string[]>(['select', 'shapes', 'hand']);
  const [open, setOpen] = useState(false);
  const [tray, setTray] = useState<string | null>(null);
  return <Dock items={items} reorderable value={value} onValueChange={setValue}
    order={order} onOrderChange={setOrder} open={open} onOpenChange={setOpen}
    tray={tray} onTrayChange={setTray} />;
}` },
  } },
  args: { items: grouped, reorderable: true }, render: (args) => <ControlledExample {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab(); await userEvent.keyboard('{ArrowRight}{Enter}');
    await expect(canvas.getByRole('button', { name: 'Shapes: Rectangle, R, Selected' })).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{ArrowUp}{ArrowRight}{Enter}');
    await expect(canvas.getByRole('button', { name: 'Shapes: Ellipse, O, Selected' })).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
    await expect(ids(canvas.getByRole('toolbar'))).toEqual(['select', 'hand', 'shapes']);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onOrderChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onTrayChange).toHaveBeenCalledTimes(1);
  },
};
export const ControlledNullTray: Story = {
  tags: ['!autodocs'],
  args: { items: grouped, tray: null, open: true },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.tab(); await userEvent.keyboard('{ArrowRight}{ArrowUp}');
    await expect(args.onTrayChange).toHaveBeenCalledTimes(1);
    await expect(args.onTrayChange).toHaveBeenLastCalledWith('shapes');
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(page(canvasElement).queryByRole('group')).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Shapes: Rectangle, R' })).toHaveFocus();
  },
};
export const ControlledRejectTray: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, tray: 'shapes', items: [...grouped,
    { id: 'brushes', label: 'Brushes', items: [{ id: 'pencil', label: 'Pencil', icon }] },
  ] },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.tab(); await userEvent.keyboard('{End}{ArrowUp}');
    const group = canvas.getByRole('button', { name: 'Brushes: Pencil' });
    await assertFocus(group);
    await expect(args.onTrayChange).toHaveBeenCalledTimes(1);
    await expect(args.onTrayChange).toHaveBeenLastCalledWith('brushes');
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(page(canvasElement).getByRole('button', { name: 'Rectangle, R' })).toBeInTheDocument();
    await expect(page(canvasElement).queryByRole('button', { name: 'Pencil' })).toBeNull();
  },
};
export const EmptyStringValue: Story = {
  args: { value: '', items: [{ id: '', label: 'Selection', icon }, { id: 'other', label: 'Other', icon }] },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { Dock, type DockItem } from '@jfrader/ui';

const icon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h3" />
  </svg>
);

const items: readonly DockItem[] = [
  { id: '', label: 'Selection', icon },
  { id: 'other', label: 'Other', icon },
];

function EmptyStringDock() {
  const [value] = useState('');
  return <Dock items={items} value={value} onValueChange={(next) => console.log('Requested tool:', next)} />;
}`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    const selected = canvas.getByRole('button', { name: 'Selection, Selected' });
    await expect(selected).toHaveAttribute('aria-pressed', 'true');
    await userEvent.tab(); await userEvent.keyboard(' ');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{ArrowRight}{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('other');
    await expect(selected).toHaveAttribute('aria-pressed', 'true');
  },
};
export const TrayDoesNotShiftLayout: Story = {
  args: { items: grouped },
  render: (args) => <div><Button>Before</Button><Dock {...args} /><Button>After</Button></div>,
  play: async ({ canvas, userEvent }) => {
    const after = canvas.getByRole('button', { name: 'After' });
    const rect = after.getBoundingClientRect();
    await userEvent.click(canvas.getByRole('button', { name: 'Shapes: Rectangle, R' }));
    await waitFor(async () => { await expect(Math.abs(after.getBoundingClientRect().top - rect.top)).toBeLessThan(1.1); });
    await expect(Math.abs(after.getBoundingClientRect().left - rect.left)).toBeLessThan(1.1);
  },
};
function RefExample(args: DockProps) {
  const [mounted, setMounted] = useState(true);
  return <><StrictMode>{mounted && <Dock {...args} />}</StrictMode>
    <Button onClick={() => setMounted(false)}>Unmount dock</Button></>;
}
export const StrictModeRefs: Story = {
  tags: ['!autodocs'],
  args: { ref: fn((node: HTMLDivElement | null) => node ? fn() : undefined) },
  render: (args) => <RefExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const root = canvasElement.querySelector('[data-ui="dock"]');
    await expect(args.ref).toHaveBeenCalledWith(root);
    const cleanup = args.ref!.mock.results[0]!.value;
    await userEvent.click(canvas.getByRole('button', { name: 'Unmount dock' }));
    await expect(cleanup).toHaveBeenCalledTimes(1);
    await expect(canvasElement.querySelector('[data-ui="dock"]')).toBeNull();
  },
};
function DialogExample(args: DockProps) {
  const [container, setContainer] = useState<HTMLDialogElement | null>(null);
  return <ThemeRoot theme="light" portalContainer={container}><Dialog defaultOpen>
    <Dialog.Content ref={setContainer}><Dialog.Title>Drawing</Dialog.Title><Dialog.Description>Choose a canvas tool.</Dialog.Description>
      <Dock {...args} /><Dialog.Close>Close</Dialog.Close>
    </Dialog.Content>
  </Dialog></ThemeRoot>;
}
export const ThemeScopedInDialog: Story = {
  tags: ['!autodocs'],
  args: { items: grouped, defaultOpen: true, defaultTray: 'shapes' },
  render: (args) => <DialogExample {...args} />,
  play: async ({ canvasElement }) => {
    const tray = await page(canvasElement).findByRole('group');
    await expect(tray.closest('dialog')).not.toBeNull();
    await expect(tray.closest('[data-theme="light"]')).not.toBeNull();
  },
};
