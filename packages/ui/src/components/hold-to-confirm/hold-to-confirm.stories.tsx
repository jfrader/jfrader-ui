import { useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { HoldToConfirm, type HoldToConfirmProps } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const NarrowFrame = styled.div({ maxInlineSize: '18rem' });
function ReplacementRoot(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} data-testid="replacement-root" />;
}
function SugarRoot(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} data-testid="sugar-root" />;
}
export const RootComponent: StoryObj<typeof HoldToConfirm> = {
  tags: ['!autodocs'], args: { label: 'Hold', confirmedLabel: 'Confirmed', confirmationAnnouncement: 'Confirmed', getHoldDescription: (duration) => `Hold for ${duration}.`, onConfirm: fn(), component: SugarRoot },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTestId('sugar-root')).toHaveAttribute('data-ui', 'hold-to-confirm');
  },
};
export const RootReplacement: StoryObj<typeof HoldToConfirm> = {
  tags: ['!autodocs'],
  args: { label: 'Hold to confirm', confirmedLabel: 'Confirmed', confirmationAnnouncement: 'Confirmed', getHoldDescription: (duration) => `Hold for ${duration}.`, duration: 100, onConfirm: fn(), component: SugarRoot, slots: { root: ReplacementRoot }, ref: fn(), className: 'consumer-root', title: 'consumer', slotProps: { root: { ref: fn(), title: 'slot', className: 'slot-root', 'data-ui': 'custom' } } },
  play: async ({ canvasElement, args, userEvent }) => {
    const root = within(canvasElement).getByTestId('replacement-root');
    await expect(root.tagName).toBe('BUTTON');
    await expect(root).toHaveClass('consumer-root', 'slot-root');
    await expect(root).toHaveAttribute('title', 'slot');
    await expect(root).toHaveAttribute('data-ui', 'hold-to-confirm custom');
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(args.slotProps?.root?.ref).toHaveBeenCalledWith(root);
    await expect(root).toHaveAccessibleDescription(/Hold for/);
    root.focus();
    await userEvent.keyboard('{Enter>}');
    await waitFor(() => expect(args.onConfirm).toHaveBeenCalledTimes(1));
    await userEvent.keyboard('{/Enter}');
  },
};

const TEST_DURATION = 240;
const settle = (ms = TEST_DURATION + 80) => new Promise((resolve) => setTimeout(resolve, ms));
const describeHold = (duration: string) => `Hold Space, Enter, or the primary pointer for ${duration}.`;
const holdSnippetBase = `import { HoldToConfirm } from '@jfrader/ui';

const describeHold = (duration: string) =>
  \`Hold Space, Enter, or the primary pointer for \${duration}.\`;`;
const Fixture = styled.div({ display: 'flex', flexWrap: 'wrap', gap: vars.space[4], alignItems: 'center' });
const FixtureButton = styled.button({ minBlockSize: vars.space[8], paddingInline: vars.space[3] });
const usage = `<HoldToConfirm label="Hold to revoke" confirmedLabel="Revoked"
  confirmationAnnouncement="Key revoked" getHoldDescription={describeHold}
  tone="danger" onConfirm={revokeKey} />`;

const meta = {
  title: 'Actions/HoldToConfirm',
  component: HoldToConfirm,
  tags: ['autodocs'],
  args: {
    label: 'Hold to revoke',
    confirmedLabel: 'Revoked',
    confirmationAnnouncement: 'Key revoked',
    getHoldDescription: describeHold,
    onConfirm: fn(),
    onValueChange: fn(),
    onHoldChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        component:
          'Require a continuous press or key hold to confirm high-impact actions.',
      },
      sections: [
        { title: 'Basic', stories: ['Default'] },
        { title: 'Tones', stories: ['Danger', 'Accent'] },
        { title: 'State', stories: ['ControlledAccept', 'InitiallyConfirmed', 'Disabled'] },
      ],
      usage: `### When to use
Use a hold-to-confirm button for high-consequence or destructive actions where an accidental click would cause disruption. Provide a dialog-based confirmation as an untimed alternative for users who cannot sustain continuous holds.

### Values and constraints

Hold Space, Enter, or the primary pointer continuously until the timer completes. Releasing early, pressing Escape or Tab, losing focus, or pointer cancellation cancels the attempt.

After confirmation, the button remains focusable with \`aria-disabled="true"\`. The \`onConfirm\` callback fires when the hold completes; if a subsequent asynchronous network request fails, set controlled \`value\` back to \`false\`.

### Keyboard and accessibility

Focus the button with Tab and begin holding with Space or Enter. A description states the hold duration; a polite status announces accepted completion. A controlled parent must accept confirmation on the first render after completion for that announcement to run.

### Motion

The morph presentation resizes the pill after completion without changing the hold interaction or native button. Reduced motion skips the size animation.`,
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

<HoldToConfirm
  label="Hold to revoke"
  confirmedLabel="Revoked"
  confirmationAnnouncement="Key revoked"
  getHoldDescription={describeHold}
  tone="danger"
  onConfirm={revokeKey}
/>`,
      },
    },
  },
} satisfies Meta<typeof HoldToConfirm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Continuous hold',
  parameters: {
    docs: {
      description: {
        story: 'Hold the button continuously with Space, Enter, or a pointer to confirm.',
      },
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKey({ revokeKey }: { revokeKey: () => void }) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
};
export const Accent: Story = {
  name: 'Accent tone',
  args: { tone: 'accent' },
  parameters: {
    docs: {
      description: {
        story: 'Highlight primary or high-priority confirmation actions.',
      },
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      tone="accent"
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
};
export const Danger: Story = {
  name: 'Destructive tone',
  args: { tone: 'danger' },
  parameters: {
    docs: {
      description: {
        story: 'Signal destructive or irreversible operations such as revoking credentials.',
      },
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      tone="danger"
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
};
export const Neutral: Story = {
  args: { tone: 'neutral' },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      tone="neutral"
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
};
export const Small: Story = {
  args: { size: 'sm' },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      size="sm"
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button').getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
  },
};
export const Medium: Story = {
  args: { size: 'md' },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      size="md"
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button').getBoundingClientRect().height).toBeGreaterThanOrEqual(40);
  },
};
export const Large: Story = {
  args: { size: 'lg' },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      size="lg"
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button').getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
  },
};
export const Disabled: Story = {
  name: 'Disabled',
  args: { disabled: true },
  parameters: {
    docs: {
      description: {
        story: 'Prevent interaction entirely when prerequisites are not met.',
      },
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      disabled
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button'));
    await expect(args.onConfirm).not.toHaveBeenCalled();
    await expect(args.onHoldChange).not.toHaveBeenCalled();
  },
};
export const InitiallyConfirmed: Story = {
  name: 'Already confirmed',
  args: { defaultValue: true },
  parameters: {
    docs: {
      description: {
        story: 'Render the confirmed state initially with disabled interaction.',
      },
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      defaultValue={true}
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Revoked' })).toHaveAttribute('aria-disabled', 'true');
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
  },
};
export const Confirmed: Story = {
  args: { duration: TEST_DURATION },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      duration={240}
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter>}');
    await waitFor(async () => {
      await expect(canvas.getByRole('button', { name: 'Revoked' })).toHaveAttribute(
        'data-state',
        'confirmed',
      );
    });
    await userEvent.keyboard('{/Enter}');
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(true);
    await expect(args.onHoldChange).toHaveBeenNthCalledWith(1, true);
    await expect(args.onHoldChange).toHaveBeenNthCalledWith(2, false);
    await expect(args.onHoldChange).toHaveBeenCalledTimes(2);
    await expect(canvas.getByRole('status')).toHaveTextContent('Key revoked');
    await userEvent.keyboard(' ');
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
  },
};
export const Holding: Story = {
  args: { duration: 600_000 },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      duration={600000}
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ >}');
    await expect(canvas.getByRole('button')).toHaveAttribute('data-state', 'holding');
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
  },
};
export const CancelEarly: Story = {
  args: { duration: TEST_DURATION },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      duration={240}
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    for (const key of [' ', 'Enter']) {
      await userEvent.keyboard(`{${key}>}`);
      await userEvent.keyboard(`{/${key}}`);
      await settle();
      await expect(canvas.getByRole('button')).toHaveAttribute('data-state', 'idle');
      await expect(args.onConfirm).not.toHaveBeenCalled();
    }
    await expect(args.onHoldChange).toHaveBeenCalledTimes(4);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

function ControlledFixture(args: HoldToConfirmProps) {
  const [value, setValue] = useState(false);
  return (
    <Fixture>
      <HoldToConfirm
        {...args}
        value={value}
        onValueChange={(next) => {
          args.onValueChange?.(next);
          setValue(next);
        }}
      />
      <FixtureButton type="button" onClick={() => setValue(false)}>
        Reset
      </FixtureButton>
    </Fixture>
  );
}
export const ControlledAccept: Story = {
  name: 'Controlled state',
  parameters: {
    docs: {
      description: {
        story: 'Control confirmation state from a parent component and support resetting.',
      },
      source: {
        language: 'tsx',
code: `import { useState } from 'react';
import { HoldToConfirm, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Actions = styled.div({ display: 'flex', flexWrap: 'wrap', gap: vars.space[4], alignItems: 'center' });
const ResetButton = styled.button({ minBlockSize: vars.space[8], paddingInline: vars.space[3] });

const describeHold = (duration: string) =>
  \`Hold Space, Enter, or the primary pointer for \${duration}.\`;

export function ControlledConfirmation({ revokeKey }: { revokeKey: () => void }) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Actions>
      <HoldToConfirm
        label="Hold to revoke"
        confirmedLabel="Revoked"
        confirmationAnnouncement="Key revoked"
        getHoldDescription={describeHold}
        value={confirmed}
        onValueChange={setConfirmed}
        duration={240}
        onConfirm={revokeKey}
      />
      <ResetButton type="button" onClick={() => setConfirmed(false)}>
        Reset
      </ResetButton>
    </Actions>
  );
}`,
      },
    },
  },
  args: { duration: TEST_DURATION },
  render: (args) => <ControlledFixture {...args} />,
  play: Confirmed.play,
};
export const ControlledReset: Story = {
  args: { duration: TEST_DURATION },
  render: (args) => <ControlledFixture {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ >}');
    await waitFor(async () => {
      await expect(canvas.getByRole('button', { name: 'Revoked' })).toHaveAttribute(
        'data-state',
        'confirmed',
      );
    });
    await userEvent.keyboard('{/ }');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await expect(canvas.getByRole('button', { name: 'Hold to revoke' })).toHaveAttribute(
      'data-state',
      'idle',
    );
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(true);
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
  },
};
export const ControlledReject: Story = {
  args: { value: false, duration: TEST_DURATION },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      duration={240}
      value={false}
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    const button = canvas.getByRole('button');
    await userEvent.tab();
    await userEvent.keyboard('{ >}');
    await settle();
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Enter>}');
    await settle();
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{/Enter}{/ }');
    await expect(button).toHaveAttribute('data-state', 'idle');
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
    await userEvent.keyboard('{Enter>}');
    await settle();
    await userEvent.keyboard('{/Enter}');
    await expect(args.onConfirm).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, true);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, true);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
export const Keyboard: Story = {
  args: { value: false, duration: TEST_DURATION, ref: fn() },
  render: (args) => (
    <Fixture>
      <HoldToConfirm {...args} />
      <FixtureButton type="button">
        Next
      </FixtureButton>
    </Fixture>
  ),
  play: async ({ canvas, userEvent, args }) => {
    const button = canvas.getByRole('button', { name: 'Hold to revoke' });
    await expect(args.ref).toHaveBeenCalledWith(button);
    await userEvent.tab();
    await expect(button.ownerDocument.activeElement).toBe(button);
    await expect(button.ownerDocument.defaultView!.getComputedStyle(button).outlineStyle).not.toBe('none');
    for (const key of [' ', 'Enter']) {
      await userEvent.keyboard(`{${key}>}`);
      await settle();
      await userEvent.keyboard(`{${key}>3}`);
      await userEvent.keyboard(`{/${key}}`);
    }
    await expect(args.onConfirm).toHaveBeenCalledTimes(2);
    await userEvent.keyboard('{ >}{Escape}{/ }');
    await settle();
    await expect(args.onConfirm).toHaveBeenCalledTimes(2);
    await userEvent.keyboard('{Enter>}');
    await userEvent.tab();
    await settle();
    await expect(button.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Next' }));
    await expect(args.onConfirm).toHaveBeenCalledTimes(2);
    await userEvent.keyboard('{/Enter}');
    await userEvent.tab({ shift: true });
    await expect(button.ownerDocument.activeElement).toBe(button);
  },
};

export const PointerCancel: Story = {
  args: { duration: TEST_DURATION },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      duration={240}
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    const button = canvas.getByRole('button');
    await userEvent.pointer({ target: button, keys: '[MouseLeft>]' });
    const view = button.ownerDocument.defaultView!;
    button.dispatchEvent(new view.PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));
    await userEvent.pointer({ target: button, keys: '[/MouseLeft]' });
    await settle();
    await expect(button).toHaveAttribute('data-state', 'idle');
    await expect(args.onConfirm).not.toHaveBeenCalled();
  },
};
export const PointerLeave: Story = {
  args: { duration: TEST_DURATION },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      duration={240}
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    const button = canvas.getByRole('button');
    await userEvent.pointer({ target: button, keys: '[MouseLeft>]' });
    await userEvent.pointer({
      target: button,
      coords: { clientX: button.getBoundingClientRect().right + 30, clientY: 0 },
    });
    await userEvent.pointer({ target: button, keys: '[/MouseLeft]' });
    await settle();
    await expect(args.onConfirm).not.toHaveBeenCalled();
    await expect(button).toHaveAttribute('data-state', 'idle');
  },
};
export const BackgroundCancel: Story = {
  args: { duration: TEST_DURATION },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      duration={240}
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ >}');
    const button = canvas.getByRole('button');
    button.ownerDocument.defaultView!.dispatchEvent(new Event('blur'));
    await settle();
    await userEvent.keyboard('{/ }');
    await expect(args.onConfirm).not.toHaveBeenCalled();
    await expect(button).toHaveAttribute('data-state', 'idle');
  },
};
function ChangeFixture(args: HoldToConfirmProps) {
  const [duration, setDuration] = useState(TEST_DURATION);
  const [disabled, setDisabled] = useState(false);
  return (
    <Fixture>
      <HoldToConfirm
        {...args}
        duration={duration}
        disabled={disabled}
        onHoldChange={(holding) => {
          args.onHoldChange?.(holding);
          if (holding)
            setTimeout(() => (args.disabled ? setDisabled(true) : setDuration(TEST_DURATION * 2)), 30);
        }}
      />
    </Fixture>
  );
}
export const DurationChange: Story = {
  render: (args) => <ChangeFixture {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ >}');
    await settle(TEST_DURATION * 3);
    await expect(args.onConfirm).not.toHaveBeenCalled();
    await expect(canvas.getByRole('button')).toHaveAttribute('data-state', 'idle');
    await userEvent.keyboard('{/ }');
  },
};
export const DisabledDuringHold: Story = { ...DurationChange, args: { disabled: true } };
export const LocaleDuration: Story = {
  args: {
    duration: 125,
    locale: 'es',
    getHoldDescription: (duration) => `Mantén Espacio, Intro o el puntero durante ${duration}.`,
  },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { HoldToConfirm } from '@jfrader/ui';

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={(duration) => \`Mantén Espacio, Intro o el puntero durante \${duration}.\`}
      duration={125}
      locale="es"
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button')).toHaveAccessibleDescription(
      'Mantén Espacio, Intro o el puntero durante 0,125 segundos.',
    );
  },
};
export const SubmillisecondDuration: Story = {
  args: { duration: 0.1, locale: 'en' },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      duration={0.1}
      locale="en"
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button')).toHaveAccessibleDescription(describeHold('0.0001 seconds'));
  },
};
export const FalsyLabels: Story = {
  render: (args) => (
    <Fixture>
      {[false, null, 0, ''].map((node, index) => (
        <HoldToConfirm
          {...args}
          key={index}
          label={node}
          confirmedLabel={node}
          icon={node}
          confirmedIcon={node}
          aria-label={node === 0 ? undefined : `Action ${index}`}
        />
      ))}
    </Fixture>
  ),
  play: async ({ canvas }) => {
    const buttons = canvas.getAllByRole('button');
    await expect(buttons[0]).toHaveTextContent('');
    await expect(buttons[1]).toHaveTextContent('');
    await expect(buttons[2]).toHaveTextContent('0');
    await expect(buttons[3]).toHaveTextContent('');
    await expect(buttons[0]!.firstElementChild).toBeEmptyDOMElement();
    await expect(buttons[1]!.firstElementChild).toBeEmptyDOMElement();
  },
};
export const ExternalAria: Story = {
  render: (args) => (
    <div>
      <span id="hold-name">Revoke access</span>
      <span id="hold-description">Cannot be undone</span>
      <HoldToConfirm
        {...args}
        label="Revoke access"
        aria-label="Custom action"
        aria-labelledby="hold-name missing-name"
        aria-describedby="hold-description missing-description"
      />
    </div>
  ),
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'Revoke access' });
    await expect(button).toHaveAttribute('aria-label', 'Custom action');
    await expect(button).toHaveAttribute('aria-labelledby', 'hold-name missing-name');
    await expect(button.getAttribute('aria-describedby')).toContain('hold-description missing-description');
    await expect(button).toHaveAccessibleDescription(`Cannot be undone ${describeHold('1.2 seconds')}`);
  },
};
export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  render: (args) => (
    <Fixture>
      {(['accent', 'danger', 'neutral'] as const).map((tone) => (
        <HoldToConfirm {...args} key={tone} tone={tone} />
      ))}
    </Fixture>
  ),
};
export const RTL: Story = {
  args: { dir: 'rtl', label: 'Mantén para revocar', confirmedLabel: 'Revocado' },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Mantén para revocar"
      confirmedLabel="Revocado"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      dir="rtl"
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button').matches(':dir(rtl)')).toBe(true);
  },
};
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      duration={240}
      onConfirm={revokeKey}
    />
  );
}`,
      },
      description: {
        story:
          'Structural timing fixture. Enable reduced motion in the browser to inspect instant cancellation; necessary linear elapsed-time feedback remains.',
      },
    },
  },
  ...CancelEarly,
};
export const ForcedColors: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      defaultValue={true}
      onConfirm={revokeKey}
    />
  );
}`,
      },
      description: {
        story:
          'Structural state fixture. Enable forced colors in the browser to inspect the ButtonText boundary, Highlight focus/fill, and double holding border.',
      },
    },
  },
  args: { defaultValue: true },
};

export const PointerLifecycle: Story = {
  args: { value: false, duration: TEST_DURATION },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      value={false}
      duration={240}
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    const button = canvas.getByRole('button');
    const view = button.ownerDocument.defaultView!;
    await userEvent.pointer({ target: button, keys: '[MouseLeft>]' });
    await expect(button).toHaveAttribute('data-state', 'holding');
    await settle();
    await userEvent.pointer({ target: button, keys: '[/MouseLeft]' });
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    for (const pointerType of ['touch', 'pen']) {
      const options = { bubbles: true, isPrimary: true, pointerType, pointerId: 42, button: 0 };
      button.dispatchEvent(new view.PointerEvent('pointerdown', options));
      await waitFor(async () => {
        await expect(button).toHaveAttribute('data-state', 'holding');
      });
      button.dispatchEvent(new view.PointerEvent('pointercancel', { ...options, pointerId: 43 }));
      await expect(button).toHaveAttribute('data-state', 'holding');
      await settle();
      button.dispatchEvent(new view.PointerEvent('pointerup', options));
    }
    await expect(args.onConfirm).toHaveBeenCalledTimes(3);
    button.dispatchEvent(
      new view.PointerEvent('pointerdown', { bubbles: true, isPrimary: false, pointerId: 99, button: 0 }),
    );
    await settle();
    await expect(args.onConfirm).toHaveBeenCalledTimes(3);
    button.dispatchEvent(
      new view.PointerEvent('pointerdown', { bubbles: true, isPrimary: true, pointerId: 44, button: 0 }),
    );
    button.dispatchEvent(new view.PointerEvent('lostpointercapture', { bubbles: true, pointerId: 44 }));
    await settle();
    await expect(args.onConfirm).toHaveBeenCalledTimes(3);
    button.dispatchEvent(
      new view.PointerEvent('pointerdown', { bubbles: true, isPrimary: true, pointerId: 45, button: 0 }),
    );
    button.ownerDocument.body.dispatchEvent(
      new view.PointerEvent('pointerup', { bubbles: true, pointerId: 45 }),
    );
    await settle();
    await expect(args.onConfirm).toHaveBeenCalledTimes(3);
    await expect(button).toHaveAttribute('data-state', 'idle');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
  },
};
export const FreshContinuousHold: Story = {
  args: { duration: TEST_DURATION },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      duration={240}
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ >}');
    await settle(TEST_DURATION / 2);
    await userEvent.keyboard('{/ }');
    await userEvent.keyboard('{ >}');
    await settle(TEST_DURATION / 2);
    await userEvent.keyboard('{/ }');
    await settle();
    await expect(args.onConfirm).not.toHaveBeenCalled();
    await expect(canvas.getByRole('button')).toHaveAttribute('data-state', 'idle');
    await userEvent.keyboard('{ >}');
    await settle();
    await userEvent.keyboard('{/ }');
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
  },
};
export const HiddenDocument: Story = {
  args: { duration: TEST_DURATION },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      duration={240}
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    const doc = canvas.getByRole('button').ownerDocument;
    await userEvent.tab();
    await userEvent.keyboard('{Enter>}');
    Object.defineProperty(doc, 'hidden', { configurable: true, value: true });
    try {
      doc.dispatchEvent(new Event('visibilitychange'));
      await settle();
      await expect(args.onConfirm).not.toHaveBeenCalled();
      await expect(canvas.getByRole('button')).toHaveAttribute('data-state', 'idle');
    } finally {
      Reflect.deleteProperty(doc, 'hidden');
    }
    await userEvent.keyboard('{/Enter}');
  },
};
function UnmountFixture(args: HoldToConfirmProps) {
  const [mounted, setMounted] = useState(true);
  return (
    <Fixture>
      {mounted && (
        <HoldToConfirm
          {...args}
          onHoldChange={(holding) => {
            args.onHoldChange?.(holding);
            if (holding) setTimeout(() => setMounted(false), 30);
          }}
        />
      )}
      <FixtureButton type="button">
        Next
      </FixtureButton>
    </Fixture>
  );
}
export const UnmountDuringHold: Story = {
  args: { duration: TEST_DURATION },
  render: (args) => <UnmountFixture {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter>}');
    await settle();
    await expect(canvas.queryByRole('button', { name: 'Hold to revoke' })).not.toBeInTheDocument();
    await expect(args.onConfirm).not.toHaveBeenCalled();
    await expect(args.onHoldChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{/Enter}');
  },
};
export const CallbackOrder: Story = {
  args: {
    duration: TEST_DURATION,
    onPointerDown: fn(),
    onPointerUp: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onClick: fn(),
  },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      duration={240}
      onPointerDown={(event) => console.log('pointerdown', event)}
      onPointerUp={(event) => console.log('pointerup', event)}
      onKeyDown={(event) => console.log('keydown', event)}
      onKeyUp={(event) => console.log('keyup', event)}
      onClick={(event) => console.log('click', event)}
      onConfirm={revokeKey}
      onHoldChange={(holding) => console.log('holding', holding)}
      onValueChange={(confirmed) => console.log('confirmed', confirmed)}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter>}');
    await settle();
    await userEvent.keyboard('{/Enter}');
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    const hold = args.onHoldChange as ReturnType<typeof fn>;
    const value = args.onValueChange as ReturnType<typeof fn>;
    const confirm = args.onConfirm as ReturnType<typeof fn>;
    await expect(hold.mock.invocationCallOrder[1]).toBeLessThan(value.mock.invocationCallOrder[0]!);
    await expect(value.mock.invocationCallOrder[0]).toBeLessThan(confirm.mock.invocationCallOrder[0]!);
    await userEvent.click(canvas.getByRole('button'));
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
  },
};
export const PreventedStart: Story = {
  args: {
    duration: TEST_DURATION,
    onKeyDown: fn((event) => event.preventDefault()),
    onPointerDown: fn((event) => event.preventDefault()),
  },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${holdSnippetBase}

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      duration={240}
      onKeyDown={(event) => event.preventDefault()}
      onPointerDown={(event) => event.preventDefault()}
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter>}');
    await settle();
    await userEvent.keyboard('{/Enter}');
    await userEvent.pointer({ target: canvas.getByRole('button'), keys: '[MouseLeft>]' });
    await settle();
    await userEvent.pointer({ target: canvas.getByRole('button'), keys: '[/MouseLeft]' });
    await expect(args.onConfirm).not.toHaveBeenCalled();
    await expect(args.onHoldChange).not.toHaveBeenCalled();
  },
};
// The slot API takes css values, so this story keeps the documented spelling.
const faceOverride = css({ columnGap: vars.space[5] });
const labelOverride = css({ fontWeight: vars.fontWeight.semibold });
function SlotStatus(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-slot="hold-to-confirm-status" />;
}
function SlotFace(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-slot="hold-to-confirm-face" />;
}
function SlotFill(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-slot="hold-to-confirm-fill" />;
}
function SlotFillLabel(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-slot="hold-to-confirm-fill-label" />;
}
export const SlotStyles: Story = {
  args: {
    slots: { status: SlotStatus, face: SlotFace, fill: SlotFill, fillLabel: SlotFillLabel },
    icon: '×',
    slotProps: { face: { sx: faceOverride }, fill: { sx: faceOverride }, label: { sx: labelOverride }, fillLabel: { sx: labelOverride } },
    sx: { borderRadius: vars.radius.sm },
  },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import type { ComponentPropsWithRef } from 'react';
import { HoldToConfirm } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

function SlotStatus(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-slot="hold-to-confirm-status" />;
}
function SlotFace(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-slot="hold-to-confirm-face" />;
}
function SlotFill(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-slot="hold-to-confirm-fill" />;
}
function SlotFillLabel(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-slot="hold-to-confirm-fill-label" />;
}

const describeHold = (duration: string) =>
  \`Hold Space, Enter, or the primary pointer for \${duration}.\`;

export function RevokeKeyButton({
  revokeKey,
}: {
  revokeKey: () => void;
}) {
  return (
    <HoldToConfirm
      label="Hold to revoke"
      confirmedLabel="Revoked"
      confirmationAnnouncement="Key revoked"
      getHoldDescription={describeHold}
      icon="×"
      slots={{
        status: SlotStatus,
        face: SlotFace,
        fill: SlotFill,
        fillLabel: SlotFillLabel,
      }}
      slotProps={{
        face: { sx: { columnGap: vars.space[5] } },
        fill: { sx: { columnGap: vars.space[5] } },
        label: { sx: { fontWeight: vars.fontWeight.semibold } },
        fillLabel: { sx: { fontWeight: vars.fontWeight.semibold } },
      }}
      sx={{ borderRadius: vars.radius.sm }}
      onConfirm={revokeKey}
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button');
    const view = button.ownerDocument.defaultView!;
    await expect(button.querySelectorAll('[data-slot="hold-to-confirm-face"]')).toHaveLength(1);
    await expect(button.querySelectorAll('[data-slot="hold-to-confirm-fill-label"]')).toHaveLength(1);
    await expect(button.querySelector('[data-slot="hold-to-confirm-fill"]')).toHaveAttribute('aria-hidden', 'true');
    await expect(view.getComputedStyle(button.firstElementChild!).columnGap).toBe('20px');
    await expect(
      view.getComputedStyle(button.querySelector('[data-ui="hold-to-confirm-fill"]')!).columnGap,
    ).toBe('20px');
    await expect(view.getComputedStyle(button.firstElementChild!.lastElementChild!).fontWeight).toBe('600');
    await expect(view.getComputedStyle(button).borderRadius).toBe('8px');
    const replacement = canvas.getByRole('status');
    await expect(replacement).toHaveAttribute('data-slot', 'hold-to-confirm-status');
    await expect(replacement).toHaveAttribute('aria-live', 'polite');
    await expect(replacement).toHaveAttribute('aria-atomic', 'true');
    await expect(view.getComputedStyle(replacement).position).toBe('absolute');
    await expect(canvas.getAllByRole('status')).toHaveLength(1);
  },
};
export const LongLabel: Story = {
  args: {
    label: 'Mantén pulsado para revocar permanentemente todos los permisos de acceso de este dispositivo',
    confirmedLabel: 'Se han revocado todos los permisos',
    size: 'sm',
  },
  render: (args) => (
    <NarrowFrame>
      <HoldToConfirm {...args} />
    </NarrowFrame>
  ),
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button');
    const text = button.firstElementChild!.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    await expect(text.right).toBeLessThanOrEqual(rect.right + 1);
    await expect(text.bottom).toBeLessThanOrEqual(rect.bottom + 1);
    await expect(rect.height).toBeGreaterThan(32);
  },
};
