import { useRef, useState, type ComponentPropsWithRef } from 'react';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Alert, type AlertProps, type AlertTone } from './index';
import { Button } from '../button';

const TONES = ['info', 'success', 'warning', 'danger'] as const satisfies readonly AlertTone[];

function SlotDismiss(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} data-slot="alert-dismiss" />;
}

export const DismissReplacement: Story = {
  args: { onDismiss: fn() },
  render: (args) => <Alert {...args} slots={{ dismiss: SlotDismiss }} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const dismiss = canvasElement.querySelector('[data-slot="alert-dismiss"]');
    await expect(dismiss).toBeInTheDocument();
    await expect(dismiss).toHaveAttribute('data-ui', 'alert-dismiss');
    await expect(getComputedStyle(dismiss!).alignItems).toBe('center');
    await expect(dismiss).toHaveAttribute('aria-label', 'Dismiss');
    await expect(canvasElement.querySelector('[data-ui="alert-dismiss"]:not([data-slot])')).toBeNull();
    await userEvent.click(dismiss!);
    await expect(args.onDismiss).toHaveBeenCalledTimes(1);
  },
};

const TONE_COPY: Record<AlertTone, { title: string; body: string }> = {
  info: { title: 'Maintenance tonight', body: 'Sync pauses from 02:00 to 03:00 UTC.' },
  success: { title: 'Invite sent', body: 'ana@example.com can join the workspace now.' },
  warning: { title: 'Storage almost full', body: '92% of 10 GB used.' },
  danger: { title: 'Payment failed', body: 'Update your card to keep the Pro plan.' },
};

const Stack = styled.div({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '360px',
  maxInlineSize: '100%',
});

const meta = {
  title: 'Feedback/Alert',
  component: Alert,
  parameters: { docs: {
    description: { component: 'Show a message about an update, a problem, or an action to take.' },
    sections: [
      { title: 'Tones', stories: ['Tones'] },
      { title: 'Title and description', stories: ['TitleOnly'] },
      { title: 'Actions', stories: ['WithAction'] },
      { title: 'Dismissal', stories: ['DismissWithState'] },
      { title: 'Composition', stories: ['PaymentNotice'] },
    ],
    usage: `### When to use
Show an update or problem beside the affected content. Reserve urgent announcements for problems that need immediate attention; put the meaning in visible text, not color alone.

### Accessibility
Screen readers may not announce content already present when a live region mounts. Mount the region before changing its text when an announcement is required. Keep actionable controls outside the announcement text.

### Dismissal
Remove dismissed messages in application state. Tab reaches the dismiss button; Enter or Space activates it. If removal takes focus away, move focus to the next relevant control.`,
  } },
  args: { tone: 'info', title: TONE_COPY.info.title, children: TONE_COPY.info.body },
  argTypes: {
    tone: { control: 'radio', options: TONES },
  },
  decorators: [
    (Story) => (
      <Stack>
        <Story />
      </Stack>
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
  name: 'Message tones',
  parameters: { docs: { description: { story: 'Compare informational, success, warning, and urgent messages.' }, source: { language: 'tsx', code: `import { Alert } from '@jfrader/ui';

<>
  <Alert tone="info" title="Maintenance tonight">Sync pauses from 02:00 to 03:00 UTC.</Alert>
  <Alert tone="success" title="Invite sent">ana@example.com can join the workspace now.</Alert>
  <Alert tone="warning" title="Storage almost full">92% of 10 GB used.</Alert>
  <Alert tone="danger" title="Payment failed">Update your card to keep the Pro plan.</Alert>
</>` } } },
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
  name: 'Title without description',
  parameters: { docs: { description: { story: 'Keep a short maintenance notice to a single heading.' }, source: { language: 'tsx', code: `import { Alert } from '@jfrader/ui';

<Alert title="Maintenance tonight" />` } } },
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

export const WithAction: Story = {
  name: 'Message with an action',
  parameters: { docs: { description: { story: 'Place a billing action after the payment message.' }, source: { language: 'tsx', code: `import { Alert, Button } from '@jfrader/ui';

<>
  <Alert tone="danger" title="Payment failed">Update your card to keep the Pro plan.</Alert>
  <Button render={(props) => <a {...props} href="/billing" />}>Update card</Button>
</>` } } },
  render: () => (
    <>
      <Alert tone="danger" title="Payment failed">Update your card to keep the Pro plan.</Alert>
      <Button render={(props) => <a {...props} href="/billing" />}>Update card</Button>
    </>
  ),
};

export const DismissWithState: Story = {
  name: 'Dismiss a message',
  parameters: { docs: { description: { story: 'Dismiss the notice and restore it with the Show notice button.' }, source: { language: 'tsx', code: `import { useRef, useState } from 'react';
import { Alert, Button } from '@jfrader/ui';

export function MaintenanceNotice() {
  const [visible, setVisible] = useState(true);
  const showButton = useRef<HTMLButtonElement>(null);
  const dismiss = () => {
    setVisible(false);
    showButton.current?.focus();
  };
  return <>
    <Button ref={showButton} onClick={() => setVisible(true)}>Show notice</Button>
    {visible && <Alert title="Maintenance tonight" onDismiss={dismiss}>Sync pauses from 02:00 to 03:00 UTC.</Alert>}
  </>;
}` } } },
  render: function MaintenanceNotice() {
    const [visible, setVisible] = useState(true);
    const showButton = useRef<HTMLButtonElement>(null);
    const dismiss = () => {
      setVisible(false);
      showButton.current?.focus();
    };
    return (
      <>
        <Button ref={showButton} onClick={() => setVisible(true)}>Show notice</Button>
        {visible && (
          <Alert title="Maintenance tonight" onDismiss={dismiss}>
            Sync pauses from 02:00 to 03:00 UTC.
          </Alert>
        )}
      </>
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }));
    await expect(canvas.queryByRole('status')).toBeNull();
    const showButton = canvas.getByRole('button', { name: 'Show notice' });
    await expect(showButton).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('status')).toBeVisible();
  },
};

export const PaymentNotice: Story = {
  name: 'Billing summary',
  parameters: { docs: { description: { story: 'Keep the alert beside a separate action outside the live announcement.' }, source: { language: 'tsx', code: `import { Alert, Button } from '@jfrader/ui';

<section aria-label="Billing">
  <Alert tone="warning" title="Storage almost full">92% of 10 GB used.</Alert>
  <Button render={(props) => <a {...props} href="/billing/plans" />}>Compare plans</Button>
</section>` } } },
  render: () => (
    <section aria-label="Billing">
      <Alert tone="warning" title="Storage almost full">92% of 10 GB used.</Alert>
      <Button render={(props) => <a {...props} href="/billing/plans" />}>Compare plans</Button>
    </section>
  ),
};
