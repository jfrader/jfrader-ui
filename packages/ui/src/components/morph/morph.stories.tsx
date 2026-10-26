import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { expectLayoutMorph, settleMotion } from '../../testing/motion-assertions';
import { Morph, type MorphRootProps } from './index';
import { Button } from '../button';
import { TextField } from '../text-field';
import { Stack } from '../stack';
import { Popover } from '../popover';
import { Dialog } from '../dialog';

const Stage = styled.div({
  minBlockSize: '30rem',
  paddingBlockStart: '24rem',
  paddingInline: vars.space[4],
  display: 'flex',
  justifyContent: 'end',
  gap: vars.space[4],
});

function Example(props: Omit<MorphRootProps, 'children'>) {
  const [step, setStep] = useState(props.defaultStep ?? 'summary');
  return (
    <Morph.Root
      {...props}
      step={props.step ?? step}
      onStepChange={(next) => {
        props.onStepChange?.(next);
        setStep(next);
      }}
    >
      <Morph.Trigger>Book a visit</Morph.Trigger>
      <Morph.Surface label="Visit" width={{ summary: '16rem', details: '18rem' }}>
        <Morph.Step id="summary" detent={0.38}>
          <Stack gap="sm">
            <Button
              onClick={() => {
                props.onStepChange?.('details');
                setStep('details');
              }}
            >
              Continue
            </Button>
          </Stack>
        </Morph.Step>
        <Morph.Step id="details" width="20rem" detent={0.68} back>
          <Stack gap="sm">
            <Button variant="ghost" onClick={() => setStep('summary')}>
              Back
            </Button>
            <TextField label="Name" data-autofocus />
            <TextField label="Email" type="email" />
          </Stack>
        </Morph.Step>
      </Morph.Surface>
    </Morph.Root>
  );
}
const meta = {
  title: 'Surfaces/Morph',
  component: Morph.Root,
  subcomponents: { Trigger: Morph.Trigger, Surface: Morph.Surface, Step: Morph.Step },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <Stage>
        <Story />
      </Stage>
    ),
  ],
  render: (args) => <Example {...args} />,
  args: { children: null, onOpenChange: fn(), onStepChange: fn() },
  parameters: {
    docs: {
      description: {
        component: 'Move between steps in a popover or bottom sheet without leaving the page.',
      },
      sections: [{ title: 'Steps and widths', stories: ['Default'] }, { title: 'Phone sheet', stories: ['Sheet'] }],
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { Morph, Button, Stack, TextField } from '@jfrader/ui';

export function Visit() {
  const [step, setStep] = useState('summary');
  return <Morph.Root step={step} onStepChange={setStep}>
    <Morph.Trigger>Book a visit</Morph.Trigger>
    <Morph.Surface label="Visit" width={{ summary: '16rem', details: '18rem' }}>
      <Morph.Step id="summary">
        <Stack gap="sm">
          <Button onClick={() => setStep('details')}>Continue</Button>
        </Stack>
      </Morph.Step>
      <Morph.Step id="details" width="20rem" back>
        <Stack gap="sm">
          <Button variant="ghost" onClick={() => setStep('summary')}>Back</Button>
          <TextField label="Name" data-autofocus />
          <TextField label="Email" type="email" />
        </Stack>
      </Morph.Step>
    </Morph.Surface>
  </Morph.Root>;
}`,
      },
      usage: `### Keyboard and accessibility
Enter or Space opens the surface. Focus moves to the active step's \`[data-autofocus]\` element, first enabled focusable element, or step container. Escape returns to the previous step when back navigation is enabled; otherwise it closes. Accepted explicit closes return focus to the trigger. Clicking or tabbing outside closes without moving focus back.

### Values and constraints
Only the active step mounts. Keep drafts in the consumer when they must survive navigation. Give each step a unique id. Width and height changes honor reduced motion. Sheet mode is modal; each step selects its detent when it becomes active. Omitted detents use the full visual viewport height.`,
    },
  },
} satisfies Meta<typeof Morph.Root>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const doc = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button', { name: 'Book a visit' });
    await userEvent.tab();
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(getComputedStyle(trigger).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    const surface = await doc.findByRole('dialog', { name: 'Visit' });
    await expect(getComputedStyle(surface).transitionProperty).toContain('scale');
    await expect(Number.parseFloat(getComputedStyle(surface).transitionDuration)).toBeGreaterThan(0);
    const next = doc.getByRole('button', { name: 'Continue' });
    await waitFor(() => expect(next.ownerDocument.activeElement).toBe(next));
    await expect(doc.queryByRole('textbox')).toBeNull();
    await settleMotion(surface);
    await expect(surface.getBoundingClientRect().width).toBeCloseTo(256, 0);
    await userEvent.click(next);
    const name = await doc.findByRole('textbox', { name: 'Name' });
    await expect(doc.getByRole('dialog', { name: 'Visit' })).toBe(surface);
    await waitFor(() => expect(name.ownerDocument.activeElement).toBe(name));
    await expect(doc.queryByRole('button', { name: 'Continue' })).toBeNull();
    await settleMotion(surface);
    await waitFor(() => expect(surface.getBoundingClientRect().width).toBeCloseTo(320, 0));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(doc.getByRole('button', { name: 'Continue' })).toHaveFocus());
    await expect(doc.queryByRole('textbox')).toBeNull();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(doc.queryByRole('dialog')).toBeNull());
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};
export const Persistent: Story = { args: { defaultOpen: true }, tags: ['!autodocs'] };
export const Sheet: Story = {
  args: { variant: 'sheet' },
  parameters: { docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { Morph, Button, Stack, TextField } from '@jfrader/ui';

export function VisitSheet() {
  const [step, setStep] = useState('actions');
  return <Morph.Root variant="sheet" step={step} onStepChange={setStep}>
    <Morph.Trigger>Book a visit</Morph.Trigger>
    <Morph.Surface label="Visit">
      <Morph.Step id="actions" detent={0.38}>
        <Stack gap="sm">
          <Button onClick={() => setStep('details')}>Continue</Button>
        </Stack>
      </Morph.Step>
      <Morph.Step id="details" detent={0.68} back>
        <Stack gap="sm">
          <Button variant="ghost" onClick={() => setStep('actions')}>Back</Button>
          <TextField label="Name" data-autofocus />
          <TextField label="Email" type="email" />
        </Stack>
      </Morph.Step>
    </Morph.Surface>
  </Morph.Root>;
}` } } },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const doc = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button', { name: 'Book a visit' });
    await userEvent.click(trigger);
    const dialog = await doc.findByRole('dialog', { name: 'Visit' });
    const panel = dialog.querySelector<HTMLElement>('[data-ui~="bottom-sheet-panel"]')!;
    const viewport = dialog.ownerDocument.defaultView!.visualViewport!.height;
    await waitFor(() => expect(panel.getBoundingClientRect().height).toBeCloseTo(viewport * 0.38, 0));
    const next = doc.getByRole('button', { name: 'Continue' });
    await waitFor(() => expect(next.ownerDocument.activeElement).toBe(next));
    await expect(doc.getAllByRole('dialog')).toHaveLength(1);
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    const handle = within(dialog).getByRole('button', { name: 'Visit' });
    await expect(handle).toHaveAttribute('aria-expanded', 'false');
    handle.focus();
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => expect(panel.getBoundingClientRect().height).toBeCloseTo(viewport * 0.68, 0));
    await expect(doc.getByRole('button', { name: 'Continue' })).toBe(next);
    await userEvent.click(next);
    const field = await doc.findByRole('textbox', { name: 'Name' });
    await waitFor(() => expect(field.ownerDocument.activeElement).toBe(field));
    if (dialog.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)').matches)
      await expect(panel.getBoundingClientRect().height).toBeCloseTo(viewport * 0.68, 0);
    await waitFor(() => expect(panel.getBoundingClientRect().height).toBeCloseTo(viewport * 0.68, 0));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(doc.getByRole('button', { name: 'Continue' })).toHaveFocus());
    await waitFor(() => expect(panel.getBoundingClientRect().height).toBeCloseTo(viewport * 0.38, 0));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    await waitFor(() => expect(trigger.ownerDocument.activeElement).toBe(trigger));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};
export const SheetPersistent: Story = { args: { variant: 'sheet', defaultOpen: true }, tags: ['!autodocs'] };
export const SheetReducedMotion: Story = {
  name: 'Sheet Reduced Motion',
  args: { variant: 'sheet' },
  play: async (context) => {
    await expect(context.canvasElement.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
    await Sheet.play!(context);
  },
};
export const HeightTransition: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    const doc = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Book a visit' }));
    const surface = await doc.findByRole('dialog', { name: 'Visit' });
    await settleMotion(surface);
    const before = surface.getBoundingClientRect().height;
    await expectLayoutMorph(
      surface,
      () => userEvent.click(doc.getByRole('button', { name: 'Continue' })),
      () => surface.querySelector<HTMLElement>('[data-step]')!,
    );
    await expect(doc.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    await expect(surface.getBoundingClientRect().height).toBeGreaterThan(before);
    await expect(surface.getBoundingClientRect().width).toBeCloseTo(320, 0);
  },
};
export const Light: Story = { globals: { theme: 'light' } };
export const RTL: Story = {
  decorators: [
    (Story) => (
      <Stage dir="rtl">
        <Story />
      </Stage>
    ),
  ],
  args: { corner: 'start' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Book a visit' }));
    const surface = await within(canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Visit',
    });
    await waitFor(() => expect(getComputedStyle(surface).direction).toBe('rtl'));
    await settleMotion(surface);
    const trigger = canvas.getByRole('button', { name: 'Book a visit' });
    await waitFor(() => expect(surface.getBoundingClientRect().right).toBeCloseTo(
      trigger.getBoundingClientRect().right,
      0,
    ));
  },
};
export const ReducedMotion: Story = {
  name: 'Morph Reduced Motion',
  play: async ({ canvas, canvasElement, userEvent }) => {
    const doc = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Book a visit' }));
    const surface = await doc.findByRole('dialog', { name: 'Visit' });
    await expect(getComputedStyle(surface).transitionDuration).toBe('0s');
    await expectLayoutMorph(
      surface,
      () => userEvent.click(doc.getByRole('button', { name: 'Continue' })),
      () => surface.querySelector<HTMLElement>('[data-step]')!,
      true,
    );
    await expect(surface.getBoundingClientRect().width).toBeCloseTo(320, 0);
    await expect(doc.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    await userEvent.keyboard('{Escape}{Escape}');
    await waitFor(() => expect(doc.queryByRole('dialog')).toBeNull());
  },
};
export const RejectedOpen: Story = {
  args: { open: false },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Book a visit' }));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledWith(true);
    await expect(within(canvasElement.ownerDocument.body).queryByRole('dialog')).toBeNull();
  },
};
export const EmptyStep: Story = {
  render: (args) => (
    <Morph.Root {...args}>
      <Morph.Trigger>Open details</Morph.Trigger>
      <Morph.Surface label="Details">
        <Morph.Step id="empty">No details yet.</Morph.Step>
      </Morph.Surface>
    </Morph.Root>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open details' }));
    const surface = await within(canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Details',
    });
    const step = surface.querySelector('[data-ui="morph-step"]');
    await waitFor(() => expect(step?.ownerDocument.activeElement).toBe(step));
    await expect(getComputedStyle(step as HTMLElement).outlineStyle).not.toBe('none');
  },
};

export const RejectedClose: Story = {
  args: { open: true },
  tags: ['!autodocs'],
  play: async ({ args, canvasElement, userEvent }) => {
    const doc = within(canvasElement.ownerDocument.body);
    const next = await doc.findByRole('button', { name: 'Continue' });
    await waitFor(() => expect(next).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    await expect(doc.getByRole('dialog', { name: 'Visit' })).not.toHaveAttribute('inert');
    await expect(next.ownerDocument.activeElement).toBe(next);
  },
};

export const RejectedBack: Story = {
  tags: ['!autodocs'],
  render: function Controlled(args) {
    const [step, setStep] = useState('first');
    return (
      <Morph.Root {...args} step={step}>
        <Morph.Trigger>Open flow</Morph.Trigger>
        <Morph.Surface label="Flow">
          <Morph.Step id="first">
            <Button onClick={() => setStep('second')}>Next</Button>
          </Morph.Step>
          <Morph.Step id="second" back>
            <TextField label="Second step" />
          </Morph.Step>
        </Morph.Surface>
      </Morph.Root>
    );
  },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const doc = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Open flow' }));
    await userEvent.click(await doc.findByRole('button', { name: 'Next' }));
    const field = await doc.findByRole('textbox', { name: 'Second step' });
    await waitFor(() => expect(field.ownerDocument.activeElement).toBe(field));
    await userEvent.keyboard('{Escape}');
    await expect(args.onStepChange).toHaveBeenCalledTimes(1);
    await expect(args.onStepChange).toHaveBeenCalledWith('first');
    await expect(field.ownerDocument.activeElement).toBe(field);
    await expect(doc.queryByRole('button', { name: 'Next' })).toBeNull();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
  },
};

export const SheetRejectedBack: Story = {
  ...RejectedBack,
  args: { variant: 'sheet' },
};
export const SheetRejectedClose: Story = {
  ...RejectedClose,
  args: { variant: 'sheet', open: true },
};
export const SheetEmptyStep: Story = {
  ...EmptyStep,
  args: { variant: 'sheet' },
};

export const SheetNestedDialog: Story = {
  tags: ['!autodocs'],
  render: function NestedSheet(args) {
    const [step, setStep] = useState('actions');
    return (
      <Morph.Root {...args} variant="sheet" step={step} onStepChange={setStep}>
        <Morph.Trigger>Open sheet</Morph.Trigger>
        <Morph.Surface label="Sheet flow">
          <Morph.Step id="actions" detent={0.38}>
            <Button onClick={() => setStep('details')}>Continue</Button>
          </Morph.Step>
          <Morph.Step id="details" detent={0.68} back>
            <Dialog triggerLabel="Open child" title="Child" closeLabel="Close"
              content={<Button>Child action</Button>} />
          </Morph.Step>
        </Morph.Surface>
      </Morph.Root>
    );
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const doc = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Open sheet' }));
    await userEvent.click(await doc.findByRole('button', { name: 'Continue' }));
    await userEvent.click(await doc.findByRole('button', { name: 'Open child' }));
    await doc.findByRole('dialog', { name: 'Child' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(doc.queryByRole('dialog', { name: 'Child' })).toBeNull());
    await expect(doc.getByRole('button', { name: 'Open child' })).toHaveFocus();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(doc.getByRole('button', { name: 'Continue' })).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(doc.queryByRole('dialog')).toBeNull());
    await expect(canvas.getByRole('button', { name: 'Open sheet' })).toHaveFocus();
  },
};

export const OutsidePress: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <>
      <Example {...args} />
      <Button>Outside action</Button>
    </>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const doc = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Book a visit' }));
    await doc.findByRole('dialog', { name: 'Visit' });
    const outside = canvas.getByRole('button', { name: 'Outside action' });
    await userEvent.click(outside);
    await waitFor(() => expect(doc.queryByRole('dialog')).toBeNull());
    await expect(outside.ownerDocument.activeElement).toBe(outside);
  },
};

export const ExternalClose: Story = {
  tags: ['!autodocs'],
  render: function Controlled(args) {
    const [open, setOpen] = useState(false);
    return (
      <Morph.Root
        {...args}
        open={open}
        onOpenChange={(next) => {
          args.onOpenChange?.(next);
          setOpen(next);
        }}
      >
        <Morph.Trigger>Open flow</Morph.Trigger>
        <Morph.Surface label="Flow">
          <Morph.Step id="first">
            <Button onClick={() => setOpen(false)}>Finish</Button>
          </Morph.Step>
        </Morph.Surface>
      </Morph.Root>
    );
  },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const doc = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button', { name: 'Open flow' });
    await userEvent.click(trigger);
    await userEvent.click(await doc.findByRole('button', { name: 'Finish' }));
    await waitFor(() => expect(doc.queryByRole('dialog')).toBeNull());
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledWith(true);
  },
};

export const TabOut: Story = {
  tags: ['!autodocs'],
  render: OutsidePress.render,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const doc = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Book a visit' }));
    const next = await doc.findByRole('button', { name: 'Continue' });
    await waitFor(() => expect(next.ownerDocument.activeElement).toBe(next));
    await userEvent.tab();
    const outside = canvas.getByRole('button', { name: 'Outside action' });
    await waitFor(() => expect(outside.ownerDocument.activeElement).toBe(outside));
    await waitFor(() => expect(doc.queryByRole('dialog')).toBeNull());
    await userEvent.tab({ shift: true });
    await expect(canvas.getByRole('button', { name: 'Book a visit' })).toHaveFocus();
  },
};

export const NestedOverlay: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <Morph.Root {...args}>
      <Morph.Trigger>Open flow</Morph.Trigger>
      <Morph.Surface label="Flow">
        <Morph.Step id="first">
          <Popover
            triggerLabel="Open child"
            label="Child"
            content={<Button>Child action</Button>}
          />
        </Morph.Step>
      </Morph.Surface>
    </Morph.Root>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const doc = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Open flow' }));
    await userEvent.click(await doc.findByRole('button', { name: 'Open child' }));
    await doc.findByRole('dialog', { name: 'Child' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(doc.queryByRole('dialog', { name: 'Child' })).toBeNull());
    await expect(doc.getByRole('dialog', { name: 'Flow' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(doc.queryByRole('dialog')).toBeNull());
    await expect(canvas.getByRole('button', { name: 'Open flow' })).toHaveFocus();
  },
};
