import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { Guide } from './Guide';

const source = `import { Button } from '@jfrader/ui';

export function Save({ count }: { count: number }) {
  return <Button disabled={count < 1}>Save & continue</Button>;
}
`;
const command = 'pnpm add \\\n  @jfrader/ui \\\n  @jfrader/tokens\n';
const config = '@jfrader:registry=https://npm.pkg.github.com\n';
const document = [
  '# Guide examples',
  'Use `sx` for a one-off change. Keep `<Button>` inline.',
  `\`\`\`tsx filename="save.tsx"\n${source}\`\`\``,
  `\`\`\`bash\n${command}\`\`\``,
  `\`\`\`ini\n${config}\`\`\``,
  '```\nplain <code> & text\n```',
  '[Setup](./consuming-jfrader-ui.md) · [Examples](#guide-examples)',
].join('\n\n');

const meta = {
  title: 'Foundations/Guide rendering',
  component: Guide,
  tags: ['!dev', '!autodocs'],
  args: { children: document },
} satisfies Meta<typeof Guide>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Examples: Story = {
  play: async ({ canvasElement, canvas, userEvent }) => {
    const blocks = canvasElement.querySelectorAll<HTMLElement>('[data-ui="code-block"]');
    await expect(blocks).toHaveLength(3);
    const highlighted = blocks[0]!;
    await expect(canvasElement.querySelectorAll('[data-guide-example]')).toHaveLength(4);
    await expect(within(highlighted).getByText('save.tsx')).toBeVisible();
    await waitFor(() => expect(highlighted).toHaveAttribute('data-highlighted'), { timeout: 5000 });
    await expect(highlighted.querySelector('code')?.textContent).toBe(source);
    await expect(blocks[1]?.querySelector('code')?.textContent).toBe(config);
    await expect(blocks[1]).not.toHaveAttribute('data-highlighted');
    await expect(blocks[2]?.querySelector('code')?.textContent).toBe('plain <code> & text\n');
    await expect(canvas.getByText('sx', { selector: 'code' }).closest('[data-ui]')).toBeNull();
    await expect(canvas.getByText('<Button>', { selector: 'code' })).toBeVisible();
    await expect(canvasElement.querySelector('pre pre, pre section, pre figure')).toBeNull();

    const terminal = canvas.getByRole('figure', { name: 'Setup commands' });
    const screen = terminal.querySelector('[data-ui="typewriter-terminal-screen"]')!;
    await expect(screen.textContent).toContain(command);
    const screenStyle = canvasElement.ownerDocument.defaultView!.getComputedStyle(screen);
    const contentHeight = screen.firstElementChild!.getBoundingClientRect().height;
    await expect(screen.getBoundingClientRect().height).toBeCloseTo(
      contentHeight + parseFloat(screenStyle.paddingTop) + parseFloat(screenStyle.paddingBottom),
    );
    await expect(terminal.querySelectorAll('[data-ui="typewriter-terminal-transcript"] > li')).toHaveLength(1);
    const seek = within(terminal).getByRole('slider');
    await expect(seek).toHaveValue(seek.getAttribute('max'));
    await expect(within(terminal).getByRole('button', { name: 'Play' })).toBeVisible();

    const clipboard = canvasElement.ownerDocument.defaultView!.navigator.clipboard;
    const original = Object.getOwnPropertyDescriptor(clipboard, 'writeText');
    const writeText = fn(async (_text: string) => {});
    Object.defineProperty(clipboard, 'writeText', { configurable: true, value: writeText });
    try {
      await userEvent.click(within(highlighted).getByRole('button', { name: 'Copy code' }));
      await expect(writeText).toHaveBeenLastCalledWith(source);
      const copyCommand = within(terminal).getByRole('button', { name: 'Copy commands' });
      copyCommand.focus();
      await userEvent.keyboard('{Enter}');
      await expect(writeText).toHaveBeenLastCalledWith(command);
      await expect(canvasElement.ownerDocument.activeElement).toBe(copyCommand);
    } finally {
      if (original) Object.defineProperty(clipboard, 'writeText', original);
      else Reflect.deleteProperty(clipboard, 'writeText');
    }

    const replay = within(terminal).getByRole('button', { name: 'Replay' });
    replay.focus();
    await userEvent.keyboard('{Enter}');
    await expect(within(terminal).getByRole('button', { name: 'Pause' })).toBeVisible();
    await userEvent.keyboard('{Tab}{End}');
    await expect(seek).toHaveFocus();
    await expect(seek).toHaveValue(seek.getAttribute('max'));
    await expect(screen.textContent).toContain(command);
    await expect(canvas.getByRole('link', { name: 'Setup' })).toHaveAttribute('target', '_top');
    await expect(canvas.getByRole('link', { name: 'Setup' })).toHaveAttribute('href', './?path=/docs/foundations-getting-started--docs');
    await expect(canvas.getByRole('link', { name: 'Examples' })).toHaveAttribute('target', '_self');
  },
};

export const Light: Story = { ...Examples, globals: { theme: 'light' } };
