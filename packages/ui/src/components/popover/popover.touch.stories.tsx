import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { expectTouchTargets } from '../../testing/touch-target-assertions';
import { Dialog } from '../dialog';
import { Menu } from '../menu';
import { UserMenu } from '../user-menu';
import { Popover } from './popover';

const Triggers = styled.div({ display: 'flex', flexWrap: 'wrap', gap: vars.space[4] });

const meta = {
  title: 'Surfaces/Popover',
  tags: ['!autodocs'],
  parameters: {
    docs: { description: { component: 'Open a popover, menu, dialog, or account menu.' } },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const OverlayTriggerTouchTargets: Story = {
  name: 'Overlay trigger touch targets',
  render: () => (
    <Triggers>
      <Popover>
        <Popover.Trigger aria-label="Open popover">P</Popover.Trigger>
        <Popover.Content aria-label="Details">Details</Popover.Content>
      </Popover>
      <Menu>
        <Menu.Trigger aria-label="Open menu">M</Menu.Trigger>
        <Menu.Content><Menu.Item>Profile</Menu.Item></Menu.Content>
      </Menu>
      <Dialog>
        <Dialog.Trigger aria-label="Open dialog">D</Dialog.Trigger>
        <Dialog.Content><Dialog.Title>Details</Dialog.Title><Dialog.Close>Close</Dialog.Close></Dialog.Content>
      </Dialog>
      <UserMenu user={{ name: 'Ada', email: 'ada@example.com' }}>
        <UserMenu.Trigger aria-label="Account menu, Ada" />
        <UserMenu.Content variant="menu" closeLabel="Close account menu"><UserMenu.Item>Profile</UserMenu.Item></UserMenu.Content>
      </UserMenu>
    </Triggers>
  ),
  play: async ({ canvasElement }) => {
    const triggers = within(canvasElement).getAllByRole<HTMLButtonElement>('button');
    await expect(triggers).toHaveLength(4);
    await expectTouchTargets(triggers);
    for (const trigger of triggers) {
      const bounds = trigger.getBoundingClientRect();
      const hit = trigger.ownerDocument.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await expect(trigger.contains(hit)).toBe(true);
    }
  },
};
