import { StrictMode, useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { Dialog } from '../dialog';
import { ThemeRoot } from '../theme-root';
import { Dock, type DockItem, type DockProps, type DockSlots } from './index';

const icon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
  <path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h3" />
</svg>;
const tools: readonly DockItem[] = [
  { id: 'select', label: 'Select', icon, shortcut: 'V' },
  { id: 'hand', label: 'Hand', icon, shortcut: 'H' },
  { id: 'locked', label: 'Locked', icon, disabled: true },
  { id: 'text', label: 'Text', icon, shortcut: 'T' },
];
const grouped: readonly DockItem[] = [
  tools[0]!,
  { id: 'shapes', label: 'Shapes', items: [
    { id: 'rectangle', label: 'Rectangle', icon, shortcut: 'R' },
    { id: 'unavailable', label: 'Unavailable shape', icon, disabled: true },
    { id: 'ellipse', label: 'Ellipse', icon, shortcut: 'O' },
    { id: 'line', label: 'Line', icon },
  ] },
  tools[1]!,
];
const usage = `<Dock items={tools} value={tool} onValueChange={setTool}
  reorderable order={order} onOrderChange={setOrder} />`;

const meta = {
  title: 'Inputs/Dock', component: Dock, tags: ['autodocs'],
  args: {
    items: tools, defaultValue: 'select', onValueChange: fn(), onOrderChange: fn(),
    onOpenChange: fn(), onTrayChange: fn(),
    ref: fn((node: HTMLDivElement | null) => node ? fn() : undefined),
  },
  parameters: { docs: {
    source: { code: usage },
    description: { component:
      'A toolbar for canvas tools with optional one-level grouped trays. Left/Right wrap through enabled controls (reversed in RTL); Home/End jump. Enter/Space choose a tool; a group also toggles its tray. Up opens a group and focuses its shown child. In a tray, Left/Right/Home/End navigate, Down/Escape close and return focus, and Tab/Shift+Tab close without taking focus back. Alt+Left/Right move a toolbar item one position when reorderable; the adjacent options menu provides Move before/Move after without dragging. Shortcut hints are display-only. Selection, order, open and tray identity are independent controlled or uncontrolled axes. IDs must be unique across tools and groups; nested groups are not supported.' },
  } },
} satisfies Meta<typeof Dock>;
export default meta;
type Story = StoryObj<typeof meta>;

async function assertFocus(button: HTMLElement) {
  await expect(button.ownerDocument.activeElement).toBe(button);
  await expect(getComputedStyle(button).outlineStyle).not.toBe('none');
  await expect(parseFloat(getComputedStyle(button).outlineWidth)).toBeGreaterThan(0.5);
}
function page(canvasElement: HTMLElement) { return within(canvasElement.ownerDocument.body); }
function ids(toolbar: HTMLElement) {
  return Array.from(toolbar.querySelectorAll<HTMLElement>('[data-dock-item]'), (button) => button.dataset.dockItem);
}

export const Default: Story = {
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
export const Light: Story = { ...Default, decorators: [withLightTheme] };
export const Grouped: Story = { args: { items: grouped, defaultValue: 'rectangle' } };
export const NoSelection: Story = {
  args: { value: null },
  play: async ({ canvas }) => {
    for (const button of canvas.getAllByRole('button')) await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(canvas.getByRole('button', { name: 'Select, V' }).tabIndex).toBe(0);
  },
};
export const AlwaysLabelsTouch: Story = { args: { items: grouped, labels: 'always' } };
export const LongLabels: Story = {
  args: { labels: 'always', items: [
    { id: 'selection', label: 'Select all visible objects on the current drawing canvas', icon },
    { id: 'comment', label: 'Add a comment for the review team', icon },
  ] },
};
export const NarrowOverflow: Story = {
  args: { style: { width: 320 }, items: Array.from({ length: 10 }, (_, index) => ({
    id: `tool-${index}`, label: `Tool ${new Intl.NumberFormat('en').format(index + 1)}`, icon,
  })) },
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
  args: { items: [{ id: 'zero', label: 'Comments', icon, badge: 0 }] },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('button', { name: 'Comments' })).toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-ui="dock-badge"]')).toBeNull();
  },
};
export const BadgesLarge: Story = {
  args: { locale: 'de-DE', items: [{ id: 'large', label: 'Comments', icon, badge: 1234567890, badgeLabel: 'comments' }] },
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
  args: { items: [...tools,
    { id: 'empty', label: 'Empty shapes', items: [] },
    { id: 'disabled-group', label: 'Disabled shapes', disabled: true, items: [{ id: 'shape', label: 'Shape', icon }] },
  ] },
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getByRole('button', { name: 'Empty shapes: No tools' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Disabled shapes: Shape' })).toBeDisabled();
    await userEvent.click(canvas.getByRole('button', { name: 'Locked' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const Empty: Story = { args: { items: [] } };
export const RemovedOrDisabledSelection: Story = {
  args: { value: 'locked' },
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
export const PersistentTray: Story = { args: { items: grouped, defaultOpen: true, defaultTray: 'shapes', defaultValue: 'rectangle' } };
export const TraySelection: Story = {
  args: { items: grouped, defaultValue: null },
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
  args: { reorderable: true },
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
  play: async ({ canvas, args }) => {
    await expect(ids(canvas.getByRole('toolbar'))).toEqual(['text', 'hand', 'select', 'locked']);
    await expect(args.onOrderChange).not.toHaveBeenCalled();
  },
};
export const MoveOptions: Story = {
  args: { reorderable: true },
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
  parameters: { docs: { description: { story: 'Enable reduced motion in browser rendering settings to inspect instant tray, selection and order changes. The play checks keyboard behavior, not media emulation.' } } },
};
export const ForcedColors: Story = {
  ...PersistentTray,
  parameters: { docs: { description: { story: 'Enable forced colors in browser rendering settings to inspect Canvas/CanvasText boundaries and the Highlight selected marker. This story does not emulate that environment.' } } },
};

export const MultiInstance: Story = {
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
        toolbar: { 'aria-label': 'Tools', 'aria-labelledby': `${id}-name`, css: { padding: 12 } },
        item: (item) => ({ 'aria-label': item.id === 'select' ? 'Selection' : item.label,
          'aria-labelledby': item.id === 'select' ? `${id}-name missing-dock-reference` : undefined,
          'aria-describedby': `${id}-description`, css: { borderRadius: 16 } }),
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
  args: {
    items: [{ id: 'group', label: 'Group', items: [{ id: 'tool', label: 'Tool', icon, badge: 3 }] }],
    defaultValue: null, defaultOpen: true, defaultTray: 'group', reorderable: true,
    slots: replacementSlots,
    slotProps: {
      toolbar: { css: { padding: 12 } },
      item: () => ({ css: { borderRadius: 16 } }),
      tray: { css: { padding: 14 } },
      trayItem: () => ({ css: { borderRadius: 18 } }),
      floatingLabel: { css: { padding: 10 } },
      badge: { css: { fontWeight: 700 } },
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
    const label = await page(canvasElement).findByTestId('replacement-label');
    await expect(label).toHaveTextContent('Group: Tool, 3 items');
    await expect(getComputedStyle(label).paddingTop).toBe('10px');
    await userEvent.keyboard('{ArrowUp}');
    await assertFocus(tool);
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('tool');
    await expect(canvas.getByTestId('replacement-tray')).not.toBeVisible();
    await assertFocus(canvas.getByTestId('replacement-item'));
  },
};
export const FalsyIcons: Story = {
  args: { items: [false, null, 0, ''].map((content, index) => ({ id: `falsy-${index}`, label: `Icon ${content === 0 ? 0 : index}`, icon: content })) },
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
  args: { items: grouped, defaultOpen: true, defaultTray: 'shapes' },
  render: (args) => <DialogExample {...args} />,
  play: async ({ canvasElement }) => {
    const tray = await page(canvasElement).findByRole('group');
    await expect(tray.closest('dialog')).not.toBeNull();
    await expect(tray.closest('[data-theme="light"]')).not.toBeNull();
  },
};
