import { useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { ChatMessage, type ChatMessageProps } from './index';
import { ChatThread } from '../chat-thread';

const NOW = Date.parse('2026-10-12T12:00:00Z');
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function ReplacementTime(props: ComponentPropsWithRef<'time'>) {
  return <time {...props} data-slot="chat-message-time" />;
}

export const TimeReplacement: Story = {
  render: (args) => <ChatMessage {...args} slots={{ time: ReplacementTime }} />,
  play: async ({ canvasElement }) => {
    const time = canvasElement.querySelector('[data-slot="chat-message-time"]');
    await expect(time).toBeInTheDocument();
    await expect(time).toHaveAttribute('data-ui', 'chat-message-time');
    await expect(time).toHaveAttribute('datetime', new Date(NOW).toISOString());
    await expect(time).toHaveAttribute('id');
    await expect(getComputedStyle(time!).whiteSpace).toBe('nowrap');
    await expect(canvasElement.querySelector('[data-ui="chat-message-time"]:not([data-slot])')).toBeNull();
  },
};
const LOCALE = 'en-US';

const stackStyle = css({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: `min(42rem, 100%)`,
});
const wideStyle = css({ display: 'grid', gap: vars.space[4], inlineSize: '100%' });
const narrowStyle = css({ inlineSize: '20rem', maxInlineSize: '100%' });
const avatarStyle = css({ fontSize: vars.textSize.xl, lineHeight: vars.lineHeight.tight });

const usage = `<ChatMessage
  author={{ id: 'ada', name: 'Ada Lovelace' }}
  createdAt={Date.now()}
  reactions={[{ emoji: '👍', count: 2, mine: true }]}
  status="delivered"
>
  The deployment was successful.
</ChatMessage>`;

const meta = {
  title: 'Data display/ChatMessage',
  component: ChatMessage,
  tags: ['autodocs'],
  args: {
    author: { id: 'ada', name: 'Ada Lovelace' },
    createdAt: NOW,
    now: NOW + 5 * MINUTE,
    locale: LOCALE,
    timeZone: 'UTC',
    onReact: fn(),
    onRetry: fn(),
    onReactionsChange: fn(),
  },
  decorators: [(Story) => <div css={stackStyle}><Story /></div>],
  parameters: {
    docs: {
      source: { code: usage },
      description: {
        component: 'Display a conversation message with author details, timestamp, reactions, and delivery status.',
      },
      usage: `### Roles and structure
- Render a message as an \`<article>\` named by its author and formatted timestamp (or an explicit \`aria-label\`).
- The bubble wraps body text, children, and any file attachments.

### Avatar customization
- Displays an \`Avatar\` by default using \`author.name\` and \`author.avatar\`.
- Replace the avatar with \`avatar={<CustomElement />}\` or omit the column with \`avatar={null}\`.

### Reactions and interactions
- Reaction chips show counts and user-reacted states.
- Use \`reactions\` and \`onReactionsChange\` for controlled counts, or \`defaultReactions\` to seed local counts. Controlled requests do not change the display until you update the prop. \`message.reactions\` is also controlled.
- The "Add reaction" button opens an emoji picker popover with roving focus. Picker state can be controlled via \`pickerOpen\` or uncontrolled.

### Keyboard and focus
- Tab moves through interactive elements: attachments, reaction chips, the add reaction button, and retry.
- In the reaction picker, ArrowLeft and ArrowRight navigate (reversed in RTL), Home and End jump to the bounds, Enter and Space select, and Escape closes the picker and returns focus to the trigger.

### Clock and time
- The caller owns \`now\` in epoch milliseconds; the component keeps no internal timer.
- When \`now\` is \`null\` or omitted, the full localized date and time are rendered.

### State and retry
- Set \`status\` to \`'sending'\`, \`'sent'\`, \`'delivered'\`, \`'read'\`, or \`'failed'\`.
- When \`status="failed"\` and \`onRetry\` is supplied, an accessible Retry button appears in the receipt row.`,
    },
  },
} satisfies Meta<typeof ChatMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

async function focusRing(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expect(getComputedStyle(element).outlineStyle).not.toBe('none');
  await expect(Math.abs(Number.parseFloat(getComputedStyle(element).outlineWidth) - 2)).toBeLessThan(1.1);
}

export const Plain: Story = {
  args: {
    author: { id: 'grace', name: 'Grace Hopper' },
    createdAt: NOW - DAY,
    now: NOW,
    reactions: [{ emoji: '👍', count: 2, mine: true }],
    children: 'The build is ready to review.',
  },
  play: async ({ canvas }) => {
    const article = canvas.getByRole('article');
    await expect(article).toBeInTheDocument();
    await expect(article).toHaveAccessibleName(expect.stringContaining('Grace Hopper'));
    await expect(canvas.getByText('Grace Hopper')).toBeInTheDocument();
    await expect(canvas.getByText('The build is ready to review.')).toBeInTheDocument();
    const chip = canvas.getByRole('button', { name: /^👍 2 reactions, including you/ });
    await expect(chip).toBeInTheDocument();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
  },
};

export const AvatarSlot: Story = {
  render: () => (
    <div css={stackStyle}>
      <ChatMessage
        author={{ id: 'bot', name: 'Release Bot' }}
        createdAt={NOW}
        avatar={<span data-testid="custom-avatar" css={avatarStyle}>🤖</span>}
      >
        The release is ready.
      </ChatMessage>
      <ChatMessage
        author={{ id: 'system', name: 'System Notice' }}
        createdAt={NOW}
        avatar={null}
      >
        Maintenance starts at midnight.
      </ChatMessage>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId('custom-avatar')).toBeInTheDocument();
    await expect(canvas.getByText('Release Bot')).toBeInTheDocument();
    await expect(canvas.getByText('System Notice')).toBeInTheDocument();
    const articles = canvas.getAllByRole('article');
    await expect(articles).toHaveLength(2);
    await expect(articles[1]).toHaveAttribute('data-avatar', 'none');
    await expect(articles[1]!.querySelector('[data-ui="avatar"]')).toBeNull();
  },
};

export const OwnAlignment: Story = {
  render: () => (
    <div css={wideStyle}>
      <ChatMessage
        author={{ id: 'grace', name: 'Grace Hopper' }}
        createdAt={NOW - 10 * MINUTE}
        now={NOW}
      >
        Can you check the mobile styles?
      </ChatMessage>
      <ChatMessage
        author={{ id: 'me', name: 'Ada Lovelace' }}
        createdAt={NOW - 5 * MINUTE}
        now={NOW}
        own
        status="delivered"
      >
        Checking them now!
      </ChatMessage>
    </div>
  ),
  play: async ({ canvas }) => {
    const articles = canvas.getAllByRole('article');
    await expect(articles).toHaveLength(2);
    const otherBox = articles[0]!.getBoundingClientRect();
    const ownBox = articles[1]!.getBoundingClientRect();
    await expect(ownBox.right).toBeGreaterThan(otherBox.right);
    await waitFor(() => expect(canvas.getByText('Delivered')).toBeVisible());
  },
};

export const SendingAndFailed: Story = {
  render: function Render(args) {
    const [retrying, setRetrying] = useState(false);
    return (
      <div css={stackStyle}>
        <ChatMessage
          author={{ id: 'me', name: 'Ada Lovelace' }}
          createdAt={NOW}
          status="sending"
          own
          offeredReactions={[]}
        >
          Uploading draft design...
        </ChatMessage>
        <ChatMessage
          author={{ id: 'me', name: 'Ada Lovelace' }}
          createdAt={NOW}
          status="failed"
          own
          offeredReactions={[]}
          retryLoading={retrying}
          onRetry={async () => {
            setRetrying(true);
            try {
              await args.onRetry?.();
            } finally {
              setRetrying(false);
            }
          }}
        >
          Could not connect to the server.
        </ChatMessage>
      </div>
    );
  },
  play: async ({ canvas, args, userEvent }) => {
    await waitFor(() => expect(canvas.getByText('Sending')).toBeVisible());
    await expect(canvas.getByText('Failed')).toBeVisible();
    const retryBtn = canvas.getByRole('button', { name: /^Retry/ });
    await expect(retryBtn).toBeInTheDocument();
    await userEvent.tab();
    await focusRing(retryBtn);
    await userEvent.keyboard('{Enter}');
    await expect(args.onRetry).toHaveBeenCalledTimes(1);
  },
};

export const LongText: Story = {
  args: {
    author: { id: 'alan', name: 'Alan Turing' },
    createdAt: NOW,
    reactions: [{ emoji: '🚀', count: 9999 }],
    children: 'Supercalifragilisticexpialidocious'.repeat(6),
  },
  decorators: [
    (Story) => (
      <div css={narrowStyle}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    const article = canvas.getByRole('article');
    await expect(article.scrollWidth).toBeLessThanOrEqual(article.clientWidth + 2);
    const chip = canvas.getByRole('button', { name: /^🚀/ });
    await expect(chip.scrollWidth).toBeLessThanOrEqual(chip.clientWidth + 2);
  },
};

export const Reactions: Story = {
  args: {
    author: { id: 'grace', name: 'Grace Hopper' },
    createdAt: NOW - MINUTE,
    now: NOW,
    defaultReactions: [{ emoji: '👍', count: 1 }],
    children: 'Thanks for reviewing the build.',
  },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.tab();
    await focusRing(canvas.getByRole('button', { name: /^👍/ }));
    await userEvent.tab();
    const addBtn = canvas.getByRole('button', { name: /^Add reaction/ });
    await focusRing(addBtn);
    await userEvent.keyboard('{Enter}');

    const page = within(canvasElement.ownerDocument.body);
    const picker = await page.findByRole('group', { name: /^Reactions/ });
    await expect(addBtn).toHaveAttribute('aria-controls', picker.id);

    const emojis = within(picker).getAllByRole('button').slice(0, -1);
    await expect(canvasElement.ownerDocument.activeElement).toBe(emojis[0]);

    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(emojis.at(-1));

    await userEvent.keyboard('{ArrowRight}{End}{Home}{ArrowRight}');
    await focusRing(emojis[1]!);

    await userEvent.keyboard('{Enter}');
    await expect(args.onReact).toHaveBeenCalledTimes(1);
    await expect(args.onReact).toHaveBeenLastCalledWith('❤️');
    await expect(canvasElement.ownerDocument.activeElement).toBe(addBtn);

    await userEvent.click(addBtn);
    await userEvent.keyboard('{Escape}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(addBtn);
  },
};

export const ReactionsRTL: Story = {
  args: {
    dir: 'rtl',
  },
  render: (args) => (
    <div dir="rtl" css={wideStyle}>
      <ChatMessage
        {...args}
        author={{ id: 'grace', name: 'Grace Hopper' }}
        createdAt={NOW}
        now={NOW}
        defaultReactions={[{ emoji: '👍', count: 1 }]}
      >
        رسالة من اليمين إلى اليسار
      </ChatMessage>
      <ChatMessage
        {...args}
        author={{ id: 'me', name: 'Ada Lovelace' }}
        createdAt={NOW}
        now={NOW}
        own
      >
        رد من اليمين
      </ChatMessage>
    </div>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const articles = canvas.getAllByRole('article');
    const otherBox = articles[0]!.getBoundingClientRect();
    const ownBox = articles[1]!.getBoundingClientRect();
    await expect(ownBox.left).toBeLessThan(otherBox.left);

    const addBtn = within(articles[0]!).getByRole('button', { name: /^Add reaction/ });
    await userEvent.click(addBtn);
    const page = within(canvasElement.ownerDocument.body);
    const picker = await page.findByRole('group', { name: /^Reactions/ });
    const emojis = within(picker).getAllByRole('button').slice(0, -1);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(emojis[1]);
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  args: {
    author: { id: 'ada', name: 'Ada Lovelace' },
    createdAt: NOW,
    status: 'delivered',
    reactions: [{ emoji: '🎉', count: 3 }],
    children: 'Message displayed in light theme.',
  },
};

const articleRefSpy = fn();

export const AriaAndRefMerge: Story = {
  render: (args) => (
    <>
      <p id="external-desc">Additional message context</p>
      <ChatMessage
        {...args}
        ref={articleRefSpy}
        id="custom-message-root"
        data-testid="message-element"
        tabIndex={0}
        aria-label="Important update"
        aria-describedby="external-desc"
        author={{ id: 'ada', name: 'Ada Lovelace' }}
        createdAt={NOW}
      >
        The build passed its checks.
      </ChatMessage>
    </>
  ),
  play: async ({ canvas }) => {
    const article = canvas.getByTestId('message-element');
    await expect(article).toHaveAttribute('id', 'custom-message-root');
    await expect(article).toHaveAttribute('tabIndex', '0');
    await expect(article).toHaveAttribute('aria-label', 'Important update');
    await expect(article.getAttribute('aria-describedby')).toContain('external-desc');
    await expect(articleRefSpy.mock.calls.map(([el]) => el)).toContain(article);
    await expect(article).toHaveAccessibleName('Important update');
    await expect(article.getAttribute('aria-describedby')!.split(' ')).toHaveLength(2);
  },
};

/** Keep the supplied counts until your app accepts the reaction. */
export const ControlledReactions: Story = {
  args: {
    reactions: [{ emoji: '👍', count: 2, mine: false }],
    children: 'Ready for review.',
  },
  play: async ({ canvas, args, userEvent }) => {
    const chip = canvas.getByRole('button', { name: /^👍/ });
    await userEvent.tab();
    await focusRing(chip);
    await userEvent.keyboard(' ');
    await expect(args.onReactionsChange).toHaveBeenCalledTimes(1);
    await expect(args.onReactionsChange).toHaveBeenLastCalledWith([{ emoji: '👍', count: 3, mine: true }]);
    await expect(args.onReact).toHaveBeenCalledTimes(1);
    await expect(args.onReact).toHaveBeenLastCalledWith('👍');
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await expect(chip).toHaveTextContent('2');
  },
};

/** Disable reactions and retries while keeping the delivery state visible. */
export const Disabled: Story = {
  args: { disabled: true, status: 'failed', reactions: [{ emoji: '👍', count: 2 }], children: 'Waiting for a connection.' },
  play: async ({ canvas, args, userEvent }) => {
    for (const button of canvas.getAllByRole('button')) {
      await expect(button).toBeDisabled();
      await userEvent.click(button);
    }
    await expect(args.onReact).not.toHaveBeenCalled();
    await expect(args.onRetry).not.toHaveBeenCalled();
  },
};

/** Render numeric body content and apply your styling after the message defaults. */
export const StylingAndZeroContent: Story = {
  args: { children: 0, offeredReactions: [], avatar: null },
  render: (args) => <ChatMessage {...args} css={{ outlineStyle: 'dotted' }} sx={{ outlineStyle: 'dashed' }} slotProps={{ article: { css: css({ outlineStyle: 'solid' }), className: 'custom-message', style: { opacity: 1 } }, bubble: { css: css({ textDecorationLine: 'underline' }) } }} />,
  play: async ({ canvas }) => {
    const article = canvas.getByRole('article');
    await expect(canvas.getByText('0')).toBeVisible();
    await expect(article).toHaveClass('custom-message');
    await expect(getComputedStyle(article).outlineStyle).toBe('dashed');
    await expect(getComputedStyle(article.querySelector('[data-part="chat-message-bubble"]')!).textDecorationLine).toBe('underline');
  },
};

/** Show the same message in separate feeds without sharing accessible ids. */
export const RepeatedMessage: Story = {
  render: (args) => <div css={stackStyle}>{[0, 1].map((key) => <ChatMessage {...args} key={key} message={{ id: 'same-message', authorId: 'ada', createdAt: NOW, text: 'The build is ready.' }} offeredReactions={[]} />)}</div>,
  play: async ({ canvas, canvasElement }) => {
    const articles = canvas.getAllByRole('article');
    await expect(articles).toHaveLength(2);
    await expect(articles[0]!.id).toBe('');
    await expect(articles[1]!.id).toBe('');
    const ids = Array.from(canvasElement.querySelectorAll('[id]')).map((element) => element.id);
    await expect(new Set(ids).size).toBe(ids.length);
    for (const article of articles) {
      for (const id of article.getAttribute('aria-labelledby')!.split(' ')) {
        await expect(article.contains(article.ownerDocument.getElementById(id))).toBe(true);
      }
    }
  },
};

/** Set conversation typography once for all its messages. */
export const ThreadTypography: Story = {
  render: () => <ChatThread participants={[{ id: 'ada', name: 'Ada Lovelace' }]} currentUserId="ada" defaultValue={[{ id: 'type', authorId: 'ada', text: 'The build is ready.', createdAt: NOW }]} now={NOW} composer={false} reactions={[]} sx={{ fontFamily: 'serif', fontSize: vars.textSize.lg, '--thread-column-gap': vars.space[8] }} />,
  parameters: { docs: { source: { code: '<ChatThread participants={people} currentUserId="ada" defaultValue={messages} now={now} composer={false} sx={{ fontFamily: "serif" }} />' } } },
  play: async ({ canvas, canvasElement }) => {
    const author = canvas.getByText('Ada Lovelace');
    const thread = canvasElement.querySelector('[data-ui="chat-thread"]')!;
    await expect(getComputedStyle(author).fontFamily).toBe(getComputedStyle(thread).fontFamily);
    await expect(getComputedStyle(author).fontSize).toBe(getComputedStyle(thread).fontSize);
    await expect(getComputedStyle(canvas.getByRole('article')).getPropertyValue('--thread-column-gap')).toBe(getComputedStyle(thread).getPropertyValue('--thread-column-gap'));
  },
};
