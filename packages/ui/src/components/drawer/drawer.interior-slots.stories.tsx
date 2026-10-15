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
  Drawer,
  type DrawerEasyProps,
  type DrawerHeaderProps,
} from './drawer';

// @ts-expect-error Unknown slot key is rejected on DrawerEasyProps['slots']
type UnknownDrawerSlot = NonNullable<DrawerEasyProps['slots']>['unknownKey'];

const CustomDrawerMaterial = styled.div({
  backgroundColor: vars.color.surfaceRaised,
  border: `2px dashed ${vars.color.borderControl}`,
  boxShadow: 'none',
});

function CustomDrawerPanel({ className, ref, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <CustomDrawerMaterial ref={ref} {...props} className={className} data-slot="drawer-panel-winner" />
  );
}

function UnusedDrawerPanel({ className, ref, ...props }: ComponentPropsWithRef<'div'>) {
  return <div ref={ref} {...props} className={className} data-slot="drawer-panel-loser" />;
}

function CustomDrawerHeader({ className, ref, ...props }: DrawerHeaderProps) {
  return <Drawer.Header ref={ref} {...props} className={className} data-slot="custom-drawer-header" />;
}

const rootRefTracker = createRefCleanupTracker<HTMLDivElement>();

function DrawerCustomizationFixture() {
  // Inline styles exercise the documented root/slot style-merging API.
  const [mounted, setMounted] = useState(true);
  const [count, setCount] = useState(0);
  const controls = <>
    <Button onClick={() => setCount((c) => c + 1)}>Rerender ({count})</Button>
    <Button onClick={() => setMounted(false)}>Toggle mount</Button>
  </>;

  return (
    <FixtureFrame>
      {mounted && (
        <Drawer
          defaultOpen
          triggerLabel="Open drawer"
          title="Custom Drawer"
          description="Manage navigation."
          content={<>{controls}<p>Drawer body content</p></>}
          closeLabel="Close drawer"
          component={UnusedDrawerPanel}
          slots={{
            root: CustomDrawerPanel,
            header: CustomDrawerHeader,
          }}
          className="top-drawer-class"
          data-winner="host"
          style={{ textTransform: 'none', letterSpacing: '1px' }}
          slotProps={{
            root: {
              ref: rootRefTracker.ref,
              className: 'slot-drawer-class',
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

const meta = {
  title: 'Surfaces/Drawer',
  component: Drawer,
  parameters: { docs: { description: { component: 'Open a modal panel from a viewport edge.' } } },
} satisfies Meta<typeof Drawer>;

export default meta;

type Story = StoryObj<(props: DrawerEasyProps) => ReactNode>;

/** Customize the drawer panel surface and header using slots. */
export const Customization: Story = {
  tags: ['!autodocs'],
  render: () => <DrawerCustomizationFixture />,
  parameters: {
    docs: {
      description: {
        story: 'Customize the drawer panel surface and header using slots.',
      },
      source: {
        code: `<Drawer
  defaultOpen
  triggerLabel="Open drawer"
  title="Navigation"
  description="Navigate application."
  content={<p>Body</p>}
  closeLabel="Close"
  slots={{
    root: CustomDrawerPanel,
    header: CustomDrawerHeader,
  }}
  slotProps={{
    root: { className: 'custom-drawer-panel' },
  }}
/>`,
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    // 1. Root replacement precedence: slots.root wins over component
    const panel = await expectRootPrecedence(
      canvasElement.ownerDocument,
      '[data-slot="drawer-panel-winner"]',
      '[data-slot="drawer-panel-loser"]',
    );

    // 2. Class and style merge: top extra props merge with slotProps.root, slot conflicts win
    await expectMergedClasses(panel, 'top-drawer-class', 'slot-drawer-class');
    await expect(panel).toHaveStyle({ textTransform: 'none', letterSpacing: '2px', zIndex: '42' });
    await expect(panel).toHaveAttribute('data-winner', 'slotProps-root');

    // 3. Interior slot replacement
    const header = canvasElement.ownerDocument.querySelector('[data-slot="custom-drawer-header"]');
    await expect(header).not.toBeNull();

    // 4. Ref propagation
    await expect(rootRefTracker.getNode()).toBe(panel);
    await expect(rootRefTracker.isCleanedUp()).toBe(false);

    // 5. Test mounted DOM identity across rerender
    const rerenderBtn = within(canvasElement).getByRole('button', { name: /^Rerender/ });
    await userEvent.click(rerenderBtn);
    const panelAfterRerender = canvasElement.ownerDocument.querySelector('[data-slot="drawer-panel-winner"]');
    const headerAfterRerender = canvasElement.ownerDocument.querySelector('[data-slot="custom-drawer-header"]');
    await expectSameDomIdentity(panel, panelAfterRerender);
    await expectSameDomIdentity(header, headerAfterRerender);

    // 6. Callback-ref cleanup on unmount
    const toggleBtn = within(canvasElement).getByRole('button', { name: 'Toggle mount' });
    await userEvent.click(toggleBtn);
    await expect(rootRefTracker.isCleanedUp()).toBe(true);

  },
};
