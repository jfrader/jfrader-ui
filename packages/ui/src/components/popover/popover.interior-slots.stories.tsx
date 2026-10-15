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
  Popover,
  type PopoverEasyProps,
} from './popover';

// @ts-expect-error Unknown slot key is rejected on PopoverEasyProps['slots']
type UnknownPopoverSlot = NonNullable<PopoverEasyProps['slots']>['unknownKey'];

function CustomPopoverRoot({ className, ref, ...props }: ComponentPropsWithRef<'div'>) {
  return <div ref={ref} {...props} className={className} data-slot="popover-root-winner" />;
}

function UnusedPopoverRoot({ className, ref, ...props }: ComponentPropsWithRef<'div'>) {
  return <div ref={ref} {...props} className={className} data-slot="popover-root-loser" />;
}

function CustomPopoverContent({ className, ref, ...props }: ComponentPropsWithRef<'div'>) {
  return <div ref={ref} {...props} className={className} data-slot="custom-popover-content" />;
}

const rootRefTracker = createRefCleanupTracker<HTMLDivElement>();

function PopoverCustomizationFixture() {
  const [mounted, setMounted] = useState(true);
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: vars.space[4] }}>
      <Button onClick={() => setCount((c) => c + 1)}>Rerender ({count})</Button>
      <Button onClick={() => setMounted((m) => !m)}>Toggle mount</Button>
      {mounted && (
        <Popover
          triggerLabel="Share link"
          label="Share options"
          content={<p>Popover details</p>}
          component={UnusedPopoverRoot}
          slots={{
            root: CustomPopoverRoot,
            content: CustomPopoverContent,
          }}
          className="top-popover-class"
          data-winner="host"
          style={{ textTransform: 'none', letterSpacing: '1px' }}
          slotProps={{
            root: {
              ref: rootRefTracker.ref,
              className: 'slot-popover-class',
              style: { letterSpacing: '2px', zIndex: 42 },
              'data-winner': 'slotProps-root',
            },
          }}
        />
      )}
    </div>
  );
}

const meta = {
  title: 'Surfaces/Popover',
  component: Popover,
  parameters: {
    docs: { description: { component: 'Open non-modal content beside a trigger button.' } },
    a11y: {
      config: {
        rules: [{ id: 'aria-hidden-focus', selector: '[aria-hidden="true"]:not([data-floating-ui-focus-guard])' }],
      },
    },
  },
} satisfies Meta<typeof Popover>;

export default meta;

type Story = StoryObj<(props: PopoverEasyProps) => ReactNode>;

/** Customize the popover root wrapper and content container using slots. */
export const Customization: Story = {
  tags: ['!autodocs'],
  render: () => <PopoverCustomizationFixture />,
  parameters: {
    docs: {
      description: {
        story: 'Customize the popover root wrapper and content container using slots.',
      },
      source: {
        code: `<Popover
  triggerLabel="Share link"
  label="Share options"
  content={<p>Details</p>}
  slots={{
    root: CustomPopoverRoot,
    content: CustomPopoverContent,
  }}
  slotProps={{
    root: { className: 'custom-popover-root' },
  }}
/>`,
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    // 1. Root replacement precedence: slots.root wins over component
    const root = await expectRootPrecedence(
      canvasElement,
      '[data-slot="popover-root-winner"]',
      '[data-slot="popover-root-loser"]',
    );

    // 2. Class and style merge: top extra props merge with slotProps.root, slot conflicts win
    await expectMergedClasses(root, 'top-popover-class', 'slot-popover-class');
    await expect(root).toHaveStyle({ textTransform: 'none', letterSpacing: '2px', zIndex: '42' });
    await expect(root).toHaveAttribute('data-winner', 'slotProps-root');

    // 3. Ref propagation
    await expect(rootRefTracker.getNode()).toBe(root);
    await expect(rootRefTracker.isCleanedUp()).toBe(false);

    // 4. Test mounted DOM identity across rerender
    const rerenderBtn = within(canvasElement).getByRole('button', { name: /^Rerender/ });
    await userEvent.click(rerenderBtn);
    const rootAfterRerender = canvasElement.querySelector('[data-slot="popover-root-winner"]');
    await expectSameDomIdentity(root, rootAfterRerender);

    // 5. Open popover to check interior content slot
    const trigger = within(canvasElement).getByRole('button', { name: 'Share link' });
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    const customContent = body.getByRole('dialog', { name: 'Share options' });
    await expect(customContent).toHaveAttribute('data-slot', 'custom-popover-content');

    // Close popover
    await userEvent.keyboard('{Escape}');

    // 6. Callback-ref cleanup on unmount
    const toggleBtn = within(canvasElement).getByRole('button', { name: 'Toggle mount' });
    await userEvent.click(toggleBtn);
    await expect(rootRefTracker.isCleanedUp()).toBe(true);

    // Restore mount
    await userEvent.click(toggleBtn);
  },
};
