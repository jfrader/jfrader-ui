import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { Button } from '../button';
import {
  createRefCleanupTracker,
  expectMergedClasses,
  expectRootPrecedence,
  expectSameDomIdentity,
} from '../../testing/interior-slot-assertions';
import {
  Menu,
  type MenuEasyProps,
  type MenuItemProps,
} from './menu';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const Frame = styled.div({ padding: vars.space[4] });

// @ts-expect-error Unknown slot key is rejected on MenuEasyProps['slots']
type UnknownMenuSlot = NonNullable<MenuEasyProps['slots']>['unknownKey'];

function CustomMenuRoot({ className, ref, ...props }: ComponentPropsWithRef<'div'>) {
  return <div ref={ref} {...props} className={className} data-slot="menu-root-winner" />;
}

function UnusedMenuRoot({ className, ref, ...props }: ComponentPropsWithRef<'div'>) {
  return <div ref={ref} {...props} className={className} data-slot="menu-root-loser" />;
}

function CustomMenuItem({ className, ref, ...props }: MenuItemProps) {
  return <Menu.Item ref={ref} {...props} className={className} data-slot="custom-menu-item" />;
}

const rootRefTracker = createRefCleanupTracker<HTMLDivElement>();

const MENU_ITEMS = [
  { type: 'item' as const, label: 'Edit', onSelect: () => {} },
  { type: 'item' as const, label: 'Duplicate', onSelect: () => {} },
  { type: 'separator' as const },
  { type: 'item' as const, label: 'Delete', onSelect: () => {} },
];

// This fixture tests native inline style merging through the slot API.
function MenuCustomizationFixture() {
  const [mounted, setMounted] = useState(true);
  const [count, setCount] = useState(0);

  return (
    <Frame>
      <Button onClick={() => setCount((c) => c + 1)}>Rerender ({count})</Button>
      <Button onClick={() => setMounted((m) => !m)}>Toggle mount</Button>
      {mounted && (
        <Menu
          triggerLabel="Actions"
          items={MENU_ITEMS}
          component={UnusedMenuRoot}
          slots={{
            root: CustomMenuRoot,
            item: CustomMenuItem,
          }}
          className="top-menu-class"
          data-winner="host"
          style={{ textTransform: 'none', letterSpacing: '1px' }}
          slotProps={{
            root: {
              ref: rootRefTracker.ref,
              className: 'slot-menu-class',
              style: { letterSpacing: '2px', zIndex: 42 },
              'data-winner': 'slotProps-root',
            },
          }}
        />
      )}
    </Frame>
  );
}

const meta = {
  title: 'Navigation/Menu',
  component: Menu,
  parameters: {
    docs: { description: { component: 'Open a menu of actions from a button.' } },
    a11y: {
      config: {
        rules: [{ id: 'aria-hidden-focus', selector: '[aria-hidden="true"]:not([data-floating-ui-focus-guard])' }],
      },
    },
  },
} satisfies Meta<typeof Menu>;

export default meta;

type Story = StoryObj<(props: MenuEasyProps) => ReactNode>;

/** Customize the menu root wrapper and action items using slots. */
export const Customization: Story = {
  tags: ['!autodocs'],
  render: () => <MenuCustomizationFixture />,
  parameters: {
    docs: {
      description: {
        story: 'Customize the menu root wrapper and action items using slots.',
      },
      source: {
        code: `<Menu
  triggerLabel="Actions"
  items={items}
  slots={{
    root: CustomMenuRoot,
    item: CustomMenuItem,
  }}
  slotProps={{
    root: { className: 'custom-menu-root' },
  }}
/>`,
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    // 1. Root replacement precedence: slots.root wins over component
    const root = await expectRootPrecedence(
      canvasElement,
      '[data-slot="menu-root-winner"]',
      '[data-slot="menu-root-loser"]',
    );

    // 2. Class and style merge: top extra props merge with slotProps.root, slot conflicts win
    await expectMergedClasses(root, 'top-menu-class', 'slot-menu-class');
    await expect(root).toHaveStyle({ textTransform: 'none', letterSpacing: '2px', zIndex: '42' });
    await expect(root).toHaveAttribute('data-winner', 'slotProps-root');

    // 3. Ref propagation
    await expect(rootRefTracker.getNode()).toBe(root);
    await expect(rootRefTracker.isCleanedUp()).toBe(false);

    // 4. Test mounted DOM identity across rerender
    const rerenderBtn = within(canvasElement).getByRole('button', { name: /^Rerender/ });
    await userEvent.click(rerenderBtn);
    const rootAfterRerender = canvasElement.querySelector('[data-slot="menu-root-winner"]');
    await expectSameDomIdentity(root, rootAfterRerender);

    // 5. Open menu to check interior item slot
    const trigger = within(canvasElement).getByRole('button', { name: 'Actions' });
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    const customItem = body.getAllByRole('menuitem')[0];
    await expect(customItem).toHaveAttribute('data-slot', 'custom-menu-item');

    // Close menu
    await userEvent.keyboard('{Escape}');

    // 6. Callback-ref cleanup on unmount
    const toggleBtn = within(canvasElement).getByRole('button', { name: 'Toggle mount' });
    await userEvent.click(toggleBtn);
    await expect(rootRefTracker.isCleanedUp()).toBe(true);

    // Restore mount
    await userEvent.click(toggleBtn);
  },
};
