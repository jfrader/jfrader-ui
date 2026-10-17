import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { Button } from '../button';
import { BookingPill, type BookingDraft } from './index';

const START_DATE = '2026-10-11';
const TIMES = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'];
const draft: BookingDraft = { partySize: 2, date: START_DATE, time: '19:00' };
const Frame = styled.div({
  display: 'grid',
  gap: vars.space[4],
  maxInlineSize: '28rem',
});
const NarrowFrame = styled.div({ inlineSize: '320px', maxInlineSize: '100%' });
const meta = {
  title: 'Showcase/BookingPill',
  component: BookingPill,
  tags: ['autodocs'],
  args: {
    venue: 'The Glasshouse',
    startDate: START_DATE,
    times: TIMES,
    locale: 'en-GB',
    hourCycle: 'h23',
    onConfirm: fn(),
    onReset: fn(),
    onValueChange: fn(),
    onOpenChange: fn(),
    onStepChange: fn(),
  },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `<BookingPill venue="The Glasshouse" startDate="2026-10-11"
  times={['18:00', '18:30', '19:00', '19:30', '20:00']}
  locale="en-GB" hourCycle="h23" onConfirm={reserveTable} />`,
      },
      description: {
        component:
          'Choose a party size, date and time, then review and confirm a venue booking.',
      },
      usage: `### Values\nDraft, open and step support independent controlled/uncontrolled state. Edits request one whole draft; a party/date change clears an unavailable time in that request. Next validates the accepted draft. Availability changes never silently select a replacement.\n\n### Confirmation\nSupply onConfirm. Resolution shows the submitted snapshot; rejection leaves the review and an alert. Network cancellation, availability, venue timezone and DST validation belong to the application. Pending confirmation blocks close, back, reset and duplicate submission.\n\n### Keyboard\nThe inline group is not a dialog: Tab/Shift+Tab follow document order. Enter/Space activate native controls. Escape goes review → time → date → party → close; prevented events and pending confirmation suppress Escape. Calendar retains its grid keyboard map (day/week arrows, week Home/End, month PageUp/Down, Shift for year). TimePicker retains Select virtual focus and selection. Accepted navigation transfers focus only from the journey.\n\n### Customization\nslots/slotProps replace or style generated parts; calendarProps/timePickerProps customize the existing pickers without replacing their selection authority. Labels translates full phrases; locale formats dates, time and guest counts. MotionConfig respects reduced motion.`,
    },
  },
} satisfies Meta<typeof BookingPill>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Party: Story = {
  args: { defaultOpen: true },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Increase party size' }),
    );
    await expect(args.onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ partySize: 3 }),
    );
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(canvas.getByText('3 guests')).toBeVisible();
  },
};
export const Date: Story = { args: { defaultOpen: true, defaultStep: 'date' } };
export const Time: Story = {
  args: { defaultOpen: true, defaultStep: 'time', defaultValue: draft },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('combobox'));
    await userEvent.click(
      within(canvasElement.ownerDocument.body).getByRole('option', {
        name: '20:00',
      }),
    );
    await expect(args.onValueChange).toHaveBeenCalledWith({
      ...draft,
      time: '20:00',
    });
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('combobox')).toHaveTextContent('20:00');
  },
};
export const Review: Story = {
  args: {
    defaultOpen: true,
    defaultStep: 'review',
    defaultValue: draft,
    venueDetail: 'Garden room',
  },
};
export const Pending: Story = {
  tags: ['!autodocs'],
  args: { ...Review.args, onConfirm: fn(() => new Promise<void>(() => {})) },
  play: async ({ canvas, userEvent, args }) => {
    const button = canvas.getByRole('button', { name: 'Confirm booking' });
    await userEvent.click(button);
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button).not.toBeDisabled();
    await expect(button.ownerDocument.activeElement).toBe(button);
    await userEvent.keyboard('{Enter} ');
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('button', { name: 'Back' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    await expect(canvas.getByRole('group')).toBeVisible();
  },
};
export const Booked: Story = {
  tags: ['!autodocs'],
  args: Review.args,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Confirm booking' }),
    );
    const heading = await canvas.findByRole('heading', {
      name: 'Booking confirmed',
    });
    await expect(heading.ownerDocument.activeElement).toBe(heading);
    await expect(args.onConfirm).toHaveBeenCalledWith(draft);
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'New booking' }));
    await expect(
      canvas.getByRole('heading', { name: 'Party size' }),
    ).toBeVisible();
    await expect(args.onReset).toHaveBeenCalledTimes(1);
  },
};
export const ConfirmationRejection: Story = {
  tags: ['!autodocs'],
  args: {
    ...Review.args,
    onConfirm: fn(async () => {
      throw new Error('Unavailable');
    }),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Confirm booking' }),
    );
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Could not confirm this booking. Try another time.',
    );
    await expect(
      canvas.getByRole('heading', { name: 'Review booking' }),
    ).toBeVisible();
    await expect(canvas.getByText('19:00')).toBeVisible();
  },
};
export const AllUnavailable: Story = {
  args: { ...Time.args, isAvailable: () => false },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText('No available times for this date.'),
    ).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeDisabled();
  },
};
export const RejectedDraft: Story = {
  args: { defaultOpen: true, value: draft },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Increase party size' }),
    );
    await expect(args.onValueChange).toHaveBeenCalledWith({
      ...draft,
      partySize: 3,
    });
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(canvas.getByText('2 guests')).toBeVisible();
  },
};
export const RejectedStep: Story = {
  args: { defaultOpen: true, step: 'party' },
  play: async ({ canvas, userEvent, args }) => {
    const next = canvas.getByRole('button', { name: 'Next' });
    await userEvent.click(next);
    await expect(args.onStepChange).toHaveBeenCalledWith('date');
    await expect(args.onStepChange).toHaveBeenCalledTimes(1);
    await expect(
      canvas.getByRole('heading', { name: 'Party size' }),
    ).toBeVisible();
    await expect(next.ownerDocument.activeElement).toBe(next);
    await expect(canvas.getByText('Step: Party size')).toBeInTheDocument();
  },
};
export const RejectedOpen: Story = {
  args: { open: false },
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button');
    await userEvent.click(trigger);
    await expect(args.onOpenChange).toHaveBeenCalledWith(true);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  },
};
export const AtomicInvalidation: Story = {
  args: {
    defaultOpen: true,
    defaultValue: draft,
    isAvailable: (_date, _time, party) => party <= 2,
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Increase party size' }),
    );
    await expect(args.onValueChange).toHaveBeenCalledWith({
      ...draft,
      partySize: 3,
      time: null,
    });
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const AvailabilityChange: Story = {
  render: (args) => {
    const [available, setAvailable] = useState(true);
    return (
      <Frame>
        <BookingPill
          {...args}
          defaultOpen
          defaultStep="review"
          defaultValue={draft}
          isAvailable={() => available}
        />
        <Button onClick={() => setAvailable(false)}>
          Mark time unavailable
        </Button>
      </Frame>
    );
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Mark time unavailable' }),
    );
    await expect(
      canvas.getByRole('button', { name: 'Confirm booking' }),
    ).toBeDisabled();
    await expect(canvas.getByText('19:00')).toBeVisible();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const Bounds: Story = {
  args: {
    defaultOpen: true,
    minPartySize: 2,
    maxPartySize: 2,
    startDate: '2028-02-28',
    days: 3,
    venueDetail: 0,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('0')).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Decrease party size' }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole('button', { name: 'Increase party size' }),
    ).toBeDisabled();
  },
};
export const InvalidReview: Story = {
  args: {
    ...Review.args,
    value: { partySize: 0, date: '2026-02-31', time: '11:00' },
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('button', { name: 'Confirm booking' }),
    ).toBeDisabled();
  },
};
export const Disabled: Story = { args: { disabled: true, defaultOpen: true } };
export const Narrow: Story = {
  args: Review.args,
  decorators: [
    (Story) => (
      <NarrowFrame>
        <Story />
      </NarrowFrame>
    ),
  ],
};
export const RTL: Story = { args: { ...Review.args, dir: 'rtl' } };
export const LightTheme: Story = {
  args: Review.args,
  globals: { theme: 'light' },
};
export const ReducedMotion: Story = {
  args: Review.args,
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion in your browser to switch faces without resizing animation.',
      },
    },
  },
};
export const Keyboard: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button');
    await userEvent.tab();
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(getComputedStyle(trigger).outlineStyle).not.toBe('none');
    await userEvent.keyboard(' ');
    const decrease = canvas.getByRole('button', {
      name: 'Decrease party size',
    });
    await expect(decrease.ownerDocument.activeElement).toBe(decrease);
    await userEvent.tab({ shift: true });
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await userEvent.tab();
    await expect(getComputedStyle(decrease).outlineStyle).not.toBe('none');
    await userEvent.tab();
    await userEvent.tab();
    const next = canvas.getByRole('button', { name: 'Next' });
    await expect(next.ownerDocument.activeElement).toBe(next);
    await userEvent.keyboard('{Enter}');
    await expect(args.onStepChange).toHaveBeenCalledWith('date');
    await expect(args.onStepChange).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        canvas.getByRole('heading', { name: 'Select date' }),
      ).toBeVisible(),
    );
    await userEvent.keyboard('{Escape}');
    await expect(
      canvas.getByRole('heading', { name: 'Party size' }),
    ).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  },
};
