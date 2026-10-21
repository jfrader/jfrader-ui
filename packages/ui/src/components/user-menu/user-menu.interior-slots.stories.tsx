import { useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Button } from '../button';
import { ClassNames, css } from '../../styling/css';
import { UserMenu, type UserMenuShorthandProps } from './user-menu';
import { createRefCleanupTracker, expectMergedClasses, expectRootPrecedence, expectSameDomIdentity } from '../../testing/interior-slot-assertions';

// @ts-expect-error Replacement keys are closed.
type UnknownUserMenuSlot = NonNullable<UserMenuShorthandProps['slots']>['unknown'];
// @ts-expect-error Native interior keys are closed.
type UnknownUserMenuContentSlot = NonNullable<NonNullable<NonNullable<UserMenuShorthandProps['slotProps']>['content']>['slots']>['unknown'];

function AccountRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-slot="account-root" />;
}
function UnusedAccountRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-slot="unused-account-root" />;
}
function AccountList(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-slot="account-list" />;
}
const rootRefTracker = createRefCleanupTracker<HTMLDivElement>();
// This fixture tests native styles, registered classes, slot css and sx precedence.
const rootSlotStyle = css({ paddingInline: '7px' });
const rootConsumerStyle = css({ paddingInline: '9px' });

function AccountFixture() {
  const [mounted, setMounted] = useState(true);
  const [revision, setRevision] = useState(0);
  return <>
    <Button onClick={() => setRevision(revision + 1)}>Rerender</Button>
    <Button onClick={() => setMounted(false)}>Unmount</Button>
    {mounted && <ClassNames>{({ css: register }) => <UserMenu
      user={{ name: 'Ada Lovelace', email: 'ada@example.com' }}
      messages={{ trigger: 'Account', close: 'Close', signOut: 'Sign out', pending: 'Signing out', error: 'Sign out failed' }}
      items={[{ label: 'Profile' }, { label: 'Settings' }]}
      open
      variant="menu"
      component={UnusedAccountRoot}
      slots={{ root: AccountRoot }}
      className={`account-host ${register(rootConsumerStyle)}`}
      data-ui="account host"
      sx={revision === 0 ? { paddingInline: '11px' } : undefined}
      title="Host"
      style={{ textTransform: 'none', letterSpacing: '1px' }}
      slotProps={{
        root: { ref: rootRefTracker.ref, sx: rootSlotStyle, className: 'account-slot', title: 'Slot', style: { letterSpacing: '2px' }, 'data-ui': 'account slot' },
        content: { slots: { menu: AccountList }, title: String(revision) },
      }}
    />}</ClassNames>}
  </>;
}

export default {
  title: 'Navigation/UserMenu',
  component: UserMenu,
  parameters: { docs: { description: { component: 'Open account actions and preferences from an avatar button.' } } },
} satisfies Meta<typeof UserMenu>;

/** Replace the account list while keeping its keyboard navigation. */
export const InteriorSlots: StoryObj<(props: UserMenuShorthandProps) => ReactNode> = {
  tags: ['!autodocs'],
  render: () => <AccountFixture />,
  parameters: { docs: {
    description: { story: 'Replace the account list while keeping its keyboard navigation.' },
    source: { code: `function AccountList(props) {
  return <div {...props} data-account-list />;
}

<UserMenu user={user} messages={messages} items={items}
  slotProps={{ content: { slots: { menu: AccountList } } }} />` },
  } },
  play: async ({ canvasElement, userEvent }) => {
    const root = await expectRootPrecedence(canvasElement, '[data-slot="account-root"]', '[data-slot="unused-account-root"]');
    await expectMergedClasses(root, 'account-host', 'account-slot');
    await expect(root).toHaveStyle({ textTransform: 'none', letterSpacing: '2px' });
    await expect(root).toHaveAttribute('title', 'Slot');
    await expect(root).toHaveAttribute('data-ui', 'user-menu-root account host slot');
    await expect(root).toHaveStyle({ paddingInline: '11px' });
    await expect(rootRefTracker.getNode()).toBe(root);
    const menu = await within(canvasElement.ownerDocument.body).findByRole('menu');
    await expect(menu).toHaveAttribute('data-slot', 'account-list');
    const profile = within(menu).getByRole('menuitem', { name: 'Profile' });
    profile.focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Settings' }));
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Rerender' }));
    await expectSameDomIdentity(root, canvasElement.querySelector('[data-slot="account-root"]'));
    await expect(root).toHaveStyle({ paddingInline: '9px' });
    await expectSameDomIdentity(menu, canvasElement.ownerDocument.querySelector('[data-slot="account-list"]'));
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Unmount' }));
    await expect(rootRefTracker.isCleanedUp()).toBe(true);
  },
};
