// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { Button } from '../button';
import { expectInside } from '../../testing/geometry-assertions';
import {
  createRefCleanupTracker,
  expectMergedClasses,
  expectRootPrecedence,
  expectSameDomIdentity,
} from '../../testing/interior-slot-assertions';
import {
  BottomSheet,
  type BottomSheetShorthandProps,
  type BottomSheetHeaderProps,
} from './bottom-sheet';

// @ts-expect-error Unknown slot key is rejected on BottomSheetShorthandProps['slots']
type UnknownBottomSheetSlot = NonNullable<BottomSheetShorthandProps['slots']>['unknownKey'];

const CustomSheetMaterial = styled.div({
  backgroundColor: vars.color.surfaceRaised,
  border: `2px dashed ${vars.color.borderControl}`,
  boxShadow: 'none',
});

function CustomSheetPanel({ className, ref, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <CustomSheetMaterial ref={ref} {...props} className={className} data-slot="sheet-panel-winner" />
  );
}

function UnusedSheetPanel({ className, ref, ...props }: ComponentPropsWithRef<'div'>) {
  return <div ref={ref} {...props} className={className} data-slot="sheet-panel-loser" />;
}

function CustomSheetHeader({ className, ref, ...props }: BottomSheetHeaderProps) {
  return <BottomSheet.Header ref={ref} {...props} className={className} data-slot="custom-sheet-header" />;
}

const rootRefTracker = createRefCleanupTracker<HTMLDivElement>();

function BottomSheetCustomizationFixture() {
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
        <BottomSheet
          defaultOpen
          triggerLabel="Open sheet"
          title="Custom Bottom Sheet"
          description="Refine your search."
          content={<>{controls}<p>Sheet body content</p></>}
          closeLabel="Close sheet"
          component={UnusedSheetPanel}
          slots={{
            root: CustomSheetPanel,
            header: CustomSheetHeader,
          }}
          className="top-sheet-class"
          data-winner="host"
          style={{ textTransform: 'none', letterSpacing: '1px' }}
          slotProps={{
            root: {
              ref: rootRefTracker.ref,
              className: 'slot-sheet-class',
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
  title: 'Surfaces/BottomSheet',
  component: BottomSheet,
  parameters: { docs: { description: { component: 'Open a modal sheet with selectable height stops.' } } },
} satisfies Meta<typeof BottomSheet>;

export default meta;

type Story = StoryObj<(props: BottomSheetShorthandProps) => ReactNode>;

/** Customize the bottom sheet panel surface and header using slots. */
export const Customization: Story = {
  tags: ['!autodocs'],
  render: () => <BottomSheetCustomizationFixture />,
  parameters: {
    docs: {
      description: {
        story: 'Customize the bottom sheet panel surface and header using slots.',
      },
      source: {
        code: `<BottomSheet
  defaultOpen
  triggerLabel="Open sheet"
  title="Filters"
  description="Refine your search."
  content={<p>Body</p>}
  closeLabel="Close"
  slots={{
    root: CustomSheetPanel,
    header: CustomSheetHeader,
  }}
  slotProps={{
    root: { className: 'custom-sheet-panel' },
  }}
/>`,
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    // 1. Root replacement precedence: slots.root wins over component
    const panel = await expectRootPrecedence(
      canvasElement.ownerDocument,
      '[data-slot="sheet-panel-winner"]',
      '[data-slot="sheet-panel-loser"]',
    );

    // 2. Class and style merge: top extra props merge with slotProps.root, slot conflicts win
    await expectMergedClasses(panel, 'top-sheet-class', 'slot-sheet-class');
    await expect(panel).toHaveStyle({ textTransform: 'none', letterSpacing: '2px', zIndex: '42' });
    await expect(panel).toHaveAttribute('data-winner', 'slotProps-root');
    await expect(getComputedStyle(panel).boxSizing).toBe('border-box');
    await waitFor(() => expectInside(panel, canvasElement.querySelector('dialog')!));

    // 3. Interior slot replacement
    const header = canvasElement.ownerDocument.querySelector('[data-slot="custom-sheet-header"]');
    await expect(header).not.toBeNull();

    // 4. Ref propagation
    await expect(rootRefTracker.getNode()).toBe(panel);
    await expect(rootRefTracker.isCleanedUp()).toBe(false);

    // 5. Test mounted DOM identity across rerender
    const rerenderBtn = within(canvasElement).getByRole('button', { name: /^Rerender/ });
    await userEvent.click(rerenderBtn);
    const panelAfterRerender = canvasElement.ownerDocument.querySelector('[data-slot="sheet-panel-winner"]');
    const headerAfterRerender = canvasElement.ownerDocument.querySelector('[data-slot="custom-sheet-header"]');
    await expectSameDomIdentity(panel, panelAfterRerender);
    await expectSameDomIdentity(header, headerAfterRerender);

    // 6. Callback-ref cleanup on unmount
    const toggleBtn = within(canvasElement).getByRole('button', { name: 'Toggle mount' });
    await userEvent.click(toggleBtn);
    await expect(rootRefTracker.isCleanedUp()).toBe(true);

  },
};
