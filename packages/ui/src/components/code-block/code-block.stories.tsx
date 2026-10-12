import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, waitFor, within, type Mock } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { CodeBlock, type CodeBlockProps, type CodeHighlightLines, type CodeHighlightLoader } from './index';
import { loadShikiHighlight } from './shiki';

const SOURCE = 'export const answer = 42;\nconsole.log(answer);\n';
const LONG_SOURCE = `${SOURCE}\nexport function double(value: number) {\n\treturn value * 2;\n}\n`;
const MIXED_SOURCE = '\tconst title = "café ✓ 𝔘 שלום";\r\n  console.log(title);\r\n';
const SAMPLES = {
  TypeScript: `// Resolve the user's preferred theme.
export type Theme = 'dark' | 'light';

export function preferredTheme(media: MediaQueryList): Theme {
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return media.matches ? 'dark' : 'light';
}
`,
  JavaScript: `import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('package.json', 'utf8'));
console.log(\`\${manifest.name}@\${manifest.version}\`);
`,
  JSON: `{
  "name": "@jfrader/ui",
  "private": false,
  "version": "0.4.0",
  "keywords": ["react", "design-system"]
}
`,
  CSS: `.card:hover {
  border-color: var(--ui-color-border-strong);
  padding-inline: 16px;
  transition: border-color 160ms ease;
}
`,
  Bash: `# Install and start the workbench
pnpm install --frozen-lockfile
pnpm dev --port 6006 && echo "ready"
`,
  HTML: `<section class="hero" aria-labelledby="title">
  <h1 id="title">Hello</h1>
  <a href="/docs">Read the docs</a>
</section>
`,
} as const;
const SAMPLE_FILENAMES: Record<keyof typeof SAMPLES, string> = {
  TypeScript: 'theme.ts',
  JavaScript: 'version.mjs',
  JSON: 'package.json',
  CSS: 'card.css',
  Bash: 'setup.sh',
  HTML: 'hero.html',
};
const meta = {
  title: 'Data display/CodeBlock',
  component: CodeBlock,
  tags: ['autodocs'],
  args: { code: SOURCE, filename: 'answer.ts', locale: 'en-GB', onOpenChange: fn() },
  parameters: {
    docs: {
      description: {
        component:
          'Display code, copy it, and expand hidden lines. Add a language label or syntax highlighting when needed.',
      },
      usage: `- Code is plain text by default. Pass a \`highlight\` loader to tokenize it.
- \`@jfrader/ui/code-block/shiki\` exports \`loadShikiHighlight\` and requires the optional \`shiki\` peer. It supports JavaScript, TypeScript, JSON, CSS, Bash, and HTML; other languages stay plain.
- Copy uses the full source. \`maxLines\` limits the displayed logical lines.

### Keyboard
- Tab reaches copy, source, then disclosure. Enter/Space activate the buttons.
- Source scrolling uses native keyboard behavior.`,
      source: {
        code: `import { loadShikiHighlight } from '@jfrader/ui/code-block/shiki';

<CodeBlock code={source} filename="answer.ts" language="ts" highlight={loadShikiHighlight} maxLines={12} lineNumbers />`,
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
    await expect(root).not.toHaveAttribute('data-highlighted');
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
          'Enable forced colors in the browser to check system text, borders, and focus outlines. This story does not set the preference.',
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
          'Disclosure has no animation. CopyButton handles its own feedback motion. This story does not enable reduced motion.',
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

async function expectHighlighted(block: HTMLElement, code: string) {
  await waitFor(() => expect(block).toHaveAttribute('data-highlighted'), { timeout: 5000 });
  await expect(block.querySelector('pre')!.textContent).toBe(code);
}
function deferredLoader() {
  let resolve: (lines: CodeHighlightLines | null) => void = () => {};
  const loader = fn<CodeHighlightLoader>(
    () =>
      new Promise<CodeHighlightLines | null>((settle) => {
        resolve = settle;
      }),
  );
  return { loader, resolve: (lines: CodeHighlightLines | null) => resolve(lines) };
}

export const Highlighted: Story = {
  args: {
    code: SAMPLES.TypeScript,
    filename: 'theme.ts',
    language: 'TypeScript',
    lineNumbers: true,
    highlight: loadShikiHighlight,
  },
  play: async ({ args, canvasElement }) => {
    const root = canvasElement.querySelector('section')!;
    await expectHighlighted(root, args.code);
    const keyword = Array.from(root.querySelectorAll<HTMLElement>('code span')).find((span) => span.textContent === 'export');
    await expect(keyword?.style.color).toBe(vars.color.syntaxKeyword);
    await expect(getComputedStyle(source(canvasElement)).whiteSpace).toBe('pre');
  },
};
export const HighlightedLight: Story = {
  args: Highlighted.args,
  globals: { theme: 'light' },
  decorators: [withLightTheme],
  play: Highlighted.play,
};
export const HighlightedLanguages: Story = {
  args: { highlight: loadShikiHighlight, lineNumbers: true },
  render: (args) => (
    <div style={{ display: 'grid', gap: vars.space[4] }}>
      {(Object.keys(SAMPLES) as (keyof typeof SAMPLES)[]).map((language) => (
        <CodeBlock
          {...args}
          key={language}
          code={SAMPLES[language]}
          language={language}
          filename={SAMPLE_FILENAMES[language]}
        />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const blocks = Array.from(canvasElement.querySelectorAll('section'));
    await expect(blocks).toHaveLength(Object.keys(SAMPLES).length);
    for (const [index, code] of Object.values(SAMPLES).entries()) await expectHighlighted(blocks[index]!, code);
  },
};
export const HighlightedCollapsed: Story = {
  args: { ...Highlighted.args, maxLines: 4 },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const root = canvasElement.querySelector('section')!;
    const firstLines = SAMPLES.TypeScript.split('\n').slice(0, 4).join('\n') + '\n';
    await expectHighlighted(root, firstLines);
    await expect(gutter(canvasElement)?.textContent).toBe('1\n2\n3\n4');
    await userEvent.click(canvas.getByRole('button', { name: 'Show all 8 lines' }));
    await expect(source(canvasElement).textContent).toBe(args.code);
    await expect(root).toHaveAttribute('data-highlighted');
  },
};
export const HighlightUnknownLanguage: Story = {
  args: { language: 'COBOL', highlight: fn(loadShikiHighlight) },
  play: async ({ args, canvasElement }) => {
    await waitFor(() => expect(args.highlight).toHaveBeenCalledTimes(1));
    await expect(args.highlight).toHaveBeenLastCalledWith({ code: SOURCE, language: 'COBOL' });
    await expect(await (args.highlight as Mock<CodeHighlightLoader>).mock.results[0]?.value).toBeNull();
    await expect(canvasElement.querySelector('section')).not.toHaveAttribute('data-highlighted');
    await expect(source(canvasElement).textContent).toBe(SOURCE);
  },
};
const rejectingLoader: CodeHighlightLoader = () => Promise.reject(new Error('grammar unavailable'));
const throwingLoader: CodeHighlightLoader = () => {
  throw new Error('highlighter missing');
};
export const HighlightFailure: Story = {
  args: { language: 'ts' },
  beforeEach: () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    return () => warn.mockRestore();
  },
  render: (args) => (
    <>
      <CodeBlock {...args} filename="rejected.ts" highlight={rejectingLoader} />
      <CodeBlock {...args} filename="thrown.ts" highlight={throwingLoader} />
    </>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(console.warn).toHaveBeenCalledTimes(2));
    await expect(console.warn).toHaveBeenCalledWith(
      'CodeBlock: highlighting failed; showing plain text.',
      new Error('grammar unavailable'),
    );
    await expect(console.warn).toHaveBeenCalledWith(
      'CodeBlock: highlighting failed; showing plain text.',
      new Error('highlighter missing'),
    );
    for (const block of Array.from(canvasElement.querySelectorAll('section'))) {
      await expect(block).not.toHaveAttribute('data-highlighted');
      await expect(block.querySelector('pre')!.textContent).toBe(SOURCE);
    }
  },
};
function PendingExample(args: CodeBlockProps) {
  const [loader] = useState(deferredLoader);
  return (
    <>
      <Button onClick={() => loader.resolve([[{ content: 'export', color: vars.color.syntaxKeyword }]])}>Resolve</Button>
      <CodeBlock {...args} highlight={loader.loader} />
    </>
  );
}
export const HighlightPending: Story = {
  args: { language: 'ts', lineNumbers: true },
  render: (args) => <PendingExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const root = canvasElement.querySelector('section')!;
    const before = source(canvasElement).getBoundingClientRect();
    await expect(root).not.toHaveAttribute('data-highlighted');
    await expect(source(canvasElement).textContent).toBe(SOURCE);
    await userEvent.click(canvas.getByRole('button', { name: 'Resolve' }));
    await waitFor(() => expect(root).toHaveAttribute('data-highlighted'));
    const after = source(canvasElement).getBoundingClientRect();
    await expect([after.width, after.height]).toEqual([before.width, before.height]);
    await expect(source(canvasElement).textContent).toBe(SOURCE);
  },
};
export const HighlightTokenMismatch: Story = {
  args: {
    code: 'one\r\ntwo\nthree',
    lineNumbers: true,
    highlight: () => [
      [{ content: 'one', color: vars.color.syntaxKeyword, fontStyle: 'italic' }],
      [{ content: 'TWO', color: vars.color.syntaxString }],
    ],
  },
  play: async ({ args, canvasElement }) => {
    const root = canvasElement.querySelector('section')!;
    await expectHighlighted(root, args.code);
    const spans = root.querySelectorAll<HTMLElement>('code span');
    await expect(spans).toHaveLength(1);
    await expect(spans[0]!.textContent).toBe('one');
    await expect(spans[0]!.style.fontStyle).toBe('italic');
  },
};

function ReplacedLoaderExample(args: CodeBlockProps) {
  const [replacement] = useState(deferredLoader);
  const [replaced, setReplaced] = useState(false);
  return (
    <>
      <Button onClick={() => setReplaced(true)}>Replace highlighter</Button>
      <Button onClick={() => replacement.resolve(null)}>Resolve without highlighting</Button>
      <CodeBlock {...args} highlight={replaced ? replacement.loader : loadShikiHighlight} />
    </>
  );
}
export const HighlightLoaderReplacement: Story = {
  args: Highlighted.args,
  render: (args) => <ReplacedLoaderExample {...args} />,
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const root = canvasElement.querySelector('section')!;
    await expectHighlighted(root, args.code);
    await userEvent.click(canvas.getByRole('button', { name: 'Replace highlighter' }));
    await expect(root).not.toHaveAttribute('data-highlighted');
    await expect(root.querySelectorAll('code span')).toHaveLength(0);
    await expect(source(canvasElement).textContent).toBe(args.code);
    await userEvent.click(canvas.getByRole('button', { name: 'Resolve without highlighting' }));
    await expect(root).not.toHaveAttribute('data-highlighted');
  },
};
