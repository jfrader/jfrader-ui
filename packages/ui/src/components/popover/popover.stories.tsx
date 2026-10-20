import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within, type Mock } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { Button } from '../button';
import { Popover, type PopoverCompoundProps as PopoverProps, type PopoverEasyProps } from './index';

// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const TRIGGER = 'Share';
const HEADING = 'Share link';
const AFTER = 'After popover';
const OUTSIDE = 'Outside target';

const Heading = styled.h2({
  margin: 0,
  marginBlockEnd: vars.space[3],
  fontSize: vars.textSize.md,
  fontWeight: vars.fontWeight.semibold,
});

const LinkText = styled.p({ margin: 0, marginBlockEnd: vars.space[3] });

function ShareLink() {
  return (
    <>
      <LinkText>ui.jfrader.com/s/q3-roadmap</LinkText>
      <Button size="sm">Copy link</Button>
    </>
  );
}

const Actions = styled.div({
  display: 'flex',
  gap: vars.space[2],
});

const Row = styled.div({
  display: 'flex',
  gap: vars.space[3],
  alignItems: 'center',
});

const shareActionsSource = `import { useId } from 'react';
import { Button, Popover, styled, theme } from '@jfrader/ui';

const Heading = styled.h2({ margin: 0, marginBlockEnd: theme.space[3], fontSize: theme.textSize.md, fontWeight: theme.fontWeight.semibold });
const Actions = styled.div({ display: 'flex', gap: theme.space[2] });

function ShareActions() {
  const headingId = useId();
  return (
    <Popover>
      <Popover.Trigger>Share</Popover.Trigger>
      <Popover.Content aria-labelledby={headingId}>
        <Heading id={headingId}>Share link</Heading>
        <Actions>
          <Button size="sm">Copy link</Button>
          <Button size="sm">Email link</Button>
        </Actions>
      </Popover.Content>
    </Popover>
  );
}`;

const meta: Meta<PopoverProps> = {
  title: 'Surfaces/Popover',
  component: Popover,
  parameters: {
    docs: {
      description: { component: 'Open a panel beside a button without blocking the rest of the page.' },
      sections: [
        { title: 'Basic', stories: ['Default', 'Compound'] },
        { title: 'Composition', stories: ['CustomParts', 'Controlled'] },
        { title: 'Interaction', stories: ['EasyDisabled', 'EscapeReturnFocus', 'KeyboardEntry', 'OutsideClick', 'NestedEscapeFromChild'] },
      ],
      usage: `### When to use
Show related information or actions beside a button while keeping the rest of the page available. Use a modal dialog when the task must block the page.

### Keyboard and accessibility

Give the panel an accessible name, preferably from a visible heading. Enter or Space toggles it; Escape and outside press request closure. Opening does not move focus. Tab follows page order through the panel and out without closing it or trapping focus.

Escape returns focus to the trigger only after an accepted close. Outside press closes without moving focus to the trigger. Nested layers handle Escape and outside press before their parent.`,
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

type CheckedPopover<Props extends import('./index').PopoverProps> = Props;
export type PopoverTypeRegression = {
  providerComponent: PopoverEasyProps['component'];
  providerRootSlot: NonNullable<PopoverEasyProps['slots']>['root'];
  providerRootProps: NonNullable<PopoverEasyProps['slotProps']>['root'];
  // @ts-expect-error Easy presentation and compound children are mutually exclusive.
  mixed: CheckedPopover<{ triggerLabel: string; label: string; content: string; children: string }>;
  // @ts-expect-error Easy mode requires a dialog name.
  unnamed: CheckedPopover<{ triggerLabel: string; content: string }>;
  // @ts-expect-error Compound mode rejects generated-part props.
  compoundSlots: CheckedPopover<{ children: string; slotProps: { trigger: { disabled: true } } }>;
};

function EasyControlledPopover(props: PopoverEasyProps) {
  const [open, setOpen] = useState(false);
  return <Popover {...props} open={open} onOpenChange={(next) => { setOpen(next); props.onOpenChange?.(next); }} />;
}
EasyControlledPopover.displayName = 'EasyControlledPopover';

function PopoverButtonRoot(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} data-generated-trigger="" />;
}
PopoverButtonRoot.displayName = 'PopoverButtonRoot';

function PopoverPanelRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-generated-panel="" />;
}
PopoverPanelRoot.displayName = 'PopoverPanelRoot';

function PopoverBody({ labelledBy }: { labelledBy: string }) {
  return (
    <>
      <Heading id={labelledBy}>
        {HEADING}
      </Heading>
      <Actions>
        <Button size="sm">Copy link</Button>
        <Button size="sm">Email link</Button>
      </Actions>
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
    <Row>
      <Popover {...props}>
        <Popover.Trigger>{TRIGGER}</Popover.Trigger>
        <Popover.Content aria-labelledby={headingId}>
          <PopoverBody labelledBy={headingId} />
        </Popover.Content>
      </Popover>
      <Button>{AFTER}</Button>
    </Row>
  );
}
PopoverWithAfter.displayName = 'PopoverWithAfter';

function PopoverWithOutside(props: PopoverProps) {
  const headingId = useId();
  return (
    <Row>
      <Popover {...props}>
        <Popover.Trigger>{TRIGGER}</Popover.Trigger>
        <Popover.Content aria-labelledby={headingId}>
          <PopoverBody labelledBy={headingId} />
        </Popover.Content>
      </Popover>
      <Button>{OUTSIDE}</Button>
    </Row>
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

export const Default: StoryObj<(props: PopoverEasyProps) => ReactNode> = {
  name: 'Share a link',
  args: { triggerLabel: TRIGGER, label: HEADING, content: <ShareLink /> },
  render: (args) => <Popover {...args} />,
  parameters: { docs: {
    description: { story: 'Open a named panel with a link and a copy action.' },
    source: { language: 'tsx', code: `import { Button, Popover, styled, theme } from '@jfrader/ui';

const LinkText = styled.p({ margin: 0, marginBlockEnd: theme.space[3] });

<Popover
  triggerLabel="Share"
  label="Share link"
  content={
    <>
      <LinkText>ui.jfrader.com/s/q3-roadmap</LinkText>
      <Button size="sm">Copy link</Button>
    </>
  }
/>` } } },
  play: async ({ canvasElement, userEvent }) => {
    const trigger = within(canvasElement).getByRole('button', { name: TRIGGER });
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    const dialog = await bodyOf(canvasElement).findByRole('dialog', { name: HEADING });
    await expect(trigger).toHaveAttribute('aria-controls', dialog.id);
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(within(dialog).getByRole('button', { name: 'Copy link' }));
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement, trigger);
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
  },
};

/** Assemble a trigger and panel with a visible heading. */
export const Compound: Story = {
  name: 'Trigger and panel',
  render: (args) => <PopoverExample {...args} />,
  parameters: { docs: {
    description: { story: 'Name the panel from its visible heading and group the copy and email actions.' },
    source: { language: 'tsx', code: shareActionsSource } } },
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

/** Set props on the generated trigger and panel. */
export const CustomParts: StoryObj<(props: PopoverEasyProps) => ReactNode> = {
  name: 'Custom trigger and panel',
  args: {
    triggerLabel: TRIGGER, label: HEADING, content: <Button size="sm">Copy link</Button>,
    slots: { trigger: PopoverButtonRoot, content: PopoverPanelRoot },
    slotProps: { trigger: { className: 'share-trigger', ref: fn() }, content: { className: 'share-panel', ref: fn(), sx: { padding: vars.space[6] } } },
  },
  render: (args) => <Popover {...args} />,
  parameters: { docs: {
    description: { story: 'Replace the generated button and panel while adding classes and panel spacing.' },
    source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { Button, Popover, theme } from '@jfrader/ui';

function ShareTrigger(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} data-generated-trigger="" />;
}
function SharePanel(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-generated-panel="" />;
}

<Popover
  triggerLabel="Share"
  label="Share link"
  content={<Button size="sm">Copy link</Button>}
  slots={{ trigger: ShareTrigger, content: SharePanel }}
  slotProps={{
    trigger: { className: 'share-trigger' },
    content: { className: 'share-panel', sx: { padding: theme.space[6] } },
  }}
/>` } } },
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = within(canvasElement).getByRole('button', { name: TRIGGER });
    await expect(trigger).toHaveClass('share-trigger');
    await expect(trigger).toHaveAttribute('data-generated-trigger');
    await expect(args.slotProps?.trigger?.ref).toHaveBeenLastCalledWith(trigger);
    await userEvent.click(trigger);
    const dialog = await bodyOf(canvasElement).findByRole('dialog', { name: HEADING });
    await expect(dialog).toHaveClass('share-panel');
    await expect(dialog).toHaveAttribute('data-generated-panel');
    await expect(args.slotProps?.content?.ref).toHaveBeenLastCalledWith(dialog);
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement, trigger);
  },
};

export const EasyDisabled: StoryObj<(props: PopoverEasyProps) => ReactNode> = {
  name: 'Disabled trigger',
  parameters: { docs: {
    description: { story: 'A disabled Share button cannot open the panel.' },
    source: { language: 'tsx', code: `import { Popover } from '@jfrader/ui';

<Popover triggerLabel="Share" label="Share link" content="Options" slotProps={{ trigger: { disabled: true } }} />` },
  } },
  args: { triggerLabel: TRIGGER, label: HEADING, content: 'Options', slotProps: { trigger: { disabled: true } } },
  render: (args) => <Popover {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const trigger = within(canvasElement).getByRole('button', { name: TRIGGER });
    await expect(trigger).toBeDisabled();
    await userEvent.click(trigger);
    await expect(bodyOf(canvasElement).queryByRole('dialog')).toBeNull();
  },
};

export const EasyControlled: StoryObj<(props: PopoverEasyProps) => ReactNode> = {
  args: { triggerLabel: TRIGGER, label: HEADING, content: 'Share options', onOpenChange: fn() },
  render: (args) => <EasyControlledPopover {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = within(canvasElement).getByRole('button', { name: TRIGGER });
    await userEvent.click(trigger);
    await bodyOf(canvasElement).findByRole('dialog', { name: HEADING });
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

export const Open: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => <PopoverExample {...args} />,
  play: async ({ canvasElement }) => {
    // Persistent open state so the axe gate sees the portaled content.
    const popover = await bodyOf(canvasElement).findByRole('dialog', { name: HEADING });
    await expect(popover).toBeVisible();
  },
};

export const LongContent: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <Popover {...args} defaultOpen>
      <Popover.Trigger>{TRIGGER}</Popover.Trigger>
      <Popover.Content aria-label={HEADING}>
        <Heading>{HEADING}</Heading>
        {Array.from({ length: 40 }, (_, index) => <p key={index}>Link {index + 1}</p>)}
        <Button size="sm">Copy link</Button>
      </Popover.Content>
    </Popover>
  ),
  play: async ({ canvasElement }) => {
    const popover = await bodyOf(canvasElement).findByRole('dialog', { name: HEADING });
    await waitFor(() => {
      const bounds = popover.getBoundingClientRect();
      expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.bottom).toBeLessThanOrEqual(canvasElement.ownerDocument.defaultView!.innerHeight);
    });
    await expect(getComputedStyle(popover).overflowY).toBe('auto');
    await expect(popover.scrollHeight).toBeGreaterThan(popover.clientHeight);
  },
};

export const Controlled: Story = {
  name: 'Controlled panel',
  parameters: { docs: {
    description: { story: 'Keep the panel’s open state in the parent and accept open and close requests.' },
    source: { language: 'tsx', code: `import { useId, useState } from 'react';
import { Button, Popover, styled, theme } from '@jfrader/ui';

const Heading = styled.h2({ margin: 0, marginBlockEnd: theme.space[3], fontSize: theme.textSize.md, fontWeight: theme.fontWeight.semibold });
const Actions = styled.div({ display: 'flex', gap: theme.space[2] });

function ControlledShare() {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Popover.Trigger>Share</Popover.Trigger>
      <Popover.Content aria-labelledby={headingId}>
        <Heading id={headingId}>Share link</Heading>
        <Actions>
          <Button size="sm">Copy link</Button>
          <Button size="sm">Email link</Button>
        </Actions>
      </Popover.Content>
    </Popover>
  );
}` },
  } },
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
  name: 'Escape and focus return',
  parameters: { docs: {
    description: { story: 'Open the panel, focus Copy link, then press Escape to return to Share.' },
    source: { language: 'tsx', code: shareActionsSource },
  } },
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
  tags: ['!autodocs'],
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
  name: 'Tab through the panel',
  parameters: { docs: {
    description: { story: 'Open with Enter and Tab through both actions to After popover without closing the panel.' },
    source: { language: 'tsx', code: `import { useId } from 'react';
import { Button, Popover, styled, theme } from '@jfrader/ui';

const Row = styled.div({ display: 'flex', gap: theme.space[3], alignItems: 'center' });
const Heading = styled.h2({ margin: 0, marginBlockEnd: theme.space[3], fontSize: theme.textSize.md, fontWeight: theme.fontWeight.semibold });
const Actions = styled.div({ display: 'flex', gap: theme.space[2] });

function KeyboardShare() {
  const headingId = useId();
  return (
    <Row>
      <Popover>
        <Popover.Trigger>Share</Popover.Trigger>
        <Popover.Content aria-labelledby={headingId}>
          <Heading id={headingId}>Share link</Heading>
          <Actions>
            <Button size="sm">Copy link</Button>
            <Button size="sm">Email link</Button>
          </Actions>
        </Popover.Content>
      </Popover>
      <Button>After popover</Button>
    </Row>
  );
}` },
  } },
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
  name: 'Outside press',
  parameters: { docs: {
    description: { story: 'Click Outside target to close the panel while leaving focus on that button.' },
    source: { language: 'tsx', code: `import { useId } from 'react';
import { Button, Popover, styled, theme } from '@jfrader/ui';

const Row = styled.div({ display: 'flex', gap: theme.space[3], alignItems: 'center' });
const Heading = styled.h2({ margin: 0, marginBlockEnd: theme.space[3], fontSize: theme.textSize.md, fontWeight: theme.fontWeight.semibold });
const Actions = styled.div({ display: 'flex', gap: theme.space[2] });

function OutsideShare() {
  const headingId = useId();
  return (
    <Row>
      <Popover>
        <Popover.Trigger>Share</Popover.Trigger>
        <Popover.Content aria-labelledby={headingId}>
          <Heading id={headingId}>Share link</Heading>
          <Actions>
            <Button size="sm">Copy link</Button>
            <Button size="sm">Email link</Button>
          </Actions>
        </Popover.Content>
      </Popover>
      <Button>Outside target</Button>
    </Row>
  );
}` },
  } },
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

const outerOpenChange = fn<(open: boolean) => void>();
const innerOpenChange = fn<(open: boolean) => void>();
const callValues = (spy: unknown) => (spy as Mock).mock.calls.map(([value]) => value);

function NestedPopovers() {
  return (
    <Popover onOpenChange={outerOpenChange}>
      <Popover.Trigger>{TRIGGER}</Popover.Trigger>
      <Popover.Content aria-label={HEADING}>
        <Actions>
          <Button size="sm">Copy link</Button>
          <Popover onOpenChange={innerOpenChange}>
            <Popover.Trigger>Link settings</Popover.Trigger>
            <Popover.Content aria-label="Link settings">
              <Button size="sm">Expire link</Button>
            </Popover.Content>
          </Popover>
        </Actions>
      </Popover.Content>
    </Popover>
  );
}
NestedPopovers.displayName = 'NestedPopovers';

/** Opens the outer popover, then the inner one from its trigger inside the outer content. */
async function openNestedPopovers(canvasElement: HTMLElement) {
  outerOpenChange.mockClear();
  innerOpenChange.mockClear();
  const { trigger, popover: outer } = await openPopover(canvasElement);
  const innerTrigger = within(outer).getByRole('button', { name: 'Link settings' });
  await userEvent.click(innerTrigger);
  const inner = await bodyOf(canvasElement).findByRole('dialog', { name: 'Link settings' });
  await expect(callValues(outerOpenChange)).toEqual([true]);
  await expect(callValues(innerOpenChange)).toEqual([true]);
  return { trigger, outer, innerTrigger, inner };
}

/** First Escape closes only the inner popover; the second closes the outer one. */
async function expectEscapeClosesTopmostFirst(
  canvasElement: HTMLElement,
  { trigger, outer, innerTrigger, inner }: Awaited<ReturnType<typeof openNestedPopovers>>,
) {
  const { ownerDocument } = canvasElement;
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(inner).not.toBeInTheDocument());
  await expect(callValues(innerOpenChange)).toEqual([true, false]);
  await expect(callValues(outerOpenChange)).toEqual([true]);
  await expect(outer).toBeVisible();
  await expect(innerTrigger).toHaveAttribute('aria-expanded', 'false');
  await waitFor(() => expect(ownerDocument.activeElement).toBe(innerTrigger));

  await userEvent.keyboard('{Escape}');
  await expectClosed(canvasElement, trigger);
  await expect(callValues(outerOpenChange)).toEqual([true, false]);
  await expect(callValues(innerOpenChange)).toEqual([true, false]);
  await waitFor(() => expect(ownerDocument.activeElement).toBe(trigger));
}

export const NestedEscapeFromParent: Story = {
  render: () => <NestedPopovers />,
  play: async ({ canvasElement }) => {
    const layers = await openNestedPopovers(canvasElement);
    // Focus on a control that belongs to the outer popover only.
    const copy = within(layers.outer).getByRole('button', { name: 'Copy link' });
    await userEvent.tab({ shift: true });
    await expect(canvasElement.ownerDocument.activeElement).toBe(copy);
    await expect(layers.inner).toBeVisible();

    await expectEscapeClosesTopmostFirst(canvasElement, layers);
  },
};

export const NestedEscapeFromChild: Story = {
  name: 'Nested panels',
  parameters: { docs: {
    description: { story: 'Open Link settings inside Share; Escape closes the inner panel before the outer one.' },
    source: { language: 'tsx', code: `import { Button, Popover, styled, theme } from '@jfrader/ui';

const Actions = styled.div({ display: 'flex', gap: theme.space[2] });

<Popover>
  <Popover.Trigger>Share</Popover.Trigger>
  <Popover.Content aria-label="Share link">
    <Actions>
      <Button size="sm">Copy link</Button>
      <Popover>
        <Popover.Trigger>Link settings</Popover.Trigger>
        <Popover.Content aria-label="Link settings">
          <Button size="sm">Expire link</Button>
        </Popover.Content>
      </Popover>
    </Actions>
  </Popover.Content>
</Popover>` },
  } },
  render: () => <NestedPopovers />,
  play: async ({ canvasElement }) => {
    const layers = await openNestedPopovers(canvasElement);
    const expire = within(layers.inner).getByRole('button', { name: 'Expire link' });
    await userEvent.click(expire);
    await expect(canvasElement.ownerDocument.activeElement).toBe(expire);
    await expect(callValues(innerOpenChange)).toEqual([true]);

    await expectEscapeClosesTopmostFirst(canvasElement, layers);
  },
};
