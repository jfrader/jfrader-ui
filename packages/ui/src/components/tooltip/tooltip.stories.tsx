import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { Button } from '../button';
import { Tooltip, type TooltipProps } from './index';

const TRIGGER = 'Copy';
const TIP = 'Copy to clipboard';

const rowStyle = {
  display: 'flex',
  gap: vars.space[3],
} satisfies CSSProperties;

const meta = {
  title: 'Surfaces/Tooltip',
  component: Tooltip,
} satisfies Meta<typeof Tooltip>;

export default meta;

type Story = StoryObj<typeof meta>;

function TooltipExample(props: TooltipProps) {
  return (
    <div style={rowStyle}>
      <Tooltip {...props}>
        <Tooltip.Trigger>{TRIGGER}</Tooltip.Trigger>
        <Tooltip.Content>{TIP}</Tooltip.Content>
      </Tooltip>
      <Button>Next</Button>
    </div>
  );
}
TooltipExample.displayName = 'TooltipExample';

function ControlledTooltip(props: TooltipProps) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipExample
      {...props}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        props.onOpenChange?.(next);
      }}
    />
  );
}
ControlledTooltip.displayName = 'ControlledTooltip';

/** Portaled content lives in the story document's body, outside the canvas. */
function bodyOf(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}

function getTrigger(canvasElement: HTMLElement) {
  return within(canvasElement).getByRole('button', { name: TRIGGER });
}

async function expectClosed(canvasElement: HTMLElement) {
  await waitFor(() => expect(bodyOf(canvasElement).queryByRole('tooltip')).toBeNull());
  await expect(getTrigger(canvasElement)).not.toHaveAttribute('aria-describedby');
}

async function tabToOpen(canvasElement: HTMLElement) {
  const trigger = getTrigger(canvasElement);
  await userEvent.tab();
  await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
  const tooltip = await bodyOf(canvasElement).findByRole('tooltip');
  return { trigger, tooltip };
}

export const Default: Story = {
  render: (args) => <TooltipExample {...args} />,
  play: async ({ canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.hover(trigger);
    // The open delay applies to hover: nothing is shown immediately.
    await expect(bodyOf(canvasElement).queryByRole('tooltip')).toBeNull();

    const tooltip = await bodyOf(canvasElement).findByRole('tooltip');
    await expect(tooltip).toHaveTextContent(TIP);
    await expect(canvasElement.contains(tooltip)).toBe(false);
    await expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
    await expect(trigger).toHaveAccessibleDescription(TIP);
    // Never focusable; hoverable per WCAG 1.4.13 (no pointer-events: none).
    await expect(tooltip).not.toHaveAttribute('tabindex');

    // The pointer may rest on the tooltip without it disappearing.
    await userEvent.hover(tooltip);
    await new Promise((resolve) => setTimeout(resolve, 250));
    await expect(tooltip).toBeVisible();

    await userEvent.unhover(tooltip);
    await userEvent.unhover(trigger);
    await expectClosed(canvasElement);
  },
};

export const Open: Story = {
  args: { defaultOpen: true },
  render: (args) => <TooltipExample {...args} />,
  play: async ({ canvasElement }) => {
    // Persistent open state so the axe gate sees the portaled tooltip.
    const tooltip = await bodyOf(canvasElement).findByRole('tooltip');
    await expect(getTrigger(canvasElement)).toHaveAttribute('aria-describedby', tooltip.id);
  },
};

export const RTL: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <div dir="rtl">
      <TooltipExample {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const tooltip = await bodyOf(canvasElement).findByRole('tooltip');
    await expect(getComputedStyle(tooltip).direction).toBe('rtl');
  },
};

export const LongContent: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <Tooltip {...args}>
      <Tooltip.Trigger>{TRIGGER}</Tooltip.Trigger>
      <Tooltip.Content>{'clipboard'.repeat(40)}</Tooltip.Content>
    </Tooltip>
  ),
  play: async ({ canvasElement }) => {
    const tooltip = await bodyOf(canvasElement).findByRole('tooltip');
    await expect(tooltip.scrollWidth).toBeLessThanOrEqual(tooltip.clientWidth);
  },
};

export const FocusOpens: Story = {
  render: (args) => <TooltipExample {...args} />,
  play: async ({ canvasElement }) => {
    const { trigger, tooltip } = await tabToOpen(canvasElement);
    await expect(getComputedStyle(trigger).outlineStyle).not.toBe('none');
    await expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id);

    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      within(canvasElement).getByRole('button', { name: 'Next' }),
    );
    await expectClosed(canvasElement);
  },
};

export const ExternalAria: Story = {
  render: (args) => (
    <div style={rowStyle}>
      <Tooltip {...args}>
        <Tooltip.Trigger aria-describedby="external-hint">{TRIGGER}</Tooltip.Trigger>
        <Tooltip.Content>{TIP}</Tooltip.Content>
      </Tooltip>
      <span id="external-hint">Formatted copy is also available</span>
      <Button>Next</Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { trigger, tooltip } = await tabToOpen(canvasElement);
    // While open: consumer ids and the tooltip id are merged.
    const describedBy = trigger.getAttribute('aria-describedby') ?? '';
    await expect(describedBy).toContain('external-hint');
    await expect(describedBy).toContain(tooltip.id);

    await userEvent.keyboard('{Escape}');
    // After close: the consumer's description survives on its own.
    await waitFor(() => expect(bodyOf(canvasElement).queryByRole('tooltip')).toBeNull());
    await expect(trigger).toHaveAttribute('aria-describedby', 'external-hint');
  },
};

export const Escape: Story = {
  render: (args) => <TooltipExample {...args} />,
  play: async ({ canvasElement }) => {
    const { trigger } = await tabToOpen(canvasElement);
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
  },
};

export const Controlled: Story = {
  args: { onOpenChange: fn() },
  render: (args) => <ControlledTooltip {...args} />,
  play: async ({ args, canvasElement }) => {
    await tabToOpen(canvasElement);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

export const LightThemeOpen: Story = {
  decorators: [withLightTheme],
  args: { defaultOpen: true },
  render: (args) => <TooltipExample {...args} />,
  play: async ({ canvasElement }) => {
    const tooltip = await bodyOf(canvasElement).findByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expect(canvasElement.contains(tooltip)).toBe(false);
    await expectThemedSurface(tooltip, 'light', vars.color.bgSoft);
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  render: (args) => <TooltipExample {...args} />,
  play: async ({ canvasElement }) => {
    const { tooltip } = await tabToOpen(canvasElement);
    await expect(tooltip).toBeVisible();
    await expectThemedSurface(tooltip, 'light', vars.color.bgSoft);
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};
