import { useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor, within, type Mock, type MockInstance } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { ChatThread, type ChatMessage, type ChatThreadProps } from './index';
import { Button, type ButtonProps } from '../button';
import { Textarea, type TextareaProps } from '../textarea';

function ReplacementViewport(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="custom-viewport" />;
}

function ReplacementTextarea(props: TextareaProps) {
  return <Textarea {...props} data-testid="custom-textarea" />;
}

function ReplacementSend(props: ButtonProps) {
  return <Button {...props} data-testid="custom-send" />;
}

export const InteriorReplacements: StoryObj<typeof ChatThread> = {
  render: (args) => <ChatThread {...args} slots={{ viewport: ReplacementViewport }} composerProps={{ slots: { textarea: ReplacementTextarea, sendButton: ReplacementSend } }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByTestId('custom-viewport');
    await expect(viewport).toHaveAttribute('data-ui', 'chat-thread-viewport');
    await expect(viewport.className).not.toBe('');
    await expect(canvas.getByTestId('custom-textarea')).toHaveAttribute('aria-label', 'Message');
    await expect(canvas.getByTestId('custom-send')).toHaveAttribute('data-action', 'submit');
  },
};

const NOW = Date.parse('2026-10-12T12:00:00Z');
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const LOCALE = 'en-US';
const PEOPLE = [{ id: 'me', name: 'Ada Lovelace' }, { id: 'grace', name: 'Grace Hopper' }, { id: 'alan', name: 'Alan Turing' }];
const MESSAGES: readonly ChatMessage[] = [
  { id: 'first', authorId: 'grace', text: 'The build is ready to review.', createdAt: NOW - DAY },
  { id: 'second', authorId: 'grace', text: 'I included the mobile layout.', createdAt: NOW - DAY + MINUTE, reactions: [{ emoji: '👍', count: 2, mine: true }] },
  { id: 'own', authorId: 'me', text: 'Thanks! I’ll take a look.', createdAt: NOW - MINUTE, status: 'delivered' },
];
const frameStyle = css({ inlineSize: `min(42rem, calc(100vw - 2 * ${vars.space[4]}))`, maxInlineSize: '100%', blockSize: '34rem' });
const stackStyle = css({ display: 'grid', gap: vars.space[6] });
const fixtureStyle = css({ minBlockSize: vars.space[8], minInlineSize: vars.space[8], padding: vars.space[2], backgroundColor: vars.color.surface, color: vars.color.text, border: `1px solid ${vars.color.borderControl}`, borderRadius: vars.radius.sm });
const usage = `<div style={{ height: '34rem' }}>
  <ChatThread participants={people} currentUserId="me" defaultValue={messages} now={now} onSend={send} />
</div>`;
const meta = {
  title: 'Data display/ChatThread',
  component: ChatThread,
  tags: ['autodocs'],
  args: {
    participants: PEOPLE,
    currentUserId: 'me',
    defaultValue: MESSAGES,
    now: NOW,
    locale: LOCALE,
    timeZone: 'UTC',
    getNewId: fn(() => crypto.randomUUID()),
    onSend: fn(),
    onValueChange: fn(),
    onReact: fn(),
  },
  decorators: [(Story) => <div css={frameStyle}><Story /></div>],
  parameters: {
    docs: {
      source: { code: usage },
      description: { component: 'Write messages, attach files, and react to a conversation.' },
      usage: `### Messages and drafts
- Messages and Composer drafts support \`value/defaultValue/onValueChange\`.
- A controlled send proposes a message before calling \`onSend\`. Keep its proposed id until acknowledgement.
- The draft clears after transport resolves and the id appears in \`value\`. A rejected request keeps the draft; edit it to retry. Transport failures keep text and files.
- Your app handles transport, uploads, authentication, pagination, and delivery status.
- The named log contains an ordered list of articles named by author and time. Typing indicators and submission errors stay outside the log.

### Layout and attachments
- Set a height limit. History is not virtualized and keeps the order you supply.
- Scrolling stays pinned within 48px of the bottom or after a send/jump. Incoming updates never move focus.
- Root and Composer refs target divs. \`composerProps.slotProps.textarea.ref\` targets the textarea.
- ChatThread releases object URLs it creates on removal, failure and unmount. It never revokes URLs supplied by your app. Image previews and accepted local messages each retain a separate lease on their object URL.
- Dates, counts, byte sizes, and names use Intl. Update \`now\` yourself with epoch milliseconds; \`timeZone\` defaults to UTC.

### Keyboard
- Enter sends once; Shift+Enter adds a newline. IME composition does not send. Tab/Shift+Tab follow native order.
- In the reaction picker, Left/Right wrap and reverse in RTL; Home/End jump to the ends. Escape returns focus to the trigger; outside dismissal does not.`,
    },
  },
} satisfies Meta<typeof ChatThread>;
export default meta;
type Story = StoryObj<typeof meta>;
const part = (root: Element, name: string) => root.querySelector<HTMLElement>(`[data-ui="chat-thread-${name}"], [data-part="chat-thread-${name}"]`)!;
const item = (root: Element, id: string) => root.querySelector<HTMLElement>(`[data-message-id="${id}"]`)!;
const page = (root: Element) => within(root.ownerDocument.body);
const lastEvent = (spy: unknown) => (spy as Mock).mock.lastCall?.[1];
const lastMessages = (spy: unknown) => (spy as Mock).mock.lastCall?.[0] as ChatMessage[];
const pinned = (el: HTMLElement) => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 2;
async function focusRing(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expect(getComputedStyle(element).outlineStyle).not.toBe('none');
  await expect(Math.abs(Number.parseFloat(getComputedStyle(element).outlineWidth) - 2)).toBeLessThan(1.1);
}
function Deferred(args: ChatThreadProps) {
  const [value, setValue] = useState(args.value ?? MESSAGES);
  const [proposal, setProposal] = useState<ChatMessage[] | null>(null);
  return <>
    <button css={fixtureStyle} onClick={() => proposal && setValue(proposal)}>Accept message</button>
    <ChatThread {...args} value={value} onValueChange={(next, event) => { args.onValueChange?.(next, event); setProposal(next); }} />
  </>;
}

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    const log = canvas.getByRole('log', { name: 'Conversation' });
    await waitFor(() => expect(log).toHaveAttribute('aria-live', 'polite'));
    await expect(log).toHaveAttribute('aria-relevant', 'additions');
    await expect(log).toHaveAttribute('aria-atomic', 'false');
    await expect(within(log).getByRole('list').tagName).toBe('OL');
    await expect(canvas.getAllByRole('article')).toHaveLength(3);
    await expect(canvas.getAllByRole('article')[0]).toHaveAccessibleName(`Grace Hopper ${new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' }).format(-1, 'day')}`);
    await expect(item(canvasElement, 'own')).toHaveAttribute('data-own', 'true');
    await expect(item(canvasElement, 'first')).toHaveAttribute('data-own', 'false');
    const own = item(canvasElement, 'own').querySelector('article')!.getBoundingClientRect();
    const other = item(canvasElement, 'first').querySelector('article')!.getBoundingClientRect();
    await expect(own.right).toBeGreaterThan(other.right);
    await expect(canvas.getByRole('group', { name: 'Conversation transcript' })).toBeInTheDocument();
    // Landmarks stay unique: the scroller is a named group, not a region (axe landmark-unique across instances).
    await expect(part(canvasElement, 'scroller')).toHaveAttribute('aria-label', 'Conversation transcript');
    for (const button of canvas.getAllByRole('button')) {
      const { width, height } = button.getBoundingClientRect();
      await expect(height).toBeGreaterThanOrEqual(31.5);
      await expect(width).toBeGreaterThanOrEqual(31.5);
    }
    await expect(part(canvasElement, 'error')).toHaveTextContent('');
    await expect(part(canvasElement, 'retry-error')).toBeNull();
  },
};
export const Sizes: Story = {
  render: (args) => <div css={stackStyle}>{(['sm', 'md'] as const).map((size) => <div css={frameStyle} key={size}><ChatThread {...args} size={size} labels={{ conversation: `${size} conversation` }} /></div>)}</div>,
};
export const GroupedMessages: Story = {
  play: async ({ canvasElement }) => {
    await expect(item(canvasElement, 'second')).toHaveAttribute('data-grouped', 'true');
    await expect(item(canvasElement, 'own')).toHaveAttribute('data-grouped', 'false');
    await expect(item(canvasElement, 'second').querySelector('article')).toHaveAccessibleName(expect.stringContaining('Grace Hopper'));
  },
};
export const DaySeparators: Story = {
  args: { locale: 'es-ES', timeZone: 'America/New_York', defaultValue: [
    { id: 'dst-before', authorId: 'grace', text: 'Before midnight', createdAt: '2026-03-08T04:59:00Z' },
    { id: 'dst-after', authorId: 'grace', text: 'After midnight', createdAt: '2026-03-08T05:01:00Z' },
    { id: 'dst-later', authorId: 'grace', text: 'After the clock change', createdAt: '2026-03-08T07:01:00Z' },
  ] },
  play: async ({ canvas, args }) => {
    const dates = new Intl.DateTimeFormat('es-ES', { timeZone: 'America/New_York', dateStyle: 'full' });
    await expect(canvas.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      dates.format(Date.parse(String(args.defaultValue![0]!.createdAt))), dates.format(Date.parse(String(args.defaultValue![1]!.createdAt))),
    ]);
  },
};
export const KeyboardFlow: Story = {
  args: { reactions: [], defaultValue: MESSAGES.map((message) => ({ ...message, reactions: [] })), composerProps: { allowAttachments: false } },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.tab();
    await focusRing(part(canvasElement, 'scroller'));
    await userEvent.tab();
    const field = canvas.getByRole('textbox', { name: 'Message' });
    await focusRing(field);
    await userEvent.keyboard('{Enter}');
    await expect(args.onSend).toHaveBeenCalledTimes(0);
    await userEvent.type(field, 'One');
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}Two{Escape}');
    await expect(field).toHaveValue('One\nTwo');
    fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(field, { key: 'Enter', keyCode: 229 });
    await expect(args.onSend).toHaveBeenCalledTimes(0);
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(field).toHaveValue(''));
    await expect(args.onSend).toHaveBeenCalledTimes(1);
    await expect(args.onSend).toHaveBeenLastCalledWith({ text: 'One\nTwo', files: [] });
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(lastEvent(args.onValueChange)).toMatchObject({ type: 'send', message: { text: 'One\nTwo', authorId: 'me', status: 'sent', createdAt: NOW } });
    await expect(field.ownerDocument.activeElement).toBe(field);
    await userEvent.type(field, 'Click send');
    await userEvent.tab();
    const send = canvas.getByRole('button', { name: 'Send' });
    await focusRing(send);
    await userEvent.keyboard(' ');
    await waitFor(() => expect(args.onSend).toHaveBeenCalledTimes(2));
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.tab({ shift: true });
    await focusRing(field);
  },
};
export const ReactionsOpen: Story = {
  play: async ({ args, canvas, canvasElement, userEvent }) => {
     const add = within(item(canvasElement, 'first')).getByRole('button', { name: /^Add reaction/ });
    await userEvent.click(add);
     const picker = await page(canvasElement).findByRole('group', { name: /^Reactions/ });
    await expect(add).toHaveAttribute('aria-controls', picker.id);
    const emoji = within(picker).getAllByRole('button').slice(0, -1);
    await expect(canvasElement.ownerDocument.activeElement).toBe(emoji[0]);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(emoji.at(-1));
    await userEvent.keyboard('{ArrowRight}{End}{Home}{ArrowRight}');
    await focusRing(emoji[1]!);
    await userEvent.keyboard('{Enter}');
    await expect(args.onReact).toHaveBeenCalledTimes(1);
    await expect(args.onReact).toHaveBeenLastCalledWith('first', '❤️');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(lastEvent(args.onValueChange)).toEqual({ type: 'react', id: 'first', emoji: '❤️', added: true });
    await expect(canvasElement.ownerDocument.activeElement).toBe(add);
    await userEvent.click(add);
    await userEvent.keyboard('{Escape}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(add);
    await userEvent.click(add);
    const field = canvas.getByRole('textbox');
    await userEvent.click(field);
     await expect(page(canvasElement).queryByRole('group', { name: /^Reactions/ })).toBeNull();
    await expect(canvasElement.ownerDocument.activeElement).toBe(field);
    await userEvent.click(add);
     await expect(await page(canvasElement).findByRole('group', { name: /^Reactions/ })).toBeVisible();
  },
};
export const ReadReceipts: Story = {
  args: { readBy: { grace: 'own', alan: 'own', me: 'own', unknown: 'own' } },
  play: async ({ canvasElement }) => {
    await expect(part(item(canvasElement, 'own'), 'receipt')).toHaveTextContent('Read by Grace Hopper and Alan Turing');
    await expect(part(item(canvasElement, 'own'), 'receipt')).not.toHaveTextContent('Ada');
  },
};
export const Typing: Story = {
  args: { typing: ['grace', 'grace', 'me', 'missing'] },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('status').filter((status) => status.textContent)).toHaveLength(1);
    await expect(canvas.getByRole('log')).not.toHaveTextContent('is typing');
  },
};
export const AllDeliveryStates: Story = {
  args: { defaultValue: (['sending', 'sent', 'delivered', 'read', 'failed'] as const).map((status, index) => ({ id: status, authorId: 'me', text: `Message ${index + 1}`, createdAt: NOW - index * MINUTE, status })), readBy: { grace: 'failed' } },
  play: async ({ canvasElement }) => {
    await expect(part(item(canvasElement, 'failed'), 'receipt')).toHaveTextContent('Failed');
    await expect(item(canvasElement, 'failed').querySelector('[data-state="failed"]')).toBeVisible();
  },
};
export const Retry: Story = {
  args: { defaultValue: [{ ...MESSAGES[2]!, status: 'failed' }], onRetry: fn() },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
     await userEvent.click(canvas.getByRole('button', { name: /^Retry/ }));
    await expect(args.onRetry).toHaveBeenCalledTimes(1);
    await expect(args.onRetry).toHaveBeenLastCalledWith('own');
    await expect(canvas.getByText('Failed')).toBeVisible();
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await expect(part(canvasElement, 'retry-error')).toBeNull();
  },
};
export const ContextualActions: Story = {
  args: {
    defaultValue: [
      { id: 'failed-one', authorId: 'grace', text: 'First draft', createdAt: NOW, status: 'failed', reactions: [{ emoji: '👍', count: 1 }] },
      { id: 'failed-two', authorId: 'grace', text: 'Second draft', createdAt: NOW, status: 'failed', reactions: [{ emoji: '👍', count: 1 }] },
    ],
    onRetry: fn(),
    labels: { addReaction: 'Añadir reacción', retry: 'Reintentar' },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    for (const text of ['First draft', 'Second draft']) {
      for (const action of ['Añadir reacción', 'Reintentar', '👍 1 reaction']) {
        const button = canvas.getByRole('button', { name: (name) => name.startsWith(action) && name.includes(text) });
        await expect(button).toHaveAccessibleName(expect.stringContaining('Grace Hopper'));
        await expect(button).toHaveAccessibleName(expect.stringContaining(new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', dateStyle: 'full', timeStyle: 'short' }).format(NOW)));
      }
    }
    await userEvent.click(canvas.getByRole('button', { name: (name) => name.startsWith('Añadir reacción') && name.includes('First draft') }));
    const picker = await page(canvasElement).findByRole('group', { name: /^Reactions.*First draft/ });
    await expect(within(picker).getByRole('button', { name: /^React with 👍.*First draft/ })).toBeVisible();
    await expect(within(picker).getByRole('button', { name: /^Close reactions.*First draft/ })).toBeVisible();
    await userEvent.keyboard('{Escape}');
  },
};
export const RetryFailure: Story = {
  args: { defaultValue: [{ ...MESSAGES[2]!, status: 'failed' }], onRetry: fn(() => Promise.reject(new Error('offline'))) },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await expect(part(canvasElement, 'retry-error')).toBeNull();
     await userEvent.click(canvas.getByRole('button', { name: /^Retry/ }));
    await expect(args.onRetry).toHaveBeenCalledTimes(1);
    await expect(args.onRetry).toHaveBeenLastCalledWith('own');
    await waitFor(() => expect(part(canvasElement, 'retry-error')).toHaveTextContent('Message could not be sent'));
    await expect(part(canvasElement, 'retry-error')).toHaveAttribute('role', 'status');
    await expect(canvas.getByRole('log')).not.toHaveTextContent('Message could not be sent');
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};
const ATTACHMENTS = Array.from({ length: 7 }, (_, index) => ({ id: `file-${index}`, name: `Design ${index + 1}.pdf`, kind: 'file' as const, size: 12345, url: `/design-${index + 1}.pdf` }));
export const Attachments: Story = {
  args: { defaultValue: [{ ...MESSAGES[0]!, attachments: [ATTACHMENTS[0]!, { id: 'unsafe', name: 'Unsafe link', kind: 'file', url: 'javascript:alert(1)' }, { id: 'missing', name: 'No URL', kind: 'file' }] }] },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('link')).toHaveLength(1);
    await expect(canvas.getByRole('link')).toHaveAttribute('href', '/design-1.pdf');
    await expect(canvas.getByText('Unsafe link').closest('a')).toBeNull();
    await expect(canvas.getByText('No URL').closest('a')).toBeNull();
    await expect(canvas.getByRole('link')).toHaveTextContent(new Intl.NumberFormat(LOCALE, { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 1 }).format(12.345));
  },
};
export const AttachmentOverflow: Story = {
  args: { defaultValue: [{ ...MESSAGES[0]!, attachments: ATTACHMENTS }] },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getAllByRole('link')).toHaveLength(4);
    await userEvent.click(canvas.getByRole('button', { name: 'Show 3 more attachments' }));
    await expect(canvas.getAllByRole('link')).toHaveLength(7);
  },
};
export const ImageAttachments: Story = {
  args: { defaultValue: [{ ...MESSAGES[0]!, attachments: [{ id: 'image', name: 'Project card.png', kind: 'image', url: '/og-image.png', alt: 'Project share card', width: 1200, height: 630 }] }] },
  play: async ({ canvas }) => {
    const image = canvas.getByRole('img', { name: 'Project share card' });
    await expect(image).toHaveAttribute('width', '1200');
    await expect(image).toHaveAttribute('height', '630');
    await expect(getComputedStyle(image).aspectRatio).toBe('1200 / 630');
  },
};
export const StandaloneComposer: Story = {
  render: (args) => <ChatThread.Composer onSend={args.onSend!} onValueChange={fn()} />,
  parameters: { docs: { source: { code: '<ChatThread.Composer onSend={send} />' } } },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox'), 'Standalone');
    await userEvent.keyboard('{Enter}');
    await expect(args.onSend).toHaveBeenCalledTimes(1);
    await expect(args.onSend).toHaveBeenLastCalledWith({ text: 'Standalone', files: [] });
  },
};
export const TranscriptOnly: Story = { args: { composer: false, reactions: [] } };
export const Empty: Story = { args: { defaultValue: [] } };
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('textbox')).toBeDisabled();
    for (const button of canvas.getAllByRole('button')) await expect(button).toBeDisabled();
    await userEvent.click(canvas.getByRole('button', { name: 'Send' }));
    fireEvent.keyDown(canvas.getByRole('textbox'), { key: 'Enter' });
    await expect(args.onSend).toHaveBeenCalledTimes(0);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};
export const Controlled: Story = {
  render: function Render(args) {
    const [value, setValue] = useState<readonly ChatMessage[]>(MESSAGES);
    return <ChatThread {...args} value={value} onValueChange={(next, event) => { args.onValueChange?.(next, event); setValue(next); }} />;
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox'), 'Accepted');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(canvas.getByRole('textbox')).toHaveValue(''));
    await expect(canvas.getAllByRole('article')).toHaveLength(4);
    await expect(args.onSend).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const RejectedControlled: Story = {
  args: { value: MESSAGES },
  render: (args) => <Deferred {...args} />,
  play: async ({ args, canvas, userEvent }) => {
    const field = canvas.getByRole('textbox');
    await userEvent.type(field, 'Awaiting approval');
    await userEvent.keyboard('{Enter}');
    await expect(args.onSend).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(field).toHaveValue('Awaiting approval');
    await expect(canvas.getAllByRole('article')).toHaveLength(3);
    await userEvent.keyboard('{Enter}');
    await expect(args.onSend).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Accept message' }));
    await waitFor(() => expect(field).toHaveValue(''));
    await expect(canvas.getAllByRole('article')).toHaveLength(4);
    await expect(args.onSend).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
const draftSpy = fn();
export const RejectedDraft: Story = {
  render: (args) => <ChatThread.Composer value={{ text: 'Fixed draft', files: [] }} onValueChange={draftSpy} onSend={args.onSend!} />,
  play: async ({ canvas, args, userEvent }) => {
    const field = canvas.getByRole('textbox');
    await userEvent.type(field, '!');
    await expect(draftSpy).toHaveBeenCalledTimes(1);
    await expect(draftSpy).toHaveBeenLastCalledWith({ text: 'Fixed draft!', files: [] });
    await expect(field).toHaveValue('Fixed draft');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(draftSpy).toHaveBeenCalledTimes(2));
    await expect(draftSpy).toHaveBeenLastCalledWith({ text: '', files: [] });
    await expect(field).toHaveValue('Fixed draft');
    await expect(args.onSend).toHaveBeenCalledTimes(1);
  },
};
export const RejectedReaction: Story = {
  args: { value: MESSAGES },
  play: async ({ canvas, args, userEvent }) => {
     const reaction = canvas.getByRole('button', { name: /^👍 2 reactions, including you/ });
    await userEvent.click(reaction);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(lastEvent(args.onValueChange)).toEqual({ type: 'react', id: 'second', emoji: '👍', added: false });
    await expect(lastMessages(args.onValueChange)[1]!.reactions).toEqual([{ emoji: '👍', count: 1, mine: false }]);
    await expect(reaction).toHaveAttribute('aria-pressed', 'true');
     await expect(reaction).toHaveAccessibleName(expect.stringContaining('👍 2 reactions, including you'));
    await expect(MESSAGES[1]!.reactions).toEqual([{ emoji: '👍', count: 2, mine: true }]);
  },
};
let rejectSend: (() => void) | undefined;
export const PendingAndFailedSend: Story = {
  args: { onSend: fn(() => new Promise<void>((_resolve, reject) => { rejectSend = () => reject(new Error('offline')); })) },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const field = canvas.getByRole('textbox');
    await userEvent.type(field, 'Keep this draft');
    await userEvent.keyboard('{Enter}');
    const send = canvas.getByRole('button', { name: 'Send' });
    await expect(send).toHaveAttribute('aria-busy', 'true');
    await userEvent.keyboard('{Enter}{Enter}');
    await userEvent.click(send);
    await expect(args.onSend).toHaveBeenCalledTimes(1);
    rejectSend!();
    await waitFor(() => expect(part(canvasElement, 'error')).toHaveTextContent('Message could not be sent'));
    await expect(field).toHaveValue('Keep this draft');
    await expect(field).toHaveAccessibleDescription('Message could not be sent');
    await expect(canvas.getAllByRole('article')).toHaveLength(3);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};
export const InvalidDate: Story = {
  args: { defaultValue: [{ id: 'bad', authorId: 'missing', text: 'Invalid date', createdAt: 'yesterday' }, { id: 'future', authorId: 'grace', text: 'Future', createdAt: NOW + DAY }] },
  play: async ({ canvasElement }) => {
    await expect(item(canvasElement, 'bad').querySelector('time')).toBeNull();
    await expect(item(canvasElement, 'bad').querySelector('article')).toHaveAccessibleName('Unknown author Unknown time');
    await expect(item(canvasElement, 'future').querySelector('time')).toHaveTextContent(new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' }).format(1, 'day'));
    await expect(item(canvasElement, 'future').querySelector('time')!.firstChild!.textContent).toBe('tomorrow');
  },
};
export const LongContent: Story = {
  args: { defaultValue: [{ ...MESSAGES[0]!, text: 'LongUnbrokenWord'.repeat(30), reactions: [{ emoji: '👀', count: 12345 }] }] },
  decorators: [(Story) => <div css={css({ inlineSize: '20rem', maxInlineSize: '100%', blockSize: '32rem' })}><Story /></div>],
  play: async ({ canvasElement, canvas }) => {
    const scroller = part(canvasElement, 'scroller');
    await expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth + 2);
     const reaction = canvas.getByRole('button', { name: /^👀 12,345 reactions/ });
    await expect(reaction.scrollWidth).toBeLessThanOrEqual(reaction.clientWidth + 2);
  },
};
const FILE = new File(['hello'], 'notes.txt', { type: 'text/plain' });
export const FileValidation: Story = {
  args: { composerProps: { accept: '.txt', maxFiles: 2, maxFileSize: 8 } },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const input = canvasElement.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, FILE);
    await userEvent.upload(input, new File(['another'], 'second.txt', { type: 'text/plain' }));
    await userEvent.upload(input, new File(['third'], 'third.txt', { type: 'text/plain' }));
    await expect(canvas.getAllByRole('button', { name: /^Remove/ })).toHaveLength(2);
    await expect(part(canvasElement, 'error')).toHaveTextContent('third.txt: too many files');
    await userEvent.click(canvas.getByRole('button', { name: 'Remove notes.txt' }));
    await expect(canvas.getAllByRole('button', { name: /^Remove/ })).toHaveLength(1);
    await expect(canvasElement.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Remove second.txt' }));
    await userEvent.upload(input, FILE);
    await expect(canvas.getAllByRole('button', { name: /^Remove/ })).toHaveLength(2);
    const dropped = new DataTransfer();
    dropped.items.add(new File(['123456789'], 'large.txt', { type: 'text/plain' }));
    await expect(dropped.files[0]!.size).toBe(9);
    fireEvent(part(canvasElement, 'form'), new DragEvent('drop', { dataTransfer: dropped, bubbles: true, cancelable: true }));
    await waitFor(() => expect(part(canvasElement, 'error')).toHaveTextContent('large.txt: file too large'));
    const pasted = new DataTransfer();
    pasted.items.add(new File(['x'], 'image.png', { type: 'image/png' }));
    fireEvent(canvas.getByRole('textbox'), new ClipboardEvent('paste', { clipboardData: pasted, bubbles: true, cancelable: true }));
    await waitFor(() => expect(part(canvasElement, 'error')).toHaveTextContent('image.png: file type not accepted'));
    await userEvent.click(canvas.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(args.onSend).toHaveBeenCalledTimes(1));
    await expect(args.onSend).toHaveBeenLastCalledWith({ text: '', files: [expect.objectContaining({ name: 'second.txt' }), FILE] });
  },
};
let createUrl: MockInstance<typeof URL.createObjectURL>;
let revokeUrl: MockInstance<typeof URL.revokeObjectURL>;
export const UrlOwnership: Story = {
  beforeEach: () => {
    createUrl = spyOn(URL, 'createObjectURL');
    revokeUrl = spyOn(URL, 'revokeObjectURL');
    return () => { createUrl.mockRestore(); revokeUrl.mockRestore(); };
  },
  render: function Render(args) {
    const [value, setValue] = useState<readonly ChatMessage[]>([{ ...MESSAGES[0]!, attachments: [{ id: 'caller', name: 'Caller', kind: 'file', url: 'blob:caller-owned' }] }]);
    const [shown, setShown] = useState(true);
    return <><button css={fixtureStyle} onClick={() => setValue([])}>Remove messages</button><button css={fixtureStyle} onClick={() => setShown(false)}>Unmount</button>{shown ? <ChatThread {...args} value={value} onValueChange={(next, event) => { args.onValueChange?.(next, event); setValue(next); }} /> : null}</>;
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const image = new File(['image'], 'portrait.png', { type: 'image/png' });
    const input = canvasElement.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, image);
    await expect(createUrl).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove portrait.png' }));
    await expect(revokeUrl).toHaveBeenCalledTimes(1);
    await userEvent.upload(input, image);
    await userEvent.click(canvas.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(createUrl).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(revokeUrl).toHaveBeenCalledTimes(2));
    await expect(canvas.getByRole('link', { name: /portrait/ }).querySelector('img')).toHaveAttribute('src', (createUrl as Mock).mock.results[2]!.value);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove messages' }));
    await waitFor(() => expect(revokeUrl).toHaveBeenCalledTimes(3));
    await userEvent.upload(input, image);
    await userEvent.click(canvas.getByRole('button', { name: 'Unmount' }));
    await waitFor(() => expect(revokeUrl).toHaveBeenCalledTimes(4));
    await expect(revokeUrl).not.toHaveBeenCalledWith('blob:caller-owned');
    await expect(new Set((revokeUrl as Mock).mock.calls.map(([url]) => url)).size).toBe(4);
  },
};
export const FailedSendReleasesUrls: Story = {
  args: { onSend: fn(async () => { throw new Error('offline'); }) },
  beforeEach: UrlOwnership.beforeEach,
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const file = new File(['image'], 'pending.png', { type: 'image/png' });
    await userEvent.upload(canvasElement.querySelector<HTMLInputElement>('input[type="file"]')!, file);
    await userEvent.click(canvas.getByRole('button', { name: 'Send' }));
    await waitFor(async () => {
      await expect(part(canvasElement, 'error')).toHaveTextContent('Message could not be sent');
      await expect(createUrl).toHaveBeenCalledTimes(2);
      await expect(revokeUrl).toHaveBeenCalledTimes(1);
      await expect(revokeUrl).toHaveBeenLastCalledWith((createUrl as Mock).mock.results[1]!.value);
      await expect(canvas.getByRole('button', { name: 'Remove pending.png' })).toBeVisible();
      await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Remove pending.png' }));
    await expect(revokeUrl).toHaveBeenCalledTimes(2);
  },
};
const HISTORY: ChatMessage[] = Array.from({ length: 20 }, (_, index) => ({ id: `history-${index}`, authorId: index % 2 ? 'me' : 'grace', text: `History message ${index}`, createdAt: NOW - (20 - index) * MINUTE }));
export const ScrollPinning: Story = {
  render: function Render(args) {
    const [value, setValue] = useState<readonly ChatMessage[]>(HISTORY);
    return <><button css={fixtureStyle} onClick={() => setValue((current) => [...current, { id: `incoming-${current.length}`, authorId: 'grace', text: 'Incoming', createdAt: NOW }])}>Incoming</button><button css={fixtureStyle} onClick={() => setValue((current) => [{ id: 'older', authorId: 'alan', text: 'Older history', createdAt: NOW - DAY }, ...current])}>Prepend</button><ChatThread {...args} value={value} /></>;
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const scroller = part(canvasElement, 'scroller');
    await waitFor(() => expect(pinned(scroller)).toBe(true));
    const field = canvas.getByRole('textbox');
    field.focus();
    fireEvent.click(canvas.getByRole('button', { name: 'Incoming' }));
    await waitFor(() => expect(pinned(scroller)).toBe(true));
    await expect(canvasElement.ownerDocument.activeElement).toBe(field);
    scroller.scrollTop = 100;
    fireEvent.scroll(scroller);
    const before = scroller.scrollTop;
    fireEvent.click(canvas.getByRole('button', { name: 'Incoming' }));
    await waitFor(() => expect(canvas.getByRole('button', { name: '1 new message' })).toBeVisible());
    await expect(Math.abs(scroller.scrollTop - before)).toBeLessThan(2);
    const previousTop = item(canvasElement, 'history-1').getBoundingClientRect().top;
    fireEvent.click(canvas.getByRole('button', { name: 'Prepend' }));
    await waitFor(() => expect(Math.abs(item(canvasElement, 'history-1').getBoundingClientRect().top - previousTop)).toBeLessThan(2));
    await expect(canvasElement.ownerDocument.activeElement).toBe(field);
    await userEvent.click(canvas.getByRole('button', { name: '1 new message' }));
    await waitFor(() => expect(pinned(scroller)).toBe(true));
    await expect(canvasElement.ownerDocument.activeElement).toBe(field);
  },
};
export const AriaMerge: Story = {
  render: (args) => <><p id="chat-name">Project chat</p><p id="chat-help">Use Enter to send</p><ChatThread {...args} aria-label="Consumer label" aria-labelledby="chat-name missing-id" aria-describedby="chat-help" composerProps={{ slotProps: { textarea: { 'aria-label': 'Your message', 'aria-labelledby': 'chat-name', 'aria-describedby': 'chat-help unresolved', description: 'Draft text' } } }} /></>,
  play: async ({ canvasElement, canvas }) => {
    const root = canvasElement.querySelector('[data-ui="chat-thread"]')!;
    await expect(root).toHaveAttribute('aria-label', 'Consumer label');
    await expect(root).toHaveAttribute('aria-labelledby', 'chat-name missing-id');
    await expect(root).toHaveAttribute('aria-describedby', 'chat-help');
    const field = canvas.getByRole('textbox');
    await expect(field).toHaveAttribute('aria-label', 'Your message');
    await expect(field).toHaveAttribute('aria-labelledby', 'chat-name');
    await expect(field.getAttribute('aria-describedby')).toContain('chat-help unresolved');
    await expect(field).toHaveAccessibleDescription('Use Enter to send Draft text');
  },
};
export const FalsyContent: Story = {
  render: (args) => <div css={stackStyle}>{[false, null, 0, ''].map((value, index) => <div css={frameStyle} key={index}><ChatThread {...args} labels={{ conversation: `Conversation ${index + 1}` }} defaultValue={[{ id: 'zero', authorId: 'me', text: '0', createdAt: NOW }]} composerProps={{ slotProps: { textarea: { description: value, error: value } } }} /></div>)}</div>,
  play: async ({ canvas }) => {
    const fields = canvas.getAllByRole('textbox');
    for (const index of [0, 1]) await expect(fields[index]).not.toHaveAttribute('aria-describedby');
    const emptyIds = fields[3]!.getAttribute('aria-describedby')!.split(' ');
    for (const id of emptyIds) await expect(fields[3]!.ownerDocument.getElementById(id)).toHaveTextContent('');
    await expect(fields[2]).toHaveAccessibleDescription('0 0');
    await expect(canvas.getAllByText('0').length).toBeGreaterThanOrEqual(4);
  },
};
const rootSpy = fn();
const composerSpy = fn();
const fieldSpy = fn();
function SlotList(props: ComponentPropsWithRef<'ol'>) {
  return <ol {...props} data-slot="chat-thread-list" />;
}
export const RefAndStyling: Story = {
  args: { slots: { list: SlotList } },
  render: (args) => <ChatThread {...args} ref={rootSpy} css={css({ outlineStyle: 'dotted' })} sx={{ outlineStyle: 'dashed' }} slotProps={{ list: { css: css({ gap: vars.space[8] }) }, bubble: { css: css({ textDecorationLine: 'underline' }) } }} composerProps={{ ref: composerSpy, sx: { outlineStyle: 'dashed' }, slotProps: { textarea: { ref: fieldSpy } } }} />,
  play: async ({ canvasElement, canvas }) => {
    const root = canvasElement.querySelector('[data-ui="chat-thread"]')!;
    const replacement = root.querySelector('[data-slot="chat-thread-list"]')!;
    await expect(replacement).toBeInTheDocument();
    await expect(replacement).toHaveAttribute('data-ui', 'chat-thread-list');
    await expect(replacement).toHaveAttribute('role', 'list');
    await expect(getComputedStyle(replacement).display).toBe('flex');
    await expect(root.querySelector('[data-ui="chat-thread-list"]:not([data-slot])')).toBeNull();
    await expect(rootSpy.mock.calls.map(([element]) => element)).toContain(root);
    await expect(composerSpy.mock.calls.map(([element]) => element)).toContain(part(canvasElement, 'composer'));
    await expect(fieldSpy.mock.calls.map(([element]) => element)).toContain(canvas.getByRole('textbox'));
    await expect(getComputedStyle(root).outlineStyle).toBe('dashed');
    await expect(getComputedStyle(part(canvasElement, 'composer')).outlineStyle).toBe('dashed');
    await expect(Number.parseFloat(getComputedStyle(part(canvasElement, 'list')).gap)).toBeGreaterThan(24);
    await expect(getComputedStyle(part(canvasElement, 'bubble')).textDecorationLine).toBe('underline');
  },
};
export const LightTheme: Story = { decorators: [withLightTheme] };
export const RTL: Story = {
  args: { dir: 'rtl' },
  play: async ({ canvasElement, userEvent }) => {
    const own = item(canvasElement, 'own').querySelector('article')!.getBoundingClientRect();
    const other = item(canvasElement, 'first').querySelector('article')!.getBoundingClientRect();
    await expect(own.left).toBeLessThan(other.left);
     await userEvent.click(within(item(canvasElement, 'first')).getByRole('button', { name: /^Add reaction/ }));
     const picker = await page(canvasElement).findByRole('group', { name: /^Reactions/ });
    const emoji = within(picker).getAllByRole('button').slice(0, -1);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(emoji[1]);
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(emoji.at(-1));
  },
};
export const ReducedMotion: Story = {
  args: { typing: ['grace'] },
  parameters: { docs: { description: { story: 'This story does not enable reduced motion. Set it in the browser to check media styles and jumps without animation.' } } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    await expect(getComputedStyle(part(canvasElement, 'list')).animationName).toBe('none');
  },
};
export const ForcedColors: Story = {
  parameters: { docs: { description: { story: 'This story does not enable forced colors. Set it in the browser to check system-color borders and focus outlines.' } } },
  play: async ({ canvasElement }) => {
    const chip = item(canvasElement, 'second').querySelector('[data-part="reaction"]')!;
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(Number.parseFloat(getComputedStyle(chip).borderTopWidth)).toBeGreaterThan(1.25);
  },
};
