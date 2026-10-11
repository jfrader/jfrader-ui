import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { CodeBlock, type CodeBlockProps } from './index';

const SOURCE = 'export const answer = 42;\nconsole.log(answer);\n';
const LONG_SOURCE = `${SOURCE}\nexport function double(value: number) {\n\treturn value * 2;\n}\n`;
const MIXED_SOURCE = '\tconst title = "café ✓ 𝔘 שלום";\r\n  console.log(title);\r\n';
const meta = {
  title: 'Data display/CodeBlock',
  component: CodeBlock,
  tags: ['autodocs'],
  args: { code: SOURCE, filename: 'answer.ts', locale: 'en-GB', onOpenChange: fn() },
  parameters: {
    docs: {
      description: {
        component:
          'Plain-text source with optional language metadata, not syntax highlighting. Copy always uses the full source. maxLines limits displayed logical lines. Tab reaches copy, source, then disclosure; Enter and Space activate the native buttons. Source scrolling uses native keyboard behavior.',
      },
      source: {
        code: `<CodeBlock code={'export const answer = 42;\\nconsole.log(answer);'} filename="answer.ts" language="TypeScript" maxLines={1} lineNumbers locale="en-GB" />`,
      },
    },
  },
} satisfies Meta<typeof CodeBlock>;
export default meta;
type Story = StoryObj<typeof meta>;

function source(canvasElement: HTMLElement) {
  return canvasElement.querySelector('pre')!;
}
function gutter(canvasElement: HTMLElement) {
  return canvasElement.querySelector('[data-ui="code-block-gutter"]');
}
async function withClipboard(
  canvasElement: HTMLElement,
  writeText: ((text: string) => Promise<void>) | null,
  run: () => Promise<void>,
) {
  const navigator = canvasElement.ownerDocument.defaultView!.navigator;
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: writeText ? { writeText } : undefined });
  try {
    await run();
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else delete (navigator as { clipboard?: Clipboard }).clipboard;
  }
}
async function expectFocused(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expect(getComputedStyle(element).outlineStyle).not.toBe('none');
}

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const root = within(canvasElement).getByRole('region', { name: args.filename });
    await expect(root.tagName).toBe('SECTION');
    await expect(source(canvasElement).firstElementChild?.tagName).toBe('CODE');
    await expect(source(canvasElement).textContent).toBe(args.code);
    await expect(source(canvasElement)).toHaveAccessibleName('Selectable source code');
  },
};
export const WithoutFilename: Story = { args: { filename: undefined } };
export const EmptyMetadata: Story = {
  args: { filename: '', language: '' },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('region', { name: 'Source code' })).toBeVisible();
    await expect(canvasElement.querySelector('[data-ui="code-block-language"]')).toBeNull();
  },
};
export const ExternalAriaLabel: Story = {
  args: { 'aria-label': 'Consumer source name', 'aria-describedby': 'unresolved-description' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('region', { name: 'Consumer source name' })).toHaveAttribute(
      'aria-describedby',
      'unresolved-description',
    );
  },
};
export const LanguageMetadata: Story = { args: { language: 'TypeScript' } };
export const Empty: Story = {
  args: { code: '', lineNumbers: true, maxLines: 1 },
  play: async ({ canvasElement }) => {
    await expect(source(canvasElement).textContent).toBe('');
    await expect(gutter(canvasElement)).toBeNull();
    await expect(canvasElement.querySelector('[aria-expanded]')).toBeNull();
  },
};
export const OneLine: Story = { args: { code: 'const answer = 42;', maxLines: 1 } };
export const Collapsed: Story = {
  args: { code: LONG_SOURCE, maxLines: 2, lineNumbers: true },
  play: async ({ canvasElement }) => {
    await expect(source(canvasElement).textContent).toBe(SOURCE);
    await expect(gutter(canvasElement)?.textContent).toBe('1\n2');
    const toggle = within(canvasElement).getByRole('button', { name: 'Show all 6 lines' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle.getAttribute('data-ui')?.split(' ')).toContain('code-block-toggle');
    await expect(toggle).toHaveAttribute('aria-controls', source(canvasElement).id);
  },
};
export const Expanded: Story = { args: { ...Collapsed.args, defaultOpen: true } };

function ControlledExample({ reject = false, ...args }: CodeBlockProps & { reject?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Expand externally</Button>
      <CodeBlock
        {...args}
        open={open}
        onOpenChange={(next) => {
          args.onOpenChange?.(next);
          if (!reject) setOpen(next);
        }}
      />
    </>
  );
}
export const Controlled: Story = {
  args: Collapsed.args,
  render: (args) => <ControlledExample {...args} />,
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Show all 6 lines' }));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    await expect(source(canvasElement).textContent).toBe(LONG_SOURCE);
    await userEvent.click(canvas.getByRole('button', { name: 'Show fewer lines' }));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(source(canvasElement).textContent).toBe(SOURCE);
  },
};
export const RejectedOpen: Story = {
  args: Collapsed.args,
  render: (args) => <ControlledExample {...args} reject />,
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const toggle = canvas.getByRole('button', { name: 'Show all 6 lines' });
    await userEvent.click(toggle);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(source(canvasElement).textContent).toBe(SOURCE);
    await expect(gutter(canvasElement)?.textContent).toBe('1\n2');
    await userEvent.click(canvas.getByRole('button', { name: 'Expand externally' }));
    await expect(source(canvasElement).textContent).toBe(LONG_SOURCE);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
  },
};
export const LineNumbers: Story = {
  args: { lineNumbers: true },
  play: async ({ canvasElement }) => {
    await expect(gutter(canvasElement)).toHaveAttribute('aria-hidden', 'true');
    await expect(getComputedStyle(gutter(canvasElement)!).userSelect).toBe('none');
    await expect(gutter(canvasElement)?.textContent).toBe('1\n2');
    await expect(source(canvasElement).textContent).toBe(SOURCE);
  },
};
export const LongLines: Story = {
  args: { code: `const long = '${'source '.repeat(100)}';`, lineNumbers: true },
  render: (args) => (
    <div style={{ maxInlineSize: '20rem' }}>
      <CodeBlock {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const pre = source(canvasElement);
    await expect(pre.scrollWidth).toBeGreaterThan(pre.clientWidth);
    await expect(getComputedStyle(pre).whiteSpace).toBe('pre');
    await expect(getComputedStyle(pre).overflowX).toBe('auto');
    await expect(pre.parentElement!.getBoundingClientRect().width).toBeLessThanOrEqual(
      pre.parentElement!.parentElement!.getBoundingClientRect().width,
    );
    pre.scrollLeft = 100;
    await expect(pre.scrollLeft).toBeGreaterThan(0);
  },
};
export const TrailingNewline: Story = {
  args: { code: 'one\ntwo\n', lineNumbers: true },
  play: async ({ canvas, canvasElement }) => {
    // A trailing newline must not invent a phantom gutter number, and the copy payload keeps it.
    await expect(gutter(canvasElement)?.textContent).toBe('1\n2');
    const writeText = fn(async (_text: string) => {});
    await withClipboard(canvasElement, writeText, async () => {
      await canvas.getByRole('button', { name: 'Copy code' }).click();
      await expect(writeText).toHaveBeenLastCalledWith('one\ntwo\n');
    });
  },
};
export const CRLF: Story = {
  args: { code: 'one\r\ntwo\r\nthree\r\n', maxLines: 1, lineNumbers: true },
  play: async ({ canvasElement }) => {
    await expect(source(canvasElement).textContent).toBe('one\r\n');
    await expect(gutter(canvasElement)?.textContent).toBe('1');
    await expect(within(canvasElement).getByRole('button', { name: 'Show all 3 lines' })).toBeVisible();
  },
};
export const UnicodeSource: Story = { args: { code: MIXED_SOURCE } };
export const LiteralMarkup: Story = {
  args: { code: '<script>alert("&");</script>\n<div>literal</div>' },
  play: async ({ args, canvasElement }) => {
    await expect(source(canvasElement).textContent).toBe(args.code);
    await expect(source(canvasElement).querySelector('script, div')).toBeNull();
  },
};
export const TabsAndSpaces: Story = {
  args: { code: '\tindented\n    spaced\n', lineNumbers: true },
  play: async ({ args, canvasElement }) => {
    await expect(source(canvasElement).textContent).toBe(args.code);
    await expect(getComputedStyle(source(canvasElement)).whiteSpace).toBe('pre');
  },
};
export const CopyDisabled: Story = { args: { copyButtonProps: { disabled: true } } };
export const CopyPending: Story = { args: { copyButtonProps: { value: 'pending' } } };
export const CopyFailure: Story = { args: { copyButtonProps: { value: 'error', resetAfterMs: 0 } } };
export const ExactSourceCopy: Story = {
  args: {
    code: MIXED_SOURCE,
    maxLines: 1,
    lineNumbers: true,
    copyButtonProps: { onCopied: fn(), onValueChange: fn(), resetAfterMs: 0 },
  },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const writeText = fn(async (_text: string) => {});
    await withClipboard(canvasElement, writeText, async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Copy code' }));
      await waitFor(() => expect(args.copyButtonProps?.onCopied).toHaveBeenCalledTimes(1));
      await expect(writeText).toHaveBeenCalledTimes(1);
      await expect(writeText).toHaveBeenLastCalledWith(MIXED_SOURCE);
      await expect(args.copyButtonProps?.onCopied).toHaveBeenLastCalledWith(MIXED_SOURCE);
      await expect(args.copyButtonProps?.onValueChange).toHaveBeenCalledTimes(2);
      await expect(canvas.getAllByRole('status')).toHaveLength(1);
      await expect(canvas.getByRole('status')).toHaveTextContent('Code copied');
    });
  },
};
export const CopyRetry: Story = {
  args: { copyButtonProps: { onCopyError: fn(), onCopied: fn(), resetAfterMs: 0 } },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const error = new Error('Clipboard unavailable');
    const writeText = fn<(text: string) => Promise<void>>().mockRejectedValueOnce(error).mockResolvedValue(undefined);
    await withClipboard(canvasElement, writeText, async () => {
      const button = canvas.getByRole('button', { name: 'Copy code' });
      await userEvent.click(button);
      await waitFor(() => expect(args.copyButtonProps?.onCopyError).toHaveBeenCalledTimes(1));
      await expect(args.copyButtonProps?.onCopyError).toHaveBeenLastCalledWith(error);
      await expect(button).toHaveAttribute('data-state', 'error');
      await userEvent.click(button);
      await waitFor(() => expect(args.copyButtonProps?.onCopied).toHaveBeenCalledTimes(1));
      await expect(args.copyButtonProps?.onCopyError).toHaveBeenCalledTimes(1);
      await expect(writeText).toHaveBeenCalledTimes(2);
      await expect(writeText).toHaveBeenLastCalledWith(args.code);
    });
  },
};
export const MissingClipboard: Story = {
  args: { copyButtonProps: { onCopyError: fn(), resetAfterMs: 0 } },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await withClipboard(canvasElement, null, async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Copy code' }));
      await waitFor(() => expect(args.copyButtonProps?.onCopyError).toHaveBeenCalledTimes(1));
      await expect(canvas.getByRole('status')).toHaveTextContent('Could not copy code');
    });
  },
};
export const WithoutCopy: Story = { args: { copyable: false } };

function UpdatingExample(args: CodeBlockProps) {
  const [short, setShort] = useState(false);
  return (
    <>
      <Button onClick={() => setShort(!short)}>Change source</Button>
      <CodeBlock {...args} code={short ? 'short' : LONG_SOURCE} />
    </>
  );
}
export const SourceUpdates: Story = {
  args: { maxLines: 2, defaultOpen: true },
  render: (args) => <UpdatingExample {...args} />,
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const change = canvas.getByRole('button', { name: 'Change source' });
    await userEvent.click(change);
    await expect(source(canvasElement).textContent).toBe('short');
    await expect(canvasElement.ownerDocument.activeElement).toBe(change);
    await expect(canvasElement.querySelector('[aria-expanded]')).toBeNull();
    await userEvent.click(change);
    await expect(source(canvasElement).textContent).toBe(LONG_SOURCE);
    await expect(canvas.getByRole('button', { name: 'Show fewer lines' })).toHaveAttribute('aria-expanded', 'true');
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};
function RemovedToggleExample(args: CodeBlockProps) {
  const [code, setCode] = useState(LONG_SOURCE);
  return (
    <CodeBlock
      {...args}
      code={code}
      onOpenChange={(next) => {
        args.onOpenChange?.(next);
        setCode('short');
      }}
    />
  );
}
export const ToggleRemovedFocus: Story = {
  args: { maxLines: 2, copyable: false },
  render: (args) => <RemovedToggleExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expectFocused(source(canvasElement));
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};
export const InvalidLineLimits: Story = {
  render: (args) => (
    <>
      {[undefined, 0, -1, NaN, Infinity, 0.5, 1.9].map((maxLines, index) => (
        <CodeBlock {...args} filename={`Limit example ${index + 1}`} key={index} maxLines={maxLines} copyable={false} />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const blocks = canvasElement.querySelectorAll('section');
    for (const block of Array.from(blocks).slice(0, 5)) {
      await expect(block.querySelector('pre')?.textContent).toBe(SOURCE);
      await expect(block.querySelector('button')).toBeNull();
    }
    for (const block of Array.from(blocks).slice(5))
      await expect(block.querySelector('pre')?.textContent).toBe('export const answer = 42;\n');
  },
};
export const ExternalAria: Story = {
  args: {
    'aria-label': 'Consumer name',
    'aria-labelledby': 'external missing',
    'aria-describedby': 'description missing-description',
    ref: fn(),
    preRef: fn(),
  },
  render: (args) => (
    <>
      <span id="external">Example</span>
      <span id="description">A source example</span>
      <CodeBlock {...args} />
      <CodeBlock code="second" copyable={false} />
    </>
  ),
  play: async ({ args, canvasElement }) => {
    const root = canvasElement.querySelector('section')!;
    const title = root.querySelector('[data-ui="code-block-label"]')!;
    await expect(root).toHaveAttribute('aria-labelledby', `external missing ${title.id}`);
    await expect(root).toHaveAttribute('aria-label', 'Consumer name');
    await expect(root).toHaveAttribute('aria-describedby', 'description missing-description');
    await expect(args.ref).toHaveBeenLastCalledWith(root);
    await expect(args.preRef).toHaveBeenLastCalledWith(source(canvasElement));
    await expect(canvasElement.querySelectorAll('pre')[1]?.id).not.toBe(source(canvasElement).id);
  },
};
const consumerCss = css({ paddingInlineStart: vars.space[1], letterSpacing: '0.05em' });
const consumerSx = css({ paddingInlineStart: vars.space[2] });
const slotStyle = css({ fontWeight: vars.fontWeight.semibold });
export const ConsumerStylePrecedence: Story = {
  args: {
    css: consumerCss,
    sx: consumerSx,
    slotProps: { label: { css: slotStyle, className: 'consumer-label' }, pre: { css: slotStyle } },
  },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('section')!;
    // Layout lengths are not DPR-snapped: compare numerically, derived from the token scale (space[2] = 8).
    await expect(parseFloat(getComputedStyle(root).paddingInlineStart)).toBe(8);
    await expect(getComputedStyle(root).letterSpacing).not.toBe('normal');
    await expect(getComputedStyle(source(canvasElement)).fontWeight).toBe('600');
    await expect(root.querySelector('[data-ui="code-block-label"]')).toHaveClass('consumer-label');
  },
};
export const LightTheme: Story = { args: Collapsed.args, globals: { theme: 'light' }, decorators: [withLightTheme] };
export const RTL: Story = {
  args: { ...Collapsed.args, dir: 'rtl', language: 'TypeScript' },
  play: async ({ canvasElement }) => {
    await expect(getComputedStyle(canvasElement.querySelector('header')!).direction).toBe('rtl');
    await expect(getComputedStyle(source(canvasElement)).direction).toBe('ltr');
    await expect(getComputedStyle(source(canvasElement)).unicodeBidi).toBe('isolate');
  },
};
export const ForcedColors: Story = {
  args: Collapsed.args,
  parameters: {
    docs: {
      description: {
        story:
          'Structural check only. Enable forced colors in the browser to inspect system text, borders and focus outlines.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(getComputedStyle(canvasElement.querySelector('section')!).borderTopStyle).toBe('solid');
    await expect(parseFloat(getComputedStyle(canvasElement.querySelector('section')!).borderTopWidth)).toBeGreaterThan(
      0,
    );
  },
};
export const ReducedMotion: Story = {
  args: Collapsed.args,
  parameters: {
    docs: {
      description: {
        story:
          'Disclosure is instantaneous. This story does not emulate a reduced-motion preference; CopyButton owns its feedback motion.',
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Show all 6 lines' }));
    await expect(source(canvasElement).textContent).toBe(LONG_SOURCE);
    // Real assertion: the disclosure region runs with no animations or transitions. (The copy
    // button's idle ring is outside this subtree.)
    const frame = canvasElement.querySelector('[data-ui="code-block-source-frame"]')!;
    await expect(frame.getAnimations({ subtree: true })).toHaveLength(0);
  },
};
export const KeyboardCopyScrollToggle: Story = {
  args: { ...Collapsed.args, copyButtonProps: { onCopied: fn(), resetAfterMs: 0 } },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const writeText = fn(async (_text: string) => {});
    await withClipboard(canvasElement, writeText, async () => {
      const copy = canvas.getByRole('button', { name: 'Copy code' });
      const pre = source(canvasElement);
      await userEvent.tab();
      await expectFocused(copy);
      await userEvent.keyboard('{Enter}');
      await waitFor(() => expect(args.copyButtonProps?.onCopied).toHaveBeenCalledTimes(1));
      await userEvent.keyboard(' ');
      await waitFor(() => expect(args.copyButtonProps?.onCopied).toHaveBeenCalledTimes(2));
      await expect(writeText).toHaveBeenCalledTimes(2);
      await expect(writeText).toHaveBeenLastCalledWith(LONG_SOURCE);
      await userEvent.tab();
      await expectFocused(pre);
      await userEvent.keyboard('{ArrowRight}{ArrowLeft}{ArrowDown}{ArrowUp}{Home}{End}{PageDown}{PageUp}');
      await expectFocused(pre);
      await userEvent.tab();
      const toggle = canvas.getByRole('button', { name: 'Show all 6 lines' });
      await expectFocused(toggle);
      await expect(toggle.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
      await expect(copy.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
      await userEvent.keyboard('{Enter}');
      await expect(source(canvasElement).textContent).toBe(LONG_SOURCE);
      await expectFocused(toggle);
      await userEvent.keyboard('{Escape}');
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await userEvent.keyboard(' ');
      await expect(source(canvasElement).textContent).toBe(SOURCE);
      await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
      await expect(args.onOpenChange).toHaveBeenNthCalledWith(1, true);
      await expect(args.onOpenChange).toHaveBeenNthCalledWith(2, false);
      await userEvent.tab({ shift: true });
      await expectFocused(pre);
      await userEvent.tab({ shift: true });
      await expectFocused(copy);
    });
  },
};
