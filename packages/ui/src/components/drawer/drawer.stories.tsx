import { useState, type CSSProperties, type ReactNode } from 'react';
import type { Meta, StoryContext, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { Checkbox } from '../checkbox';
import { Dialog } from '../dialog';
import { Popover } from '../popover';
import { TextField } from '../text-field';
import { ThemeRoot } from '../theme-root';
import { Drawer, type DrawerContentProps, type DrawerProps, type DrawerSize } from './index';

const TITLE = 'Filters';
const DESCRIPTION = 'Narrow the issue list by owner and status.';
const TRIGGER = 'Open filters';
const STATUSES = ['Backlog', 'In progress', 'In review', 'Done'];
const INLINE_CAP_REM: Record<DrawerSize, number> = { sm: 22, md: 30, lg: 38 };
const COMPACT_QUERY = '(max-width: 40rem)';
const GUTTER_PX = Number.parseFloat(base.space[3]);
const FIXTURE_BUTTON = { minHeight: '24px', minWidth: '24px', padding: '4px 10px', boxSizing: 'border-box' } as const;

const fieldStackStyle = {
  display: 'grid',
  gap: vars.space[4],
} satisfies CSSProperties;

const meta = {
  title: 'Surfaces/Drawer',
  component: Drawer,
  tags: ['autodocs'],
  args: { onOpenChange: fn() },
  parameters: {
    docs: {
      description: {
        component:
          'Modal edge surface for filters, settings, long forms and record details. Built on the native modal dialog: the page behind is inert, Tab/Shift+Tab stay inside, Escape, Close and backdrop clicks request close through one cancelable path, and focus returns to the invoker. `side` attaches the panel to `inline-start`, `inline-end` (default), `top` or `bottom`; inline sides follow text direction. `size` caps inline panels; top/bottom panels span the viewport and cap their height. The Body scrolls while Header and Footer stay visible. Optional `draggable` lets the header pull the panel toward its edge to dismiss; reduced motion turns it off, and Close/Escape always remain. Modal only; closing is immediate (no exit animation). Floating overlays inside the drawer need a `ThemeRoot portalContainer` host inside it; an open nested overlay takes the Escape first. Close needs visible text or a localized `aria-label`.',
      },
      source: {
        code: `<Drawer>
  <Drawer.Trigger>Filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body>
        <FilterForm />
      </Drawer.Body>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>`,
      },
    },
  },
} satisfies Meta<typeof Drawer>;

export default meta;

type Story = Omit<StoryObj<DrawerProps>, 'render' | 'play'> & {
  render?: (args: DrawerProps) => ReactNode;
  play?: (context: StoryContext<DrawerProps>) => Promise<void>;
};

interface ExampleProps extends DrawerProps {
  contentProps?: DrawerContentProps;
  body?: ReactNode;
}

function FilterFields() {
  return (
    <div style={fieldStackStyle}>
      <TextField label="Owner" />
      {STATUSES.map((status) => (
        <Checkbox key={status} label={status} />
      ))}
    </div>
  );
}
FilterFields.displayName = 'FilterFields';

function DrawerExample({ contentProps, body = <FilterFields />, ...props }: ExampleProps) {
  return (
    <Drawer {...props}>
      <Drawer.Trigger>{TRIGGER}</Drawer.Trigger>
      <Drawer.Content {...contentProps}>
        <Drawer.Panel>
          <Drawer.Header>
            <Drawer.Title>{TITLE}</Drawer.Title>
            <Drawer.Description>{DESCRIPTION}</Drawer.Description>
            <Drawer.Close>Close</Drawer.Close>
          </Drawer.Header>
          <Drawer.Body>{body}</Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close>Done</Drawer.Close>
          </Drawer.Footer>
        </Drawer.Panel>
      </Drawer.Content>
    </Drawer>
  );
}
DrawerExample.displayName = 'DrawerExample';

function ControlledDrawer(props: ExampleProps) {
  const [open, setOpen] = useState(false);
  return (
    <DrawerExample
      {...props}
      open={open}
      onOpenChange={(next) => {
        props.onOpenChange?.(next);
        setOpen(next);
      }}
    />
  );
}
ControlledDrawer.displayName = 'ControlledDrawer';

function parts(canvasElement: HTMLElement) {
  const dialog = canvasElement.querySelector<HTMLDialogElement>('[data-ui="drawer"]')!;
  return {
    dialog,
    panel: dialog.querySelector<HTMLElement>('[data-ui="drawer-panel"]')!,
    header: dialog.querySelector<HTMLElement>('[data-ui="drawer-header"]')!,
    body: dialog.querySelector<HTMLElement>('[data-ui="drawer-body"]')!,
    footer: dialog.querySelector<HTMLElement>('[data-ui="drawer-footer"]')!,
  };
}

async function settle(element: HTMLElement) {
  await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished));
}

async function openDrawer({ canvasElement, userEvent }: Pick<StoryContext<DrawerProps>, 'canvasElement' | 'userEvent'>) {
  const canvas = within(canvasElement);
  const trigger = canvas.getByRole('button', { name: TRIGGER });
  await userEvent.click(trigger);
  const dialog = await canvas.findByRole('dialog');
  await settle(dialog);
  return { ...parts(canvasElement), canvas, trigger, dialog };
}

/** Synthetic key events never trigger the browser's native cancel; dispatch the cancel a real Escape produces. */
function requestEscape(dialog: HTMLElement) {
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
}

async function expectClosed(canvasElement: HTMLElement, trigger: HTMLElement) {
  await waitFor(() => expect(within(canvasElement).queryByRole('dialog')).toBeNull());
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toHaveFocus();
  await expect(canvasElement.ownerDocument.documentElement.style.overflow).toBe('');
}

async function expectFocusRing(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  const style = getComputedStyle(element);
  await expect(style.outlineStyle).not.toBe('none');
  // Fractional device pixel ratios compute the authored 2px as e.g. 1.48837px.
  await expect(Math.abs(Number.parseFloat(style.outlineWidth) - 2)).toBeLessThan(1.1);
}

function rect(element: Element) {
  return element.getBoundingClientRect();
}

/** The authored rule inside `condition` that targets one of `element`'s classes. */
function findConditionalRule(element: HTMLElement, condition: string, suffix = '') {
  for (const sheet of Array.from(element.ownerDocument.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      if (!(rule instanceof CSSMediaRule) || !rule.conditionText.includes(condition)) continue;
      for (const inner of Array.from(rule.cssRules)) {
        if (!(inner instanceof CSSStyleRule)) continue;
        const matches = Array.from(element.classList).some((name) =>
          inner.selectorText.split(',').some((selector) => selector.trim() === `.${name}${suffix}`),
        );
        if (matches) return inner;
      }
    }
  }
  return undefined;
}

function findRule(element: HTMLElement, suffix: string) {
  for (const sheet of Array.from(element.ownerDocument.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      if (!(rule instanceof CSSStyleRule)) continue;
      const matches = Array.from(element.classList).some((name) => rule.selectorText === `.${name}${suffix}`);
      if (matches) return rule;
    }
  }
  return undefined;
}

async function expectInlineSize(panel: HTMLElement, dialog: HTMLElement, size: DrawerSize) {
  const view = panel.ownerDocument.defaultView!;
  const remPx = Number.parseFloat(getComputedStyle(panel.ownerDocument.documentElement).fontSize);
  const available = dialog.clientWidth - GUTTER_PX;
  const expected = view.matchMedia(COMPACT_QUERY).matches
    ? available
    : Math.min(INLINE_CAP_REM[size] * remPx, available);
  await expect(Math.abs(rect(panel).width - expected)).toBeLessThan(1);
  await expect(rect(panel).height).toBeCloseTo(rect(dialog).height, 0);
}

export const Default: Story = {
  render: (args) => <DrawerExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('dialog')).toBeNull();
    await expect(parts(canvasElement).dialog).not.toHaveAttribute('open');

    const { trigger, dialog, panel } = await openDrawer({ canvasElement, userEvent });
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAttribute('data-side', 'inline-end');
    await expect(dialog).toHaveAccessibleName(TITLE);
    await expect(dialog).toHaveAccessibleDescription(DESCRIPTION);
    await expect(dialog.contains(canvasElement.ownerDocument.activeElement)).toBe(true);
    await expect(canvasElement.contains(dialog)).toBe(true);
    await waitFor(() => expect(canvasElement.ownerDocument.documentElement.style.overflow).toBe('hidden'));
    // Inline-end in LTR: flush with the right viewport edge.
    await expect(rect(panel).right).toBeCloseTo(rect(dialog).right, 0);
    await expectInlineSize(panel, dialog, 'md');

    requestEscape(dialog);
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(1, true);
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(2, false);
  },
};

export const InlineStart: Story = {
  args: { side: 'inline-start' },
  render: (args) => <DrawerExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const { trigger, dialog, panel, canvas } = await openDrawer({ canvasElement, userEvent });
    await expect(rect(panel).left).toBeCloseTo(rect(dialog).left, 0);
    const style = getComputedStyle(panel);
    // The border and rounded corners face the page, never the viewport edge.
    await expect(Number.parseFloat(style.borderRightWidth)).toBeGreaterThan(0);
    await expect(style.borderLeftWidth).toBe('0px');
    await expect(style.borderTopRightRadius).toBe(base.radius.lg);
    await expect(style.borderTopLeftRadius).toBe('0px');
    await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
    await expectClosed(canvasElement, trigger);
  },
};

export const InlineEnd: Story = {
  args: { side: 'inline-end' },
  render: (args) => <DrawerExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const { trigger, dialog, panel, canvas } = await openDrawer({ canvasElement, userEvent });
    await expect(rect(panel).right).toBeCloseTo(rect(dialog).right, 0);
    const style = getComputedStyle(panel);
    await expect(Number.parseFloat(style.borderLeftWidth)).toBeGreaterThan(0);
    await expect(style.borderRightWidth).toBe('0px');
    await expect(style.borderTopLeftRadius).toBe(base.radius.lg);
    await expect(style.borderTopRightRadius).toBe('0px');
    await userEvent.click(canvas.getByRole('button', { name: 'Done' }));
    await expectClosed(canvasElement, trigger);
  },
};

export const Top: Story = {
  args: { side: 'top' },
  render: (args) => <DrawerExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const { dialog, panel } = await openDrawer({ canvasElement, userEvent });
    await expect(rect(panel).top).toBeCloseTo(rect(dialog).top, 0);
    await expect(rect(panel).width).toBeCloseTo(rect(dialog).width, 0);
    await expect(rect(panel).height).toBeLessThan(rect(dialog).height);
    await expect(Number.parseFloat(getComputedStyle(panel).borderBottomWidth)).toBeGreaterThan(0);
  },
};

export const Bottom: Story = {
  args: { side: 'bottom' },
  render: (args) => <DrawerExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const { dialog, panel } = await openDrawer({ canvasElement, userEvent });
    await expect(rect(panel).bottom).toBeCloseTo(rect(dialog).bottom, 0);
    await expect(rect(panel).width).toBeCloseTo(rect(dialog).width, 0);
    await expect(Number.parseFloat(getComputedStyle(panel).borderTopWidth)).toBeGreaterThan(0);
  },
};

const sizeStory = (size: DrawerSize): Story => ({
  args: { size },
  render: (args) => <DrawerExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const { dialog, panel } = await openDrawer({ canvasElement, userEvent });
    // Caps apply above the compact breakpoint; at or below it every size goes near full width.
    await expectInlineSize(panel, dialog, size);
  },
});

export const Small: Story = sizeStory('sm');
export const Medium: Story = sizeStory('md');
export const Large: Story = sizeStory('lg');

/** Drag along the header: one pointer, explicit coordinates, `pause` ms between moves. */
async function drag(header: HTMLElement, points: number[], axis: 'x' | 'y', pause = 0, end: 'up' | 'cancel' = 'up') {
  const box = rect(header);
  const at = (value: number) =>
    axis === 'x'
      ? { clientX: value, clientY: box.top + 4 }
      : { clientX: box.left + 4, clientY: value };
  const init = { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0 } as const;
  const [first, ...rest] = points;
  fireEvent.pointerDown(header, { ...init, ...at(first!) });
  for (const value of rest) {
    if (pause) await new Promise((resolve) => setTimeout(resolve, pause));
    fireEvent.pointerMove(header, { ...init, ...at(value) });
  }
  const last = points.at(-1)!;
  if (end === 'up') fireEvent.pointerUp(header, { ...init, ...at(last) });
  else fireEvent.pointerCancel(header, { ...init, ...at(last) });
}

async function expectHome(panel: HTMLElement) {
  await waitFor(() => expect(panel.style.translate).toBe(''), { timeout: 2000 });
}

export const Draggable: Story = {
  args: { draggable: true },
  render: (args) => <DrawerExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const { dialog, panel, header, canvas, trigger } = await openDrawer({ canvasElement, userEvent });
    await expect(header).toHaveAttribute('data-draggable');
    const start = rect(header).left + 8;
    const width = rect(panel).width;

    // Slow drag below a third of the panel, paused before release: springs home, stays open.
    await drag(header, [start, start + width * 0.1, start + width * 0.2], 'x', 150);
    await expect(dialog).toHaveAttribute('open');
    await expectHome(panel);

    // Opposing travel is resisted to a fifth of the pointer travel.
    fireEvent.pointerDown(header, { pointerId: 1, isPrimary: true, clientX: start, clientY: rect(header).top + 4 });
    fireEvent.pointerMove(header, { pointerId: 1, isPrimary: true, clientX: start - 100, clientY: rect(header).top + 4 });
    await expect(panel.style.translate).toBe('-20px');
    fireEvent.pointerCancel(header, { pointerId: 1, isPrimary: true, clientX: start - 100 });
    await expect(dialog).toHaveAttribute('open');
    await expectHome(panel);

    // Pointer cancel past the threshold resets without dismissing.
    await drag(header, [start, start + width * 0.6], 'x', 150, 'cancel');
    await expect(dialog).toHaveAttribute('open');
    await expectHome(panel);

    // Controls inside the header never start a drag.
    const close = canvas.getByRole('button', { name: 'Close' });
    fireEvent.pointerDown(close, { pointerId: 1, isPrimary: true, button: 0, clientX: rect(close).left + 2 });
    fireEvent.pointerMove(header, { pointerId: 1, isPrimary: true, clientX: rect(close).left + 300 });
    await expect(panel.style.translate).toBe('');
    fireEvent.pointerUp(header, { pointerId: 1, isPrimary: true, clientX: rect(close).left + 300 });
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);

    // Slow drag past a third of the panel dismisses once.
    await drag(header, [start, start + width * 0.2, start + width * 0.5], 'x', 150);
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(panel.style.translate).toBe('');

    // A short fast flick toward the edge dismisses too.
    await userEvent.click(trigger);
    await settle(dialog);
    const flickStart = rect(header).left + 8;
    await drag(header, [flickStart, flickStart + 20, flickStart + 40], 'x');
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(4);
  },
};

export const DraggableRejected: Story = {
  args: { draggable: true, open: true },
  render: (args) => <DrawerExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const { dialog, panel, header } = parts(canvasElement);
    await settle(dialog);
    const start = rect(header).left + 8;
    await drag(header, [start, start + rect(panel).width * 0.2, start + rect(panel).width * 0.6], 'x', 150);
    // The controlled parent rejects the request: one callback, still open, panel springs home.
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(dialog).toHaveAttribute('open');
    await expectHome(panel);
  },
};

export const DraggableBottom: Story = {
  args: { draggable: true, side: 'bottom' },
  render: (args) => <DrawerExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const { panel, header, trigger } = await openDrawer({ canvasElement, userEvent });
    const start = rect(header).top + 4;
    // Upward travel (away from the bottom edge) is resisted.
    fireEvent.pointerDown(header, { pointerId: 1, isPrimary: true, clientX: rect(header).left + 4, clientY: start });
    fireEvent.pointerMove(header, { pointerId: 1, isPrimary: true, clientX: rect(header).left + 4, clientY: start - 50 });
    await expect(panel.style.translate).toBe('0px -10px');
    fireEvent.pointerCancel(header, { pointerId: 1, isPrimary: true });
    await expectHome(panel);
    await drag(header, [start, start + rect(panel).height * 0.2, start + rect(panel).height * 0.5], 'y', 150);
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};

function LongFormBody() {
  return (
    <div style={fieldStackStyle}>
      {Array.from({ length: 14 }, (_, index) => (
        <TextField key={index} label={`Field ${index + 1}`} />
      ))}
    </div>
  );
}
LongFormBody.displayName = 'LongFormBody';

export const LongForm: Story = {
  render: (args) => <DrawerExample {...args} body={<LongFormBody />} />,
  play: async ({ canvasElement, userEvent }) => {
    const { dialog, panel, body, header, footer, canvas } = await openDrawer({ canvasElement, userEvent });
    // The Body scrolls; the panel never grows past the viewport and Header/Footer stay in view.
    await expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
    await expect(rect(panel).bottom).toBeLessThanOrEqual(rect(dialog).bottom + 1);
    await expect(rect(header).top).toBeGreaterThanOrEqual(rect(dialog).top - 1);
    await expect(rect(footer).bottom).toBeLessThanOrEqual(rect(dialog).bottom + 1);

    const last = canvas.getByRole('textbox', { name: 'Field 14' });
    last.focus();
    await waitFor(() => expect(rect(last).bottom).toBeLessThanOrEqual(rect(body).bottom + 1));
    await expect(rect(last).top).toBeGreaterThanOrEqual(rect(body).top - 1);
    await expect(body.scrollTop).toBeGreaterThan(0);

    // The last part pads for the bottom safe area (env() resolves to 0 here; the authored rule carries it).
    await expect(findRule(footer, ':last-child')?.style.paddingBlockEnd).toContain('safe-area-inset-bottom');
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  render: (args) => <DrawerExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const { dialog, panel, canvas, trigger } = await openDrawer({ canvasElement, userEvent });
    await expect(canvasElement.contains(dialog)).toBe(true);
    await expectThemedSurface(panel, 'light');
    await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
    await expectClosed(canvasElement, trigger);
  },
};

async function expectPersistentOpen(canvasElement: HTMLElement) {
  const dialog = await within(canvasElement).findByRole('dialog');
  await settle(dialog);
  await expect(dialog).toHaveAttribute('open');
  await expect(dialog).toHaveAccessibleName(TITLE);
  return dialog;
}

export const PersistentOpen: Story = {
  args: { defaultOpen: true },
  render: (args) => <DrawerExample {...args} />,
  play: async ({ args, canvasElement }) => {
    await expectPersistentOpen(canvasElement);
    // Initialization is not an interaction.
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};

export const PersistentOpenLight: Story = {
  args: { defaultOpen: true },
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  render: (args) => <DrawerExample {...args} />,
  play: async ({ canvasElement }) => {
    const dialog = await expectPersistentOpen(canvasElement);
    await expectThemedSurface(parts(canvasElement).panel, 'light');
    await expect(canvasElement.contains(dialog)).toBe(true);
  },
};

export const OpenNoDescription: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <>
      <p id="drawer-external-help">Changes apply when you close the panel.</p>
      <DrawerExample
        {...args}
        contentProps={{ withDescription: false, 'aria-describedby': 'drawer-external-help' }}
      />
    </>
  ),
  play: async ({ canvasElement }) => {
    const dialog = await expectPersistentOpen(canvasElement);
    // The opt-out drops only the internal Description; the consumer relationship stays.
    await expect(dialog).toHaveAttribute('aria-describedby', 'drawer-external-help');
    await expect(dialog).toHaveAccessibleDescription('Changes apply when you close the panel.');
  },
};

export const Controlled: Story = {
  render: (args) => <ControlledDrawer {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const { canvas, trigger, dialog } = await openDrawer({ canvasElement, userEvent });
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);

    requestEscape(dialog);
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);

    await userEvent.click(trigger);
    await userEvent.click(await canvas.findByRole('button', { name: 'Done' }));
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(4);
  },
};

export const ControlledReject: Story = {
  args: { open: true },
  render: (args) => <DrawerExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const { dialog, panel } = parts(canvasElement);
    await settle(dialog);
    const canvas = within(canvasElement);
    // Every request reaches the parent once; the parent never honors it, so the drawer stays open.
    requestEscape(dialog);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(dialog).toHaveAttribute('open');
    await expect(dialog.contains(canvasElement.ownerDocument.activeElement)).toBe(true);

    await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    fireEvent.click(dialog);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(3);
    await expect(dialog).toHaveAttribute('open');
    await expect(rect(panel).width).toBeGreaterThan(0);
  },
};

export const CancelVeto: Story = {
  render: (args) => <DrawerExample {...args} contentProps={{ onCancel: (event) => event.preventDefault() }} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const { dialog, canvas } = await openDrawer({ canvasElement, userEvent });
    // Escape, Close and backdrop share the cancelable request: one veto covers all three.
    requestEscape(dialog);
    await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
    fireEvent.click(dialog);
    await expect(dialog).toHaveAttribute('open');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
  },
};

export const BackdropClick: Story = {
  render: (args) => <DrawerExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const { dialog, panel, body, trigger } = await openDrawer({ canvasElement, userEvent });
    fireEvent.click(panel);
    fireEvent.click(body);
    await expect(dialog).toHaveAttribute('open');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);

    // The transparent shell outside the panel is the backdrop.
    await userEvent.pointer({ keys: '[MouseLeft]', target: dialog, coords: { clientX: 4, clientY: 4 } });
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

export const NativeFormClose: Story = {
  args: { open: true },
  render: (args) => (
    <DrawerExample
      {...args}
      body={
        <form method="dialog">
          <button type="submit" style={FIXTURE_BUTTON}>
            Apply
          </button>
        </form>
      }
    />
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const { documentElement } = canvasElement.ownerDocument;
    const { dialog } = parts(canvasElement);
    await waitFor(() => expect(documentElement.style.overflow).toBe('hidden'));
    // A native form close cannot be vetoed: the rejected request still releases the scroll lock.
    await userEvent.click(canvas.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    await waitFor(() => expect(args.onOpenChange).toHaveBeenCalledTimes(1));
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(documentElement.style.overflow).toBe(''));

    // The next open interaction repairs the native modal without a duplicate `true`.
    await userEvent.click(canvas.getByRole('button', { name: TRIGGER }));
    await waitFor(() => expect(dialog).toHaveAttribute('open'));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(documentElement.style.overflow).toBe('hidden'));
  },
};

const refClose = fn<(element: HTMLDialogElement | null) => void>();

export const RefClose: Story = {
  render: (args) => <DrawerExample {...args} contentProps={{ ref: refClose }} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const { dialog, trigger } = await openDrawer({ canvasElement, userEvent });
    const attached = refClose.mock.calls.findLast(([element]) => element !== null)?.[0];
    await expect(attached).toBe(dialog);
    await expect(attached).toBeInstanceOf(HTMLDialogElement);

    attached!.close();
    await expectClosed(canvasElement, trigger);
    await waitFor(() => expect(args.onOpenChange).toHaveBeenCalledTimes(2));
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

function UnmountFixture({ removeTrigger = false, ...props }: DrawerProps & { removeTrigger?: boolean }) {
  const [mounted, setMounted] = useState(true);
  return (
    <Drawer {...props}>
      {(!removeTrigger || mounted) && <Drawer.Trigger>{TRIGGER}</Drawer.Trigger>}
      {mounted && (
        <Drawer.Content>
          <Drawer.Panel>
            <Drawer.Header>
              <Drawer.Title>{TITLE}</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>
              <button type="button" style={FIXTURE_BUTTON} onClick={() => setMounted(false)}>
                Remove panel
              </button>
            </Drawer.Body>
          </Drawer.Panel>
        </Drawer.Content>
      )}
    </Drawer>
  );
}
UnmountFixture.displayName = 'UnmountFixture';

export const UnmountOpen: Story = {
  render: (args) => <UnmountFixture {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const { documentElement } = canvasElement.ownerDocument;
    const { trigger } = await openDrawer({ canvasElement, userEvent });
    await waitFor(() => expect(documentElement.style.overflow).toBe('hidden'));
    // Removal is not a close: focus still returns to the invoker and the lock is released.
    await userEvent.click(canvas.getByRole('button', { name: 'Remove panel' }));
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull());
    await expect(trigger).toHaveFocus();
    await expect(documentElement.style.overflow).toBe('');
  },
};

export const UnmountDisconnectedInvoker: Story = {
  render: (args) => <UnmountFixture {...args} removeTrigger />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const { documentElement } = canvasElement.ownerDocument;
    const { trigger } = await openDrawer({ canvasElement, userEvent });
    await userEvent.click(canvas.getByRole('button', { name: 'Remove panel' }));
    await waitFor(() => expect(trigger.isConnected).toBe(false));
    await expect(canvasElement.ownerDocument.activeElement).not.toBe(trigger);
    await expect(documentElement.style.overflow).toBe('');
  },
};

const failingRef = (dialog: HTMLDialogElement | null) => {
  if (!dialog) return;
  dialog.showModal = () => {
    throw new DOMException('showModal failed', 'InvalidStateError');
  };
};

export const FailedShowModal: Story = {
  render: (args) => <DrawerExample {...args} contentProps={{ ref: failingRef }} />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const { documentElement } = canvasElement.ownerDocument;
    await userEvent.click(canvas.getByRole('button', { name: TRIGGER }));
    // No phantom modal and no scroll lock when the platform refuses to open.
    await expect(parts(canvasElement).dialog).not.toHaveAttribute('open');
    await expect(canvas.queryByRole('dialog')).toBeNull();
    await expect(documentElement.style.overflow).toBe('');
  },
};

export const KeyboardNavigation: Story = {
  render: (args) => (
    <>
      <button type="button" style={FIXTURE_BUTTON}>
        Before
      </button>
      <DrawerExample {...args} />
    </>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;
    const trigger = canvas.getByRole('button', { name: TRIGGER });
    await userEvent.click(canvas.getByRole('button', { name: 'Before' }));
    await userEvent.tab();
    await expectFocusRing(trigger);

    await userEvent.keyboard('{Enter}');
    const dialog = await canvas.findByRole('dialog');
    await settle(dialog);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(dialog.contains(doc.activeElement)).toBe(true);

    // Focus stays inside the modal in both directions.
    const close = within(dialog).getByRole('button', { name: 'Close' });
    const done = within(dialog).getByRole('button', { name: 'Done' });
    close.focus();
    await userEvent.tab();
    await expect(doc.activeElement).toBe(within(dialog).getByRole('textbox', { name: 'Owner' }));
    done.focus();
    await userEvent.tab({ shift: true });
    await expect(dialog.contains(doc.activeElement)).toBe(true);
    // The synthetic tab() does not model the top layer; the platform's modal state does: the page
    // behind is inert and cannot take focus. Real Tab wrapping is covered by browser QA.
    await expect(dialog.matches(':modal')).toBe(true);
    canvas.getByRole('button', { name: 'Before', hidden: true }).focus();
    await expect(dialog.contains(doc.activeElement)).toBe(true);
    await userEvent.tab();
    await expectFocusRing(done);

    await userEvent.keyboard(' ');
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);

    // Space opens exactly once too; Enter on Close requests close once.
    await userEvent.keyboard(' ');
    await canvas.findByRole('dialog');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(3);
    within(dialog).getByRole('button', { name: 'Close' }).focus();
    await userEvent.keyboard('{Enter}');
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(4);
    for (const [index, open] of [true, false, true, false].entries()) {
      await expect(args.onOpenChange).toHaveBeenNthCalledWith(index + 1, open);
    }
  },
};

export const TriggerDefaultPrevented: Story = {
  render: (args) => (
    <Drawer {...args}>
      <Drawer.Trigger onClick={(event) => event.preventDefault()}>{TRIGGER}</Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Panel>
          <Drawer.Header>
            <Drawer.Title>{TITLE}</Drawer.Title>
          </Drawer.Header>
        </Drawer.Panel>
      </Drawer.Content>
    </Drawer>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: TRIGGER }));
    await expect(parts(canvasElement).dialog).not.toHaveAttribute('open');
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};

export const ExternalARIA: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <>
      <span id="drawer-external-label">Issue</span>
      <span id="drawer-external-description">Saved views keep these filters.</span>
      <DrawerExample
        {...args}
        contentProps={{
          'aria-labelledby': 'drawer-external-label drawer-unresolved',
          'aria-describedby': 'drawer-external-description drawer-unresolved',
        }}
      />
    </>
  ),
  play: async ({ canvasElement }) => {
    const { dialog } = parts(canvasElement);
    await settle(dialog);
    const title = within(dialog).getByRole('heading', { name: TITLE });
    const description = within(dialog).getByText(DESCRIPTION);
    // Consumer IDREFs stay, unresolved ones included; the internal ids are appended.
    await expect(dialog).toHaveAttribute('aria-labelledby', `drawer-external-label drawer-unresolved ${title.id}`);
    await expect(dialog).toHaveAttribute(
      'aria-describedby',
      `drawer-external-description drawer-unresolved ${description.id}`,
    );
    await expect(dialog).toHaveAccessibleName(`Issue ${TITLE}`);
    await expect(dialog).toHaveAccessibleDescription(`Saved views keep these filters. ${DESCRIPTION}`);
  },
};

const FALSY_CONTENT = [0, false, null, ''] as const;

export const FalsyTitle: Story = {
  render: (args) => (
    <>
      {FALSY_CONTENT.map((value) => (
        <Drawer key={String(value)} {...args}>
          <Drawer.Trigger>{`Open ${JSON.stringify(value)}`}</Drawer.Trigger>
          <Drawer.Content aria-label={`Drawer ${JSON.stringify(value)}`} data-value={JSON.stringify(value)}>
            <Drawer.Panel>
              <Drawer.Header>
                <Drawer.Title>{value}</Drawer.Title>
                <Drawer.Description>{value}</Drawer.Description>
              </Drawer.Header>
            </Drawer.Panel>
          </Drawer.Content>
        </Drawer>
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const dialogs = Array.from(canvasElement.querySelectorAll<HTMLDialogElement>('[data-ui="drawer"]'));
    await expect(dialogs).toHaveLength(FALSY_CONTENT.length);
    const [zero, ...empty] = dialogs;
    // 0 is content: both parts render and wire up.
    const title = zero!.querySelector('[data-ui="drawer-title"]')!;
    const description = zero!.querySelector('[data-ui="drawer-description"]')!;
    await expect(title).toHaveTextContent('0');
    await expect(description).toHaveTextContent('0');
    await waitFor(() => expect(zero).toHaveAttribute('aria-labelledby', title.id));
    await expect(zero).toHaveAttribute('aria-describedby', description.id);
    // false, null and '' render no parts and leave no relationship behind.
    for (const dialog of empty) {
      await expect(dialog.querySelector('[data-ui="drawer-title"], [data-ui="drawer-description"]')).toBeNull();
      await expect(dialog).not.toHaveAttribute('aria-labelledby');
      await expect(dialog).not.toHaveAttribute('aria-describedby');
    }
  },
};

function NestedPopoverBody() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <ThemeRoot portalContainer={host}>
      <Popover>
        <Popover.Trigger>Owner options</Popover.Trigger>
        <Popover.Content aria-label="Owner options">
          <button type="button" style={FIXTURE_BUTTON}>
            Assign to me
          </button>
        </Popover.Content>
      </Popover>
      <div ref={setHost} />
    </ThemeRoot>
  );
}
NestedPopoverBody.displayName = 'NestedPopoverBody';

export const NestedPopover: Story = {
  render: (args) => <DrawerExample {...args} body={<NestedPopoverBody />} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const { dialog, canvas, trigger } = await openDrawer({ canvasElement, userEvent });
    await userEvent.click(canvas.getByRole('button', { name: 'Owner options' }));
    const popover = await within(dialog).findByRole('dialog', { name: 'Owner options' });
    // Rendered inside the drawer's top-layer subtree, so it is neither inert nor hidden.
    await expect(dialog.contains(popover)).toBe(true);

    // Escape held down: the popover closes; the native cancel for that keystroke leaves the drawer open.
    await userEvent.keyboard('{Escape>}');
    await waitFor(() => expect(within(dialog).queryByRole('dialog', { name: 'Owner options' })).toBeNull());
    requestEscape(dialog);
    await userEvent.keyboard('{/Escape}');
    await expect(dialog).toHaveAttribute('open');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);

    // The next Escape belongs to the drawer.
    await userEvent.keyboard('{Escape>}');
    requestEscape(dialog);
    await userEvent.keyboard('{/Escape}');
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};

function NestedDialogBody() {
  return (
    <Dialog>
      <Dialog.Trigger>Confirm reset</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>Reset filters</Dialog.Title>
        <Dialog.Close>Cancel</Dialog.Close>
      </Dialog.Content>
    </Dialog>
  );
}
NestedDialogBody.displayName = 'NestedDialogBody';

export const NestedDialog: Story = {
  render: (args) => <DrawerExample {...args} body={<NestedDialogBody />} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const { dialog, canvas } = await openDrawer({ canvasElement, userEvent });
    await userEvent.click(canvas.getByRole('button', { name: 'Confirm reset' }));
    const nested = await within(dialog).findByRole('dialog', { name: 'Reset filters' });
    // Cancel and close bubble through React from the nested dialog; only its own state changes.
    requestEscape(nested);
    await waitFor(() => expect(nested).not.toHaveAttribute('open'));
    await expect(dialog).toHaveAttribute('open');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('button', { name: 'Confirm reset' })).toHaveFocus();
  },
};

export const RTL: Story = {
  args: { draggable: true },
  render: (args) => (
    <div dir="rtl">
      <DrawerExample {...args} />
    </div>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const { dialog, panel, header, trigger } = await openDrawer({ canvasElement, userEvent });
    // Inline-end follows the effective direction: the left edge in RTL.
    await expect(rect(panel).left).toBeCloseTo(rect(dialog).left, 0);
    await expect(getComputedStyle(panel).getPropertyValue('--drawer-entry-x').trim()).toBe('-100%');
    await expect(Number.parseFloat(getComputedStyle(panel).borderRightWidth)).toBeGreaterThan(0);

    // Dragging rightward moves away from the edge: resisted.
    const start = rect(header).right - 8;
    fireEvent.pointerDown(header, { pointerId: 1, isPrimary: true, clientX: start, clientY: rect(header).top + 4 });
    fireEvent.pointerMove(header, { pointerId: 1, isPrimary: true, clientX: start + 50, clientY: rect(header).top + 4 });
    await expect(panel.style.translate).toBe('10px');
    fireEvent.pointerCancel(header, { pointerId: 1, isPrimary: true });
    await expectHome(panel);

    // Leftward toward the edge dismisses.
    const width = rect(panel).width;
    await drag(header, [start, start - width * 0.2, start - width * 0.5], 'x', 150);
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};

export const ReducedMotion: Story = {
  args: { defaultOpen: true, draggable: true },
  render: (args) => <DrawerExample {...args} />,
  parameters: {
    docs: {
      description: {
        story:
          'Structural fixture for reduced-motion browser QA: with the OS setting on, the panel appears without the slide and the header drag is off. The play runner does not emulate media preferences; it checks the authored rules.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const { dialog, panel, header } = parts(canvasElement);
    await settle(dialog);
    await expect(findConditionalRule(panel, 'prefers-reduced-motion: reduce')?.style.animationName).toBe('none');
    await expect(findConditionalRule(header, 'prefers-reduced-motion: reduce')?.style.cursor).toBe('auto');
  },
};

export const ForcedColors: Story = {
  args: { defaultOpen: true },
  render: (args) => <DrawerExample {...args} />,
  parameters: {
    docs: {
      description: {
        story:
          'Structural fixture for forced-colors browser QA: the panel trades its shadow for a system-color border. The play runner does not emulate forced colors; it checks the authored rules.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const { dialog, panel } = parts(canvasElement);
    await settle(dialog);
    const rule = findConditionalRule(panel, 'forced-colors: active');
    await expect(rule?.style.boxShadow).toBe('none');
    await expect(rule?.style.borderColor.toLowerCase()).toBe('canvastext');
  },
};

export const PartStyling: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <Drawer {...args}>
      <Drawer.Trigger sx={{ minInlineSize: '11rem' }}>{TRIGGER}</Drawer.Trigger>
      <Drawer.Content sx={{ paddingInline: vars.space[2] }}>
        <Drawer.Panel sx={{ borderStartStartRadius: 0 }}>
          <Drawer.Header sx={{ paddingBlock: vars.space[3] }}>
            <Drawer.Title sx={{ fontSize: vars.textSize.xl }}>{TITLE}</Drawer.Title>
            <Drawer.Close sx={{ minInlineSize: vars.space[12] }}>Close</Drawer.Close>
          </Drawer.Header>
          <Drawer.Body sx={{ paddingBlock: vars.space[2] }}>Body</Drawer.Body>
          <Drawer.Footer sx={{ justifyContent: 'flex-start' }}>Footer</Drawer.Footer>
        </Drawer.Panel>
      </Drawer.Content>
    </Drawer>
  ),
  play: async ({ canvasElement }) => {
    const { dialog, panel, header, body, footer } = parts(canvasElement);
    await settle(dialog);
    const close = within(dialog).getByRole('button', { name: 'Close' });
    await expect(getComputedStyle(panel).borderTopLeftRadius).toBe('0px');
    await expect(getComputedStyle(header).paddingTop).toBe(base.space[3]);
    await expect(getComputedStyle(body).paddingTop).toBe(base.space[2]);
    await expect(getComputedStyle(footer).justifyContent).toBe('flex-start');
    await expect(getComputedStyle(dialog).paddingLeft).toBe(base.space[2]);
    const remPx = Number.parseFloat(getComputedStyle(canvasElement.ownerDocument.documentElement).fontSize);
    await expect(Number.parseFloat(getComputedStyle(within(dialog).getByRole('heading')).fontSize)).toBeCloseTo(
      Number.parseFloat(base.textSize.xl) * remPx,
      1,
    );
    await expect(rect(close).width).toBeGreaterThanOrEqual(Number.parseFloat(base.space[12]) - 0.5);
    await expect(rect(close).height).toBeGreaterThanOrEqual(Number.parseFloat(base.space[8]) - 0.5);
    await expect(close).toHaveAttribute('data-ui', 'drawer-close');
    await expect(Drawer.Panel.displayName).toBe('Drawer.Panel');
  },
};
