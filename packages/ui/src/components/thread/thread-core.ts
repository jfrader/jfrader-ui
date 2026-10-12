// Thread core: the message model, immutable tree operations and Intl formatting shared by every
// thread surface. CommentThread renders it as nested comments; a conversation surface reuses the
// same messages, reactions, timestamps, composer and message shell (`thread-parts.tsx`) over a flat
// list (`maxDepth` 0) with its own layout and grouping. Nothing here knows about comment-only
// concepts (resolution, reply disclosure, the comments card), which keeps that seam clean. Both
// surfaces share this internal folder without exposing implementation parts as public exports.

export interface ThreadAuthor {
  /** Stable identity: ownership, reactions and mention candidates compare it. */
  id: string;
  name: string;
  /** Portrait URL; initials are shown without it. */
  avatar?: string;
}

export interface ThreadReaction {
  emoji: string;
  /** Ids of the people who reacted. */
  users: readonly string[];
}

/** Epoch ms, a Date, or an ISO date-time with `Z` or an explicit offset. */
export type ThreadTimestamp = Date | string | number;

export interface ThreadMessage {
  /** Unique, stable identity across updates. */
  id: string;
  author: ThreadAuthor;
  /** Plain text, rendered as escaped text with its line breaks. */
  body: string;
  createdAt: ThreadTimestamp;
  edited?: boolean;
  deleted?: boolean;
  reactions?: readonly ThreadReaction[];
}

export interface ThreadComment extends ThreadMessage {
  replies?: readonly ThreadComment[];
}

export interface ThreadEntry {
  comment: ThreadComment;
  parentId: string | null;
  /** Reply edges below a root comment; roots are 0. */
  depth: number;
}

export interface ThreadIndex {
  entries: ReadonlyMap<string, ThreadEntry>;
  /** Ids in reading (depth-first) order. */
  order: readonly string[];
  duplicates: readonly string[];
  /** True when a comment appears among its own replies; the repeat is skipped. */
  cyclic: boolean;
}

export interface ThreadFormatters {
  relative: Intl.RelativeTimeFormat;
  full: Intl.DateTimeFormat;
  number: Intl.NumberFormat;
  plural: Intl.PluralRules;
  /** Joins names ("Ada and Grace"). */
  people: Intl.ListFormat;
  /** Joins short facts ("4 comments, 2 people"). */
  facts: Intl.ListFormat;
}

export const DEFAULT_TIME_ZONE = 'UTC';
const NO_REPLIES: readonly ThreadComment[] = [];
const MAX_EPOCH = 8.64e15;
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Mean Gregorian year and month, so long spans round the way calendars read them. */
const YEAR = 365.2425 * DAY;
const MONTH = YEAR / 12;
const WEEK = 7 * DAY;
/** Largest unit first; each applies once the distance reaches one whole unit. */
const RELATIVE_UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ['year', YEAR],
  ['month', MONTH],
  ['week', WEEK],
  ['day', DAY],
  ['hour', HOUR],
  ['minute', MINUTE],
];
const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
/** Machine-side locale used only to validate a time zone. */
const VALIDATION_LOCALE = 'en-US';

export const validEpoch = (epoch: number) => Number.isFinite(epoch) && Math.abs(epoch) <= MAX_EPOCH;

export function toEpoch(value: ThreadTimestamp): number | null {
  if (typeof value === 'number') return validEpoch(value) ? value : null;
  if (value instanceof Date) return validEpoch(value.getTime()) ? value.getTime() : null;
  if (typeof value !== 'string') return null;
  const match = ISO_DATE_TIME.exec(value);
  if (!match) return null;
  // Date.parse rolls impossible calendar dates (Feb 30) over instead of rejecting them.
  const [year, month, day] = match.slice(1, 4).map(Number) as [number, number, number];
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
  const epoch = Date.parse(value);
  return validEpoch(epoch) ? epoch : null;
}

/** Signed relative text ("5 minutes ago", "in 2 days", "now") from the caller-owned clock. */
export function relativeTime(epoch: number, now: number, format: Intl.RelativeTimeFormat) {
  const distance = epoch - now;
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(distance) >= size) return format.format(Math.trunc(distance / size), unit);
  }
  return format.format(Math.trunc(distance / SECOND), 'second');
}

function createFormatters(locale: Intl.LocalesArgument, timeZone: string): ThreadFormatters {
  return {
    relative: new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }),
    full: new Intl.DateTimeFormat(locale, { timeZone, dateStyle: 'full', timeStyle: 'short' }),
    number: new Intl.NumberFormat(locale),
    plural: new Intl.PluralRules(locale),
    people: new Intl.ListFormat(locale, { type: 'conjunction' }),
    facts: new Intl.ListFormat(locale, { type: 'unit', style: 'short' }),
  };
}

/** Formatters for the requested locale and zone; unusable values fall back and are reported. */
export function resolveFormatters(owner: string, locale: Intl.LocalesArgument, timeZone: string) {
  const problems: string[] = [];
  let safeLocale = locale;
  try {
    Intl.getCanonicalLocales(locale as string | string[] | undefined);
  } catch {
    problems.push(`${owner}: locale ${JSON.stringify(String(locale))} is not a valid language tag; using the default locale.`);
    safeLocale = undefined;
  }
  let safeTimeZone = timeZone;
  try {
    new Intl.DateTimeFormat(VALIDATION_LOCALE, { timeZone });
  } catch {
    problems.push(`${owner}: timeZone ${JSON.stringify(timeZone)} is not a valid IANA time zone; using ${DEFAULT_TIME_ZONE}.`);
    safeTimeZone = DEFAULT_TIME_ZONE;
  }
  return { formatters: createFormatters(safeLocale, safeTimeZone), problems };
}

/** "1 reply" / "3 replies" through the locale's plural rules and digits. */
export const formatCount = (format: ThreadFormatters, count: number, one: string, other: string) =>
  `${format.number.format(count)} ${format.plural.select(count) === 'one' ? one : other}`;

/** Every comment by id with its parent and depth; repeated ids keep their first occurrence. */
export function indexThread(roots: readonly ThreadComment[]): ThreadIndex {
  const entries = new Map<string, ThreadEntry>();
  const order: string[] = [];
  const duplicates = new Set<string>();
  const path = new Set<ThreadComment>();
  let cyclic = false;
  const visit = (comments: readonly ThreadComment[], parentId: string | null, depth: number) => {
    for (const comment of comments) {
      if (path.has(comment)) {
        cyclic = true;
        continue;
      }
      if (entries.has(comment.id)) duplicates.add(comment.id);
      else {
        entries.set(comment.id, { comment, parentId, depth });
        order.push(comment.id);
      }
      path.add(comment);
      visit(comment.replies ?? NO_REPLIES, comment.id, depth + 1);
      path.delete(comment);
    }
  };
  visit(roots, null, 0);
  return { entries, order, duplicates: [...duplicates], cyclic };
}

/**
 * Replaces (or, for `null`, removes) the first comment with `id`, copying only the path to it.
 * Returns the same array when nothing changed, so callers can skip no-op events.
 */
export function updateComment(
  comments: readonly ThreadComment[],
  id: string,
  update: (comment: ThreadComment) => ThreadComment | null,
  path: ReadonlySet<ThreadComment> = new Set(),
): readonly ThreadComment[] {
  for (const [position, comment] of comments.entries()) {
    if (path.has(comment)) continue;
    if (comment.id === id) {
      const replacement = update(comment);
      if (replacement === comment) return comments;
      const next = [...comments];
      if (replacement === null) next.splice(position, 1);
      else next[position] = replacement;
      return next;
    }
    const replies = comment.replies;
    if (!replies?.length) continue;
    const nextReplies = updateComment(replies, id, update, new Set(path).add(comment));
    if (nextReplies !== replies) return comments.with(position, { ...comment, replies: nextReplies });
  }
  return comments;
}

/**
 * The comment a reply to `parentId` attaches to: the parent itself while the reply stays within
 * `maxDepth` reply edges, otherwise its ancestor at depth `maxDepth - 1`; `null` adds a root
 * comment (always for `maxDepth` 0). `undefined` when the parent is unknown.
 */
export function resolveReplyParent(index: ThreadIndex, parentId: string | null, maxDepth: number) {
  if (parentId === null) return null;
  let entry = index.entries.get(parentId);
  if (!entry) return undefined;
  if (maxDepth <= 0) return null;
  while (entry.depth + 1 > maxDepth && entry.parentId !== null) {
    entry = index.entries.get(entry.parentId)!;
  }
  return entry.comment.id;
}

export function appendComment(comments: readonly ThreadComment[], parentId: string | null, comment: ThreadComment) {
  if (parentId === null) return [...comments, comment];
  return updateComment(comments, parentId, (parent) => ({
    ...parent,
    replies: [...(parent.replies ?? NO_REPLIES), comment],
  }));
}

/** New body for a live comment; unchanged or deleted comments are left alone. */
export function editComment(comments: readonly ThreadComment[], id: string, body: string) {
  return updateComment(comments, id, (comment) =>
    comment.deleted || comment.body === body ? comment : { ...comment, body, edited: true },
  );
}

/**
 * A leaf disappears; a comment with replies becomes a tombstone that keeps its id, author, time
 * and replies but drops its body and reactions.
 */
export function deleteComment(comments: readonly ThreadComment[], id: string) {
  return updateComment(comments, id, (comment) => {
    if (comment.deleted) return comment;
    if (!comment.replies?.length) return null;
    return { ...comment, deleted: true, body: '', reactions: [] };
  });
}

/** Adds or removes `userId` from the `emoji` reaction; empty reactions are dropped. */
export function toggleReaction(reactions: readonly ThreadReaction[], emoji: string, userId: string) {
  const existing = reactions.find((reaction) => reaction.emoji === emoji);
  if (!existing) return { reactions: [...reactions, { emoji, users: [userId] }], added: true };
  const added = !existing.users.includes(userId);
  const users = added ? [...existing.users, userId] : existing.users.filter((user) => user !== userId);
  const next =
    users.length === 0
      ? reactions.filter((reaction) => reaction !== existing)
      : reactions.map((reaction) => (reaction === existing ? { emoji, users } : reaction));
  return { reactions: next, added };
}

export function reactToComment(comments: readonly ThreadComment[], id: string, emoji: string, userId: string) {
  let added = false;
  const next = updateComment(comments, id, (comment) => {
    if (comment.deleted) return comment;
    const result = toggleReaction(comment.reactions ?? [], emoji, userId);
    added = result.added;
    return { ...comment, reactions: result.reactions };
  });
  return { comments: next, added };
}

/** First occurrence of each value, keyed by `key`. */
export function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = key(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
