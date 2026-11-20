import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../index';
import { Button } from '../button';
import { Tour, type TourProps, type TourStep } from './index';

const Frame = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: vars.space[4],
  padding: vars.space[6],
  minBlockSize: '320px',
});

const Row = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[2],
});

const tourSource = `import { useState } from 'react';
import { Button, Tour, type TourStep } from '@jfrader/ui';

const steps: TourStep[] = [
  { id: 'search', target: '#search', title: 'Find a plan', description: 'Search by name or venue.' },
  { id: 'create', target: '#create', title: 'Create a plan', description: 'Start from a template or a blank canvas.' },
  { id: 'share', target: '#share', title: 'Share', description: 'Invite the venue team.' },
];

function Onboarding() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button id="search">Search</Button>
      <Button id="create">Create</Button>
      <Button id="share">Share</Button>
      <Button onClick={() => setOpen(true)}>Start tour</Button>
      <Tour steps={steps} open={open} onOpenChange={setOpen} />
    </>
  );
}`;

const meta = {
  title: 'Feedback/Tour',
  component: Tour,
  args: { steps: [] },
  parameters: {
    docs: {
      description: { component: 'Guide a first task with a short sequence of steps anchored to the controls a reader needs.' },
      sections: [
        { title: 'Basic', stories: ['Default'] },
        { title: 'States', stories: ['MissingTarget', 'LongContent'] },
        { title: 'Interaction', stories: ['Keyboard', 'Controlled'] },
        { title: 'Theme and direction', stories: ['LightTheme', 'Rtl'] },
      ],
      usage: `### When to use
Use a tour to introduce a short sequence of controls on a page a reader is seeing for the first time. Use inline help, a checklist, or empty-state guidance when the reader needs reference material after the first pass, or when the task has more than about eight steps.

### Targets and fallbacks

Each step names a target by selector, element, or a function that returns either. The target stays interactive: outside presses do not close the tour, and Tab reaches the page controls. If a selector target never appears within \`targetTimeout\`, the panel centers in the viewport and \`onTargetMissing\` fires once for that step. Set \`fallback="hide"\` to render nothing instead.

### Keyboard and accessibility

The panel is a non-modal dialog named by the step title. Escape closes it unless \`closeOnEscape\` is false. Focus moves to the step title when a step opens; set \`autoFocus={false}\` to leave focus where it was. Closing returns focus to the step target, or to the element that was focused when the tour opened. A polite live region announces the step and its title.`,
    },
  },
} satisfies Meta<typeof Tour>;

export default meta;

type Story = StoryObj<typeof meta>;

function Targets({ id }: { id: string }) {
  return (
    <Row>
      <Button id={`${id}-search`}>Search</Button>
      <Button id={`${id}-create`}>Create</Button>
      <Button id={`${id}-share`}>Share</Button>
    </Row>
  );
}

function baseSteps(id: string): readonly TourStep[] {
  return [
    { id: 'search', target: `#${id}-search`, title: 'Find a plan', description: 'Search by name or venue.', placement: 'bottom' },
    { id: 'create', target: `#${id}-create`, title: 'Create a plan', description: 'Start from a template or a blank canvas.', placement: 'bottom' },
    { id: 'share', target: `#${id}-share`, title: 'Share', description: 'Invite the venue team.', placement: 'bottom' },
  ];
}

function TourDemo({ id, steps, ...props }: Partial<TourProps> & { id: string }) {
  const [open, setOpen] = useState(false);
  const built = useMemo(() => baseSteps(id), [id]);
  const actual = steps && steps.length > 0 ? steps : built;
  return (
    <Frame>
      <Targets id={id} />
      <Button onClick={() => setOpen(true)}>Start tour</Button>
      <Tour
        {...props}
        steps={actual}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          props.onOpenChange?.(next);
        }}
      />
    </Frame>
  );
}

function PersistentTour({ id }: { id: string }) {
  const steps = useMemo(() => baseSteps(id), [id]);
  return (
    <Frame>
      <Targets id={id} />
      <Tour steps={steps} defaultOpen onOpenChange={() => {}} />
    </Frame>
  );
}

export const Default: Story = {
  args: { onOpenChange: fn(), onSkip: fn(), onComplete: fn() },
  render: (args) => <TourDemo {...args} id="tour-default" />,
  parameters: { docs: { source: { code: tourSource, language: 'tsx' } } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Start tour' }));
    const dialog = await body.findByRole('dialog', { name: 'Find a plan' });
    await expect(within(dialog).getByRole('heading', { name: 'Find a plan' })).toBeVisible();

    const targetRect = canvas.getByRole('button', { name: 'Search' }).getBoundingClientRect();
    const dialogRect = dialog.getBoundingClientRect();
    await expect(dialogRect.top).toBeGreaterThanOrEqual(targetRect.bottom - 4);
    const highlight = canvasElement.ownerDocument.querySelector('[data-ui="tour-highlight"]');
    await expect(highlight).not.toBeNull();
    const highlightRect = highlight!.getBoundingClientRect();
    await expect(Math.abs(highlightRect.top - targetRect.top)).toBeLessThan(2);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    await expect(within(dialog).getByRole('heading', { name: 'Create a plan' })).toBeVisible();
    await expect(within(dialog).getByText('Step 2 of 3')).toBeVisible();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Back' }));
    await expect(within(dialog).getByRole('heading', { name: 'Find a plan' })).toBeVisible();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(args.onComplete).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};

export const Keyboard: Story = {
  args: { onOpenChange: fn() },
  render: (args) => <TourDemo {...args} id="tour-keyboard" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Start tour' }));
    const dialog = await body.findByRole('dialog', { name: 'Find a plan' });
    await expect(within(dialog).getByRole('heading', { name: 'Find a plan' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(canvas.getByRole('button', { name: 'Search' })).toHaveFocus();
  },
};

export const Controlled: Story = {
  render: () => <ControlledTour />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Start tour' }));
    const dialog = await body.findByRole('dialog', { name: 'Find a plan' });

    await userEvent.click(canvas.getByRole('button', { name: 'Go to share' }));
    await expect(within(dialog).getByRole('heading', { name: 'Share' })).toBeVisible();
    await expect(body.getByRole('dialog', { name: 'Share' })).toBeVisible();
  },
};

function ControlledTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const steps = useMemo(() => baseSteps('tour-controlled'), []);
  return (
    <Frame>
      <Targets id="tour-controlled" />
      <Row>
        <Button onClick={() => setOpen(true)}>Start tour</Button>
        <Button variant="outline" onClick={() => setStep(2)}>
          Go to share
        </Button>
      </Row>
      <Tour steps={steps} open={open} step={step} onOpenChange={setOpen} onStepChange={setStep} />
    </Frame>
  );
}

export const MissingTarget: Story = {
  args: { onTargetMissing: fn(), targetTimeout: 100 },
  render: (args) => <TourDemo {...args} id="tour-missing" steps={[{ id: 'missing', target: '#tour-missing-absent', title: 'Find a plan', description: 'This target is not on the page.' }]} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Start tour' }));
    await body.findByRole('dialog', { name: 'Find a plan' });
    await expect(canvasElement.ownerDocument.querySelector('[data-ui="tour-fallback"]')).not.toBeNull();
    await expect(args.onTargetMissing).toHaveBeenCalledTimes(1);
    await expect(args.onTargetMissing).toHaveBeenCalledWith(expect.objectContaining({ id: 'missing' }), 0);
  },
};

export const LongContent: Story = {
  render: () => (
    <TourDemo
      id="tour-long"
      steps={[
        {
          id: 'long',
          target: '#tour-long-search',
          title: 'Find a plan and keep the whole venue team aligned',
          description:
            'Search by name, venue, or date. Results keep the most recent draft first, and every result names the person who edited it last. When the list is long, narrow it with the filters above the table. The panel scrolls inside the viewport instead of growing past it.',
        },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Start tour' }));
    const dialog = await body.findByRole('dialog', { name: 'Find a plan and keep the whole venue team aligned' });
    const rect = dialog.getBoundingClientRect();
    await expect(rect.top).toBeGreaterThanOrEqual(0);
    await expect(rect.bottom).toBeLessThanOrEqual(canvasElement.ownerDocument.defaultView!.innerHeight);
  },
};

export const LightTheme: Story = {
  globals: { theme: 'light' },
  render: () => <TourDemo id="tour-light" autoFocus={false} />,
};

export const Rtl: Story = {
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <TourDemo id="tour-rtl" autoFocus={false} />
    </div>
  ),
};

export const PersistentOpen: Story = {
  tags: ['!autodocs'],
  render: () => <PersistentTour id="tour-persistent" />,
};
