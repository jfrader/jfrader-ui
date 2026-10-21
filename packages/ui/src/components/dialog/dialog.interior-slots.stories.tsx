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
import { Dialog, type DialogEasyProps } from './dialog';
import { expectInside } from '../../testing/geometry-assertions';
import { settleMotion } from '../../testing/motion-assertions';

// @ts-expect-error Unknown slot key is rejected on DialogEasyProps['slots']
type UnknownDialogSlot = NonNullable<DialogEasyProps['slots']>['unknownKey'];

const CustomPanelMaterial = styled.div({
  backgroundColor: vars.color.surfaceRaised,
  border: `2px dashed ${vars.color.borderControl}`,
  boxShadow: 'none',
});

function CustomDialogPanel({ className, ref, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <CustomPanelMaterial ref={ref} {...props} className={className} data-slot="dialog-panel-winner" />
  );
}

function UnusedDialogPanel({ className, ref, ...props }: ComponentPropsWithRef<'div'>) {
  return <div ref={ref} {...props} className={className} data-slot="dialog-panel-loser" />;
}

function CustomDialogHeader({ className, ref, ...props }: ComponentPropsWithRef<'div'>) {
  return <div ref={ref} {...props} className={className} data-slot="custom-dialog-header" />;
}

const rootRefTracker = createRefCleanupTracker<HTMLDivElement>();

function DialogCustomizationFixture() {
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
        <Dialog
          defaultOpen
          triggerLabel="Open dialog"
          title="Custom Dialog"
          description="Manage your profile."
          content={<>{controls}<p>Panel body text</p></>}
          closeLabel="Close"
          component={UnusedDialogPanel}
          slots={{
            root: CustomDialogPanel,
            header: CustomDialogHeader,
          }}
          className="top-dialog-class"
          data-winner="host"
          style={{ textTransform: 'none', letterSpacing: '1px' }}
          slotProps={{
            root: {
              ref: rootRefTracker.ref,
              className: 'slot-dialog-class',
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
  title: 'Surfaces/Dialog',
  component: Dialog,
  parameters: { docs: { description: { component: 'Open a modal dialog with a title, content and close action.' } } },
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<(props: DialogEasyProps) => ReactNode>;

/** Customize the dialog panel surface and header using slots. */
export const Customization: Story = {
  tags: ['!autodocs'],
  render: () => <DialogCustomizationFixture />,
  parameters: {
    docs: {
      description: {
        story: 'Customize the dialog panel surface and header using slots.',
      },
      source: {
        code: `<Dialog
  triggerLabel="Open"
  title="Profile"
  description="Manage settings."
  content={<p>Body</p>}
  closeLabel="Close"
  slots={{
    root: CustomDialogPanel,
    header: CustomDialogHeader,
  }}
  slotProps={{
    root: { className: 'custom-panel-props' },
  }}
/>`,
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    const dialogElement = canvasElement.ownerDocument.querySelector('dialog');
    await expect(dialogElement).not.toBeNull();

    // 1. Root replacement precedence: slots.root wins over component
    const panel = await expectRootPrecedence(
      canvasElement.ownerDocument,
      '[data-slot="dialog-panel-winner"]',
      '[data-slot="dialog-panel-loser"]',
    );
    await settleMotion(dialogElement!);
    await expectInside(panel, dialogElement!);

    // 2. Class and style merge: top extra props merge with slotProps.root, slot conflicts win
    await expectMergedClasses(panel, 'top-dialog-class', 'slot-dialog-class');
    await expect(panel).toHaveStyle({ textTransform: 'none', letterSpacing: '2px', zIndex: '42' });
    await expect(panel).toHaveAttribute('data-winner', 'slotProps-root');

    // 3. Interior slot replacement
    const header = canvasElement.ownerDocument.querySelector('[data-slot="custom-dialog-header"]');
    await expect(header).not.toBeNull();

    // 4. Ref propagation
    await expect(rootRefTracker.getNode()).toBe(panel);
    await expect(rootRefTracker.isCleanedUp()).toBe(false);

    // 5. Test mounted DOM identity across rerender
    const rerenderBtn = within(canvasElement).getByRole('button', { name: /^Rerender/ });
    await userEvent.click(rerenderBtn);
    const panelAfterRerender = canvasElement.ownerDocument.querySelector('[data-slot="dialog-panel-winner"]');
    const headerAfterRerender = canvasElement.ownerDocument.querySelector('[data-slot="custom-dialog-header"]');
    await expectSameDomIdentity(panel, panelAfterRerender);
    await expectSameDomIdentity(header, headerAfterRerender);

    // 6. Callback-ref cleanup on unmount
    const toggleBtn = within(canvasElement).getByRole('button', { name: 'Toggle mount' });
    await userEvent.click(toggleBtn);
    await expect(rootRefTracker.isCleanedUp()).toBe(true);

  },
};
