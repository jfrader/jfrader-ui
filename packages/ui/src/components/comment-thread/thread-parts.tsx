'use client';

// Thread core parts shared by every thread surface (see `thread-core.ts` for the seam):
// - ThreadMessageView: the message `article` (decorative avatar, author, time, body, footer).
// - ThreadReactions: pressed reaction chips plus an inline emoji picker group.
// - ThreadComposer: a Textarea with @-mention suggestions and the submit/cancel actions.
// Each part takes the owning component's `ui` name, so its `data-ui` markers stay
// `<owner>-<part>` and owner-scoped queries never reach another thread surface. Buttons keep
// Button's own `data-ui` and are marked with `data-part` / `data-action` instead.
//
// Mentions (no shared MentionInput exists yet): typing `@` at the start of the text or after
// whitespace opens a listbox of matching people below the field. DOM focus and the caret stay in
// the Textarea (`aria-activedescendant`); Up/Down wrap, Home/End jump, Enter/Tab insert
// `@Name `, Escape closes only the suggestions. A textarea cannot carry the combobox role or
// `aria-expanded`, so it exposes `aria-autocomplete="list"`, `aria-controls` and the active
// descendant while the list is open. With no matching person the field is an ordinary Textarea.
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { autoUpdate, flip, offset, shift, useFloating, useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import {
  listboxItemStateStyle,
  listboxItemStyle,
  listboxScrollStyle,
  listboxSurfaceStyle,
} from '../../styling/listbox-style';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { partId } from '../../utils/part-id';
import { moveRovingFocus } from '../../utils/roving-focus';
import { Avatar } from '../avatar';
import { Button, type ButtonProps } from '../button';
import { Textarea, type TextareaProps } from '../textarea';
import { relativeTime, type ThreadAuthor, type ThreadFormatters, type ThreadReaction } from './thread-core';

export type ThreadSize = 'sm' | 'md';

export interface ThreadPartProps {
  className?: string;
  css?: Interpolation<Theme>;
}

/** Textarea props a consumer may add; the thread owns value, change and mention wiring. */
export type ThreadTextareaProps = Omit<TextareaProps, 'value' | 'defaultValue' | 'onValueChange' | 'label' | 'children'>;

/** Button props a consumer may add to a submit button; the thread owns its label and state. */
export type ThreadButtonProps = Omit<ButtonProps, 'children' | 'loading' | 'type' | 'render'>;

const MENTION_TRIGGER = '@';
const MAX_SUGGESTIONS = 8;
/** Gap between the field and the suggestions, in px (matches `space[1]`). */
const SUGGESTION_GAP = 4;
const VIEWPORT_PADDING = 8;
const WHITESPACE = /\s/u;

const ui = (owner: string, part: string) => `${owner}-${part}`;

export const isComposing = (event: KeyboardEvent<HTMLElement>) =>
  event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;

const avatarSizes: Record<ThreadSize, 'sm' | 'md'> = { sm: 'sm', md: 'md' };

// ---------------------------------------------------------------------------------------------
// Time

export interface ThreadTimeProps {
  epoch: number | null;
  /** Caller-owned clock; `null` shows the full date instead of a relative one. */
  now: number | null;
  formatters: ThreadFormatters;
  invalidLabel: string;
  id: string;
  /** Id of the hidden full date, for the message's `aria-describedby`. */
  fullId: string;
  ui: string;
  part?: ThreadPartProps;
}

const timeStyle = css({
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
});

export function ThreadTime({ epoch, now, formatters, invalidLabel, id, fullId, ui: owner, part }: ThreadTimeProps) {
  if (epoch === null) {
    return (
      <span id={id} data-ui={ui(owner, 'time')} className={part?.className} css={[timeStyle, part?.css]}>
        {invalidLabel}
      </span>
    );
  }
  return (
    <>
      <time
        id={id}
        dateTime={new Date(epoch).toISOString()}
        data-ui={ui(owner, 'time')}
        className={part?.className}
        css={[timeStyle, part?.css]}
      >
        {now === null ? formatters.full.format(epoch) : relativeTime(epoch, now, formatters.relative)}
      </time>
      <span id={fullId} css={visuallyHiddenStyle}>
        {formatters.full.format(epoch)}
      </span>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Message shell

export interface ThreadMessageViewProps {
  ui: string;
  author: ThreadAuthor;
  /** Replaces the author/time name, e.g. for a deleted message. */
  label?: string;
  epoch: number | null;
  now: number | null;
  formatters: ThreadFormatters;
  invalidTimeLabel: string;
  /** Text after the time, e.g. "(edited)". */
  meta?: ReactNode;
  size: ThreadSize;
  baseId: string;
  messageId: string;
  /** Body, editor and footer rows. */
  children: ReactNode;
  slots?: { article?: ThreadPartProps; time?: ThreadPartProps };
}

const articleStyle = css({
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  columnGap: 'var(--thread-column-gap)',
  alignItems: 'start',
});

const avatarColumnStyle = css({ display: 'inline-flex' });

const mainStyle = css({
  display: 'grid',
  rowGap: vars.space[1],
  minInlineSize: 0,
});

const headerLineStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  columnGap: vars.space[2],
  rowGap: vars.space[1],
  minInlineSize: 0,
});

const authorStyle = css({
  fontWeight: vars.fontWeight.semibold,
  color: vars.color.text,
  overflowWrap: 'anywhere',
});

const metaStyle = css({ fontSize: vars.textSize.xs, color: vars.color.textMuted });

export function ThreadMessageView({
  ui: owner,
  author,
  label,
  epoch,
  now,
  formatters,
  invalidTimeLabel,
  meta,
  size,
  baseId,
  messageId,
  children,
  slots,
}: ThreadMessageViewProps) {
  const authorId = partId(baseId, 'author', messageId);
  const timeId = partId(baseId, 'time', messageId);
  const fullId = partId(baseId, 'when', messageId);
  return (
    <article
      aria-label={label}
      aria-labelledby={label === undefined ? `${authorId} ${timeId}` : undefined}
      aria-describedby={epoch === null ? undefined : fullId}
      data-ui={ui(owner, 'article')}
      className={slots?.article?.className}
      css={[articleStyle, slots?.article?.css]}
    >
      {/* The author's name is the adjacent text; the portrait only decorates it. */}
      <span aria-hidden="true" css={avatarColumnStyle}>
        <Avatar name={author.name} src={author.avatar} size={avatarSizes[size]} />
      </span>
      <div css={mainStyle}>
        <div css={headerLineStyle}>
          <span id={authorId} data-ui={ui(owner, 'author')} css={authorStyle}>
            {author.name}
          </span>
          <ThreadTime
            epoch={epoch}
            now={now}
            formatters={formatters}
            invalidLabel={invalidTimeLabel}
            id={timeId}
            fullId={fullId}
            ui={owner}
            part={slots?.time}
          />
          {meta ? <span css={metaStyle}>{meta}</span> : null}
        </div>
        {children}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------------------------
// Reactions

export interface ThreadReactionLabels {
  addReaction: string;
  closeReactions: string;
  reactions: string;
  reactWith: (emoji: string) => string;
  reactionCount: (emoji: string, count: number, mine: boolean) => string;
}

export interface ThreadReactionsProps {
  ui: string;
  reactions: readonly ThreadReaction[];
  /** Emoji offered by the picker; empty hides the picker. */
  offered: readonly string[];
  currentUserId: string;
  formatters: ThreadFormatters;
  labels: ThreadReactionLabels;
  /** Mutations hidden: chips render as text. */
  readOnly: boolean;
  disabled: boolean;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  onToggle: (emoji: string) => void;
  pickerId: string;
  part?: ThreadPartProps;
}

const reactionsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[1],
});

// Pressed chips change shape (thicker border) and weight, not only color.
const chipStyle = css({
  gap: vars.space[1],
  paddingInline: vars.space[2],
  fontVariantNumeric: 'tabular-nums',
  '&[aria-pressed="true"]': {
    borderWidth: '2px',
    borderColor: vars.color.accentBorder,
    backgroundColor: vars.color.accentSoft,
    color: vars.color.accentText,
    fontWeight: vars.fontWeight.semibold,
  },
  [FORCED_COLORS]: { '&[aria-pressed="true"]': { borderColor: 'Highlight' } },
});

const staticChipStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[1],
  minBlockSize: vars.space[6],
  paddingInline: vars.space[2],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.full,
  fontSize: vars.textSize.sm,
  fontVariantNumeric: 'tabular-nums',
});

const iconButtonStyle = css({ paddingInline: vars.space[2] });

const pickerStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[1],
  padding: vars.space[1],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surface,
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});

const glyphStyle = css({ display: 'block', inlineSize: '1em', blockSize: '1em' });

const smileGlyph = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" css={glyphStyle} aria-hidden="true">
    <circle cx="8" cy="8" r="6.25" />
    <path d="M5.5 9.5c.6.9 1.4 1.3 2.5 1.3s1.9-.4 2.5-1.3M6 6.25h.01M10 6.25h.01" strokeLinecap="round" />
  </svg>
);

const closeGlyph = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" css={glyphStyle} aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
  </svg>
);

/**
 * Picker keyboard: Left/Right (mirrored in RTL) wrap across the emoji, Home/End jump; Escape and
 * a chosen emoji close it and return focus to the add button. Pressing outside leaves it open.
 */
export function ThreadReactions({
  ui: owner,
  reactions,
  offered,
  currentUserId,
  formatters,
  labels,
  readOnly,
  disabled,
  pickerOpen,
  onPickerOpenChange,
  onToggle,
  pickerId,
  part,
}: ThreadReactionsProps) {
  const addRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [rovingIndex, setRovingIndex] = useState(0);
  const emojiQuery = { itemSelector: '[data-part="emoji"]', ownerSelector: `[data-ui="${ui(owner, 'picker')}"]` };
  const canPick = !readOnly && offered.length > 0;
  const showPicker = canPick && pickerOpen;

  useLayoutEffect(() => {
    if (pickerOpen || !restoreFocus.current) return;
    restoreFocus.current = false;
    addRef.current?.focus();
  }, [pickerOpen]);

  const close = () => {
    restoreFocus.current = true;
    onPickerOpenChange(false);
  };

  if (reactions.length === 0 && !canPick) return null;

  const handlePickerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    moveRovingFocus(event, event.currentTarget, 'horizontal', emojiQuery);
  };

  return (
    <div data-ui={ui(owner, 'reactions')} className={part?.className} css={[reactionsStyle, part?.css]}>
      {reactions.map(({ emoji, users }) => {
        const mine = users.includes(currentUserId);
        const name = labels.reactionCount(emoji, users.length, mine);
        const content = (
          <>
            <span aria-hidden="true">{emoji}</span>
            <span aria-hidden="true">{formatters.number.format(users.length)}</span>
          </>
        );
        return readOnly ? (
          <span key={emoji} data-part="reaction" css={staticChipStyle}>
            {content}
            <span css={visuallyHiddenStyle}>{name}</span>
          </span>
        ) : (
          <Button
            key={emoji}
            variant="outline"
            size="sm"
            data-part="reaction"
            aria-label={name}
            aria-pressed={mine}
            disabled={disabled}
            onClick={() => onToggle(emoji)}
            css={chipStyle}
          >
            {content}
          </Button>
        );
      })}
      {canPick ? (
        <Button
          ref={addRef}
          variant="ghost"
          size="sm"
          aria-label={labels.addReaction}
          aria-expanded={showPicker}
          aria-controls={showPicker ? pickerId : undefined}
          disabled={disabled}
          data-action="react"
          onClick={() => onPickerOpenChange(!pickerOpen)}
          css={iconButtonStyle}
        >
          {smileGlyph}
        </Button>
      ) : null}
      {showPicker ? (
        <div
          id={pickerId}
          role="group"
          aria-label={labels.reactions}
          data-ui={ui(owner, 'picker')}
          onKeyDown={handlePickerKeyDown}
          css={pickerStyle}
        >
          {offered.map((emoji, index) => (
            <Button
              key={emoji}
              variant="ghost"
              size="sm"
              data-part="emoji"
              aria-label={labels.reactWith(emoji)}
              tabIndex={index === Math.min(rovingIndex, offered.length - 1) ? 0 : -1}
              autoFocus={index === 0}
              disabled={disabled}
              onFocus={() => setRovingIndex(index)}
              onClick={() => {
                onToggle(emoji);
                close();
              }}
              css={iconButtonStyle}
            >
              <span aria-hidden="true">{emoji}</span>
            </Button>
          ))}
          <Button variant="ghost" size="sm" aria-label={labels.closeReactions} onClick={close} css={iconButtonStyle}>
            {closeGlyph}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Composer

export interface ThreadComposerProps {
  ui: string;
  draft: string;
  onDraftChange: (draft: string) => void;
  /** Called with the trimmed text for a non-empty, non-pending submit. */
  onSubmit: (text: string, container: HTMLElement) => void;
  /** The cancel button, and Escape (with no suggestions open) unless `cancelOnEscape` is false. */
  onCancel?: (container: HTMLElement) => void;
  cancelOnEscape?: boolean;
  /** Shows the cancel button. */
  cancelable: boolean;
  label: string;
  placeholder?: string;
  submitLabel: string;
  cancelLabel: string;
  mentionsLabel: string;
  people: readonly ThreadAuthor[];
  locale: Intl.LocalesArgument;
  disabled: boolean;
  /** A submit is waiting for its parent to accept it; further submits are ignored. */
  pending: boolean;
  /** Focus the field on mount; only set when a user action opened this composer. */
  autoFocus?: boolean;
  size: ThreadSize;
  /** Decorative portrait shown at inline-start. */
  author?: ThreadAuthor;
  textareaProps?: ThreadTextareaProps;
  submitProps?: ThreadButtonProps;
  part?: ThreadPartProps;
  /** Distinguishes composers inside one thread (`data-composer`). */
  kind: string;
}

interface Mention {
  start: number;
  query: string;
}

/** The `@query` the caret is in, when `@` starts the text or follows whitespace. */
function findMention(text: string, caret: number): Mention | null {
  const before = text.slice(0, caret);
  const start = before.lastIndexOf(MENTION_TRIGGER);
  if (start === -1) return null;
  if (start > 0 && !WHITESPACE.test(before[start - 1]!)) return null;
  const query = before.slice(start + MENTION_TRIGGER.length);
  return WHITESPACE.test(query) ? null : { start, query };
}

function matchPeople(people: readonly ThreadAuthor[], query: string, locale: Intl.LocalesArgument) {
  const needle = query.toLocaleLowerCase(locale as string | string[] | undefined);
  return people
    .filter((person) =>
      person.name
        .toLocaleLowerCase(locale as string | string[] | undefined)
        .split(WHITESPACE)
        .some((word) => word.startsWith(needle)),
    )
    .slice(0, MAX_SUGGESTIONS);
}

const SUGGESTION_MOVES: Partial<Record<string, (index: number, count: number) => number>> = {
  ArrowDown: (index, count) => (index + 1) % count,
  ArrowUp: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_index, count) => count - 1,
};

const composerStyle = css({
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  columnGap: 'var(--thread-column-gap)',
  alignItems: 'start',
  inlineSize: '100%',
  '&[data-avatar="false"]': { gridTemplateColumns: 'minmax(0, 1fr)' },
});

const composerAvatarStyle = css({
  display: 'inline-flex',
  '@container (max-width: 28rem)': { display: 'none' },
});

const composerFieldStyle = css({
  display: 'grid',
  rowGap: vars.space[2],
  minInlineSize: 0,
  // The decorative avatar column collapses in narrow containers; the field takes the row.
  '@container (max-width: 28rem)': { gridColumn: '1 / -1' },
});

const composerActionsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: vars.space[2],
});

const suggestionStyle = css({ gap: vars.space[2] });

const textareaSizes: Record<ThreadSize, 'sm' | 'md'> = { sm: 'sm', md: 'md' };
const fieldRows: Record<ThreadSize, number> = { sm: 2, md: 3 };

/** Per-size layout variables read by the parts; the owning root applies them. */
export const threadSizeStyles: Record<ThreadSize, SerializedStyles> = {
  sm: css({ '--thread-column-gap': vars.space[2], '--thread-avatar': vars.space[6] }),
  md: css({ '--thread-column-gap': vars.space[3], '--thread-avatar': vars.space[8] }),
};

export function ThreadComposer({
  ui: owner,
  draft,
  onDraftChange,
  onSubmit,
  onCancel,
  cancelOnEscape = true,
  cancelable,
  label,
  placeholder,
  submitLabel,
  cancelLabel,
  mentionsLabel,
  people,
  locale,
  disabled,
  pending,
  autoFocus,
  size,
  author,
  textareaProps,
  submitProps,
  part,
  kind,
}: ThreadComposerProps) {
  const baseId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [active, setActive] = useState({ query: '', index: 0 });

  const mention = caret === null ? null : findMention(draft, caret);
  const candidates = mention ? matchPeople(people, mention.query, locale) : [];
  const open = mention !== null && !disabled && candidates.length > 0 && dismissedAt !== mention.start;
  const activeIndex = mention && active.query === mention.query ? Math.min(active.index, candidates.length - 1) : 0;
  const listId = `${baseId}-mentions`;
  const optionId = (person: ThreadAuthor) => partId(baseId, 'person', person.id);

  const { refs, floatingStyles } = useFloating({
    open,
    placement: 'bottom-start',
    middleware: [offset(SUGGESTION_GAP), flip({ padding: VIEWPORT_PADDING }), shift({ padding: VIEWPORT_PADDING })],
    whileElementsMounted: autoUpdate,
  });
  const fieldRefs = useMergeRefs([fieldRef, refs.setReference, textareaProps?.ref]);

  useLayoutEffect(() => {
    if (pendingCaret.current === null || !fieldRef.current) return;
    fieldRef.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  });

  const readCaret = (field: HTMLTextAreaElement) =>
    setCaret(field.selectionStart === field.selectionEnd ? field.selectionStart : null);

  const insert = (person: ThreadAuthor) => {
    if (!mention) return;
    const text = `${MENTION_TRIGGER}${person.name} `;
    const end = mention.start + MENTION_TRIGGER.length + mention.query.length;
    const next = draft.slice(0, mention.start) + text + draft.slice(end);
    const position = mention.start + text.length;
    pendingCaret.current = position;
    setCaret(position);
    onDraftChange(next);
  };

  const submit = () => {
    const text = draft.trim();
    if (disabled || pending || text === '' || !containerRef.current) return;
    onSubmit(text, containerRef.current);
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    textareaProps?.onChange?.(event);
    onDraftChange(event.currentTarget.value);
    readCaret(event.currentTarget);
  };

  const handleSelect = (event: SyntheticEvent<HTMLTextAreaElement>) => {
    textareaProps?.onSelect?.(event);
    readCaret(event.currentTarget);
  };

  const handleBlur = (event: FocusEvent<HTMLTextAreaElement>) => {
    textareaProps?.onBlur?.(event);
    if (mention) setDismissedAt(mention.start);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    textareaProps?.onKeyDown?.(event);
    if (event.defaultPrevented || isComposing(event)) return;
    const plain = !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
    if (open && mention) {
      const move = plain ? SUGGESTION_MOVES[event.key] : undefined;
      if (move) {
        event.preventDefault();
        setActive({ query: mention.query, index: move(activeIndex, candidates.length) });
        return;
      }
      if (plain && (event.key === 'Enter' || event.key === 'Tab')) {
        event.preventDefault();
        insert(candidates[activeIndex]!);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setDismissedAt(mention.start);
        return;
      }
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === 'Escape' && cancelOnEscape && onCancel && containerRef.current) {
      event.preventDefault();
      event.stopPropagation();
      onCancel(containerRef.current);
    }
  };

  const empty = draft.trim() === '';
  const showAvatar = author !== undefined;

  return (
    <div
      ref={containerRef}
      data-ui={ui(owner, 'composer')}
      data-composer={kind}
      data-avatar={showAvatar}
      className={part?.className}
      css={[composerStyle, part?.css]}
    >
      {showAvatar ? (
        <span aria-hidden="true" css={composerAvatarStyle}>
          <Avatar name={author.name} src={author.avatar} size={avatarSizes[size]} />
        </span>
      ) : null}
      <div css={composerFieldStyle}>
        <Textarea
          aria-label={label}
          placeholder={placeholder}
          size={textareaSizes[size]}
          rows={fieldRows[size]}
          autoResize
          autoFocus={autoFocus}
          {...textareaProps}
          ref={fieldRefs}
          value={draft}
          disabled={disabled || textareaProps?.disabled}
          aria-autocomplete="list"
          aria-controls={open ? listId : textareaProps?.['aria-controls']}
          aria-activedescendant={open ? optionId(candidates[activeIndex]!) : undefined}
          onChange={handleChange}
          onSelect={handleSelect}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
        <div css={composerActionsStyle}>
          {cancelable ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => containerRef.current && onCancel?.(containerRef.current)}
            >
              {cancelLabel}
            </Button>
          ) : null}
          <Button
            variant="solid"
            tone="accent"
            size="sm"
            {...submitProps}
            disabled={disabled || submitProps?.disabled}
            aria-disabled={empty ? true : submitProps?.['aria-disabled']}
            loading={pending}
            data-action="submit"
            onClick={(event) => {
              submitProps?.onClick?.(event);
              if (!event.defaultPrevented) submit();
            }}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
      {open ? (
        <OverlayPortal>
          <div
            ref={refs.setFloating}
            id={listId}
            role="listbox"
            aria-label={mentionsLabel}
            data-ui={ui(owner, 'mentions')}
            style={floatingStyles}
            css={[listboxSurfaceStyle, listboxScrollStyle]}
          >
            {candidates.map((person, index) => (
              <div
                key={person.id}
                id={optionId(person)}
                role="option"
                aria-selected={index === activeIndex}
                data-active={index === activeIndex ? '' : undefined}
                data-ui={ui(owner, 'mention')}
                // Pressing an option must not move focus out of the field.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insert(person)}
                css={[listboxItemStyle, listboxItemStateStyle, suggestionStyle]}
              >
                <span aria-hidden="true" css={avatarColumnStyle}>
                  <Avatar name={person.name} src={person.avatar} size="sm" />
                </span>
                {person.name}
              </div>
            ))}
          </div>
        </OverlayPortal>
      ) : null}
    </div>
  );
}
