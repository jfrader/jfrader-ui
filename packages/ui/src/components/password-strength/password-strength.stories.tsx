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
          'Enter a new password and check it against your application’s password policy.',
      },
      sections: [
        { title: 'Password policy', stories: ['Default', 'TooShort', 'Strong'] },
        { title: 'Validation', stories: ['Error'] },
      ],
      usage: `### Policy
Use PasswordField for sign-in and confirmation. Rules must be synchronous and have unique IDs. The level measures the share of rules met, not entropy, dictionary resistance or breach exposure. Enforce the same policy on the server; level 4 is not proof of security.

### Values and constraints

Rejecting a controlled edit leaves the displayed score unchanged. Native form reset restores the initial uncontrolled value without callbacks; controlled state remains parent-owned.

### Keyboard and accessibility

Native editing and submission apply. Tab moves through input and reveal; Enter or Space toggles reveal once. The read-only meter and requirements are not tab stops. Requirements include Met/Not met text; the atomic status never contains the password.

### Localization

Translate complete phrases and supply the same locale on the server and client. Transitions stop under reduced motion.`,
    },
  },
} satisfies Meta<typeof PasswordStrength>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: 'Check a new password', parameters: { docs: { description: { story: 'Type a password to update the meter and the remaining requirements.' }, source: { language: 'tsx', code: `import { PasswordStrength, type PasswordRule } from '@jfrader/ui';

const policy: readonly PasswordRule[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (value) => Array.from(value).length >= 8,
    remaining: (value) => Math.max(0, 8 - Array.from(value).length),
  },
  { id: 'upper', label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { id: 'number', label: 'A number', test: (value) => /[0-9]/.test(value) },
  { id: 'symbol', label: 'A symbol', test: (value) => /[^a-zA-Z0-9]/.test(value) },
];

<PasswordStrength label="New password" rules={policy} locale="en-GB" defaultValue="Harbor2" />` } } }, args: { defaultValue: 'Harbor2' } };
export const Empty: Story = { parameters: { docs: { source: { language: 'tsx', code: `import { PasswordStrength, type PasswordRule } from '@jfrader/ui';

const policy: readonly PasswordRule[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (value) => Array.from(value).length >= 8,
    remaining: (value) => Math.max(0, 8 - Array.from(value).length),
  },
  { id: 'upper', label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { id: 'number', label: 'A number', test: (value) => /[0-9]/.test(value) },
  { id: 'symbol', label: 'A symbol', test: (value) => /[^a-zA-Z0-9]/.test(value) },
];

<PasswordStrength label="New password" rules={policy} locale="en-GB" defaultValue="" />` } } }, args: { defaultValue: '' } };
export const TooShort: Story = {
  name: 'Minimum length',
  parameters: {
    docs: {
      description: { story: 'Show the minimum-length warning even when other requirements are met.' },
      source: {
        language: 'tsx',
        code: `import { PasswordStrength, type PasswordRule } from '@jfrader/ui';

const policy: readonly PasswordRule[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (value) => Array.from(value).length >= 8,
    remaining: (value) => Math.max(0, 8 - Array.from(value).length),
  },
  { id: 'upper', label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { id: 'number', label: 'A number', test: (value) => /[0-9]/.test(value) },
  { id: 'symbol', label: 'A symbol', test: (value) => /[^a-zA-Z0-9]/.test(value) },
];

<PasswordStrength label="New password" rules={policy} locale="en-GB" defaultValue="A1!" shortLength={8} />`,
      },
    },
  },
  args: { defaultValue: 'A1!', shortLength: 8 },
};
export const Weak: Story = { parameters: { docs: { source: { language: 'tsx', code: `import { PasswordStrength, type PasswordRule } from '@jfrader/ui';

const policy: readonly PasswordRule[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (value) => Array.from(value).length >= 8,
    remaining: (value) => Math.max(0, 8 - Array.from(value).length),
  },
  { id: 'upper', label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { id: 'number', label: 'A number', test: (value) => /[0-9]/.test(value) },
  { id: 'symbol', label: 'A symbol', test: (value) => /[^a-zA-Z0-9]/.test(value) },
];

<PasswordStrength label="New password" rules={policy} locale="en-GB" defaultValue="a" />` } } }, args: { defaultValue: 'a' } };
export const Fair: Story = { parameters: { docs: { source: { language: 'tsx', code: `import { PasswordStrength, type PasswordRule } from '@jfrader/ui';

const policy: readonly PasswordRule[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (value) => Array.from(value).length >= 8,
    remaining: (value) => Math.max(0, 8 - Array.from(value).length),
  },
  { id: 'upper', label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { id: 'number', label: 'A number', test: (value) => /[0-9]/.test(value) },
  { id: 'symbol', label: 'A symbol', test: (value) => /[^a-zA-Z0-9]/.test(value) },
];

<PasswordStrength label="New password" rules={policy} locale="en-GB" defaultValue="A1" />` } } }, args: { defaultValue: 'A1' } };
export const Good: Story = { parameters: { docs: { source: { language: 'tsx', code: `import { PasswordStrength, type PasswordRule } from '@jfrader/ui';

const policy: readonly PasswordRule[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (value) => Array.from(value).length >= 8,
    remaining: (value) => Math.max(0, 8 - Array.from(value).length),
  },
  { id: 'upper', label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { id: 'number', label: 'A number', test: (value) => /[0-9]/.test(value) },
  { id: 'symbol', label: 'A symbol', test: (value) => /[^a-zA-Z0-9]/.test(value) },
];

<PasswordStrength label="New password" rules={policy} locale="en-GB" defaultValue="A1!" />` } } }, args: { defaultValue: 'A1!' } };
export const Strong: Story = { name: 'All requirements met', parameters: { docs: { description: { story: 'Show a password that meets every application rule.' }, source: { language: 'tsx', code: `import { PasswordStrength, type PasswordRule } from '@jfrader/ui';

const policy: readonly PasswordRule[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (value) => Array.from(value).length >= 8,
    remaining: (value) => Math.max(0, 8 - Array.from(value).length),
  },
  { id: 'upper', label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { id: 'number', label: 'A number', test: (value) => /[0-9]/.test(value) },
  { id: 'symbol', label: 'A symbol', test: (value) => /[^a-zA-Z0-9]/.test(value) },
];

<PasswordStrength label="New password" rules={policy} locale="en-GB" defaultValue="Abcdef1!" />` } } }, args: { defaultValue: 'Abcdef1!' } };
export const Error: Story = {
  name: 'Server validation',
  parameters: {
    docs: {
      description: { story: 'Keep a server validation message beside the policy feedback.' },
      source: {
        language: 'tsx',
        code: `import { PasswordStrength, type PasswordRule } from '@jfrader/ui';

const policy: readonly PasswordRule[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (value) => Array.from(value).length >= 8,
    remaining: (value) => Math.max(0, 8 - Array.from(value).length),
  },
  { id: 'upper', label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { id: 'number', label: 'A number', test: (value) => /[0-9]/.test(value) },
  { id: 'symbol', label: 'A symbol', test: (value) => /[^a-zA-Z0-9]/.test(value) },
];

<PasswordStrength
  label="New password"
  rules={policy}
  locale="en-GB"
  defaultValue="Abcdef1!"
  error="Choose a password you have not used before."
  required
/>`,
      },
    },
  },
  args: {
    defaultValue: 'Abcdef1!',
    error: 'Choose a password you have not used before.',
    required: true,
  },
};
export const Disabled: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { PasswordStrength, type PasswordRule } from '@jfrader/ui';

const policy: readonly PasswordRule[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (value) => Array.from(value).length >= 8,
    remaining: (value) => Math.max(0, 8 - Array.from(value).length),
  },
  { id: 'upper', label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { id: 'number', label: 'A number', test: (value) => /[0-9]/.test(value) },
  { id: 'symbol', label: 'A symbol', test: (value) => /[^a-zA-Z0-9]/.test(value) },
];

<PasswordStrength label="New password" rules={policy} locale="en-GB" defaultValue="Abcdef1!" disabled />`,
      },
    },
  },
  args: { disabled: true, defaultValue: 'Abcdef1!' },
};
export const ReadOnly: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { PasswordStrength, type PasswordRule } from '@jfrader/ui';

const policy: readonly PasswordRule[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (value) => Array.from(value).length >= 8,
    remaining: (value) => Math.max(0, 8 - Array.from(value).length),
  },
  { id: 'upper', label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { id: 'number', label: 'A number', test: (value) => /[0-9]/.test(value) },
  { id: 'symbol', label: 'A symbol', test: (value) => /[^a-zA-Z0-9]/.test(value) },
];

<PasswordStrength label="New password" rules={policy} locale="en-GB" defaultValue="Abcdef1!" readOnly />`,
      },
    },
  },
  args: { readOnly: true, defaultValue: 'Abcdef1!' },
};
export const Revealed: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { PasswordStrength, type PasswordRule } from '@jfrader/ui';

const policy: readonly PasswordRule[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (value) => Array.from(value).length >= 8,
    remaining: (value) => Math.max(0, 8 - Array.from(value).length),
  },
  { id: 'upper', label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { id: 'number', label: 'A number', test: (value) => /[0-9]/.test(value) },
  { id: 'symbol', label: 'A symbol', test: (value) => /[^a-zA-Z0-9]/.test(value) },
];

<PasswordStrength label="New password" rules={policy} locale="en-GB" defaultValue="Abcdef1!" defaultRevealed />`,
      },
    },
  },
  args: { defaultRevealed: true, defaultValue: 'Abcdef1!' },
};
export const LightTheme: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { PasswordStrength, type PasswordRule } from '@jfrader/ui';

const policy: readonly PasswordRule[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (value) => Array.from(value).length >= 8,
    remaining: (value) => Math.max(0, 8 - Array.from(value).length),
  },
  { id: 'upper', label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { id: 'number', label: 'A number', test: (value) => /[0-9]/.test(value) },
  { id: 'symbol', label: 'A symbol', test: (value) => /[^a-zA-Z0-9]/.test(value) },
];

<PasswordStrength label="New password" rules={policy} locale="en-GB" defaultValue="Abcdef1!" />`,
      },
    },
  },
  args: Strong.args,
  globals: { theme: 'light' },
};
export const RTL: Story = { parameters: { docs: { source: { language: 'tsx', code: `import { PasswordStrength, type PasswordRule } from '@jfrader/ui';

const policy: readonly PasswordRule[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (value) => Array.from(value).length >= 8,
    remaining: (value) => Math.max(0, 8 - Array.from(value).length),
  },
  { id: 'upper', label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { id: 'number', label: 'A number', test: (value) => /[0-9]/.test(value) },
  { id: 'symbol', label: 'A symbol', test: (value) => /[^a-zA-Z0-9]/.test(value) },
];

<PasswordStrength label="New password" rules={policy} locale="en-GB" defaultValue="Abcdef1!" dir="rtl" />` } } }, args: { ...Strong.args, dir: 'rtl' } };
export const ReducedMotion: Story = {
  args: Good.args,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { PasswordStrength, type PasswordRule } from '@jfrader/ui';

const policy: readonly PasswordRule[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (value) => Array.from(value).length >= 8,
    remaining: (value) => Math.max(0, 8 - Array.from(value).length),
  },
  { id: 'upper', label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { id: 'number', label: 'A number', test: (value) => /[0-9]/.test(value) },
  { id: 'symbol', label: 'A symbol', test: (value) => /[^a-zA-Z0-9]/.test(value) },
];

<PasswordStrength label="New password" rules={policy} locale="en-GB" defaultValue="A1!" />`,
      },
      description: {
        story:
          'Enable reduced motion in your browser to update feedback without transitions.',
      },
    },
  },
};
export const CustomRules: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { PasswordStrength, type PasswordRule } from '@jfrader/ui';

const rules: readonly PasswordRule[] = [
  {
    id: 'phrase',
    label: 'Use a passphrase',
    test: (value) => value.includes(' '),
  },
];

<PasswordStrength
  label="New password"
  rules={rules}
  locale="en-GB"
  defaultValue="four ordinary words here"
/>`,
      },
    },
  },
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { PasswordStrength, type PasswordRule } from '@jfrader/ui';

const rules: readonly PasswordRule[] = [{ id: 'zero', label: 0, test: () => true }];

<PasswordStrength
  label="New password"
  rules={rules}
  locale="en-GB"
  description={0}
  error={false}
  defaultValue="example"
/>`,
      },
    },
  },
  args: {
    rules: [{ id: 'zero', label: 0, test: () => true }],
    description: 0,
    error: false,
    defaultValue: 'example',
  },
};
export const UnicodeCounting: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { PasswordStrength, type PasswordRule } from '@jfrader/ui';

const rules: readonly PasswordRule[] = [
  {
    id: 'entry',
    label: 'Enter at least two characters',
    test: (value) => Array.from(value).length >= 2,
  },
];

<PasswordStrength label="New password" rules={rules} locale="en-GB" defaultValue="😀" shortLength={2} />`,
      },
    },
  },
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { PasswordStrength, type PasswordRule } from '@jfrader/ui';

const rules: readonly PasswordRule[] = [
  {
    id: 'length',
    label: 'Al menos 8 caracteres',
    test: (value) => Array.from(value).length >= 8,
  },
];

<PasswordStrength
  label="Nueva contraseña"
  locale="es-ES"
  fieldMessages={{ reveal: 'Mostrar contraseña' }}
  rules={rules}
  defaultValue="ejemplo1"
  messages={{
    levels: { strong: 'Cumple la política' },
    meterLabel: 'Requisitos cumplidos',
    rulesLabel: 'Requisitos de la contraseña',
    ruleMet: 'Cumplido',
    ruleNotMet: 'Pendiente',
    summary: ({ formattedMet, formattedTotal }) =>
      \`\${formattedMet} de \${formattedTotal} requisitos cumplidos.\`,
  }}
/>`,
      },
    },
  },
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { PasswordStrength, type PasswordRule } from '@jfrader/ui';

const policy: readonly PasswordRule[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (value) => Array.from(value).length >= 8,
    remaining: (value) => Math.max(0, 8 - Array.from(value).length),
  },
  { id: 'upper', label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { id: 'number', label: 'A number', test: (value) => /[0-9]/.test(value) },
  { id: 'symbol', label: 'A symbol', test: (value) => /[^a-zA-Z0-9]/.test(value) },
];

export function ControlledPasswordStrength() {
  const [value] = useState('A');

  return (
    <PasswordStrength
      label="New password"
      rules={policy}
      locale="en-GB"
      value={value}
      onValueChange={() => {}}
    />
  );
}`,
      },
    },
  },
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
