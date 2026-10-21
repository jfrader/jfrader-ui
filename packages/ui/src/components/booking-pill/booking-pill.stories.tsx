import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { Button } from '../button';
import { Surface } from '../surface';
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
const ReservationPanel = styled(Surface)({
  boxSizing: 'border-box',
  inlineSize: `calc(${vars.space[8]} * 18)`,
  maxInlineSize: '100%',
  padding: vars.space[6],
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
      source: {
        language: 'tsx',
        code: `import { BookingPill, Surface, styled, type BookingPillProps } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ReservationPanel = styled(Surface)({ boxSizing: 'border-box', inlineSize: '36rem', maxInlineSize: '100%', padding: vars.space[6], display: 'grid', gap: vars.space[5] });
const VenueLabel = styled.p({ margin: 0, fontFamily: vars.font.sans, fontSize: vars.textSize.sm, color: vars.color.textMuted });

export function Reservation({ onConfirm }: Pick<BookingPillProps, 'onConfirm'>) {
  return <ReservationPanel>
    <VenueLabel>Modern British · Garden dining</VenueLabel>
    <BookingPill venue="The Glasshouse" startDate="2026-10-11"
      times={['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00']}
      locale="en-GB" hourCycle="h23" onConfirm={onConfirm} />
  </ReservationPanel>;
}`,
      },
      description: {
        component:
          'Choose a party size, date and time, then review and confirm a venue booking.',
      },
      sections: [
        { title: 'Booking journey', stories: ['Default', 'Date', 'Time', 'Review'] },
        { title: 'Availability', stories: ['AllUnavailable', 'AvailabilityChange'] },
      ],
      usage: `### Booking details
Edits request a whole draft. Changing party size or date clears a time that is no longer available. Next validates the accepted draft; availability changes never silently select a replacement.

### Confirmation

Connect confirmation to your reservation service. A resolved request shows the submitted snapshot; rejection leaves the review and an alert. The application owns network cancellation, availability, venue timezone and daylight-saving validation. Pending confirmation blocks close, back, reset and duplicate submission.

### Keyboard and accessibility

This is an inline group, not a dialog. Tab and Shift+Tab follow document order; Enter and Space activate controls. Escape returns through review, time, date and party, then closes. Prevented events and pending confirmation suppress Escape.
The calendar uses day/week arrows, Home/End for the week, PageUp/PageDown for the month and Shift for the year. The time picker uses Select keyboard navigation. Accepted navigation moves focus only when it was already inside the journey.

### Language and motion

Translate complete phrases and format dates, times and guest counts for the reader's locale. Reduced motion skips resizing animation.`,
    },
  },
} satisfies Meta<typeof BookingPill>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  name: 'Reserve a table',
  parameters: { docs: { description: { story: 'Open the reservation pill and choose guests, a date and a time before confirming.' } } },
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
  },
};
export const Date: Story = {
  name: 'Choose a date',
  parameters: { docs: {
    description: { story: 'Start at the calendar to choose a reservation date.' },
    source: { language: 'tsx', code: `import { BookingPill, Surface, styled, type BookingPillProps } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ReservationPanel = styled(Surface)({ boxSizing: 'border-box', inlineSize: '36rem', maxInlineSize: '100%', padding: vars.space[6], display: 'grid', gap: vars.space[5] });
const VenueLabel = styled.p({ margin: 0, fontFamily: vars.font.sans, fontSize: vars.textSize.sm, color: vars.color.textMuted });

export function Reservation({ onConfirm }: Pick<BookingPillProps, 'onConfirm'>) {
  return <ReservationPanel>
    <VenueLabel>Modern British · Garden dining</VenueLabel>
    <BookingPill venue="The Glasshouse" startDate="2026-10-11"
      times={['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00']}
      locale="en-GB" hourCycle="h23" defaultOpen defaultStep="date" onConfirm={onConfirm} />
  </ReservationPanel>;
}` },
  } },
  args: { defaultOpen: true, defaultStep: 'date' },
};
export const Time: Story = {
  name: 'Choose a time',
  parameters: { docs: {
    description: { story: 'Choose a table time for two guests on the selected date.' },
    source: { language: 'tsx', code: `import { BookingPill, Surface, styled, type BookingPillProps } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ReservationPanel = styled(Surface)({ boxSizing: 'border-box', inlineSize: '36rem', maxInlineSize: '100%', padding: vars.space[6], display: 'grid', gap: vars.space[5] });
const VenueLabel = styled.p({ margin: 0, fontFamily: vars.font.sans, fontSize: vars.textSize.sm, color: vars.color.textMuted });

export function Reservation({ onConfirm }: Pick<BookingPillProps, 'onConfirm'>) {
  return <ReservationPanel>
    <VenueLabel>Modern British · Garden dining</VenueLabel>
    <BookingPill venue="The Glasshouse" startDate="2026-10-11"
      times={['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00']}
      locale="en-GB" hourCycle="h23" defaultOpen defaultStep="time"
      defaultValue={{ partySize: 2, date: '2026-10-11', time: '19:00' }} onConfirm={onConfirm} />
  </ReservationPanel>;
}` },
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
    description: { story: 'Check the party, date, time and room before submitting the booking.' },
    source: { language: 'tsx', code: `import { BookingPill, Surface, styled, type BookingPillProps } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ReservationPanel = styled(Surface)({ boxSizing: 'border-box', inlineSize: '36rem', maxInlineSize: '100%', padding: vars.space[6], display: 'grid', gap: vars.space[5] });
const VenueLabel = styled.p({ margin: 0, fontFamily: vars.font.sans, fontSize: vars.textSize.sm, color: vars.color.textMuted });

export function Reservation({ onConfirm }: Pick<BookingPillProps, 'onConfirm'>) {
  return <ReservationPanel>
    <VenueLabel>Modern British · Garden dining</VenueLabel>
    <BookingPill venue="The Glasshouse" venueDetail="Garden room" startDate="2026-10-11"
      times={['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00']}
      locale="en-GB" hourCycle="h23" defaultOpen defaultStep="review"
      defaultValue={{ partySize: 2, date: '2026-10-11', time: '19:00' }} onConfirm={onConfirm} />
  </ReservationPanel>;
}` },
  } },
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
  name: 'No available times',
  parameters: { docs: { description: { story: 'Show an empty time step when no reservation times are available.' }, source: { language: 'tsx', code: `import { BookingPill, Surface, styled, type BookingPillProps } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ReservationPanel = styled(Surface)({ boxSizing: 'border-box', inlineSize: '36rem', maxInlineSize: '100%', padding: vars.space[6], display: 'grid', gap: vars.space[5] });
const VenueLabel = styled.p({ margin: 0, fontFamily: vars.font.sans, fontSize: vars.textSize.sm, color: vars.color.textMuted });

export function Reservation({ onConfirm }: Pick<BookingPillProps, 'onConfirm'>) {
  return (
    <ReservationPanel>
      <VenueLabel>Modern British · Garden dining</VenueLabel>
      <BookingPill
        venue="The Glasshouse"
        startDate="2026-10-11"
        times={['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00']}
        locale="en-GB"
        hourCycle="h23"
        defaultOpen
        defaultStep="time"
        defaultValue={{ partySize: 2, date: '2026-10-11', time: '19:00' }}
        isAvailable={() => false}
        onConfirm={onConfirm}
      />
    </ReservationPanel>
  );
}` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `import { BookingPill, Surface, styled, type BookingPillProps } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ReservationPanel = styled(Surface)({ boxSizing: 'border-box', inlineSize: '36rem', maxInlineSize: '100%', padding: vars.space[6], display: 'grid', gap: vars.space[5] });
const VenueLabel = styled.p({ margin: 0, fontFamily: vars.font.sans, fontSize: vars.textSize.sm, color: vars.color.textMuted });

export function Reservation({ onConfirm }: Pick<BookingPillProps, 'onConfirm'>) {
  return (
    <ReservationPanel>
      <VenueLabel>Modern British · Garden dining</VenueLabel>
      <BookingPill
        venue="The Glasshouse"
        startDate="2026-10-11"
        times={['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00']}
        locale="en-GB"
        hourCycle="h23"
        defaultOpen
        defaultValue={{ partySize: 2, date: '2026-10-11', time: '19:00' }}
        isAvailable={(_date, _time, partySize) => partySize <= 2}
        onConfirm={onConfirm}
      />
    </ReservationPanel>
  );
}` } } },
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
    <BookingPill venue="The Glasshouse" startDate="2026-10-11"
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
