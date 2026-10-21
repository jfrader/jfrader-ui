import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Kbd } from './index';
import { styled } from '../../index';

const NarrowHint = styled.p({ margin: 0, inlineSize: '12rem', maxInlineSize: '100%', color: vars.color.text });

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
  parameters: {
    docs: {
      sections: [
        { title: 'Shortcut hints', stories: ['Inline', 'Default', 'Combination'] },
      ],
      description: { component: 'Show a keyboard key or a combination of keys in text.' },
      usage: `### Keyboard
- Kbd labels input but does not register shortcuts or receive focus by default. Handle the shortcut in your application and supply the key names for the user's platform.`,
    },
  },
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
  name: 'Single key',
  parameters: { docs: { description: { story: 'Label the Escape key on its own.' }, source: { language: 'tsx', code: `import { Kbd } from '@jfrader/ui';

<Kbd>Esc</Kbd>` } } },
  play: async ({ canvasElement }) => {
    const key = within(canvasElement).getByText('Esc');
    await expect(key.tagName).toBe('KBD');
    await expect(key).toHaveAttribute('data-ui', 'kbd');
    const style = getComputedStyle(key);
    await expect(parseFloat(style.borderBottomWidth)).toBeGreaterThan(parseFloat(style.borderTopWidth));
  },
};

export const Combination: Story = {
  name: 'Key combination',
  parameters: {
    docs: {
      description: { story: 'Join the keys pressed together for a shortcut.' },
      source: {
        language: 'tsx',
        code: `import { Kbd } from '@jfrader/ui';

<Kbd.Group>
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
  name: 'Shortcuts in text',
  parameters: {
    docs: {
      description: { story: 'Place search and close shortcuts in a sentence.' },
      source: {
        language: 'tsx',
        code: `import { Kbd, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Hint = styled.p({ margin: 0, fontSize: vars.textSize.sm, color: vars.color.text });

<Hint>
  Press <Kbd.Group><Kbd>Cmd</Kbd><Kbd>K</Kbd></Kbd.Group> to search, or <Kbd>Esc</Kbd> to close.
</Hint>`,
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

export const LongKey: Story = {
  name: 'Long key',
  args: { children: 'BrowserFavoritesAndHistory' },
  render: (args) => <NarrowHint><Kbd {...args} /></NarrowHint>,
  play: async ({ canvasElement }) => {
    const key = canvasElement.querySelector('kbd')!;
    const lane = key.parentElement!.getBoundingClientRect();
    const rect = key.getBoundingClientRect();
    await expect(rect.right).toBeLessThanOrEqual(lane.right + 1);
    await expect(key.scrollWidth).toBeLessThanOrEqual(key.clientWidth + 1);
  },
};

export const LongCombination: Story = {
  name: 'Long combination',
  render: () => <NarrowHint><Kbd.Group><Kbd>Control</Kbd><Kbd>Shift</Kbd><Kbd>Alt</Kbd><Kbd>ArrowRight</Kbd></Kbd.Group></NarrowHint>,
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector<HTMLElement>('[data-ui="kbd-group"]')!;
    const lane = group.parentElement!.getBoundingClientRect();
    await expect(group.getBoundingClientRect().right).toBeLessThanOrEqual(lane.right + 1);
    for (const key of group.querySelectorAll('kbd')) {
      await expect(key.getBoundingClientRect().right).toBeLessThanOrEqual(lane.right + 1);
    }
    await expect(group.scrollWidth).toBeLessThanOrEqual(group.clientWidth + 1);
  },
};
