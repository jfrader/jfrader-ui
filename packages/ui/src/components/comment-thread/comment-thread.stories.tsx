// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor, within, type Mock } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { ClassNames, css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { expectInside } from '../../testing/geometry-assertions';
import { Button, type ButtonProps } from '../button';
import { Textarea, type TextareaProps } from '../textarea';
import {
  CommentThread,
  type CommentAuthor,
  type CommentThreadEvent,
  type CommentThreadProps,
  type ThreadComment,
} from './index';

function ReplacementComposer(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="custom-composer" />;
}

function ReplacementRoot(props: ComponentPropsWithRef<'section'>) {
  return <section {...props} data-testid="replacement-root" />;
}
function SugarRoot(props: ComponentPropsWithRef<'section'>) {
  return <section {...props} data-testid="sugar-root" />;
}

/** The section remains a layout lane around the comment card. */
export const LayoutRoot: StoryObj<typeof CommentThread> = {
  tags: ['!autodocs'],
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui~="comment-thread"]')!;
    const card = root.querySelector<HTMLElement>('[data-ui~="card"]')!;
    await expect(root.tagName).toBe('SECTION');
    await expect(getComputedStyle(root).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    await expect(getComputedStyle(root).borderTopWidth).toBe('0px');
    await expect(getComputedStyle(card).borderTopWidth).toBe('1px');
    await expectInside(card, root);
  },
};

/** Replace the outer section while keeping the comments and composer. */
export const RootReplacement: StoryObj<typeof CommentThread> = {
  tags: ['!autodocs'],
  args: {
    component: SugarRoot,
    slots: { root: ReplacementRoot },
    ref: fn(),
    className: 'consumer-root',
    title: 'Discussion',
    slotProps: { root: { ref: fn(), className: 'slot-root', title: 'slot title', 'data-ui': 'custom consumer' } },
  },
  render: (args) => <CommentThread {...args} data-ui="consumer" />,
  play: async ({ canvasElement, args }) => {
    const root = within(canvasElement).getByTestId('replacement-root');
    await expect(within(canvasElement).queryByTestId('sugar-root')).toBeNull();
    await expect(root.tagName).toBe('SECTION');
    await expect(root).toHaveClass('consumer-root', 'slot-root');
    await expect(root).toHaveAttribute('title', 'slot title');
    await expect(root).toHaveAttribute('data-ui', 'comment-thread consumer custom');
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(args.slotProps?.root?.ref).toHaveBeenCalledWith(root);
    await expect(root.querySelector('[data-ui="comment-thread-list"]')).not.toBeNull();
    await expect(root).toHaveAttribute('data-state', 'open');
    await expect(root).toHaveAccessibleName('Discussion');
  },
};

/** Use component as shorthand for the root slot. */
export const RootComponent: StoryObj<typeof CommentThread> = {
  tags: ['!autodocs'],
  args: { component: SugarRoot },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTestId('sugar-root')).toHaveAttribute('data-ui', 'comment-thread');
  },
};

function ReplacementCommentTextarea(props: TextareaProps) {
  return <Textarea {...props} data-testid="custom-comment-textarea" />;
}

function ReplacementCommentSend(props: ButtonProps) {
  return <Button {...props} data-testid="custom-comment-send" />;
}

export const ComposerReplacements: StoryObj<typeof CommentThread> = {
  render: (args) => <CommentThread {...args} slots={{ composer: ReplacementComposer, textarea: ReplacementCommentTextarea, send: ReplacementCommentSend }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const composer = canvas.getByTestId('custom-composer');
    await expect(composer).toHaveAttribute('data-ui', 'comment-thread-composer');
    await expect(composer.className).not.toBe('');
    await expect(canvas.getByTestId('custom-comment-textarea')).toBeInTheDocument();
    await expect(canvas.getByTestId('custom-comment-send')).toHaveAttribute('data-action', 'submit');
  },
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const NOW = Date.parse('2026-10-11T12:00:00Z');
const LOCALE = 'en-US';
/** Outline is authored as 2px; fractional device pixel ratios compute it slightly thinner. */
const RING_TOLERANCE = 1.1;
const GEOMETRY_TOLERANCE = 1.5;
const MIN_CONTROL = 32;
const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
const fullDate = (timeZone: string) =>
  new Intl.DateTimeFormat(LOCALE, { timeZone, dateStyle: 'full', timeStyle: 'short' });

const ADA: CommentAuthor = { id: 'ada', name: 'Ada Lovelace' };
const GRACE: CommentAuthor = { id: 'grace', name: 'Grace Hopper' };
const ALAN: CommentAuthor = { id: 'alan', name: 'Alan Turing' };

/** Depth-first: c1 → c1r1 → c1r1r1, then c2. Ada (the current user) wrote c1r1 and c2. */
const COMMENTS: readonly ThreadComment[] = Object.freeze([
  {
    id: 'c1',
    author: GRACE,
    body: 'Can we tighten the header spacing?',
    createdAt: NOW - 3 * HOUR,
    reactions: [{ emoji: '👍', users: ['ada', 'alan'] }],
    replies: [
      {
        id: 'c1r1',
        author: ADA,
        body: 'Yes, dropping it to 16px.',
        createdAt: new Date(NOW - 2 * HOUR),
        edited: true,
        replies: [{ id: 'c1r1r1', author: ALAN, body: 'Check the narrow layout too.', createdAt: NOW - 90 * MINUTE }],
      },
    ],
  },
  {
    id: 'c2',
    author: ADA,
    body: 'Shipped the new icons.',
    createdAt: '2026-10-11T11:55:00Z',
    reactions: [{ emoji: '🎉', users: ['grace'] }],
  },
] satisfies ThreadComment[]);

const slotBodyStyle = css({ textDecorationLine: 'underline' });
// Each overrides a declaration the thread itself sets on that part.
const slotHeaderStyle = css({ justifyContent: 'flex-start' });
const slotTitleStyle = css({ overflowWrap: 'normal' });
const slotReactionStyle = css({ flexWrap: 'nowrap' });
const consumerCss = css({ outlineStyle: 'dotted' });
const consumerSx = css({ outlineStyle: 'dashed' });

const usage = `<CommentThread currentUser={me} defaultValue={comments} now={now} title="Review" />`;

const UI = 'comment-thread';
const part = (root: Element, name: string) => root.querySelector<HTMLElement>(`[data-ui="${UI}-${name}"]`);
const item = (root: Element, id: string) =>
  root.querySelector<HTMLElement>(`[data-ui="${UI}-item"][data-comment-id="${id}"]`)!;
const articleOf = (root: Element, id: string) => item(root, id).querySelector<HTMLElement>(':scope > article')!;
const action = (root: Element, id: string, name: string) =>
  articleOf(root, id).querySelector<HTMLElement>(`[data-action="${name}"]`);
const toggleOf = (root: Element, id: string) => item(root, id).querySelector<HTMLElement>(':scope > [data-part="toggle"]');
const field = (root: Element, kind = 'root') =>
  root.querySelector<HTMLTextAreaElement>(`[data-composer="${kind}"] textarea`)!;
const submitOf = (root: Element, kind = 'root') =>
  root.querySelector<HTMLButtonElement>(`[data-composer="${kind}"] [data-action="submit"]`)!;
const itemIds = (root: Element) =>
  Array.from(root.querySelectorAll<HTMLElement>(`[data-ui="${UI}-item"]`)).map((li) => li.dataset.commentId);
const childIds = (root: Element, id: string) =>
  Array.from(item(root, id).querySelectorAll<HTMLElement>(`:scope > ul > [data-ui="${UI}-item"]`)).map(
    (li) => li.dataset.commentId,
  );
const activeOf = (root: Element) => root.ownerDocument.activeElement;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const lastEvent = (spy: unknown) => (spy as Mock).mock.lastCall?.[1] as CommentThreadEvent;
const lastTree = (spy: unknown) => (spy as Mock).mock.lastCall?.[0] as ThreadComment[];
const lastNewId = (spy: unknown) => (spy as Mock).mock.results.at(-1)?.value as string;
const sendKeys = '{Control>}{Enter}{/Control}';

async function expectFocusRing(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  const style = getComputedStyle(element);
  await expect(style.outlineStyle).not.toBe('none');
  await expect(Math.abs(Number.parseFloat(style.outlineWidth) - 2)).toBeLessThan(RING_TOLERANCE);
}

/** Declarations authored for `element` inside `@media` rules whose condition includes `feature`. */
function mediaDeclarations(element: Element, feature: string) {
  return Array.from(element.ownerDocument.styleSheets)
    .flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules);
      } catch {
        return [];
      }
    })
    .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule && rule.conditionText.includes(feature))
    .flatMap((rule) => Array.from(rule.cssRules))
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && element.matches(rule.selectorText))
    .map((rule) => rule.style);
}

let idCounter = 0;
const nextId = () => {
  idCounter += 1;
  return `new-${idCounter}`;
};

/** Story-only parent that accepts every proposed tree. */
function Accepting(args: CommentThreadProps) {
  const [value, setValue] = useState(args.value ?? COMMENTS);
  return (
    <CommentThread
      {...args}
      value={value}
      onValueChange={(next, event) => {
        args.onValueChange?.(next, event);
        setValue(next);
      }}
    />
  );
}

/** Story-only parent that ignores proposals until "Accept last change" applies the latest one. */
function Deferred(args: CommentThreadProps) {
  const [value, setValue] = useState(args.value ?? COMMENTS);
  const [proposal, setProposal] = useState<ThreadComment[] | null>(null);
  return (
    <>
      <Toolbar>
        <FixtureButton type="button" onClick={() => proposal && setValue(proposal)}>
          Accept last change
        </FixtureButton>
      </Toolbar>
      <CommentThread
        {...args}
        value={value}
        onValueChange={(next, event) => {
          args.onValueChange?.(next, event);
          setProposal(next);
        }}
      />
    </>
  );
}

let liveCounter = 0;

/** Story-only feed: comments from someone else arrive, the clock ticks, c1r1r1 is removed. */
function LiveFeed(args: CommentThreadProps) {
  const [value, setValue] = useState(args.value ?? COMMENTS);
  const [now, setNow] = useState(args.now);
  const add = () => {
    liveCounter += 1;
    setValue((current) => [
      ...current,
      { id: `live-${liveCounter}`, author: GRACE, body: `Update ${liveCounter}`, createdAt: now },
    ]);
  };
  const removeLeaf = () =>
    setValue((current) =>
      current.map((comment) =>
        comment.id === 'c1'
          ? { ...comment, replies: comment.replies!.map((reply) => ({ ...reply, replies: [] })) }
          : comment,
      ),
    );
  return (
    <>
      <Toolbar>
        <FixtureButton type="button" onClick={add}>
          Add comment
        </FixtureButton>
        <FixtureButton type="button" onClick={() => setNow((current) => current + MINUTE)}>
          Tick clock
        </FixtureButton>
        <FixtureButton type="button" onClick={removeLeaf}>
          Remove reply
        </FixtureButton>
      </Toolbar>
      <CommentThread {...args} value={value} now={now} />
    </>
  );
}

const Toolbar = styled.div({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2], marginBlockEnd: vars.space[4] });

const FixtureButton = styled.button({
  boxSizing: 'border-box',
  minBlockSize: vars.space[8],
  minInlineSize: vars.space[8],
  paddingInline: vars.space[3],
  color: vars.color.text,
  backgroundColor: vars.color.surface,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
  font: 'inherit',
});

const Frame = styled.div({ inlineSize: `min(36rem, calc(100vw - 2 * ${vars.space[4]}))`, maxInlineSize: '100%' });

const Stack = styled.div({ display: 'grid', gap: vars.space[6] });

const NarrowFrame = styled.div({ inlineSize: '20rem', maxInlineSize: '100%' });

const meta = {
  title: 'Data display/CommentThread',
  component: CommentThread,
  tags: ['autodocs'],
  args: {
    defaultValue: COMMENTS,
    currentUser: ADA,
    now: NOW,
    locale: LOCALE,
    title: 'Review',
    getNewId: fn(nextId),
    onValueChange: fn(),
    onResolvedValueChange: fn(),
    onExpandedValueChange: fn(),
  },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  parameters: {
    layout: 'padded',
    docs: {
      source: { code: usage },
      description: {
        component: 'Comment on a document, reply to people, and mention them with @. Edit, delete, react to, or resolve a discussion.',
      },
      usage: `### Comments and state
- Bodies are plain text. A named region contains a card and native lists of articles named by author and time.
- \`value/defaultValue\` holds an immutable tree. \`onValueChange(next, event)\` receives the full proposed tree and a \`reply/edit/delete/react\` event.
- Keep persistence and authorization on the server. \`currentUser\` only controls which actions are shown.
- A submitted draft clears when the new comment or edit appears in \`value\`. Rejected requests keep the text; edit it or Cancel to retry.
- Deleting a comment with replies keeps its id, author, time, and replies as a tombstone, without body or reactions. A comment without replies is removed.
- \`resolvedValue\` and \`expandedValue\` are independently controlled. Resolving hides the thread, keeps drafts mounted, and shows a summary with Reopen.

### Reply depth
- \`maxDepth\` defaults to 2 and counts reply edges below a root comment.
- A deeper reply attaches to its ancestor at depth \`maxDepth - 1\`. \`maxDepth={0}\` adds root comments.
- Deeper trees you supply keep their structure; indentation is capped.

### Times and labels
- \`createdAt\` accepts epoch milliseconds, a Date, or an ISO date-time with an offset.
- Relative times use \`now\` and Intl.RelativeTimeFormat. The full date in \`timeZone\` is the description. Update \`now\` yourself; the component runs no clock.
- Counts and names use Intl.NumberFormat, PluralRules, and ListFormat. Supply visible words through \`labels\`.

### Keyboard
- Tab follows DOM order. Ctrl/Cmd+Enter submits once, except during IME composition, while disabled, or while a submit is pending.
- Escape closes the innermost suggestions, reaction picker, or delete confirmation first. The next Escape cancels an edit or reply.
- Suggestions: Up/Down wrap, Home/End jump, Enter/Tab insert \`@Name\`.
- Reaction picker: Left/Right wrap and reverse in RTL; Home/End jump.`,
    },
  },
} satisfies Meta<typeof CommentThread>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(CommentThread.displayName).toBe('CommentThread');
    const region = canvas.getByRole('region', { name: 'Review' });
    await expect(canvasElement.ownerDocument.documentElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.ownerDocument.documentElement.clientWidth + GEOMETRY_TOLERANCE,
    );
    await expect(region.tagName).toBe('SECTION');
    await expect(region).toHaveAttribute('data-ui', 'comment-thread');
    await expect(canvas.getByRole('heading', { level: 3, name: 'Review' })).toBeVisible();
    await expect(part(region, 'count')).toHaveTextContent('4 comments, 3 people');
    await expect(itemIds(canvasElement)).toEqual(['c1', 'c1r1', 'c1r1r1', 'c2']);
    // Native lists with explicit list semantics; every item holds a named article.
    const lists = canvas.getAllByRole('list');
    await expect(lists.map((list) => list.tagName)).toEqual(['UL', 'UL', 'UL']);
    await expect(canvas.getAllByRole('article')).toHaveLength(4);
    const first = articleOf(canvasElement, 'c1');
    await expect(first).toHaveAccessibleName(`Grace Hopper ${relative.format(-3, 'hour')}`);
    const time = first.querySelector('time')!;
    await expect(time).toHaveAttribute('datetime', new Date(NOW - 3 * HOUR).toISOString());
    await expect(first).toHaveAccessibleDescription(fullDate('UTC').format(NOW - 3 * HOUR));
    await expect(articleOf(canvasElement, 'c2').querySelector('time')).toHaveTextContent(relative.format(-5, 'minute'));
    await expect(articleOf(canvasElement, 'c1r1')).toHaveTextContent('Edited');
    // Replies start expanded and are wired as disclosures.
    const toggle = toggleOf(canvasElement, 'c1')!;
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toHaveAccessibleName(`Hide replies Grace Hopper ${relative.format(-3, 'hour')}`);
    await expect(action(canvasElement, 'c1', 'reply')).toHaveAccessibleName(`Reply Grace Hopper ${relative.format(-3, 'hour')}`);
    await expect(action(canvasElement, 'c2', 'edit')).toHaveAccessibleName(`Edit Ada Lovelace ${relative.format(-5, 'minute')}`);
    await expect(action(canvasElement, 'c2', 'delete')).toHaveAccessibleName(`Delete Ada Lovelace ${relative.format(-5, 'minute')}`);
    await expect(canvasElement.ownerDocument.getElementById(toggle.getAttribute('aria-controls')!)).toBeVisible();
    await expect(canvas.getByRole('textbox', { name: 'Add a comment' })).toHaveAttribute('placeholder', 'Write a comment');
    await expect(canvas.getByRole('button', { name: 'Resolve' })).toBeEnabled();
    await expect(part(region, 'status')).toHaveTextContent('');
    // Every control keeps the 32px main-axis minimum.
    for (const button of canvas.getAllByRole('button'))
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(MIN_CONTROL - 0.5);
  },
};

export const Sizes: Story = {
  render: (args) => (
    <Stack>
      <CommentThread {...args} size="sm" title="Compact" />
      <CommentThread {...args} size="md" title="Regular" />
    </Stack>
  ),
  play: async ({ canvas }) => {
    const compact = canvas.getByRole('region', { name: 'Compact' });
    const regular = canvas.getByRole('region', { name: 'Regular' });
    for (const root of [compact, regular]) {
      for (const button of within(root).getAllByRole('button'))
        await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(MIN_CONTROL - 0.5);
    }
    const avatar = (root: HTMLElement) => root.querySelector('article [data-ui="avatar"]')!.getBoundingClientRect().width;
    await expect(avatar(compact)).toBeLessThan(avatar(regular));
    const gap = (root: HTMLElement) => Number.parseFloat(getComputedStyle(part(root, 'list')!).rowGap);
    await expect(gap(compact)).toBeLessThan(gap(regular));
  },
};

export const NestedReplies: Story = {
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    // maxDepth 2: a reply to the depth-2 comment attaches to its depth-1 parent.
    const reply = action(canvasElement, 'c1r1r1', 'reply')!;
    await userEvent.click(reply);
    const replyField = field(canvasElement, 'reply');
    await expect(activeOf(canvasElement)).toBe(replyField);
    await expect(replyField).toHaveAccessibleName('Reply to Alan Turing');
    await userEvent.type(replyField, '  Will do.  ');
    await userEvent.keyboard(sendKeys);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.getNewId).toHaveBeenCalledTimes(1);
    const id = lastNewId(args.getNewId);
    const event = lastEvent(args.onValueChange);
    await expect(event).toEqual({
      type: 'reply',
      parentId: 'c1r1',
      comment: { id, author: ADA, body: 'Will do.', createdAt: NOW, reactions: [] },
    });
    // The proposal is a new tree; the caller's tree is untouched.
    await expect(lastTree(args.onValueChange)).not.toBe(COMMENTS);
    await expect(COMMENTS[0]!.replies![0]!.replies).toHaveLength(1);
    await expect(childIds(canvasElement, 'c1r1')).toEqual(['c1r1r1', id]);
    await expect(field(canvasElement, 'reply')).toBeNull();
    // The accepted reply returns focus to the Reply button that opened it; own comments are not announced.
    await expect(activeOf(canvasElement)).toBe(reply);
    await expect(part(canvas.getByRole('region'), 'status')).toHaveTextContent('');
  },
};

export const ReplyComposer: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const reply = action(canvasElement, 'c1r1r1', 'reply')!;
    await userEvent.click(reply);
    const composer = field(canvasElement, 'reply');
    await expect(composer).toHaveFocus();
    await userEvent.type(composer, 'Checking the narrow layout.');
    await userEvent.keyboard('{Escape}');
    await expect(reply).toHaveFocus();
    await expect(field(canvasElement, 'reply')).toBeNull();
    await userEvent.click(reply);
    const region = canvas.getByRole('region');
    const bounds = region.getBoundingClientRect();
    for (const control of [field(canvasElement, 'reply'), submitOf(canvasElement, 'reply')]) {
      const rect = control.getBoundingClientRect();
      await expect(rect.left).toBeGreaterThanOrEqual(bounds.left - GEOMETRY_TOLERANCE);
      await expect(rect.right).toBeLessThanOrEqual(bounds.right + GEOMETRY_TOLERANCE);
      await expect(rect.height).toBeGreaterThanOrEqual(MIN_CONTROL - GEOMETRY_TOLERANCE);
    }
  },
};

export const MaxDepthZero: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CommentThread, type ThreadComment, type CommentAuthor } from '@jfrader/ui';

const GRACE: CommentAuthor = { id: 'grace', name: 'Grace Hopper' };

const NOW = Date.parse('2026-10-11T12:00:00Z');

const MINUTE = 60000;

const HOUR = 60 * MINUTE;

const ADA: CommentAuthor = { id: 'ada', name: 'Ada Lovelace' };

const ALAN: CommentAuthor = { id: 'alan', name: 'Alan Turing' };

const COMMENTS: readonly ThreadComment[] = Object.freeze([
  {
    id: 'c1',
    author: GRACE,
    body: 'Can we tighten the header spacing?',
    createdAt: NOW - 3 * HOUR,
    reactions: [{ emoji: '👍', users: ['ada', 'alan'] }],
    replies: [
      {
        id: 'c1r1',
        author: ADA,
        body: 'Yes, dropping it to 16px.',
        createdAt: new Date(NOW - 2 * HOUR),
        edited: true,
        replies: [
          {
            id: 'c1r1r1',
            author: ALAN,
            body: 'Check the narrow layout too.',
            createdAt: NOW - 90 * MINUTE,
          },
        ],
      },
    ],
  },
  {
    id: 'c2',
    author: ADA,
    body: 'Shipped the new icons.',
    createdAt: '2026-10-11T11:55:00Z',
    reactions: [{ emoji: '🎉', users: ['grace'] }],
  },
] satisfies ThreadComment[]);

const LOCALE = 'en-US';

export function Example() {
  return (
    <CommentThread
      defaultValue={COMMENTS}
      currentUser={ADA}
      now={NOW}
      locale={LOCALE}
      title="Review"
      maxDepth={0}
    />
  );
}`,
      },
    },
  },
  args: { maxDepth: 0 },
  play: async ({ args, canvasElement, userEvent }) => {
    await userEvent.click(action(canvasElement, 'c1r1', 'reply')!);
    await userEvent.type(field(canvasElement, 'reply'), 'Flat');
    await userEvent.click(submitOf(canvasElement, 'reply'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(lastEvent(args.onValueChange)).toMatchObject({ type: 'reply', parentId: null });
    await expect(lastTree(args.onValueChange).map((comment) => comment.id)).toEqual([
      'c1',
      'c2',
      lastNewId(args.getNewId),
    ]);
    // Existing deeper replies are still shown as given.
    await expect(itemIds(canvasElement)).toContain('c1r1r1');
  },
};

/** A chain six comments deep: `deep-0` → `deep-1` → … → `deep-5`. */
const DEEP_IDS = Array.from({ length: 6 }, (_, depth) => `deep-${depth}`);
const DEEP_CHAIN = DEEP_IDS.reduceRight<ThreadComment[]>(
  (replies, id, depth) => [
    { id, author: depth % 2 ? GRACE : ALAN, body: `Level ${depth}`, createdAt: NOW - HOUR, replies },
  ],
  [],
);

export const DeepNesting: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CommentThread, type ThreadComment, type CommentAuthor } from '@jfrader/ui';

const DEEP_IDS = Array.from({ length: 6 }, (_, depth) => \`deep-\${depth}\`);

const GRACE: CommentAuthor = { id: 'grace', name: 'Grace Hopper' };

const ALAN: CommentAuthor = { id: 'alan', name: 'Alan Turing' };

const NOW = Date.parse('2026-10-11T12:00:00Z');

const MINUTE = 60000;

const HOUR = 60 * MINUTE;

const DEEP_CHAIN = DEEP_IDS.reduceRight<ThreadComment[]>(
  (replies, id, depth) => [
    {
      id,
      author: depth % 2 ? GRACE : ALAN,
      body: \`Level \${depth}\`,
      createdAt: NOW - HOUR,
      replies,
    },
  ],
  [],
);

const ADA: CommentAuthor = { id: 'ada', name: 'Ada Lovelace' };

const LOCALE = 'en-US';

export function Example() {
  return (
    <CommentThread
      defaultValue={DEEP_CHAIN}
      currentUser={ADA}
      now={NOW}
      locale={LOCALE}
      title="Review"
    />
  );
}`,
      },
    },
  },
  args: { defaultValue: DEEP_CHAIN },
  play: async ({ canvas, canvasElement }) => {
    // Trees deeper than maxDepth are shown as given.
    await expect(itemIds(canvasElement)).toEqual(DEEP_IDS);
    const repliesOf = (id: string) => item(canvasElement, id).querySelector<HTMLElement>(':scope > ul')!;
    const indent = (id: string) => getComputedStyle(repliesOf(id)).paddingInlineStart;
    // Reply lists under depths 0-2 indent; from depth 3 on they stop indenting but stay lists.
    for (const depth of [0, 1, 2]) {
      await expect(repliesOf(`deep-${depth}`)).not.toHaveAttribute('data-capped');
      await expect(Number.parseFloat(indent(`deep-${depth}`))).toBeGreaterThan(0);
    }
    for (const depth of [3, 4]) {
      const list = repliesOf(`deep-${depth}`);
      await expect(list).toHaveAttribute('data-capped');
      await expect(list).toHaveAttribute('role', 'list');
      await expect(indent(`deep-${depth}`)).toBe('0px');
      await expect(getComputedStyle(list).borderInlineStartStyle).toBe('none');
    }
    const left = (id: string) => articleOf(canvasElement, id).getBoundingClientRect().left;
    await expect(left('deep-3')).toBeGreaterThan(left('deep-2'));
    await expect(Math.abs(left('deep-5') - left('deep-3'))).toBeLessThan(GEOMETRY_TOLERANCE);
    const region = canvas.getByRole('region');
    await expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth + GEOMETRY_TOLERANCE);
    const bounds = region.getBoundingClientRect();
    for (const id of DEEP_IDS) {
      const article = articleOf(canvasElement, id).getBoundingClientRect();
      await expect(article.left).toBeGreaterThanOrEqual(bounds.left - GEOMETRY_TOLERANCE);
      await expect(article.right).toBeLessThanOrEqual(bounds.right + GEOMETRY_TOLERANCE);
    }
  },
};

export const CollapsedReplies: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CommentThread, type ThreadComment, type CommentAuthor } from '@jfrader/ui';

const GRACE: CommentAuthor = { id: 'grace', name: 'Grace Hopper' };

const NOW = Date.parse('2026-10-11T12:00:00Z');

const MINUTE = 60000;

const HOUR = 60 * MINUTE;

const ADA: CommentAuthor = { id: 'ada', name: 'Ada Lovelace' };

const ALAN: CommentAuthor = { id: 'alan', name: 'Alan Turing' };

const COMMENTS: readonly ThreadComment[] = Object.freeze([
  {
    id: 'c1',
    author: GRACE,
    body: 'Can we tighten the header spacing?',
    createdAt: NOW - 3 * HOUR,
    reactions: [{ emoji: '👍', users: ['ada', 'alan'] }],
    replies: [
      {
        id: 'c1r1',
        author: ADA,
        body: 'Yes, dropping it to 16px.',
        createdAt: new Date(NOW - 2 * HOUR),
        edited: true,
        replies: [
          {
            id: 'c1r1r1',
            author: ALAN,
            body: 'Check the narrow layout too.',
            createdAt: NOW - 90 * MINUTE,
          },
        ],
      },
    ],
  },
  {
    id: 'c2',
    author: ADA,
    body: 'Shipped the new icons.',
    createdAt: '2026-10-11T11:55:00Z',
    reactions: [{ emoji: '🎉', users: ['grace'] }],
  },
] satisfies ThreadComment[]);

const LOCALE = 'en-US';

export function Example() {
  return (
    <CommentThread
      defaultValue={COMMENTS}
      currentUser={ADA}
      now={NOW}
      locale={LOCALE}
      title="Review"
      defaultExpandedValue={[]}
    />
  );
}`,
      },
    },
  },
  args: { defaultExpandedValue: [] },
  play: async ({ args, canvasElement, userEvent }) => {
    const toggle = toggleOf(canvasElement, 'c1')!;
    const list = canvasElement.ownerDocument.getElementById(toggle.getAttribute('aria-controls')!)!;
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveAccessibleName(`Show 1 reply Grace Hopper ${relative.format(-3, 'hour')}`);
    await expect(list).not.toBeVisible();
    // Collapsed replies stay in the DOM as a structural list.
    await expect(list).toHaveAttribute('role', 'list');
    toggle.focus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onExpandedValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onExpandedValueChange).toHaveBeenLastCalledWith(['c1']);
    await expect(list).toBeVisible();
    // The nested disclosure keeps its own state.
    await expect(toggleOf(canvasElement, 'c1r1')).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard(' ');
    await expect(args.onExpandedValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onExpandedValueChange).toHaveBeenLastCalledWith([]);
    await expect(list).not.toBeVisible();
    await expectFocusRing(toggle);
  },
};

export const OwnAndOther: Story = {
  play: async ({ canvasElement }) => {
    for (const id of ['c1r1', 'c2']) {
      const time = id === 'c1r1' ? relative.format(-2, 'hour') : relative.format(-5, 'minute');
      await expect(action(canvasElement, id, 'edit')).toHaveAccessibleName(`Edit Ada Lovelace ${time}`);
      await expect(action(canvasElement, id, 'delete')).toHaveAccessibleName(`Delete Ada Lovelace ${time}`);
    }
    for (const id of ['c1', 'c1r1r1']) {
      await expect(action(canvasElement, id, 'edit')).toBeNull();
      await expect(action(canvasElement, id, 'delete')).toBeNull();
    }
    for (const id of ['c1', 'c1r1', 'c1r1r1', 'c2']) await expect(action(canvasElement, id, 'reply')).toBeVisible();
  },
};

export const Editing: Story = {
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const edit = action(canvasElement, 'c2', 'edit')!;
    await userEvent.click(edit);
    const editor = canvas.getByRole('textbox', { name: 'Edit comment' });
    await expect(activeOf(canvasElement)).toBe(editor);
    await expect(editor).toHaveValue('Shipped the new icons.');
    // Unchanged and empty saves emit nothing; unchanged closes the editor.
    await userEvent.keyboard(sendKeys);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await expect(activeOf(canvasElement)).toBe(action(canvasElement, 'c2', 'edit'));
    await userEvent.click(action(canvasElement, 'c2', 'edit')!);
    await userEvent.clear(field(canvasElement, 'edit'));
    await userEvent.type(field(canvasElement, 'edit'), '   ');
    await userEvent.keyboard(sendKeys);
    await expect(submitOf(canvasElement, 'edit')).toHaveAttribute('aria-disabled', 'true');
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await userEvent.clear(field(canvasElement, 'edit'));
    await userEvent.type(field(canvasElement, 'edit'), 'Shipped the new icon set.');
    await userEvent.click(submitOf(canvasElement, 'edit'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(lastEvent(args.onValueChange)).toEqual({ type: 'edit', id: 'c2', body: 'Shipped the new icon set.' });
    await expect(lastTree(args.onValueChange)[1]).toMatchObject({ body: 'Shipped the new icon set.', edited: true });
    await expect(part(item(canvasElement, 'c2'), 'body')).toHaveTextContent('Shipped the new icon set.');
    await expect(activeOf(canvasElement)).toBe(action(canvasElement, 'c2', 'edit'));
    // Escape cancels a reopened edit without an event; the editor is left open for the axe gate.
    await userEvent.click(action(canvasElement, 'c2', 'edit')!);
    await userEvent.type(field(canvasElement, 'edit'), ' Draft');
    await userEvent.keyboard('{Escape}');
    await expect(field(canvasElement, 'edit')).toBeNull();
    await expect(activeOf(canvasElement)).toBe(action(canvasElement, 'c2', 'edit'));
    await userEvent.click(action(canvasElement, 'c2', 'edit')!);
    await expect(field(canvasElement, 'edit')).toHaveValue('Shipped the new icon set.');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const DeleteConfirmation: Story = {
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(action(canvasElement, 'c2', 'delete')!);
    const group = canvas.getByRole('group', { name: 'Delete this comment?' });
    // The safe choice is focused first.
    await expect(activeOf(canvasElement)).toBe(within(group).getByRole('button', { name: 'Cancel' }));
    await userEvent.keyboard('{Escape}');
    await expect(canvas.queryByRole('group', { name: 'Delete this comment?' })).toBeNull();
    await expect(activeOf(canvasElement)).toBe(action(canvasElement, 'c2', 'delete'));
    await userEvent.keyboard('{Enter}');
    await userEvent.click(within(canvas.getByRole('group', { name: 'Delete this comment?' })).getByRole('button', { name: 'Cancel' }));
    await expect(activeOf(canvasElement)).toBe(action(canvasElement, 'c2', 'delete'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    // Left open for the axe gate.
    await userEvent.click(action(canvasElement, 'c2', 'delete')!);
    await expect(canvas.getByRole('group', { name: 'Delete this comment?' })).toBeVisible();
  },
};

export const DeleteLeaf: Story = {
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(action(canvasElement, 'c2', 'delete')!);
    await userEvent.click(within(canvas.getByRole('group')).getByRole('button', { name: /^Delete Ada Lovelace/ }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(lastEvent(args.onValueChange)).toEqual({ type: 'delete', id: 'c2' });
    await expect(itemIds(canvasElement)).toEqual(['c1', 'c1r1', 'c1r1r1']);
    // Focus continues on the nearest surviving comment.
    await expect(activeOf(canvasElement)).toBe(action(canvasElement, 'c1r1r1', 'reply'));
  },
};

export const DeletedParent: Story = {
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(action(canvasElement, 'c1r1', 'delete')!);
    await userEvent.click(within(canvas.getByRole('group')).getByRole('button', { name: /^Delete Ada Lovelace/ }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    const tombstone = lastTree(args.onValueChange)[0]!.replies![0]!;
    await expect(tombstone).toMatchObject({ id: 'c1r1', author: ADA, deleted: true, body: '', reactions: [] });
    await expect(tombstone.replies!.map((reply) => reply.id)).toEqual(['c1r1r1']);
    const article = articleOf(canvasElement, 'c1r1');
    await expect(article).toHaveAccessibleName('Deleted comment');
    await expect(part(item(canvasElement, 'c1r1'), 'body')).toHaveTextContent('This comment was deleted.');
    await expect(article.querySelector('[data-action]')).toBeNull();
    await expect(childIds(canvasElement, 'c1r1')).toEqual(['c1r1r1']);
    await expect(part(canvas.getByRole('region'), 'count')).toHaveTextContent('3 comments, 3 people');
    // The tombstone's own disclosure takes focus.
    await expect(activeOf(canvasElement)).toBe(toggleOf(canvasElement, 'c1r1'));
  },
};

export const Reactions: Story = {
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const chip = within(articleOf(canvasElement, 'c1')).getByRole('button', { name: '👍 2 reactions, including you' });
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    const other = within(articleOf(canvasElement, 'c2')).getByRole('button', { name: '🎉 1 reaction' });
    await expect(other).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(chip);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(lastEvent(args.onValueChange)).toEqual({ type: 'react', id: 'c1', emoji: '👍', added: false });
    await expect(lastTree(args.onValueChange)[0]!.reactions).toEqual([{ emoji: '👍', users: ['alan'] }]);
    await expect(chip).toHaveAccessibleName('👍 1 reaction');
    await expect(chip).toHaveAttribute('aria-pressed', 'false');

    const add = action(canvasElement, 'c1', 'react')!;
    await userEvent.click(add);
    await expect(add).toHaveAttribute('aria-expanded', 'true');
    const picker = canvas.getByRole('group', { name: 'Reactions' });
    await expect(add).toHaveAttribute('aria-controls', picker.id);
    const emoji = within(picker).getAllByRole('button').slice(0, -1);
    await expect(emoji.map((button) => button.getAttribute('aria-label'))).toEqual(
      ['👍', '❤️', '🎉', '👀', '🚀', '✅'].map((symbol) => `React with ${symbol}`),
    );
    await expect(activeOf(canvasElement)).toBe(emoji[0]);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(activeOf(canvasElement)).toBe(emoji.at(-1));
    await userEvent.keyboard('{ArrowRight}');
    await expect(activeOf(canvasElement)).toBe(emoji[0]);
    await userEvent.keyboard('{End}');
    await expect(activeOf(canvasElement)).toBe(emoji.at(-1));
    await userEvent.keyboard('{Home}{ArrowRight}{ArrowRight}');
    await expectFocusRing(emoji[2]!);
    // Only the focused emoji is a tab stop.
    await expect(emoji.filter((button) => button.tabIndex === 0)).toEqual([emoji[2]]);
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(lastEvent(args.onValueChange)).toEqual({ type: 'react', id: 'c1', emoji: '🎉', added: true });
    await expect(canvas.queryByRole('group', { name: 'Reactions' })).toBeNull();
    await expect(activeOf(canvasElement)).toBe(add);
    // Escape closes without reacting; pressing outside leaves it open.
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Escape}');
    await expect(activeOf(canvasElement)).toBe(add);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.click(add);
    await userEvent.click(part(canvasElement, 'count')!);
    await expect(canvas.getByRole('group', { name: 'Reactions' })).toBeVisible();
  },
};

export const NoReactionPicker: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CommentThread, type ThreadComment, type CommentAuthor } from '@jfrader/ui';

const GRACE: CommentAuthor = { id: 'grace', name: 'Grace Hopper' };

const NOW = Date.parse('2026-10-11T12:00:00Z');

const MINUTE = 60000;

const HOUR = 60 * MINUTE;

const ADA: CommentAuthor = { id: 'ada', name: 'Ada Lovelace' };

const ALAN: CommentAuthor = { id: 'alan', name: 'Alan Turing' };

const COMMENTS: readonly ThreadComment[] = Object.freeze([
  {
    id: 'c1',
    author: GRACE,
    body: 'Can we tighten the header spacing?',
    createdAt: NOW - 3 * HOUR,
    reactions: [{ emoji: '👍', users: ['ada', 'alan'] }],
    replies: [
      {
        id: 'c1r1',
        author: ADA,
        body: 'Yes, dropping it to 16px.',
        createdAt: new Date(NOW - 2 * HOUR),
        edited: true,
        replies: [
          {
            id: 'c1r1r1',
            author: ALAN,
            body: 'Check the narrow layout too.',
            createdAt: NOW - 90 * MINUTE,
          },
        ],
      },
    ],
  },
  {
    id: 'c2',
    author: ADA,
    body: 'Shipped the new icons.',
    createdAt: '2026-10-11T11:55:00Z',
    reactions: [{ emoji: '🎉', users: ['grace'] }],
  },
] satisfies ThreadComment[]);

const LOCALE = 'en-US';

export function Example() {
  return (
    <CommentThread
      defaultValue={COMMENTS}
      currentUser={ADA}
      now={NOW}
      locale={LOCALE}
      title="Review"
      reactions={[]}
    />
  );
}`,
      },
    },
  },
  args: { reactions: [] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-action="react"]')).toBeNull();
    // Existing reactions still show and toggle.
    await expect(within(articleOf(canvasElement, 'c1')).getByRole('button', { name: /^👍/ })).toBeVisible();
  },
};

export const MentionSuggestions: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const textbox = field(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await expect(textbox).toHaveAttribute('aria-autocomplete', 'list');
    await userEvent.click(textbox);
    await userEvent.type(textbox, 'email@example');
    // `@` inside a word is not a mention.
    await expect(page.queryByRole('listbox')).toBeNull();
    await userEvent.clear(textbox);
    await userEvent.type(textbox, 'Thanks @a');
    const listbox = await page.findByRole('listbox', { name: 'People' });
    const options = within(listbox).getAllByRole('option');
    await expect(options).toHaveLength(2);
    await expect(options[0]).toHaveAccessibleName('Ada Lovelace');
    await expect(options[1]).toHaveAccessibleName('Alan Turing');
    await expect(textbox).toHaveAttribute('aria-controls', listbox.id);
    await expect(textbox).toHaveAttribute('aria-activedescendant', options[0]!.id);
    await expect(options[0]).toHaveAttribute('aria-selected', 'true');
    // DOM focus stays in the field while the active option moves.
    await userEvent.keyboard('{ArrowDown}');
    await expect(textbox).toHaveAttribute('aria-activedescendant', options[1]!.id);
    await userEvent.keyboard('{ArrowDown}');
    await expect(textbox).toHaveAttribute('aria-activedescendant', options[0]!.id);
    await userEvent.keyboard('{ArrowUp}');
    await expect(textbox).toHaveAttribute('aria-activedescendant', options[1]!.id);
    await userEvent.keyboard('{Home}');
    await expect(textbox).toHaveAttribute('aria-activedescendant', options[0]!.id);
    await userEvent.keyboard('{End}');
    await expect(activeOf(canvasElement)).toBe(textbox);
    await userEvent.keyboard('{Tab}');
    await expect(textbox).toHaveValue('Thanks @Alan Turing ');
    await expect(textbox.selectionStart).toBe('Thanks @Alan Turing '.length);
    await expect(activeOf(canvasElement)).toBe(textbox);
    await expect(page.queryByRole('listbox')).toBeNull();
    await expect(textbox).not.toHaveAttribute('aria-activedescendant');
    // A query without matches leaves an ordinary field: Enter types a newline.
    await userEvent.type(textbox, '@zz{Enter}');
    await expect(textbox).toHaveValue('Thanks @Alan Turing @zz\n');
    // Left open for the axe gate.
    await userEvent.type(textbox, '@gr');
    await expect(await page.findByRole('option', { name: 'Grace Hopper' })).toBeVisible();
  },
};

export const KeyboardFlow: Story = {
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    // Escape layering in a reply: suggestions first, then the reply itself.
    await userEvent.click(action(canvasElement, 'c2', 'reply')!);
    await userEvent.type(field(canvasElement, 'reply'), '@gr');
    await page.findByRole('listbox');
    await userEvent.keyboard('{Escape}');
    await expect(page.queryByRole('listbox')).toBeNull();
    await expect(field(canvasElement, 'reply')).toHaveValue('@gr');
    await userEvent.keyboard('{Escape}');
    await expect(field(canvasElement, 'reply')).toBeNull();
    await expect(activeOf(canvasElement)).toBe(action(canvasElement, 'c2', 'reply'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);

    // Mention insertion with Enter, then Ctrl+Enter sends exactly once.
    const textbox = field(canvasElement);
    await userEvent.click(textbox);
    await userEvent.type(textbox, 'Ping @gr');
    await page.findByRole('listbox');
    await userEvent.keyboard('{Enter}');
    await expect(textbox).toHaveValue('Ping @Grace Hopper ');
    await userEvent.keyboard('{Escape}');
    await expect(textbox).toHaveValue('Ping @Grace Hopper ');
    await userEvent.keyboard(sendKeys);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(lastEvent(args.onValueChange)).toMatchObject({
      type: 'reply',
      parentId: null,
      comment: { body: 'Ping @Grace Hopper', author: ADA },
    });
    await expect(textbox).toHaveValue('');
    await expect(activeOf(canvasElement)).toBe(textbox);
    await userEvent.keyboard(sendKeys);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);

    // Accepted resolve moves focus to Reopen; reopen moves it back to Resolve.
    const resolve = canvas.getByRole('button', { name: 'Resolve' });
    resolve.focus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onResolvedValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onResolvedValueChange).toHaveBeenLastCalledWith(true);
    const reopen = canvas.getByRole('button', { name: 'Reopen' });
    await expectFocusRing(reopen);
    await expect(part(canvasElement, 'content')).not.toBeVisible();
    await userEvent.keyboard(' ');
    await expect(args.onResolvedValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onResolvedValueChange).toHaveBeenLastCalledWith(false);
    await expectFocusRing(canvas.getByRole('button', { name: 'Resolve' }));
  },
};

export const RejectedResolve: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CommentThread, type ThreadComment, type CommentAuthor } from '@jfrader/ui';

const GRACE: CommentAuthor = { id: 'grace', name: 'Grace Hopper' };

const NOW = Date.parse('2026-10-11T12:00:00Z');

const MINUTE = 60000;

const HOUR = 60 * MINUTE;

const ADA: CommentAuthor = { id: 'ada', name: 'Ada Lovelace' };

const ALAN: CommentAuthor = { id: 'alan', name: 'Alan Turing' };

const COMMENTS: readonly ThreadComment[] = Object.freeze([
  {
    id: 'c1',
    author: GRACE,
    body: 'Can we tighten the header spacing?',
    createdAt: NOW - 3 * HOUR,
    reactions: [{ emoji: '👍', users: ['ada', 'alan'] }],
    replies: [
      {
        id: 'c1r1',
        author: ADA,
        body: 'Yes, dropping it to 16px.',
        createdAt: new Date(NOW - 2 * HOUR),
        edited: true,
        replies: [
          {
            id: 'c1r1r1',
            author: ALAN,
            body: 'Check the narrow layout too.',
            createdAt: NOW - 90 * MINUTE,
          },
        ],
      },
    ],
  },
  {
    id: 'c2',
    author: ADA,
    body: 'Shipped the new icons.',
    createdAt: '2026-10-11T11:55:00Z',
    reactions: [{ emoji: '🎉', users: ['grace'] }],
  },
] satisfies ThreadComment[]);

const LOCALE = 'en-US';

export function Example() {
  return (
    <CommentThread
      defaultValue={COMMENTS}
      currentUser={ADA}
      now={NOW}
      locale={LOCALE}
      title="Review"
      resolvedValue={false}
    />
  );
}`,
      },
    },
  },
  args: { resolvedValue: false },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const resolve = canvas.getByRole('button', { name: 'Resolve' });
    await userEvent.click(resolve);
    await expect(args.onResolvedValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onResolvedValueChange).toHaveBeenLastCalledWith(true);
    await expect(part(canvasElement, 'content')).toBeVisible();
    await expect(activeOf(canvasElement)).toBe(resolve);
    await expect(canvas.queryByRole('button', { name: 'Reopen' })).toBeNull();
    // Repeating a rejected request does not re-send it.
    await userEvent.dblClick(resolve);
    await expect(args.onResolvedValueChange).toHaveBeenCalledTimes(1);
    await expect(part(canvasElement, 'content')).toBeVisible();
    await expect(activeOf(canvasElement)).toBe(resolve);
  },
};

export const Resolved: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CommentThread, type ThreadComment, type CommentAuthor } from '@jfrader/ui';

const GRACE: CommentAuthor = { id: 'grace', name: 'Grace Hopper' };

const NOW = Date.parse('2026-10-11T12:00:00Z');

const MINUTE = 60000;

const HOUR = 60 * MINUTE;

const ADA: CommentAuthor = { id: 'ada', name: 'Ada Lovelace' };

const ALAN: CommentAuthor = { id: 'alan', name: 'Alan Turing' };

const COMMENTS: readonly ThreadComment[] = Object.freeze([
  {
    id: 'c1',
    author: GRACE,
    body: 'Can we tighten the header spacing?',
    createdAt: NOW - 3 * HOUR,
    reactions: [{ emoji: '👍', users: ['ada', 'alan'] }],
    replies: [
      {
        id: 'c1r1',
        author: ADA,
        body: 'Yes, dropping it to 16px.',
        createdAt: new Date(NOW - 2 * HOUR),
        edited: true,
        replies: [
          {
            id: 'c1r1r1',
            author: ALAN,
            body: 'Check the narrow layout too.',
            createdAt: NOW - 90 * MINUTE,
          },
        ],
      },
    ],
  },
  {
    id: 'c2',
    author: ADA,
    body: 'Shipped the new icons.',
    createdAt: '2026-10-11T11:55:00Z',
    reactions: [{ emoji: '🎉', users: ['grace'] }],
  },
] satisfies ThreadComment[]);

const LOCALE = 'en-US';

export function Example() {
  return (
    <CommentThread
      defaultValue={COMMENTS}
      currentUser={ADA}
      now={NOW}
      locale={LOCALE}
      title="Review"
      defaultResolvedValue
    />
  );
}`,
      },
    },
  },
  args: { defaultResolvedValue: true },
  play: async ({ canvas, canvasElement }) => {
    const summary = part(canvasElement, 'resolved')!;
    await expect(summary).toHaveTextContent('Resolved');
    await expect(summary).toHaveTextContent('4 comments');
    await expect(summary).toHaveTextContent(
      new Intl.ListFormat(LOCALE, { type: 'conjunction' }).format(['Grace Hopper', 'Ada Lovelace', 'Alan Turing']),
    );
    await expect(canvas.getByRole('button', { name: 'Reopen' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Resolve' })).toBeNull();
    // The thread and its composer stay mounted but hidden.
    await expect(part(canvasElement, 'content')).not.toBeVisible();
    await expect(field(canvasElement)).not.toBeVisible();
    await expect(canvas.queryAllByRole('article')).toHaveLength(0);
  },
};

export const ResolvedKeepsDraft: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.type(field(canvasElement), 'Half-written');
    await userEvent.click(canvas.getByRole('button', { name: 'Resolve' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Reopen' }));
    await expect(field(canvasElement)).toHaveValue('Half-written');
  },
};

export const Empty: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CommentThread, type CommentAuthor } from '@jfrader/ui';

const ADA: CommentAuthor = { id: 'ada', name: 'Ada Lovelace' };

const NOW = Date.parse('2026-10-11T12:00:00Z');

const LOCALE = 'en-US';

export function Example() {
  return (
    <CommentThread defaultValue={[]} currentUser={ADA} now={NOW} locale={LOCALE} title="Review" />
  );
}`,
      },
    },
  },
  args: { defaultValue: [] },
  play: async ({ canvas, canvasElement }) => {
    const region = canvas.getByRole('region', { name: 'Review' });
    await expect(region).toHaveAccessibleDescription('No comments yet');
    await expect(part(region, 'count')).toHaveTextContent('0 comments');
    await expect(canvas.queryByRole('list')).toBeNull();
    await expect(field(canvasElement)).toBeVisible();
  },
};

export const ReadOnly: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CommentThread, type ThreadComment, type CommentAuthor } from '@jfrader/ui';

const GRACE: CommentAuthor = { id: 'grace', name: 'Grace Hopper' };

const NOW = Date.parse('2026-10-11T12:00:00Z');

const MINUTE = 60000;

const HOUR = 60 * MINUTE;

const ADA: CommentAuthor = { id: 'ada', name: 'Ada Lovelace' };

const ALAN: CommentAuthor = { id: 'alan', name: 'Alan Turing' };

const COMMENTS: readonly ThreadComment[] = Object.freeze([
  {
    id: 'c1',
    author: GRACE,
    body: 'Can we tighten the header spacing?',
    createdAt: NOW - 3 * HOUR,
    reactions: [{ emoji: '👍', users: ['ada', 'alan'] }],
    replies: [
      {
        id: 'c1r1',
        author: ADA,
        body: 'Yes, dropping it to 16px.',
        createdAt: new Date(NOW - 2 * HOUR),
        edited: true,
        replies: [
          {
            id: 'c1r1r1',
            author: ALAN,
            body: 'Check the narrow layout too.',
            createdAt: NOW - 90 * MINUTE,
          },
        ],
      },
    ],
  },
  {
    id: 'c2',
    author: ADA,
    body: 'Shipped the new icons.',
    createdAt: '2026-10-11T11:55:00Z',
    reactions: [{ emoji: '🎉', users: ['grace'] }],
  },
] satisfies ThreadComment[]);

const LOCALE = 'en-US';

export function Example() {
  return (
    <CommentThread
      defaultValue={COMMENTS}
      currentUser={ADA}
      now={NOW}
      locale={LOCALE}
      title="Review"
      readOnly
      defaultExpandedValue={[]}
    />
  );
}`,
      },
    },
  },
  args: { readOnly: true, defaultExpandedValue: [] },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await expect(canvasElement.querySelector('[data-action]')).toBeNull();
    await expect(canvasElement.querySelector('[data-composer]')).toBeNull();
    await expect(canvas.queryByRole('textbox')).toBeNull();
    // Reactions read as text; disclosure still works.
    const reaction = articleOf(canvasElement, 'c1').querySelector('[data-part="reaction"]')!;
    await expect(reaction.tagName).toBe('SPAN');
    await expect(reaction).toHaveTextContent('👍 2 reactions, including you');
    await userEvent.click(toggleOf(canvasElement, 'c1')!);
    await expect(args.onExpandedValueChange).toHaveBeenCalledTimes(1);
    await expect(canvas.getAllByRole('article').length).toBeGreaterThan(2);
  },
};

export const Disabled: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CommentThread, type ThreadComment, type CommentAuthor } from '@jfrader/ui';

const GRACE: CommentAuthor = { id: 'grace', name: 'Grace Hopper' };

const NOW = Date.parse('2026-10-11T12:00:00Z');

const MINUTE = 60000;

const HOUR = 60 * MINUTE;

const ADA: CommentAuthor = { id: 'ada', name: 'Ada Lovelace' };

const ALAN: CommentAuthor = { id: 'alan', name: 'Alan Turing' };

const COMMENTS: readonly ThreadComment[] = Object.freeze([
  {
    id: 'c1',
    author: GRACE,
    body: 'Can we tighten the header spacing?',
    createdAt: NOW - 3 * HOUR,
    reactions: [{ emoji: '👍', users: ['ada', 'alan'] }],
    replies: [
      {
        id: 'c1r1',
        author: ADA,
        body: 'Yes, dropping it to 16px.',
        createdAt: new Date(NOW - 2 * HOUR),
        edited: true,
        replies: [
          {
            id: 'c1r1r1',
            author: ALAN,
            body: 'Check the narrow layout too.',
            createdAt: NOW - 90 * MINUTE,
          },
        ],
      },
    ],
  },
  {
    id: 'c2',
    author: ADA,
    body: 'Shipped the new icons.',
    createdAt: '2026-10-11T11:55:00Z',
    reactions: [{ emoji: '🎉', users: ['grace'] }],
  },
] satisfies ThreadComment[]);

const LOCALE = 'en-US';

export function Example() {
  return (
    <CommentThread
      defaultValue={COMMENTS}
      currentUser={ADA}
      now={NOW}
      locale={LOCALE}
      title="Review"
      disabled
    />
  );
}`,
      },
    },
  },
  args: { disabled: true },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await expect(field(canvasElement)).toBeDisabled();
    for (const name of ['reply', 'edit', 'delete', 'react'])
      for (const button of canvasElement.querySelectorAll<HTMLButtonElement>(`[data-action="${name}"]`))
        await expect(button).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Resolve' })).toBeDisabled();
    await expect(within(articleOf(canvasElement, 'c1')).getByRole('button', { name: /^👍/ })).toBeDisabled();
    fireEvent.keyDown(field(canvasElement), { key: 'Enter', ctrlKey: true });
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    // Disclosure is not a mutation.
    await userEvent.click(toggleOf(canvasElement, 'c1')!);
    await expect(args.onExpandedValueChange).toHaveBeenCalledTimes(1);
  },
};

export const Controlled: Story = {
  args: { value: COMMENTS },
  render: (args) => <Accepting {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    await userEvent.type(field(canvasElement), 'Looks good');
    await userEvent.click(submitOf(canvasElement));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    const id = lastNewId(args.getNewId);
    await expect(itemIds(canvasElement).at(-1)).toBe(id);
    await expect(field(canvasElement)).toHaveValue('');
    await userEvent.click(action(canvasElement, id, 'edit')!);
    await userEvent.type(field(canvasElement, 'edit'), '!');
    await userEvent.keyboard(sendKeys);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(part(item(canvasElement, id), 'body')).toHaveTextContent('Looks good!');
  },
};

export const RejectedControlled: Story = {
  args: { value: COMMENTS },
  render: (args) => <Deferred {...args} />,
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const textbox = field(canvasElement);
    const send = submitOf(canvasElement);
    await userEvent.type(textbox, 'Needs approval');
    await userEvent.click(send);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    // The parent has not accepted it: tree and draft stay, and the submit is pending.
    await expect(itemIds(canvasElement)).toEqual(['c1', 'c1r1', 'c1r1r1', 'c2']);
    await expect(textbox).toHaveValue('Needs approval');
    await expect(send).toHaveAttribute('aria-busy', 'true');
    textbox.focus();
    await userEvent.keyboard(sendKeys);
    await userEvent.click(send);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    // Cancel releases the pending submit and keeps the text for a retry.
    await userEvent.click(within(part(canvasElement, 'composer')!).getByRole('button', { name: 'Cancel' }));
    await expect(textbox).toHaveValue('Needs approval');
    await expect(send).not.toHaveAttribute('aria-busy');
    await userEvent.click(send);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    const id = lastNewId(args.getNewId);
    // Accepting later reconciles the draft without another callback.
    await userEvent.click(canvas.getByRole('button', { name: 'Accept last change' }));
    await expect(itemIds(canvasElement).at(-1)).toBe(id);
    await expect(textbox).toHaveValue('');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);

    // A rejected edit keeps the editor and its text; a rejected reaction keeps the count.
    await userEvent.click(action(canvasElement, 'c2', 'edit')!);
    await userEvent.type(field(canvasElement, 'edit'), ' today');
    await userEvent.keyboard(sendKeys);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(field(canvasElement, 'edit')).toHaveValue('Shipped the new icons. today');
    await expect(activeOf(canvasElement)).toBe(field(canvasElement, 'edit'));
    await expect(part(item(canvasElement, 'c2'), 'body')).toBeNull();
    const chip = within(articleOf(canvasElement, 'c1')).getByRole('button', { name: /^👍/ });
    await userEvent.click(chip);
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
  },
};

export const ImeComposition: Story = {
  play: async ({ args, canvasElement, userEvent }) => {
    const textbox = field(canvasElement);
    await userEvent.type(textbox, 'デザイン');
    const composing = new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      isComposing: true,
      bubbles: true,
      cancelable: true,
    });
    fireEvent(textbox, composing);
    await expect(composing.defaultPrevented).toBe(false);
    fireEvent.keyDown(textbox, { key: 'Enter', ctrlKey: true, keyCode: 229 });
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const InvalidDate: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CommentThread, type CommentAuthor } from '@jfrader/ui';

const GRACE: CommentAuthor = { id: 'grace', name: 'Grace Hopper' };

const ALAN: CommentAuthor = { id: 'alan', name: 'Alan Turing' };

const NOW = Date.parse('2026-10-11T12:00:00Z');

const MINUTE = 60000;

const HOUR = 60 * MINUTE;

const ADA: CommentAuthor = { id: 'ada', name: 'Ada Lovelace' };

const LOCALE = 'en-US';

export function Example() {
  return (
    <CommentThread
      defaultValue={[
        { id: 'bad', author: GRACE, body: 'Unreadable string', createdAt: 'yesterday' },
        { id: 'rolled', author: GRACE, body: 'Impossible date', createdAt: '2026-02-30T10:00:00Z' },
        { id: 'nan', author: ALAN, body: 'Not a number', createdAt: Number.NaN },
        { id: 'future', author: ALAN, body: 'Scheduled', createdAt: NOW + 2 * 24 * HOUR },
      ]}
      currentUser={ADA}
      now={NOW}
      locale={LOCALE}
      title="Review"
    />
  );
}`,
      },
    },
  },
  args: {
    defaultValue: [
      { id: 'bad', author: GRACE, body: 'Unreadable string', createdAt: 'yesterday' },
      { id: 'rolled', author: GRACE, body: 'Impossible date', createdAt: '2026-02-30T10:00:00Z' },
      { id: 'nan', author: ALAN, body: 'Not a number', createdAt: Number.NaN },
      { id: 'future', author: ALAN, body: 'Scheduled', createdAt: NOW + 2 * 24 * HOUR },
    ],
  },
  play: async ({ canvasElement }) => {
    for (const id of ['bad', 'rolled', 'nan']) {
      const article = articleOf(canvasElement, id);
      await expect(article.querySelector('time')).toBeNull();
      await expect(part(article, 'time')).toHaveTextContent('Unknown time');
      await expect(article).not.toHaveAttribute('aria-describedby');
      await expect(article).toHaveAccessibleName(`${id === 'nan' ? 'Alan Turing' : 'Grace Hopper'} Unknown time`);
    }
    await expect(articleOf(canvasElement, 'future').querySelector('time')).toHaveTextContent(relative.format(2, 'day'));
  },
};

export const InvalidInputs: Story = {
  args: { sx: { inlineSize: '16rem', maxInlineSize: '100%' } },
  render: (args) => {
    const cycle: { id: string; author: CommentAuthor; body: string; createdAt: number; replies: ThreadComment[] } = {
      id: 'loop',
      author: GRACE,
      body: 'Loop',
      createdAt: NOW,
      replies: [],
    };
    cycle.replies.push(cycle);
    const tree = [cycle, { id: 'loop', author: ALAN, body: 'Duplicate', createdAt: NOW }];
    return <CommentThread {...args} defaultValue={tree} maxDepth={-1} now={Number.NaN} />;
  },
  beforeEach: () => {
    const errors = spyOn(console, 'error').mockImplementation(() => {});
    return () => errors.mockRestore();
  },
  play: async ({ canvasElement }) => {
    await expect(itemIds(canvasElement)).toEqual(['loop']);
    const region = canvasElement.querySelector<HTMLElement>('[data-ui="comment-thread"]')!;
    await expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth + GEOMETRY_TOLERANCE);
    await expect(articleOf(canvasElement, 'loop').querySelector('time')).toHaveTextContent(fullDate('UTC').format(NOW));
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    const message = (console.error as Mock).mock.calls.map(([first]) => String(first)).join('\n');
    for (const fragment of ['now NaN', 'maxDepth -1', 'duplicate comment ids ["loop"]', 'among its own replies'])
      await expect(message).toContain(fragment);
  },
};

export const LongText: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CommentThread, type CommentAuthor, styled } from '@jfrader/ui';

const NOW = Date.parse('2026-10-11T12:00:00Z');

const MINUTE = 60000;

const ADA: CommentAuthor = { id: 'ada', name: 'Ada Lovelace' };

const LOCALE = 'en-US';

const ExampleFrame = styled.div({ inlineSize: '20rem', maxInlineSize: '100%' });

export function Example() {
  return (
    <ExampleFrame>
      <CommentThread
        defaultValue={[
          {
            id: 'long',
            author: { id: 'long-name', name: 'Maximiliana Wolfeschlegelsteinhausenbergerdorff' },
            body: \`\${'Supercalifragilisticexpialidocious'.repeat(4)}\\nSecond line\\n\\n\${'A sentence that keeps going. '.repeat(8)}\`,
            createdAt: NOW - MINUTE,
            reactions: [
              { emoji: '👀', users: Array.from({ length: 12345 }, (_, index) => \`user-\${index}\`) },
            ],
          },
        ]}
        currentUser={ADA}
        now={NOW}
        locale={LOCALE}
        title="Review"
      />
    </ExampleFrame>
  );
}`,
      },
    },
  },
  args: {
    defaultValue: [
      {
        id: 'long',
        author: { id: 'long-name', name: 'Maximiliana Wolfeschlegelsteinhausenbergerdorff' },
        body: `${'Supercalifragilisticexpialidocious'.repeat(4)}\nSecond line\n\n${'A sentence that keeps going. '.repeat(8)}`,
        createdAt: NOW - MINUTE,
        reactions: [{ emoji: '👀', users: Array.from({ length: 12_345 }, (_, index) => `user-${index}`) }],
      },
    ],
  },
  decorators: [
    (Story) => (
      <NarrowFrame>
        <Story />
      </NarrowFrame>
    ),
  ],
  play: async ({ canvas, canvasElement }) => {
    const region = canvas.getByRole('region');
    await expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth + GEOMETRY_TOLERANCE);
    const body = part(item(canvasElement, 'long'), 'body')!;
    await expect(body.getBoundingClientRect().right).toBeLessThanOrEqual(region.getBoundingClientRect().right + GEOMETRY_TOLERANCE);
    // Line breaks in plain text are kept.
    await expect(getComputedStyle(body).whiteSpace).toBe('pre-wrap');
    // A grouped count fits its chip.
    const chip = within(articleOf(canvasElement, 'long')).getByRole('button', { name: /^👀/ });
    await expect(chip).toHaveTextContent('12,345');
    await expect(chip.scrollWidth).toBeLessThanOrEqual(chip.clientWidth + GEOMETRY_TOLERANCE);
    // The narrow container drops the decorative composer avatar.
    const avatar = part(canvasElement, 'composer')!.querySelector('[data-ui="avatar"]')!.parentElement!;
    await expect(getComputedStyle(avatar).display).toBe('none');
  },
};

export const AriaMerge: Story = {
  render: (args) => (
    <>
      <p id="thread-help">Feedback on the header</p>
      <CommentThread
        {...args}
        aria-labelledby="thread-owner missing-id"
        aria-describedby="thread-help"
        slotProps={{ textarea: { 'aria-describedby': 'thread-help', 'aria-label': 'Your comment' } }}
      />
      <CommentThread {...args} title={false} aria-label="Fallback name" aria-labelledby="thread-owner" />
      <span id="thread-owner">Design</span>
    </>
  ),
  play: async ({ canvas, canvasElement }) => {
    const [region, both] = canvas.getAllByRole('region') as [HTMLElement, HTMLElement];
    // Both consumer naming attributes survive; the internal fallback name is not added.
    await expect(both).toHaveAttribute('aria-label', 'Fallback name');
    await expect(both).toHaveAttribute('aria-labelledby', 'thread-owner');
    await expect(both).toHaveAccessibleName('Design');
    // Consumer and title references are joined; the unresolved id is kept and simply ignored.
    await expect(region).toHaveAttribute('aria-labelledby', expect.stringMatching(/^thread-owner missing-id \S+-title$/));
    await expect(region).toHaveAccessibleName('Design Review');
    await expect(region).not.toHaveAttribute('aria-label');
    await expect(region).toHaveAccessibleDescription('Feedback on the header');
    const textbox = field(canvasElement);
    await expect(textbox).toHaveAccessibleName('Your comment');
    await expect(textbox).toHaveAccessibleDescription('Feedback on the header');
  },
};

export const FalsyContent: Story = {
  render: (args) => (
    <Stack>
      <CommentThread
        {...args}
        title={0}
        defaultValue={[{ id: 'zero', author: GRACE, body: '0', createdAt: NOW }]}
      />
      <CommentThread {...args} title={false} labels={{ thread: 'False title' }} />
      <CommentThread {...args} title={null} labels={{ thread: 'Null title' }} />
      <CommentThread {...args} title="" labels={{ thread: 'Empty title' }} />
    </Stack>
  ),
  play: async ({ canvas, canvasElement }) => {
    const regions = canvas.getAllByRole('region');
    await expect(regions[0]).toHaveAccessibleName('0');
    await expect(within(regions[0]!).getByRole('heading', { name: '0' })).toBeVisible();
    await expect(part(item(canvasElement, 'zero'), 'body')).toHaveTextContent('0');
    for (const [index, name] of ['False title', 'Null title', 'Empty title'].entries()) {
      const region = regions[index + 1]!;
      await expect(region).toHaveAccessibleName(name);
      await expect(region).toHaveAttribute('aria-label', name);
      await expect(region).not.toHaveAttribute('aria-labelledby');
      await expect(within(region).queryByRole('heading')).toBeNull();
    }
  },
};

export const TwoThreads: Story = {
  render: (args) => (
    <Stack>
      <CommentThread {...args} title="First" />
      <CommentThread {...args} title="Second" />
    </Stack>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const ids = Array.from(canvasElement.querySelectorAll('[id]'), (element) => element.id);
    await expect(new Set(ids).size).toBe(ids.length);
    const [first, second] = canvas.getAllByRole('region');
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.type(field(first!), '@a');
    const firstOptions = (await page.findAllByRole('option')).map((option) => option.id);
    await userEvent.type(field(second!), '@a');
    const secondOptions = (await page.findAllByRole('option')).map((option) => option.id);
    await expect(firstOptions.some((id) => secondOptions.includes(id))).toBe(false);
    await expect(field(second!).getAttribute('aria-activedescendant')).toBe(secondOptions[0]);
    await userEvent.keyboard('{Escape}');
  },
};

export const LiveUpdates: Story = {
  render: (args) => <LiveFeed {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const status = part(canvasElement, 'status')!;
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).toHaveTextContent('');
    const time = () => articleOf(canvasElement, 'c2').querySelector('time')!.textContent;
    await expect(time()).toBe(relative.format(-5, 'minute'));
    // A clock tick updates times without announcing anything.
    await userEvent.click(canvas.getByRole('button', { name: 'Tick clock' }));
    await expect(time()).toBe(relative.format(-6, 'minute'));
    await expect(status).toHaveTextContent('');
    // A new comment from someone else is announced and never takes focus.
    const reply = action(canvasElement, 'c2', 'reply')!;
    reply.focus();
    fireEvent.click(canvas.getByRole('button', { name: 'Add comment' }));
    await expect(status).toHaveTextContent('1 new comment');
    await expect(activeOf(canvasElement)).toBe(reply);
    await expect(item(canvasElement, itemIds(canvasElement).at(-1)!)).toHaveAttribute('data-new');
    // Removing the focused comment continues on its nearest neighbour.
    const leafReply = action(canvasElement, 'c1r1r1', 'reply')!;
    leafReply.focus();
    fireEvent.click(canvas.getByRole('button', { name: 'Remove reply' }));
    await expect(item(canvasElement, 'c1r1r1')).toBeNull();
    await expect(activeOf(canvasElement)).toBe(action(canvasElement, 'c2', 'reply'));
  },
};

export const CollapseRestoresFocus: Story = {
  args: { expandedValue: ['c1', 'c1r1'] },
  render: function Render(args) {
    const [expanded, setExpanded] = useState(args.expandedValue!);
    return (
      <>
        <Toolbar>
          <FixtureButton type="button" onClick={() => setExpanded([])}>
            Collapse all
          </FixtureButton>
        </Toolbar>
        <CommentThread {...args} expandedValue={expanded} />
      </>
    );
  },
  play: async ({ canvas, canvasElement }) => {
    const nested = action(canvasElement, 'c1r1r1', 'reply')!;
    nested.focus();
    fireEvent.click(canvas.getByRole('button', { name: 'Collapse all' }));
    await waitFor(() => expect(activeOf(canvasElement)).toBe(toggleOf(canvasElement, 'c1')));
  },
};

export const Localized: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CommentThread, type ThreadComment, type CommentAuthor } from '@jfrader/ui';

const GRACE: CommentAuthor = { id: 'grace', name: 'Grace Hopper' };

const NOW = Date.parse('2026-10-11T12:00:00Z');

const MINUTE = 60000;

const HOUR = 60 * MINUTE;

const ADA: CommentAuthor = { id: 'ada', name: 'Ada Lovelace' };

const ALAN: CommentAuthor = { id: 'alan', name: 'Alan Turing' };

const COMMENTS: readonly ThreadComment[] = Object.freeze([
  {
    id: 'c1',
    author: GRACE,
    body: 'Can we tighten the header spacing?',
    createdAt: NOW - 3 * HOUR,
    reactions: [{ emoji: '👍', users: ['ada', 'alan'] }],
    replies: [
      {
        id: 'c1r1',
        author: ADA,
        body: 'Yes, dropping it to 16px.',
        createdAt: new Date(NOW - 2 * HOUR),
        edited: true,
        replies: [
          {
            id: 'c1r1r1',
            author: ALAN,
            body: 'Check the narrow layout too.',
            createdAt: NOW - 90 * MINUTE,
          },
        ],
      },
    ],
  },
  {
    id: 'c2',
    author: ADA,
    body: 'Shipped the new icons.',
    createdAt: '2026-10-11T11:55:00Z',
    reactions: [{ emoji: '🎉', users: ['grace'] }],
  },
] satisfies ThreadComment[]);

export function Example() {
  return (
    <CommentThread
      defaultValue={COMMENTS}
      currentUser={ADA}
      now={NOW}
      locale="es"
      title="Revisión"
      labels={{
        thread: 'Comentarios',
        reply: 'Responder',
        composer: 'Añadir un comentario',
        commentCount: (count: number) =>
          \`\${new Intl.NumberFormat('es').format(count)} \${new Intl.PluralRules('es').select(count) === 'one' ? 'comentario' : 'comentarios'}\`,
      }}
    />
  );
}`,
      },
    },
  },
  args: {
    locale: 'es',
    title: 'Revisión',
    labels: {
      thread: 'Comentarios',
      reply: 'Responder',
      composer: 'Añadir un comentario',
      commentCount: (count: number) =>
        `${new Intl.NumberFormat('es').format(count)} ${new Intl.PluralRules('es').select(count) === 'one' ? 'comentario' : 'comentarios'}`,
    },
  },
  play: async ({ canvas, canvasElement }) => {
    const spanish = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    await expect(articleOf(canvasElement, 'c1').querySelector('time')).toHaveTextContent(spanish.format(-3, 'hour'));
    await expect(part(canvasElement, 'count')).toHaveTextContent(
      new Intl.ListFormat('es', { type: 'unit', style: 'short' }).format(['4 comentarios', '3 people']),
    );
    await expect(canvas.getAllByRole('button', { name: /^Responder / })).toHaveLength(4);
    await expect(canvas.getByRole('textbox', { name: 'Añadir un comentario' })).toBeVisible();
    // Undefined keys keep their defaults.
    await expect(canvas.getByRole('button', { name: 'Resolve' })).toBeVisible();
  },
};

export const TimeZone: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CommentThread, type ThreadComment, type CommentAuthor } from '@jfrader/ui';

const GRACE: CommentAuthor = { id: 'grace', name: 'Grace Hopper' };

const NOW = Date.parse('2026-10-11T12:00:00Z');

const MINUTE = 60000;

const HOUR = 60 * MINUTE;

const ADA: CommentAuthor = { id: 'ada', name: 'Ada Lovelace' };

const ALAN: CommentAuthor = { id: 'alan', name: 'Alan Turing' };

const COMMENTS: readonly ThreadComment[] = Object.freeze([
  {
    id: 'c1',
    author: GRACE,
    body: 'Can we tighten the header spacing?',
    createdAt: NOW - 3 * HOUR,
    reactions: [{ emoji: '👍', users: ['ada', 'alan'] }],
    replies: [
      {
        id: 'c1r1',
        author: ADA,
        body: 'Yes, dropping it to 16px.',
        createdAt: new Date(NOW - 2 * HOUR),
        edited: true,
        replies: [
          {
            id: 'c1r1r1',
            author: ALAN,
            body: 'Check the narrow layout too.',
            createdAt: NOW - 90 * MINUTE,
          },
        ],
      },
    ],
  },
  {
    id: 'c2',
    author: ADA,
    body: 'Shipped the new icons.',
    createdAt: '2026-10-11T11:55:00Z',
    reactions: [{ emoji: '🎉', users: ['grace'] }],
  },
] satisfies ThreadComment[]);

const LOCALE = 'en-US';

export function Example() {
  return (
    <CommentThread
      defaultValue={COMMENTS}
      currentUser={ADA}
      now={NOW}
      locale={LOCALE}
      title="Review"
      timeZone="Asia/Tokyo"
    />
  );
}`,
      },
    },
  },
  args: { timeZone: 'Asia/Tokyo' },
  play: async ({ canvasElement }) => {
    const first = articleOf(canvasElement, 'c1');
    const createdAt = NOW - 3 * HOUR;
    // The full date follows `timeZone`; the relative time and machine-readable value do not.
    await expect(first).toHaveAccessibleDescription(fullDate('Asia/Tokyo').format(createdAt));
    await expect(fullDate('Asia/Tokyo').format(createdAt)).not.toBe(fullDate('UTC').format(createdAt));
    const time = first.querySelector('time')!;
    await expect(time).toHaveTextContent(relative.format(-3, 'hour'));
    await expect(time).toHaveAttribute('datetime', new Date(createdAt).toISOString());
  },
};

function SlotList(props: ComponentPropsWithRef<'ul'>) {
  return <ul {...props} data-slot="comment-thread-list" />;
}
export const SlotStyling: Story = {
  args: {
    slots: { list: SlotList },
    slotProps: {
      body: { css: slotBodyStyle },
      header: { css: slotHeaderStyle },
      title: { css: slotTitleStyle },
      reaction: { css: slotReactionStyle },
    },
  },
  render: (args) => (
    <ClassNames>
      {({ css: className }) => (
        <Stack>
          <CommentThread {...args} className={className(consumerCss)} sx={consumerSx} />
          <CommentThread {...args} title="Plain" slotProps={undefined} />
        </Stack>
      )}
    </ClassNames>
  ),
  play: async ({ canvas }) => {
    const styled = canvas.getByRole('region', { name: 'Review' });
    const replacement = styled.querySelector('[data-slot="comment-thread-list"]')!;
    await expect(replacement).toBeInTheDocument();
    await expect(replacement).toHaveAttribute('data-ui', 'comment-thread-list');
    await expect(replacement).toHaveAttribute('role', 'list');
    await expect(getComputedStyle(replacement).display).toBe('grid');
    await expect(styled.querySelector('[data-ui="comment-thread-list"]:not([data-slot])')).toBeNull();
    const plain = canvas.getByRole('region', { name: 'Plain' });
    const header = (root: HTMLElement) => getComputedStyle(root.querySelector('[data-ui="card-header"]')!);
    const title = (root: HTMLElement) => getComputedStyle(within(root).getByRole('heading'));
    const reactions = (root: HTMLElement) => getComputedStyle(part(item(root, 'c1'), 'reactions')!);
    const body = (root: HTMLElement) => getComputedStyle(part(item(root, 'c1'), 'body')!);
    // The thread's own part styles beat Card's (Card's header is a grid)...
    await expect(header(plain).display).toBe('flex');
    await expect(header(plain).justifyContent).toBe('space-between');
    await expect(title(plain).overflowWrap).toBe('anywhere');
    await expect(reactions(plain).flexWrap).toBe('wrap');
    await expect(body(plain).textDecorationLine).toBe('none');
    // ...and slot styles beat the thread's own.
    await expect(header(styled).display).toBe('flex');
    await expect(header(styled).justifyContent).toBe('flex-start');
    await expect(title(styled).overflowWrap).toBe('normal');
    await expect(reactions(styled).flexWrap).toBe('nowrap');
    await expect(body(styled).textDecorationLine).toBe('underline');
    // sx wins over the incoming Emotion class and root defaults.
    await expect(getComputedStyle(styled).outlineStyle).toBe('dashed');
    await expect(getComputedStyle(plain).outlineStyle).toBe('none');
  },
};

const refSpy = fn();
export const RefForwarding: Story = {
  render: (args) => <CommentThread {...args} ref={refSpy} />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="comment-thread"]');
    await expect(root).toBeInstanceOf(HTMLElement);
    await expect(refSpy.mock.calls.map(([element]) => element)).toContain(root);
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
};

export const RTL: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CommentThread, type ThreadComment, type CommentAuthor } from '@jfrader/ui';

const GRACE: CommentAuthor = { id: 'grace', name: 'Grace Hopper' };

const NOW = Date.parse('2026-10-11T12:00:00Z');

const MINUTE = 60000;

const HOUR = 60 * MINUTE;

const ADA: CommentAuthor = { id: 'ada', name: 'Ada Lovelace' };

const ALAN: CommentAuthor = { id: 'alan', name: 'Alan Turing' };

const COMMENTS: readonly ThreadComment[] = Object.freeze([
  {
    id: 'c1',
    author: GRACE,
    body: 'Can we tighten the header spacing?',
    createdAt: NOW - 3 * HOUR,
    reactions: [{ emoji: '👍', users: ['ada', 'alan'] }],
    replies: [
      {
        id: 'c1r1',
        author: ADA,
        body: 'Yes, dropping it to 16px.',
        createdAt: new Date(NOW - 2 * HOUR),
        edited: true,
        replies: [
          {
            id: 'c1r1r1',
            author: ALAN,
            body: 'Check the narrow layout too.',
            createdAt: NOW - 90 * MINUTE,
          },
        ],
      },
    ],
  },
  {
    id: 'c2',
    author: ADA,
    body: 'Shipped the new icons.',
    createdAt: '2026-10-11T11:55:00Z',
    reactions: [{ emoji: '🎉', users: ['grace'] }],
  },
] satisfies ThreadComment[]);

const LOCALE = 'en-US';

export function Example() {
  return (
    <CommentThread
      defaultValue={COMMENTS}
      currentUser={ADA}
      now={NOW}
      locale={LOCALE}
      title="Review"
      dir="rtl"
    />
  );
}`,
      },
    },
  },
  args: { dir: 'rtl' },
  play: async ({ canvasElement, userEvent }) => {
    const article = articleOf(canvasElement, 'c1');
    const avatar = article.querySelector('[data-ui="avatar"]')!;
    // The avatar column sits at inline-start, the right edge in RTL.
    await expect(
      Math.abs(avatar.getBoundingClientRect().right - article.getBoundingClientRect().right),
    ).toBeLessThan(GEOMETRY_TOLERANCE);
    const replies = item(canvasElement, 'c1').querySelector<HTMLElement>(':scope > ul')!;
    await expect(Number.parseFloat(getComputedStyle(replies).borderRightWidth)).toBeGreaterThan(0);
    // Picker arrows follow the reading direction.
    await userEvent.click(action(canvasElement, 'c1', 'react')!);
    const emoji = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-part="emoji"]'));
    await userEvent.keyboard('{ArrowLeft}');
    await expect(activeOf(canvasElement)).toBe(emoji[1]);
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await expect(activeOf(canvasElement)).toBe(emoji.at(-1));
  },
};

export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'This play checks CSS rules without enabling reduced motion. Enable the preference in the browser to check the result.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const row = item(canvasElement, 'c2');
    row.setAttribute('data-new', '');
    await expect(mediaDeclarations(row, 'prefers-reduced-motion')).toContainEqual(
      expect.objectContaining({ animationName: 'none' }),
    );
    row.removeAttribute('data-new');
    // Height never animates: disclosure and resolution are immediate.
    const replies = item(canvasElement, 'c1').querySelector<HTMLElement>(':scope > ul')!;
    await expect(getComputedStyle(replies).transitionDuration).toBe('0s');
  },
};

export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'This play checks CSS rules without enabling forced colors. Enable the preference in the browser to check the result.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const replies = item(canvasElement, 'c1').querySelector<HTMLElement>(':scope > ul')!;
    await expect(mediaDeclarations(replies, 'forced-colors')).toContainEqual(
      expect.objectContaining({ borderInlineStartColor: 'graytext' }),
    );
    const chip = articleOf(canvasElement, 'c1').querySelector<HTMLElement>('[data-part="reaction"]')!;
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    // Pressed chips change border width, not only color.
    await expect(Number.parseFloat(getComputedStyle(chip).borderTopWidth)).toBeGreaterThan(1 + 0.25);
  },
};
