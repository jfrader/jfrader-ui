import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { Button } from '../button';
import {
  PasswordStrength,
  estimatePasswordStrength,
  type PasswordRule,
} from './index';

const policy: readonly PasswordRule[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (value) => Array.from(value).length >= 8,
    remaining: (value) => Math.max(0, 8 - Array.from(value).length),
  },
  {
    id: 'upper',
    label: 'An uppercase letter',
    test: (value) => /[A-Z]/.test(value),
  },
  { id: 'number', label: 'A number', test: (value) => /[0-9]/.test(value) },
  {
    id: 'symbol',
    label: 'A symbol',
    test: (value) => /[^a-zA-Z0-9]/.test(value),
  },
];
const Frame = styled.div({
  maxInlineSize: '32rem',
  display: 'grid',
  gap: vars.space[4],
});
const usage = `const passwordPolicy = [
  { id: 'length', label: 'At least 8 characters', test: password => Array.from(password).length >= 8 },
  { id: 'number', label: 'A number', test: password => /[0-9]/.test(password) },
];

<PasswordStrength label="New password" name="password" rules={passwordPolicy} shortLength={8} />`;
const meta = {
  title: 'Inputs/PasswordStrength',
  component: PasswordStrength,
  tags: ['autodocs'],
  args: {
    label: 'New password',
    rules: policy,
    locale: 'en-GB',
    onValueChange: fn(),
    onRevealedChange: fn(),
  },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  parameters: {
    docs: {
      source: { code: usage, language: 'tsx' },
      description: {
        component:
          'Enter a new password and check it against your application’s password policy. Use PasswordField for sign-in and confirmation.',
      },
      usage: `### Policy\nPass explicit, synchronous rules with unique IDs. The level measures the share of rules met, not entropy, dictionary resistance or breach exposure. Enforce the same policy on the server. Do not treat level 4 as proof of security.\n\n### Values and forms\nPassword and reveal support independent controlled and uncontrolled state. The second onValueChange argument describes the proposed password; a rejected controlled edit leaves the displayed score unchanged. Native form reset restores the initial uncontrolled value without callbacks. The ref targets the input.\n\n### Keyboard and accessibility\nNative editing and submission apply. Tab moves through input and reveal; Enter or Space toggles reveal once. The read-only meter and requirements are not tab stops. Requirements include Met/Not met text; the atomic status never contains the password.\n\n### Customization\nUse fieldSlots/fieldSlotProps for PasswordField anatomy, slots/slotProps for feedback. locale formats counts; messages translates complete phrases. Supply an explicit locale for matching server/client output. CSS transitions stop under reduced motion.`,
    },
  },
} satisfies Meta<typeof PasswordStrength>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { defaultValue: 'Harbor2' } };
export const Empty: Story = { args: { defaultValue: '' } };
export const TooShort: Story = {
  args: { defaultValue: 'A1!', shortLength: 8 },
};
export const Weak: Story = { args: { defaultValue: 'a' } };
export const Fair: Story = { args: { defaultValue: 'A1' } };
export const Good: Story = { args: { defaultValue: 'A1!' } };
export const Strong: Story = { args: { defaultValue: 'Abcdef1!' } };
export const Error: Story = {
  args: {
    defaultValue: 'Abcdef1!',
    error: 'Choose a password you have not used before.',
    required: true,
  },
};
export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Abcdef1!' },
};
export const ReadOnly: Story = {
  args: { readOnly: true, defaultValue: 'Abcdef1!' },
};
export const Revealed: Story = {
  args: { defaultRevealed: true, defaultValue: 'Abcdef1!' },
};
export const LightTheme: Story = {
  args: Strong.args,
  globals: { theme: 'light' },
};
export const RTL: Story = { args: { ...Strong.args, dir: 'rtl' } };
export const ReducedMotion: Story = {
  args: Good.args,
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion in your browser to update feedback without transitions.',
      },
    },
  },
};
export const CustomRules: Story = {
  args: {
    rules: [
      {
        id: 'phrase',
        label: 'Use a passphrase',
        test: (value) => value.includes(' '),
      },
    ],
    defaultValue: 'four ordinary words here',
  },
};
export const FalsyNodes: Story = {
  args: {
    rules: [{ id: 'zero', label: 0, test: () => true }],
    description: 0,
    error: false,
    defaultValue: 'example',
  },
};
export const UnicodeCounting: Story = {
  args: {
    rules: [
      {
        id: 'entry',
        label: 'Enter at least two characters',
        test: (value) => Array.from(value).length >= 2,
      },
    ],
    defaultValue: '😀',
    shortLength: 2,
  },
};
export const Translated: Story = {
  args: {
    label: 'Nueva contraseña',
    locale: 'es-ES',
    fieldMessages: { reveal: 'Mostrar contraseña' },
    rules: [
      {
        id: 'length',
        label: 'Al menos 8 caracteres',
        test: (value) => Array.from(value).length >= 8,
      },
    ],
    defaultValue: 'ejemplo1',
    messages: {
      levels: { strong: 'Cumple la política' },
      meterLabel: 'Requisitos cumplidos',
      rulesLabel: 'Requisitos de la contraseña',
      ruleMet: 'Cumplido',
      ruleNotMet: 'Pendiente',
      summary: ({ formattedMet, formattedTotal }) =>
        `${formattedMet} de ${formattedTotal} requisitos cumplidos.`,
    },
  },
};
export const Sizes: Story = {
  render: (args) => (
    <Frame>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <PasswordStrength
          {...args}
          key={size}
          size={size}
          label={`New password (${size})`}
        />
      ))}
    </Frame>
  ),
};
export const Keyboard: Story = {
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const input = canvas.getByLabelText('New password');
    const reveal = canvas.getByRole('button', { name: 'Show password' });
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(input);
    await expect(getComputedStyle(input).outlineStyle).not.toBe('none');
    await userEvent.type(input, 'Abcdef1!');
    await expect(canvas.getByRole('meter')).toHaveAttribute(
      'aria-valuenow',
      '4',
    );
    await expect(canvas.getByRole('status')).not.toHaveTextContent('Abcdef1!');
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(reveal);
    await expect(getComputedStyle(reveal).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(args.onRevealedChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard(' ');
    await expect(args.onRevealedChange).toHaveBeenCalledTimes(2);
    await userEvent.tab({ shift: true });
    await expect(canvasElement.ownerDocument.activeElement).toBe(input);
  },
};
export const RejectedControlled: Story = {
  args: { value: 'A' },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.type(canvas.getByLabelText('New password'), '1');
    await expect(args.onValueChange).toHaveBeenLastCalledWith(
      'A1',
      expect.objectContaining({ level: 2, met: ['upper', 'number'] }),
    );
    await expect(canvas.getByLabelText('New password')).toHaveValue('A');
    await expect(canvas.getByRole('meter')).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
  },
};
export const ExternalAria: Story = {
  render: (args) => (
    <Frame>
      <span id="password-policy-note">Do not reuse a password.</span>
      <PasswordStrength
        {...args}
        aria-describedby="password-policy-note"
        description="Use a unique password."
        required
      />
    </Frame>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText(/^New password/);
    const ids = input.getAttribute('aria-describedby')!.split(' ');
    await expect(ids).toContain('password-policy-note');
    await expect(ids).toHaveLength(3);
    for (const id of ids)
      await expect(input.ownerDocument.getElementById(id)).not.toBeNull();
  },
};
export const FormReset: Story = {
  render: (args) => (
    <form>
      <PasswordStrength {...args} defaultValue="A" />
      <Button type="reset">Reset password</Button>
    </form>
  ),
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.type(canvas.getByLabelText('New password'), '1!');
    await expect(canvas.getByRole('meter')).toHaveAttribute(
      'aria-valuenow',
      '3',
    );
    const calls = (args.onValueChange as ReturnType<typeof fn>).mock.calls
      .length;
    await userEvent.click(
      canvas.getByRole('button', { name: 'Reset password' }),
    );
    await waitFor(() =>
      expect(canvas.getByLabelText('New password')).toHaveValue('A'),
    );
    await expect(canvas.getByRole('meter')).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
    await expect(args.onValueChange).toHaveBeenCalledTimes(calls);
  },
};
export const ExternalUpdates: Story = {
  render: (args) => {
    const [value, setValue] = useState('A');
    return (
      <Frame>
        <PasswordStrength {...args} value={value} />
        <Button onClick={() => setValue('Abcdef1!')}>
          Use generated password
        </Button>
      </Frame>
    );
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Use generated password' }),
    );
    await expect(canvas.getByRole('meter')).toHaveAttribute(
      'aria-valuenow',
      '4',
    );
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const Scoring: Story = {
  play: async () => {
    await expect(estimatePasswordStrength('', policy)).toEqual({
      level: 0,
      short: false,
      met: [],
      total: 4,
    });
    await expect(estimatePasswordStrength('Abcdef1!', policy).level).toBe(4);
    await expect(estimatePasswordStrength('A', policy).level).toBe(1);
    await expect(
      estimatePasswordStrength('Abcdef1!', policy, { shortLength: 9 }).short,
    ).toBe(true);
    await expect(
      estimatePasswordStrength(
        '😀',
        [{ id: 'any', label: 0, test: () => true }],
        { shortLength: 2 },
      ).level,
    ).toBe(1);
    await expect(
      estimatePasswordStrength(
        '😀',
        [{ id: 'any', label: 0, test: () => true }],
        { shortLength: 1 },
      ).level,
    ).toBe(4);
    await expect(() => estimatePasswordStrength('', [])).toThrow();
    await expect(() =>
      estimatePasswordStrength('', [policy[0]!, policy[0]!]),
    ).toThrow();
    await expect(() =>
      estimatePasswordStrength('', policy, { shortLength: -1 }),
    ).toThrow();
    for (const total of [1, 3, 5]) {
      const rules = Array.from({ length: total }, (_, id) => ({
        id: `rule-${id}`,
        label: id,
        test: (value: string) => value.length > id,
      }));
      await expect(estimatePasswordStrength('12345', rules).level).toBe(4);
      await expect(estimatePasswordStrength('1', rules).met).toEqual([
        'rule-0',
      ]);
    }
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    await expect(
      estimatePasswordStrength(
        '👨‍👩‍👧‍👦',
        [{ id: 'any', label: 'Entry', test: () => true }],
        {
          shortLength: 2,
          countCharacters: (value) =>
            Array.from(segmenter.segment(value)).length,
        },
      ).level,
    ).toBe(1);
  },
};
