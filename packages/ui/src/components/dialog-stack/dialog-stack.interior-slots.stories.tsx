import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { WithSx } from '../../styling/sx';
import { Button } from '../button';
import {
  createRefCleanupTracker,
  expectMergedClasses,
  expectRootPrecedence,
  expectSameDomIdentity,
} from '../../testing/interior-slot-assertions';
import {
  DialogStack,
  type DialogStackEasyProps,
  type DialogStackPageRecord,
} from './dialog-stack';

// @ts-expect-error Unknown slot key is rejected on DialogStackEasyProps['slots']
type UnknownDialogStackSlot = NonNullable<DialogStackEasyProps['slots']>['unknownKey'];

const customContentMaterial = css({
  backgroundColor: vars.color.surfaceRaised,
  border: `2px dashed ${vars.color.borderControl}`,
  boxShadow: 'none',
});

function CustomStackContent({ className, ref, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <WithSx styles={customContentMaterial} className={className}>
      {(classes) => <div ref={ref} {...props} className={classes} data-slot="stack-content-winner" />}
    </WithSx>
  );
}

function UnusedStackContent({ className, ref, ...props }: ComponentPropsWithRef<'div'>) {
  return <div ref={ref} {...props} className={className} data-slot="stack-content-loser" />;
}

function CustomStackBody({ className, ref, ...props }: ComponentPropsWithRef<'div'>) {
  return <div ref={ref} {...props} className={className} data-slot="custom-stack-body" />;
}

const rootRefTracker = createRefCleanupTracker<HTMLDivElement>();

const STACK_PAGES: readonly DialogStackPageRecord[] = [
  {
    value: 'settings',
    title: 'Settings',
    description: 'Customize application settings.',
    content: <p>Settings page content</p>,
    close: 'Close settings',
  },
];

function DialogStackCustomizationFixture() {
  const [mounted, setMounted] = useState(true);
  const [count, setCount] = useState(0);
  const controls = <>
    <Button onClick={() => setCount((c) => c + 1)}>Rerender ({count})</Button>
    <Button onClick={() => setMounted(false)}>Toggle mount</Button>
  </>;

  return (
    <div style={{ padding: vars.space[4] }}>
      {mounted && (
        <DialogStack
          defaultValue={['settings']}
          triggerLabel="Open settings"
          pages={STACK_PAGES.map((page) => ({ ...page, content: <>{controls}{page.content}</> }))}
          component={UnusedStackContent}
          slots={{
            root: CustomStackContent,
            body: CustomStackBody,
          }}
          slotProps={{
            content: {
              className: 'content-top-class',
              'data-winner': 'host',
              style: { textTransform: 'none', letterSpacing: '1px' },
            },
            root: {
              ref: rootRefTracker.ref,
              className: 'slot-root-class',
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
  title: 'Surfaces/DialogStack',
  component: DialogStack,
  parameters: { docs: { description: { component: 'Navigate stacked modal panels with back and close actions.' } } },
} satisfies Meta<typeof DialogStack>;

export default meta;

type Story = StoryObj<(props: DialogStackEasyProps) => ReactNode>;

/** Customize stack panels and body wrapper using slots. */
export const Customization: Story = {
  tags: ['!autodocs'],
  render: () => <DialogStackCustomizationFixture />,
  parameters: {
    docs: {
      description: {
        story: 'Customize stack panels and body wrapper using slots.',
      },
      source: {
        code: `<DialogStack
  defaultValue={['settings']}
  triggerLabel="Open settings"
  pages={pages}
  slots={{
    root: CustomStackContent,
    body: CustomStackBody,
  }}
  slotProps={{
    content: { className: 'content-top-class' },
    root: { className: 'slot-root-class' },
  }}
/>`,
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    // 1. Root replacement precedence: slots.root wins over component
    const content = await expectRootPrecedence(
      canvasElement.ownerDocument,
      '[data-slot="stack-content-winner"]',
      '[data-slot="stack-content-loser"]',
    );

    // 2. Class and style merge: slotProps.content merges with slotProps.root, slot conflicts win
    await expectMergedClasses(content, 'content-top-class', 'slot-root-class');
    await expect(content).toHaveStyle({ textTransform: 'none', letterSpacing: '2px', zIndex: '42' });
    await expect(content).toHaveAttribute('data-winner', 'slotProps-root');

    // 3. Interior slot replacement
    const body = canvasElement.ownerDocument.querySelector('[data-slot="custom-stack-body"]');
    await expect(body).not.toBeNull();

    // 4. Ref propagation
    await expect(rootRefTracker.getNode()).toBe(content);
    await expect(rootRefTracker.isCleanedUp()).toBe(false);

    // 5. Test mounted DOM identity across rerender
    const rerenderBtn = within(content).getByRole('button', { name: /^Rerender/ });
    await userEvent.click(rerenderBtn);
    const contentAfterRerender = canvasElement.ownerDocument.querySelector('[data-slot="stack-content-winner"]');
    const bodyAfterRerender = canvasElement.ownerDocument.querySelector('[data-slot="custom-stack-body"]');
    await expectSameDomIdentity(content, contentAfterRerender);
    await expectSameDomIdentity(body, bodyAfterRerender);

    // 6. Callback-ref cleanup on unmount
    const toggleBtn = within(content).getByRole('button', { name: 'Toggle mount' });
    await userEvent.click(toggleBtn);
    await expect(rootRefTracker.isCleanedUp()).toBe(true);

  },
};
