import { useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { ClassNames, css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { ChatMessage, type ChatMessageProps } from './index';
import { ChatThread } from '../chat-thread';

const NOW = Date.parse('2026-10-12T12:00:00Z');
function ReplacementRoot(props: ComponentPropsWithRef<'article'>) {
  return <article {...props} data-testid="replacement-root" />;
}
function SugarRoot(props: ComponentPropsWithRef<'article'>) {
  return <article {...props} data-testid="sugar-root" />;
}
export const RootComponent: StoryObj<typeof ChatMessage> = {
  tags: ['!autodocs'], args: { author: 'Alex', text: 'Ready.', component: SugarRoot },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTestId('sugar-root')).toHaveAttribute('data-ui', 'chat-message');
  },
};
export const RootReplacement: StoryObj<typeof ChatMessage> = {
  tags: ['!autodocs'],
  args: { author: 'Alex', text: 'Ready to review.', component: SugarRoot, slots: { root: ReplacementRoot }, ref: fn(), className: 'consumer-root', title: 'consumer', slotProps: { root: { ref: fn(), title: 'slot', className: 'slot-root', 'data-ui': 'custom' } } },
  play: async ({ canvasElement, args }) => {
    const root = within(canvasElement).getByTestId('replacement-root');
    await expect(root.tagName).toBe('ARTICLE');
    await expect(root).toHaveClass('consumer-root', 'slot-root');
    await expect(root).toHaveAttribute('title', 'slot');
    await expect(root).toHaveAttribute('data-ui', 'chat-message custom');
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(args.slotProps?.root?.ref).toHaveBeenCalledWith(root);
    await expect(root).toHaveTextContent('Ready to review.');
    await expect(root).toHaveAccessibleName(/Alex/);
  },
};
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function ReplacementTime(props: ComponentPropsWithRef<'time'>) {
  return <time {...props} data-slot="chat-message-time" />;
}

function ReplacementAttachments(props: ComponentPropsWithRef<'ul'>) {
  return <ul {...props} data-testid="custom-attachments" />;
}

export const AttachmentsReplacement: StoryObj<typeof ChatMessage> = {
  name: 'Attached notes',
  parameters: {
    docs: {
      description: { story: 'Link to a file inside a replaceable attachment list.' },
      source: {
        language: 'tsx',
        code: `import { type ComponentPropsWithRef } from 'react';
import { ChatMessage } from '@jfrader/ui';

const NOW = Date.parse('2026-10-12T12:00:00Z');

const MINUTE = 60000;

const LOCALE = 'en-US';

function ReplacementAttachments(props: ComponentPropsWithRef<'ul'>) {
  return <ul {...props} />;
}

export function Example() {
  return (
    <ChatMessage
      author="Ada"
      createdAt={NOW}
      now={NOW + 5 * MINUTE}
      locale={LOCALE}
      timeZone="UTC"
      onRetry={() => {
        console.info('Retry');
      }}
      attachments={[
        { id: 'attachment', name: 'Notes', kind: 'file', url: 'https://example.com/notes' },
      ]}
      slots={{ attachments: ReplacementAttachments }}
      slotProps={{ attachments: { className: 'attachment-slot' } }}
    />
  );
}`,
      },
    },
  },
  args: {
    author: 'Ada',
    createdAt: NOW,
    attachments: [{ id: 'attachment', name: 'Notes', kind: 'file', url: 'https://example.com/notes' }],
    slots: { attachments: ReplacementAttachments },
    slotProps: { attachments: { className: 'attachment-slot' } },
  },
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByTestId('custom-attachments');
    await expect(list).toHaveAttribute('data-ui', 'chat-message-attachments');
    await expect(list).toHaveClass('attachment-slot');
    await expect(within(list).getByRole('link', { name: /Notes/ })).toBeInTheDocument();
  },
};

export const TimeReplacement: Story = {
  name: 'Custom timestamp element',
  parameters: { docs: {
    description: { story: 'Replace the timestamp element while preserving its accessible date and styling.' },
    source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { ChatMessage } from '@jfrader/ui';

function MessageTime(props: ComponentPropsWithRef<'time'>) {
  return <time {...props} />;
}
const createdAt = Date.parse('2026-10-12T12:00:00Z');

<ChatMessage author={{ id: 'ada', name: 'Ada Lovelace' }} createdAt={createdAt}
  now={createdAt + 300_000} locale="en-US" timeZone="UTC"
  slots={{ time: MessageTime }} />` },
  } },
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

const Stack = styled.div({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: `min(42rem, 100%)`,
});
const WideStack = styled.div({ display: 'grid', gap: vars.space[4], inlineSize: '100%' });
const NarrowFrame = styled.div({ inlineSize: '20rem', maxInlineSize: '100%' });
const CustomAvatar = styled.span({ fontSize: vars.textSize.xl, lineHeight: vars.lineHeight.tight });

// The slot API takes `css` values, so this story keeps the documented spelling.
const slotArticleStyle = css({ outlineStyle: 'solid' });
const slotBubbleStyle = css({ textDecorationLine: 'underline' });

const usage = `import { ChatMessage } from '@jfrader/ui';

<ChatMessage
  author={{ id: 'grace', name: 'Grace Hopper' }}
  createdAt="2026-10-11T12:00:00Z"
  now={Date.parse('2026-10-12T12:00:00Z')}
  locale="en-US"
  timeZone="UTC"
  reactions={[{ emoji: '👍', count: 2, mine: true }]}
>
  The build is ready to review.
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
  decorators: [(Story) => <Stack><Story /></Stack>],
  parameters: {
    docs: {
      sections: [
        { title: 'Basic', stories: ['Plain'] },
        { title: 'Roles', stories: ['OwnAlignment'] },
        { title: 'Attachments', stories: ['AttachmentsReplacement'] },
        { title: 'Reactions', stories: ['Reactions'] },
        { title: 'States', stories: ['SendingAndFailed', 'Disabled'] },
        { title: 'Long content', stories: ['LongText'] },
        { title: 'Composition', stories: ['AvatarSlot', 'TimeReplacement', 'ThreadTypography'] },
      ],
      source: { language: 'tsx', code: usage },
      description: {
        component: 'Display a conversation message with author details, timestamp, reactions, and delivery status.',
      },
      usage: `### When to use
Use a message on its own in a feed or activity view. Use ChatThread when you need a transcript and composer together.

### Values and constraints

Your application owns delivery, retry transport and the clock used for relative timestamps; the message starts no timer. Without a supplied clock, timestamps show the full localized date and time. Controlled reaction requests remain unchanged until the application accepts them.

### Keyboard and accessibility

Messages are articles named by author and timestamp. Tab moves through attachments, reactions and retry actions. In the reaction picker, Left/Right wrap and reverse in RTL, Home/End jump to the bounds, and Enter/Space select. Escape closes the picker and returns focus to its trigger.`,
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
  name: 'Conversation message',
  parameters: { docs: { description: { story: 'Show an author, timestamp, message body and an existing reaction.' } } },
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
  name: 'Bot and system messages',
  parameters: { docs: {
    description: { story: 'Use a custom avatar for a bot and omit the avatar for a system notice.' },
    source: { language: 'tsx', code: `import { ChatMessage, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Stack = styled.div({ display: 'grid', gap: vars.space[4] });
const BotAvatar = styled.span({ fontSize: vars.textSize.xl, lineHeight: vars.lineHeight.tight });
const createdAt = Date.parse('2026-10-12T12:00:00Z');

<Stack>
  <ChatMessage author={{ id: 'bot', name: 'Release Bot' }} createdAt={createdAt} avatar={<BotAvatar>🤖</BotAvatar>}>
    The release is ready.
  </ChatMessage>
  <ChatMessage author={{ id: 'system', name: 'System Notice' }} createdAt={createdAt} avatar={null}>
    Maintenance starts at midnight.
  </ChatMessage>
</Stack>` },
  } },
  render: () => (
    <Stack>
      <ChatMessage
        author={{ id: 'bot', name: 'Release Bot' }}
        createdAt={NOW}
        avatar={<CustomAvatar data-testid="custom-avatar">🤖</CustomAvatar>}
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
    </Stack>
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
  name: 'Incoming and outgoing messages',
  parameters: { docs: {
    description: { story: 'Align incoming messages opposite your own replies and show their delivery receipt.' },
    source: { language: 'tsx', code: `import { ChatMessage, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Stack = styled.div({ display: 'grid', gap: vars.space[4], inlineSize: '100%' });
const now = Date.parse('2026-10-12T12:00:00Z');

<Stack>
  <ChatMessage author={{ id: 'grace', name: 'Grace Hopper' }} createdAt={now - 600_000} now={now}>
    Can you check the mobile styles?
  </ChatMessage>
  <ChatMessage author={{ id: 'me', name: 'Ada Lovelace' }} createdAt={now - 300_000} now={now} own status="delivered">
    Checking them now!
  </ChatMessage>
</Stack>` },
  } },
  render: () => (
    <WideStack>
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
    </WideStack>
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
  name: 'Sending and retry',
  parameters: { docs: {
    description: { story: 'Compare a sending message with a failed message that can be retried.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { ChatMessage, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Stack = styled.div({ display: 'grid', gap: vars.space[4] });
const author = { id: 'me', name: 'Ada Lovelace' };
const createdAt = Date.parse('2026-10-12T12:00:00Z');

export function DeliveryMessages({ retry }: { retry: () => void | Promise<void> }) {
  const [retrying, setRetrying] = useState(false);
  return <Stack>
    <ChatMessage author={author} createdAt={createdAt} status="sending" own offeredReactions={[]}>
      Uploading draft design...
    </ChatMessage>
    <ChatMessage author={author} createdAt={createdAt} status="failed" own offeredReactions={[]}
      retryLoading={retrying} onRetry={async () => {
        setRetrying(true);
        try { await retry(); } finally { setRetrying(false); }
      }}>
      Could not connect to the server.
    </ChatMessage>
  </Stack>;
}` },
  } },
  render: function Render(args) {
    const [retrying, setRetrying] = useState(false);
    return (
      <Stack>
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
      </Stack>
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
  name: 'Long unbroken text',
  parameters: { docs: {
    description: { story: 'Wrap an unbroken word and a large reaction count in a narrow message.' },
    source: { language: 'tsx', code: `import { ChatMessage, styled } from '@jfrader/ui';

const Frame = styled.div({ inlineSize: '20rem', maxInlineSize: '100%' });
const createdAt = Date.parse('2026-10-12T12:00:00Z');

<Frame>
  <ChatMessage author={{ id: 'alan', name: 'Alan Turing' }} createdAt={createdAt}
    now={createdAt + 300_000} locale="en-US" timeZone="UTC"
    reactions={[{ emoji: '🚀', count: 9999 }]}>
    {'Supercalifragilisticexpialidocious'.repeat(6)}
  </ChatMessage>
</Frame>` },
  } },
  args: {
    author: { id: 'alan', name: 'Alan Turing' },
    createdAt: NOW,
    reactions: [{ emoji: '🚀', count: 9999 }],
    children: 'Supercalifragilisticexpialidocious'.repeat(6),
  },
  decorators: [
    (Story) => (
      <NarrowFrame>
        <Story />
      </NarrowFrame>
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
  name: 'Add a reaction',
  parameters: { docs: {
    description: { story: 'Toggle a reaction or open Add reaction to choose another emoji.' },
    source: { language: 'tsx', code: `import { ChatMessage } from '@jfrader/ui';

<ChatMessage author={{ id: 'grace', name: 'Grace Hopper' }}
  createdAt="2026-10-12T11:59:00Z" now={Date.parse('2026-10-12T12:00:00Z')}
  locale="en-US" timeZone="UTC" defaultReactions={[{ emoji: '👍', count: 1 }]}>
  Thanks for reviewing the build.
</ChatMessage>` },
  } },
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
    <WideStack dir="rtl">
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
    </WideStack>
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
  name: 'Disabled actions',
  parameters: { docs: {
    description: { story: 'Keep delivery status visible while reactions and retry actions are disabled.' },
    source: { language: 'tsx', code: `import { ChatMessage } from '@jfrader/ui';

export function OfflineMessage({ retry }: { retry: () => void }) {
  return <ChatMessage author={{ id: 'ada', name: 'Ada Lovelace' }}
    createdAt="2026-10-12T12:00:00Z" now={Date.parse('2026-10-12T12:05:00Z')}
    locale="en-US" timeZone="UTC" disabled status="failed" onRetry={retry}
    reactions={[{ emoji: '👍', count: 2 }]}>
    Waiting for a connection.
  </ChatMessage>;
}` },
  } },
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
  render: (args) => (
    <ClassNames>
      {({ css: className }) => (
        <ChatMessage
          {...args}
          className={className({ outlineStyle: 'dotted' })}
          sx={{ outlineStyle: 'dashed' }}
          slotProps={{
            article: { sx: slotArticleStyle, className: 'custom-message', style: { opacity: 1 } },
            bubble: { sx: slotBubbleStyle },
          }}
        />
      )}
    </ClassNames>
  ),
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
  render: (args) => (
    <Stack>
      {[0, 1].map((key) => (
        <ChatMessage
          {...args}
          key={key}
          message={{ id: 'same-message', authorId: 'ada', createdAt: NOW, text: 'The build is ready.' }}
          offeredReactions={[]}
        />
      ))}
    </Stack>
  ),
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
  name: 'Conversation typography',
  render: () => <ChatThread participants={[{ id: 'ada', name: 'Ada Lovelace' }]} currentUserId="ada" defaultValue={[{ id: 'type', authorId: 'ada', text: 'The build is ready.', createdAt: NOW }]} now={NOW} composer={false} reactions={[]} sx={{ fontFamily: 'serif', fontSize: vars.textSize.lg, '--thread-column-gap': vars.space[8] }} />,
  parameters: { docs: {
    description: { story: 'Set conversation typography and spacing once for all of its messages.' },
    source: { language: 'tsx', code: `import { ChatThread } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const now = Date.parse('2026-10-12T12:00:00Z');

<ChatThread participants={[{ id: 'ada', name: 'Ada Lovelace' }]} currentUserId="ada"
  defaultValue={[{ id: 'type', authorId: 'ada', text: 'The build is ready.', createdAt: now }]}
  now={now} composer={false} reactions={[]}
  sx={{ fontFamily: 'serif', fontSize: vars.textSize.lg, '--thread-column-gap': vars.space[8] }} />` },
  } },
  play: async ({ canvas, canvasElement }) => {
    const author = canvas.getByText('Ada Lovelace');
    const thread = canvasElement.querySelector('[data-ui="chat-thread"]')!;
    await expect(getComputedStyle(author).fontFamily).toBe(getComputedStyle(thread).fontFamily);
    await expect(getComputedStyle(author).fontSize).toBe(getComputedStyle(thread).fontSize);
    await expect(getComputedStyle(canvas.getByRole('article')).getPropertyValue('--thread-column-gap')).toBe(getComputedStyle(thread).getPropertyValue('--thread-column-gap'));
  },
};
