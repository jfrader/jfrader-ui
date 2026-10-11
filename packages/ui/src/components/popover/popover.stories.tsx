import type { CSSProperties } from 'react';
import { useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { Button } from '../button';
import { Popover, type PopoverProps } from './index';

const TRIGGER = 'Share';
const HEADING = 'Share link';
const AFTER = 'After popover';
const OUTSIDE = 'Outside target';

const headingStyle = {
  margin: 0,
  marginBlockEnd: vars.space[3],
  fontSize: vars.textSize.md,
  fontWeight: vars.fontWeight.semibold,
} satisfies CSSProperties;

const actionsStyle = {
  display: 'flex',
  gap: vars.space[2],
} satisfies CSSProperties;

const rowStyle = {
  display: 'flex',
  gap: vars.space[3],
  alignItems: 'center',
} satisfies CSSProperties;

const meta = {
  title: 'Surfaces/Popover',
  component: Popover,
} satisfies Meta<typeof Popover>;

export default meta;

type Story = StoryObj<typeof meta>;

function PopoverBody({ labelledBy }: { labelledBy: string }) {
  return (
    <>
      <h2 id={labelledBy} style={headingStyle}>
        {HEADING}
      </h2>
      <div style={actionsStyle}>
        <Button size="sm">Copy link</Button>
        <Button size="sm">Email link</Button>
      </div>
    </>
  );
}
PopoverBody.displayName = 'PopoverBody';

function PopoverExample(props: PopoverProps) {
  const headingId = useId();
  return (
    <Popover {...props}>
      <Popover.Trigger>{TRIGGER}</Popover.Trigger>
      <Popover.Content aria-labelledby={headingId}>
        <PopoverBody labelledBy={headingId} />
      </Popover.Content>
    </Popover>
  );
}
PopoverExample.displayName = 'PopoverExample';

function PopoverWithAfter(props: PopoverProps) {
  const headingId = useId();
  return (
    <div style={rowStyle}>
      <Popover {...props}>
        <Popover.Trigger>{TRIGGER}</Popover.Trigger>
        <Popover.Content aria-labelledby={headingId}>
          <PopoverBody labelledBy={headingId} />
        </Popover.Content>
      </Popover>
      <Button>{AFTER}</Button>
    </div>
  );
}
PopoverWithAfter.displayName = 'PopoverWithAfter';

function PopoverWithOutside(props: PopoverProps) {
  const headingId = useId();
  return (
    <div style={rowStyle}>
      <Popover {...props}>
        <Popover.Trigger>{TRIGGER}</Popover.Trigger>
        <Popover.Content aria-labelledby={headingId}>
          <PopoverBody labelledBy={headingId} />
        </Popover.Content>
      </Popover>
      <Button>{OUTSIDE}</Button>
    </div>
  );
}
PopoverWithOutside.displayName = 'PopoverWithOutside';

function ControlledPopover(props: PopoverProps) {
  const [open, setOpen] = useState(false);
  return (
    <PopoverExample
      {...props}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        props.onOpenChange?.(next);
      }}
    />
  );
}
ControlledPopover.displayName = 'ControlledPopover';

/** Portaled content lives in the story document's body, outside the canvas. */
function bodyOf(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}

async function openPopover(canvasElement: HTMLElement) {
  const trigger = within(canvasElement).getByRole('button', { name: TRIGGER });
  await userEvent.click(trigger);
  const popover = await bodyOf(canvasElement).findByRole('dialog', { name: HEADING });
  return { trigger, popover };
}

async function expectClosed(canvasElement: HTMLElement, trigger: HTMLElement) {
  await waitFor(() => expect(bodyOf(canvasElement).queryByRole('dialog')).toBeNull());
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
}

export const Default: Story = {
  render: (args) => <PopoverExample {...args} />,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: TRIGGER });
    await expect(bodyOf(canvasElement).queryByRole('dialog')).toBeNull();
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    const { popover } = await openPopover(canvasElement);
    await expect(canvasElement.contains(popover)).toBe(false);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(trigger).toHaveAttribute('aria-controls', popover.id);
    await expect(popover).not.toHaveAttribute('aria-modal');
    // Non-modal: opening does not move focus into the content.
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);

    await userEvent.click(trigger);
    await expectClosed(canvasElement, trigger);
  },
};

export const Open: Story = {
  args: { defaultOpen: true },
  render: (args) => <PopoverExample {...args} />,
  play: async ({ canvasElement }) => {
    // Persistent open state so the axe gate sees the portaled content.
    const popover = await bodyOf(canvasElement).findByRole('dialog', { name: HEADING });
    await expect(popover).toBeVisible();
  },
};

export const Controlled: Story = {
  args: { onOpenChange: fn() },
  render: (args) => <ControlledPopover {...args} />,
  play: async ({ args, canvasElement }) => {
    const { trigger } = await openPopover(canvasElement);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

export const EscapeReturnFocus: Story = {
  render: (args) => <PopoverExample {...args} />,
  play: async ({ canvasElement }) => {
    const { trigger, popover } = await openPopover(canvasElement);
    const copy = within(popover).getByRole('button', { name: 'Copy link' });
    await userEvent.click(copy);
    await expect(canvasElement.ownerDocument.activeElement).toBe(copy);

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement, trigger);
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(trigger));
  },
};

export const RejectedControlled: Story = {
  args: { onOpenChange: fn() },
  render: (args) => <PopoverExample {...args} open />,
  play: async ({ args, canvasElement }) => {
    const popover = await bodyOf(canvasElement).findByRole('dialog', { name: HEADING });
    const copy = within(popover).getByRole('button', { name: 'Copy link' });
    await userEvent.click(copy);

    await userEvent.keyboard('{Escape}');
    // The parent refuses: one request, the popover stays open, and focus is NOT moved.
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(popover).toBeVisible();
    await expect(canvasElement.ownerDocument.activeElement).toBe(copy);
  },
};

export const KeyboardEntry: Story = {
  render: (args) => <PopoverWithAfter {...args} />,
  play: async ({ canvasElement }) => {
    const { ownerDocument } = canvasElement;
    const trigger = within(canvasElement).getByRole('button', { name: TRIGGER });

    await userEvent.tab();
    await expect(ownerDocument.activeElement).toBe(trigger);
    await expect(getComputedStyle(trigger).outlineStyle).not.toBe('none');

    await userEvent.keyboard('{Enter}');
    const popover = await bodyOf(canvasElement).findByRole('dialog', { name: HEADING });
    // Non-modal entry: Tab order reaches the portaled content from the trigger...
    await expect(ownerDocument.activeElement).toBe(trigger);
    await userEvent.tab();
    await expect(ownerDocument.activeElement).toBe(within(popover).getByRole('button', { name: 'Copy link' }));
    await userEvent.tab();
    await expect(ownerDocument.activeElement).toBe(within(popover).getByRole('button', { name: 'Email link' }));
    // ...and continues to the following page control without closing (no trap).
    await userEvent.tab();
    await expect(ownerDocument.activeElement).toBe(within(canvasElement).getByRole('button', { name: AFTER }));
    await expect(popover).toBeVisible();
  },
};

export const OutsideClick: Story = {
  render: (args) => <PopoverWithOutside {...args} />,
  play: async ({ canvasElement }) => {
    const { ownerDocument } = canvasElement;
    const { trigger, popover } = await openPopover(canvasElement);
    await userEvent.click(within(popover).getByRole('button', { name: 'Copy link' }));

    const outside = within(canvasElement).getByRole('button', { name: OUTSIDE });
    await userEvent.click(outside);
    await expectClosed(canvasElement, trigger);
    // The click lands on its own target; the trigger is never focused.
    await expect(ownerDocument.activeElement).toBe(outside);
    await expect(trigger).not.toHaveFocus();
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  render: (args) => <PopoverExample {...args} />,
  play: async ({ canvasElement }) => {
    const { trigger, popover } = await openPopover(canvasElement);
    await expect(popover).toBeVisible();
    await expectThemedSurface(popover, 'light');
    await userEvent.click(trigger);
    await expectClosed(canvasElement, trigger);
  },
};
