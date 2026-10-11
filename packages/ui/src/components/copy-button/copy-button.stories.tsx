import { useState, type CSSProperties, type MouseEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import type { ButtonSize, ButtonVariant } from '../button';
import { CopyButton, type CopyButtonProps, type CopyButtonValue } from './index';

const VARIANTS = ['outline', 'ghost', 'soft', 'solid'] as const satisfies readonly ButtonVariant[];
const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly ButtonSize[];
const SIZE_PX: Record<ButtonSize, number> = { sm: 32, md: 40, lg: 48 };
const ROOT = '[data-ui~="copy-button"]';
const INSTALL_COMMAND = 'pnpm add @jfrader/ui';
// Multiline, RTL and astral-plane characters must reach the clipboard untouched.
const MIXED_PAYLOAD = 'line one\nשורה שתיים\n𝔘𝔫𝔦𝔠𝔬𝔡𝔢 ✓';
// Covers the base transition (160ms) with margin.
const SETTLE_MS = 240;
const SHORT_RESET_MS = 300;

const rowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
} satisfies CSSProperties;

const narrowStyle = { ...rowStyle, maxInlineSize: '9rem' } satisfies CSSProperties;

const consumerCss = css({ marginInlineStart: vars.space[1], letterSpacing: '0.05em' });
const consumerSx = css({ marginInlineStart: vars.space[2] });
const slotLabelCss = css({ fontWeight: vars.fontWeight.semibold });

type WriteText = (text: string) => Promise<void>;

/** Story-only: replaces the canvas navigator's clipboard for the duration of `run`. */
async function withClipboard(canvasElement: HTMLElement, writeText: WriteText | null, run: () => Promise<void>) {
  const navigator = canvasElement.ownerDocument.defaultView!.navigator;
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText === null ? undefined : { writeText },
  });
  try {
    await run();
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else delete (navigator as { clipboard?: Clipboard }).clipboard;
  }
}

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getButton(canvasElement: HTMLElement, name = 'Copy command') {
  return within(canvasElement).getByRole('button', { name });
}

function getStatus(canvasElement: HTMLElement) {
  return within(canvasElement).getByRole('status');
}

async function focusFirst(canvasElement: HTMLElement) {
  canvasElement.tabIndex = -1;
  canvasElement.focus();
  await userEvent.tab();
  canvasElement.removeAttribute('tabindex');
}

/** Story-only: whether a stylesheet rule under `query` sets `property` to `expected` for `element`. */
function mediaRuleSets(element: Element, query: string, property: string, expected: string) {
  const sheets = Array.from(element.ownerDocument.styleSheets);
  return sheets.some((sheet) =>
    Array.from(sheet.cssRules).some(
      (rule) =>
        rule instanceof CSSMediaRule &&
        rule.conditionText.includes(query) &&
        Array.from(rule.cssRules).some(
          (inner) =>
            inner instanceof CSSStyleRule &&
            element.matches(inner.selectorText) &&
            inner.style.getPropertyValue(property).toLowerCase() === expected,
        ),
    ),
  );
}

function ControlledCopyButton(args: CopyButtonProps) {
  const [value, setValue] = useState<CopyButtonValue>('idle');
  return (
    <CopyButton
      {...args}
      value={value}
      onValueChange={(next) => {
        args.onValueChange?.(next);
        setValue(next);
      }}
    />
  );
}
ControlledCopyButton.displayName = 'ControlledCopyButton';

function ExternallyClearedCopyButton(args: CopyButtonProps) {
  const [value, setValue] = useState<CopyButtonValue>('idle');
  return (
    <div style={rowStyle}>
      <CopyButton
        {...args}
        value={value}
        onValueChange={(next) => {
          args.onValueChange?.(next);
          setValue(next);
        }}
      />
      <button type="button" onClick={() => setValue('idle')}>
        Clear
      </button>
    </div>
  );
}
ExternallyClearedCopyButton.displayName = 'ExternallyClearedCopyButton';

function ChangingTextCopyButton(args: CopyButtonProps) {
  const [text, setText] = useState(args.text);
  return (
    <div style={rowStyle}>
      <CopyButton {...args} text={text} />
      <button type="button" onClick={() => setText('replaced payload')}>
        Change text
      </button>
    </div>
  );
}
ChangingTextCopyButton.displayName = 'ChangingTextCopyButton';

function UnmountingCopyButton(args: CopyButtonProps) {
  const [mounted, setMounted] = useState(true);
  return (
    <div style={rowStyle}>
      {mounted && <CopyButton {...args} />}
      <button type="button" onClick={() => setMounted(false)}>
        Remove
      </button>
    </div>
  );
}
UnmountingCopyButton.displayName = 'UnmountingCopyButton';

function CustomIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 8h10M8 3v10" />
    </svg>
  );
}
CustomIcon.displayName = 'CustomIcon';

const meta = {
  title: 'Actions/CopyButton',
  component: CopyButton,
  tags: ['autodocs'],
  args: {
    text: INSTALL_COMMAND,
    label: 'Copy command',
    pendingLabel: 'Copying',
    copiedLabel: 'Copied',
    errorLabel: 'Could not copy',
    variant: 'outline',
    tone: 'neutral',
    size: 'sm',
    onValueChange: fn(),
    onCopied: fn(),
    onCopyError: fn(),
  },
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    tone: { control: 'radio', options: ['neutral', 'accent', 'danger'] },
    size: { control: 'radio', options: SIZES },
    iconOnly: { control: 'boolean' },
    disabled: { control: 'boolean' },
    value: { control: 'select', options: ['idle', 'pending', 'copied', 'error'] },
  },
} satisfies Meta<typeof CopyButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      source: {
        code: `<CopyButton
  text={installCommand}
  label="Copy command"
  pendingLabel="Copying"
  copiedLabel="Copied"
  errorLabel="Could not copy"
/>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const button = getButton(canvasElement);
    await expect(button).toHaveAttribute('type', 'button');
    await expect(button).toHaveAttribute('data-state', 'idle');
    await expect(button.matches(ROOT)).toBe(true);
    await expect(button.matches('[data-ui~="button"]')).toBe(true);
    await expect(getStatus(canvasElement)).toHaveTextContent('');
  },
};

export const Variants: Story = {
  render: (args) => (
    <div style={rowStyle}>
      {VARIANTS.map((variant) => (
        <CopyButton {...args} key={variant} variant={variant} label={`Copy ${variant}`} />
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div style={rowStyle}>
      {SIZES.map((size) => (
        <CopyButton {...args} key={size} size={size} label={`Copy ${size}`} />
      ))}
      {SIZES.map((size) => (
        <CopyButton {...args} key={`icon-${size}`} size={size} iconOnly label={`Copy ${size} icon`} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const size of SIZES) {
      const labelled = getButton(canvasElement, `Copy ${size}`).getBoundingClientRect();
      await expect(labelled.height).toBe(SIZE_PX[size]);
      const square = getButton(canvasElement, `Copy ${size} icon`).getBoundingClientRect();
      await expect(square.height).toBe(SIZE_PX[size]);
      await expect(square.width).toBe(SIZE_PX[size]);
    }
  },
};

export const IconOnly: Story = {
  args: { iconOnly: true },
  parameters: {
    docs: {
      source: {
        code: `<CopyButton
  text={installCommand}
  label="Copy command"
  pendingLabel="Copying"
  copiedLabel="Copied"
  errorLabel="Could not copy"
  iconOnly
/>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const button = getButton(canvasElement);
    await expect(button.querySelector('[data-ui="copy-button-label"]')).toBeNull();
    await expect(button.querySelector('[data-ui="copy-button-icon"]')).toHaveAttribute('aria-hidden', 'true');
  },
};

export const LightTheme: Story = {
  globals: { theme: 'light' },
  render: (args) => (
    <div style={rowStyle}>
      {VARIANTS.map((variant) => (
        <CopyButton {...args} key={variant} variant={variant} label={`Copy ${variant}`} />
      ))}
      <CopyButton {...args} value="copied" label="Copy copied" />
      <CopyButton {...args} value="error" label="Copy error" />
    </div>
  ),
};

export const ScopedLightTheme: Story = {
  decorators: [withLightTheme],
  args: { variant: 'solid' },
  play: async ({ canvasElement }) => {
    await expectThemedSurface(getButton(canvasElement), 'light');
  },
};

export const Disabled: Story = {
  args: { disabled: true, onClick: fn() },
  play: async ({ args, canvasElement }) => {
    const writeText = fn<WriteText>(async () => {});
    await withClipboard(canvasElement, writeText, async () => {
      const button = getButton(canvasElement);
      await expect(button).toBeDisabled();
      await userEvent.click(button);
      await expect(args.onClick).not.toHaveBeenCalled();
      await expect(writeText).not.toHaveBeenCalled();
      await expect(args.onValueChange).not.toHaveBeenCalled();
      await expect(args.onCopied).not.toHaveBeenCalled();
    });
  },
};

export const AriaDisabled: Story = {
  args: { 'aria-disabled': true, onClick: fn() },
  play: async ({ args, canvasElement }) => {
    const writeText = fn<WriteText>(async () => {});
    await withClipboard(canvasElement, writeText, async () => {
      const button = getButton(canvasElement);
      await focusFirst(canvasElement);
      await expect(button).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      await userEvent.click(button);
      await expect(args.onClick).not.toHaveBeenCalled();
      await expect(writeText).not.toHaveBeenCalled();
      await expect(args.onValueChange).not.toHaveBeenCalled();
      await expect(args.onCopyError).not.toHaveBeenCalled();
    });
  },
};

export const Pending: Story = {
  args: { value: 'pending' },
  render: (args) => (
    <div style={rowStyle}>
      <CopyButton {...args} />
      <CopyButton {...args} iconOnly label="Copy link" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const button = getButton(canvasElement);
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(button).not.toBeDisabled();
    await expect(button).toHaveAttribute('data-state', 'pending');
  },
};

export const Copied: Story = {
  args: { value: 'copied' },
  render: (args) => (
    <div style={rowStyle}>
      <CopyButton {...args} />
      <CopyButton {...args} iconOnly label="Copy link" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const button = getButton(canvasElement);
    await expect(button).not.toHaveAttribute('aria-busy');
    await expect(within(canvasElement).getAllByRole('status')[0]).toHaveTextContent('Copied');
  },
};

export const ErrorFace: Story = {
  name: 'Error',
  args: { value: 'error' },
  render: (args) => (
    <div style={rowStyle}>
      <CopyButton {...args} />
      <CopyButton {...args} iconOnly label="Copy link" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(getButton(canvasElement)).toHaveAttribute('data-state', 'error');
    await expect(within(canvasElement).getAllByRole('status')[0]).toHaveTextContent('Could not copy');
  },
};

export const KeyboardActivation: Story = {
  args: { text: MIXED_PAYLOAD },
  play: async ({ args, canvasElement }) => {
    const writeText = fn<WriteText>(async () => {});
    await withClipboard(canvasElement, writeText, async () => {
      const button = getButton(canvasElement);
      await focusFirst(canvasElement);
      await expect(canvasElement.ownerDocument.activeElement).toBe(button);
      await expect(getComputedStyle(button).outlineStyle).not.toBe('none');
      await expect(getComputedStyle(button).outlineWidth).not.toBe('0px');

      await userEvent.keyboard('{Enter}');
      await expect(writeText).toHaveBeenCalledTimes(1);
      await expect(writeText).toHaveBeenLastCalledWith(MIXED_PAYLOAD);
      await waitFor(() => expect(args.onCopied).toHaveBeenCalledTimes(1));
      await expect(args.onCopied).toHaveBeenLastCalledWith(MIXED_PAYLOAD);
      await expect(button).toHaveAttribute('data-state', 'copied');
      await expect(getStatus(canvasElement)).toHaveTextContent('Copied');

      await userEvent.keyboard('[Space]');
      await expect(writeText).toHaveBeenCalledTimes(2);
      await waitFor(() => expect(args.onCopied).toHaveBeenCalledTimes(2));
      await expect(canvasElement.ownerDocument.activeElement).toBe(button);

      await userEvent.keyboard('{Escape}');
      await userEvent.keyboard('{ArrowDown}');
      await expect(writeText).toHaveBeenCalledTimes(2);
      await expect(args.onCopyError).not.toHaveBeenCalled();
    });
  },
};

export const EmptyText: Story = {
  args: { text: '' },
  play: async ({ args, canvasElement }) => {
    const writeText = fn<WriteText>(async () => {});
    await withClipboard(canvasElement, writeText, async () => {
      await userEvent.click(getButton(canvasElement));
      await expect(writeText).toHaveBeenCalledTimes(1);
      await expect(writeText).toHaveBeenLastCalledWith('');
      await waitFor(() => expect(args.onCopied).toHaveBeenLastCalledWith(''));
    });
  },
};

export const PendingLock: Story = {
  play: async ({ args, canvasElement }) => {
    const write = deferred();
    const writeText = fn<WriteText>(() => write.promise);
    await withClipboard(canvasElement, writeText, async () => {
      const button = getButton(canvasElement);
      await focusFirst(canvasElement);
      await userEvent.keyboard('{Enter}');
      await userEvent.keyboard('{Enter}');
      await userEvent.keyboard('[Space]');
      await userEvent.click(button);
      await expect(writeText).toHaveBeenCalledTimes(1);
      await expect(button).toHaveAttribute('aria-busy', 'true');
      await expect(button).toHaveAttribute('aria-disabled', 'true');
      await expect(getStatus(canvasElement)).toHaveTextContent('Copying');
      await expect(canvasElement.ownerDocument.activeElement).toBe(button);
      await expect(args.onValueChange).toHaveBeenCalledTimes(1);

      write.resolve();
      await waitFor(() => expect(args.onCopied).toHaveBeenCalledTimes(1));
      await expect(args.onCopied).toHaveBeenLastCalledWith(INSTALL_COMMAND);
      await expect(button).not.toHaveAttribute('aria-busy');
      await expect(button).not.toHaveAttribute('aria-disabled');
      await expect(args.onCopyError).not.toHaveBeenCalled();
    });
  },
};

export const SameTickDuplicates: Story = {
  args: { onClick: fn() },
  play: async ({ args, canvasElement }) => {
    const write = deferred();
    const writeText = fn<WriteText>(() => write.promise);
    await withClipboard(canvasElement, writeText, async () => {
      const button = getButton(canvasElement);
      // Three activations dispatched in one task, before any await.
      button.click();
      button.click();
      button.click();
      await expect(writeText).toHaveBeenCalledTimes(1);
      await expect(args.onClick).toHaveBeenCalledTimes(1);
      await expect(args.onValueChange).toHaveBeenCalledTimes(1);
      write.resolve();
      await waitFor(() => expect(args.onCopied).toHaveBeenCalledTimes(1));
      await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    });
  },
};

export const ControlledAccept: Story = {
  args: { resetAfterMs: SHORT_RESET_MS },
  render: (args) => <ControlledCopyButton {...args} />,
  play: async ({ args, canvasElement }) => {
    const writeText = fn<WriteText>(async () => {});
    await withClipboard(canvasElement, writeText, async () => {
      const button = getButton(canvasElement);
      await userEvent.click(button);
      await waitFor(() => expect(button).toHaveAttribute('data-state', 'copied'));
      await waitFor(() => expect(button).toHaveAttribute('data-state', 'idle'));
      await expect(args.onValueChange).toHaveBeenCalledTimes(3);
      await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 'pending');
      await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 'copied');
      await expect(args.onValueChange).toHaveBeenNthCalledWith(3, 'idle');
      await expect(args.onCopied).toHaveBeenCalledTimes(1);
      await expect(getStatus(canvasElement)).toHaveTextContent('');
    });
  },
};

export const ControlledReject: Story = {
  args: { value: 'idle' },
  play: async ({ args, canvasElement }) => {
    const write = deferred();
    const writeText = fn<WriteText>(() => write.promise);
    await withClipboard(canvasElement, writeText, async () => {
      const button = getButton(canvasElement);
      await userEvent.click(button);
      await userEvent.click(button);
      await expect(writeText).toHaveBeenCalledTimes(1);
      await expect(args.onValueChange).toHaveBeenCalledTimes(1);
      await expect(args.onValueChange).toHaveBeenLastCalledWith('pending');
      await expect(button).toHaveAttribute('data-state', 'idle');
      await expect(button).not.toHaveAttribute('aria-busy');
      await expect(getStatus(canvasElement)).toHaveTextContent('');

      write.resolve();
      await waitFor(() => expect(args.onCopied).toHaveBeenCalledTimes(1));
      await expect(args.onValueChange).toHaveBeenCalledTimes(2);
      await expect(args.onValueChange).toHaveBeenLastCalledWith('copied');
      await expect(button).toHaveAttribute('data-state', 'idle');
    });
  },
};

export const ExternalIdleCancelsReset: Story = {
  args: { resetAfterMs: SHORT_RESET_MS },
  render: (args) => <ExternallyClearedCopyButton {...args} />,
  play: async ({ args, canvasElement }) => {
    const writeText = fn<WriteText>(async () => {});
    await withClipboard(canvasElement, writeText, async () => {
      const button = getButton(canvasElement);
      await userEvent.click(button);
      await waitFor(() => expect(button).toHaveAttribute('data-state', 'copied'));
      await userEvent.click(within(canvasElement).getByRole('button', { name: 'Clear' }));
      await expect(button).toHaveAttribute('data-state', 'idle');
      await wait(SHORT_RESET_MS + SETTLE_MS);
      await expect(args.onValueChange).toHaveBeenCalledTimes(2);
      await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 'pending');
      await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 'copied');
    });
  },
};

export const AriaMerge: Story = {
  args: { iconOnly: true, 'aria-label': 'Copy API key', 'aria-describedby': 'copy-hint' },
  render: (args) => (
    <div style={rowStyle}>
      <CopyButton {...args} />
      <span id="copy-hint">Starts with sk_</span>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const writeText = fn<WriteText>(async () => {});
    await withClipboard(canvasElement, writeText, async () => {
      const button = getButton(canvasElement, 'Copy API key');
      await expect(button).toHaveAttribute('aria-describedby', 'copy-hint');
      await expect(button).toHaveAccessibleDescription('Starts with sk_');
      await userEvent.click(button);
      await waitFor(() => expect(getStatus(canvasElement)).toHaveTextContent('Copied'));
      // The status text never joins the name.
      await expect(button).toHaveAccessibleName('Copy API key');
      await expect(button.contains(getStatus(canvasElement))).toBe(false);
    });
  },
};

export const ExternalAriaPreserved: Story = {
  args: { iconOnly: true, 'aria-labelledby': 'copy-key-label', 'aria-invalid': true },
  render: (args) => (
    <div style={rowStyle}>
      <span id="copy-key-label">Copy expired key</span>
      <CopyButton {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const write = deferred();
    const writeText = fn<WriteText>(() => write.promise);
    await withClipboard(canvasElement, writeText, async () => {
      const button = getButton(canvasElement, 'Copy expired key');
      await expect(button).toHaveAttribute('aria-labelledby', 'copy-key-label');
      await expect(button).toHaveAttribute('aria-invalid', 'true');
      await userEvent.click(button);
      await expect(button).toHaveAttribute('aria-busy', 'true');
      await expect(button).toHaveAttribute('aria-labelledby', 'copy-key-label');
      await expect(button).toHaveAttribute('aria-invalid', 'true');
      write.resolve();
      await waitFor(() => expect(button).toHaveAttribute('data-state', 'copied'));
      await expect(button).toHaveAccessibleName('Copy expired key');
      await expect(button).toHaveAttribute('aria-invalid', 'true');
    });
  },
};

export const ClipboardUnavailable: Story = {
  play: async ({ args, canvasElement }) => {
    await withClipboard(canvasElement, null, async () => {
      const button = getButton(canvasElement);
      await userEvent.click(button);
      await waitFor(() => expect(args.onCopyError).toHaveBeenCalledTimes(1));
      await expect(args.onCopyError).toHaveBeenLastCalledWith(expect.any(Error));
      await expect(args.onCopied).not.toHaveBeenCalled();
      await expect(button).toHaveAttribute('data-state', 'error');
      await expect(getStatus(canvasElement)).toHaveTextContent('Could not copy');
    });
  },
};

export const SynchronousThrow: Story = {
  play: async ({ args, canvasElement }) => {
    const failure = new TypeError('blocked');
    const writeText = fn<WriteText>(() => {
      throw failure;
    });
    await withClipboard(canvasElement, writeText, async () => {
      await userEvent.click(getButton(canvasElement));
      await waitFor(() => expect(args.onCopyError).toHaveBeenCalledTimes(1));
      await expect(args.onCopyError).toHaveBeenLastCalledWith(failure);
      await expect(args.onCopied).not.toHaveBeenCalled();
    });
  },
};

export const RepeatedUnavailable: Story = {
  args: { resetAfterMs: 0 },
  play: async ({ args, canvasElement }) => {
    await withClipboard(canvasElement, null, async () => {
      const button = getButton(canvasElement);
      await userEvent.click(button);
      await waitFor(() => expect(args.onCopyError).toHaveBeenCalledTimes(1));
      // A retry from the error face fails synchronously again and must not stick in pending.
      await userEvent.click(button);
      await waitFor(() => expect(args.onCopyError).toHaveBeenCalledTimes(2));
      await expect(button).toHaveAttribute('data-state', 'error');
      await expect(button).not.toHaveAttribute('aria-busy');
      await expect(button).not.toHaveAttribute('aria-disabled');
      await expect(args.onValueChange).toHaveBeenCalledTimes(4);
      await expect(args.onValueChange).toHaveBeenNthCalledWith(3, 'pending');
      await expect(args.onValueChange).toHaveBeenNthCalledWith(4, 'error');
      await expect(getStatus(canvasElement)).toHaveTextContent('Could not copy');
    });
  },
};

export const RepeatedSynchronousThrow: Story = {
  args: { resetAfterMs: 0 },
  play: async ({ args, canvasElement }) => {
    const writeText = fn<WriteText>(() => {
      throw new TypeError('blocked');
    });
    await withClipboard(canvasElement, writeText, async () => {
      const button = getButton(canvasElement);
      await userEvent.click(button);
      await userEvent.click(button);
      await waitFor(() => expect(args.onCopyError).toHaveBeenCalledTimes(2));
      await expect(writeText).toHaveBeenCalledTimes(2);
      await expect(button).toHaveAttribute('data-state', 'error');
      await expect(button).not.toHaveAttribute('aria-busy');
      await expect(args.onValueChange).toHaveBeenCalledTimes(4);
      await expect(args.onValueChange).toHaveBeenLastCalledWith('error');
    });
  },
};

export const RetryFromDefaultError: Story = {
  args: { defaultValue: 'error', resetAfterMs: 0 },
  play: async ({ args, canvasElement }) => {
    const failure = new TypeError('blocked');
    const writeText = fn<WriteText>(() => {
      throw failure;
    });
    await withClipboard(canvasElement, writeText, async () => {
      const button = getButton(canvasElement);
      await expect(button).toHaveAttribute('data-state', 'error');
      await userEvent.click(button);
      await waitFor(() => expect(args.onCopyError).toHaveBeenCalledTimes(1));
      await expect(args.onCopyError).toHaveBeenLastCalledWith(failure);
      await expect(button).toHaveAttribute('data-state', 'error');
      await expect(button).not.toHaveAttribute('aria-busy');
      await expect(args.onValueChange).toHaveBeenCalledTimes(2);
      await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 'pending');
      await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 'error');

      writeText.mockImplementation(async () => {});
      await userEvent.click(button);
      await waitFor(() => expect(button).toHaveAttribute('data-state', 'copied'));
      await expect(args.onCopied).toHaveBeenCalledTimes(1);
    });
  },
};

export const ControlledSynchronousFailure: Story = {
  args: { resetAfterMs: 0 },
  render: (args) => <ControlledCopyButton {...args} />,
  play: async ({ args, canvasElement }) => {
    await withClipboard(canvasElement, null, async () => {
      const button = getButton(canvasElement);
      await userEvent.click(button);
      await userEvent.click(button);
      await waitFor(() => expect(args.onCopyError).toHaveBeenCalledTimes(2));
      await expect(button).toHaveAttribute('data-state', 'error');
      await expect(button).not.toHaveAttribute('aria-busy');
      await expect(args.onValueChange).toHaveBeenCalledTimes(4);
      await expect(args.onValueChange).toHaveBeenLastCalledWith('error');
    });
  },
};

export const ThrowingThenable: Story = {
  play: async ({ args, canvasElement }) => {
    const failure = new Error('broken thenable');
    const writeText = fn(() => ({
      then() {
        throw failure;
      },
    })) as unknown as WriteText;
    await withClipboard(canvasElement, writeText, async () => {
      const button = getButton(canvasElement);
      await userEvent.click(button);
      await waitFor(() => expect(args.onCopyError).toHaveBeenCalledTimes(1));
      await expect(args.onCopyError).toHaveBeenLastCalledWith(failure);
      await expect(args.onCopied).not.toHaveBeenCalled();
      await expect(button).toHaveAttribute('data-state', 'error');
    });
  },
};

export const RejectingThenable: Story = {
  play: async ({ args, canvasElement }) => {
    const failure = new Error('rejected thenable');
    // Settles more than once and both ways; only the first settlement counts.
    const writeText = fn(() => ({
      then(_onFulfilled: () => void, onRejected: (reason: unknown) => void) {
        onRejected(failure);
        onRejected(new Error('second rejection'));
        _onFulfilled();
      },
    })) as unknown as WriteText;
    await withClipboard(canvasElement, writeText, async () => {
      const button = getButton(canvasElement);
      await userEvent.click(button);
      await waitFor(() => expect(args.onCopyError).toHaveBeenCalledTimes(1));
      await wait(SETTLE_MS);
      await expect(args.onCopyError).toHaveBeenCalledTimes(1);
      await expect(args.onCopyError).toHaveBeenLastCalledWith(failure);
      await expect(args.onCopied).not.toHaveBeenCalled();
      await expect(button).toHaveAttribute('data-state', 'error');
    });
  },
};

export const PermissionRejected: Story = {
  play: async ({ args, canvasElement }) => {
    const denied = new DOMException('Write permission denied.', 'NotAllowedError');
    const writeText = fn<WriteText>().mockRejectedValueOnce(denied).mockResolvedValue(undefined);
    await withClipboard(canvasElement, writeText, async () => {
      const button = getButton(canvasElement);
      await userEvent.click(button);
      await waitFor(() => expect(args.onCopyError).toHaveBeenCalledTimes(1));
      await expect(args.onCopyError).toHaveBeenLastCalledWith(denied);
      await expect(button).toHaveAttribute('data-state', 'error');

      // A retry after a rejection succeeds.
      await userEvent.click(button);
      await waitFor(() => expect(args.onCopied).toHaveBeenCalledTimes(1));
      await expect(writeText).toHaveBeenCalledTimes(2);
      await expect(args.onCopyError).toHaveBeenCalledTimes(1);
      await expect(button).toHaveAttribute('data-state', 'copied');
    });
  },
};

export const PreventDefault: Story = {
  args: { onClick: fn((event: MouseEvent<HTMLButtonElement>) => event.preventDefault()) },
  play: async ({ args, canvasElement }) => {
    const writeText = fn<WriteText>(async () => {});
    await withClipboard(canvasElement, writeText, async () => {
      await userEvent.click(getButton(canvasElement));
      await expect(args.onClick).toHaveBeenCalledTimes(1);
      await expect(writeText).not.toHaveBeenCalled();
      await expect(args.onValueChange).not.toHaveBeenCalled();
    });
  },
};

export const RepeatCopy: Story = {
  args: { resetAfterMs: SHORT_RESET_MS },
  play: async ({ args, canvasElement }) => {
    const writeText = fn<WriteText>(async () => {});
    await withClipboard(canvasElement, writeText, async () => {
      const button = getButton(canvasElement);
      await userEvent.click(button);
      await waitFor(() => expect(button).toHaveAttribute('data-state', 'copied'));
      // A second copy late in the first window restarts the reset timer.
      await wait(SHORT_RESET_MS * 0.6);
      await userEvent.click(button);
      await waitFor(() => expect(args.onCopied).toHaveBeenCalledTimes(2));
      await wait(SHORT_RESET_MS * 0.6);
      await expect(button).toHaveAttribute('data-state', 'copied');
      await waitFor(() => expect(button).toHaveAttribute('data-state', 'idle'));
      await expect(writeText).toHaveBeenCalledTimes(2);
    });
  },
};

export const ResetDisabled: Story = {
  args: { resetAfterMs: 0 },
  play: async ({ args, canvasElement }) => {
    const writeText = fn<WriteText>(async () => {});
    await withClipboard(canvasElement, writeText, async () => {
      const button = getButton(canvasElement);
      await userEvent.click(button);
      await waitFor(() => expect(button).toHaveAttribute('data-state', 'copied'));
      await wait(SHORT_RESET_MS);
      await expect(button).toHaveAttribute('data-state', 'copied');
      await expect(args.onValueChange).not.toHaveBeenCalledWith('idle');
    });
  },
};

export const TextChangeDuringWrite: Story = {
  render: (args) => <ChangingTextCopyButton {...args} />,
  play: async ({ args, canvasElement }) => {
    const write = deferred();
    const writeText = fn<WriteText>(() => write.promise);
    await withClipboard(canvasElement, writeText, async () => {
      await userEvent.click(getButton(canvasElement));
      await userEvent.click(within(canvasElement).getByRole('button', { name: 'Change text' }));
      write.resolve();
      await waitFor(() => expect(args.onCopied).toHaveBeenCalledTimes(1));
      await expect(writeText).toHaveBeenLastCalledWith(INSTALL_COMMAND);
      await expect(args.onCopied).toHaveBeenLastCalledWith(INSTALL_COMMAND);
    });
  },
};

export const UnmountWhilePending: Story = {
  render: (args) => <UnmountingCopyButton {...args} />,
  play: async ({ args, canvasElement }) => {
    const write = deferred();
    const writeText = fn<WriteText>(() => write.promise);
    await withClipboard(canvasElement, writeText, async () => {
      await userEvent.click(getButton(canvasElement));
      await userEvent.click(within(canvasElement).getByRole('button', { name: 'Remove' }));
      write.resolve();
      await wait(SETTLE_MS);
      await expect(args.onValueChange).toHaveBeenCalledTimes(1);
      await expect(args.onCopied).not.toHaveBeenCalled();
    });
  },
};

export const UnmountBeforeReset: Story = {
  args: { resetAfterMs: SHORT_RESET_MS },
  render: (args) => <UnmountingCopyButton {...args} />,
  play: async ({ args, canvasElement }) => {
    const writeText = fn<WriteText>(async () => {});
    await withClipboard(canvasElement, writeText, async () => {
      await userEvent.click(getButton(canvasElement));
      await waitFor(() => expect(args.onCopied).toHaveBeenCalledTimes(1));
      await userEvent.click(within(canvasElement).getByRole('button', { name: 'Remove' }));
      await wait(SHORT_RESET_MS + SETTLE_MS);
      await expect(args.onValueChange).not.toHaveBeenCalledWith('idle');
    });
  },
};

export const LongLabels: Story = {
  args: {
    label: 'Copiar el comando de instalación',
    pendingLabel: 'Copiando',
    copiedLabel: 'Copiado al portapapeles',
    errorLabel: 'No se pudo copiar el comando',
  },
  render: (args) => (
    <div style={narrowStyle}>
      <CopyButton {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const writeText = fn<WriteText>(async () => {});
    await withClipboard(canvasElement, writeText, async () => {
      const button = getButton(canvasElement, 'Copiar el comando de instalación');
      const container = button.parentElement!;
      const faces = Array.from(button.querySelectorAll<HTMLElement>('[data-ui="copy-button-label"] > span'));
      const expectFullyVisible = async () => {
        const box = button.getBoundingClientRect();
        await expect(box.width).toBeLessThanOrEqual(container.getBoundingClientRect().width);
        await expect(box.height).toBeGreaterThanOrEqual(SIZE_PX.sm);
        await expect(button.scrollHeight).toBeLessThanOrEqual(button.clientHeight);
        await expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth);
        // Every face's text, measured from its glyph boxes, lies inside the button.
        for (const face of faces) {
          const range = face.ownerDocument.createRange();
          range.selectNodeContents(face);
          const text = range.getBoundingClientRect();
          await expect(text.top).toBeGreaterThanOrEqual(box.top);
          await expect(text.bottom).toBeLessThanOrEqual(box.bottom);
          await expect(text.left).toBeGreaterThanOrEqual(box.left);
          await expect(text.right).toBeLessThanOrEqual(box.right);
        }
      };
      await expect(faces).toHaveLength(4);
      // The narrow row forces the longest label onto several lines.
      await expect(button.getBoundingClientRect().height).toBeGreaterThan(SIZE_PX.sm);
      await expectFullyVisible();
      const before = button.getBoundingClientRect();
      await userEvent.click(button);
      await waitFor(() => expect(button).toHaveAttribute('data-state', 'copied'));
      await expectFullyVisible();
      await expect(button.getBoundingClientRect().width).toBe(before.width);
      await expect(button.getBoundingClientRect().height).toBe(before.height);
    });
  },
};

export const RightToLeft: Story = {
  args: {
    text: 'שלום עולם',
    label: 'העתק פקודה',
    pendingLabel: 'מעתיק',
    copiedLabel: 'הועתק',
    errorLabel: 'ההעתקה נכשלה',
  },
  render: (args) => (
    <div dir="rtl" lang="he" style={rowStyle}>
      <CopyButton {...args} />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const writeText = fn<WriteText>(async () => {});
    await withClipboard(canvasElement, writeText, async () => {
      const button = getButton(canvasElement, 'העתק פקודה');
      const icon = button.querySelector('[data-ui="copy-button-icon"]')!;
      const label = button.querySelector('[data-ui="copy-button-label"]')!;
      // Icon leads at the inline start, which is the right edge in RTL.
      await expect(icon.getBoundingClientRect().left).toBeGreaterThan(label.getBoundingClientRect().left);
      await userEvent.click(button);
      await waitFor(() => expect(args.onCopied).toHaveBeenLastCalledWith('שלום עולם'));
    });
  },
};

// The test runner cannot emulate media features, so the ReducedMotion and ForcedColors stories
// check the stylesheet rules that apply under them; manual spot checks cover the rendering.
export const ReducedMotion: Story = {
  args: { value: 'pending' },
  play: async ({ canvasElement }) => {
    const button = getButton(canvasElement);
    const face = button.querySelector('[data-ui="copy-button-label"] > [data-active]')!;
    const ring = button.querySelector('[data-ui="copy-button-icon"] > [data-active] > span')!;
    await expect(getComputedStyle(face).transitionProperty).toBe('opacity');
    await expect(mediaRuleSets(face, 'prefers-reduced-motion: reduce', 'transition-duration', '0s')).toBe(true);
    await expect(mediaRuleSets(ring, 'prefers-reduced-motion: reduce', 'animation-name', 'none')).toBe(true);
  },
};

export const ForcedColors: Story = {
  args: { value: 'copied', iconOnly: true },
  play: async ({ canvasElement }) => {
    const button = getButton(canvasElement);
    const glyph = button.querySelector('[data-ui="copy-button-icon"] > [data-active]')!;
    await expect(mediaRuleSets(glyph, 'forced-colors: active', 'color', 'buttontext')).toBe(true);
    // A real border, not a shadow, outlines the button once forced colors repaint it.
    await expect(getComputedStyle(button).borderTopStyle).toBe('solid');
    await expect(getComputedStyle(button).borderTopWidth).toBe('1px');
  },
};

export const IconNodes: Story = {
  args: { iconOnly: true, icons: { idle: <CustomIcon />, copied: false, error: 0 } },
  play: async ({ canvasElement }) => {
    const faces = getButton(canvasElement).querySelectorAll('[data-ui="copy-button-icon"] > span');
    await expect(faces).toHaveLength(4);
    await expect(faces[0]?.querySelector('path')).toHaveAttribute('d', 'M3 8h10M8 3v10');
    await expect(faces[1]?.firstElementChild).not.toBeNull();
    await expect(faces[2]).toBeEmptyDOMElement();
    await expect(faces[3]).toHaveTextContent('0');
  },
};

export const SxPrecedence: Story = {
  args: {
    className: 'consumer-class',
    css: consumerCss,
    sx: consumerSx,
    ref: fn(),
    slotProps: { label: { className: 'slot-label', css: slotLabelCss }, status: { id: 'copy-status' } },
  },
  play: async ({ args, canvasElement }) => {
    const button = getButton(canvasElement);
    await expect(args.ref).toHaveBeenLastCalledWith(button);
    await expect(button).toBeInstanceOf(canvasElement.ownerDocument.defaultView!.HTMLButtonElement);
    await expect(button).toHaveClass('consumer-class');
    // own → css → sx: sx wins the shared property, css keeps the rest.
    await expect(getComputedStyle(button).marginInlineStart).toBe('8px');
    await expect(getComputedStyle(button).letterSpacing).not.toBe('normal');
    const label = button.querySelector('[data-ui="copy-button-label"]')!;
    await expect(label).toHaveClass('slot-label');
    await expect(getComputedStyle(label).fontWeight).toBe('600');
    await expect(getStatus(canvasElement)).toHaveAttribute('id', 'copy-status');
  },
};
