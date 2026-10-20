import { useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';
import { withLightTheme } from '../../testing/story-decorators';
import { expectNativeScrollbar } from '../../testing/theme-assertions';
import { ThemeRoot } from '../theme-root';
import { Button } from '../button';
import { Select } from '../select';
import { ShareSheet, type ShareSheetProps } from './index';

function ReplacementRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="replacement-root" />;
}
function SugarRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="sugar-root" />;
}

/** Replace the outer widget without replacing its sharing panel. */
export const RootReplacement: Story = {
  tags: ['!autodocs'],
  args: {
    component: SugarRoot,
    slots: { root: ReplacementRoot },
    ref: fn(),
    className: 'consumer-root',
    slotProps: { root: { ref: fn(), className: 'slot-root', title: 'Share', 'data-ui': 'custom' } },
  },
  play: async ({ canvasElement, args }) => {
    const root = within(canvasElement).getByTestId('replacement-root');
    await expect(within(canvasElement).queryByTestId('sugar-root')).toBeNull();
    await expect(root.tagName).toBe('DIV');
    await expect(root).toHaveClass('consumer-root', 'slot-root');
    await expect(root).toHaveAttribute('data-ui', 'share-sheet custom');
    await expect(root).toHaveAttribute('title', 'Share');
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(args.slotProps?.root?.ref).toHaveBeenCalledWith(root);
    await expect(within(root).getByRole('button', { name: 'Share' })).toHaveAttribute('aria-haspopup', 'dialog');
  },
};

export const RootComponent: Story = {
  tags: ['!autodocs'],
  args: { component: SugarRoot, presentation: 'inline' },
  play: async ({ canvasElement }) => {
    const root = within(canvasElement).getByTestId('sugar-root');
    await expect(root).toHaveAttribute('data-ui', 'share-sheet');
    await expect(within(root).getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  },
};

const PEOPLE = [
  { id: 'ada', name: 'Ada Lovelace' },
  { id: 'grace', name: 'Grace Hopper' },
  { id: 'linus', name: 'Linus Torvalds' },
];
const ACCESS = [
  { value: 'view', label: 'Can view' },
  { value: 'blocked', label: 'Owner only', disabled: true },
  { value: 'edit', label: 'Can edit' },
];
const CHANNELS = [{ id: 'team', label: 'Team channel', doneLabel: 'Shared with team' }];
const shareDataSource = `const people = [
  { id: 'ada', name: 'Ada Lovelace' },
  { id: 'grace', name: 'Grace Hopper' },
  { id: 'linus', name: 'Linus Torvalds' },
];
const accessOptions = [
  { value: 'view', label: 'Can view' },
  { value: 'blocked', label: 'Owner only', disabled: true },
  { value: 'edit', label: 'Can edit' },
];
const channels = [{ id: 'team', label: 'Team channel', doneLabel: 'Shared with team' }];`;
const meta = {
  title: 'Surfaces/ShareSheet',
  component: ShareSheet,
  tags: ['autodocs'],
  args: {
    title: 'Roadmap',
    link: 'https://example.com/roadmap',
    people: PEOPLE,
    accessOptions: ACCESS,
    channels: CHANNELS,
    presentation: 'popover',
    onSend: fn(),
    onChannel: fn(),
    onCopy: fn(),
    onOpenChange: fn(),
    onValueChange: fn(),
    onAccessChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        component:
          'Share a link with people and channels, and choose their access permission.',
      },
      sections: [
        { title: 'Inline sharing', stories: ['InlineComposition'] },
        { title: 'Overlay sharing', stories: ['Default', 'Controlled', 'ControlledRejectsOpen'] },
        { title: 'Composition and focus', stories: ['MultiInstance', 'OutsideFocus'] },
      ],
      usage: `### When to use
Let people copy a link, choose collaborators, and share access from one place. Sharing can stay in the page, open beside its trigger on desktop, or use a modal sheet on a phone.

### Keyboard and accessibility
Enter or Space opens the overlay and focuses Copy link. The desktop popover is nonmodal; the phone sheet is modal. The access picker uses virtual focus: use any arrow key, Home or End to navigate and Enter or Space to choose. Escape closes the access list before the sharing surface. People buttons announce their pressed state.

Close and Done return focus to the trigger; an outside desktop press does not. A rejected controlled request leaves the current open state, selection, or access unchanged.

### Sending
Choose at least one person before sending. Confirmation appears only after a successful send and stays until dismissed. A send that finishes after closing and reopening does not replace the new session. Sharing actions are unavailable without an enabled access option; send and channel actions also require application handlers.`,
    },
  },
  render: (args) => <ShareSheet {...args} />,
} satisfies Meta<typeof ShareSheet>;
export default meta;
type Story = StoryObj<typeof meta>;
function ReplacementDiv(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="div" />;
}
function ReplacementDialog(props: ComponentPropsWithRef<'dialog'>) {
  return <dialog {...props} data-replacement="dialog" />;
}
function ReplacementTitle(props: ComponentPropsWithRef<'h2'>) {
  return <h2 {...props} data-replacement="title" />;
}
function ReplacementButton(props: ComponentPropsWithRef<typeof Button>) {
  return <Button {...props} data-replacement="button" />;
}
function ReplacementAccess(props: ComponentPropsWithRef<typeof Select.Trigger>) {
  return <Select.Trigger {...props} data-replacement="access" />;
}

export const InlineComposition: Story = {
  name: 'Inline link and access',
  args: { presentation: 'inline', people: [], channels: [] },
  parameters: { docs: {
    description: { story: 'Keep the sharing heading, link copy action, and access picker in the page without an overlay.' },
    source: { language: 'tsx', code: `import { ShareSheet } from '@jfrader/ui';

<ShareSheet
  presentation="inline"
  title="Roadmap"
  link="https://example.com/roadmap"
  people={[]}
  channels={[]}
  accessOptions={[
    { value: 'view', label: 'Can view' },
    { value: 'blocked', label: 'Owner only', disabled: true },
    { value: 'edit', label: 'Can edit' },
  ]}
/>` },
  } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Share Roadmap' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Copy link' })).toBeVisible();
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="share-sheet"]')!;
    const panel = root.querySelector<HTMLElement>('[data-ui="share-sheet-content"]')!;
    await expect(panel.getBoundingClientRect().width).toBeGreaterThan(
      canvas.getByRole('button', { name: 'Copy link' }).getBoundingClientRect().width +
        canvas.getByRole('combobox').getBoundingClientRect().width,
    );
    await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth + 1);
    await expect(canvas.getByRole('heading').getBoundingClientRect().height).toBeLessThan(60);
  },
};

export const SlotReplacements: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    presentation: 'sheet',
    defaultValue: ['ada'],
    slotProps: {
      dialog: { className: 'custom-dialog', 'aria-label': 'Share permissions' },
      content: { className: 'custom-panel', 'aria-label': 'Share options' },
    },
    slots: {
      trigger: ReplacementButton,
      dialog: ReplacementDialog,
      content: ReplacementDiv,
      title: ReplacementTitle,
      copyButton: ReplacementButton,
      accessControl: ReplacementAccess,
      channelList: ReplacementDiv,
      selectedList: ReplacementDiv,
      peopleList: ReplacementDiv,
      sendButton: ReplacementButton,
      doneButton: ReplacementButton,
      status: ReplacementDiv,
      grabber: ReplacementDiv,
    },
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const dialog = await body(canvasElement).findByRole('dialog');
    await expect(dialog).toHaveAttribute('data-replacement', 'dialog');
    await expect(dialog).toHaveClass('custom-dialog');
    await expect(dialog).not.toHaveClass('custom-panel');
    await expect(dialog).toHaveAttribute('aria-label', 'Share permissions');
    const panel = dialog.querySelector('[data-ui="share-sheet-content"]');
    await expect(panel).toHaveClass('custom-panel');
    await expect(panel).not.toHaveClass('custom-dialog');
    await expect(panel).toHaveAttribute('aria-label', 'Share options');
    await expect(canvasElement.querySelectorAll('[data-replacement]')).toHaveLength(12);
    const access = within(dialog).getByRole('combobox');
    await expect(access).toHaveAttribute('data-replacement', 'access');
    await userEvent.click(access);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(args.onAccessChange).toHaveBeenCalledWith('edit');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send to 1 person' }));
    const done = await within(dialog).findByRole('button', { name: 'Done' });
    await expect(done).toHaveAttribute('data-replacement', 'button');
    await waitFor(async () => {
      await expect(done.ownerDocument.activeElement).toBe(done);
    });
    await userEvent.click(done);
    await expect(body(canvasElement).queryByRole('dialog')).not.toBeInTheDocument();
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      within(canvasElement).getByRole('button', { name: 'Share' }),
    );
  },
};

function body(element: HTMLElement) {
  return within(element.ownerDocument.body);
}
async function settled(canvasElement: HTMLElement) {
  const doc = canvasElement.ownerDocument;
  const shell = doc.querySelector<HTMLElement>('[data-ui="share-sheet-shell"]')!;
  const panel = doc.querySelector<HTMLElement>('[data-ui="share-sheet-content"]')!;
  const face = doc.querySelector<HTMLElement>('[data-ui="share-sheet-face"]')!;
  const win = doc.defaultView!;
  await waitFor(
    async () => {
      const outer = shell.getBoundingClientRect();
      const inner = panel.getBoundingClientRect();
      await expect(Math.abs(outer.width - inner.width)).toBeLessThan(1.1);
      await expect(Math.abs(outer.height - inner.height)).toBeLessThan(1.1);
      await expect(
        Math.abs(
          parseFloat(win.getComputedStyle(shell).borderTopLeftRadius) -
            parseFloat(win.getComputedStyle(panel).borderTopLeftRadius),
        ),
      ).toBeLessThan(1.1);
      await expect(win.getComputedStyle(face).opacity).toBe('1');
    },
    { timeout: 3000 },
  );
}
async function clipboard(
  element: HTMLElement,
  write: ((value: string) => Promise<void>) | undefined,
  run: () => Promise<void>,
) {
  const navigator = element.ownerDocument.defaultView!.navigator;
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: write ? { writeText: write } : undefined,
  });
  try {
    await run();
  } finally {
    if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
}
export const Default: Story = {
  name: 'Share with collaborators',
  parameters: { docs: {
    description: { story: 'Open Share to copy the roadmap link, select people, or share with the team channel.' },
    source: { language: 'tsx', code: `import { ShareSheet, type ShareSheetProps } from '@jfrader/ui';

${shareDataSource}

function RoadmapSharing({ onSend, onChannel }: Pick<ShareSheetProps, 'onSend' | 'onChannel'>) {
  return (
    <ShareSheet
      title="Roadmap"
      link="https://example.com/roadmap"
      presentation="popover"
      people={people}
      accessOptions={accessOptions}
      channels={channels}
      onSend={onSend}
      onChannel={onChannel}
    />
  );
}` },
  } },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: 'Share' });
    await userEvent.tab();
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(
      trigger.ownerDocument.defaultView!.getComputedStyle(trigger).outlineStyle,
    ).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    const copy = await body(canvasElement).findByRole('button', { name: 'Copy link' });
    await waitFor(async () => {
      await expect(copy.ownerDocument.activeElement).toBe(copy);
    });
    await expect(copy.ownerDocument.defaultView!.getComputedStyle(copy).outlineStyle).not.toBe(
      'none',
    );
    await settled(canvasElement);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledWith(true);
    const person = body(canvasElement).getByRole('button', { name: 'Ada Lovelace' });
    await userEvent.click(person);
    await expect(person).toHaveAttribute('aria-pressed', 'true');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(['ada']);
    await userEvent.click(body(canvasElement).getByRole('button', { name: 'Remove Ada Lovelace' }));
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, []);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.keyboard('{Escape}');
    await waitFor(async () => {
      await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    });
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(2, false);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};
export const AlignStart: Story = { tags: ['!autodocs'], args: { defaultOpen: true, align: 'start' } };
export const AlignEnd: Story = { tags: ['!autodocs'], args: { defaultOpen: true, align: 'end' } };
export const AlignCenter: Story = { tags: ['!autodocs'], args: { defaultOpen: true, align: 'center' } };
export const ForcedPopover: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, presentation: 'popover' },
  play: async ({ canvasElement }) => {
    const dialog = await body(canvasElement).findByRole('dialog');
    await waitFor(async () => {
      const bounds = dialog.getBoundingClientRect();
      await expect(bounds.bottom).toBeLessThanOrEqual(
        dialog.ownerDocument.defaultView!.innerHeight + 1.1,
      );
      await expect(bounds.top).toBeGreaterThanOrEqual(-1.1);
    });
  },
};
export const ForcedSheet: Story = { tags: ['!autodocs'], args: { defaultOpen: true, presentation: 'sheet' } };
export const PhoneResponsive: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, presentation: 'responsive' },
  parameters: {
    docs: {
      description: {
        story:
          'Resize the viewport below 520px to exercise the native sheet. The runner does not emulate a phone viewport.',
      },
    },
  },
};
export const Light: Story = { tags: ['!autodocs'], args: { defaultOpen: true }, decorators: [withLightTheme] };
export const LongNames: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    people: [{ id: 'long', name: 'Alexandria Catherine Montgomery-Wellington' }],
    defaultValue: ['long'],
    messages: {
      copy: 'Copy this document’s shareable link',
      copied: 'The document link has been copied',
    },
  },
  play: async ({ canvasElement }) => {
    const dialog = await body(canvasElement).findByRole('dialog');
    const copy = within(dialog).getByRole('button', {
      name: 'Copy this document’s shareable link',
    });
    await expect(copy).toHaveTextContent('Copy this document’s shareable link');
    const copied = dialog.querySelector<HTMLElement>('[data-ui="share-sheet-copied"]')!;
    await expect(copied.getBoundingClientRect().width).toBeLessThanOrEqual(dialog.clientWidth);
    await expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth + 1.1);
  },
};
export const EmptyPeople: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, people: [] },
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.click(
      await body(canvasElement).findByRole('button', { name: 'Send to 0 people' }),
    );
    await expect(args.onSend).not.toHaveBeenCalled();
    await expect(body(canvasElement).getByRole('status')).toHaveTextContent(
      'Choose at least one person.',
    );
  },
};
export const LongMemberList: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    presentation: 'responsive',
    people: Array.from({ length: 40 }, (_, index) => ({
      id: `member-${index}`,
      name: `Team member ${index + 1}`,
    })),
  },
  play: async ({ canvasElement, userEvent }) => {
    await body(canvasElement).findByRole('dialog');
    await settled(canvasElement);
    const panel = canvasElement.ownerDocument.querySelector<HTMLElement>(
      '[data-ui="share-sheet-content"]',
    )!;
    await expect(panel.scrollHeight).toBeGreaterThan(panel.clientHeight);
    await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth + 1);
    await expectNativeScrollbar(panel);
    const last = body(canvasElement).getByRole('button', { name: 'Team member 40' });
    await userEvent.click(last);
    await expect(last).toHaveAttribute('aria-pressed', 'true');
    const close = body(canvasElement).getByRole('button', { name: 'Close' });
    close.focus();
    await waitFor(async () => {
      const bounds = close.getBoundingClientRect();
      const outer = panel.getBoundingClientRect();
      await expect(bounds.bottom).toBeLessThanOrEqual(outer.bottom);
      await expect(bounds.top).toBeGreaterThanOrEqual(outer.top);
    });
  },
};
export const NoAccessOptions: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, accessOptions: [] },
  play: async ({ canvasElement }) => {
    await expect(
      await body(canvasElement).findByRole('button', { name: 'Copy link' }),
    ).toBeDisabled();
    await expect(
      body(canvasElement).getByRole('button', { name: 'Send to 0 people' }),
    ).toBeDisabled();
    await expect(body(canvasElement).getAllByText('Access unavailable')).toHaveLength(1);
    await expect(body(canvasElement).getByRole('combobox')).toHaveTextContent('Access unavailable');
  },
};
export const MissingControlledAccess: Story = {
  ...NoAccessOptions,
  tags: ['!autodocs'],
  args: { defaultOpen: true, access: 'missing' },
};
export const SelectedPeople: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, defaultValue: ['ada', 'grace', 'missing'] },
};
export const Sending: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, defaultValue: ['ada'], onSend: fn(() => new Promise(() => {})) },
  play: async ({ canvasElement, userEvent, args }) => {
    const send = await body(canvasElement).findByRole('button', { name: 'Send to 1 person' });
    await userEvent.click(send);
    await userEvent.click(send);
    await expect(args.onSend).toHaveBeenCalledTimes(1);
    await expect(args.onSend).toHaveBeenCalledWith({ people: [PEOPLE[0]], access: 'view' });
    await expect(send).toHaveAttribute('aria-busy', 'true');
  },
};
export const Sent: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, defaultValue: ['ada'] },
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.click(
      await body(canvasElement).findByRole('button', { name: 'Send to 1 person' }),
    );
    const done = await body(canvasElement).findByRole('button', { name: 'Done' });
    await waitFor(async () => {
      await expect(done.ownerDocument.activeElement).toBe(done);
    });
    await expect(args.onSend).toHaveBeenCalledTimes(1);
    await expect(args.onSend).toHaveBeenCalledWith({ people: [PEOPLE[0]], access: 'view' });
    await expect(body(canvasElement).getByRole('status')).toHaveTextContent('Sent to Ada Lovelace');
    await settled(canvasElement);
  },
};
export const SendError: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    defaultValue: ['ada'],
    onSend: fn(() => Promise.reject(new Error('Offline'))),
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const send = await body(canvasElement).findByRole('button', { name: 'Send to 1 person' });
    await userEvent.click(send);
    await waitFor(async () => {
      await expect(send).toHaveAttribute('aria-describedby');
    });
    await expect(body(canvasElement).getByRole('button', { name: 'Ada Lovelace' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(send);
    await waitFor(async () => {
      await expect(args.onSend).toHaveBeenCalledTimes(2);
    });
  },
};
export const ChannelPending: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, onChannel: fn(() => new Promise(() => {})) },
  play: async ({ canvasElement, userEvent, args }) => {
    const target = await body(canvasElement).findByRole('button', { name: 'Team channel' });
    await userEvent.click(target);
    await userEvent.click(target);
    await expect(args.onChannel).toHaveBeenCalledTimes(1);
    await expect(args.onChannel).toHaveBeenCalledWith('team');
    await expect(target).toHaveAttribute('aria-busy', 'true');
  },
};
export const ChannelSuccess: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.click(await body(canvasElement).findByRole('button', { name: 'Team channel' }));
    await expect(
      await body(canvasElement).findByRole('button', { name: 'Shared with team' }),
    ).toBeDisabled();
    await expect(args.onChannel).toHaveBeenCalledTimes(1);
    await expect(args.onChannel).toHaveBeenCalledWith('team');
  },
};
export const ChannelError: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    onChannel: fn(() => {
      throw new Error('Offline');
    }),
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const target = await body(canvasElement).findByRole('button', { name: 'Team channel' });
    await userEvent.click(target);
    await userEvent.click(target);
    await expect(args.onChannel).toHaveBeenCalledTimes(2);
    await expect(body(canvasElement).getByRole('status')).toHaveTextContent(
      'Could not share. Try again.',
    );
    await expect(target).toHaveAccessibleDescription('Could not share. Try again.');
  },
};
export const CopyFeedback: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ canvasElement, userEvent, args }) => {
    const copy = await body(canvasElement).findByRole('button', { name: 'Copy link' });
    await settled(canvasElement);
    const access = body(canvasElement).getByRole('combobox', { name: 'Access' });
    const copied = canvasElement.ownerDocument.querySelector<HTMLElement>(
      '[data-ui="share-sheet-copied"]',
    )!;
    const win = copy.ownerDocument.defaultView!;
    const geometry = () =>
      [copy, copied, access].map((element) => {
        const { left, top, width, height } = element.getBoundingClientRect();
        return [left, top, width, height];
      });
    const before = geometry();
    await expect(parseFloat(win.getComputedStyle(access).columnGap)).toBeGreaterThan(0);
    await expect(
      Math.abs(copy.getBoundingClientRect().top - access.getBoundingClientRect().top),
    ).toBeLessThan(1.1);
    await expect(win.getComputedStyle(copied).visibility).toBe('hidden');
    const write = fn(async (_value: string) => {});
    await clipboard(canvasElement, write, async () => {
      await userEvent.click(copy);
      await waitFor(async () => {
        await expect(body(canvasElement).getByRole('status').textContent).toBe('Copied');
      });
      await expect(win.getComputedStyle(copied).visibility).toBe('visible');
      await expect(copied).toHaveTextContent('✓Copied');
      await expect(copy).toHaveAccessibleName('Copy link');
      await expect(copy).toHaveTextContent(/^Copy link$/);
      await expect(copy).not.toContainElement(copied);
      await expect(write).toHaveBeenCalledTimes(1);
      await expect(write).toHaveBeenCalledWith(args.link);
      await expect(args.onCopy).toHaveBeenCalledTimes(1);
      await expect(args.onCopy).toHaveBeenCalledWith('view');
      const after = geometry();
      for (const [index, box] of before.entries()) {
        for (const [axis, value] of box.entries()) {
          await expect(Math.abs(after[index]![axis]! - value)).toBeLessThan(1.1);
        }
      }
      await waitFor(
        async () => {
          await expect(win.getComputedStyle(copied).visibility).toBe('hidden');
        },
        { timeout: 3000 },
      );
      await expect(copy).toHaveAccessibleName('Copy link');
    });
  },
};
export const CopyFailure: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ canvasElement, userEvent, args }) => {
    await clipboard(
      canvasElement,
      async () => {
        throw new Error('Denied');
      },
      async () => {
        await userEvent.click(
          await body(canvasElement).findByRole('button', { name: 'Copy link' }),
        );
        await waitFor(async () => {
          await expect(body(canvasElement).getByRole('status')).toHaveTextContent(
            'Could not copy link. Try again.',
          );
        });
        await expect(args.onCopy).not.toHaveBeenCalled();
      },
    );
  },
};
export const ControlledRejectsOpen: Story = {
  name: 'Decline an open request',
  parameters: { docs: {
    description: { story: 'Click Share while the parent keeps the panel closed; focus stays on the trigger.' },
    source: { language: 'tsx', code: `import { ShareSheet, type ShareSheetProps } from '@jfrader/ui';

${shareDataSource}

function LockedSharing({ onSend, onChannel }: Pick<ShareSheetProps, 'onSend' | 'onChannel'>) {
  return (
    <ShareSheet
      title="Roadmap"
      link="https://example.com/roadmap"
      presentation="popover"
      people={people}
      accessOptions={accessOptions}
      channels={channels}
      open={false}
      onSend={onSend}
      onChannel={onChannel}
    />
  );
}` },
  } },
  args: { open: false },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: 'Share' });
    await userEvent.click(trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledWith(true);
    await expect(body(canvasElement).queryByRole('dialog')).not.toBeInTheDocument();
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
  },
};
export const ControlledRejectsSelection: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, value: [] },
  play: async ({ canvasElement, userEvent, args }) => {
    const person = await body(canvasElement).findByRole('button', { name: 'Ada Lovelace' });
    await userEvent.click(person);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(['ada']);
    await expect(person).toHaveAttribute('aria-pressed', 'false');
  },
};
export const ControlledRejectsAccess: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, access: 'view' },
  play: async ({ canvasElement, userEvent, args }) => {
    const access = await body(canvasElement).findByRole('combobox', { name: 'Access' });
    await userEvent.click(access);
    await userEvent.keyboard('{End}{Enter}');
    await expect(args.onAccessChange).toHaveBeenCalledTimes(1);
    await expect(args.onAccessChange).toHaveBeenCalledWith('edit');
    await expect(access).toHaveTextContent('Can view');
  },
};
export const AccessKeyboard: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ canvasElement, userEvent, args }) => {
    const access = await body(canvasElement).findByRole('combobox', { name: 'Access' });
    await userEvent.tab();
    await waitFor(async () => {
      await expect(access.ownerDocument.activeElement).toBe(access);
    });
    await userEvent.keyboard(
      '{ArrowDown}{ArrowDown}{ArrowUp}{ArrowLeft}{ArrowRight}{Home}{End}{Enter}',
    );
    await expect(args.onAccessChange).toHaveBeenCalledTimes(1);
    await expect(args.onAccessChange).toHaveBeenCalledWith('edit');
    await userEvent.keyboard(' {Escape}');
    await expect(access).toHaveAttribute('aria-expanded', 'false');
    await expect(body(canvasElement).getByRole('dialog')).toBeInTheDocument();
  },
};
export const RTL: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, dir: 'rtl' },
  parameters: {
    docs: {
      description: {
        story:
          'RTL direction and logical alignment. Media preferences are not emulated by this story.',
      },
    },
  },
};
export const ForcedColors: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  parameters: {
    docs: {
      description: {
        story:
          'Persistent surface for manual forced-colors browser emulation; this story does not emulate the media preference.',
      },
    },
  },
};
export const ReducedMotion: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, defaultValue: ['ada'] },
  parameters: {
    docs: {
      description: {
        story:
          'Persistent surface for manual reduced-motion browser emulation; this story does not emulate the media preference.',
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    await userEvent.click(
      await body(canvasElement).findByRole('button', { name: 'Send to 1 person' }),
    );
    await body(canvasElement).findByRole('button', { name: 'Done' });
    const win = canvasElement.ownerDocument.defaultView!;
    if (win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const face = canvasElement.ownerDocument.querySelector('[data-ui="share-sheet-face"]')!;
      await expect(win.getComputedStyle(face).opacity).toBe('1');
    }
    await settled(canvasElement);
  },
};
export const MultiInstance: Story = {
  name: 'Independent sharing panels',
  parameters: { docs: {
    description: { story: 'Open Roadmap and Notes from separate Share buttons with independent selection and access.' },
    source: { language: 'tsx', code: `import { ShareSheet, styled, theme, type ShareSheetProps } from '@jfrader/ui';

${shareDataSource}

const SharingRow = styled.div({ display: 'flex', gap: theme.space[8] });

function DocumentSharing({ onSend, onChannel }: Pick<ShareSheetProps, 'onSend' | 'onChannel'>) {
  return (
    <SharingRow>
      <ShareSheet title="Roadmap" link="https://example.com/roadmap" presentation="popover"
        people={people} accessOptions={accessOptions} channels={channels} onSend={onSend} onChannel={onChannel} />
      <ShareSheet title="Notes" link="https://example.com/roadmap" presentation="popover"
        people={people} accessOptions={accessOptions} channels={channels} onSend={onSend} onChannel={onChannel} />
    </SharingRow>
  );
}` },
  } },
  render: (args) => (
    <div style={{ display: 'flex', gap: 32 }}>
      <ShareSheet {...args} />
      <ShareSheet {...args} title="Notes" />
    </div>
  ),
};
export const ThemeScopedDialogNestedAccess: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, presentation: 'sheet' },
  render: (args) => (
    <ThemeRoot theme="light">
      <ShareSheet {...args} />
    </ThemeRoot>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const access = await body(canvasElement).findByRole('combobox', { name: 'Access' });
    await userEvent.click(access);
    const list = await body(canvasElement).findByRole('listbox');
    await expect(list.closest('dialog')).not.toBeNull();
    await userEvent.keyboard('{Escape}');
    // The combobox closes through its own async path; wait for the state instead of racing it.
    await waitFor(() => expect(access).toHaveAttribute('aria-expanded', 'false'));
    await expect(body(canvasElement).getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(async () => {
      await expect(body(canvasElement).queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};
export const OutsideFocus: Story = {
  name: 'Outside press and focus',
  parameters: { docs: {
    description: { story: 'Open Share, then click Outside to close the desktop panel and keep focus on Outside.' },
    source: { language: 'tsx', code: `import { Button, ShareSheet, type ShareSheetProps } from '@jfrader/ui';

${shareDataSource}

function SharingWithOutsideAction({ onSend, onChannel }: Pick<ShareSheetProps, 'onSend' | 'onChannel'>) {
  return (
    <>
      <ShareSheet title="Roadmap" link="https://example.com/roadmap" presentation="popover"
        people={people} accessOptions={accessOptions} channels={channels} onSend={onSend} onChannel={onChannel} />
      <Button>Outside</Button>
    </>
  );
}` },
  } },
  render: (args) => (
    <>
      <ShareSheet {...args} />
      <Button>Outside</Button>
    </>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Share' }));
    await body(canvasElement).findByRole('dialog');
    const outside = canvas.getByRole('button', { name: 'Outside' });
    await userEvent.click(outside);
    await expect(outside.ownerDocument.activeElement).toBe(outside);
    await expect(body(canvasElement).queryByRole('dialog')).not.toBeInTheDocument();
  },
};
export const FalsySlots: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    channels: [false, null, 0, ''].map((icon, index) => ({
      id: String(index),
      label: `Channel ${index + 1}`,
      icon,
    })),
    accessOptions: [false, null, 0, ''].map((description, index) => ({
      value: String(index),
      label: `Access ${index + 1}`,
      description,
      icon: description,
    })),
  },
  play: async ({ canvasElement }) => {
    await body(canvasElement).findByRole('dialog');
    const icons = canvasElement.ownerDocument.querySelectorAll('[data-ui="share-sheet-icon"]');
    const descriptions = canvasElement.ownerDocument.querySelectorAll(
      '[data-ui="share-sheet-access-description"]',
    );
    await expect(icons).toHaveLength(2);
    await expect(descriptions).toHaveLength(1);
    for (const icon of icons) await expect(icon).toHaveTextContent('0');
    await expect(descriptions[0]).toHaveTextContent('0');
  },
};
function ControlledExample(args: ShareSheetProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string[]>([]);
  const [access, setAccess] = useState('view');
  return (
    <ShareSheet
      {...args}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        args.onOpenChange?.(next);
      }}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        args.onValueChange?.(next);
      }}
      access={access}
      onAccessChange={(next) => {
        setAccess(next);
        args.onAccessChange?.(next);
      }}
    />
  );
}
export const Controlled: Story = {
  name: 'Controlled sharing',
  parameters: { docs: {
    description: { story: 'Keep opening, selected people, and access permission in parent state.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { ShareSheet, type ShareSheetProps } from '@jfrader/ui';

${shareDataSource}

function ControlledSharing({ onSend, onChannel }: Pick<ShareSheetProps, 'onSend' | 'onChannel'>) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string[]>([]);
  const [access, setAccess] = useState('view');
  return (
    <ShareSheet
      title="Roadmap"
      link="https://example.com/roadmap"
      presentation="popover"
      people={people}
      accessOptions={accessOptions}
      channels={channels}
      open={open}
      onOpenChange={setOpen}
      value={value}
      onValueChange={setValue}
      access={access}
      onAccessChange={setAccess}
      onSend={onSend}
      onChannel={onChannel}
    />
  );
}` },
  } },
  render: (args) => <ControlledExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Share' }));
    await userEvent.click(await body(canvasElement).findByRole('button', { name: 'Ada Lovelace' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(['ada']);
    await expect(body(canvasElement).getByRole('status')).toHaveTextContent('Ada Lovelace');
    await userEvent.click(body(canvasElement).getByRole('combobox'));
    await userEvent.keyboard('{End}{Enter}');
    await expect(args.onAccessChange).toHaveBeenCalledTimes(1);
    await expect(args.onAccessChange).toHaveBeenCalledWith('edit');
    await expect(body(canvasElement).getByRole('status')).toHaveTextContent('Can edit');
  },
};
export const CopyUnavailable: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ canvasElement, userEvent, args }) => {
    await clipboard(canvasElement, undefined, async () => {
      await userEvent.click(await body(canvasElement).findByRole('button', { name: 'Copy link' }));
      await waitFor(async () => {
        await expect(body(canvasElement).getByRole('status')).toHaveTextContent(
          'Could not copy link. Try again.',
        );
      });
      await expect(args.onCopy).not.toHaveBeenCalled();
      await expect(
        body(canvasElement).getByRole('button', { name: 'Copy link' }),
      ).toHaveAccessibleDescription('Could not copy link. Try again.');
    });
  },
};
export const MissingHandlers: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, onSend: undefined, onChannel: undefined },
  play: async ({ canvasElement }) => {
    await expect(
      await body(canvasElement).findByRole('button', { name: 'Team channel' }),
    ).toBeDisabled();
    await expect(
      body(canvasElement).getByRole('button', { name: 'Send to 0 people' }),
    ).toBeDisabled();
  },
};
export const AllAccessDisabled: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    accessOptions: [{ value: 'view', label: 'Can view', disabled: true }],
  },
  play: async ({ canvasElement }) => {
    await expect(
      await body(canvasElement).findByRole('button', { name: 'Copy link' }),
    ).toBeDisabled();
    await expect(body(canvasElement).getByRole('combobox')).toBeDisabled();
  },
};
export const SheetDrag: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, presentation: 'sheet' },
  play: async ({ canvasElement, args }) => {
    const dialog = await body(canvasElement).findByRole('dialog');
    const target = dialog.querySelector('[data-ui="share-sheet-grabber"]')!;
    const win = dialog.ownerDocument.defaultView!;
    const pointer = (type: string, y: number) =>
      fireEvent(
        target,
        new win.PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          isPrimary: true,
          button: 0,
          clientY: y,
        }),
      );
    pointer('pointerdown', 0);
    pointer('pointercancel', 90);
    pointer('pointerup', 90);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    pointer('pointerdown', 0);
    pointer('pointerup', 90);
    await waitFor(async () => {
      await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    });
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};
export const ControlledRejectsDismissal: Story = {
  tags: ['!autodocs'],
  args: { open: true },
  play: async ({ canvasElement, userEvent, args }) => {
    const copy = await body(canvasElement).findByRole('button', { name: 'Copy link' });
    await waitFor(async () => {
      await expect(copy.ownerDocument.activeElement).toBe(copy);
    });
    await userEvent.keyboard('{Escape}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    await expect(copy.ownerDocument.activeElement).toBe(copy);
    await expect(body(canvasElement).getByRole('dialog')).toBeInTheDocument();
  },
};
export const LateSendSettlement: Story = {
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    let settle: (() => void) | undefined;
    args.onSend?.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        }),
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Share' }));
    await userEvent.click(await body(canvasElement).findByRole('button', { name: 'Ada Lovelace' }));
    await userEvent.click(body(canvasElement).getByRole('button', { name: 'Send to 1 person' }));
    await userEvent.click(body(canvasElement).getByRole('button', { name: 'Close' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Share' }));
    settle?.();
    await Promise.resolve();
    await expect(
      body(canvasElement).queryByRole('button', { name: 'Done' }),
    ).not.toBeInTheDocument();
    await expect(body(canvasElement).getByRole('button', { name: 'Ada Lovelace' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(body(canvasElement).getByRole('status')).toBeEmptyDOMElement();
    await settled(canvasElement);
  },
};
export const NativeClose: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, presentation: 'sheet' },
  play: async ({ canvasElement, args }) => {
    await body(canvasElement).findByRole('dialog');
    canvasElement.querySelector('dialog')!.close();
    await waitFor(async () => {
      await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    });
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    await expect(body(canvasElement).queryByRole('dialog')).not.toBeInTheDocument();
  },
};
export const NativeCancelVeto: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    presentation: 'sheet',
    slotProps: { dialog: { onCancel: (event) => event.preventDefault() } },
  },
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.click(await body(canvasElement).findByRole('button', { name: 'Close' }));
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(body(canvasElement).getByRole('dialog')).toBeInTheDocument();
  },
};
export const AriaAndStyling: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    slotProps: {
      content: {
        'aria-label': 'Sharing',
        'aria-labelledby': 'external-name missing-name',
        'aria-describedby': 'external-description missing-description',
        sx: { paddingInline: '32px' },
      },
      copyButton: { sx: { borderWidth: '2px' } },
    },
  },
  render: (args) => (
    <>
      <h2 id="external-name">Project</h2>
      <p id="external-description">Share project access.</p>
      <ShareSheet {...args} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const dialog = await body(canvasElement).findByRole('dialog');
    await expect(dialog).toHaveAttribute('aria-label', 'Sharing');
    await expect(dialog.getAttribute('aria-labelledby')).toContain('external-name missing-name');
    await expect(dialog.getAttribute('aria-describedby')).toContain(
      'external-description missing-description',
    );
    await expect(
      dialog.ownerDocument.defaultView!.getComputedStyle(dialog).paddingInlineStart,
    ).toBe('32px');
    const copy = body(canvasElement).getByRole('button', { name: 'Copy link' });
    await expect(
      Math.abs(
        parseFloat(copy.ownerDocument.defaultView!.getComputedStyle(copy).borderTopWidth) - 2,
      ),
    ).toBeLessThan(1.1);
  },
};
export const RefAndTargets: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, ref: fn() },
  play: async ({ canvasElement, args }) => {
    const root = canvasElement.querySelector('[data-ui="share-sheet"]');
    await expect(args.ref).toHaveBeenCalledWith(root);
    const dialog = await body(canvasElement).findByRole('dialog');
    for (const button of within(dialog).getAllByRole('button')) {
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    }
  },
};
function MigratingExample(args: ShareSheetProps) {
  const [presentation, setPresentation] = useState<ShareSheetProps['presentation']>('popover');
  return (
    <div
      onKeyDown={(event) => {
        if (event.key === 'm')
          setPresentation((value) => (value === 'popover' ? 'sheet' : 'popover'));
      }}
    >
      <ShareSheet {...args} presentation={presentation} />
    </div>
  );
}
export const ShellMigration: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, defaultValue: ['ada'] },
  render: (args) => <MigratingExample {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const send = await body(canvasElement).findByRole('button', { name: 'Send to 1 person' });
    send.focus();
    await userEvent.keyboard('m');
    await waitFor(async () => {
      await expect(canvasElement.querySelector('dialog')).toHaveAttribute('open');
    }, { timeout: 3000 });
    const moved = body(canvasElement).getByRole('button', { name: 'Send to 1 person' });
    await waitFor(async () => {
      await expect(moved.ownerDocument.activeElement).toBe(moved);
    }, { timeout: 3000 });
    await expect(moved).not.toBe(send);
    await settled(canvasElement);
    await userEvent.keyboard('m');
    await waitFor(async () => {
      await expect(canvasElement.querySelector('dialog')).not.toHaveAttribute('open');
    }, { timeout: 3000 });
    await waitFor(async () => {
      const back = body(canvasElement).getByRole('button', { name: 'Send to 1 person' });
      await expect(back.ownerDocument.activeElement).toBe(back);
    }, { timeout: 3000 });
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await settled(canvasElement);
  },
};
