import { Component, useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor, within, type Mock } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { Button } from '../button';
import { Popover } from '../popover';
import { ThemeRoot } from '../theme-root';
import {
  ContextMenu,
  type ContextMenuAction,
  type ContextMenuCompoundProps,
  type ContextMenuEasyProps,
  type ContextMenuProps,
  type ContextMenuTargetProps,
} from './index';

const TARGET = 'report.pdf actions';
// Sub-pixel layout and fractional devicePixelRatios: geometry is compared with a tolerance.
const TOLERANCE_PX = 1.5;
// The menu's distance from its anchor and from the viewport edges, in px.
const ANCHOR_GAP = 4;
const VIEWPORT_PADDING = 8;
// Covers the 160ms entry animation with margin.
const SETTLE_MS = 240;
// Longer than the menu's 500ms typeahead buffer.
const TYPEAHEAD_RESET_WAIT_MS = 600;
// A viewport smaller than the menu's preferred size in both axes, in px.
const TINY_VIEWPORT = { width: 200, height: 180 };

const rowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: vars.space[3],
} satisfies CSSProperties;

// Room around the Target, so menus anchored to it are not shifted by the viewport padding.
const frameStyle = {
  padding: vars.space[6],
} satisfies CSSProperties;

const targetBoxStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: vars.space[2],
  inlineSize: '16rem',
  minBlockSize: '6rem',
  padding: vars.space[4],
  border: `1px dashed ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
} satisfies CSSProperties;

const smallTargetStyle = {
  ...targetBoxStyle,
  inlineSize: '8rem',
  minBlockSize: '3rem',
} satisfies CSSProperties;

const frameBoxStyle = {
  inlineSize: '20rem',
  blockSize: '12rem',
  border: `1px solid ${vars.color.border}`,
} satisfies CSSProperties;

const consumerCss = css({ marginInlineStart: vars.space[1], letterSpacing: '0.05em' });
const consumerSx = css({ marginInlineStart: vars.space[2] });

interface StoryArgs extends ContextMenuCompoundProps {
  onCopy: () => void;
  onRename: () => void;
  onDelete: () => void;
  onOpenChild: () => void;
  targetProps?: Partial<ContextMenuTargetProps>;
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 9.5l3-3M7 4.5l1-1a2.5 2.5 0 013.5 3.5l-1 1M9 11.5l-1 1A2.5 2.5 0 014.5 9l1-1" />
    </svg>
  );
}
LinkIcon.displayName = 'LinkIcon';

function FileMenu({ onCopy, onRename, onDelete, onOpenChild, targetProps, children, ...props }: StoryArgs) {
  return (
    <ContextMenu {...props}>
      <ContextMenu.Target aria-label={TARGET} style={targetBoxStyle} {...targetProps}>
        <strong>report.pdf</strong>
        <Button size="sm" variant="outline" onClick={onOpenChild}>
          Open
        </Button>
        {children}
      </ContextMenu.Target>
      <ContextMenu.Content>
        <ContextMenu.Item icon={<LinkIcon />} onSelect={onCopy}>
          Copy link
        </ContextMenu.Item>
        <ContextMenu.Item onSelect={onRename}>Rename</ContextMenu.Item>
        <ContextMenu.Item disabled>Move</ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item tone="danger" onSelect={onDelete}>
          Delete file
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu>
  );
}
FileMenu.displayName = 'FileMenu';

function FileRow(args: StoryArgs) {
  return (
    <div style={rowStyle}>
      <FileMenu {...args} />
      <Button>After</Button>
    </div>
  );
}
FileRow.displayName = 'FileRow';

/** Portaled content lives in the story document's body, outside the canvas. */
const bodyOf = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body);
const callValues = (spy: unknown) => (spy as Mock).mock.calls.map(([value]) => value);
const getTarget = (canvasElement: HTMLElement, name = TARGET) => within(canvasElement).getByRole('group', { name });
const getAfter = (canvasElement: HTMLElement) => within(canvasElement).getByRole('button', { name: 'After' });
const findMenu = (canvasElement: HTMLElement, name = TARGET) => bodyOf(canvasElement).findByRole('menu', { name });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type PlayUserEvent = Parameters<NonNullable<Story['play']>>[0]['userEvent'];

async function contextClick(userEvent: PlayUserEvent, element: Element, clientX: number, clientY: number) {
  await userEvent.pointer({ keys: '[MouseRight]', target: element, coords: { clientX, clientY } });
}

async function expectActive(canvasElement: HTMLElement, element: Element) {
  await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(element));
}

async function expectItemFocused(canvasElement: HTMLElement, name: string, role = 'menuitem') {
  await waitFor(() =>
    expect(canvasElement.ownerDocument.activeElement).toBe(bodyOf(canvasElement).getByRole(role, { name })),
  );
}

async function expectClosed(canvasElement: HTMLElement, target = getTarget(canvasElement)) {
  await waitFor(() => expect(bodyOf(canvasElement).queryByRole('menu')).toBeNull());
  await expect(target).toHaveAttribute('aria-expanded', 'false');
}

async function expectFocusRing(element: Element) {
  const style = getComputedStyle(element);
  await expect(style.outlineStyle).not.toBe('none');
  // Fractional devicePixelRatios compute the authored 2px ring as e.g. 1.48837px.
  await expect(Math.abs(parseFloat(style.outlineWidth) - 2)).toBeLessThan(1.1);
}

const near = (actual: number, expected: number) => Math.abs(actual - expected) < TOLERANCE_PX;

/** A length (e.g. a token reference) resolved to px in `element`'s document, on a throwaway probe. */
function resolvedPx(element: Element, length: string) {
  const probe = element.ownerDocument.createElement('div');
  probe.style.inlineSize = length;
  element.ownerDocument.body.append(probe);
  const px = probe.getBoundingClientRect().width;
  probe.remove();
  return px;
}

/** Every edge of `element` inside `view`'s viewport, keeping the collision padding. */
async function expectInsideViewport(element: Element, view: Window) {
  await waitFor(() => {
    const rect = element.getBoundingClientRect();
    expect(rect.left).toBeGreaterThanOrEqual(VIEWPORT_PADDING - TOLERANCE_PX);
    expect(rect.top).toBeGreaterThanOrEqual(VIEWPORT_PADDING - TOLERANCE_PX);
    expect(rect.right).toBeLessThanOrEqual(view.innerWidth - VIEWPORT_PADDING + TOLERANCE_PX);
    expect(rect.bottom).toBeLessThanOrEqual(view.innerHeight - VIEWPORT_PADDING + TOLERANCE_PX);
  });
}

/** The computed transform-origin in px. */
function originOf(element: Element) {
  const [x = Number.NaN, y = Number.NaN] = getComputedStyle(element).transformOrigin.split(' ').map(parseFloat);
  return { x, y };
}

/** True when a stylesheet rule under `query` matching `element` sets `property` to `expected`. */
function mediaRuleSets(element: Element, query: string, property: string, expected: string) {
  return Array.from(element.ownerDocument.styleSheets).some((sheet) =>
    Array.from(sheet.cssRules).some(
      (rule) =>
        rule instanceof CSSMediaRule &&
        rule.conditionText.includes(query) &&
        Array.from(rule.cssRules).some(
          (inner) =>
            inner instanceof CSSStyleRule &&
            element.matches(inner.selectorText) &&
            inner.style.getPropertyValue(property).toLowerCase() === expected,
        ),
    ),
  );
}

const meta = {
  title: 'Navigation/ContextMenu',
  component: ContextMenu,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Open actions for an item with a context click, Shift+F10, the ContextMenu key, or a menu button.',
      },
      usage: '- `Target` needs a label and keeps its children interactive. A click opens nothing unless `openOnClick` is set; use it only for objects without interactive children.\n- Add a visible `ContextMenu.Trigger` inside the Target for touch and pointer users.\n- Context clicks open at the pointer; keyboard requests open below the Target.\n- Arrows and typeahead skip disabled items, which stay visible as in Menu. Submenus are not supported.\n- Scrolling outside the menu or resizing the window closes it.',
    },
    // Floating UI's focus guards are aria-hidden spans with tabindex=0 that forward focus
    // immediately; axe flags them as aria-hidden-focus (known false positive). Every other
    // aria-hidden element is still checked.
    a11y: {
      config: {
        rules: [{ id: 'aria-hidden-focus', selector: '[aria-hidden="true"]:not([data-floating-ui-focus-guard])' }],
      },
    },
  },
  args: {
    onOpenChange: fn(),
    onCopy: fn(),
    onRename: fn(),
    onDelete: fn(),
    onOpenChild: fn(),
  },
  decorators: [
    (Story) => (
      <div style={frameStyle}>
        <Story />
      </div>
    ),
  ],
  render: (args) => <FileRow {...args} />,
} satisfies Meta<StoryArgs>;

export default meta;

type Story = StoryObj<StoryArgs>;

function easyModeTypeContracts() {
  // @ts-expect-error Collection mode rejects compound children.
  <ContextMenu targetLabel="Actions" items={[]} content="Box">Compound</ContextMenu>;
  // @ts-expect-error Collection mode requires targetLabel.
  <ContextMenu items={[]} content="Box" />;
  // @ts-expect-error Collection mode requires items.
  <ContextMenu targetLabel="Actions" content="Box" />;
  // @ts-expect-error Collection mode requires content.
  <ContextMenu targetLabel="Actions" items={[]} />;
  // @ts-expect-error Separators cannot carry selection callbacks.
  <ContextMenu targetLabel="Actions" content="Box" items={[{ type: 'separator', onSelect: fn() }]} />;
}
void easyModeTypeContracts;

export const Default: StoryObj<ContextMenuEasyProps> = {
  name: 'Easy mode',
  args: {
    targetLabel: TARGET,
    content: (
      <>
        <strong>report.pdf</strong>
        <Button size="sm" variant="outline">
          Open
        </Button>
      </>
    ),
    items: [
      { type: 'item', label: 'Copy link', icon: <LinkIcon />, onSelect: fn() },
      { type: 'item', label: 'Rename', onSelect: fn() },
      { type: 'item', label: 'Move', disabled: true },
      { type: 'separator' },
      { type: 'item', label: 'Delete file', tone: 'danger', onSelect: fn() },
    ],
    onOpenChange: fn(),
    slotProps: {
      target: { style: targetBoxStyle },
    },
  },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `const items: readonly ContextMenuAction[] = [
  { type: 'item', label: 'Copy link', icon: <LinkIcon />, onSelect: copyLink },
  { type: 'item', label: 'Rename', onSelect: rename },
  { type: 'item', label: 'Move', disabled: true },
  { type: 'separator' },
  { type: 'item', label: 'Delete file', tone: 'danger', onSelect: removeFile },
];

<ContextMenu
  targetLabel="report.pdf actions"
  items={items}
  content={<FilePreview />}
/>`,
      },
    },
  },
  render: (args) => (
    <div style={rowStyle}>
      <ContextMenu {...args} />
      <Button>After</Button>
    </div>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    await expect(target).toHaveAttribute('data-ui', 'context-menu-target');
    await expect(target).toHaveAttribute('tabindex', '0');
    await expect(target).toHaveAttribute('aria-haspopup', 'menu');
    await expect(target).toHaveAttribute('aria-expanded', 'false');

    const box = target.getBoundingClientRect();
    await contextClick(userEvent, target, box.left + 40, box.top + 20);
    const menu = await findMenu(canvasElement);
    await expect(menu).toHaveAttribute('data-ui', 'context-menu');
    await expect(target).toHaveAttribute('aria-expanded', 'true');
    await expect(within(menu).getAllByRole('menuitem')).toHaveLength(4);
    await expectItemFocused(canvasElement, 'Copy link');

    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Rename' }));
    await expect(args.items[1]?.onSelect).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement);
    await expectActive(canvasElement, target);
  },
};

export const EasyKeyboard: StoryObj<ContextMenuEasyProps> = {
  ...Default,
  name: 'Easy mode keyboard',
  play: async ({ canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    await userEvent.tab();
    await expectActive(canvasElement, target);
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    const menu = await findMenu(canvasElement);
    await expect(menu).toBeVisible();
    await expectItemFocused(canvasElement, 'Copy link');

    await userEvent.keyboard('{ArrowDown}');
    await expectItemFocused(canvasElement, 'Rename');
    // Skips disabled 'Move'
    await userEvent.keyboard('{ArrowDown}');
    await expectItemFocused(canvasElement, 'Delete file');
    await userEvent.keyboard('{ArrowUp}');
    await expectItemFocused(canvasElement, 'Rename');

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expectActive(canvasElement, target);
  },
};

export const EasyDismissal: StoryObj<ContextMenuEasyProps> = {
  ...Default,
  name: 'Easy mode dismissal',
  play: async ({ canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    const box = target.getBoundingClientRect();
    await contextClick(userEvent, target, box.left + 40, box.top + 20);
    const menu = await findMenu(canvasElement);
    await expect(menu).toHaveAttribute('data-ui', 'context-menu');
    await expectItemFocused(canvasElement, 'Copy link');

    await userEvent.click(getAfter(canvasElement));
    await expectClosed(canvasElement);
  },
};

export const EasyControlled: StoryObj<ContextMenuEasyProps> = {
  ...Default,
  name: 'Easy mode controlled',
  args: {
    ...Default.args,
    open: true,
  },
  play: async ({ canvasElement, args, userEvent }) => {
    const target = getTarget(canvasElement);
    const menu = await findMenu(canvasElement);
    const box = target.getBoundingClientRect();
    await waitFor(() => {
      expect(near(menu.getBoundingClientRect().left, box.left)).toBe(true);
      expect(near(menu.getBoundingClientRect().top, box.bottom + ANCHOR_GAP)).toBe(true);
    });
    await expectItemFocused(canvasElement, 'Copy link');
    await userEvent.keyboard('{Escape}');
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    await expect(bodyOf(canvasElement).getByRole('menu')).toBe(menu);
    await expectItemFocused(canvasElement, 'Copy link');
  },
};

export const EasyDisabled: StoryObj<ContextMenuEasyProps> = {
  ...Default,
  name: 'Easy mode disabled',
  args: {
    ...Default.args,
    disabled: true,
  },
  play: async ({ canvasElement, args, userEvent }) => {
    const target = getTarget(canvasElement);
    const box = target.getBoundingClientRect();
    await contextClick(userEvent, target, box.left + 40, box.top + 20);
    await expect(bodyOf(canvasElement).queryByRole('menu', { name: TARGET })).toBeNull();
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};

export const CustomSlots: StoryObj<ContextMenuEasyProps> = {
  ...Default,
  name: 'Easy mode custom slotProps',
  args: {
    ...Default.args,
    slotProps: {
      target: { className: 'custom-target', style: targetBoxStyle },
      content: { className: 'custom-content' },
      item: { className: 'custom-item' },
      separator: { className: 'custom-separator' },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    await expect(target).toHaveClass('custom-target');

    const box = target.getBoundingClientRect();
    await contextClick(userEvent, target, box.left + 40, box.top + 20);
    const menu = await findMenu(canvasElement);
    await expect(menu).toHaveClass('custom-content');

    const items = within(menu).getAllByRole('menuitem');
    for (const item of items) {
      await expect(item).toHaveClass('custom-item');
    }
    const separator = within(menu).getByRole('separator');
    await expect(separator).toHaveClass('custom-separator');

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};

export const Compound: Story = {
  parameters: {
    docs: {
      source: {
        code: `<ContextMenu>
  <ContextMenu.Target aria-label="File actions"><FilePreview /></ContextMenu.Target>
  <ContextMenu.Content>
    <ContextMenu.Item onSelect={copyLink}>Copy link</ContextMenu.Item>
    <ContextMenu.Item tone="danger" onSelect={removeFile}>Delete file</ContextMenu.Item>
  </ContextMenu.Content>
</ContextMenu>`,
      },
    },
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    await expect(target).toHaveAttribute('data-ui', 'context-menu-target');
    await expect(target).toHaveAttribute('tabindex', '0');
    await expect(target).toHaveAttribute('aria-haspopup', 'menu');
    await expect(target).toHaveAttribute('aria-expanded', 'false');
    await expect(target).not.toHaveAttribute('aria-controls');

    // A plain click on the Target and on its child keeps their own behavior.
    await userEvent.click(target);
    await userEvent.click(within(target).getByRole('button', { name: 'Open' }));
    await expect(args.onOpenChild).toHaveBeenCalledTimes(1);
    await expect(bodyOf(canvasElement).queryByRole('menu')).toBeNull();
    await expect(args.onOpenChange).not.toHaveBeenCalled();

    const box = target.getBoundingClientRect();
    await contextClick(userEvent, target, box.left + 40, box.top + 20);
    const menu = await findMenu(canvasElement);
    await expect(canvasElement.contains(menu)).toBe(false);
    await expect(menu).toHaveAttribute('data-ui', 'context-menu');
    await expect(menu).toHaveAttribute('aria-labelledby', target.id);
    await expect(target).toHaveAttribute('aria-expanded', 'true');
    await expect(target).toHaveAttribute('aria-controls', menu.id);
    await expect(within(menu).getAllByRole('menuitem')).toHaveLength(4);
    await expectItemFocused(canvasElement, 'Copy link');

    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Rename' }));
    await expect(args.onRename).toHaveBeenCalledTimes(1);
    await expect(args.onCopy).not.toHaveBeenCalled();
    await expectClosed(canvasElement);
    // An accepted selection returns focus to the invoker.
    await expectActive(canvasElement, target);
    await expect(callValues(args.onOpenChange)).toEqual([true, false]);
  },
};

export const PointerAnchor: Story = {
  play: async ({ args, canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    const box = target.getBoundingClientRect();
    const point = { x: box.left + 60, y: box.top + 30 };
    await contextClick(userEvent, target, point.x, point.y);
    const menu = await findMenu(canvasElement);
    await waitFor(() => {
      const rect = menu.getBoundingClientRect();
      expect(near(rect.left, point.x)).toBe(true);
      expect(near(rect.top, point.y + ANCHOR_GAP)).toBe(true);
    });
    await expect(getComputedStyle(menu).position).toBe('fixed');
    // The entry scale grows from the pointer.
    const { x: originX, y: originY } = originOf(menu);
    await expect(near(originX, 0)).toBe(true);
    await expect(near(originY, -ANCHOR_GAP)).toBe(true);

    // A second context click moves the open menu without another open request.
    const next = { x: box.left + 120, y: box.top + 60 };
    await contextClick(userEvent, target, next.x, next.y);
    await waitFor(() => {
      const rect = menu.getBoundingClientRect();
      expect(near(rect.left, next.x)).toBe(true);
      expect(near(rect.top, next.y + ANCHOR_GAP)).toBe(true);
    });
    await expect(bodyOf(canvasElement).getByRole('menu')).toBe(menu);
    await expect(callValues(args.onOpenChange)).toEqual([true]);

    // A plain press on the Target closes the menu without moving focus to it.
    await userEvent.pointer({ keys: '[MouseLeft]', target, coords: { clientX: next.x, clientY: next.y } });
    await expectClosed(canvasElement);
    await expect(callValues(args.onOpenChange)).toEqual([true, false]);
  },
};

export const KeyboardAnchor: Story = {
  play: async ({ args, canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    await userEvent.tab();
    await expectActive(canvasElement, target);
    await expectFocusRing(target);

    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    const menu = await findMenu(canvasElement);
    await expectItemFocused(canvasElement, 'Copy link');
    const box = target.getBoundingClientRect();
    // Below the Target, at its inline start.
    await waitFor(() => {
      const rect = menu.getBoundingClientRect();
      expect(near(rect.left, box.left)).toBe(true);
      expect(near(rect.top, box.bottom + ANCHOR_GAP)).toBe(true);
    });
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expectActive(canvasElement, target);

    await userEvent.keyboard('{ContextMenu}');
    await findMenu(canvasElement);
    await expectItemFocused(canvasElement, 'Copy link');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expectActive(canvasElement, target);

    // Enter and Space on the Target do nothing without openOnClick.
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await expect(bodyOf(canvasElement).queryByRole('menu')).toBeNull();
    await expect(callValues(args.onOpenChange)).toEqual([true, false, true, false]);
  },
};

export const Keyboard: Story = {
  play: async ({ args, canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    await userEvent.tab();
    await userEvent.keyboard('{ContextMenu}');
    await findMenu(canvasElement);
    await expectItemFocused(canvasElement, 'Copy link');
    await expectFocusRing(canvasElement.ownerDocument.activeElement!);

    // Arrows wrap and skip the disabled item; Home/End jump.
    await userEvent.keyboard('{ArrowDown}');
    await expectItemFocused(canvasElement, 'Rename');
    await userEvent.keyboard('{ArrowDown}');
    await expectItemFocused(canvasElement, 'Delete file');
    await userEvent.keyboard('{ArrowDown}');
    await expectItemFocused(canvasElement, 'Copy link');
    await userEvent.keyboard('{ArrowUp}');
    await expectItemFocused(canvasElement, 'Delete file');
    await userEvent.keyboard('{Home}');
    await expectItemFocused(canvasElement, 'Copy link');
    await userEvent.keyboard('{End}');
    await expectItemFocused(canvasElement, 'Delete file');
    // Left/Right do nothing.
    await userEvent.keyboard('{ArrowLeft}{ArrowRight}');
    await expectItemFocused(canvasElement, 'Delete file');

    // Typeahead jumps to enabled matches and skips disabled ones; the buffer resets.
    await userEvent.keyboard('r');
    await expectItemFocused(canvasElement, 'Rename');
    await wait(TYPEAHEAD_RESET_WAIT_MS);
    await userEvent.keyboard('m');
    await expectItemFocused(canvasElement, 'Rename');
    await wait(TYPEAHEAD_RESET_WAIT_MS);
    await userEvent.keyboard('c');
    await expectItemFocused(canvasElement, 'Copy link');

    // Enter activates exactly once and returns focus to the Target.
    await userEvent.keyboard('{Enter}');
    await expect(args.onCopy).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement);
    await expectActive(canvasElement, target);

    // Space activates exactly once too.
    await userEvent.keyboard('{ContextMenu}');
    await expectItemFocused(canvasElement, 'Copy link');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard(' ');
    await expect(args.onRename).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement);
    await expectActive(canvasElement, target);
    await expect(args.onDelete).not.toHaveBeenCalled();
    await expect(callValues(args.onOpenChange)).toEqual([true, false, true, false]);
  },
};

export const TabOut: Story = {
  play: async ({ args, canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    await userEvent.tab();
    await userEvent.keyboard('{ContextMenu}');
    await expectItemFocused(canvasElement, 'Copy link');

    // Shift+Tab from the first item returns to the invoker and keeps the menu open (Menu policy).
    await userEvent.tab({ shift: true });
    await expectActive(canvasElement, target);
    await expect(bodyOf(canvasElement).getByRole('menu')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);

    // Tab from the menu closes it and lets focus move on.
    await userEvent.keyboard('{ContextMenu}');
    await expectItemFocused(canvasElement, 'Copy link');
    await userEvent.keyboard('{End}');
    await userEvent.tab();
    await expectClosed(canvasElement);
    const active = canvasElement.ownerDocument.activeElement!;
    await expect(active).not.toBe(canvasElement.ownerDocument.body);
    await expect(active.closest('[role="menu"]')).toBeNull();
    await expect(callValues(args.onOpenChange)).toEqual([true, false, true, false]);
  },
};

export const OutsidePress: Story = {
  play: async ({ args, canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    const after = getAfter(canvasElement);
    const box = target.getBoundingClientRect();
    await contextClick(userEvent, target, box.left + 30, box.top + 30);
    await expectItemFocused(canvasElement, 'Copy link');

    // Dismissal by an outside press never focuses the invoker, not even transiently.
    const targetFocus = fn();
    target.addEventListener('focus', targetFocus);
    await userEvent.click(after);
    await expectClosed(canvasElement);
    target.removeEventListener('focus', targetFocus);
    await expect(targetFocus).not.toHaveBeenCalled();
    await expectActive(canvasElement, after);
    await expect(callValues(args.onOpenChange)).toEqual([true, false]);
  },
};

export const VisibleTrigger: Story = {
  render: ({ onCopy, onRename, onDelete, onOpenChild: _onOpenChild, ...args }) => (
    <div style={rowStyle}>
      <ContextMenu {...args}>
        <ContextMenu.Target aria-label={TARGET} style={targetBoxStyle}>
          <strong>report.pdf</strong>
          <ContextMenu.Trigger>More actions</ContextMenu.Trigger>
        </ContextMenu.Target>
        <ContextMenu.Content>
          <ContextMenu.Item onSelect={onCopy}>Copy link</ContextMenu.Item>
          <ContextMenu.Item onSelect={onRename}>Rename</ContextMenu.Item>
          <ContextMenu.Item tone="danger" onSelect={onDelete}>
            Delete file
          </ContextMenu.Item>
          <ContextMenu.Item disabled>Archive</ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu>
      <Button>After</Button>
    </div>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    const trigger = within(target).getByRole('button', { name: 'More actions' });
    await expect(trigger).toHaveAttribute('type', 'button');
    await expect(trigger).toHaveAttribute('data-ui', 'context-menu-trigger');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger.id).not.toBe(target.id);
    await expect(trigger.getBoundingClientRect().height).toBeGreaterThanOrEqual(32 - TOLERANCE_PX);

    // A tap on the Trigger opens below it; the menu is still named by the Target.
    await userEvent.click(trigger);
    const menu = await findMenu(canvasElement);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(trigger).toHaveAttribute('aria-controls', menu.id);
    await expectItemFocused(canvasElement, 'Copy link');
    const box = trigger.getBoundingClientRect();
    await waitFor(() => {
      const rect = menu.getBoundingClientRect();
      expect(near(rect.left, box.left)).toBe(true);
      expect(near(rect.top, box.bottom + ANCHOR_GAP)).toBe(true);
    });
    // Escape returns focus to the Trigger, the actual invoker.
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement, trigger);
    await expectActive(canvasElement, trigger);
    await expectFocusRing(trigger);

    // ArrowUp opens on the last enabled item; Enter/Space/ArrowDown on the first.
    await userEvent.keyboard('{ArrowUp}');
    await expectItemFocused(canvasElement, 'Delete file');
    await userEvent.keyboard('{Escape}');
    await expectActive(canvasElement, trigger);
    await userEvent.keyboard('{ArrowDown}');
    await expectItemFocused(canvasElement, 'Copy link');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(args.onRename).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement, trigger);
    await expectActive(canvasElement, trigger);
    await expect(callValues(args.onOpenChange)).toEqual([true, false, true, false, true, false]);
  },
};

export const OpenOnClickOptIn: Story = {
  args: { targetProps: { openOnClick: true } },
  play: async ({ args, canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    const box = target.getBoundingClientRect();
    // A plain click opens at the pointer.
    await userEvent.pointer({ keys: '[MouseLeft]', target, coords: { clientX: box.left + 50, clientY: box.top + 50 } });
    const menu = await findMenu(canvasElement);
    await waitFor(() => expect(near(menu.getBoundingClientRect().left, box.left + 50)).toBe(true));
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expectActive(canvasElement, target);

    // Enter and Space on the Target itself open below it.
    await userEvent.keyboard('{Enter}');
    await expectItemFocused(canvasElement, 'Copy link');
    await userEvent.keyboard('{Escape}');
    await expectActive(canvasElement, target);
    await userEvent.keyboard(' ');
    await expectItemFocused(canvasElement, 'Copy link');
    await userEvent.keyboard('{Escape}');
    await expectActive(canvasElement, target);

    // Keyboard activation of a child keeps its own action.
    await userEvent.tab();
    await expectActive(canvasElement, within(target).getByRole('button', { name: 'Open' }));
    await userEvent.keyboard('{Enter}');
    await expect(args.onOpenChild).toHaveBeenCalledTimes(1);
    await expect(bodyOf(canvasElement).queryByRole('menu')).toBeNull();
    await expect(callValues(args.onOpenChange)).toEqual([true, false, true, false, true, false]);
  },
};

export const Danger: Story = {
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    const menu = await findMenu(canvasElement);
    const danger = within(menu).getByRole('menuitem', { name: 'Delete file' });
    const neutral = within(menu).getByRole('menuitem', { name: 'Rename' });
    await expect(getComputedStyle(danger).color).not.toBe(getComputedStyle(neutral).color);
    // The tone is a color; the label names the destructive command.
    await expect(danger).toHaveAccessibleName('Delete file');
  },
};

function ViewOptions({
  value,
  onValueChange,
  ...args
}: StoryArgs & { value?: boolean; onValueChange?: (checked: boolean) => void }) {
  return (
    <ContextMenu {...args}>
      <ContextMenu.Target aria-label="Board view options" style={targetBoxStyle}>
        <strong>Sprint board</strong>
      </ContextMenu.Target>
      <ContextMenu.Content>
        <ContextMenu.CheckboxItem defaultValue onValueChange={args.onCopy}>
          Show avatars
        </ContextMenu.CheckboxItem>
        <ContextMenu.CheckboxItem onValueChange={args.onRename} icon={<LinkIcon />}>
          Show links
        </ContextMenu.CheckboxItem>
        <ContextMenu.CheckboxItem value={value} onValueChange={onValueChange}>
          Compact rows
        </ContextMenu.CheckboxItem>
        <ContextMenu.CheckboxItem disabled>Show archived</ContextMenu.CheckboxItem>
        <ContextMenu.Separator />
        <ContextMenu.CheckboxItem closeOnSelect onValueChange={args.onDelete}>
          Pin board
        </ContextMenu.CheckboxItem>
      </ContextMenu.Content>
    </ContextMenu>
  );
}
ViewOptions.displayName = 'ViewOptions';

const compactChange = fn();

export const CheckboxItems: Story = {
  render: (args) => <ViewOptions {...args} value={false} onValueChange={compactChange} />,
  play: async ({ args, canvasElement, userEvent }) => {
    compactChange.mockClear();
    const target = getTarget(canvasElement, 'Board view options');
    await userEvent.tab();
    await userEvent.keyboard('{ContextMenu}');
    const menu = await findMenu(canvasElement, 'Board view options');
    const avatars = within(menu).getByRole('menuitemcheckbox', { name: 'Show avatars' });
    const links = within(menu).getByRole('menuitemcheckbox', { name: 'Show links' });
    await expect(avatars).toHaveAttribute('aria-checked', 'true');
    await expect(links).toHaveAttribute('aria-checked', 'false');
    const glyph = (item: HTMLElement) => item.querySelector('[data-ui="context-menu-check"]')!;
    await expect(glyph(avatars)).toHaveAttribute('data-state', 'checked');
    await expect(getComputedStyle(glyph(avatars).querySelector('svg')!).visibility).toBe('visible');
    await expect(getComputedStyle(glyph(links).querySelector('svg')!).visibility).toBe('hidden');
    // The check is independent of the icon slot.
    await expect(links.querySelector('[data-ui="context-menu-item-icon"]')).not.toBeNull();
    await expect(glyph(links)).toHaveAttribute('aria-hidden', 'true');

    // Enter and Space toggle once each and keep the menu open.
    await expectItemFocused(canvasElement, 'Show avatars', 'menuitemcheckbox');
    await userEvent.keyboard('{Enter}');
    await expect(avatars).toHaveAttribute('aria-checked', 'false');
    await expect(glyph(avatars)).toHaveAttribute('data-state', 'unchecked');
    await userEvent.keyboard('{ArrowDown} ');
    await expect(links).toHaveAttribute('aria-checked', 'true');
    await expect(callValues(args.onCopy)).toEqual([false]);
    await expect(callValues(args.onRename)).toEqual([true]);
    await expect(bodyOf(canvasElement).getByRole('menu')).toBe(menu);
    await expectItemFocused(canvasElement, 'Show links', 'menuitemcheckbox');

    // A rejected controlled value keeps the state until the prop changes.
    const compact = within(menu).getByRole('menuitemcheckbox', { name: 'Compact rows' });
    await userEvent.click(compact);
    await expect(callValues(compactChange)).toEqual([true]);
    await expect(compact).toHaveAttribute('aria-checked', 'false');
    await expect(glyph(compact)).toHaveAttribute('data-state', 'unchecked');

    // Disabled checkbox items do not toggle; the disabled one is skipped by arrows.
    const archived = within(menu).getByRole('menuitemcheckbox', { name: 'Show archived' });
    await userEvent.click(archived);
    await expect(archived).toHaveAttribute('aria-checked', 'false');
    await userEvent.keyboard('{End}');
    await expectItemFocused(canvasElement, 'Pin board', 'menuitemcheckbox');
    await userEvent.keyboard('{ArrowUp}');
    await expectItemFocused(canvasElement, 'Compact rows', 'menuitemcheckbox');

    // closeOnSelect: the value callback precedes the close request; focus returns.
    await userEvent.keyboard('{End}{Enter}');
    await expect(callValues(args.onDelete)).toEqual([true]);
    await expectClosed(canvasElement, target);
    await expectActive(canvasElement, target);
    await expect((args.onDelete as Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (args.onOpenChange as Mock).mock.invocationCallOrder.at(-1)!,
    );
    await expect(callValues(args.onOpenChange)).toEqual([true, false]);
  },
};

export const CheckboxSelected: Story = {
  args: { defaultOpen: true },
  render: (args) => <ViewOptions {...args} value />,
  play: async ({ canvasElement }) => {
    // Persistent open state with checked items so the axe gate sees them.
    const menu = await findMenu(canvasElement, 'Board view options');
    const checked = within(menu)
      .getAllByRole('menuitemcheckbox')
      .filter((item) => item.getAttribute('aria-checked') === 'true')
      .map((item) => item.textContent);
    await expect(checked).toEqual(['Show avatars', 'Compact rows']);
  },
};

export const PreventDefaultSelection: Story = {
  render: ({ onCopy, onOpenChild: _onOpenChild, onRename: _onRename, onDelete: _onDelete, ...args }) => (
    <ContextMenu {...args}>
      <ContextMenu.Target aria-label={TARGET} style={targetBoxStyle}>
        report.pdf
      </ContextMenu.Target>
      <ContextMenu.Content>
        <ContextMenu.Item onSelect={onCopy} onClick={(event) => event.preventDefault()}>
          Copy link
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ContextMenu}');
    const menu = await findMenu(canvasElement);
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Copy link' }));
    // The command still runs once; the menu stays open.
    await expect(args.onCopy).toHaveBeenCalledTimes(1);
    await expect(bodyOf(canvasElement).getByRole('menu')).toBe(menu);
    await expect(callValues(args.onOpenChange)).toEqual([true]);
  },
};

export const NativeEventVeto: Story = {
  args: {
    targetProps: {
      onContextMenu: (event) => event.preventDefault(),
      onKeyDown: (event) => {
        if (event.key === 'F10') event.preventDefault();
      },
    },
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    const box = target.getBoundingClientRect();
    // The consumer's preventDefault vetoes the open request.
    await contextClick(userEvent, target, box.left + 20, box.top + 20);
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    await expect(bodyOf(canvasElement).queryByRole('menu')).toBeNull();
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    // The ContextMenu key is not vetoed.
    await userEvent.keyboard('{ContextMenu}');
    await findMenu(canvasElement);
    await expect(callValues(args.onOpenChange)).toEqual([true]);
  },
};

export const EmptyMenu: Story = {
  render: ({ onOpenChild: _onOpenChild, onCopy: _onCopy, onRename: _onRename, onDelete: _onDelete, ...args }) => (
    <ContextMenu {...args}>
      <ContextMenu.Target aria-label={TARGET} style={targetBoxStyle}>
        report.pdf
      </ContextMenu.Target>
      <ContextMenu.Content />
    </ContextMenu>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    await userEvent.tab();
    await userEvent.keyboard('{ContextMenu}');
    const menu = await findMenu(canvasElement);
    // The named menu container takes focus.
    await expectActive(canvasElement, menu);
    await expectFocusRing(menu);
    await userEvent.keyboard('{ArrowDown}{End}x');
    await expectActive(canvasElement, menu);
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expectActive(canvasElement, target);
    // End open so the axe gate sees the empty menu.
    await userEvent.keyboard('{ContextMenu}');
    await findMenu(canvasElement);
  },
};

export const AllDisabled: Story = {
  render: ({ onOpenChild: _onOpenChild, onCopy, onRename: _onRename, onDelete: _onDelete, ...args }) => (
    <ContextMenu {...args}>
      <ContextMenu.Target aria-label={TARGET} style={targetBoxStyle}>
        report.pdf
      </ContextMenu.Target>
      <ContextMenu.Content>
        <ContextMenu.Item disabled onSelect={onCopy}>
          Copy link
        </ContextMenu.Item>
        <ContextMenu.CheckboxItem disabled>Pinned</ContextMenu.CheckboxItem>
      </ContextMenu.Content>
    </ContextMenu>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    await userEvent.tab();
    await userEvent.keyboard('{ContextMenu}');
    const menu = await findMenu(canvasElement);
    await expectActive(canvasElement, menu);
    await userEvent.keyboard('{ArrowDown}{ArrowUp}{Home}c');
    await expectActive(canvasElement, menu);
    // Disabled items block pointer and programmatic activation.
    const item = within(menu).getByRole('menuitem', { name: 'Copy link' });
    await expect(item).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(item);
    item.click();
    await expect(args.onCopy).not.toHaveBeenCalled();
    await expect(bodyOf(canvasElement).getByRole('menu')).toBe(menu);
    // Tab still leaves.
    await userEvent.tab();
    await expectClosed(canvasElement, target);
    await expect(callValues(args.onOpenChange)).toEqual([true, false]);
  },
};

export const DisabledTarget: Story = {
  args: { targetProps: { disabled: true } },
  play: async ({ args, canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    await expect(target).not.toHaveAttribute('aria-haspopup');
    await expect(target).not.toHaveAttribute('aria-expanded');
    await expect(target).toHaveAttribute('data-disabled');
    // The native context menu is left alone.
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 });
    target.dispatchEvent(event);
    await expect(event.defaultPrevented).toBe(false);
    await userEvent.tab();
    await userEvent.keyboard('{ContextMenu}{Shift>}{F10}{/Shift}');
    await expect(bodyOf(canvasElement).queryByRole('menu')).toBeNull();
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};

export const LongLabels: Story = {
  args: { defaultOpen: true },
  render: ({ onCopy, onOpenChild: _onOpenChild, onRename: _onRename, onDelete: _onDelete, ...args }) => (
    <ContextMenu {...args}>
      <ContextMenu.Target aria-label={TARGET} style={targetBoxStyle}>
        report.pdf
      </ContextMenu.Target>
      <ContextMenu.Content>
        <ContextMenu.Item onSelect={onCopy}>
          Copiar el enlace público de este informe trimestral al portapapeles
        </ContextMenu.Item>
        <ContextMenu.Item>Rename</ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu>
  ),
  play: async ({ canvasElement }) => {
    const menu = await findMenu(canvasElement);
    const long = within(menu).getByRole('menuitem', { name: /Copiar el enlace/ });
    const short = within(menu).getByRole('menuitem', { name: 'Rename' });
    const rootFontSize = parseFloat(getComputedStyle(canvasElement.ownerDocument.documentElement).fontSize);
    // The label wraps inside the preferred width instead of being cut off.
    await expect(menu.getBoundingClientRect().width).toBeLessThanOrEqual(13 * rootFontSize + TOLERANCE_PX);
    await expect(long.getBoundingClientRect().height).toBeGreaterThan(short.getBoundingClientRect().height + TOLERANCE_PX);
    const label = long.lastElementChild!.getBoundingClientRect();
    const item = long.getBoundingClientRect();
    await expect(label.right).toBeLessThanOrEqual(item.right + TOLERANCE_PX);
    await expect(label.bottom).toBeLessThanOrEqual(item.bottom + TOLERANCE_PX);
    await expect(short.getBoundingClientRect().height).toBeGreaterThanOrEqual(32 - TOLERANCE_PX);
  },
};

export const ManyItems: Story = {
  render: ({ onOpenChild: _onOpenChild, onCopy: _onCopy, onRename: _onRename, onDelete: _onDelete, ...args }) => (
    <ContextMenu {...args}>
      <ContextMenu.Target aria-label={TARGET} style={targetBoxStyle}>
        report.pdf
      </ContextMenu.Target>
      <ContextMenu.Content>
        {Array.from({ length: 20 }, (_, index) => (
          <ContextMenu.Item key={index}>{`Move to folder ${index + 1}`}</ContextMenu.Item>
        ))}
      </ContextMenu.Content>
    </ContextMenu>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ContextMenu}');
    const menu = await findMenu(canvasElement);
    // The menu scrolls past its maximum height; scrolling inside it keeps it open.
    await expect(menu.getBoundingClientRect().height).toBeLessThanOrEqual(300 + TOLERANCE_PX);
    await expect(menu.scrollHeight).toBeGreaterThan(menu.clientHeight);
    await userEvent.keyboard('{End}');
    await expectItemFocused(canvasElement, 'Move to folder 20');
    await waitFor(() => expect(menu.scrollTop).toBeGreaterThan(0));
    await expect(bodyOf(canvasElement).getByRole('menu')).toBe(menu);
    await expect(callValues(args.onOpenChange)).toEqual([true]);
  },
};

export const ViewportCorners: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    const view = canvasElement.ownerDocument.defaultView!;
    const { innerWidth, innerHeight } = view;
    const inset = VIEWPORT_PADDING + ANCHOR_GAP;
    const corners = [
      { x: inset, y: inset },
      { x: innerWidth - inset, y: inset },
      { x: inset, y: innerHeight - inset },
      { x: innerWidth - inset, y: innerHeight - inset },
    ];
    for (const corner of corners) {
      await contextClick(userEvent, target, corner.x, corner.y);
      const menu = await findMenu(canvasElement);
      // Flip and shift keep the menu inside the viewport's collision padding.
      await expectInsideViewport(menu, view);
      // The entry scale still grows from the pointer after collision correction (measured once
      // the scale settled).
      await wait(SETTLE_MS);
      const rect = menu.getBoundingClientRect();
      const { x: originX, y: originY } = originOf(menu);
      await expect(near(originX, corner.x - rect.left)).toBe(true);
      await expect(near(originY, corner.y - rect.top)).toBe(true);
      await userEvent.keyboard('{Escape}');
      await expectClosed(canvasElement);
    }
  },
};

export const ScrollAndResize: Story = {
  args: { open: true },
  play: async ({ args, canvasElement }) => {
    const menu = await findMenu(canvasElement);
    const document = canvasElement.ownerDocument;
    // Scrolling inside the menu keeps it open.
    menu.dispatchEvent(new Event('scroll'));
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    // Outside scroll and resize ask to close once; the rejected request keeps the menu in place.
    const before = menu.getBoundingClientRect();
    document.dispatchEvent(new Event('scroll'));
    document.defaultView!.dispatchEvent(new Event('resize'));
    document.dispatchEvent(new Event('scroll'));
    await expect(callValues(args.onOpenChange)).toEqual([false]);
    await expect(bodyOf(canvasElement).getByRole('menu')).toBe(menu);
    await expect(near(menu.getBoundingClientRect().top, before.top)).toBe(true);
    await expectItemFocused(canvasElement, 'Copy link');
  },
};

export const ScrollCloses: Story = {
  play: async ({ args, canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    const box = target.getBoundingClientRect();
    await contextClick(userEvent, target, box.left + 30, box.top + 30);
    await expectItemFocused(canvasElement, 'Copy link');
    // Dismissal by an outside scroll never focuses the invoker.
    const targetFocus = fn();
    target.addEventListener('focus', targetFocus);
    canvasElement.ownerDocument.dispatchEvent(new Event('scroll'));
    await expectClosed(canvasElement);
    target.removeEventListener('focus', targetFocus);
    await expect(targetFocus).not.toHaveBeenCalled();
    await expect(callValues(args.onOpenChange)).toEqual([true, false]);
  },
};

/** Renders `children` into a same-origin frame: another document and another JS realm. */
function FrameHost({ children }: { children: ReactNode }) {
  const [body, setBody] = useState<HTMLElement | null>(null);
  const attach = useCallback((frame: HTMLIFrameElement | null) => setBody(frame?.contentDocument?.body ?? null), []);
  return (
    <>
      <iframe ref={attach} title="Embedded file view" style={frameBoxStyle} />
      {body && createPortal(<ScopedHost>{children}</ScopedHost>, body)}
    </>
  );
}
FrameHost.displayName = 'FrameHost';

export const ScrollInFrame: Story = {
  render: (args) => (
    <FrameHost>
      <FileMenu {...args} />
    </FrameHost>
  ),
  play: async ({ args, canvasElement }) => {
    const frameDocument = canvasElement.querySelector('iframe')!.contentDocument!;
    const frameView = frameDocument.defaultView!;
    const target = await waitFor(() => within(frameDocument.body).getByRole('group', { name: TARGET }));
    // The new frame resizes once while it is laid out; open after that.
    await wait(SETTLE_MS);
    const box = target.getBoundingClientRect();
    const point = { clientX: box.left + 20, clientY: box.top + 20 };
    target.dispatchEvent(new frameView.MouseEvent('contextmenu', { bubbles: true, cancelable: true, ...point }));
    const menu = await waitFor(() => within(frameDocument.body).getByRole('menu', { name: TARGET }));
    await expect(callValues(args.onOpenChange)).toEqual([true]);
    // The menu's nodes belong to the frame's realm, not to this one.
    await expect(menu).toBeInstanceOf(frameView.Node);
    await expect(menu instanceof canvasElement.ownerDocument.defaultView!.Node).toBe(false);

    // Scrolling inside the menu keeps it open.
    menu.dispatchEvent(new frameView.Event('scroll'));
    within(menu).getAllByRole('menuitem')[0]!.dispatchEvent(new frameView.Event('scroll'));
    await expect(callValues(args.onOpenChange)).toEqual([true]);
    await expect(within(frameDocument.body).getByRole('menu')).toBe(menu);

    // Scrolling the frame's document asks once to close it.
    frameDocument.dispatchEvent(new frameView.Event('scroll'));
    frameDocument.dispatchEvent(new frameView.Event('scroll'));
    await waitFor(() => expect(within(frameDocument.body).queryByRole('menu')).toBeNull());
    await expect(callValues(args.onOpenChange)).toEqual([true, false]);
  },
};

/** Accepts every request except the first close. */
function RejectFirstClose(args: StoryArgs) {
  const [open, setOpen] = useState(false);
  const rejected = useRef(false);
  return (
    <FileRow
      {...args}
      open={open}
      onOpenChange={(next) => {
        args.onOpenChange?.(next);
        if (!next && !rejected.current) {
          rejected.current = true;
          return;
        }
        setOpen(next);
      }}
    />
  );
}
RejectFirstClose.displayName = 'RejectFirstClose';

export const RejectedEscapeThenScroll: Story = {
  render: (args) => <RejectFirstClose {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const document = canvasElement.ownerDocument;
    const target = getTarget(canvasElement);
    const after = getAfter(canvasElement);
    const targetFocus = fn();
    await userEvent.tab();
    await userEvent.keyboard('{ContextMenu}');
    await expectItemFocused(canvasElement, 'Copy link');

    // The parent rejects Escape: the menu stays and keeps focus.
    await userEvent.keyboard('{Escape}');
    await expect(callValues(args.onOpenChange)).toEqual([true, false]);
    await expect(bodyOf(canvasElement).getByRole('menu')).toBeVisible();
    await expectItemFocused(canvasElement, 'Copy link');

    // An accepted scroll dismissal afterwards never focuses the invoker, not even transiently.
    target.addEventListener('focus', targetFocus);
    document.dispatchEvent(new Event('scroll'));
    await expectClosed(canvasElement);
    await wait(SETTLE_MS);
    target.removeEventListener('focus', targetFocus);
    await expect(targetFocus).not.toHaveBeenCalled();
    await expect(document.activeElement).not.toBe(target);
    await expect(callValues(args.onOpenChange)).toEqual([true, false, false]);

    // The next closes decide afresh: an outside press leaves focus where it landed...
    target.focus();
    await userEvent.keyboard('{ContextMenu}');
    await expectItemFocused(canvasElement, 'Copy link');
    target.addEventListener('focus', targetFocus);
    await userEvent.click(after);
    await expectClosed(canvasElement);
    await wait(SETTLE_MS);
    target.removeEventListener('focus', targetFocus);
    await expect(targetFocus).not.toHaveBeenCalled();
    await expectActive(canvasElement, after);

    // ...and an accepted Escape still returns focus to the invoker.
    target.focus();
    await userEvent.keyboard('{ContextMenu}');
    await expectItemFocused(canvasElement, 'Copy link');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expectActive(canvasElement, target);
    await expect(callValues(args.onOpenChange)).toEqual([true, false, false, true, false, true, false]);
  },
};

function ControlledFileMenu(args: StoryArgs) {
  const [open, setOpen] = useState(false);
  return (
    <FileRow
      {...args}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        args.onOpenChange?.(next);
      }}
    />
  );
}
ControlledFileMenu.displayName = 'ControlledFileMenu';

export const ControlledAccept: Story = {
  render: (args) => <ControlledFileMenu {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    const box = target.getBoundingClientRect();
    await contextClick(userEvent, target, box.left + 30, box.top + 30);
    await findMenu(canvasElement);
    await expectItemFocused(canvasElement, 'Copy link');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expectActive(canvasElement, target);
    await expect(callValues(args.onOpenChange)).toEqual([true, false]);
  },
};

export const RejectedOpen: Story = {
  args: { open: false },
  play: async ({ args, canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    await userEvent.tab();
    await userEvent.keyboard('{ContextMenu}');
    await expect(callValues(args.onOpenChange)).toEqual([true]);
    await expect(bodyOf(canvasElement).queryByRole('menu')).toBeNull();
    await expect(target).toHaveAttribute('aria-expanded', 'false');
    // Focus stays on the Target.
    await expectActive(canvasElement, target);
  },
};

export const RejectedClose: Story = {
  args: { open: true },
  play: async ({ args, canvasElement, userEvent }) => {
    const target = getTarget(canvasElement);
    const menu = await findMenu(canvasElement);
    // A programmatic open anchors below the Target, never at the viewport origin.
    const box = target.getBoundingClientRect();
    await waitFor(() => {
      expect(near(menu.getBoundingClientRect().left, box.left)).toBe(true);
      expect(near(menu.getBoundingClientRect().top, box.bottom + ANCHOR_GAP)).toBe(true);
    });
    await expectItemFocused(canvasElement, 'Copy link');
    await userEvent.keyboard('{Escape}');
    await expect(callValues(args.onOpenChange)).toEqual([false]);
    // The menu stays and keeps focus.
    await expect(bodyOf(canvasElement).getByRole('menu')).toBe(menu);
    await expectItemFocused(canvasElement, 'Copy link');
  },
};

const externalCompactChange = fn();

/** Owns both controlled values; the buttons change them without any request from the menu. */
function ExternallyControlled(args: StoryArgs) {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  return (
    <div style={rowStyle}>
      <ViewOptions
        {...args}
        open={open}
        onOpenChange={(next) => {
          args.onOpenChange?.(next);
          setOpen(next);
        }}
        value={compact}
        onValueChange={(next) => {
          externalCompactChange(next);
          setCompact(next);
        }}
      />
      <Button onClick={() => setOpen((current) => !current)}>Toggle menu</Button>
      <Button onClick={() => setCompact((current) => !current)}>Toggle compact</Button>
    </div>
  );
}
ExternallyControlled.displayName = 'ExternallyControlled';

export const ControlledExternalUpdates: Story = {
  render: (args) => <ExternallyControlled {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    externalCompactChange.mockClear();
    const canvas = within(canvasElement);
    const target = getTarget(canvasElement, 'Board view options');
    // Programmatic clicks: app-driven updates, not presses outside the menu.
    const toggleMenu = () => fireEvent.click(canvas.getByRole('button', { name: 'Toggle menu' }));
    const toggleCompact = () => fireEvent.click(canvas.getByRole('button', { name: 'Toggle compact' }));
    const glyph = (item: HTMLElement) => item.querySelector('[data-ui="context-menu-check"]')!;
    const targetFocus = fn();

    // An external open shows the menu below the Target and focuses the first item; no request fires.
    toggleMenu();
    const menu = await findMenu(canvasElement, 'Board view options');
    await expect(target).toHaveAttribute('aria-expanded', 'true');
    await expect(target).toHaveAttribute('aria-controls', menu.id);
    await expectItemFocused(canvasElement, 'Show avatars', 'menuitemcheckbox');
    await waitFor(() => expect(near(menu.getBoundingClientRect().top, target.getBoundingClientRect().bottom + ANCHOR_GAP)).toBe(true));

    // An external value change updates state, glyph and ARIA without a callback or moving focus.
    const compact = within(menu).getByRole('menuitemcheckbox', { name: 'Compact rows' });
    await expect(compact).toHaveAttribute('aria-checked', 'false');
    toggleCompact();
    await waitFor(() => expect(compact).toHaveAttribute('aria-checked', 'true'));
    await expect(glyph(compact)).toHaveAttribute('data-state', 'checked');
    await expect(getComputedStyle(glyph(compact).querySelector('svg')!).visibility).toBe('visible');
    await expect(externalCompactChange).not.toHaveBeenCalled();
    await expectItemFocused(canvasElement, 'Show avatars', 'menuitemcheckbox');

    // The user's own toggle starts from the external value.
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expectItemFocused(canvasElement, 'Compact rows', 'menuitemcheckbox');
    await userEvent.keyboard('{Enter}');
    await expect(callValues(externalCompactChange)).toEqual([false]);
    await expect(compact).toHaveAttribute('aria-checked', 'false');
    await expect(glyph(compact)).toHaveAttribute('data-state', 'unchecked');

    // An external close removes the menu and never focuses the invoker.
    target.addEventListener('focus', targetFocus);
    toggleMenu();
    await expectClosed(canvasElement, target);
    await wait(SETTLE_MS);
    target.removeEventListener('focus', targetFocus);
    await expect(targetFocus).not.toHaveBeenCalled();
    await expect(target).not.toHaveAttribute('aria-controls');
    await expect(args.onOpenChange).not.toHaveBeenCalled();

    // Reopened externally, the menu shows the current value; an accepted Escape still returns focus.
    toggleCompact();
    toggleMenu();
    const reopened = await findMenu(canvasElement, 'Board view options');
    await expect(within(reopened).getByRole('menuitemcheckbox', { name: 'Compact rows' })).toHaveAttribute('aria-checked', 'true');
    await expectItemFocused(canvasElement, 'Show avatars', 'menuitemcheckbox');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement, target);
    await expectActive(canvasElement, target);
    await expect(callValues(args.onOpenChange)).toEqual([false]);
    await expect(callValues(externalCompactChange)).toEqual([false]);
  },
};

export const FocusReturnPerInstance: Story = {
  render: (args) => (
    <div style={rowStyle}>
      <FileMenu {...args} />
      <ContextMenu>
        <ContextMenu.Target aria-label="notes.txt actions" style={targetBoxStyle}>
          notes.txt
        </ContextMenu.Target>
        <ContextMenu.Content>
          <ContextMenu.Item>Copy link</ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu>
    </div>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const first = getTarget(canvasElement);
    const second = getTarget(canvasElement, 'notes.txt actions');
    await expect(first.id).not.toBe(second.id);
    second.focus();
    await userEvent.keyboard('{ContextMenu}');
    const menu = await findMenu(canvasElement, 'notes.txt actions');
    await expect(second).toHaveAttribute('aria-controls', menu.id);
    await expect(first).not.toHaveAttribute('aria-controls');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement, second);
    // Focus returns to the instance that opened the menu.
    await expectActive(canvasElement, second);
  },
};

export const PersistentOpen: Story = {
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    // Persistent open state so the axe gate sees the portaled menu.
    const target = getTarget(canvasElement);
    const menu = await findMenu(canvasElement);
    await expect(within(menu).getAllByRole('menuitem')).toHaveLength(4);
    await expect(within(menu).getByRole('menuitem', { name: 'Move' })).toHaveAttribute('aria-disabled', 'true');
    await expect(within(menu).getByRole('separator')).toHaveAttribute('data-ui', 'context-menu-separator');
    await expect(within(menu).getByRole('separator')).not.toHaveAttribute('tabindex');
    // A programmatic open anchors below the Target.
    const box = target.getBoundingClientRect();
    await waitFor(() => expect(near(menu.getBoundingClientRect().top, box.bottom + ANCHOR_GAP)).toBe(true));
    for (const item of within(menu).getAllByRole('menuitem')) {
      await expect(item.getBoundingClientRect().height).toBeGreaterThanOrEqual(32 - TOLERANCE_PX);
    }
  },
};

export const LightTheme: Story = {
  globals: { theme: 'light' },
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    const menu = await findMenu(canvasElement);
    await expectThemedSurface(menu, 'light');
  },
};

function ScopedHost({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <ThemeRoot theme="light" portalContainer={host} style={{ padding: vars.space[4], backgroundColor: vars.color.bg }}>
      {children}
      <div ref={setHost} data-overlay-host="" />
    </ThemeRoot>
  );
}
ScopedHost.displayName = 'ScopedHost';

export const ScopedPortal: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <ScopedHost>
      <FileMenu {...args} />
    </ScopedHost>
  ),
  play: async ({ canvasElement }) => {
    const menu = await findMenu(canvasElement);
    // Portaled into the scope's host (mounted after the menu asked for it), keeping its theme.
    await expect(canvasElement.querySelector('[data-overlay-host]')!.contains(menu)).toBe(true);
    await expectThemedSurface(menu, 'light');
  },
};

export const RTL: Story = {
  render: ({ onCopy, onRename, onOpenChild: _onOpenChild, onDelete: _onDelete, ...args }) => (
    <div dir="rtl" lang="he">
      <ContextMenu {...args}>
        <ContextMenu.Target aria-label="פעולות קובץ" style={targetBoxStyle}>
          report.pdf
        </ContextMenu.Target>
        <ContextMenu.Content>
          <ContextMenu.Item onSelect={onCopy}>העתקת קישור</ContextMenu.Item>
          <ContextMenu.Item onSelect={onRename}>שינוי שם</ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu>
    </div>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const target = getTarget(canvasElement, 'פעולות קובץ');
    await userEvent.tab();
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    const menu = await findMenu(canvasElement, 'פעולות קובץ');
    // The portaled menu takes the Target's direction and opens at its inline start (the right).
    await expect(menu).toHaveAttribute('dir', 'rtl');
    await waitFor(() =>
      expect(near(menu.getBoundingClientRect().right, target.getBoundingClientRect().right)).toBe(true),
    );
    // Arrow keys stay vertical in RTL.
    await expectItemFocused(canvasElement, 'העתקת קישור');
    await userEvent.keyboard('{ArrowDown}');
    await expectItemFocused(canvasElement, 'שינוי שם');
    await userEvent.keyboard('{ArrowLeft}');
    await expectItemFocused(canvasElement, 'שינוי שם');
  },
};

const popoverOpenChange = fn();

export const InsidePopover: Story = {
  render: (args) => (
    <div style={rowStyle}>
      <Popover defaultOpen onOpenChange={popoverOpenChange}>
        <Popover.Trigger>Project</Popover.Trigger>
        <Popover.Content aria-label="Project">
          <FileMenu {...args} />
        </Popover.Content>
      </Popover>
      <Button>Outside</Button>
    </div>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    popoverOpenChange.mockClear();
    const popover = await bodyOf(canvasElement).findByRole('dialog', { name: 'Project' });
    const target = within(popover).getByRole('group', { name: TARGET });
    target.focus();
    await userEvent.keyboard('{ContextMenu}');
    await findMenu(canvasElement);
    await expectItemFocused(canvasElement, 'Copy link');

    // Only the topmost layer handles Escape.
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement, target);
    await expectActive(canvasElement, target);
    await expect(popoverOpenChange).not.toHaveBeenCalled();
    await expect(popover).toBeVisible();

    // Escape with focus back in the popover's content (Shift+Tab keeps the menu open) still
    // closes only the menu, its topmost child layer.
    await userEvent.keyboard('{ContextMenu}');
    await expectItemFocused(canvasElement, 'Copy link');
    await userEvent.tab({ shift: true });
    await expectActive(canvasElement, target);
    await expect(bodyOf(canvasElement).getByRole('menu')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement, target);
    await expectActive(canvasElement, target);
    await expect(popoverOpenChange).not.toHaveBeenCalled();
    await expect(popover).toBeVisible();

    // A press inside the popover outside the menu closes the menu only.
    const box = target.getBoundingClientRect();
    await contextClick(userEvent, target, box.left + 20, box.top + 20);
    await findMenu(canvasElement);
    await userEvent.click(popover);
    await expectClosed(canvasElement, target);
    await expect(popoverOpenChange).not.toHaveBeenCalled();

    // A press outside both surfaces closes the menu only, too.
    await contextClick(userEvent, target, box.left + 20, box.top + 20);
    await findMenu(canvasElement);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Outside' }));
    await expectClosed(canvasElement, target);
    await expect(popoverOpenChange).not.toHaveBeenCalled();
    await expect(popover).toBeVisible();
    await expect(callValues(args.onOpenChange)).toEqual([true, false, true, false, true, false, true, false]);

    // With the menu closed, Escape reaches the popover.
    target.focus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(bodyOf(canvasElement).queryByRole('dialog')).toBeNull());
    await expect(callValues(popoverOpenChange)).toEqual([false]);
  },
};

export const AriaMerge: Story = {
  args: { defaultOpen: true },
  render: ({ onCopy, onOpenChild: _onOpenChild, onRename: _onRename, onDelete: _onDelete, ...args }) => (
    <div style={rowStyle}>
      <span id="file-label">Quarterly report</span>
      <span id="file-help">Shared with finance</span>
      <span id="menu-label">Actions</span>
      <ContextMenu {...args}>
        <ContextMenu.Target aria-labelledby="file-label" aria-describedby="file-help missing-id" style={targetBoxStyle}>
          report.pdf
        </ContextMenu.Target>
        <ContextMenu.Content aria-labelledby="menu-label missing-id" aria-describedby="file-help">
          <ContextMenu.Item onSelect={onCopy}>Copy link</ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu>
      <ContextMenu defaultOpen>
        <ContextMenu.Target aria-label="notes.txt actions" style={targetBoxStyle}>
          notes.txt
        </ContextMenu.Target>
        <ContextMenu.Content aria-label="Note actions">
          <ContextMenu.Item>Copy link</ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Consumer naming and description ids survive on the Target, an unresolved one included.
    const target = getTarget(canvasElement, 'Quarterly report');
    await expect(target).toHaveAttribute('aria-labelledby', 'file-label');
    await expect(target).toHaveAttribute('aria-describedby', 'file-help missing-id');
    await expect(target).toHaveAccessibleDescription('Shared with finance');

    // Consumer label ids join the Target's label ids (accname does not follow nested labelledby).
    const menu = await findMenu(canvasElement, 'Actions Quarterly report');
    await expect(menu).toHaveAttribute('aria-labelledby', 'menu-label missing-id file-label');
    await expect(menu).toHaveAttribute('aria-describedby', 'file-help');
    await expect(target).toHaveAttribute('aria-controls', menu.id);

    // A consumer aria-label replaces the Target-derived name; ids stay unique per instance.
    const notes = getTarget(canvasElement, 'notes.txt actions');
    const notesMenu = await findMenu(canvasElement, 'Note actions');
    await expect(notesMenu).not.toHaveAttribute('aria-labelledby');
    await expect(notes).toHaveAttribute('aria-controls', notesMenu.id);
    await expect(notesMenu.id).not.toBe(menu.id);
    await expect(notes.id).not.toBe(target.id);
  },
};

export const FalsyNodes: Story = {
  args: { defaultOpen: true },
  render: ({ onOpenChild: _onOpenChild, onCopy: _onCopy, onRename: _onRename, onDelete: _onDelete, ...args }) => (
    <ContextMenu {...args}>
      <ContextMenu.Target aria-label={TARGET} style={targetBoxStyle}>
        report.pdf
      </ContextMenu.Target>
      <ContextMenu.Content>
        <ContextMenu.Item icon={false}>No icon false</ContextMenu.Item>
        <ContextMenu.Item icon={null}>No icon null</ContextMenu.Item>
        <ContextMenu.Item icon="">No icon empty</ContextMenu.Item>
        <ContextMenu.Item icon={0}>Zero icon</ContextMenu.Item>
        <ContextMenu.Item>{0}</ContextMenu.Item>
        <ContextMenu.Item aria-label="Unlabelled">{false}</ContextMenu.Item>
        <ContextMenu.CheckboxItem icon={false}>Checkbox no icon</ContextMenu.CheckboxItem>
        {false}
        {null}
      </ContextMenu.Content>
    </ContextMenu>
  ),
  play: async ({ canvasElement }) => {
    const menu = await findMenu(canvasElement);
    const iconOf = (name: string, role = 'menuitem') =>
      within(menu).getByRole(role, { name }).querySelector('[data-ui="context-menu-item-icon"]');
    await expect(iconOf('No icon false')).toBeNull();
    await expect(iconOf('No icon null')).toBeNull();
    await expect(iconOf('No icon empty')).toBeNull();
    await expect(iconOf('Checkbox no icon', 'menuitemcheckbox')).toBeNull();
    // 0 is content: it renders.
    await expect(iconOf('Zero icon')).toHaveTextContent('0');
    await expect(within(menu).getByRole('menuitem', { name: '0' })).toHaveTextContent('0');
    // A false label renders no label wrapper; the consumer's aria-label names the item.
    const unlabelled = within(menu).getByRole('menuitem', { name: 'Unlabelled' });
    await expect(unlabelled.childElementCount).toBe(0);
    await expect(within(menu).getAllByRole('menuitem')).toHaveLength(6);
    await expect(within(menu).getAllByRole('menuitemcheckbox')).toHaveLength(1);
  },
};

const targetRef = fn();
const triggerRef = fn();
const contentRef = fn();
const itemRef = fn();
const checkboxRef = fn();
const separatorRef = fn();

export const RefTargets: Story = {
  args: { defaultOpen: true },
  render: ({ onOpenChild: _onOpenChild, onCopy: _onCopy, onRename: _onRename, onDelete: _onDelete, ...args }) => (
    <ContextMenu {...args}>
      <ContextMenu.Target ref={targetRef} aria-label={TARGET} style={targetBoxStyle}>
        report.pdf
        <ContextMenu.Trigger ref={triggerRef}>More actions</ContextMenu.Trigger>
      </ContextMenu.Target>
      <ContextMenu.Content ref={contentRef}>
        <ContextMenu.Item ref={itemRef}>Copy link</ContextMenu.Item>
        <ContextMenu.Separator ref={separatorRef} />
        <ContextMenu.CheckboxItem ref={checkboxRef}>Pinned</ContextMenu.CheckboxItem>
      </ContextMenu.Content>
    </ContextMenu>
  ),
  play: async ({ canvasElement }) => {
    const view = canvasElement.ownerDocument.defaultView!;
    const target = getTarget(canvasElement);
    const trigger = within(target).getByRole('button', { name: 'More actions' });
    const menu = await findMenu(canvasElement);
    const item = within(menu).getByRole('menuitem', { name: 'Copy link' });
    const checkbox = within(menu).getByRole('menuitemcheckbox', { name: 'Pinned' });
    const separator = within(menu).getByRole('separator');

    await expect(targetRef).toHaveBeenLastCalledWith(target);
    await expect(target).toBeInstanceOf(view.HTMLDivElement);
    await expect(triggerRef).toHaveBeenLastCalledWith(trigger);
    await expect(trigger).toBeInstanceOf(view.HTMLButtonElement);
    await expect(contentRef).toHaveBeenLastCalledWith(menu);
    await expect(itemRef).toHaveBeenLastCalledWith(item);
    await expect(item).toBeInstanceOf(view.HTMLButtonElement);
    await expect(checkboxRef).toHaveBeenLastCalledWith(checkbox);
    await expect(separatorRef).toHaveBeenLastCalledWith(separator);
    await expect(item).toHaveAttribute('data-ui', 'context-menu-item');
    await expect(checkbox).toHaveAttribute('data-ui', 'context-menu-checkbox-item');

    await expect(ContextMenu.displayName).toBe('ContextMenu');
    await expect(
      [
        ContextMenu.Target,
        ContextMenu.Trigger,
        ContextMenu.Content,
        ContextMenu.Item,
        ContextMenu.CheckboxItem,
        ContextMenu.Separator,
      ].map((part) => part.displayName),
    ).toEqual([
      'ContextMenu.Target',
      'ContextMenu.Trigger',
      'ContextMenu.Content',
      'ContextMenu.Item',
      'ContextMenu.CheckboxItem',
      'ContextMenu.Separator',
    ]);
  },
};

export const SxPrecedence: Story = {
  args: { defaultOpen: true },
  render: ({ onOpenChild: _onOpenChild, onCopy: _onCopy, onRename: _onRename, onDelete: _onDelete, ...args }) => (
    <ContextMenu {...args}>
      <ContextMenu.Target className="consumer-target" css={consumerCss} sx={consumerSx} aria-label={TARGET}>
        report.pdf
        <ContextMenu.Trigger className="consumer-trigger" css={consumerCss} sx={consumerSx}>
          More actions
        </ContextMenu.Trigger>
      </ContextMenu.Target>
      <ContextMenu.Content className="consumer-content" css={consumerCss} sx={consumerSx}>
        <ContextMenu.Item className="consumer-item" css={consumerCss} sx={consumerSx}>
          Copy link
        </ContextMenu.Item>
        <ContextMenu.CheckboxItem className="consumer-checkbox" css={consumerCss} sx={consumerSx}>
          Pinned
        </ContextMenu.CheckboxItem>
        <ContextMenu.Separator className="consumer-separator" css={consumerCss} sx={consumerSx} />
      </ContextMenu.Content>
    </ContextMenu>
  ),
  play: async ({ canvasElement }) => {
    const target = getTarget(canvasElement);
    const menu = await findMenu(canvasElement);
    const parts: Array<[string, HTMLElement]> = [
      ['consumer-target', target],
      ['consumer-trigger', within(target).getByRole('button', { name: 'More actions' })],
      ['consumer-content', menu],
      ['consumer-item', within(menu).getByRole('menuitem', { name: 'Copy link' })],
      ['consumer-checkbox', within(menu).getByRole('menuitemcheckbox', { name: 'Pinned' })],
      ['consumer-separator', within(menu).getByRole('separator')],
    ];
    for (const [className, element] of parts) {
      await expect(element).toHaveClass(className);
      // own → css → sx: sx wins the shared property, css keeps the rest.
      const margin = parseFloat(getComputedStyle(element).marginInlineStart);
      await expect(near(margin, resolvedPx(element, vars.space[2]))).toBe(true);
      await expect(near(margin, resolvedPx(element, vars.space[1]))).toBe(false);
      await expect(getComputedStyle(element).letterSpacing).not.toBe('normal');
    }
  },
};

class UsageErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }
  render() {
    return this.state.message === null ? this.props.children : <p data-usage-error="">{this.state.message}</p>;
  }
}

export const UsageErrors: Story = {
  render: () => (
    <div style={rowStyle}>
      <UsageErrorBoundary>
        <ContextMenu.Target aria-label={TARGET}>report.pdf</ContextMenu.Target>
      </UsageErrorBoundary>
      <UsageErrorBoundary>
        <ContextMenu defaultOpen>
          <ContextMenu.Item>Copy link</ContextMenu.Item>
        </ContextMenu>
      </UsageErrorBoundary>
      <UsageErrorBoundary>
        <ContextMenu defaultOpen>
          <ContextMenu.CheckboxItem>Pinned</ContextMenu.CheckboxItem>
        </ContextMenu>
      </UsageErrorBoundary>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const messages = Array.from(canvasElement.querySelectorAll('[data-usage-error]'), (node) => node.textContent);
    await expect(messages).toEqual([
      'ContextMenu.Target must be rendered inside <ContextMenu>.',
      'ContextMenu.Item must be rendered inside <ContextMenu.Content>.',
      'ContextMenu.CheckboxItem must be rendered inside <ContextMenu.Content>.',
    ]);
  },
};

export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Checks CSS rules without emulating reduced motion. Enable reduced motion in the browser to check rendering.',
      },
    },
  },
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    const menu = await findMenu(canvasElement);
    const item = within(menu).getByRole('menuitem', { name: 'Copy link' });
    await expect(getComputedStyle(menu).animationName).not.toBe('none');
    await expect(getComputedStyle(menu).animationDuration).toBe('0.16s');
    await expect(mediaRuleSets(menu, 'prefers-reduced-motion: reduce', 'animation-name', 'none')).toBe(true);
    await expect(getComputedStyle(item).transitionDuration).toBe('0.12s');
    await expect(mediaRuleSets(item, 'prefers-reduced-motion: reduce', 'transition-duration', '0s')).toBe(true);
    // The animation settles at full opacity and scale.
    await wait(SETTLE_MS);
    await expect(getComputedStyle(menu).opacity).toBe('1');
  },
};

export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Checks CSS rules without emulating forced colors. Enable forced colors in the browser to check rendering.',
      },
    },
  },
  render: (args) => <ViewOptions {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ContextMenu}');
    const menu = await findMenu(canvasElement, 'Board view options');
    await expectItemFocused(canvasElement, 'Show avatars', 'menuitemcheckbox');
    const item = canvasElement.ownerDocument.activeElement!;
    await expect(mediaRuleSets(menu, 'forced-colors: active', 'border-color', 'buttontext')).toBe(true);
    await expect(mediaRuleSets(item, 'forced-colors: active', 'outline-color', 'highlight')).toBe(true);
    const check = item.querySelector('[data-ui="context-menu-check"]')!;
    await expect(mediaRuleSets(check, 'forced-colors: active', 'border-color', 'buttontext')).toBe(true);
    // Real borders and outlines, not fills, carry the boundaries and the focus.
    await expect(getComputedStyle(menu).borderTopStyle).toBe('solid');
    await expect(getComputedStyle(check).borderTopStyle).toBe('solid');
    await expectFocusRing(item);
  },
};

// Last in the file: the runner restores the default viewport before the next story, and that
// resize would reach a menu the next story opens on mount.
export const TinyViewport: Story = {
  parameters: {
    viewport: {
      options: {
        tiny: {
          name: 'Tiny',
          styles: { width: `${TINY_VIEWPORT.width}px`, height: `${TINY_VIEWPORT.height}px` },
          type: 'mobile',
        },
      },
    },
  },
  globals: { viewport: { value: 'tiny', isRotated: false } },
  render: ({ onOpenChild: _onOpenChild, onCopy, onRename: _onRename, onDelete: _onDelete, ...args }) => (
    <ContextMenu {...args}>
      <ContextMenu.Target aria-label={TARGET} style={smallTargetStyle}>
        report.pdf
      </ContextMenu.Target>
      <ContextMenu.Content>
        <ContextMenu.Item onSelect={onCopy}>
          Copiar el enlace público de este informe trimestral al portapapeles
        </ContextMenu.Item>
        {Array.from({ length: 8 }, (_, index) => (
          <ContextMenu.Item key={index}>{`Move to folder ${index + 1}`}</ContextMenu.Item>
        ))}
      </ContextMenu.Content>
    </ContextMenu>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const view = canvasElement.ownerDocument.defaultView!;
    // The story really renders in a viewport smaller than the menu's preferred size.
    await expect(view.innerWidth).toBe(TINY_VIEWPORT.width);
    await expect(view.innerHeight).toBe(TINY_VIEWPORT.height);
    const rootFontSize = parseFloat(getComputedStyle(canvasElement.ownerDocument.documentElement).fontSize);
    await expect(13 * rootFontSize).toBeGreaterThan(view.innerWidth - 2 * VIEWPORT_PADDING);
    // The runner resizes the page right before the story, and the window's resize event only fires
    // on the next frame; an open menu would treat it as a viewport change and close.
    await new Promise((resolve) => view.requestAnimationFrame(resolve));

    const target = getTarget(canvasElement);
    const box = target.getBoundingClientRect();
    await contextClick(userEvent, target, box.left + box.width / 2, box.top + box.height / 2);
    const menu = await findMenu(canvasElement);
    // Clamped inside the visible area, with the collision padding kept on every edge.
    await expectInsideViewport(menu, view);
    // The rest of the items scroll inside the menu.
    await expect(menu.scrollHeight).toBeGreaterThan(menu.clientHeight);
    // The long label wraps inside its item.
    const long = within(menu).getByRole('menuitem', { name: /Copiar el enlace/ });
    const label = long.lastElementChild!.getBoundingClientRect();
    await expect(label.right).toBeLessThanOrEqual(long.getBoundingClientRect().right + TOLERANCE_PX);

    // The last item is reachable and scrolled into the visible part of the menu.
    await userEvent.keyboard('{End}');
    await expectItemFocused(canvasElement, 'Move to folder 8');
    await waitFor(() => {
      const item = canvasElement.ownerDocument.activeElement!.getBoundingClientRect();
      const visible = menu.getBoundingClientRect();
      expect(item.top).toBeGreaterThanOrEqual(visible.top - TOLERANCE_PX);
      expect(item.bottom).toBeLessThanOrEqual(visible.bottom + TOLERANCE_PX);
    });
    await userEvent.keyboard('{Home}{Enter}');
    await expect(args.onCopy).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement);
    await expectActive(canvasElement, target);
    await expect(callValues(args.onOpenChange)).toEqual([true, false]);
  },
};
