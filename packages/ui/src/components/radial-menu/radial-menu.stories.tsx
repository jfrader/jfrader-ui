import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { withLightTheme } from '../../testing/story-decorators';
import { settleMotion } from '../../testing/motion-assertions';
import { RadialMenu } from './index';
import { Surface } from '../surface';

const Frame = styled(Surface)({
  boxSizing: 'border-box',
  inlineSize: `calc(${vars.space[8]} * 18)`,
  maxInlineSize: '100%',
  minBlockSize: `calc(${vars.space[8]} * 12)`,
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  placeItems: 'center',
  padding: vars.space[8],
  gap: vars.space[4],
});
const NoteLabel = styled.p({
  justifySelf: 'start',
  margin: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});
const actions = [
  { id: 'copy', label: 'Copy', icon: '＋' },
  { id: 'archive', label: 'Archive', icon: '↓' },
  { id: 'delete', label: 'Delete', icon: '×', tone: 'danger' as const },
];
const meta = {
  title: 'Showcase/RadialMenu',
  component: RadialMenu,
  tags: ['autodocs'],
  args: { label: 'Note actions', actions, onAction: fn(), onOpenChange: fn() },
  render: (args) => (
    <Frame>
      <NoteLabel>Product notes · Launch checklist</NoteLabel>
      <RadialMenu {...args} />
    </Frame>
  ),
  parameters: {
    a11y: {
      config: {
        rules: [
          {
            id: 'aria-hidden-focus',
            selector:
              '[aria-hidden="true"]:not([data-floating-ui-focus-guard])',
          },
        ],
      },
    },
    docs: {
      sections: [
        { title: 'Object actions', stories: ['Default'] },
      ],
      description: {
        component:
          'Choose a short object action from buttons arranged around a trigger.',
      },
      usage: `### Keyboard
Enter, Space and ArrowDown open the menu. ArrowUp opens on the last action. Up/Down and Left/Right wrap between enabled actions; horizontal arrows follow RTL. Home/End jump, and typing finds an action. Escape returns to the trigger after an accepted close. Tab leaves without moving focus back.
### Keyboard and accessibility

Click the trigger, then an action. Hold the trigger for 250ms and drag over an action to select on release. Release elsewhere to cancel. Disabled actions cannot run. A pending action blocks repeat requests; a rejection leaves a readable failure and allows retry.
### Geometry

Use three to six actions. The menu uses a vertical layout when targets overlap or the viewport cannot fit the radial stage. Reduced motion removes the entrance animation.`,
      source: {
        language: 'tsx',
        code: `import { RadialMenu, Surface, styled, type RadialMenuProps } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Frame = styled(Surface)({
  boxSizing: 'border-box',
  inlineSize: \`calc(\${vars.space[8]} * 18)\`,
  maxInlineSize: '100%',
  minBlockSize: \`calc(\${vars.space[8]} * 12)\`,
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  placeItems: 'center',
  padding: vars.space[8],
  gap: vars.space[4],
});
const NoteLabel = styled.p({
  justifySelf: 'start', margin: 0, fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm, color: vars.color.textMuted,
});
const actions = [
  { id: 'copy', label: 'Copy', icon: '＋' },
  { id: 'archive', label: 'Archive', icon: '↓' },
  { id: 'delete', label: 'Delete', icon: '×', tone: 'danger' as const },
];

export function NoteActions({ onAction }: Pick<RadialMenuProps, 'onAction'>) {
  return (
    <Frame>
      <NoteLabel>Product notes · Launch checklist</NoteLabel>
      <RadialMenu label="Note actions" actions={actions} onAction={onAction} />
    </Frame>
  );
}`,
      },
    },
  },
} satisfies Meta<typeof RadialMenu>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  name: 'Note actions',
  parameters: { docs: { description: { story: 'Open the trigger to copy, archive or delete a note.' } } },
};
export const Light: Story = {
  globals: { theme: 'light' },
  decorators: [withLightTheme],
};
export const RTL: Story = { args: { dir: 'rtl' } };
export const Disabled: Story = { args: { disabled: true } };
export const Empty: Story = { args: { actions: [] } };
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion in your browser; actions open without an entrance.',
      },
    },
  },
};
export const PersistentOpen: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    await settleMotion(
      await within(canvasElement.ownerDocument.body).findByRole('menu'),
    );
  },
};
export const LinearFallback: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, radius: 40, spread: 20 },
  play: async ({ canvasElement }) => {
    const menu = await within(canvasElement.ownerDocument.body).findByRole(
      'menu',
    );
    await settleMotion(menu);
  },
};
export const Keyboard: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await expect(canvas.queryByRole('status')).toBeNull();
    const trigger = canvas.getByRole('button', { name: 'Note actions' });
    const doc = canvasElement.ownerDocument;
    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    const menu = await within(doc.body).findByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    await waitFor(() => expect(doc.activeElement).toBe(items[2]));
    await userEvent.keyboard('{Home}');
    await expect(doc.activeElement).toBe(items[0]);
    await expect(getComputedStyle(items[0]!).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{ArrowDown}');
    await expect(doc.activeElement).toBe(items[1]);
    await userEvent.keyboard('{End}{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.keyboard('{Enter}');
    const reopened = await within(doc.body).findByRole('menu');
    await userEvent.click(
      within(reopened).getByRole('menuitem', { name: 'Copy' }),
    );
    await expect(args.onAction).toHaveBeenCalledTimes(1);
    await expect(args.onAction).toHaveBeenCalledWith('copy');
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
export const RejectedOpen: Story = {
  tags: ['!autodocs'],
  args: { open: false },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Note actions' }));
    await expect(args.onOpenChange).toHaveBeenCalledWith(true);
    await expect(
      within(canvasElement.ownerDocument.body).queryByRole('menu'),
    ).toBeNull();
  },
};
export const HoldDrag: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: 'Note actions' });
    await userEvent.pointer({ target: trigger, keys: '[MouseLeft>]' });
    const menu = await within(canvasElement.ownerDocument.body).findByRole(
      'menu',
    );
    await settleMotion(menu);
    const action = within(menu).getByRole('menuitem', { name: 'Archive' });
    const rect = action.getBoundingClientRect();
    await userEvent.pointer({
      target: trigger,
      coords: {
        clientX: rect.x + rect.width / 2,
        clientY: rect.y + rect.height / 2,
      },
    });
    await userEvent.pointer({ target: trigger, keys: '[/MouseLeft]' });
    await expect(args.onAction).toHaveBeenCalledTimes(1);
    await expect(args.onAction).toHaveBeenCalledWith('archive');
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).queryByRole('menu'),
      ).toBeNull(),
    );
  },
};
export const Pending: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, onAction: fn(() => new Promise<void>(() => {})) },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const menu = await within(canvasElement.ownerDocument.body).findByRole(
      'menu',
    );
    await settleMotion(menu);
    const copy = within(menu).getByRole('menuitem', { name: 'Copy' });
    await userEvent.click(copy);
    await userEvent.click(copy);
    await expect(args.onAction).toHaveBeenCalledTimes(1);
    await expect(menu).toHaveAttribute('aria-busy', 'true');
    await expect(canvas.getByRole('status')).toHaveTextContent('Copy: pending');
  },
};
export const RejectedClose: Story = {
  tags: ['!autodocs'],
  args: { open: true },
  play: async ({ canvasElement, userEvent }) => {
    const menu = await within(canvasElement.ownerDocument.body).findByRole(
      'menu',
    );
    await settleMotion(menu);
    const copy = within(menu).getByRole('menuitem', { name: 'Copy' });
    copy.focus();
    await userEvent.keyboard('{Escape}');
    await expect(menu).toBeVisible();
    await expect(copy).toHaveFocus();
  },
};
export const Failure: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    onAction: fn(async () => {
      throw new Error('Unavailable');
    }),
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const menu = await within(canvasElement.ownerDocument.body).findByRole(
      'menu',
    );
    await settleMotion(menu);
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Copy' }));
    await expect(await canvas.findByRole('status')).toHaveTextContent(
      'Copy: failed',
    );
  },
};
