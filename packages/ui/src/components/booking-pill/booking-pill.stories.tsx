import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { MotionConfig } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { expectInside } from '../../testing/geometry-assertions';
import { Button } from '../button';
import { Surface } from '../surface';
import { BookingPill, type BookingDraft, type BookingPrice } from './index';

const START_DATE = '2026-10-11';
const TIMES = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'];
const PRICE: BookingPrice = { amount: 4500, currency: 'GBP' };
const draft: BookingDraft = { partySize: 2, date: START_DATE, time: '19:00' };
const Frame = styled.div({
  display: 'grid',
  gap: vars.space[4],
  maxInlineSize: '28rem',
});
const NarrowFrame = styled.div({ inlineSize: '320px', maxInlineSize: '100%' });
const ReservationPanel = styled(Surface)({
  boxSizing: 'border-box',
  inlineSize: `calc(${vars.space[8]} * 18)`,
  maxInlineSize: '100%',
  padding: `clamp(${vars.space[2]}, 3%, ${vars.space[6]})`,
  marginInline: 'auto',
  display: 'grid',
  gap: vars.space[5],
});
const VenueLabel = styled.p({
  margin: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});

/** Authored usage snippet shared by the reservation examples; `props` are the story's extra props. */
const reservation = (props = '') => `import { BookingPill, Surface, styled, type BookingPillProps } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ReservationPanel = styled(Surface)({ boxSizing: 'border-box', inlineSize: '36rem', maxInlineSize: '100%', padding: \`clamp(\${vars.space[2]}, 3%, \${vars.space[6]})\`, display: 'grid', gap: vars.space[5] });
const VenueLabel = styled.p({ margin: 0, fontFamily: vars.font.sans, fontSize: vars.textSize.sm, color: vars.color.textMuted });

export function Reservation({ onConfirm }: Pick<BookingPillProps, 'onConfirm'>) {
  return (
    <ReservationPanel>
      <VenueLabel>Modern British · Garden dining</VenueLabel>
      <BookingPill
        venue="The Glasshouse"
        price={{ amount: 4500, currency: 'GBP' }}
        startDate="2026-10-11"
        times={['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00']}
        locale="en-GB"
        hourCycle="h23"${props}
        onConfirm={onConfirm}
      />
    </ReservationPanel>
  );
}`;

const part = (root: HTMLElement, name: string) =>
  root.querySelector<HTMLElement>(`[data-ui~="booking-pill-${name}"]`)!;
const statePill = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-ui~="booking-pill-line"] > [data-ui~="pill"]');
/** Bottom edge of a zero-height inline box appended to `element`: the text baseline it sits on. */
function baselineOf(element: HTMLElement) {
  const probe = element.ownerDocument.createElement('span');
  probe.style.display = 'inline-block';
  probe.style.blockSize = '0';
  element.append(probe);
  const baseline = probe.getBoundingClientRect().bottom;
  probe.remove();
  return baseline;
}

const meta = {
  title: 'Showcase/BookingPill',
  component: BookingPill,
  tags: ['autodocs'],
  render: (args) => (
    <ReservationPanel>
      <VenueLabel>Modern British · Garden dining</VenueLabel>
      <BookingPill {...args} />
    </ReservationPanel>
  ),
  args: {
    venue: 'The Glasshouse',
    price: PRICE,
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
    layout: 'padded',
    docs: {
      source: { language: 'tsx', code: reservation() },
      description: {
        component:
          'Choose a party size, date and time, then review and confirm a venue booking.',
      },
      sections: [
        { title: 'Booking journey', stories: ['Default', 'Date', 'Time', 'Review'] },
        { title: 'Sizes', stories: ['Compact'] },
        { title: 'Availability', stories: ['AllUnavailable', 'AvailabilityChange'] },
      ],
      usage: `### Booking details
Edits request a whole draft. Changing party size or date clears a time that is no longer available. Next validates the accepted draft; availability changes never silently select a replacement.

### Values and constraints

Pass \`price\` as an integer amount in the currency's minor units with an ISO 4217 code. The pill formats it for \`locale\` in the trigger and the summary. In a container narrower than 22rem the venue leaves the trigger line and stays in the button's name.

### Confirmation

Connect confirmation to your reservation service. A resolved request shows the submitted snapshot and marks the pill booked; rejection leaves the review and an alert. Pass \`onCancel\` to offer cancelling from the receipt. The application owns network cancellation, availability, venue timezone and daylight-saving validation. A pending request blocks close, back, reset and duplicate submission.

### Keyboard and accessibility

This is an inline group, not a dialog. Tab and Shift+Tab follow document order; Enter and Space activate controls. Escape returns through review, time, date and party, then closes. On the receipt, Escape closes. Prevented events and pending requests suppress Escape.
The calendar uses day/week arrows, Home/End for the week, PageUp/PageDown for the month and Shift for the year. The time picker uses Select keyboard navigation. Accepted navigation moves focus only when it was already inside the journey.

### Language and motion

Translate complete phrases and format dates, times, prices and guest counts for the reader's locale. Reduced motion opens and closes the panel without resizing animation.`,
    },
  },
} satisfies Meta<typeof BookingPill>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  name: 'Reserve a table',
  parameters: { docs: { description: { story: 'Open the reservation pill and choose guests, a date and a time before confirming.' } } },
};
export const TriggerLine: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement }) => {
    const trigger = canvas.getByRole('button', { name: /Book for 2/ });
    const pill = canvasElement.querySelector<HTMLElement>('[data-ui~="booking-pill"]')!;
    const [action, venue, price] = ['action', 'venue', 'price'].map((name) => part(pill, name));
    const baselines = [action!, venue!, price!].map(baselineOf);
    for (const baseline of baselines) await expect(Math.abs(baseline - baselines[0]!)).toBeLessThan(1);
    await expect(price).toHaveTextContent('£45.00');
    await expect(trigger).toHaveAccessibleName(/^Book for 2\s*The Glasshouse\s*£45\.00$/);
    // One hit area: the action, the venue and the price all resolve to the trigger.
    for (const element of [action!, venue!, price!]) {
      const box = element.getBoundingClientRect();
      const hit = element.ownerDocument.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      await expect(trigger.contains(hit)).toBe(true);
    }
    const box = trigger.getBoundingClientRect();
    await expect(box.height).toBeGreaterThanOrEqual(48);
    await expect(pill.getBoundingClientRect().height - box.height).toBeLessThanOrEqual(2);
    await expectInside(price!, trigger);
    await expect(trigger.scrollWidth).toBeLessThanOrEqual(trigger.clientWidth);
  },
};
export const Compact: Story = {
  name: 'Compact pill',
  args: { size: 'sm' },
  parameters: { docs: {
    description: { story: 'Use the small pill in dense lists and toolbars; its actions use small buttons.' },
    source: { language: 'tsx', code: reservation('\n        size="sm"') },
  } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: /Book for 2/ });
    const height = trigger.getBoundingClientRect().height;
    await expect(height).toBeGreaterThanOrEqual(32);
    await expect(height).toBeLessThan(48);
    const pill = canvasElement.querySelector<HTMLElement>('[data-ui~="booking-pill"]')!;
    const baselines = ['action', 'venue', 'price'].map((name) => baselineOf(part(pill, name)));
    for (const baseline of baselines) await expect(Math.abs(baseline - baselines[0]!)).toBeLessThan(1);
    await userEvent.click(trigger);
    const next = canvas.getByRole('button', { name: 'Next' });
    await expect(next.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    await expect(next.getBoundingClientRect().height).toBeLessThan(40);
    await userEvent.click(trigger);
  },
};
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
    await expect(canvas.getByRole('button', { name: /Book for 3/ })).toBeVisible();
  },
};
export const Date: Story = {
  name: 'Choose a date',
  parameters: { docs: {
    description: { story: 'Start at the calendar to choose a reservation date.' },
    source: { language: 'tsx', code: reservation('\n        defaultOpen\n        defaultStep="date"') },
  } },
  args: { defaultOpen: true, defaultStep: 'date' },
};
export const Time: Story = {
  name: 'Choose a time',
  parameters: { docs: {
    description: { story: 'Choose a table time for two guests on the selected date.' },
    source: { language: 'tsx', code: reservation(`\n        defaultOpen\n        defaultStep="time"\n        defaultValue={{ partySize: 2, date: '2026-10-11', time: '19:00' }}`) },
  } },
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
  name: 'Review the reservation',
  parameters: { docs: {
    description: { story: 'Check the party, date, time and price before submitting the booking.' },
    source: { language: 'tsx', code: reservation(`\n        venueDetail="Garden room"\n        defaultOpen\n        defaultStep="review"\n        defaultValue={{ partySize: 2, date: '2026-10-11', time: '19:00' }}`) },
  } },
  args: {
    defaultOpen: true,
    defaultStep: 'review',
    defaultValue: draft,
    venueDetail: 'Garden room',
  },
  play: async ({ canvas }) => {
    const summary = within(canvas.getByRole('group', { name: 'Review booking' }));
    await expect(summary.getByText('Price')).toBeVisible();
    await expect(summary.getByText('£45.00')).toBeVisible();
  },
};
export const Pending: Story = {
  tags: ['!autodocs'],
  args: { ...Review.args, onConfirm: fn(() => new Promise<void>(() => {})) },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const button = canvas.getByRole('button', { name: 'Confirm booking' });
    await userEvent.click(button);
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button).not.toBeDisabled();
    await expect(button.ownerDocument.activeElement).toBe(button);
    await userEvent.keyboard('{Enter} ');
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('button', { name: 'Back' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    await expect(canvas.getByRole('group', { name: 'Review booking' })).toBeVisible();
    const state = statePill(canvasElement)!;
    await expect(state).toHaveAttribute('data-status', 'pending');
    await expect(state).toHaveTextContent('Confirming');
    await expect(state.querySelector('[data-ui~="spinner-indicator"]')).not.toBeNull();
    await expect(state.querySelector('[data-glyph]')).toBeNull();
  },
};
export const Booked: Story = {
  tags: ['!autodocs'],
  args: Review.args,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Confirm booking' }),
    );
    const heading = await canvas.findByRole('heading', {
      name: 'Booking confirmed',
    });
    await expect(heading.ownerDocument.activeElement).toBe(heading);
    await expect(args.onConfirm).toHaveBeenCalledWith(draft);
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    // Booked reads by glyph and word, not by the success tint: a check instead of the spinner.
    const state = statePill(canvasElement)!;
    await expect(state).toHaveAttribute('data-status', 'booked');
    await expect(state).toHaveTextContent('Booked');
    await expect(state.querySelector('[data-glyph="check"]')).not.toBeNull();
    await expect(state.querySelector('[data-ui~="spinner-indicator"]')).toBeNull();
    await expect(part(canvasElement, 'action')).toHaveTextContent('Sun 11 Oct, 19:00');
    await userEvent.keyboard('{Escape}');
    const trigger = canvas.getByRole('button', { name: /Booked/ });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await userEvent.click(trigger);
    await userEvent.click(canvas.getByRole('button', { name: 'New booking' }));
    await expect(
      canvas.getByRole('heading', { name: 'Party size' }),
    ).toBeVisible();
    await expect(args.onReset).toHaveBeenCalledTimes(1);
    await expect(statePill(canvasElement)).toBeNull();
  },
};
export const Cancelled: Story = {
  tags: ['!autodocs'],
  args: { ...Review.args, onCancel: fn() },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Confirm booking' }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Cancel booking' }));
    const heading = await canvas.findByRole('heading', { name: 'Booking cancelled' });
    await expect(heading.ownerDocument.activeElement).toBe(heading);
    await expect(args.onCancel).toHaveBeenCalledWith(draft);
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
    await expect(canvas.queryByRole('button', { name: 'Cancel booking' })).toBeNull();
    const state = statePill(canvasElement)!;
    await expect(state).toHaveAttribute('data-status', 'cancelled');
    await expect(state).toHaveTextContent('Cancelled');
    await expect(getComputedStyle(part(canvasElement, 'action')).textDecorationLine).toBe('line-through');
  },
};
export const CancelRejection: Story = {
  tags: ['!autodocs'],
  args: { ...Review.args, onCancel: fn(async () => { throw new Error('Locked'); }) },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Confirm booking' }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Cancel booking' }));
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Could not cancel this booking. Try again.');
    await expect(canvas.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible();
    await expect(statePill(canvasElement)).toHaveAttribute('data-status', 'booked');
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
    await userEvent.click(canvas.getByRole('button', { name: 'Confirm booking' }));
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
  name: 'No available times',
  parameters: { docs: { description: { story: 'Show an empty time step when no reservation times are available.' }, source: { language: 'tsx', code: reservation(`\n        defaultOpen\n        defaultStep="time"\n        defaultValue={{ partySize: 2, date: '2026-10-11', time: '19:00' }}\n        isAvailable={() => false}`) } } },
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
  parameters: { docs: { source: { language: 'tsx', code: reservation(`\n        defaultOpen\n        defaultValue={{ partySize: 2, date: '2026-10-11', time: '19:00' }}\n        isAvailable={(_date, _time, partySize) => partySize <= 2}`) } } },
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
  name: 'Availability changes during review',
  parameters: { docs: {
    description: { story: 'Mark the chosen time unavailable and keep the draft visible while confirmation is blocked.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { BookingPill, Button, styled, type BookingPillProps } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Reservation = styled.div({ display: 'grid', gap: vars.space[4], maxInlineSize: '28rem' });

export function LiveAvailability({ onConfirm }: Pick<BookingPillProps, 'onConfirm'>) {
  const [available, setAvailable] = useState(true);
  return <Reservation>
    <BookingPill venue="The Glasshouse" price={{ amount: 4500, currency: 'GBP' }} startDate="2026-10-11"
      times={['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00']}
      locale="en-GB" hourCycle="h23" defaultOpen defaultStep="review"
      defaultValue={{ partySize: 2, date: '2026-10-11', time: '19:00' }}
      isAvailable={() => available} onConfirm={onConfirm} />
    <Button onClick={() => setAvailable(false)}>Mark time unavailable</Button>
  </Reservation>;
}` },
  } },
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
export const LongContent: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    venue: 'The Glasshouse private dining room and rooftop garden',
    venueDetail: 'Reservation'.repeat(18),
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector<HTMLElement>('[data-ui~="booking-pill"] > button')!;
    await expect(trigger.scrollWidth).toBeLessThanOrEqual(trigger.clientWidth);
    await expectInside(part(canvasElement, 'price'), trigger);
  },
};
export const Narrow: Story = {
  args: Review.args,
  decorators: [
    (Story) => (
      <NarrowFrame>
        <Story />
      </NarrowFrame>
    ),
  ],
  play: async ({ canvas, canvasElement }) => {
    const trigger = canvas.getByRole('button', { name: /^Book for 2\s*The Glasshouse\s*£45\.00$/ });
    await expect(trigger.scrollWidth).toBeLessThanOrEqual(trigger.clientWidth);
    await expect(part(canvasElement, 'venue').getBoundingClientRect().width).toBeLessThanOrEqual(1);
    await expectInside(part(canvasElement, 'action'), trigger);
    await expectInside(part(canvasElement, 'price'), trigger);
  },
};
export const RTL: Story = { args: { ...Review.args, dir: 'rtl' } };
export const LightTheme: Story = {
  args: Review.args,
  globals: { theme: 'light' },
};
export const ReducedMotion: Story = {
  name: 'Reduced motion',
  decorators: [(Story) => <MotionConfig reducedMotion="always"><Story /></MotionConfig>],
  parameters: {
    docs: {
      description: {
        story:
          'Open and close the pill without the panel growing or the faces resizing.',
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const pill = canvasElement.querySelector<HTMLElement>('[data-ui~="booking-pill"]')!;
    const trigger = canvas.getByRole('button', { name: /Book for 2/ });
    await expect(pill).toHaveAttribute('data-reduced-motion');
    await expect(getComputedStyle(pill).transitionDuration.split(', ').every((value) => value === '0s')).toBe(true);
    // No waiting: the lifecycle completes in the same task as the click.
    await userEvent.click(trigger);
    const panel = canvas.getByRole('group', { name: 'Party size' });
    await expect(getComputedStyle(panel).visibility).toBe('visible');
    await expect(panel.getBoundingClientRect().height).toBeGreaterThan(0);
    await expect(panel.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Decrease party size' }));
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(getComputedStyle(panel).visibility).toBe('hidden');
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
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
    await expect(getComputedStyle(next).outlineStyle).not.toBe('none');
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
