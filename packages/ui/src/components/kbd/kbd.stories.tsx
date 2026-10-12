import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Kbd } from './index';

const stackStyle = {
  display: 'grid',
  justifyItems: 'start',
  gap: vars.space[3],
} satisfies CSSProperties;

const proseStyle = {
  margin: 0,
  fontSize: vars.textSize.sm,
  color: vars.color.text,
} satisfies CSSProperties;

const meta = {
  title: 'Data display/Kbd',
  component: Kbd,
  parameters: { docs: { description: { component: 'Show a keyboard key or a combination of keys in text.' } } },
  args: { children: 'Esc' },
} satisfies Meta<typeof Kbd>;

export default meta;

type Story = StoryObj<typeof meta>;

function CommandShortcut() {
  return (
    <Kbd.Group>
      <Kbd>Cmd</Kbd>
      <Kbd>K</Kbd>
    </Kbd.Group>
  );
}
CommandShortcut.displayName = 'CommandShortcut';

function ShortcutHints() {
  return (
    <p style={proseStyle}>
      Press <CommandShortcut /> to search, or <Kbd>Esc</Kbd> to close.
    </p>
  );
}
ShortcutHints.displayName = 'ShortcutHints';

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const key = within(canvasElement).getByText('Esc');
    await expect(key.tagName).toBe('KBD');
    await expect(key).toHaveAttribute('data-ui', 'kbd');
    const style = getComputedStyle(key);
    await expect(parseFloat(style.borderBottomWidth)).toBeGreaterThan(parseFloat(style.borderTopWidth));
  },
};

export const Combination: Story = {
  parameters: {
    docs: {
      source: {
        code: `<Kbd.Group>
  <Kbd>Cmd</Kbd>
  <Kbd>K</Kbd>
</Kbd.Group>`,
      },
    },
  },
  render: () => <CommandShortcut />,
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('[data-ui="kbd-group"]') as HTMLElement;
    const keys = group.querySelectorAll('kbd');
    await expect(keys).toHaveLength(2);
    await expect(Array.from(keys, (key) => key.textContent)).toEqual(['Cmd', 'K']);

    const separators = group.querySelectorAll('[data-ui="kbd-separator"]');
    await expect(separators).toHaveLength(1);
    const separator = separators[0]!;
    await expect(separator).toHaveAttribute('aria-hidden', 'true');
    await expect(separator).toHaveTextContent('+');
    // The separator sits between the two keys.
    await expect(separator.previousElementSibling).toBe(keys[0]);
    await expect(separator.nextElementSibling).toBe(keys[1]);
  },
};

export const SkipsEmptyChildren: Story = {
  parameters: {
    docs: {
      source: {
        code: `<Kbd.Group>
  <Kbd>Shift</Kbd>
  {false}
  {null}
  <Kbd>Tab</Kbd>
</Kbd.Group>`,
      },
    },
  },
  render: () => (
    <Kbd.Group>
      <Kbd>Shift</Kbd>
      {false}
      {null}
      <Kbd>Tab</Kbd>
    </Kbd.Group>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('kbd')).toHaveLength(2);
    await expect(canvasElement.querySelectorAll('[data-ui="kbd-separator"]')).toHaveLength(1);
  },
};

export const ZeroChildren: Story = {
  parameters: {
    docs: {
      source: {
        code: `<Kbd.Group>
  <Kbd>{0}</Kbd>
  {0}
</Kbd.Group>`,
      },
    },
  },
  render: () => (
    <Kbd.Group>
      <Kbd>{0}</Kbd>
      {0}
    </Kbd.Group>
  ),
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('[data-ui="kbd-group"]') as HTMLElement;
    const key = within(group).getByText('0', { selector: 'kbd' });
    await expect(key).toHaveTextContent(/^0$/);
    await expect(group).toHaveTextContent(/^0\+0$/);
    await expect(group.querySelectorAll('[data-ui="kbd-separator"]')).toHaveLength(1);
  },
};

export const KeyboardFocus: Story = {
  parameters: {
    docs: {
      source: {
        code: `<>
  <button type="button">Before key</button>
  <Kbd>Esc</Kbd>
  <button type="button">After key</button>
</>`,
      },
    },
  },
  render: () => (
    <>
      <button type="button">Before key</button>
      <Kbd>Esc</Kbd>
      <button type="button">After key</button>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const key = canvas.getByText('Esc');
    await expect(key.tagName).toBe('KBD');
    canvas.getByRole('button', { name: 'Before key' }).focus();
    await expect(canvas.getByRole('button', { name: 'Before key' })).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'After key' })).toHaveFocus();
    await expect(key).not.toHaveFocus();
  },
};

export const Inline: Story = {
  parameters: {
    docs: {
      source: {
        code: '<p>Press <Kbd.Group><Kbd>Cmd</Kbd><Kbd>K</Kbd></Kbd.Group> to search, or <Kbd>Esc</Kbd> to close.</p>',
      },
    },
  },
  render: () => <ShortcutHints />,
  play: async ({ canvasElement }) => {
    const paragraph = canvasElement.querySelector('p') as HTMLElement;
    await expect(paragraph.querySelectorAll('kbd')).toHaveLength(3);
    await expect(paragraph).toHaveTextContent('Press Cmd+K to search, or Esc to close.');
  },
};

export const LightTheme: Story = {
  parameters: {
    docs: {
      source: {
        code: `<ThemeRoot theme="light">
  <Kbd>Esc</Kbd>
  <Kbd.Group><Kbd>Cmd</Kbd><Kbd>K</Kbd></Kbd.Group>
</ThemeRoot>`,
      },
    },
  },
  decorators: [withLightTheme],
  render: () => (
    <div style={stackStyle}>
      <Kbd>Esc</Kbd>
      <CommandShortcut />
      <ShortcutHints />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-ui="kbd"]')).toHaveLength(6);
  },
};
