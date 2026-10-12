import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { HoldToConfirm, type HoldToConfirmProps } from './index';

const TEST_DURATION = 240;
const settle = (ms = TEST_DURATION + 80) => new Promise((resolve) => setTimeout(resolve, ms));
const describeHold = (duration: string) => `Hold Space, Enter, or the primary pointer for ${duration}.`;
const fixtureStyle = css({ display: 'flex', flexWrap: 'wrap', gap: vars.space[4], alignItems: 'center' });
const fixtureButton = css({ minBlockSize: vars.space[8], paddingInline: vars.space[3] });
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
      source: { code: usage },
      description: {
        component:
          'Native button with timed activation: hold Space, Enter, or the primary pointer continuously. Release early, Escape, Tab, blur, or pointer cancellation abandons the attempt. A completed button stays focusable with aria-disabled. Provide an ordinary confirmation Button in a Dialog as an untimed alternative. For a failed request, reset controlled value to false; onConfirm reports the interaction, not an async result.',
      },
    },
  },
} satisfies Meta<typeof HoldToConfirm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Accent: Story = { args: { tone: 'accent' } };
export const Danger: Story = { args: { tone: 'danger' } };
export const Neutral: Story = { args: { tone: 'neutral' } };
export const Small: Story = {
  args: { size: 'sm' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button').getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
  },
};
export const Medium: Story = {
  args: { size: 'md' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button').getBoundingClientRect().height).toBeGreaterThanOrEqual(39);
  },
};
export const Large: Story = {
  args: { size: 'lg' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button').getBoundingClientRect().height).toBeGreaterThanOrEqual(47);
  },
};
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button'));
    await expect(args.onConfirm).not.toHaveBeenCalled();
    await expect(args.onHoldChange).not.toHaveBeenCalled();
  },
};
export const InitiallyConfirmed: Story = {
  args: { defaultValue: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Revoked' })).toHaveAttribute('aria-disabled', 'true');
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
  },
};
export const Confirmed: Story = {
  args: { duration: TEST_DURATION },
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
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ >}');
    await expect(canvas.getByRole('button')).toHaveAttribute('data-state', 'holding');
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
  },
};
export const CancelEarly: Story = {
  args: { duration: TEST_DURATION },
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
    <div css={fixtureStyle}>
      <HoldToConfirm
        {...args}
        value={value}
        onValueChange={(next) => {
          args.onValueChange?.(next);
          setValue(next);
        }}
      />
      <button type="button" css={fixtureButton} onClick={() => setValue(false)}>
        Reset
      </button>
    </div>
  );
}
export const ControlledAccept: Story = {
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
    <div css={fixtureStyle}>
      <HoldToConfirm {...args} />
      <button css={fixtureButton} type="button">
        Next
      </button>
    </div>
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
    <div css={fixtureStyle}>
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
    </div>
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
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button')).toHaveAccessibleDescription(
      'Mantén Espacio, Intro o el puntero durante 0,125 segundos.',
    );
  },
};
export const SubmillisecondDuration: Story = {
  args: { duration: 0.1, locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button')).toHaveAccessibleDescription(describeHold('0.0001 seconds'));
  },
};
export const FalsyLabels: Story = {
  render: (args) => (
    <div css={fixtureStyle}>
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
    </div>
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
    <div css={fixtureStyle}>
      {(['accent', 'danger', 'neutral'] as const).map((tone) => (
        <HoldToConfirm {...args} key={tone} tone={tone} />
      ))}
    </div>
  ),
};
export const RTL: Story = {
  args: { dir: 'rtl', label: 'Mantén para revocar', confirmedLabel: 'Revocado' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button').matches(':dir(rtl)')).toBe(true);
  },
};
export const ReducedMotion: Story = {
  parameters: {
    docs: {
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
    <div css={fixtureStyle}>
      {mounted && (
        <HoldToConfirm
          {...args}
          onHoldChange={(holding) => {
            args.onHoldChange?.(holding);
            if (holding) setTimeout(() => setMounted(false), 30);
          }}
        />
      )}
      <button type="button" css={fixtureButton}>
        Next
      </button>
    </div>
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
const faceOverride = css({ columnGap: vars.space[5] });
const labelOverride = css({ fontWeight: vars.fontWeight.semibold });
export const SlotStyles: Story = {
  args: {
    icon: '×',
    slotProps: { face: { css: faceOverride }, label: { css: labelOverride } },
    sx: { borderRadius: vars.radius.sm },
  },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button');
    const view = button.ownerDocument.defaultView!;
    await expect(view.getComputedStyle(button.firstElementChild!).columnGap).toBe('20px');
    await expect(
      view.getComputedStyle(button.querySelector('[data-ui="hold-to-confirm-fill"]')!).columnGap,
    ).toBe('20px');
    await expect(view.getComputedStyle(button.firstElementChild!.lastElementChild!).fontWeight).toBe('600');
    await expect(view.getComputedStyle(button).borderRadius).toBe('8px');
  },
};
export const LongLabel: Story = {
  args: {
    label: 'Mantén pulsado para revocar permanentemente todos los permisos de acceso de este dispositivo',
    confirmedLabel: 'Se han revocado todos los permisos',
    size: 'sm',
  },
  render: (args) => (
    <div style={{ maxInlineSize: '18rem' }}>
      <HoldToConfirm {...args} />
    </div>
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
