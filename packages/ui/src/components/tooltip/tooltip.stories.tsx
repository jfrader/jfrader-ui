import type { ComponentPropsWithRef, CSSProperties } from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { Button } from '../button';
import { Tooltip, type TooltipCompoundProps as TooltipProps, type TooltipEasyProps } from './index';

const TRIGGER = 'Copy';
const TIP = 'Copy to clipboard';

const rowStyle = {
  display: 'flex',
  gap: vars.space[3],
} satisfies CSSProperties;

const meta: Meta<TooltipProps> = {
  title: 'Surfaces/Tooltip',
  component: Tooltip,
  parameters: {
    docs: {
      description: { component: 'Show help when someone hovers over or focuses a control.' },
      usage: `### Composition
- Pass \`triggerLabel\` and \`content\` for a generated button and tooltip. For custom anatomy, use \`Tooltip.Trigger\` and \`Tooltip.Content\` as \`children\` instead; do not combine the two modes.
- Keep content non-interactive: the tooltip has no tab stop. If you need a link, button or input in the popup, use \`Popover\` instead.

### Opening
- The tooltip starts closed. Use \`defaultOpen\` to start open, or pair \`open\` with \`onOpenChange\` and update \`open\` to accept requests.
- Hover opens after \`openDelay\`, which defaults to 300 milliseconds. Focus opens immediately. Leaving both the trigger and content closes after \`closeDelay\`, which defaults to 100 milliseconds; you can move the pointer onto the content to keep reading.
- Press Escape to close without moving focus. Moving focus away from the trigger also closes it.

### Customization
- \`placement\` defaults to \`top\`. Set it to choose the preferred side of the trigger.
- In generated mode, use \`slotProps\` for trigger and content props and \`slots\` to replace their button and div roots. Declare replacements outside render and forward every received prop and ref to the matching element.
- While open, the tooltip's description joins any \`aria-describedby\` you supply on the trigger. Keep the trigger's accessible name about its action.`,
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

type CheckedTooltip<Props extends import('./index').TooltipProps> = Props;
export type TooltipTypeRegression = {
  // @ts-expect-error The non-DOM provider root has no component sugar.
  providerComponent: TooltipEasyProps['component'];
  // @ts-expect-error Replace the native content or trigger, not the provider root.
  providerRootSlot: NonNullable<TooltipEasyProps['slots']>['root'];
  // @ts-expect-error The provider has no root element to receive native props.
  providerRootProps: NonNullable<TooltipEasyProps['slotProps']>['root'];
  // @ts-expect-error Easy help and compound children are mutually exclusive.
  mixed: CheckedTooltip<{ triggerLabel: string; content: string; children: string }>;
  // @ts-expect-error Easy mode needs both its trigger label and help text.
  incomplete: CheckedTooltip<{ triggerLabel: string }>;
  // @ts-expect-error Compound mode rejects generated-part props.
  compoundSlots: CheckedTooltip<{ children: string; slotProps: { trigger: { disabled: true } } }>;
};

function EasyControlledTooltip(props: TooltipEasyProps) {
  const [open, setOpen] = useState(false);
  return <Tooltip {...props} open={open} onOpenChange={(next) => { setOpen(next); props.onOpenChange?.(next); }} />;
}
EasyControlledTooltip.displayName = 'EasyControlledTooltip';

function TooltipButtonRoot(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} data-generated-trigger="" />;
}
TooltipButtonRoot.displayName = 'TooltipButtonRoot';

function TooltipHelpRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-generated-help="" />;
}
TooltipHelpRoot.displayName = 'TooltipHelpRoot';

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

export const Default: StoryObj<TooltipEasyProps> = {
  args: { triggerLabel: TRIGGER, content: TIP },
  render: (args) => <Tooltip {...args} />,
  parameters: { docs: { source: { language: 'tsx', code: '<Tooltip triggerLabel="Copy" content="Copy to clipboard" />' } } },
  play: async ({ canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.tab();
    const tooltip = await bodyOf(canvasElement).findByRole('tooltip');
    await expect(trigger).toHaveAccessibleDescription(TIP);
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};

/** Assemble the trigger and help text for a custom layout. */
export const Compound: Story = {
  render: (args) => <TooltipExample {...args} />,
  parameters: { docs: { source: { language: 'tsx', code: `<Tooltip>
  <Tooltip.Trigger>Copy</Tooltip.Trigger>
  <Tooltip.Content>Copy to clipboard</Tooltip.Content>
</Tooltip>` } } },
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

/** Set props on the generated button and tooltip. */
export const CustomParts: StoryObj<TooltipEasyProps> = {
  args: {
    triggerLabel: TRIGGER,
    content: TIP,
    slots: { trigger: TooltipButtonRoot, content: TooltipHelpRoot },
    slotProps: { trigger: { className: 'copy-trigger', ref: fn() }, content: { className: 'copy-help', ref: fn(), css: { padding: vars.space[4] }, sx: { padding: vars.space[3] } } },
  },
  render: (args) => <Tooltip {...args} />,
  parameters: { docs: { source: { code: `<Tooltip triggerLabel="Copy" content="Copy to clipboard"
  slotProps={{ content: { className: 'copy-help' } }} />` } } },
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await expect(trigger).toHaveClass('copy-trigger');
    await expect(trigger).toHaveAttribute('data-generated-trigger');
    await expect(args.slotProps?.trigger?.ref).toHaveBeenLastCalledWith(trigger);
    await userEvent.hover(trigger);
    const tooltip = await bodyOf(canvasElement).findByRole('tooltip');
    await expect(tooltip).toHaveClass('copy-help');
    await expect(tooltip).toHaveAttribute('data-generated-help');
    await expect(args.slotProps?.content?.ref).toHaveBeenLastCalledWith(tooltip);
    await expect(getComputedStyle(tooltip).paddingBlockStart).toBe(getComputedStyle(tooltip).getPropertyValue('--ui-space-3').trim());
    await userEvent.unhover(trigger);
    await expectClosed(canvasElement);
  },
};

export const EasyDisabled: StoryObj<TooltipEasyProps> = {
  args: { triggerLabel: TRIGGER, content: TIP, slotProps: { trigger: { disabled: true } } },
  render: (args) => <Tooltip {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    await expect(getTrigger(canvasElement)).toBeDisabled();
    await userEvent.tab();
    await expect(bodyOf(canvasElement).queryByRole('tooltip')).toBeNull();
  },
};

export const EasyControlled: StoryObj<TooltipEasyProps> = {
  args: { triggerLabel: TRIGGER, content: TIP, onOpenChange: fn() },
  render: (args) => <EasyControlledTooltip {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    await userEvent.tab();
    await bodyOf(canvasElement).findByRole('tooltip');
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

export const Open: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => <TooltipExample {...args} />,
  play: async ({ canvasElement }) => {
    // Persistent open state so the axe gate sees the portaled tooltip.
    const tooltip = await bodyOf(canvasElement).findByRole('tooltip');
    await expect(getTrigger(canvasElement)).toHaveAttribute('aria-describedby', tooltip.id);
  },
};

export const RTL: Story = {
  tags: ['!autodocs'],
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
  tags: ['!autodocs'],
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
  tags: ['!autodocs'],
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
