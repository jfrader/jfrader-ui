'use client';

// Semantics: a named `section` (region) around a Card surface. Comments are native lists
// (`role="list"` keeps list semantics under `list-style: none` in WebKit) of items that each hold an
// `article` named by its author and `<time>` and described by the full localized date; deleted
// comments with replies stay as tombstones named "Deleted comment". Replies sit in a nested list
// behind a native disclosure button (`aria-expanded`/`aria-controls`) and stay mounted while hidden.
// Keyboard map: Tab/Shift+Tab follow DOM order; Enter/Space activate buttons once; Ctrl/Cmd+Enter
// submits a composer or editor (never during IME composition, while disabled or while a submit is
// pending); Escape closes the innermost layer first (mention suggestions, reaction picker, delete
// confirmation) and then cancels an open edit or reply. Mention and picker keys: see thread-parts.
// State: `value` (comment tree), `resolvedValue` and `expandedValue` are independent controlled
// axes; callbacks fire only from user interactions. Drafts, the reply target, the editor, the
// delete confirmation and the picker are local UI state. A submitted draft clears only once the
// proposed comment or edit shows up in the tree, so a rejected controlled request keeps the text;
// one submit per composer is outstanding at a time, and editing the text or Cancel releases it.
// Focus: only user actions move focus. Cancel or an accepted edit/reply returns to the action that
// opened it; an accepted resolve/reopen moves to the other button; a removed focused comment
// continues on the nearest surviving comment's actions, then the composer. Updates from the
// parent never take focus, and new comments from others are announced in a text-only status.
// Clock: the caller owns `now` (epoch ms); the component keeps no timer.
// Shared core: data model, tree operations and Intl live in `thread-core.ts`; the message shell,
// reactions and composer in `thread-parts.tsx`. Only nesting, disclosure, edit/delete/resolve and
// the comments card are specific to this file.
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type SerializedStyles } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { partId } from '../../utils/part-id';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button } from '../button';
import { Card } from '../card';
import {
  DEFAULT_TIME_ZONE,
  appendComment,
  deleteComment,
  editComment,
  formatCount,
  indexThread,
  reactToComment,
  resolveFormatters,
  resolveReplyParent,
  toEpoch,
  uniqueBy,
  validEpoch,
  type ThreadAuthor,
  type ThreadComment,
  type ThreadFormatters,
  type ThreadIndex,
  type ThreadReaction,
} from './thread-core';
import {
  ThreadComposer,
  ThreadMessageView,
  ThreadReactions,
  threadSizeStyles,
  type ThreadButtonProps,
  type ThreadPartProps,
  type ThreadReactionLabels,
  type ThreadSize,
  type ThreadTextareaProps,
} from './thread-parts';

export type { ThreadComment } from './thread-core';
export type CommentAuthor = ThreadAuthor;
export type CommentReaction = ThreadReaction;
export type CommentThreadSize = ThreadSize;
export type CommentThreadHeadingLevel = 2 | 3 | 4 | 5 | 6;
export type CommentThreadPartProps = ThreadPartProps;

/** What a proposed tree changes; `parentId` is where a reply actually attached after `maxDepth`. */
export type CommentThreadEvent =
  | { type: 'reply'; comment: ThreadComment; parentId: string | null }
  | { type: 'edit'; id: string; body: string }
  | { type: 'delete'; id: string }
  | { type: 'react'; id: string; emoji: string; added: boolean };

// No `actionFailed` label: the thread never learns that a server mutation failed (acknowledgement
// and errors are consumer-owned), so it has nothing to show it for.
export interface CommentThreadLabels extends ThreadReactionLabels {
  /** Region name when there is no `title`, `aria-label` or `aria-labelledby`. */
  thread: string;
  /** Accessible name of the new-comment field. */
  composer: string;
  placeholder: string;
  resolve: string;
  resolved: string;
  reopen: string;
  empty: string;
  reply: string;
  edit: string;
  delete: string;
  cancel: string;
  send: string;
  save: string;
  edited: string;
  /** Accessible name of the edit field. */
  editComment: string;
  /** Prompt that names the inline delete confirmation. */
  deleteConfirm: string;
  deletedText: string;
  /** Name of a deleted comment's article. */
  deletedComment: string;
  hideReplies: string;
  cancelReply: string;
  /** Name of the mention suggestions list. */
  mentions: string;
  invalidTime: string;
  /** Accessible name of a reply field. */
  replyingTo: (name: string) => string;
  showReplies: (count: number) => string;
  commentCount: (count: number) => string;
  peopleCount: (count: number) => string;
  /** Announced when comments from others arrive. */
  newComments: (count: number) => string;
}

type CommentThreadPart =
  | 'header'
  | 'title'
  | 'list'
  | 'item'
  | 'article'
  | 'time'
  | 'body'
  | 'replies'
  | 'actions'
  | 'reaction'
  | 'composer'
  | 'resolved'
  | 'status';

export type CommentThreadSlotProps = Partial<Record<CommentThreadPart, CommentThreadPartProps>> & {
  /** Extra Textarea props for every composer and editor; handlers are composed with the thread's. */
  textarea?: ThreadTextareaProps;
  /** Extra Button props for every Send/Save button; `onClick` runs first and may `preventDefault()`. */
  send?: ThreadButtonProps;
};

export interface CommentThreadProps
  extends Omit<ComponentPropsWithRef<'section'>, 'defaultValue' | 'onChange' | 'children' | 'title'>,
    SxProps {
  /** Comment tree (controlled). Treated as immutable. */
  value?: readonly ThreadComment[];
  defaultValue?: readonly ThreadComment[];
  /** The full proposed tree plus what changed. */
  onValueChange?: (next: ThreadComment[], event: CommentThreadEvent) => void;
  /** Whose comments are editable; authorization stays on the server. */
  currentUser: CommentAuthor;
  /** Mention candidates; defaults to every author plus `currentUser`. Deduped by id. */
  people?: readonly CommentAuthor[];
  resolvedValue?: boolean;
  defaultResolvedValue?: boolean;
  onResolvedValueChange?: (resolved: boolean) => void;
  /** Ids whose replies are shown (controlled). */
  expandedValue?: readonly string[];
  /** Defaults to every comment that has replies at first render. */
  defaultExpandedValue?: readonly string[];
  onExpandedValueChange?: (ids: string[]) => void;
  title?: ReactNode;
  headingLevel?: CommentThreadHeadingLevel;
  /** Emoji offered by the picker, deduped; `[]` removes the picker. */
  reactions?: readonly string[];
  /** Maximum reply edges below a root comment; deeper replies attach to the deepest allowed ancestor. */
  maxDepth?: number;
  /** Reference instant in epoch ms for relative times. Pass the same value on server and client. */
  now: number;
  locale?: Intl.LocalesArgument;
  /** IANA zone for full dates. */
  timeZone?: string;
  /** Id for a newly submitted comment; called once per accepted submit interaction. */
  getNewId?: () => string;
  placeholder?: string;
  /** Accessible name of the new-comment field; defaults to `labels.composer`. */
  composerLabel?: string;
  /** Blocks every mutation. */
  disabled?: boolean;
  /** Hides mutation controls; reply disclosure still works. */
  readOnly?: boolean;
  size?: CommentThreadSize;
  labels?: Partial<CommentThreadLabels>;
  slotProps?: CommentThreadSlotProps;
}

type Pending = { kind: 'add'; id: string } | { kind: 'edit'; id: string; body: string };

interface ThreadUi {
  replyTo: string | null;
  editing: string | null;
  confirming: string | null;
  picker: string | null;
  /** Keyed by composer: `root`, `reply:<id>` or `edit:<id>`. */
  drafts: Readonly<Record<string, string>>;
  pending: Readonly<Record<string, Pending>>;
}

interface FocusReturn {
  /** Focus returns once this element (composer, confirmation, button) is gone. */
  invoker: Element;
  target: () => HTMLElement | null | undefined;
  /** Comment to recover around when the target is gone too. */
  commentId: string | null;
}

// Bundlers replace `process.env.NODE_ENV` in consumer builds; library mode leaves it in place.
declare const process: { env: { NODE_ENV?: string } };

const UI = 'comment-thread';
const ROOT_COMPOSER = 'root';
const DEFAULT_REACTIONS: readonly string[] = ['👍', '❤️', '🎉', '👀', '🚀', '✅'];
const DEFAULT_MAX_DEPTH = 2;
/** Reply lists deeper than this stop indenting further; structure is kept. */
const MAX_INDENT_DEPTH = 3;
const EMPTY_TREE: readonly ThreadComment[] = [];
const EMPTY_IDS: readonly string[] = [];
const INITIAL_UI: ThreadUi = { replyTo: null, editing: null, confirming: null, picker: null, drafts: {}, pending: {} };
const NARROW = '@container (max-width: 28rem)';

const replyKey = (id: string) => `reply:${id}`;
const editKey = (id: string) => `edit:${id}`;
const defaultNewId = () => crypto.randomUUID();
/** Order- and repeat-insensitive identity of an id set. */
const idSetKey = (ids: readonly string[]) => JSON.stringify([...new Set(ids)].sort());

function omit<T>(record: Readonly<Record<string, T>>, key: string): Readonly<Record<string, T>> {
  if (!(key in record)) return record;
  const { [key]: _removed, ...rest } = record;
  return rest;
}

function closeComposer(ui: ThreadUi, key: string): ThreadUi {
  return {
    ...ui,
    drafts: omit(ui.drafts, key),
    pending: omit(ui.pending, key),
    replyTo: ui.replyTo !== null && key === replyKey(ui.replyTo) ? null : ui.replyTo,
    editing: ui.editing !== null && key === editKey(ui.editing) ? null : ui.editing,
  };
}

/** Applies accepted submits and drops UI aimed at comments that are gone or deleted. */
function settleUi(ui: ThreadUi, index: ThreadIndex): ThreadUi {
  let next = ui;
  for (const [key, pending] of Object.entries(ui.pending)) {
    const entry = index.entries.get(pending.id);
    const accepted =
      pending.kind === 'add' ? entry !== undefined : !entry || entry.comment.deleted || entry.comment.body === pending.body;
    if (accepted) next = closeComposer(next, key);
  }
  const live = (id: string | null) => id === null || isLive(index, id);
  if (!live(next.replyTo)) next = closeComposer(next, replyKey(next.replyTo!));
  if (!live(next.editing)) next = closeComposer(next, editKey(next.editing!));
  if (!live(next.confirming)) next = { ...next, confirming: null };
  if (!live(next.picker)) next = { ...next, picker: null };
  return next;
}

function isLive(index: ThreadIndex, id: string) {
  const entry = index.entries.get(id);
  return entry !== undefined && !entry.comment.deleted;
}

function parentsWithReplies(index: ThreadIndex) {
  return index.order.filter((id) => (index.entries.get(id)!.comment.replies?.length ?? 0) > 0);
}

function defaultLabels(format: ThreadFormatters): CommentThreadLabels {
  const count = (n: number, one: string, other: string) => formatCount(format, n, one, other);
  return {
    thread: 'Comments',
    composer: 'Add a comment',
    placeholder: 'Write a comment',
    resolve: 'Resolve',
    resolved: 'Resolved',
    reopen: 'Reopen',
    empty: 'No comments yet',
    reply: 'Reply',
    edit: 'Edit',
    delete: 'Delete',
    cancel: 'Cancel',
    send: 'Send',
    save: 'Save',
    edited: 'Edited',
    editComment: 'Edit comment',
    deleteConfirm: 'Delete this comment?',
    deletedText: 'This comment was deleted.',
    deletedComment: 'Deleted comment',
    hideReplies: 'Hide replies',
    cancelReply: 'Cancel',
    addReaction: 'Add reaction',
    closeReactions: 'Close reactions',
    reactions: 'Reactions',
    mentions: 'People',
    invalidTime: 'Unknown time',
    replyingTo: (name) => `Reply to ${name}`,
    showReplies: (n) => `Show ${count(n, 'reply', 'replies')}`,
    commentCount: (n) => count(n, 'comment', 'comments'),
    peopleCount: (n) => count(n, 'person', 'people'),
    newComments: (n) => count(n, 'new comment', 'new comments'),
    reactWith: (emoji) => `React with ${emoji}`,
    reactionCount: (emoji, n, mine) =>
      mine ? `${emoji} ${count(n, 'reaction', 'reactions')}, including you` : `${emoji} ${count(n, 'reaction', 'reactions')}`,
  };
}

const fadeIn = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });

const rootStyle = css({
  minInlineSize: 0,
  // Lets the parts adapt to the space the thread gets, not the viewport.
  containerType: 'inline-size',
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
});

const sizeStyles: Record<CommentThreadSize, SerializedStyles> = {
  sm: css({ '--comment-thread-gap': vars.space[3], '--comment-thread-indent': vars.space[4] }),
  md: css({ '--comment-thread-gap': vars.space[4], '--comment-thread-indent': vars.space[6] }),
};

const headerStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: vars.space[2],
});

const headingGroupStyle = css({ display: 'grid', gap: vars.space[1], minInlineSize: 0 });

const titleStyle = css({ overflowWrap: 'anywhere' });

const countStyle = css({ margin: 0, fontSize: vars.textSize.xs, color: vars.color.textMuted });

const hiddenStyle = css({ '&[hidden]': { display: 'none' } });

const listStyle = css({
  display: 'grid',
  rowGap: 'var(--comment-thread-gap)',
  listStyle: 'none',
  margin: 0,
  padding: 0,
});

const itemStyle = css({
  display: 'grid',
  rowGap: vars.space[2],
  minInlineSize: 0,
  '&[data-new]': {
    animationName: fadeIn,
    animationDuration: vars.motion.duration.base,
    animationTimingFunction: vars.motion.easeStandard,
  },
  [REDUCED_MOTION]: { '&[data-new]': { animation: 'none' } },
});

const bodyStyle = css({
  margin: 0,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  lineHeight: vars.lineHeight.relaxed,
  color: vars.color.text,
  '&[data-deleted]': { color: vars.color.textMuted, fontStyle: 'italic' },
});

const actionsStyle = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[1] });

const confirmStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[2],
  paddingBlock: vars.space[2],
  paddingInline: vars.space[3],
  border: `1px solid ${vars.color.dangerBorder}`,
  borderRadius: vars.radius.md,
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});

const confirmPromptStyle = css({ flex: '1 1 auto', fontWeight: vars.fontWeight.medium });

const offsetStyle = css({
  marginInlineStart: 'calc(var(--thread-avatar) + var(--thread-column-gap))',
  [NARROW]: { marginInlineStart: 0 },
});

const toggleStyle = css({ justifySelf: 'start' });

// Reply rail under the parent's avatar; a real border so forced colors keep it.
const repliesStyle = css({
  display: 'grid',
  rowGap: 'var(--comment-thread-gap)',
  listStyle: 'none',
  margin: 0,
  marginInlineStart: 'calc(var(--thread-avatar) / 2 - 1px)',
  padding: 0,
  paddingInlineStart: 'var(--comment-thread-indent)',
  borderInlineStart: `2px solid ${vars.color.border}`,
  '&[hidden]': { display: 'none' },
  '&[data-capped]': { marginInlineStart: 0, paddingInlineStart: 0, borderInlineStart: 0 },
  [NARROW]: { paddingInlineStart: vars.space[3] },
  [FORCED_COLORS]: { borderInlineStartColor: 'GrayText' },
});

const emptyStyle = css({ margin: 0, paddingBlock: vars.space[4], color: vars.color.textMuted });

const resolvedStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
});

const resolvedTextStyle = css({
  flex: '1 1 12rem',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[2],
  margin: 0,
  color: vars.color.textMuted,
  overflowWrap: 'anywhere',
});

const resolvedChipStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[1],
  minBlockSize: vars.space[6],
  paddingInline: vars.space[2],
  border: `1px solid ${vars.color.borderStrong}`,
  borderRadius: vars.radius.full,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.text,
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});

const glyphStyle = css({ display: 'block', inlineSize: '1em', blockSize: '1em' });

const checkGlyph = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" css={glyphStyle} aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" strokeLinecap="round" />
  </svg>
);

export function CommentThread({
  ref,
  value,
  defaultValue,
  onValueChange,
  currentUser,
  people: peopleProp,
  resolvedValue,
  defaultResolvedValue,
  onResolvedValueChange,
  expandedValue,
  defaultExpandedValue,
  onExpandedValueChange,
  title,
  headingLevel = 3,
  reactions: offeredProp = DEFAULT_REACTIONS,
  maxDepth: maxDepthProp = DEFAULT_MAX_DEPTH,
  now,
  locale,
  timeZone = DEFAULT_TIME_ZONE,
  getNewId = defaultNewId,
  placeholder,
  composerLabel,
  disabled = false,
  readOnly = false,
  size = 'md',
  labels: labelProps,
  slotProps,
  className,
  sx,
  onFocus,
  onBlur,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  ...rest
}: CommentThreadProps) {
  const baseId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const mergedRef = useMergeRefs([ref, rootRef]);
  const { formatters, problems } = useMemo(() => resolveFormatters('CommentThread', locale, timeZone), [locale, timeZone]);
  const labels: CommentThreadLabels = { ...defaultLabels(formatters), ...labelProps };
  const validNow = validEpoch(now) ? now : null;
  const maxDepthValid = Number.isInteger(maxDepthProp) && maxDepthProp >= 0;
  const maxDepth = maxDepthValid ? maxDepthProp : DEFAULT_MAX_DEPTH;
  const offered = useMemo(() => uniqueBy(offeredProp, (emoji) => emoji), [offeredProp]);

  // Tree: the request adapter carries the event for the change it proposes.
  const proposedEvent = useRef<CommentThreadEvent | null>(null);
  const [tree = EMPTY_TREE, requestTree] = useControlledState<readonly ThreadComment[]>(
    value,
    defaultValue ?? EMPTY_TREE,
    (next) => onValueChange?.([...next], proposedEvent.current!),
  );
  const index = useMemo(() => indexThread(tree), [tree]);
  const commit = (next: readonly ThreadComment[], event: CommentThreadEvent) => {
    if (next === tree) return;
    proposedEvent.current = event;
    requestTree(next);
  };

  const [resolved = false, requestResolved] = useControlledState<boolean>(
    resolvedValue,
    defaultResolvedValue ?? false,
    onResolvedValueChange,
  );
  // Like the expanded set below: a request the parent rejected is not re-sent.
  const lastResolveRequest = useRef<boolean | null>(null);
  useLayoutEffect(() => {
    lastResolveRequest.current = null;
  }, [resolved]);

  const [initialExpanded] = useState(() => defaultExpandedValue ?? parentsWithReplies(index));
  const [expanded = EMPTY_IDS, requestExpandedChange] = useControlledState<readonly string[]>(
    expandedValue,
    initialExpanded,
    (next) => onExpandedValueChange?.([...next]),
  );
  const expandedIds = new Set(expanded);
  const expandedKey = idSetKey(expanded);
  // The id set last requested from the current one; repeating it (a rejected request) is not re-sent.
  const lastExpandRequest = useRef<string | null>(null);
  useLayoutEffect(() => {
    lastExpandRequest.current = null;
  }, [expandedKey]);
  const requestExpanded = (next: readonly string[]) => {
    const key = idSetKey(next);
    if (key === expandedKey || key === lastExpandRequest.current) return;
    lastExpandRequest.current = key;
    requestExpandedChange(next);
  };

  // Local UI, settled against the tree during render so accepted submits clear in the same pass.
  const [uiState, setUi] = useState(INITIAL_UI);
  const ui = settleUi(uiState, index);
  if (ui !== uiState) setUi(ui);

  const people = useMemo(
    () =>
      uniqueBy(
        peopleProp ?? [...index.order.map((id) => index.entries.get(id)!.comment.author), currentUser],
        (person) => person.id,
      ),
    [peopleProp, index, currentUser],
  );

  // Focus and announcement bookkeeping across commits.
  const focusReturn = useRef<FocusReturn | null>(null);
  const lastFocus = useRef<{ element: Element; commentId: string | null } | null>(null);
  const previousOrder = useRef<readonly string[]>(index.order);
  const committedIds = useRef<ReadonlySet<string> | null>(null);
  const ownIds = useRef(new Set<string>());
  const [announcement, setAnnouncement] = useState({ text: '', key: 0 });
  const entering = useMemo(() => {
    const previous = committedIds.current;
    return new Set(previous ? index.order.filter((id) => !previous.has(id)) : []);
  }, [index]);

  const itemOf = (id: string) =>
    rootRef.current?.querySelector<HTMLElement>(`[data-ui="${UI}-item"][data-comment-id="${CSS.escape(id)}"]`);
  const actionOf = (id: string, action: string) =>
    itemOf(id)?.querySelector<HTMLElement>(`:scope > article [data-action="${action}"]`);
  /** A comment's Reply action, else its first enabled action, else its replies toggle. */
  const focusableIn = (id: string) => {
    const element = itemOf(id);
    return [
      ':scope > article [data-action="reply"]:not(:disabled)',
      ':scope > article [data-action]:not(:disabled)',
      ':scope > [data-part="toggle"]',
    ]
      .map((selector) => element?.querySelector<HTMLElement>(selector))
      .find(Boolean);
  };
  const composerField = () =>
    rootRef.current?.querySelector<HTMLElement>(`[data-composer="${ROOT_COMPOSER}"] textarea:not(:disabled)`);

  /** Continues on the nearest surviving comment's actions, then the composer. */
  const recover = (fromId: string | null) => {
    const order = previousOrder.current;
    const from = fromId === null ? -1 : order.indexOf(fromId);
    const own = fromId === null ? null : focusableIn(fromId);
    if (own) {
      own.focus();
      return;
    }
    for (let step = 1; from !== -1 && step < order.length; step++) {
      const target = [order[from + step], order[from - step]]
        .filter((id): id is string => id !== undefined)
        .map(focusableIn)
        .find(Boolean);
      if (target) {
        target.focus();
        return;
      }
    }
    composerField()?.focus();
  };

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const document = root.ownerDocument;
    const active = document.activeElement;
    const lost = !active || active === document.body;
    const request = focusReturn.current;
    if (request && !request.invoker.isConnected) {
      focusReturn.current = null;
      if (lost) {
        const target = request.target();
        if (target) target.focus();
        else recover(request.commentId);
      }
    } else if (lost && lastFocus.current && !lastFocus.current.element.isConnected) {
      const { commentId } = lastFocus.current;
      lastFocus.current = null;
      recover(commentId);
    }
    // Focus inside replies collapsed (or a thread resolved) from outside moves to the control
    // that brings them back.
    const focused = lastFocus.current?.element;
    if (focused?.isConnected && (lost || active === focused)) {
      const hiddenList = `[data-ui="${UI}-replies"][hidden]`;
      let list: HTMLElement | null = null;
      for (let next = focused.closest<HTMLElement>(hiddenList); next; next = next.parentElement!.closest(hiddenList))
        list = next;
      const toggle = list ? root.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(list.id)}"]`) : null;
      const reopen = focused.closest(`[data-ui="${UI}-content"][hidden]`)
        ? root.querySelector<HTMLElement>('[data-action="reopen"]')
        : null;
      (toggle ?? reopen)?.focus();
    }
    previousOrder.current = index.order;
  });

  useLayoutEffect(() => {
    const previous = committedIds.current;
    committedIds.current = new Set(index.order);
    if (!previous) return;
    const fresh = index.order.filter((id) => !previous.has(id) && !ownIds.current.has(id));
    if (fresh.length > 0) setAnnouncement((current) => ({ text: labels.newComments(fresh.length), key: current.key + 1 }));
    // Runs per data change only; labels read the latest render.
  }, [index]);

  // Development diagnostics: invalid inputs and malformed trees.
  const diagnostics = [
    ...problems,
    ...(validNow === null ? [`CommentThread: now ${String(now)} is not a finite epoch-ms value; showing full dates.`] : []),
    ...(maxDepthValid ? [] : [`CommentThread: maxDepth ${String(maxDepthProp)} is not a nonnegative integer; using ${DEFAULT_MAX_DEPTH}.`]),
    ...(index.duplicates.length > 0 ? [`CommentThread: duplicate comment ids ${JSON.stringify(index.duplicates)}; showing the first of each.`] : []),
    ...(index.cyclic ? ['CommentThread: a comment appears among its own replies; the repeat is not shown.'] : []),
  ].join('\n');
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || diagnostics === '') return;
    console.error(diagnostics);
  }, [diagnostics]);

  const handleFocus = (event: FocusEvent<HTMLElement>) => {
    onFocus?.(event);
    const item = event.target.closest<HTMLElement>(`[data-ui="${UI}-item"]`);
    lastFocus.current = { element: event.target, commentId: item?.dataset.commentId ?? null };
    if (focusReturn.current && !focusReturn.current.invoker.contains(event.target)) focusReturn.current = null;
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    onBlur?.(event);
    const { target } = event;
    // A focused element removed by an update also blurs; keep its records so focus can be repaired.
    // Focus that really left (still connected, nothing inside took it) releases them.
    queueMicrotask(() => {
      if (!target.isConnected || lastFocus.current?.element !== target) return;
      lastFocus.current = null;
      focusReturn.current = null;
    });
  };

  // Interactions -----------------------------------------------------------------------------

  const setDraft = (key: string, draft: string) =>
    setUi((current) => ({ ...current, drafts: { ...current.drafts, [key]: draft }, pending: omit(current.pending, key) }));

  const submitComment = (key: string, parentId: string | null, body: string, container: HTMLElement) => {
    if (disabled || readOnly || ui.pending[key]) return;
    if (parentId !== null && !isLive(index, parentId)) return;
    const attachTo = resolveReplyParent(index, parentId, maxDepth);
    if (attachTo === undefined) return;
    const comment: ThreadComment = {
      id: getNewId(),
      author: currentUser,
      body,
      createdAt: validNow ?? Date.now(),
      reactions: [],
    };
    ownIds.current.add(comment.id);
    setUi((current) => ({ ...current, pending: { ...current.pending, [key]: { kind: 'add', id: comment.id } } }));
    if (parentId !== null) focusReturn.current = { invoker: container, target: () => actionOf(parentId, 'reply'), commentId: parentId };
    commit(appendComment(tree, attachTo, comment), { type: 'reply', comment, parentId: attachTo });
    if (attachTo !== null && !expandedIds.has(attachTo)) requestExpanded([...expanded, attachTo]);
  };

  const cancelRoot = () =>
    setUi((current) =>
      // A pending submit is released first (the text stays for a retry); otherwise the draft clears.
      current.pending[ROOT_COMPOSER]
        ? { ...current, pending: omit(current.pending, ROOT_COMPOSER) }
        : closeComposer(current, ROOT_COMPOSER),
    );

  const openReply = (id: string) => setUi((current) => ({ ...current, replyTo: id, confirming: null, picker: null }));

  const closeReply = (id: string, container: HTMLElement) => {
    focusReturn.current = { invoker: container, target: () => actionOf(id, 'reply'), commentId: id };
    setUi((current) => closeComposer(current, replyKey(id)));
  };

  const openEdit = (comment: ThreadComment) =>
    setUi((current) => ({
      ...current,
      editing: comment.id,
      confirming: null,
      picker: null,
      drafts: { ...current.drafts, [editKey(comment.id)]: comment.body },
    }));

  const closeEdit = (id: string, container: HTMLElement) => {
    focusReturn.current = { invoker: container, target: () => actionOf(id, 'edit'), commentId: id };
    setUi((current) => closeComposer(current, editKey(id)));
  };

  const submitEdit = (comment: ThreadComment, body: string, container: HTMLElement) => {
    const key = editKey(comment.id);
    if (disabled || readOnly || ui.pending[key] || !isLive(index, comment.id)) return;
    if (body === comment.body) {
      closeEdit(comment.id, container);
      return;
    }
    focusReturn.current = { invoker: container, target: () => actionOf(comment.id, 'edit'), commentId: comment.id };
    setUi((current) => ({ ...current, pending: { ...current.pending, [key]: { kind: 'edit', id: comment.id, body } } }));
    commit(editComment(tree, comment.id, body), { type: 'edit', id: comment.id, body });
  };

  const closeConfirm = (id: string, group: HTMLElement) => {
    focusReturn.current = { invoker: group, target: () => actionOf(id, 'delete'), commentId: id };
    setUi((current) => ({ ...current, confirming: null }));
  };

  const confirmDelete = (id: string, group: HTMLElement) => {
    closeConfirm(id, group);
    if (disabled || readOnly) return;
    commit(deleteComment(tree, id), { type: 'delete', id });
  };

  const react = (id: string, emoji: string) => {
    if (disabled || readOnly) return;
    const { comments, added } = reactToComment(tree, id, emoji, currentUser.id);
    commit(comments, { type: 'react', id, emoji, added });
  };

  const requestResolution = (next: boolean, event: MouseEvent<HTMLButtonElement>) => {
    if (disabled || readOnly || next === lastResolveRequest.current) return;
    lastResolveRequest.current = next;
    const target = next ? 'reopen' : 'resolve';
    focusReturn.current = {
      invoker: event.currentTarget,
      target: () => rootRef.current?.querySelector<HTMLElement>(`[data-action="${target}"]`),
      commentId: null,
    };
    requestResolved(next);
  };

  const toggleReplies = (id: string) =>
    requestExpanded(expandedIds.has(id) ? expanded.filter((open) => open !== id) : [...expanded, id]);

  // Rendering --------------------------------------------------------------------------------

  const liveIds = index.order.filter((id) => isLive(index, id));
  const participants = uniqueBy(
    liveIds.map((id) => index.entries.get(id)!.comment.author),
    (author) => author.id,
  );
  const commentCount = labels.commentCount(liveIds.length);
  const summary =
    liveIds.length > 0 ? formatters.facts.format([commentCount, labels.peopleCount(participants.length)]) : commentCount;
  const empty = index.order.length === 0;
  const emptyId = `${baseId}-empty`;
  const titleId = `${baseId}-title`;
  const hasTitle = isRenderable(title) && title !== '';
  const labelledBy = [ariaLabelledBy, hasTitle ? titleId : undefined].filter(Boolean).join(' ') || undefined;
  const describedBy = [ariaDescribedBy, empty ? emptyId : undefined].filter(Boolean).join(' ') || undefined;

  const composerShared = {
    ui: UI,
    mentionsLabel: labels.mentions,
    people,
    locale,
    disabled,
    size,
    textareaProps: slotProps?.textarea,
    submitProps: slotProps?.send,
  };

  const renderComment = (comment: ThreadComment, depth: number, ancestors: ReadonlySet<ThreadComment>): ReactNode => {
    // Repeated ids and cyclic references are diagnosed and shown once.
    if (ancestors.has(comment) || index.entries.get(comment.id)?.comment !== comment) return null;
    const { id } = comment;
    const deleted = comment.deleted === true;
    const own = comment.author.id === currentUser.id;
    const editing = ui.editing === id && !deleted;
    const confirming = ui.confirming === id && !deleted;
    const replies = comment.replies ?? EMPTY_TREE;
    const repliesId = partId(baseId, 'replies', id);
    const open = expandedIds.has(id);
    const lineage = new Set(ancestors).add(comment);
    const promptId = partId(baseId, 'confirm', id);

    const handleConfirmKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      closeConfirm(id, event.currentTarget);
    };

    return (
      <li
        key={id}
        data-ui={`${UI}-item`}
        data-comment-id={id}
        data-depth={depth}
        data-deleted={deleted ? '' : undefined}
        data-new={entering.has(id) ? '' : undefined}
        className={slotProps?.item?.className}
        css={[itemStyle, slotProps?.item?.css]}
      >
        <ThreadMessageView
          ui={UI}
          author={comment.author}
          label={deleted ? labels.deletedComment : undefined}
          epoch={toEpoch(comment.createdAt)}
          now={validNow}
          formatters={formatters}
          invalidTimeLabel={labels.invalidTime}
          meta={comment.edited && !deleted ? labels.edited : null}
          size={size}
          baseId={baseId}
          messageId={id}
          slots={{ article: slotProps?.article, time: slotProps?.time }}
        >
          {editing ? (
            <ThreadComposer
              {...composerShared}
              kind="edit"
              draft={ui.drafts[editKey(id)] ?? comment.body}
              onDraftChange={(draft) => setDraft(editKey(id), draft)}
              onSubmit={(text, container) => submitEdit(comment, text, container)}
              onCancel={(container) => closeEdit(id, container)}
              cancelable
              label={labels.editComment}
              submitLabel={labels.save}
              cancelLabel={labels.cancel}
              pending={ui.pending[editKey(id)] !== undefined}
              autoFocus
              part={slotProps?.composer}
            />
          ) : (
            <p
              data-ui={`${UI}-body`}
              data-deleted={deleted ? '' : undefined}
              className={slotProps?.body?.className}
              css={[bodyStyle, slotProps?.body?.css]}
            >
              {deleted ? labels.deletedText : comment.body}
            </p>
          )}
          {deleted || editing ? null : (
            <ThreadReactions
              ui={UI}
              reactions={comment.reactions ?? []}
              offered={offered}
              currentUserId={currentUser.id}
              formatters={formatters}
              labels={labels}
              readOnly={readOnly}
              disabled={disabled}
              pickerOpen={ui.picker === id}
              onPickerOpenChange={(pickerOpen) =>
                setUi((current) => ({ ...current, picker: pickerOpen ? id : null, confirming: null }))
              }
              onToggle={(emoji) => react(id, emoji)}
              pickerId={partId(baseId, 'picker', id)}
              part={slotProps?.reaction}
            />
          )}
          {deleted || editing || readOnly ? null : confirming ? (
            // Keyed apart from the actions row so React never reuses one element for the other.
            <div
              key="confirm"
              role="group"
              aria-labelledby={promptId}
              data-ui={`${UI}-confirm`}
              onKeyDown={handleConfirmKeyDown}
              css={confirmStyle}
            >
              <span id={promptId} css={confirmPromptStyle}>
                {labels.deleteConfirm}
              </span>
              <Button
                variant="ghost"
                size="sm"
                autoFocus
                onClick={(event) => closeConfirm(id, event.currentTarget.parentElement!)}
              >
                {labels.cancel}
              </Button>
              <Button
                variant="solid"
                tone="danger"
                size="sm"
                disabled={disabled}
                onClick={(event) => confirmDelete(id, event.currentTarget.parentElement!)}
              >
                {labels.delete}
              </Button>
            </div>
          ) : (
            <div
              key="actions"
              data-ui={`${UI}-actions`}
              className={slotProps?.actions?.className}
              css={[actionsStyle, slotProps?.actions?.css]}
            >
              <Button
                variant="ghost"
                size="sm"
                data-action="reply"
                aria-expanded={ui.replyTo === id}
                disabled={disabled}
                onClick={() => openReply(id)}
              >
                {labels.reply}
              </Button>
              {own ? (
                <>
                  <Button variant="ghost" size="sm" data-action="edit" disabled={disabled} onClick={() => openEdit(comment)}>
                    {labels.edit}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    tone="danger"
                    data-action="delete"
                    disabled={disabled}
                    onClick={() => setUi((current) => ({ ...current, confirming: id, picker: null }))}
                  >
                    {labels.delete}
                  </Button>
                </>
              ) : null}
            </div>
          )}
        </ThreadMessageView>
        {ui.replyTo === id && !deleted && !readOnly ? (
          <div css={offsetStyle}>
            <ThreadComposer
              {...composerShared}
              kind="reply"
              draft={ui.drafts[replyKey(id)] ?? ''}
              onDraftChange={(draft) => setDraft(replyKey(id), draft)}
              onSubmit={(text, container) => submitComment(replyKey(id), id, text, container)}
              onCancel={(container) => closeReply(id, container)}
              cancelable
              label={labels.replyingTo(comment.author.name)}
              placeholder={placeholder ?? labels.placeholder}
              submitLabel={labels.send}
              cancelLabel={labels.cancelReply}
              pending={ui.pending[replyKey(id)] !== undefined}
              autoFocus
              part={slotProps?.composer}
            />
          </div>
        ) : null}
        {replies.length > 0 ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              data-part="toggle"
              aria-expanded={open}
              aria-controls={repliesId}
              onClick={() => toggleReplies(id)}
              css={[toggleStyle, offsetStyle]}
            >
              {open ? labels.hideReplies : labels.showReplies(replies.length)}
            </Button>
            <ul
              role="list"
              id={repliesId}
              hidden={!open}
              data-ui={`${UI}-replies`}
              data-capped={depth + 1 > MAX_INDENT_DEPTH ? '' : undefined}
              className={slotProps?.replies?.className}
              css={[repliesStyle, slotProps?.replies?.css]}
            >
              {replies.map((reply) => renderComment(reply, depth + 1, lineage))}
            </ul>
          </>
        ) : null}
      </li>
    );
  };

  return (
    <WithSx className={className} styles={[rootStyle, threadSizeStyles[size], sizeStyles[size]]} sx={sx}>
      {(rootClassName) => (
        <section
          {...rest}
          ref={mergedRef}
          aria-label={ariaLabel ?? (labelledBy ? undefined : labels.thread)}
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          data-ui={UI}
          data-size={size}
          data-state={resolved ? 'resolved' : 'open'}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={rootClassName}
        >
          <Card>
            <Card.Header className={slotProps?.header?.className} css={[headerStyle, slotProps?.header?.css]}>
              <div css={headingGroupStyle}>
                {hasTitle ? (
                  <Card.Title
                    id={titleId}
                    level={headingLevel}
                    className={slotProps?.title?.className}
                    css={[titleStyle, slotProps?.title?.css]}
                  >
                    {title}
                  </Card.Title>
                ) : null}
                <p data-ui={`${UI}-count`} css={countStyle}>
                  {summary}
                </p>
              </div>
              {!resolved && !readOnly ? (
                <Button
                  variant="outline"
                  size="sm"
                  data-action="resolve"
                  disabled={disabled}
                  startIcon={checkGlyph}
                  onClick={(event) => requestResolution(true, event)}
                >
                  {labels.resolve}
                </Button>
              ) : null}
            </Card.Header>
            <Card.Content>
              <div data-ui={`${UI}-content`} hidden={resolved} css={hiddenStyle}>
                {empty ? (
                  <p id={emptyId} data-ui={`${UI}-empty`} css={emptyStyle}>
                    {labels.empty}
                  </p>
                ) : (
                  <ul
                    role="list"
                    data-ui={`${UI}-list`}
                    className={slotProps?.list?.className}
                    css={[listStyle, slotProps?.list?.css]}
                  >
                    {tree.map((comment) => renderComment(comment, 0, new Set()))}
                  </ul>
                )}
              </div>
              {resolved ? (
                <div
                  data-ui={`${UI}-resolved`}
                  className={slotProps?.resolved?.className}
                  css={[resolvedStyle, slotProps?.resolved?.css]}
                >
                  <p css={resolvedTextStyle}>
                    <span css={resolvedChipStyle}>
                      {checkGlyph}
                      {labels.resolved}
                    </span>
                    <span>{commentCount}</span>
                    {participants.length > 0 ? (
                      <span>{formatters.people.format(participants.map((person) => person.name))}</span>
                    ) : null}
                  </p>
                  {readOnly ? null : (
                    <Button
                      variant="outline"
                      size="sm"
                      data-action="reopen"
                      disabled={disabled}
                      onClick={(event) => requestResolution(false, event)}
                    >
                      {labels.reopen}
                    </Button>
                  )}
                </div>
              ) : null}
            </Card.Content>
            {readOnly ? null : (
              <Card.Footer hidden={resolved} css={hiddenStyle}>
                <ThreadComposer
                  {...composerShared}
                  kind={ROOT_COMPOSER}
                  draft={ui.drafts[ROOT_COMPOSER] ?? ''}
                  onDraftChange={(draft) => setDraft(ROOT_COMPOSER, draft)}
                  onSubmit={(text, container) => submitComment(ROOT_COMPOSER, null, text, container)}
                  onCancel={cancelRoot}
                  cancelOnEscape={false}
                  cancelable={(ui.drafts[ROOT_COMPOSER] ?? '') !== '' || ui.pending[ROOT_COMPOSER] !== undefined}
                  label={composerLabel ?? labels.composer}
                  placeholder={placeholder ?? labels.placeholder}
                  submitLabel={labels.send}
                  cancelLabel={labels.cancel}
                  pending={ui.pending[ROOT_COMPOSER] !== undefined}
                  author={currentUser}
                  part={slotProps?.composer}
                />
              </Card.Footer>
            )}
          </Card>
          <div
            role="status"
            aria-atomic="true"
            data-ui={`${UI}-status`}
            className={slotProps?.status?.className}
            css={[visuallyHiddenStyle, slotProps?.status?.css]}
          >
            {announcement.text ? <span key={announcement.key}>{announcement.text}</span> : null}
          </div>
        </section>
      )}
    </WithSx>
  );
}

CommentThread.displayName = 'CommentThread';
