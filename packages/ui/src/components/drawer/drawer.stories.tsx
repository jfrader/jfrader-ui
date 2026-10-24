// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { useId, useState, type ReactNode } from 'react';
import type { Meta, StoryContext, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor, within } from 'storybook/test';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { findConditionalStyle } from '../../testing/conditional-style';
import { expectContrastSurface, expectThemedSurface } from '../../testing/theme-assertions';
import { Button as FixtureButton } from '../button';
import { Checkbox } from '../checkbox';
import { Dialog } from '../dialog';
import { Popover } from '../popover';
import { Select } from '../select';
import { TextField } from '../text-field';
import { ThemeRoot } from '../theme-root';
import { Surface, type SurfacePartProps } from '../surface';
import { Card } from '../card';
import {
  Drawer,
  type DrawerComposedProps,
  type DrawerContentProps,
  type DrawerShorthandProps,
  type DrawerPanelProps,
  type DrawerProps,
  type DrawerSide,
  type DrawerSize,
  type DrawerSlotProps,
} from './index';

const TITLE = 'Filters';
const DESCRIPTION = 'Narrow the issue list by owner and status.';
const TRIGGER = 'Open filters';
const STATUSES = ['Backlog', 'In progress', 'In review', 'Done'];
const INLINE_CAP_REM: Record<DrawerSize, number> = { sm: 22, md: 30, lg: 38 };
const COMPACT_QUERY = '(max-width: 40rem)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const GUTTER_PX = Number.parseFloat(base.space[3]);

const AdapterMaterial = styled.div({ backgroundColor: vars.color.surfaceRaised, color: vars.color.text, border: `1px dashed ${vars.color.border}`, borderRadius: vars.radius.full, boxShadow: 'none' });
function DrawerPaper({ className, ...props }: SurfacePartProps) {
  return <AdapterMaterial {...props} className={className} />;
}

function rootAdapterStory(component: DrawerPanelProps['component']): Story {
  // Inline styles exercise the documented root/slot style-merging API.
  return {
    tags: ['!autodocs'],
    render: (args) => <DrawerExample {...args} panelProps={{
      component,
      ref: (node) => { if (node) node.dataset.rootRef = 'host'; },
      onClick: (event) => { event.currentTarget.dataset.callback = 'host'; },
      style: { paddingInlineStart: vars.space[1] },
      slotProps: { root: {
        ref: (node) => { if (node) node.dataset.rootRef = 'slot'; },
        className: 'panel-slot', 'data-origin': 'slot',
        onClick: (event) => { event.currentTarget.dataset.callback = 'slot'; },
        style: { paddingInlineStart: vars.space[2] },
      } },
    }} />,
    play: async ({ canvas, canvasElement, userEvent }) => {
      await userEvent.click(canvas.getByRole('button', { name: TRIGGER }));
      const shell = canvasElement.querySelector('dialog')!;
      const panel = shell.querySelector<HTMLElement>('[data-ui~="drawer-panel"]')!;
      await settle(shell);
      await expect(panel).toHaveAttribute('data-root-ref', 'slot');
      await expect(panel).toHaveClass('panel-slot');
      await expect(panel).toHaveAttribute('data-appearance', 'contrast');
      await expect(panel.style.paddingInlineStart).toBe(vars.space[2]);
      await expect(getComputedStyle(panel).borderStartEndRadius).toBe('0px');
      await expect(panel.querySelector('[data-ui~="drawer-panel"]')).toBeNull();
      await userEvent.click(canvas.getByRole('heading', { name: TITLE }));
      await expect(panel).toHaveAttribute('data-callback', 'slot');
      await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
      await expectClosed(canvasElement, canvas.getByRole('button', { name: TRIGGER }));
      await userEvent.click(canvas.getByRole('button', { name: TRIGGER }));
      await waitFor(() => expect(shell).toHaveAttribute('open'));
      await settle(shell);
      await expect(shell.querySelector('[data-ui~="drawer-panel"]')).toBe(panel);
      if (component === DrawerPaper) {
        await expect(getComputedStyle(panel).borderInlineStartStyle).toBe('dashed');
        await expect(getComputedStyle(panel).boxShadow).toBe('none');
      }
    },
  };
}

export const SurfaceAdapter = rootAdapterStory(Surface);
export const CardAdapter = rootAdapterStory(Card);
export const IndependentMaterialAdapter = rootAdapterStory(DrawerPaper);
export const SurfaceAdapterLight: Story = { ...SurfaceAdapter, decorators: [withLightTheme], globals: { theme: 'light' } };

const FieldStack = styled.div({
  display: 'grid',
  gap: vars.space[4],
});

const FieldLabel = styled.p({
  margin: 0,
  fontSize: vars.textSize.sm,
});

const meta = {
  title: 'Surfaces/Drawer',
  component: Drawer,
  tags: ['autodocs'],
  args: { onOpenChange: fn() },
  parameters: {
    docs: {
      description: {
        component:
          'Open a panel from the edge of the page to show settings, filters or details.',
      },
      sections: [
        { title: 'Shorthand mode', stories: ['Default'] },
        { title: 'Composed anatomy', stories: ['Composed'] },
        { title: 'Placements', stories: ['InlineStart', 'InlineEnd', 'Top', 'Bottom'] },
        { title: 'Sizes', stories: ['Small', 'Medium', 'Large'] },
        { title: 'Controlled and cancel', stories: ['Controlled', 'CancelVeto'] },
        { title: 'Draggable', stories: ['Draggable', 'DraggableBottom'] },
        { title: 'Long forms', stories: ['LongForm'] },
        { title: 'Nested overlays', stories: ['NestedPopover', 'NestedDialog'] },
      ],
      usage: `### When to use
Use a drawer for a task, filter panel, or set of details that needs focus without leaving the page. For brief, non-modal content anchored to a trigger, use a Popover instead.

### Values and constraints

- Modal only: the rest of the page is inert, Tab and Shift+Tab stay inside, and closing returns focus to the invoker.
- Inline panels cap their width and adapt to compact viewports; top and bottom panels span the viewport width.
- The panel slides into place and finishes sliding out before the dialog closes. Reduced motion disables dragging and makes entry and exit instant.
- Floating overlays need a portal container inside the drawer so they stay above the top layer.

### Keyboard and accessibility

- Tab and Shift+Tab cycle focus between interactive controls inside the drawer.
- Escape, close buttons, and backdrop clicks request closure. If you veto closure, provide another way to finish the task.
- Give the close button visible text or an aria-label.
- Do not announce long or structured content as a single accessible description.`,
    },
  },
} satisfies Meta<typeof Drawer>;

export default meta;

type Story = Omit<StoryObj<DrawerComposedProps>, 'render' | 'play'> & {
  render?: (args: DrawerComposedProps) => ReactNode;
  play?: (context: StoryContext<DrawerComposedProps>) => Promise<void>;
};

interface ExampleProps extends DrawerComposedProps {
  contentProps?: DrawerContentProps;
  panelProps?: DrawerPanelProps;
  body?: ReactNode;
}

function FilterFields() {
  return (
    <FieldStack>
      <TextField label="Owner" />
      {STATUSES.map((status) => (
        <Checkbox key={status} label={status} />
      ))}
    </FieldStack>
  );
}
FilterFields.displayName = 'FilterFields';

function DrawerExample({ contentProps, panelProps, body = <FilterFields />, ...props }: ExampleProps) {
  return (
    <Drawer {...props}>
      <Drawer.Trigger>{TRIGGER}</Drawer.Trigger>
      <Drawer.Content {...contentProps}>
        <Drawer.Panel {...panelProps}>
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

/** The panel rests once its animated offset clears. */
async function settle(dialog: HTMLElement) {
  const panel = dialog.querySelector<HTMLElement>('[data-ui~="drawer-panel"]')!;
  await waitFor(() => expect(panel.style.translate).toBe(''), { timeout: 2000 });
  await expect(dialog.style.getPropertyValue('--drawer-presence')).toBe('');
}

interface MotionFrame {
  open: boolean;
  left: number;
  top: number;
  presence: number;
  /** The shell's scroll offset; any scroll would cancel the panel's travel on screen. */
  scroll: number;
}

/** One reading per animation frame, from `start()` until `done` holds or the time runs out. */
async function sampleFrames(dialog: HTMLDialogElement, start: () => void, done: (frame: MotionFrame) => boolean) {
  const view = dialog.ownerDocument.defaultView!;
  const panel = dialog.querySelector<HTMLElement>('[data-ui="drawer-panel"]')!;
  const read = (): MotionFrame => ({
    open: dialog.open,
    left: rect(panel).left,
    top: rect(panel).top,
    presence: Number.parseFloat(dialog.style.getPropertyValue('--drawer-presence') || '1'),
    scroll: Math.abs(dialog.scrollLeft) + Math.abs(dialog.scrollTop),
  });
  const frames: MotionFrame[] = [];
  const startedAt = view.performance.now();
  start();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const frame = read();
      frames.push(frame);
      if (done(frame) || view.performance.now() - startedAt > 2000) resolve();
      else view.requestAnimationFrame(tick);
    };
    view.requestAnimationFrame(tick);
  });
  return frames;
}

function isMonotonic(values: number[], direction: 1 | -1) {
  return values.every((value, index) => index === 0 || (value - values[index - 1]!) * direction >= -0.01);
}

async function openDrawer({ canvasElement, userEvent }: Pick<StoryContext<DrawerComposedProps>, 'canvasElement' | 'userEvent'>) {
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
  // Native closure reconciles on the queued `close` event.
  await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
  await expect(trigger).toHaveFocus();
  await waitFor(() => expect(canvasElement.ownerDocument.documentElement.style.overflow).toBe(''));
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

const LONG_REFERENCE = 'CustomerAccountExportConfirmationReference'.repeat(3);

export const UnbrokenContent: StoryObj<(props: DrawerShorthandProps) => ReactNode> = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    triggerLabel: 'Open export',
    title: LONG_REFERENCE,
    content: <p>{LONG_REFERENCE}</p>,
    closeLabel: 'Close',
    sx: { inlineSize: '320px' },
  },
  render: (args) => <Drawer {...args} />,
  play: async ({ canvas }) => {
    const dialog = await canvas.findByRole('dialog');
    await settle(dialog);
    const title = within(dialog).getByRole('heading');
    const body = dialog.querySelector<HTMLElement>('[data-ui="drawer-body"]')!;
    for (const direction of ['ltr', 'rtl']) {
      dialog.dir = direction;
      for (const part of [title, body]) {
        await expect(part.scrollWidth).toBeLessThanOrEqual(part.clientWidth + 1);
      }
    }
    dialog.removeAttribute('dir');
  },
};

export const Default: StoryObj<(props: DrawerShorthandProps) => ReactNode> = {
  name: 'Shorthand mode',
  args: {
    triggerLabel: TRIGGER,
    title: TITLE,
    description: DESCRIPTION,
    content: <FilterFields />,
    closeLabel: 'Close',
    onOpenChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Open a drawer using single-element presentation props.',
      },
      source: {
        language: 'tsx',
        code: `import { Checkbox, Drawer, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const FieldStack = styled.div({
  display: 'grid',
  gap: vars.space[4],
});

<Drawer
  triggerLabel="Open filters"
  title="Filters"
  description="Narrow the issue list by owner and status."
  content={
    <FieldStack>
      <TextField label="Owner" />
      <Checkbox label="Backlog" />
      <Checkbox label="In progress" />
      <Checkbox label="In review" />
      <Checkbox label="Done" />
    </FieldStack>
  }
  closeLabel="Close"
/>`,
      },
    },
  },
  render: (args) => <Drawer {...args} />,
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: TRIGGER });
    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    const dialog = await canvas.findByRole('dialog', { name: TITLE });
    await settle(dialog);
    await expect(dialog).toHaveAttribute('data-ui', 'drawer');
    await expect(getComputedStyle(dialog).zIndex).toBe('200');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAccessibleName(TITLE);
    await expect(dialog).toHaveAccessibleDescription(DESCRIPTION);
    await expect(dialog.contains(canvasElement.ownerDocument.activeElement)).toBe(true);

    const close = canvas.getByRole('button', { name: 'Close' });
    await userEvent.click(close);
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);

    await userEvent.click(trigger);
    const reopened = await canvas.findByRole('dialog', { name: TITLE });
    await settle(reopened);
    requestEscape(reopened);
    await expectClosed(canvasElement, trigger);
    await expect(trigger).toHaveFocus();
  },
};

export const Composed: Story = {
  name: 'Composed',
  parameters: {
    docs: {
      description: {
        story: 'Assemble a drawer with composed parts for custom header, body, and footer layout.',
      },
      source: {
        language: 'tsx',
        code: `import { Checkbox, Drawer, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const FieldStack = styled.div({
  display: 'grid',
  gap: vars.space[4],
});

<Drawer>
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Description>Narrow the issue list by owner and status.</Drawer.Description>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body>
        <FieldStack>
          <TextField label="Owner" />
          <Checkbox label="Backlog" />
          <Checkbox label="In progress" />
          <Checkbox label="In review" />
          <Checkbox label="Done" />
        </FieldStack>
      </Drawer.Body>
      <Drawer.Footer>
        <Drawer.Close>Done</Drawer.Close>
      </Drawer.Footer>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>`,
      },
    },
  },
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

function ControlledShorthandDrawer(props: DrawerShorthandProps) {
  const [open, setOpen] = useState(false);
  return (
    <Drawer
      {...props}
      open={open}
      onOpenChange={(next) => {
        props.onOpenChange?.(next);
        setOpen(next);
      }}
    />
  );
}
ControlledShorthandDrawer.displayName = 'ControlledShorthandDrawer';

export const ShorthandModeControlled: StoryObj<(props: DrawerShorthandProps) => ReactNode> = {
  name: 'Shorthand mode controlled',
  parameters: { docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { Drawer, TextField } from '@jfrader/ui';

function Filters() {
  const [open, setOpen] = useState(false);
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      triggerLabel="Open filters"
      title="Filters"
      description="Narrow the issue list by owner and status."
      content={<TextField label="Owner" />}
      closeLabel="Close"
    />
  );
}` } } },
  args: {
    triggerLabel: TRIGGER,
    title: TITLE,
    description: DESCRIPTION,
    content: <FilterFields />,
    closeLabel: 'Close',
    onOpenChange: fn(),
  },
  render: (args) => <ControlledShorthandDrawer {...args} />,
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: TRIGGER });
    await userEvent.click(trigger);
    const dialog = await canvas.findByRole('dialog', { name: TITLE });
    await settle(dialog);
    await expect(dialog).toHaveAttribute('open');
    await expect(args.onOpenChange).toHaveBeenCalledWith(true);

    const close = canvas.getByRole('button', { name: 'Close' });
    await userEvent.click(close);
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};

export const ShorthandModeDisabled: StoryObj<(props: DrawerShorthandProps) => ReactNode> = {
  name: 'Shorthand mode disabled',
  parameters: { docs: { source: { language: 'tsx', code: `import { Drawer, TextField } from '@jfrader/ui';

<Drawer
  triggerLabel="Open filters"
  title="Filters"
  description="Narrow the issue list by owner and status."
  content={<TextField label="Owner" />}
  closeLabel="Close"
  slotProps={{ trigger: { disabled: true } }}
/>` } } },
  args: {
    triggerLabel: TRIGGER,
    title: TITLE,
    description: DESCRIPTION,
    content: <FilterFields />,
    closeLabel: 'Close',
    onOpenChange: fn(),
    slotProps: {
      trigger: {
        disabled: true,
      },
    },
  },
  render: (args) => <Drawer {...args} />,
  play: async ({ canvas, args, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: TRIGGER });
    await expect(trigger).toBeDisabled();
    await userEvent.click(trigger);
    await expect(canvas.queryByRole('dialog')).toBeNull();
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};

function CustomDrawerContent(props: DrawerContentProps) {
  return <Drawer.Content {...props} data-slot="drawer-content" />;
}
function CustomDrawerPanel(props: DrawerPanelProps) {
  return <Drawer.Panel {...props} data-slot="drawer-panel" />;
}

export const ShorthandModeCustomizationSlotProps: StoryObj<(props: DrawerShorthandProps) => ReactNode> = {
  name: 'Shorthand mode customization slotProps',
  parameters: { docs: { source: { language: 'tsx', code: `import { Drawer, TextField, styled, type SurfacePartProps } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Material = styled.div({
  backgroundColor: vars.color.surfaceRaised,
  color: vars.color.text,
  border: '1px dashed ' + vars.color.border,
});

function FilterPanel(props: SurfacePartProps) {
  return <Material {...props} />;
}

<Drawer
  triggerLabel="Open filters"
  title="Filters"
  content={<TextField label="Owner" />}
  closeLabel="Close"
  slotProps={{
    trigger: { className: 'filters-trigger' },
    panel: { slots: { root: FilterPanel } },
    title: { title: 'Issue filters' },
  }}
/>` } } },
  args: {
    triggerLabel: TRIGGER,
    title: TITLE,
    description: DESCRIPTION,
    content: <FilterFields />,
    closeLabel: 'Close',
    onOpenChange: fn(),
    slots: { content: CustomDrawerContent, panel: CustomDrawerPanel },
    slotProps: {
      trigger: { className: 'custom-trigger', 'data-testid': 'custom-trigger' },
      content: { className: 'custom-content', 'data-testid': 'custom-content' },
      panel: {
        slots: { root: DrawerPaper },
        className: 'custom-panel',
        'data-testid': 'custom-panel',
      },
      header: { className: 'custom-header', 'data-testid': 'custom-header' },
      title: { className: 'custom-title', 'data-testid': 'custom-title' },
      description: { className: 'custom-description', 'data-testid': 'custom-description' },
      close: { className: 'custom-close', 'data-testid': 'custom-close' },
      body: { className: 'custom-body', 'data-testid': 'custom-body' },
    },
  },
  render: (args) => <Drawer {...args} />,
  play: async ({ canvasElement, canvas, userEvent }) => {
    const trigger = canvas.getByTestId('custom-trigger');
    await expect(trigger).toHaveClass('custom-trigger');
    await userEvent.click(trigger);
    const dialog = await canvas.findByRole('dialog', { name: TITLE });
    await settle(dialog);
    await expect(dialog).toHaveClass('custom-content');
    await expect(dialog).toHaveAttribute('data-slot', 'drawer-content');
    await expect(dialog).toHaveAttribute('data-testid', 'custom-content');

    const panel = canvasElement.querySelector<HTMLElement>('[data-testid="custom-panel"]')!;
    await expect(panel).toHaveClass('custom-panel');
    await expect(panel).toHaveAttribute('data-slot', 'drawer-panel');
    await expect(getComputedStyle(panel).borderInlineStartStyle).toBe('dashed');

    const header = canvasElement.querySelector<HTMLElement>('[data-testid="custom-header"]')!;
    await expect(header).toHaveClass('custom-header');

    const title = canvas.getByRole('heading', { name: TITLE });
    await expect(title).toHaveClass('custom-title');
    await expect(title).toHaveAttribute('data-testid', 'custom-title');

    const desc = canvasElement.querySelector<HTMLElement>('[data-testid="custom-description"]')!;
    await expect(desc).toHaveClass('custom-description');

    const close = canvas.getByRole('button', { name: 'Close' });
    await expect(close).toHaveClass('custom-close');
    await expect(close).toHaveAttribute('data-testid', 'custom-close');

    const body = canvasElement.querySelector<HTMLElement>('[data-testid="custom-body"]')!;
    await expect(body).toHaveClass('custom-body');

    await userEvent.click(close);
    await expectClosed(canvasElement, trigger);
  },
};

export const ShorthandModeWithoutDescription: StoryObj<(props: DrawerShorthandProps) => ReactNode> = {
  tags: ['!autodocs'],
  name: 'Shorthand mode without description',
  args: {
    triggerLabel: TRIGGER,
    title: TITLE,
    description: undefined,
    content: <FilterFields />,
    closeLabel: 'Close',
    onOpenChange: fn(),
  },
  render: (args) => <Drawer {...args} defaultOpen />,
  play: async ({ canvas, canvasElement }) => {
    const dialog = await canvas.findByRole('dialog', { name: TITLE });
    await settle(dialog);
    await expect(dialog).not.toHaveAttribute('aria-describedby');
    await expect(canvasElement.querySelector('[data-ui="drawer-description"]')).toBeNull();
  },
};

function shorthandModeTypeContracts() {
  // @ts-expect-error Presentation mode rejects composed children.
  <Drawer triggerLabel="Open" title="Filters" content="Filters" closeLabel="Close">Composed</Drawer>;
  // @ts-expect-error Presentation mode requires title and closeLabel.
  <Drawer triggerLabel="Open" content="Filters" />;
  // @ts-expect-error Named presentation props cannot leak into composed mode.
  <Drawer title="Filters"><Drawer.Content /></Drawer>;
}
void shorthandModeTypeContracts;

export const InlineStart: Story = {
  name: 'Inline start',
  args: { side: 'inline-start' },
  parameters: {
    docs: {
      description: {
        story: 'Attach the panel to the inline-start edge of the viewport.',
      },
      source: {
        language: 'tsx',
        code: `import { Checkbox, Drawer, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const FieldStack = styled.div({
  display: 'grid',
  gap: vars.space[4],
});

<Drawer side="inline-start">
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Description>Narrow the issue list by owner and status.</Drawer.Description>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body>
        <FieldStack>
          <TextField label="Owner" />
          <Checkbox label="Backlog" />
          <Checkbox label="In progress" />
          <Checkbox label="In review" />
          <Checkbox label="Done" />
        </FieldStack>
      </Drawer.Body>
      <Drawer.Footer>
        <Drawer.Close>Done</Drawer.Close>
      </Drawer.Footer>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>`,
      },
    },
  },
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
  name: 'Inline end',
  args: { side: 'inline-end' },
  parameters: {
    docs: {
      description: {
        story: 'Attach the panel to the default inline-end edge of the viewport.',
      },
      source: {
        language: 'tsx',
        code: `import { Checkbox, Drawer, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const FieldStack = styled.div({
  display: 'grid',
  gap: vars.space[4],
});

<Drawer side="inline-end">
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Description>Narrow the issue list by owner and status.</Drawer.Description>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body>
        <FieldStack>
          <TextField label="Owner" />
          <Checkbox label="Backlog" />
          <Checkbox label="In progress" />
          <Checkbox label="In review" />
          <Checkbox label="Done" />
        </FieldStack>
      </Drawer.Body>
      <Drawer.Footer>
        <Drawer.Close>Done</Drawer.Close>
      </Drawer.Footer>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>`,
      },
    },
  },
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
  name: 'Top',
  args: { side: 'top' },
  parameters: {
    docs: {
      description: {
        story: 'Attach the panel to the top edge of the viewport spanning the full width.',
      },
      source: {
        language: 'tsx',
        code: `import { Checkbox, Drawer, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const FieldStack = styled.div({
  display: 'grid',
  gap: vars.space[4],
});

<Drawer side="top">
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Description>Narrow the issue list by owner and status.</Drawer.Description>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body>
        <FieldStack>
          <TextField label="Owner" />
          <Checkbox label="Backlog" />
          <Checkbox label="In progress" />
          <Checkbox label="In review" />
          <Checkbox label="Done" />
        </FieldStack>
      </Drawer.Body>
      <Drawer.Footer>
        <Drawer.Close>Done</Drawer.Close>
      </Drawer.Footer>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>`,
      },
    },
  },
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
  name: 'Bottom',
  args: { side: 'bottom' },
  parameters: {
    docs: {
      description: {
        story: 'Attach the panel to the bottom edge of the viewport spanning the full width.',
      },
      source: {
        language: 'tsx',
        code: `import { Checkbox, Drawer, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const FieldStack = styled.div({
  display: 'grid',
  gap: vars.space[4],
});

<Drawer side="bottom">
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Description>Narrow the issue list by owner and status.</Drawer.Description>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body>
        <FieldStack>
          <TextField label="Owner" />
          <Checkbox label="Backlog" />
          <Checkbox label="In progress" />
          <Checkbox label="In review" />
          <Checkbox label="Done" />
        </FieldStack>
      </Drawer.Body>
      <Drawer.Footer>
        <Drawer.Close>Done</Drawer.Close>
      </Drawer.Footer>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>`,
      },
    },
  },
  render: (args) => <DrawerExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const { dialog, panel } = await openDrawer({ canvasElement, userEvent });
    await expect(rect(panel).bottom).toBeCloseTo(rect(dialog).bottom, 0);
    await expect(rect(panel).width).toBeCloseTo(rect(dialog).width, 0);
    await expect(Number.parseFloat(getComputedStyle(panel).borderTopWidth)).toBeGreaterThan(0);
  },
};

/** Frame-sampled entrance and exit: the panel really travels along its axis toward and away from its edge. */
const motionStory = (side: 'inline-end' | 'bottom'): Story => ({
  args: { side },
  render: (args) => <DrawerExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const { dialog, panel } = parts(canvasElement);
    const trigger = within(canvasElement).getByRole('button', { name: TRIGGER });
    const position = (frame: MotionFrame) => (side === 'bottom' ? frame.top : frame.left);
    const extent = () => (side === 'bottom' ? rect(panel).height : rect(panel).width);

    // Entrance: from past the edge to rest, one step per frame; the scrim fades in alongside.
    // Focus moving into the panel mid-slide must not scroll the shell to reveal it.
    trigger.focus();
    const done = within(dialog).getByRole('button', { name: 'Done', hidden: true });
    const entrance = await sampleFrames(
      dialog,
      () => {
        trigger.click();
        canvasElement.ownerDocument.defaultView!.requestAnimationFrame(() => done.focus());
      },
      () => panel.style.translate === '',
    );
    await expect(entrance.every((frame) => frame.scroll === 0)).toBe(true);
    const rest = position(entrance.at(-1)!);
    await expect(rest).toBeCloseTo(side === 'bottom' ? rect(dialog).bottom - extent() : rect(dialog).right - extent(), 0);
    await expect(position(entrance[0]!)).toBeGreaterThan(rest + extent() / 2);
    await expect(new Set(entrance.map(position)).size).toBeGreaterThan(2);
    await expect(isMonotonic(entrance.map(position), -1)).toBe(true);
    await expect(entrance[0]!.presence).toBeLessThan(0.5);
    await expect(isMonotonic(entrance.map((frame) => frame.presence), 1)).toBe(true);
    await expect(entrance.at(-1)!.presence).toBe(1);

    // Exit: the dialog stays open while the panel slides back out, then closes.
    const close = within(dialog).getAllByRole('button', { name: 'Close' })[0]!;
    const exit = await sampleFrames(dialog, () => close.click(), (frame) => !frame.open);
    const retained = exit.filter((frame) => frame.open);
    await expect(retained.length).toBeGreaterThan(1);
    await expect(retained.every((frame) => frame.scroll === 0)).toBe(true);
    await expect(new Set(retained.map(position)).size).toBeGreaterThan(1);
    await expect(isMonotonic(retained.map(position), 1)).toBe(true);
    await expect(position(retained.at(-1)!)).toBeGreaterThan(rest);
    await expect(isMonotonic(retained.map((frame) => frame.presence), -1)).toBe(true);
    await expect(exit.at(-1)!.open).toBe(false);
    await expectClosed(canvasElement, trigger);
    await expectHome(panel);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
});

export const SlideMotion: Story = {
  ...motionStory('inline-end'),
  parameters: { docs: { source: { language: 'tsx', code: `import { Drawer, TextField } from '@jfrader/ui';

<Drawer side="inline-end">
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body><TextField label="Owner" /></Drawer.Body>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>` } } },
};
export const SlideMotionBottom: Story = {
  ...motionStory('bottom'),
  parameters: { docs: { source: { language: 'tsx', code: `import { Drawer, TextField } from '@jfrader/ui';

<Drawer side="bottom">
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body><TextField label="Owner" /></Drawer.Body>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>` } } },
};

export const ReopenDuringExit: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { Drawer, TextField } from '@jfrader/ui';

<Drawer>
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body><TextField label="Owner" /></Drawer.Body>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>` } } },
  render: (args) => <DrawerExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const { dialog, panel, trigger } = await openDrawer({ canvasElement, userEvent });
    const rest = rect(panel).left;
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Close' })[0]!);
    await waitFor(() => expect(rect(panel).left).toBeGreaterThan(rest + 1));
    await expect(dialog).toHaveAttribute('open');
    // Mid-exit the logical state is already closed; a programmatic reopen turns the panel back.
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    await settle(dialog);
    await expect(dialog).toHaveAttribute('open');
    await expect(rect(panel).left).toBeCloseTo(rest, 0);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(3);
    for (const [index, open] of [true, false, true].entries()) {
      await expect(args.onOpenChange).toHaveBeenNthCalledWith(index + 1, open);
    }
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

export const Small: Story = {
  name: 'Small',
  ...sizeStory('sm'),
  parameters: {
    docs: {
      description: {
        story: 'Constrain the inline drawer panel to the small width cap.',
      },
      source: {
        language: 'tsx',
        code: `import { Checkbox, Drawer, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const FieldStack = styled.div({
  display: 'grid',
  gap: vars.space[4],
});

<Drawer size="sm">
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Description>Narrow the issue list by owner and status.</Drawer.Description>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body>
        <FieldStack>
          <TextField label="Owner" />
          <Checkbox label="Backlog" />
          <Checkbox label="In progress" />
          <Checkbox label="In review" />
          <Checkbox label="Done" />
        </FieldStack>
      </Drawer.Body>
      <Drawer.Footer>
        <Drawer.Close>Done</Drawer.Close>
      </Drawer.Footer>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>`,
      },
    },
  },
};
export const Medium: Story = {
  name: 'Medium',
  ...sizeStory('md'),
  parameters: {
    docs: {
      description: {
        story: 'Constrain the inline drawer panel to the default medium width cap.',
      },
      source: {
        language: 'tsx',
        code: `import { Checkbox, Drawer, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const FieldStack = styled.div({
  display: 'grid',
  gap: vars.space[4],
});

<Drawer size="md">
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Description>Narrow the issue list by owner and status.</Drawer.Description>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body>
        <FieldStack>
          <TextField label="Owner" />
          <Checkbox label="Backlog" />
          <Checkbox label="In progress" />
          <Checkbox label="In review" />
          <Checkbox label="Done" />
        </FieldStack>
      </Drawer.Body>
      <Drawer.Footer>
        <Drawer.Close>Done</Drawer.Close>
      </Drawer.Footer>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>`,
      },
    },
  },
};
export const Large: Story = {
  name: 'Large',
  ...sizeStory('lg'),
  parameters: {
    docs: {
      description: {
        story: 'Constrain the inline drawer panel to the large width cap.',
      },
      source: {
        language: 'tsx',
        code: `import { Checkbox, Drawer, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const FieldStack = styled.div({
  display: 'grid',
  gap: vars.space[4],
});

<Drawer size="lg">
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Description>Narrow the issue list by owner and status.</Drawer.Description>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body>
        <FieldStack>
          <TextField label="Owner" />
          <Checkbox label="Backlog" />
          <Checkbox label="In progress" />
          <Checkbox label="In review" />
          <Checkbox label="Done" />
        </FieldStack>
      </Drawer.Body>
      <Drawer.Footer>
        <Drawer.Close>Done</Drawer.Close>
      </Drawer.Footer>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>`,
      },
    },
  },
};

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
  name: 'Draggable',
  args: { draggable: true },
  parameters: {
    docs: {
      description: {
        story: 'Drag the header toward the edge to dismiss the drawer.',
      },
      source: {
        language: 'tsx',
        code: `import { Checkbox, Drawer, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const FieldStack = styled.div({
  display: 'grid',
  gap: vars.space[4],
});

<Drawer draggable>
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Description>Narrow the issue list by owner and status.</Drawer.Description>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body>
        <FieldStack>
          <TextField label="Owner" />
          <Checkbox label="Backlog" />
          <Checkbox label="In progress" />
          <Checkbox label="In review" />
          <Checkbox label="Done" />
        </FieldStack>
      </Drawer.Body>
      <Drawer.Footer>
        <Drawer.Close>Done</Drawer.Close>
      </Drawer.Footer>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>`,
      },
    },
  },
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
    await expectHome(panel);

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
  // Excluded from the docs page: its open modal would cover (or iframe-fragment) the docs preview.
  tags: ['!autodocs'],
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
  name: 'Draggable bottom',
  args: { draggable: true, side: 'bottom' },
  parameters: {
    docs: {
      description: {
        story: 'Drag the header downward to dismiss a bottom-anchored drawer.',
      },
      source: {
        language: 'tsx',
        code: `import { Checkbox, Drawer, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const FieldStack = styled.div({
  display: 'grid',
  gap: vars.space[4],
});

<Drawer draggable side="bottom">
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Description>Narrow the issue list by owner and status.</Drawer.Description>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body>
        <FieldStack>
          <TextField label="Owner" />
          <Checkbox label="Backlog" />
          <Checkbox label="In progress" />
          <Checkbox label="In review" />
          <Checkbox label="Done" />
        </FieldStack>
      </Drawer.Body>
      <Drawer.Footer>
        <Drawer.Close>Done</Drawer.Close>
      </Drawer.Footer>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>`,
      },
    },
  },
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
    <FieldStack>
      {Array.from({ length: 14 }, (_, index) => (
        <TextField key={index} label={`Field ${index + 1}`} />
      ))}
    </FieldStack>
  );
}
LongFormBody.displayName = 'LongFormBody';

export const LongForm: Story = {
  name: 'Long form',
  parameters: {
    docs: {
      description: {
        story: 'Scroll long body content while keeping the header and footer fixed in view.',
      },
      source: {
        language: 'tsx',
        code: `import { Drawer, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const FieldStack = styled.div({
  display: 'grid',
  gap: vars.space[4],
});

<Drawer>
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Description>Narrow the issue list by owner and status.</Drawer.Description>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body>
        <FieldStack>
          {Array.from({ length: 14 }, (_, index) => (
            <TextField key={index} label={\`Field \${index + 1}\`} />
          ))}
        </FieldStack>
      </Drawer.Body>
      <Drawer.Footer>
        <Drawer.Close>Done</Drawer.Close>
      </Drawer.Footer>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>`,
      },
    },
  },
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
  parameters: { docs: { source: { language: 'tsx', code: `import { Drawer, TextField, ThemeRoot } from '@jfrader/ui';

<ThemeRoot theme="light">
  <Drawer>
    <Drawer.Trigger>Open filters</Drawer.Trigger>
    <Drawer.Content>
      <Drawer.Panel>
        <Drawer.Header>
          <Drawer.Title>Filters</Drawer.Title>
          <Drawer.Close>Close</Drawer.Close>
        </Drawer.Header>
        <Drawer.Body><TextField label="Owner" /></Drawer.Body>
      </Drawer.Panel>
    </Drawer.Content>
  </Drawer>
</ThemeRoot>` } } },
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  render: (args) => <DrawerExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const { dialog, panel, canvas, trigger } = await openDrawer({ canvasElement, userEvent });
    await expect(canvasElement.contains(dialog)).toBe(true);
    // The panel wears the dark theme plus the elevated-charcoal overrides, on a light page.
    await expect(panel).toHaveAttribute('data-theme', 'dark');
    await expect(panel).toHaveAttribute('data-appearance', 'contrast');
    await expectContrastSurface(panel, 'light');
    await expect(getComputedStyle(panel).backgroundColor).toBe('rgb(32, 34, 38)');
    await expect(getComputedStyle(panel).colorScheme).toBe('dark');
    await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
    await expectClosed(canvasElement, trigger);
  },
};

export const ContrastPanelDark: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { Drawer, TextField, ThemeRoot } from '@jfrader/ui';

<ThemeRoot theme="dark">
  <Drawer>
    <Drawer.Trigger>Open filters</Drawer.Trigger>
    <Drawer.Content>
      <Drawer.Panel appearance="contrast">
        <Drawer.Header>
          <Drawer.Title>Filters</Drawer.Title>
          <Drawer.Close>Close</Drawer.Close>
        </Drawer.Header>
        <Drawer.Body><TextField label="Owner" /></Drawer.Body>
      </Drawer.Panel>
    </Drawer.Content>
  </Drawer>
</ThemeRoot>` } } },
  render: (args) => <DrawerExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const { panel, canvas, trigger } = await openDrawer({ canvasElement, userEvent });
    // On a dark page the panel keeps its charcoal elevation above the page; same values as on light.
    await expect(panel).toHaveAttribute('data-appearance', 'contrast');
    await expectContrastSurface(panel, 'dark');
    await expect(getComputedStyle(panel).backgroundColor).toBe('rgb(32, 34, 38)');
    await expect(getComputedStyle(panel).colorScheme).toBe('dark');
    await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
    await expectClosed(canvasElement, trigger);
  },
};

export const DefaultAppearance: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { Drawer, TextField, ThemeRoot } from '@jfrader/ui';

<ThemeRoot theme="light">
  <Drawer>
    <Drawer.Trigger>Open filters</Drawer.Trigger>
    <Drawer.Content>
      <Drawer.Panel appearance="default">
        <Drawer.Header>
          <Drawer.Title>Filters</Drawer.Title>
          <Drawer.Close>Close</Drawer.Close>
        </Drawer.Header>
        <Drawer.Body><TextField label="Owner" /></Drawer.Body>
      </Drawer.Panel>
    </Drawer.Content>
  </Drawer>
</ThemeRoot>` } } },
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  render: (args) => <DrawerExample {...args} panelProps={{ appearance: 'default' }} />,
  play: async ({ canvasElement, userEvent }) => {
    const { panel, canvas, trigger } = await openDrawer({ canvasElement, userEvent });
    // Opting out names no appearance, so the panel inherits the page's own surface.
    await expect(panel).not.toHaveAttribute('data-theme');
    await expect(panel).not.toHaveAttribute('data-appearance');
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
  // Excluded from the docs page: its open modal would cover (or iframe-fragment) the docs preview.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => <DrawerExample {...args} />,
  play: async ({ args, canvasElement }) => {
    await expectPersistentOpen(canvasElement);
    // Initialization is not an interaction.
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};

export const PersistentOpenLight: Story = {
  // Excluded from the docs page: its open modal would cover (or iframe-fragment) the docs preview.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  render: (args) => <DrawerExample {...args} />,
  play: async ({ canvasElement }) => {
    const dialog = await expectPersistentOpen(canvasElement);
    await expectContrastSurface(parts(canvasElement).panel, 'light');
    await expect(canvasElement.contains(dialog)).toBe(true);
  },
};

export const OpenNoDescription: Story = {
  // Excluded from the docs page: its open modal would cover (or iframe-fragment) the docs preview.
  tags: ['!autodocs'],
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
  name: 'Controlled',
  parameters: {
    docs: {
      description: {
        story: 'Control the open state externally with open and onOpenChange.',
      },
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { Checkbox, Drawer, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const FieldStack = styled.div({
  display: 'grid',
  gap: vars.space[4],
});

function Filters() {
  const [open, setOpen] = useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger>Open filters</Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Panel>
          <Drawer.Header>
            <Drawer.Title>Filters</Drawer.Title>
            <Drawer.Description>Narrow the issue list by owner and status.</Drawer.Description>
            <Drawer.Close>Close</Drawer.Close>
          </Drawer.Header>
          <Drawer.Body>
            <FieldStack>
              <TextField label="Owner" />
              <Checkbox label="Backlog" />
              <Checkbox label="In progress" />
              <Checkbox label="In review" />
              <Checkbox label="Done" />
            </FieldStack>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close>Done</Drawer.Close>
          </Drawer.Footer>
        </Drawer.Panel>
      </Drawer.Content>
    </Drawer>
  );
}`,
      },
    },
  },
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
  // Excluded from the docs page: its open modal would cover (or iframe-fragment) the docs preview.
  tags: ['!autodocs'],
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
  name: 'Cancel veto',
  parameters: {
    docs: {
      description: {
        story: 'Prevent closure on Escape, Close button, or backdrop click with onCancel.',
      },
      source: {
        language: 'tsx',
        code: `import { Checkbox, Drawer, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const FieldStack = styled.div({
  display: 'grid',
  gap: vars.space[4],
});

<Drawer>
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content onCancel={(event) => event.preventDefault()}>
    <Drawer.Panel>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Description>Narrow the issue list by owner and status.</Drawer.Description>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body>
        <FieldStack>
          <TextField label="Owner" />
          <Checkbox label="Backlog" />
          <Checkbox label="In progress" />
          <Checkbox label="In review" />
          <Checkbox label="Done" />
        </FieldStack>
      </Drawer.Body>
      <Drawer.Footer>
        <Drawer.Close>Done</Drawer.Close>
      </Drawer.Footer>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>`,
      },
    },
  },
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
  parameters: { docs: { source: { language: 'tsx', code: `import { Drawer, TextField } from '@jfrader/ui';

<Drawer>
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body><TextField label="Owner" /></Drawer.Body>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>` } } },
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
  // Excluded from the docs page: its open modal would cover (or iframe-fragment) the docs preview.
  tags: ['!autodocs'],
  args: { open: true },
  render: (args) => (
    <DrawerExample
      {...args}
      body={
        <form method="dialog">
          <FixtureButton type="submit" >
            Apply
          </FixtureButton>
        </form>
      }
    />
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const { documentElement } = canvasElement.ownerDocument;
    const { dialog } = parts(canvasElement);
    await waitFor(() => expect(documentElement.style.overflow).toBe('hidden'));
    await settle(dialog);
    const apply = canvas.getByRole('button', { name: 'Apply' });
    await expect(rect(apply).height).toBeGreaterThanOrEqual(32);
    // A native form close cannot be vetoed: the rejected request still releases the scroll lock.
    await userEvent.click(apply);
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
  parameters: { docs: { source: { language: 'tsx', code: `import { useRef } from 'react';
import { Button, Drawer } from '@jfrader/ui';

function Filters() {
  const dialog = useRef<HTMLDialogElement | null>(null);
  return (
    <Drawer>
      <Drawer.Trigger>Open filters</Drawer.Trigger>
      <Drawer.Content ref={dialog}>
        <Drawer.Panel>
          <Drawer.Header>
            <Drawer.Title>Filters</Drawer.Title>
            <Drawer.Close>Close</Drawer.Close>
          </Drawer.Header>
          <Drawer.Body>
            <Button onClick={() => dialog.current?.close()}>Done</Button>
          </Drawer.Body>
        </Drawer.Panel>
      </Drawer.Content>
    </Drawer>
  );
}` } } },
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

function UnmountFixture({ removeTrigger = false, ...props }: DrawerComposedProps & { removeTrigger?: boolean }) {
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
              <FixtureButton type="button" onClick={() => setMounted(false)}>
                Remove panel
              </FixtureButton>
            </Drawer.Body>
          </Drawer.Panel>
        </Drawer.Content>
      )}
    </Drawer>
  );
}
UnmountFixture.displayName = 'UnmountFixture';

export const UnmountOpen: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, Drawer } from '@jfrader/ui';

function Filters() {
  const [mounted, setMounted] = useState(true);
  return (
    <Drawer>
      <Drawer.Trigger>Open filters</Drawer.Trigger>
      {mounted && (
        <Drawer.Content>
          <Drawer.Panel>
            <Drawer.Header><Drawer.Title>Filters</Drawer.Title></Drawer.Header>
            <Drawer.Body>
              <Button onClick={() => setMounted(false)}>Remove panel</Button>
            </Drawer.Body>
          </Drawer.Panel>
        </Drawer.Content>
      )}
    </Drawer>
  );
}` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, Drawer } from '@jfrader/ui';

function Filters() {
  const [mounted, setMounted] = useState(true);
  return (
    <Drawer>
      {mounted && <Drawer.Trigger>Open filters</Drawer.Trigger>}
      {mounted && (
        <Drawer.Content>
          <Drawer.Panel>
            <Drawer.Header><Drawer.Title>Filters</Drawer.Title></Drawer.Header>
            <Drawer.Body>
              <Button onClick={() => setMounted(false)}>Remove panel</Button>
            </Drawer.Body>
          </Drawer.Panel>
        </Drawer.Content>
      )}
    </Drawer>
  );
}` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `import { Drawer, TextField } from '@jfrader/ui';

<Drawer>
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body><TextField label="Owner" /></Drawer.Body>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `import { Button, Drawer, TextField } from '@jfrader/ui';

<>
  <Button>Before</Button>
  <Drawer>
    <Drawer.Trigger>Open filters</Drawer.Trigger>
    <Drawer.Content>
      <Drawer.Panel>
        <Drawer.Header>
          <Drawer.Title>Filters</Drawer.Title>
          <Drawer.Close>Close</Drawer.Close>
        </Drawer.Header>
        <Drawer.Body><TextField label="Owner" /></Drawer.Body>
        <Drawer.Footer><Drawer.Close>Done</Drawer.Close></Drawer.Footer>
      </Drawer.Panel>
    </Drawer.Content>
  </Drawer>
</>` } } },
  render: (args) => (
    <>
      <FixtureButton type="button" >
        Before
      </FixtureButton>
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
    const done = within(dialog).getByRole('button', { name: 'Done', hidden: true });
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
  parameters: { docs: { source: { language: 'tsx', code: `<Drawer>
  <Drawer.Trigger onClick={(event) => event.preventDefault()}>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel>
      <Drawer.Header><Drawer.Title>Filters</Drawer.Title></Drawer.Header>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>` } } },
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
  // Excluded from the docs page: its open modal would cover (or iframe-fragment) the docs preview.
  tags: ['!autodocs'],
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
  parameters: { docs: { source: { language: 'tsx', code: `<>
  <Drawer>
    <Drawer.Trigger>Open count</Drawer.Trigger>
    <Drawer.Content>
      <Drawer.Panel>
        <Drawer.Header>
          <Drawer.Title>{0}</Drawer.Title>
          <Drawer.Description>{0}</Drawer.Description>
          <Drawer.Close>Close</Drawer.Close>
        </Drawer.Header>
      </Drawer.Panel>
    </Drawer.Content>
  </Drawer>
  <Drawer>
    <Drawer.Trigger>Open filters</Drawer.Trigger>
    <Drawer.Content aria-label="Filters">
      <Drawer.Panel>
        <Drawer.Header>
          <Drawer.Title>{null}</Drawer.Title>
          <Drawer.Description>{false}</Drawer.Description>
          <Drawer.Close>Close</Drawer.Close>
        </Drawer.Header>
      </Drawer.Panel>
    </Drawer.Content>
  </Drawer>
</>` } } },
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
          <FixtureButton type="button" >
            Assign to me
          </FixtureButton>
        </Popover.Content>
      </Popover>
      <div ref={setHost} />
    </ThemeRoot>
  );
}
NestedPopoverBody.displayName = 'NestedPopoverBody';

export const NestedPopover: Story = {
  name: 'Nested popover',
  parameters: {
    docs: {
      description: {
        story: 'Render a floating popover inside the drawer using ThemeRoot portalContainer.',
      },
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { Button, Drawer, Popover, ThemeRoot } from '@jfrader/ui';

function OwnerFilters() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <Drawer>
      <Drawer.Trigger>Open filters</Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Panel>
          <Drawer.Header>
            <Drawer.Title>Filters</Drawer.Title>
            <Drawer.Description>Narrow the issue list by owner and status.</Drawer.Description>
            <Drawer.Close>Close</Drawer.Close>
          </Drawer.Header>
          <Drawer.Body>
            <ThemeRoot portalContainer={host}>
              <Popover>
                <Popover.Trigger>Owner options</Popover.Trigger>
                <Popover.Content aria-label="Owner options">
                  <Button>Assign to me</Button>
                </Popover.Content>
              </Popover>
              <div ref={setHost} />
            </ThemeRoot>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close>Done</Drawer.Close>
          </Drawer.Footer>
        </Drawer.Panel>
      </Drawer.Content>
    </Drawer>
  );
}`,
      },
    },
  },
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

export const ContrastScopedPopover: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, Drawer, Popover, TextField, ThemeRoot } from '@jfrader/ui';

function OwnerFilters() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <ThemeRoot theme="light">
      <Drawer>
        <Drawer.Trigger>Open filters</Drawer.Trigger>
        <Drawer.Content>
          <Drawer.Panel appearance="contrast">
            <Drawer.Header>
              <Drawer.Title>Filters</Drawer.Title>
              <Drawer.Close>Close</Drawer.Close>
            </Drawer.Header>
            <Drawer.Body>
              <TextField label="Owner" />
              <ThemeRoot portalContainer={host}>
                <Popover>
                  <Popover.Trigger>Owner options</Popover.Trigger>
                  <Popover.Content aria-label="Owner options">
                    <Button>Assign to me</Button>
                  </Popover.Content>
                </Popover>
                <div ref={setHost} />
              </ThemeRoot>
            </Drawer.Body>
          </Drawer.Panel>
        </Drawer.Content>
      </Drawer>
    </ThemeRoot>
  );
}` } } },
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  render: (args) => (
    <DrawerExample
      {...args}
      body={
        <FieldStack>
          <TextField label="Owner" />
          <NestedPopoverBody />
        </FieldStack>
      }
    />
  ),
  play: async ({ canvasElement, userEvent }) => {
    const { dialog, canvas, panel, trigger } = await openDrawer({ canvasElement, userEvent });
    await userEvent.click(canvas.getByRole('button', { name: 'Owner options' }));
    const popover = await within(dialog).findByRole('dialog', { name: 'Owner options' });

    // The panel's palette crosses the portal: the overlay stays the dark family on a light page.
    await expect(popover.closest('[data-ui="theme-boundary"]')).toHaveAttribute('data-appearance', 'contrast');
    await expectContrastSurface(popover, 'light');

    // Controls inside the panel read the same palette, so their own surface comes from the panel.
    await expect(panel).toHaveAttribute('data-appearance', 'contrast');
    await expectContrastSurface(canvas.getByRole('textbox', { name: 'Owner' }), 'light');

    // The first Escape belongs to the open overlay; the panel keeps its palette while the drawer stays.
    await userEvent.keyboard('{Escape>}');
    await waitFor(() => expect(within(dialog).queryByRole('dialog', { name: 'Owner options' })).toBeNull());
    requestEscape(dialog);
    await userEvent.keyboard('{/Escape}');
    await expect(dialog).toHaveAttribute('open');
    await expectContrastSurface(panel, 'light');

    // The next Escape belongs to the drawer.
    await userEvent.keyboard('{Escape>}');
    requestEscape(dialog);
    await userEvent.keyboard('{/Escape}');
    await expectClosed(canvasElement, trigger);
  },
};

function NestedSelectBody() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const labelId = useId();
  return (
    <FieldStack>
      <TextField label="Owner" />
      <ThemeRoot portalContainer={host}>
        <FieldLabel id={labelId} >
          Status
        </FieldLabel>
        <Select>
          <Select.Trigger aria-labelledby={labelId}>
            <Select.Value placeholder="Choose a status" />
          </Select.Trigger>
          <Select.Content>
            {STATUSES.map((status) => (
              <Select.Item key={status} value={status}>
                {status}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
        <div ref={setHost} />
      </ThemeRoot>
    </FieldStack>
  );
}
NestedSelectBody.displayName = 'NestedSelectBody';

export const ContrastSelectPanel: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useId, useState } from 'react';
import { Drawer, Select, TextField, ThemeRoot } from '@jfrader/ui';

function StatusFilters() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const labelId = useId();
  return (
    <ThemeRoot theme="light">
      <Drawer>
        <Drawer.Trigger>Open filters</Drawer.Trigger>
        <Drawer.Content>
          <Drawer.Panel appearance="contrast">
            <Drawer.Header>
              <Drawer.Title>Filters</Drawer.Title>
              <Drawer.Close>Close</Drawer.Close>
            </Drawer.Header>
            <Drawer.Body>
              <TextField label="Owner" />
              <ThemeRoot portalContainer={host}>
                <span id={labelId}>Status</span>
                <Select>
                  <Select.Trigger aria-labelledby={labelId}>
                    <Select.Value placeholder="Choose a status" />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="backlog">Backlog</Select.Item>
                    <Select.Item value="in-progress">In progress</Select.Item>
                    <Select.Item value="done">Done</Select.Item>
                  </Select.Content>
                </Select>
                <div ref={setHost} />
              </ThemeRoot>
            </Drawer.Body>
          </Drawer.Panel>
        </Drawer.Content>
      </Drawer>
    </ThemeRoot>
  );
}` } } },
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  render: (args) => <DrawerExample {...args} body={<NestedSelectBody />} />,
  play: async ({ canvasElement, userEvent }) => {
    const { dialog, canvas, panel, trigger } = await openDrawer({ canvasElement, userEvent });
    await userEvent.click(canvas.getByRole('combobox', { name: 'Status' }));
    const listbox = await within(dialog).findByRole('listbox', { name: 'Status' });

    // The open select keeps the panel palette: boundary, popup and panel agree on a light page.
    await expect(listbox.closest('[data-ui="theme-boundary"]')).toHaveAttribute('data-appearance', 'contrast');
    await expectContrastSurface(listbox, 'light');
    await expectContrastSurface(panel, 'light');
    await expectContrastSurface(canvas.getByRole('textbox', { name: 'Owner' }), 'light');

    // The first Escape belongs to the open select; the drawer stays open on the same palette.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(dialog).queryByRole('listbox')).toBeNull());
    await expect(dialog).toHaveAttribute('open');
    await expectContrastSurface(panel, 'light');

    // The second belongs to the drawer, even though the select keeps its popup mounted (GURI-2293).
    await userEvent.keyboard('{Escape>}');
    requestEscape(dialog);
    await userEvent.keyboard('{/Escape}');
    await expectClosed(canvasElement, trigger);
  },
};

export const SelectEscape: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useId, useState } from 'react';
import { Drawer, Select, ThemeRoot } from '@jfrader/ui';

function StatusFilters() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const labelId = useId();
  return (
    <Drawer>
      <Drawer.Trigger>Open filters</Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Panel>
          <Drawer.Header>
            <Drawer.Title>Filters</Drawer.Title>
            <Drawer.Close>Close</Drawer.Close>
          </Drawer.Header>
          <Drawer.Body>
            <ThemeRoot portalContainer={host}>
              <span id={labelId}>Status</span>
              <Select>
                <Select.Trigger aria-labelledby={labelId}>
                  <Select.Value placeholder="Choose a status" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="backlog">Backlog</Select.Item>
                  <Select.Item value="in-progress">In progress</Select.Item>
                  <Select.Item value="done">Done</Select.Item>
                </Select.Content>
              </Select>
              <div ref={setHost} />
            </ThemeRoot>
          </Drawer.Body>
        </Drawer.Panel>
      </Drawer.Content>
    </Drawer>
  );
}` } } },
  render: (args) => <DrawerExample {...args} body={<NestedSelectBody />} />,
  play: async ({ canvasElement, userEvent }) => {
    const { dialog, canvas, trigger } = await openDrawer({ canvasElement, userEvent });
    await expect(rect(canvas.getByRole('combobox', { name: 'Status' })).height).toBeGreaterThanOrEqual(32);

    // With the select closed, Escape is the drawer's: its mounted-but-hidden popup is not a layer.
    await userEvent.keyboard('{Escape>}');
    requestEscape(dialog);
    await userEvent.keyboard('{/Escape}');
    await expectClosed(canvasElement, trigger);

    // With the select open, that Escape belongs to the select and the drawer stays.
    const reopened = await openDrawer({ canvasElement, userEvent });
    await userEvent.click(canvas.getByRole('combobox', { name: 'Status' }));
    await within(reopened.dialog).findByRole('listbox', { name: 'Status' });
    await userEvent.keyboard('{Escape>}');
    requestEscape(reopened.dialog);
    await userEvent.keyboard('{/Escape}');
    await waitFor(() => expect(within(reopened.dialog).queryByRole('listbox')).toBeNull());
    await expect(reopened.dialog).toHaveAttribute('open');

    // The next Escape closes the drawer.
    await userEvent.keyboard('{Escape>}');
    requestEscape(reopened.dialog);
    await userEvent.keyboard('{/Escape}');
    await expectClosed(canvasElement, reopened.trigger);
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
  name: 'Nested dialog',
  parameters: {
    docs: {
      description: {
        story: 'Open a secondary confirmation dialog from inside the drawer.',
      },
      source: {
        language: 'tsx',
        code: `import { Dialog, Drawer } from '@jfrader/ui';

<Drawer>
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Description>Narrow the issue list by owner and status.</Drawer.Description>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body>
        <Dialog>
          <Dialog.Trigger>Confirm reset</Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>Reset filters</Dialog.Title>
            <Dialog.Close>Cancel</Dialog.Close>
          </Dialog.Content>
        </Dialog>
      </Drawer.Body>
      <Drawer.Footer>
        <Drawer.Close>Done</Drawer.Close>
      </Drawer.Footer>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>`,
      },
    },
  },
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
  parameters: { docs: { source: { language: 'tsx', code: `import { Drawer, TextField } from '@jfrader/ui';

<div dir="rtl">
  <Drawer side="inline-end" draggable>
    <Drawer.Trigger>Open filters</Drawer.Trigger>
    <Drawer.Content>
      <Drawer.Panel>
        <Drawer.Header>
          <Drawer.Title>Filters</Drawer.Title>
          <Drawer.Close>Close</Drawer.Close>
        </Drawer.Header>
        <Drawer.Body><TextField label="Owner" /></Drawer.Body>
      </Drawer.Panel>
    </Drawer.Content>
  </Drawer>
</div>` } } },
  render: (args) => (
    <div dir="rtl">
      <DrawerExample {...args} />
    </div>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const { dialog, panel } = parts(canvasElement);
    const trigger = within(canvasElement).getByRole('button', { name: TRIGGER });
    await userEvent.click(trigger);
    // Inline-end follows the effective direction: the panel enters past the left edge.
    await expect(Number.parseFloat(panel.style.translate)).toBeLessThan(0);
    await settle(dialog);
    const { header } = parts(canvasElement);
    await expect(rect(panel).left).toBeCloseTo(rect(dialog).left, 0);
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
  // Excluded from the docs page (see above); the description records why.
  tags: ['!autodocs'],
  parameters: {
    docs: {
      description: {
        story:
          'Reduced motion removes sliding and header dragging. This test mocks `matchMedia`; check rendering with browser media emulation.',
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    const { dialog, panel, header } = parts(canvasElement);
    await settle(dialog);
    await expect(findConditionalStyle(header, 'prefers-reduced-motion: reduce', 'cursor')).toBe('auto');
    // The marker follows the prop alone, so server and client markup match.
    await expect(header).toHaveAttribute('data-draggable');

    const win = header.ownerDocument.defaultView!;
    const realMatchMedia = win.matchMedia.bind(win);
    const init = { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0 } as const;
    const start = rect(header).left + 8;
    const y = rect(header).top + 4;
    for (const [reduce, translate] of [
      [true, ''],
      [false, '40px'],
    ] as const) {
      const matchMedia = spyOn(win, 'matchMedia').mockImplementation((query) =>
        query === REDUCED_MOTION_QUERY
          ? Object.defineProperty(realMatchMedia(query), 'matches', { value: reduce })
          : realMatchMedia(query),
      );
      try {
        fireEvent.pointerDown(header, { ...init, clientX: start, clientY: y });
        await expect(matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);
        await expect(header.hasAttribute('data-dragging')).toBe(!reduce);
        fireEvent.pointerMove(header, { ...init, clientX: start + 20, clientY: y });
        fireEvent.pointerMove(header, { ...init, clientX: start + 40, clientY: y });
        await expect(panel.style.translate).toBe(translate);
        fireEvent.pointerCancel(header, { ...init, clientX: start + 40, clientY: y });
        await expectHome(panel);
        await expect(dialog).toHaveAttribute('open');
      } finally {
        matchMedia.mockRestore();
      }
    }

    // Reduced: the close is not retained for an exit and the reopen starts at rest.
    const reduced = spyOn(win, 'matchMedia').mockImplementation((query) =>
      query === REDUCED_MOTION_QUERY
        ? Object.defineProperty(realMatchMedia(query), 'matches', { value: true })
        : realMatchMedia(query),
    );
    try {
      await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
      await expect(dialog).not.toHaveAttribute('open');
      await userEvent.click(within(canvasElement).getByRole('button', { name: TRIGGER }));
      await expect(dialog).toHaveAttribute('open');
      await expect(panel.style.translate).toBe('');
      await expect(dialog.style.getPropertyValue('--drawer-presence')).toBe('');
    } finally {
      reduced.mockRestore();
    }
  },
};

export const ForcedColors: Story = {
  args: { defaultOpen: true },
  render: (args) => <DrawerExample {...args} />,
  // Excluded from the docs page (see above); the description records why.
  tags: ['!autodocs'],
  parameters: {
    docs: {
      description: {
        story:
          'Forced colors replaces the shadow with a system-color border. The test checks CSS rules without emulating forced colors.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const { dialog, panel } = parts(canvasElement);
    await settle(dialog);
    await expect(findConditionalStyle(panel, 'forced-colors: active', 'box-shadow')).toBe('none');
    await expect(findConditionalStyle(panel, 'forced-colors: active', 'border-color')?.toLowerCase()).toBe('canvastext');
  },
};

export const PartStyling: Story = {
  // Excluded from the docs page: its open modal would cover (or iframe-fragment) the docs preview.
  tags: ['!autodocs'],
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
    await expect(rect(dialog).left).toBeGreaterThanOrEqual(0);
    await expect(rect(dialog).right).toBeLessThanOrEqual(dialog.ownerDocument.documentElement.clientWidth);
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

export const AdapterDrag: Story = {
  ...Draggable,
  parameters: { docs: { source: { language: 'tsx', code: `import { Drawer, Surface, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const FilterPanel = styled(Surface)({ border: '1px dashed ' + vars.color.border });

<Drawer draggable>
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel component={FilterPanel}>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body><TextField label="Owner" /></Drawer.Body>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>` } } },
  render: (args) => <DrawerExample {...args} panelProps={{ component: DrawerPaper }} />,
};
export const AdapterRejectedDrag: Story = { ...DraggableRejected, render: (args) => <DrawerExample {...args} panelProps={{ component: DrawerPaper }} /> };
export const AdapterReducedMotion: Story = { ...ReducedMotion, render: (args) => <DrawerExample {...args} panelProps={{ component: DrawerPaper }} /> };
export const AdapterInlineStart: Story = {
  ...InlineStart,
  parameters: { docs: { source: { language: 'tsx', code: `import { Drawer, Surface, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const FilterPanel = styled(Surface)({ border: '1px dashed ' + vars.color.border });

<Drawer side="inline-start">
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel component={FilterPanel}>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body><TextField label="Owner" /></Drawer.Body>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>` } } },
  render: (args) => <DrawerExample {...args} panelProps={{ component: DrawerPaper }} />,
};
export const AdapterTop: Story = {
  ...Top,
  parameters: { docs: { source: { language: 'tsx', code: `import { Drawer, Surface, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const FilterPanel = styled(Surface)({ border: '1px dashed ' + vars.color.border });

<Drawer side="top">
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel component={FilterPanel}>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body><TextField label="Owner" /></Drawer.Body>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>` } } },
  render: (args) => <DrawerExample {...args} panelProps={{ component: DrawerPaper }} />,
};
export const AdapterBottom: Story = {
  ...Bottom,
  parameters: { docs: { source: { language: 'tsx', code: `import { Drawer, Surface, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const FilterPanel = styled(Surface)({ border: '1px dashed ' + vars.color.border });

<Drawer side="bottom">
  <Drawer.Trigger>Open filters</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Panel component={FilterPanel}>
      <Drawer.Header>
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Close>Close</Drawer.Close>
      </Drawer.Header>
      <Drawer.Body><TextField label="Owner" /></Drawer.Body>
    </Drawer.Panel>
  </Drawer.Content>
</Drawer>` } } },
  render: (args) => <DrawerExample {...args} panelProps={{ component: DrawerPaper }} />,
};
