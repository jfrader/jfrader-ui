import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Alert, type AlertProps, type AlertTone } from './index';

const TONES = ['info', 'success', 'warning', 'danger'] as const satisfies readonly AlertTone[];

const TONE_COPY: Record<AlertTone, { title: string; body: string }> = {
  info: { title: 'Maintenance tonight', body: 'Sync pauses from 02:00 to 03:00 UTC.' },
  success: { title: 'Invite sent', body: 'ana@example.com can join the workspace now.' },
  warning: { title: 'Storage almost full', body: '92% of 10 GB used.' },
  danger: { title: 'Payment failed', body: 'Update your card to keep the Pro plan.' },
};

const stackStyle = css({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '360px',
});

const meta = {
  title: 'Feedback/Alert',
  component: Alert,
  parameters: { docs: { description: { component: 'Show a message about an update, a problem, or an action to take.' } } },
  args: { tone: 'info', title: TONE_COPY.info.title, children: TONE_COPY.info.body },
  argTypes: {
    tone: { control: 'radio', options: TONES },
  },
  decorators: [
    (Story) => (
      <div css={stackStyle}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Alert>;

export default meta;

type Story = StoryObj<typeof meta>;

function ToneMatrix(props: AlertProps) {
  return (
    <>
      {TONES.map((tone) => (
        <Alert {...props} key={tone} tone={tone} title={TONE_COPY[tone].title}>
          {TONE_COPY[tone].body}
        </Alert>
      ))}
    </>
  );
}
ToneMatrix.displayName = 'ToneMatrix';

async function expectToneRoles(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await expect(canvas.getAllByRole('status')).toHaveLength(TONES.length - 1);
  await expect(canvas.getByRole('alert')).toHaveTextContent(TONE_COPY.danger.title);
}

export const Tones: Story = {
  render: (args) => <ToneMatrix {...args} />,
  play: async ({ canvasElement }) => {
    await expectToneRoles(canvasElement);
    const alerts = canvasElement.querySelectorAll('[data-ui="alert"]');
    alerts.forEach((alert) => {
      // Fractional devicePixelRatios device-snap border widths (authored 3px computes ~2.23px).
      expect(parseFloat(getComputedStyle(alert).borderInlineStartWidth)).toBeGreaterThan(1.5);
    });
  },
};

export const TitleOnly: Story = {
  args: { children: undefined },
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole('status');
    await expect(status).toHaveTextContent(TONE_COPY.info.title);
    await expect(status.children).toHaveLength(2);
  },
};

export const Dismissible: Story = {
  args: { onDismiss: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const status = canvas.getByRole('status');
    const dismiss = canvas.getByRole('button', { name: 'Dismiss' });
    await expect(status).toHaveAttribute('aria-atomic', 'true');
    await expect(status).not.toContainElement(dismiss);
    await expect(dismiss).toHaveAttribute('aria-label', 'Dismiss');

    const { width, height } = dismiss.getBoundingClientRect();
    await expect(width).toBeGreaterThanOrEqual(24);
    await expect(height).toBeGreaterThanOrEqual(24);

    await userEvent.tab();
    await expect(dismiss).toHaveFocus();
    await expect(getComputedStyle(dismiss).outlineStyle).not.toBe('none');

    await userEvent.click(dismiss);
    await expect(args.onDismiss).toHaveBeenCalledTimes(1);
    await expect(dismiss).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onDismiss).toHaveBeenCalledTimes(2);
    await expect(status).toBeInTheDocument();
    await userEvent.keyboard(' ');
    await expect(args.onDismiss).toHaveBeenCalledTimes(3);
    // Dismissal is a request: the alert stays mounted until the parent removes it.
    await expect(status).toBeInTheDocument();
    await expect(dismiss).toBeInTheDocument();
  },
};

export const LiveAnnouncement: Story = {
  render: (args) => (
    <>
      <Alert {...args} tone="danger" title={TONE_COPY.danger.title}>
        {TONE_COPY.danger.body}
      </Alert>
      <Alert {...args} tone="info" title={TONE_COPY.info.title}>
        {TONE_COPY.info.body}
      </Alert>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const urgent = canvas.getByRole('alert');
    const polite = canvas.getByRole('status');
    await expect(urgent.parentElement).toHaveAttribute('data-tone', 'danger');
    await expect(polite.parentElement).toHaveAttribute('data-tone', 'info');
    await expect(urgent).toHaveAttribute('aria-atomic', 'true');
    await expect(polite).toHaveAttribute('aria-atomic', 'true');
    await expect(urgent.firstElementChild).toHaveTextContent('Error');
    await expect(polite.firstElementChild).toHaveTextContent('Information');
  },
};

export const ZeroContent: Story = {
  args: { title: 0, children: 0 },
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole('status');
    await expect(status.children).toHaveLength(3);
    await expect(within(status).getAllByText('0')).toHaveLength(2);
  },
};

export const BooleanContent: Story = {
  args: { title: false, children: true },
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole('status');
    await expect(status.children).toHaveLength(1);
    await expect(status).toHaveTextContent(/^Information$/);
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  args: { onDismiss: fn() },
  render: (args) => <ToneMatrix {...args} />,
  play: async ({ canvasElement }) => {
    await expectToneRoles(canvasElement);
    await expect(within(canvasElement).getAllByRole('button', { name: 'Dismiss' })).toHaveLength(TONES.length);
  },
};
