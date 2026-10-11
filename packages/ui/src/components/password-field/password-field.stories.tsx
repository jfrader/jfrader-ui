import { useId, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, type Mock } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { PasswordField, type PasswordFieldProps, type PasswordFieldSize } from './index';

const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly PasswordFieldSize[];
const HEIGHTS = { sm: 32, md: 40, lg: 48 } as const;
const REVEAL_SIZES = { sm: 24, md: 32, lg: 40 } as const;
// motion.duration.base plus a frame of slack, so the slash is read after its transition.
const SLASH_SETTLE_MS = 200;
const usage = `<PasswordField label="Password" name="password" autoComplete="current-password" required />`;

const stackStyle = css({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '320px',
});

const meta = {
  title: 'Inputs/PasswordField',
  component: PasswordField,
  tags: ['autodocs'],
  args: {
    label: 'Password',
    name: 'password',
    autoComplete: 'current-password',
    size: 'md',
    onChange: fn(),
    onValueChange: fn(),
    onRevealedChange: fn(),
  },
  argTypes: {
    size: { control: 'radio', options: SIZES },
    disabled: { control: 'boolean' },
    readOnly: { control: 'boolean' },
    required: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div css={stackStyle}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      source: { code: usage },
      description: {
        component:
          'Secret entry for sign-in, confirmation, tokens and API keys. One native input switches between `password` and `text`, so value, selection, focus and password managers survive a reveal. The reveal is a native toggle button with a stable name, `aria-pressed` for its state and `aria-controls` for the input. Keyboard: native editing; Tab moves input → reveal → page; Enter or Space on the reveal toggles once and never submits; Enter in the input submits the form natively; Escape does nothing. `value` and `revealed` are independent controlled/uncontrolled axes; a native form reset restores the uncontrolled ones without callbacks. Use TextField for ordinary text.',
      },
    },
  },
} satisfies Meta<typeof PasswordField>;

export default meta;

type Story = StoryObj<typeof meta>;

function parts(canvasElement: HTMLElement) {
  const root = canvasElement.querySelector<HTMLElement>('[data-ui="password-field"]')!;
  const input = root.querySelector('input')!;
  const button = root.querySelector('button')!;
  return { root, input, button };
}

async function assertFocus(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expect(getComputedStyle(element).outlineStyle).not.toBe('none');
  // Fractional devicePixelRatios device-snap outline widths (authored 2px computes ~1.49px).
  await expect(parseFloat(getComputedStyle(element).outlineWidth)).toBeGreaterThan(1);
}

async function assertMasked(input: HTMLInputElement, button: HTMLButtonElement) {
  await expect(input).toHaveAttribute('type', 'password');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
}

async function assertRevealed(input: HTMLInputElement, button: HTMLButtonElement) {
  await expect(input).toHaveAttribute('type', 'text');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

const slashOffset = (button: HTMLButtonElement) =>
  parseFloat(getComputedStyle(button.querySelector('svg > [data-slash]')!).strokeDashoffset);

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    const { root, input, button } = parts(canvasElement);
    await expect(canvas.getByLabelText('Password')).toBe(input);
    await expect(canvas.getByRole('button', { name: 'Show password' })).toBe(button);
    await assertMasked(input, button);
    await expect(button).toHaveAttribute('type', 'button');
    await expect(button).toHaveAttribute('aria-controls', input.id);
    await expect(input).not.toHaveAttribute('aria-invalid');
    await expect(input).not.toHaveAttribute('aria-describedby');
    await expect(input).not.toHaveAttribute('aria-labelledby');
    await expect(input).toHaveAttribute('spellcheck', 'false');
    await expect(input).toHaveAttribute('autocomplete', 'current-password');
    await expect(root.querySelector('[aria-hidden="true"] > svg')).not.toBeNull();
    await expect(slashOffset(button)).toBeGreaterThan(0.5);
    const inputRect = input.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    await expect(buttonRect.left).toBeGreaterThan(inputRect.left + inputRect.width / 2);
    await expect(buttonRect.right).toBeLessThanOrEqual(inputRect.right);
  },
};

export const Revealed: Story = {
  args: { defaultRevealed: true, defaultValue: 'correct horse battery staple' },
  play: async ({ canvasElement }) => {
    const { input, button } = parts(canvasElement);
    await assertRevealed(input, button);
    await expect(input).toHaveValue('correct horse battery staple');
    // Mounting already on: the slash is drawn without a transition.
    await expect(slashOffset(button)).toBeLessThan(0.5);
  },
};

export const Sizes: Story = {
  render: (args) => (
    <>
      {SIZES.map((size) => (
        <PasswordField {...args} key={size} size={size} label={`Size ${size}`} />
      ))}
    </>
  ),
  play: async ({ canvas }) => {
    for (const size of SIZES) {
      const input = canvas.getByLabelText(`Size ${size}`);
      const button = input.nextElementSibling as HTMLButtonElement;
      const inputRect = input.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      await expect(Math.round(inputRect.height)).toBe(HEIGHTS[size]);
      await expect(Math.round(buttonRect.width)).toBe(REVEAL_SIZES[size]);
      await expect(Math.round(buttonRect.height)).toBe(REVEAL_SIZES[size]);
      await expect(buttonRect.top).toBeGreaterThanOrEqual(inputRect.top);
      await expect(buttonRect.bottom).toBeLessThanOrEqual(inputRect.bottom);
      // The reveal lane is reserved: text never runs under the button.
      await expect(parseFloat(getComputedStyle(input).paddingRight)).toBeGreaterThanOrEqual(
        inputRect.right - buttonRect.left,
      );
    }
  },
};

export const WithDescription: Story = {
  args: { description: 'At least 12 characters.' },
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText('Password');
    await expect(input).toHaveAccessibleDescription('At least 12 characters.');
    await expect(canvas.queryByRole('alert')).toBeNull();
  },
};

export const WithError: Story = {
  args: { description: 'At least 12 characters.', error: 'Password is incorrect.' },
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText('Password');
    const alert = canvas.getByRole('alert');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input.getAttribute('aria-describedby')!.split(' ')).toEqual([
      `${input.id}-description`,
      alert.id,
    ]);
    await expect(input).toHaveAccessibleDescription('At least 12 characters. Password is incorrect.');
  },
};

export const Required: Story = {
  args: { required: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText(/Password/)).toBeRequired();
    await expect(canvas.getByText('*')).toHaveAttribute('aria-hidden', 'true');
    await expect(canvas.getByRole('button', { name: 'Show password' })).not.toBeRequired();
  },
};

export const ReadOnly: Story = {
  args: { readOnly: true, defaultValue: 'stored-secret' },
  play: async ({ canvasElement, userEvent, args }) => {
    const { input, button } = parts(canvasElement);
    await userEvent.type(input, 'x');
    await expect(input).toHaveValue('stored-secret');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(button);
    await assertRevealed(input, button);
    await expect(args.onRevealedChange).toHaveBeenCalledTimes(1);
    await expect(args.onRevealedChange).toHaveBeenLastCalledWith(true);
  },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'locked-secret' },
  play: async ({ canvasElement, userEvent, args }) => {
    const { input, button } = parts(canvasElement);
    await expect(input).toBeDisabled();
    await expect(button).toBeDisabled();
    await userEvent.click(button);
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).not.toBe(input);
    await expect(input.ownerDocument.activeElement).not.toBe(button);
    await assertMasked(input, button);
    await expect(args.onRevealedChange).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const Uncontrolled: Story = {
  args: { ref: fn() },
  play: async ({ canvasElement, userEvent, args }) => {
    const { input, button } = parts(canvasElement);
    const ref = args.ref as Mock;
    const refCalls = ref.mock.calls.length;
    await expect(ref.mock.calls.at(-1)?.[0]).toBe(input);
    await userEvent.type(input, 'hunter2');
    input.setSelectionRange(2, 5);
    await userEvent.click(button);
    await assertRevealed(input, button);
    await expect(button.ownerDocument.activeElement).toBe(button);
    const [root] = canvasElement.querySelectorAll('[data-ui="password-field"]');
    // Same element: the type flips in place, so value, selection and the ref survive.
    await expect(root!.querySelector('input')).toBe(input);
    await expect(input).toHaveValue('hunter2');
    await expect([input.selectionStart, input.selectionEnd]).toEqual([2, 5]);
    await expect(ref).toHaveBeenCalledTimes(refCalls);
    await waitFor(() => expect(slashOffset(button)).toBeLessThan(0.5), { timeout: SLASH_SETTLE_MS * 5 });
    await userEvent.click(button);
    await assertMasked(input, button);
    await expect(args.onRevealedChange).toHaveBeenCalledTimes(2);
    await expect((args.onRevealedChange as Mock).mock.calls).toEqual([[true], [false]]);
    await expect(args.onValueChange).toHaveBeenCalledTimes('hunter2'.length);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('hunter2');
  },
};

function FormExample({ children }: { children: ReactNode }) {
  return (
    <>
      <button type="button">Before</button>
      <form onSubmit={(event) => event.preventDefault()}>{children}</form>
      <button type="button">After</button>
    </>
  );
}
FormExample.displayName = 'FormExample';

export const Keyboard: Story = {
  render: (args) => (
    <FormExample>
      <PasswordField {...args} />
    </FormExample>
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const { input, button } = parts(canvasElement);
    const onSubmit = fn();
    input.form!.addEventListener('submit', onSubmit);
    await userEvent.tab();
    await userEvent.tab();
    await assertFocus(input);
    await userEvent.tab();
    await assertFocus(button);
    await userEvent.keyboard('{Enter}');
    await assertRevealed(input, button);
    await expect(args.onRevealedChange).toHaveBeenCalledTimes(1);
    await expect(args.onRevealedChange).toHaveBeenLastCalledWith(true);
    await assertFocus(button);
    await userEvent.keyboard(' ');
    await assertMasked(input, button);
    await expect(args.onRevealedChange).toHaveBeenCalledTimes(2);
    await expect(args.onRevealedChange).toHaveBeenLastCalledWith(false);
    await userEvent.keyboard('{Escape}');
    await assertMasked(input, button);
    await expect(args.onRevealedChange).toHaveBeenCalledTimes(2);
    await expect(onSubmit).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'After' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    await assertFocus(button);
    await userEvent.tab({ shift: true });
    await assertFocus(input);
    await userEvent.keyboard('{Enter}');
    await expect(onSubmit).toHaveBeenCalledTimes(1);
    await expect(args.onRevealedChange).toHaveBeenCalledTimes(2);
    await userEvent.tab({ shift: true });
    await expect(canvas.getByRole('button', { name: 'Before' })).toHaveFocus();
  },
};

function ControlledExample(args: PasswordFieldProps) {
  const [value, setValue] = useState('');
  const [revealed, setRevealed] = useState(false);
  return (
    <>
      <PasswordField
        {...args}
        value={value}
        revealed={revealed}
        onValueChange={(next) => {
          args.onValueChange?.(next);
          setValue(next);
        }}
        onRevealedChange={(next) => {
          args.onRevealedChange?.(next);
          setRevealed(next);
        }}
      />
      <button type="button" onClick={() => setValue('from-parent')}>
        Fill from parent
      </button>
      <button type="button" onClick={() => setRevealed((current) => !current)}>
        Toggle from parent
      </button>
    </>
  );
}
ControlledExample.displayName = 'ControlledExample';

export const Controlled: Story = {
  render: (args) => <ControlledExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const { input, button } = parts(canvasElement);
    await userEvent.type(input, 'abc');
    await expect(input).toHaveValue('abc');
    await expect((args.onValueChange as Mock).mock.calls).toEqual([['a'], ['ab'], ['abc']]);
    await expect(args.onChange).toHaveBeenCalledTimes(3);
    const changeOrder = (args.onChange as Mock).mock.invocationCallOrder;
    const valueOrder = (args.onValueChange as Mock).mock.invocationCallOrder;
    for (const [index, order] of changeOrder.entries()) {
      await expect(order).toBeLessThan(valueOrder[index]!);
    }
    await userEvent.click(button);
    await assertRevealed(input, button);
    await expect(args.onRevealedChange).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Fill from parent' }));
    await expect(input).toHaveValue('from-parent');
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle from parent' }));
    await assertMasked(input, button);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onRevealedChange).toHaveBeenCalledTimes(1);
  },
};

export const RejectedControlled: Story = {
  args: { value: 'fixed', revealed: false },
  play: async ({ canvasElement, userEvent, args }) => {
    const { input, button } = parts(canvasElement);
    await userEvent.type(input, 'x');
    await expect(input).toHaveValue('fixed');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('fixedx');
    await userEvent.click(button);
    await assertMasked(input, button);
    await expect(args.onRevealedChange).toHaveBeenCalledTimes(1);
    await expect(args.onRevealedChange).toHaveBeenLastCalledWith(true);
    await userEvent.keyboard(' ');
    await assertMasked(input, button);
    await expect(args.onRevealedChange).toHaveBeenCalledTimes(2);
    await expect(args.onRevealedChange).toHaveBeenLastCalledWith(true);
    await expect(slashOffset(button)).toBeGreaterThan(0.5);
  },
};

function ResetExample({ cancelReset, ...args }: PasswordFieldProps & { cancelReset?: boolean }) {
  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      onReset={(event) => {
        if (cancelReset) event.preventDefault();
      }}
    >
      <PasswordField {...args} />
      <button type="reset">Reset</button>
    </form>
  );
}
ResetExample.displayName = 'ResetExample';

export const FormReset: Story = {
  args: { defaultValue: 'initial' },
  render: (args) => <ResetExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const { input, button } = parts(canvasElement);
    await userEvent.type(input, '-edited');
    await userEvent.click(button);
    await assertRevealed(input, button);
    const data = new FormData(input.form!);
    await expect(data.getAll('password')).toEqual(['initial-edited']);
    await expect([...data.keys()]).toEqual(['password']);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(input).toHaveAttribute('type', 'password'));
    await expect(input).toHaveValue('initial');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(args.onRevealedChange).toHaveBeenCalledTimes(1);
  },
};

export const CancelledReset: Story = {
  args: { defaultValue: 'initial' },
  render: (args) => <ResetExample {...args} cancelReset />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const { input, button } = parts(canvasElement);
    await userEvent.click(button);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await assertRevealed(input, button);
    await expect(args.onRevealedChange).toHaveBeenCalledTimes(1);
  },
};

export const ControlledReset: Story = {
  args: { value: 'kept', revealed: true },
  render: (args) => <ResetExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const { input, button } = parts(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await assertRevealed(input, button);
    await expect(input).toHaveValue('kept');
    await expect(args.onRevealedChange).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

function ExternalAriaExample(args: PasswordFieldProps) {
  const id = useId();
  return (
    <>
      <span id={`${id}-name`}>Vault</span>
      <span id={`${id}-hint`}>Rotated monthly.</span>
      <PasswordField
        {...args}
        aria-labelledby={`${id}-name`}
        aria-describedby={`${id}-hint ${id}-missing`}
      />
    </>
  );
}
ExternalAriaExample.displayName = 'ExternalAriaExample';

export const ExternalAria: Story = {
  args: { description: 'At least 12 characters.', error: 'Password is incorrect.' },
  render: (args) => <ExternalAriaExample {...args} />,
  play: async ({ canvas, canvasElement }) => {
    const { input } = parts(canvasElement);
    const label = canvasElement.querySelector('label')!;
    await expect(input.getAttribute('aria-labelledby')!.split(' ')).toHaveLength(2);
    await expect(input.getAttribute('aria-labelledby')).toMatch(new RegExp(`${label.id}$`));
    await expect(input).toHaveAccessibleName('Vault Password');
    await expect(input.getAttribute('aria-describedby')!.split(' ')).toHaveLength(4);
    await expect(input.getAttribute('aria-describedby')).toContain('-missing');
    await expect(input).toHaveAccessibleDescription(
      'Rotated monthly. At least 12 characters. Password is incorrect.',
    );
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(canvas.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
  },
};

export const AriaInvalidPreserved: Story = {
  args: { 'aria-invalid': 'grammar', 'aria-label': 'API key', label: undefined },
  play: async ({ canvas, canvasElement }) => {
    const { input } = parts(canvasElement);
    await expect(input).toHaveAttribute('aria-invalid', 'grammar');
    await expect(input).toHaveAccessibleName('API key');
    await expect(input).not.toHaveAttribute('aria-labelledby');
    await expect(canvasElement.querySelector('label')).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
  },
};

export const FalsyNodes: Story = {
  render: (args) => (
    <>
      <PasswordField {...args} label="False slots" description={false} error={false} />
      <PasswordField {...args} label="Null slots" description={null} error={null} />
      <PasswordField {...args} label="Zero slots" description={0} error={0} />
      <PasswordField {...args} label="Empty description" description="" />
    </>
  ),
  play: async ({ canvas, canvasElement }) => {
    for (const name of ['False slots', 'Null slots']) {
      const input = canvas.getByLabelText(name);
      await expect(input).not.toHaveAttribute('aria-describedby');
      await expect(input).not.toHaveAttribute('aria-invalid');
      await expect(input.closest('[data-ui]')!.querySelectorAll('span[id]')).toHaveLength(0);
    }
    const zero = canvas.getByLabelText('Zero slots');
    await expect(zero).toHaveAttribute('aria-invalid', 'true');
    await expect(zero).toHaveAccessibleDescription('0 0');
    await expect(canvas.getAllByRole('alert')).toHaveLength(1);
    const empty = canvas.getByLabelText('Empty description');
    // Every referenced id resolves: no dangling relationship for an empty string.
    for (const id of empty.getAttribute('aria-describedby')!.split(' ')) {
      await expect(canvasElement.ownerDocument.getElementById(id)).not.toBeNull();
    }
    await expect(empty).not.toHaveAttribute('aria-invalid');
  },
};

export const Translated: Story = {
  args: { label: 'Contraseña', messages: { reveal: 'Mostrar contraseña' } },
  play: async ({ canvas, userEvent, args }) => {
    const button = canvas.getByRole('button', { name: 'Mostrar contraseña' });
    await userEvent.click(button);
    await expect(button).toHaveAccessibleName('Mostrar contraseña');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByLabelText('Contraseña')).toHaveAttribute('type', 'text');
    await expect(args.onRevealedChange).toHaveBeenCalledTimes(1);
  },
};

export const CustomIcon: Story = {
  args: {
    revealIcon: (revealed) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} data-icon={revealed ? 'on' : 'off'}>
        <circle cx="12" cy="12" r={revealed ? 8 : 4} />
      </svg>
    ),
  },
  play: async ({ canvasElement, userEvent }) => {
    const { button } = parts(canvasElement);
    await expect(button.querySelectorAll('svg')).toHaveLength(1);
    await expect(button.querySelector('[data-icon]')).toHaveAttribute('data-icon', 'off');
    await expect(button.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    await userEvent.click(button);
    await expect(button.querySelector('[data-icon]')).toHaveAttribute('data-icon', 'on');
    await expect(button).toHaveAccessibleName('Show password');
  },
};

export const LongCopy: Story = {
  args: {
    label: 'Contraseña de la cuenta de administración del espacio de trabajo compartido',
    description:
      'Usa al menos doce caracteres combinando palabras que no aparezcan en ningún otro servicio que utilices.',
    error: 'La contraseña no coincide con la registrada para esta cuenta de administración.',
    messages: { reveal: 'Mostrar la contraseña de la cuenta de administración' },
    defaultValue: 'una-contraseña-muy-larga-que-supera-el-ancho-del-campo',
  },
  render: (args) => (
    <div style={{ inlineSize: 200 }}>
      <PasswordField {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { root, input, button } = parts(canvasElement);
    const label = root.querySelector('label')!;
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    await expect(label.getBoundingClientRect().height).toBeGreaterThan(
      parseFloat(getComputedStyle(label).fontSize) * 2,
    );
    await expect(label.getBoundingClientRect().right).toBeLessThanOrEqual(root.getBoundingClientRect().right);
    await expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(input.getBoundingClientRect().right);
    await expect(input.getBoundingClientRect().right).toBeLessThanOrEqual(root.getBoundingClientRect().right);
  },
};

export const RTL: Story = {
  args: { dir: 'rtl', label: 'كلمة المرور', messages: { reveal: 'إظهار كلمة المرور' } },
  render: (args) => (
    <div dir="ltr">
      <PasswordField {...args} />
    </div>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const { root, input, button } = parts(canvasElement);
    await expect(root).toHaveAttribute('dir', 'rtl');
    await expect(input).toHaveAttribute('dir', 'rtl');
    const inputRect = input.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    await expect(buttonRect.right).toBeLessThan(inputRect.left + inputRect.width / 2);
    await expect(buttonRect.left).toBeGreaterThanOrEqual(inputRect.left);
    await expect(parseFloat(getComputedStyle(input).paddingLeft)).toBeGreaterThanOrEqual(
      buttonRect.right - inputRect.left,
    );
    await userEvent.tab();
    await userEvent.tab();
    await assertFocus(button);
  },
};

export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion in browser rendering settings to inspect the slash snapping and the press scale being removed. State and ARIA update in the same commit as the click.',
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    const { input, button } = parts(canvasElement);
    await userEvent.click(button);
    await assertRevealed(input, button);
  },
};

export const ForcedColors: Story = {
  args: { defaultRevealed: true, error: 'Password is incorrect.' },
  parameters: {
    docs: {
      description: {
        story:
          'Enable forced colors in browser rendering settings to inspect the control border, the focus outlines and the pressed toggle.',
      },
    },
  },
};

export const SlotsAndStyling: Story = {
  args: {
    description: 'At least 12 characters.',
    error: 'Password is incorrect.',
    className: 'custom-root',
    sx: { maxInlineSize: '260px' },
    slotProps: {
      root: { css: { rowGap: '10px' } },
      label: { className: 'custom-label', css: { textTransform: 'uppercase' } },
      shell: { css: { paddingBlock: '3px' } },
      control: { css: { letterSpacing: '2px' } },
      reveal: { className: 'custom-reveal', css: { borderRadius: '3px' } },
      description: { css: { fontStyle: 'italic' } },
      error: { css: { textDecorationLine: 'underline' } },
    },
  },
  play: async ({ canvas, canvasElement }) => {
    const { root, input, button } = parts(canvasElement);
    const label = root.querySelector('label')!;
    await expect(root).toHaveClass('custom-root');
    await expect(getComputedStyle(root).maxInlineSize).toBe('260px');
    await expect(getComputedStyle(root).rowGap).toBe('10px');
    await expect(label).toHaveClass('custom-label');
    await expect(getComputedStyle(label).textTransform).toBe('uppercase');
    await expect(getComputedStyle(input.parentElement!).paddingTop).toBe('3px');
    await expect(getComputedStyle(input).letterSpacing).toBe('2px');
    await expect(button).toHaveClass('custom-reveal');
    await expect(getComputedStyle(button).borderRadius).toBe('3px');
    await expect(getComputedStyle(canvas.getByText('At least 12 characters.')).fontStyle).toBe('italic');
    await expect(getComputedStyle(canvas.getByRole('alert')).textDecorationLine).toBe('underline');
  },
};

export const MultipleInstances: Story = {
  render: (args) => (
    <>
      <PasswordField {...args} label="New password" name="new" />
      <PasswordField {...args} label="Confirm password" name="confirm" />
    </>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const first = canvas.getByLabelText('New password');
    const second = canvas.getByLabelText('Confirm password');
    const [firstButton, secondButton] = canvas.getAllByRole('button', { name: 'Show password' });
    await expect(first.id).not.toBe(second.id);
    await expect(firstButton).toHaveAttribute('aria-controls', first.id);
    await expect(secondButton).toHaveAttribute('aria-controls', second.id);
    const masks = [...canvasElement.querySelectorAll('mask')].map((mask) => mask.id);
    await expect(new Set(masks).size).toBe(2);
    await userEvent.click(firstButton!);
    await expect(first).toHaveAttribute('type', 'text');
    await expect(second).toHaveAttribute('type', 'password');
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  args: { defaultRevealed: true, description: 'At least 12 characters.', error: 'Password is incorrect.' },
  play: async ({ canvasElement }) => {
    const { input, button } = parts(canvasElement);
    await assertRevealed(input, button);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
  },
};
