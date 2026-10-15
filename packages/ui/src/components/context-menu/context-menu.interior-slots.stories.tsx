// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
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
  ContextMenu,
  type ContextMenuEasyProps,
  type ContextMenuItemProps,
} from './context-menu';

// @ts-expect-error Unknown slot key is rejected on ContextMenuEasyProps['slots']
type UnknownContextMenuSlot = NonNullable<ContextMenuEasyProps['slots']>['unknownKey'];

function CustomContextMenuRoot({ className, ref, ...props }: ComponentPropsWithRef<'div'>) {
  return <div ref={ref} {...props} className={className} data-slot="context-menu-root-winner" />;
}

function UnusedContextMenuRoot({ className, ref, ...props }: ComponentPropsWithRef<'div'>) {
  return <div ref={ref} {...props} className={className} data-slot="context-menu-root-loser" />;
}

function CustomContextMenuItem({ className, ref, ...props }: ContextMenuItemProps) {
  return <ContextMenu.Item ref={ref} {...props} className={className} data-slot="custom-context-item" />;
}

const rootRefTracker = createRefCleanupTracker<HTMLDivElement>();

const CONTEXT_ITEMS = [
  { type: 'item' as const, label: 'Cut', onSelect: () => {} },
  { type: 'item' as const, label: 'Copy', onSelect: () => {} },
  { type: 'separator' as const },
  { type: 'item' as const, label: 'Paste', onSelect: () => {} },
];

function ContextMenuCustomizationFixture() {
  // Inline styles exercise the documented root/slot style-merging API.
  const [mounted, setMounted] = useState(true);
  const [count, setCount] = useState(0);

  return (
    <FixtureFrame>
      <Button onClick={() => setCount((c) => c + 1)}>Rerender ({count})</Button>
      <Button onClick={() => setMounted((m) => !m)}>Toggle mount</Button>
      {mounted && (
        <ContextMenu
          targetLabel="Workspace area"
          content={<TargetContent>Right click or tap here</TargetContent>}
          items={CONTEXT_ITEMS}
          openOnClick
          component={UnusedContextMenuRoot}
          slots={{
            root: CustomContextMenuRoot,
            item: CustomContextMenuItem,
          }}
          className="top-context-class"
          data-winner="host"
          style={{ textTransform: 'none', letterSpacing: '1px' }}
          slotProps={{
            root: {
              ref: rootRefTracker.ref,
              className: 'slot-context-class',
              style: { letterSpacing: '2px', zIndex: 42 },
              'data-winner': 'slotProps-root',
            },
          }}
        />
      )}
    </FixtureFrame>
  );
}

const FixtureFrame = styled.div({ padding: vars.space[4] });

const TargetContent = styled.div({ padding: vars.space[4], border: `1px solid ${vars.color.border}` });

const meta = {
  title: 'Navigation/ContextMenu',
  component: ContextMenu,
  parameters: {
    docs: { description: { component: 'Open an action menu from a context target.' } },
    a11y: {
      config: {
        rules: [{ id: 'aria-hidden-focus', selector: '[aria-hidden="true"]:not([data-floating-ui-focus-guard])' }],
      },
    },
  },
} satisfies Meta<typeof ContextMenu>;

export default meta;

type Story = StoryObj<(props: ContextMenuEasyProps) => ReactNode>;

/** Customize the context menu root wrapper and action items using slots. */
export const Customization: Story = {
  tags: ['!autodocs'],
  render: () => <ContextMenuCustomizationFixture />,
  parameters: {
    docs: {
      description: {
        story: 'Customize the context menu root wrapper and action items using slots.',
      },
      source: {
        code: `<ContextMenu
  targetLabel="Workspace area"
  content={<div>Right click here</div>}
  items={items}
  slots={{
    root: CustomContextMenuRoot,
    item: CustomContextMenuItem,
  }}
  slotProps={{
    root: { className: 'custom-context-root' },
  }}
/>`,
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    // 1. Root replacement precedence: slots.root wins over component
    const root = await expectRootPrecedence(
      canvasElement,
      '[data-slot="context-menu-root-winner"]',
      '[data-slot="context-menu-root-loser"]',
    );

    // 2. Class and style merge: top extra props merge with slotProps.root, slot conflicts win
    await expectMergedClasses(root, 'top-context-class', 'slot-context-class');
    await expect(root).toHaveStyle({ textTransform: 'none', letterSpacing: '2px', zIndex: '42' });
    await expect(root).toHaveAttribute('data-winner', 'slotProps-root');

    // 3. Ref propagation
    await expect(rootRefTracker.getNode()).toBe(root);
    await expect(rootRefTracker.isCleanedUp()).toBe(false);

    // 4. Test mounted DOM identity across rerender
    const rerenderBtn = within(canvasElement).getByRole('button', { name: /^Rerender/ });
    await userEvent.click(rerenderBtn);
    const rootAfterRerender = canvasElement.querySelector('[data-slot="context-menu-root-winner"]');
    await expectSameDomIdentity(root, rootAfterRerender);

    // 5. Open context menu to check interior item slot
    const target = within(canvasElement).getByText('Right click or tap here');
    await userEvent.click(target);
    const body = within(canvasElement.ownerDocument.body);
    const customItem = body.getAllByRole('menuitem')[0];
    await expect(customItem).toHaveAttribute('data-slot', 'custom-context-item');

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
