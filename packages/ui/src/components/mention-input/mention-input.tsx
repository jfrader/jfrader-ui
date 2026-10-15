'use client';

import {
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { flushSync } from 'react-dom';
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size as floatingSize,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useMergeRefs,
} from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { css, type SerializedStyles } from '../../styling/css';
import { inputControlStyle } from '../../styling/input-control';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { listboxSurfaceStyle, listboxItemStyle, listboxItemStateStyle } from '../../styling/listbox-style';
import type { SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { numberFormatter } from '../../utils/intl';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { FieldRoot, FieldLabel, FieldDescription, FieldError, useFieldAnatomy } from '../field/field-anatomy';
import { FieldSlot, type FieldSlots, type FieldParts } from '../field/field-slot';

export type MentionKind = 'person' | 'channel';
export interface Mention {
  readonly kind: MentionKind;
  readonly id: string;
  readonly label: string;
  readonly start: number;
  readonly end: number;
}
/** Immutable UTF-16 `[start,end)` offsets, matching textarea selection. */
export interface MentionValue {
  readonly text: string;
  readonly mentions: readonly Mention[];
}
export interface MentionPerson {
  id: string;
  name: string;
  role?: string;
  avatar?: ReactNode;
}
export interface MentionChannel {
  id: string;
  name: string;
  description?: string;
  members?: number;
}
export type MentionSuggestion = (MentionPerson & { kind: 'person' }) | (MentionChannel & { kind: 'channel' });
export interface MentionInputActions {
  insert(text: string): void;
  openSuggestions(kind: MentionKind): void;
  clear(): void;
}
export interface MentionInputMessages {
  peopleLabel: string;
  channelsLabel: string;
  results(count: number, kind: MentionKind): string;
  empty(kind: MentionKind, query: string): string;
  added(mention: Mention): string;
  removed(mention: Mention): string;
  invalidValue: string;
}
type MentionInputAnatomy = {
  /** Outer container wrapping the mention input and suggestions popup. */
  root: 'div';
  /** Label element associated with the input. */
  label: 'label';
  /** Container enclosing the textarea and backdrop highlight mirror. */
  control: 'div';
  /** Textarea control receiving user typing. */
  input: 'textarea';
  /** Backdrop container rendering highlighted mention tokens behind text. */
  mirror: 'div';
  /** Highlighted token span styling an inserted mention. */
  token: 'span';
  /** Floating popup panel holding the mention suggestions list. */
  panel: 'div';
  /** Listbox container rendering mention suggestion options. */
  list: 'div';
  /** Suggestion item representing a selectable person or channel. */
  option: 'div';
  /** Container displayed when no matching mention suggestions are found. */
  empty: 'div';
  /** Helper text element displayed below the input. */
  description: 'span';
  /** Validation error message displayed when invalid. */
  error: 'span';
  /** Screen-reader live region announcing mention results. */
  status: 'span';
};
export type MentionInputSlots = FieldSlots<MentionInputAnatomy>;
export type MentionInputSlotProps = FieldParts<MentionInputAnatomy>;

export interface MentionInputProps
  extends Omit<ComponentPropsWithRef<'textarea'>, 'value' | 'defaultValue' | 'onSubmit'>, SxProps {
  value?: MentionValue;
  defaultValue?: MentionValue;
  onValueChange?: (value: MentionValue) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  people?: readonly MentionPerson[];
  channels?: readonly MentionChannel[];
  onMentionAdd?: (mention: Mention) => void;
  onSubmit?: (value: MentionValue) => void;
  submitOnEnter?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  minRows?: number;
  maxRows?: number;
  maxSuggestions?: number;
  placement?: 'auto' | 'top' | 'bottom';
  locale?: Intl.LocalesArgument;
  messages?: Partial<MentionInputMessages>;
  renderSuggestion?: (item: MentionSuggestion, query: string) => ReactNode;
  actionsRef?: Ref<MentionInputActions>;
  /** Replace the wrapper div; `slots.root` takes precedence. */
  component?: MentionInputSlots['root'];
  /** Replace generated parts with components that forward props and ref. */
  slots?: MentionInputSlots;
  slotProps?: MentionInputSlotProps;
}

const EMPTY_VALUE: MentionValue = { text: '', mentions: [] };
declare const process: { env: { NODE_ENV?: string } };
const SYMBOL: Record<MentionKind, string> = { person: '@', channel: '#' };
const POPUP_GAP = 8;
const VIEWPORT_PADDING = 8;
function formatResults(count: number, numbers: Intl.NumberFormat, plurals: Intl.PluralRules): string {
  return `${numbers.format(count)} ${plurals.select(count) === 'one' ? 'result' : 'results'}`;
}
const DEFAULT_MESSAGES: MentionInputMessages = {
  peopleLabel: 'People',
  channelsLabel: 'Channels',
  results: (count) => formatResults(count, numberFormatter(), new Intl.PluralRules()),
  empty: () => 'No results',
  added: (mention) => `Added ${mentionText(mention.kind, mention.label)}`,
  removed: (mention) => `Removed ${mentionText(mention.kind, mention.label)}`,
  invalidValue: 'MentionInput: invalid token ranges were omitted.',
};

export function mentionText(kind: MentionKind, label: string): string {
  return `${SYMBOL[kind]}${label}`;
}

function validMentions(value: MentionValue): Mention[] {
  let end = 0;
  return value.mentions.filter((mention) => {
    const valid =
      Number.isInteger(mention.start) &&
      Number.isInteger(mention.end) &&
      mention.start >= end &&
      mention.end > mention.start &&
      mention.end <= value.text.length &&
      value.text.slice(mention.start, mention.end) === mentionText(mention.kind, mention.label);
    if (valid) end = mention.end;
    return valid;
  });
}

/** Omits invalid metadata and keeps plain text. The caller handles storage escaping. */
export function serializeMentions(
  value: MentionValue,
  format: (mention: Mention) => string = (mention) => `<${SYMBOL[mention.kind]}${mention.id}>`,
): string {
  let cursor = 0;
  let result = '';
  for (const mention of validMentions(value)) {
    result += value.text.slice(cursor, mention.start) + format(mention);
    cursor = mention.end;
  }
  return result + value.text.slice(cursor);
}

function equalValue(a: MentionValue, b: MentionValue): boolean {
  return (
    a.text === b.text &&
    a.mentions.length === b.mentions.length &&
    a.mentions.every((mention, index) => {
      const other = b.mentions[index];
      return (
        !!other &&
        mention.id === other.id &&
        mention.kind === other.kind &&
        mention.label === other.label &&
        mention.start === other.start &&
        mention.end === other.end
      );
    })
  );
}

function replace(value: MentionValue, start: number, end: number, text: string): MentionValue {
  const delta = text.length - (end - start);
  return {
    text: value.text.slice(0, start) + text + value.text.slice(end),
    mentions: validMentions(value).flatMap((mention) => {
      if (mention.end <= start) return [mention];
      if (mention.start >= end) return [{ ...mention, start: mention.start + delta, end: mention.end + delta }];
      return [];
    }),
  };
}

// Native history owns text, not token metadata. Every input (including undo/redo) reconciles
// surviving ranges and drops touched/stale tokens. Labels never reconstruct entity IDs.
interface NativeEdit {
  value: MentionValue;
  start: number;
  end: number;
  inputType: string;
}
function reconcile(value: MentionValue, text: string, edit: NativeEdit | null): MentionValue {
  if (edit && equalValue(edit.value, value) && !edit.inputType.startsWith('history')) {
    let { start, end } = edit;
    const deletedLength = value.text.length - text.length;
    if (start === end && deletedLength > 0) {
      if (edit.inputType.endsWith('Backward')) start = Math.max(0, start - deletedLength);
      if (edit.inputType.endsWith('Forward')) end = Math.min(value.text.length, end + deletedLength);
    }
    const insertedLength = text.length - value.text.length + end - start;
    if (insertedLength >= 0 && text.startsWith(value.text.slice(0, start)) && text.endsWith(value.text.slice(end))) {
      return replace(value, start, end, text.slice(start, start + insertedLength));
    }
  }
  let start = 0;
  while (start < value.text.length && start < text.length && value.text[start] === text[start]) start++;
  let end = value.text.length;
  let nextEnd = text.length;
  while (end > start && nextEnd > start && value.text[end - 1] === text[nextEnd - 1]) {
    end--;
    nextEnd--;
  }
  const next = replace(value, start, end, text.slice(start, nextEnd));
  return { text, mentions: validMentions(next) };
}

interface Trigger {
  kind: MentionKind;
  start: number;
  end: number;
  query: string;
}
function findTrigger(value: MentionValue, caret: number, people: boolean, channels: boolean): Trigger | null {
  if (value.mentions.some((mention) => caret > mention.start && caret <= mention.end)) return null;
  const prefix = value.text.slice(0, caret);
  const match = /(?:^|[\s([{'"“‘])([@#])([\p{L}\p{N}\p{M}_-]*)$/u.exec(prefix);
  if (!match) return null;
  const kind = match[1] === '@' ? 'person' : 'channel';
  if (!(kind === 'person' ? people : channels)) return null;
  const query = match[2] ?? '';
  const start = caret - query.length - 1;
  if (value.mentions.some((mention) => start < mention.end && caret > mention.start)) return null;
  return { kind, start, end: caret, query };
}
function positiveInteger(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.floor(value)) : fallback;
}

const metricsStyle = css({
  boxSizing: 'border-box',
  inlineSize: '100%',
  minInlineSize: 0,
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
  paddingBlock: vars.space[2],
  whiteSpace: 'pre-wrap',
  overflowWrap: 'break-word',
  tabSize: 4,
});
const rootLayoutStyle = css({ minInlineSize: 0, maxInlineSize: '100%', overflowWrap: 'anywhere' });
const sizeStyles: Record<'sm' | 'md' | 'lg', SerializedStyles> = {
  sm: css({ paddingInline: vars.space[3], fontSize: vars.textSize.sm }),
  md: css({ paddingInline: vars.space[4], fontSize: vars.textSize.sm }),
  lg: css({ paddingInline: vars.space[4], fontSize: vars.textSize.md }),
};
const shellStyle = css({ position: 'relative', minInlineSize: 0, borderRadius: vars.radius.sm });
const inputStyle = css({
  display: 'block',
  resize: 'none',
  borderRadius: vars.radius.sm,
  minBlockSize: vars.space[8],
  backgroundColor: 'transparent',
  color: 'transparent',
  caretColor: vars.color.text,
  position: 'relative',
  '&::placeholder': { color: vars.color.textMuted },
  [FORCED_COLORS]: {
    color: 'CanvasText',
    caretColor: 'CanvasText',
    backgroundColor: 'Canvas',
  },
});
const mirrorStyle = css({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  overflow: 'hidden',
  // Reserves the textarea's control border so both layers lay text out on the same box.
  border: '1px solid transparent',
  borderRadius: vars.radius.sm,
  color: vars.color.text,
  backgroundColor: vars.color.surface,
  [FORCED_COLORS]: { visibility: 'hidden' },
});
const tokenStyle = css({
  color: vars.color.accentText,
  backgroundColor: vars.color.accentSoft,
  borderRadius: vars.radius.sm,
});
const panelStyle = css({
  minInlineSize: 0,
  overflow: 'auto',
  transitionProperty: 'opacity',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  '@starting-style': { opacity: 0 },
  opacity: 1,
  [REDUCED_MOTION]: { transitionDuration: '0s' },
});
const listStyle = css({ display: 'grid', minInlineSize: 0 });
const optionStyle = css({
  overflowWrap: 'anywhere',
  flexDirection: 'column',
  alignItems: 'start',
  [FORCED_COLORS]: { '&[aria-selected="true"]': { outline: '2px solid Highlight' } },
});
const metadataStyle = css({ color: vars.color.textMuted, fontSize: vars.textSize.sm });
const suggestionNameStyle = css({ display: 'inline-flex', alignItems: 'center', gap: vars.space[2] });
const emptyStyle = css({ padding: vars.space[2], color: vars.color.textMuted, fontSize: vars.textSize.sm });

/** Write a message and mention people with @ or channels with #.
 * The textarea keeps multiline semantics and DOM focus inside a combobox wrapper.
 * Enter/Tab insert a result; Space edits; Shift+Tab leaves; Home/End move the caret; Escape dismisses.
 * Pair input/mirror metric overrides. Native text undo depends on the browser; stale metadata is dropped.
 * Use for message-sized documents, not rich-text editing. */
export function MentionInput({
  ref,
  actionsRef,
  value: valueProp,
  defaultValue = EMPTY_VALUE,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  people,
  channels,
  onMentionAdd,
  onSubmit,
  submitOnEnter = false,
  label,
  description,
  error,
  size = 'md',
  minRows = 1,
  maxRows = 8,
  maxSuggestions = 6,
  placement = 'auto',
  locale,
  messages,
  renderSuggestion,
  component,
  slots,
  slotProps,
  className,
  sx,
  id,
  dir,
  required,
  disabled,
  readOnly,
  onChange,
  onInput,
  onKeyDown,
  onSelect,
  onFocus,
  onBlur,
  onScroll,
  onCompositionStart,
  onCompositionEnd,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  ...rest
}: MentionInputProps) {
  const baseId = useId();
  const field = useFieldAnatomy({
    id,
    description,
    error,
    'aria-describedby': describedBy,
    'aria-invalid': invalid,
  });
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const caretRef = useRef<HTMLSpanElement | null>(null);
  const [accepted = EMPTY_VALUE, requestValue, resetValue] = useControlledState(valueProp, defaultValue, onValueChange);
  const acceptedRef = useRef(accepted);
  const initialText = useRef(accepted.text);
  acceptedRef.current = accepted;
  const mentions = validMentions(accepted);
  const documentValue = { text: accepted.text, mentions };
  const [permission = false, requestOpen] = useControlledState(openProp, defaultOpen, onOpenChange);
  const [focused, setFocused] = useState(false);
  const [composing, setComposing] = useState(false);
  const compositionRef = useRef(false);
  const [caret, setCaret] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(0);
  const [announcement, setAnnouncement] = useState('');
  const transactionRef = useRef(false);
  const nativeEditRef = useRef<NativeEdit | null>(null);
  const trigger = findTrigger(documentValue, caret, people !== undefined, channels !== undefined);
  const effectiveOpen = permission && focused && !!trigger && !disabled && !readOnly && !composing;
  const formatter = numberFormatter(locale);
  const plurals = new Intl.PluralRules(locale);
  const copy = {
    ...DEFAULT_MESSAGES,
    results: (count: number) => formatResults(count, formatter, plurals),
    ...messages,
  };
  const collator = new Intl.Collator(locale, { sensitivity: 'base', usage: 'search' });
  const segmenter = new Intl.Segmenter(locale, { granularity: 'grapheme' });
  const items: MentionSuggestion[] =
    trigger?.kind === 'person'
      ? (people ?? []).map((item) => ({ ...item, kind: 'person' }))
      : (channels ?? []).map((item) => ({ ...item, kind: 'channel' }));
  const matches = items
    .filter(
      (item) =>
        !trigger?.query ||
        Array.from(segmenter.segment(item.name)).some(
          ({ index }) => collator.compare(item.name.slice(index, index + trigger.query.length), trigger.query) === 0,
        ),
    )
    .sort((a, b) => collator.compare(a.name, b.name))
    .slice(0, positiveInteger(maxSuggestions, 6));
  const active = activeIndex !== null && matches[activeIndex] ? activeIndex : matches.length ? 0 : null;
  const optionRefs = useRef<Array<HTMLElement | null>>([]);
  optionRefs.current.length = matches.length;
  const floating = useFloating<HTMLTextAreaElement>({
    open: effectiveOpen,
    onOpenChange: requestOpen,
    placement: placement === 'top' ? 'top-start' : 'bottom-start',
    middleware: effectiveOpen
      ? [
          offset(POPUP_GAP),
          ...(placement === 'auto' ? [flip({ padding: VIEWPORT_PADDING })] : []),
          shift({ padding: VIEWPORT_PADDING, crossAxis: true }),
          floatingSize({
            padding: VIEWPORT_PADDING,
            apply: ({ availableWidth, availableHeight, elements }) => {
              const width = textRef.current?.clientWidth ?? availableWidth;
              Object.assign(elements.floating.style, {
                maxWidth: `${Math.min(width, Math.max(0, availableWidth))}px`,
                width: `${width}px`,
                maxHeight: `${Math.max(0, availableHeight)}px`,
              });
            },
          }),
        ]
      : [],
    whileElementsMounted: autoUpdate,
  });
  const navigation = useListNavigation(floating.context, {
    enabled: effectiveOpen,
    listRef: optionRefs,
    activeIndex: active,
    onNavigate: setActiveIndex,
    virtual: true,
    loop: true,
    focusItemOnOpen: false,
  });
  const dismiss = useDismiss(floating.context, { enabled: effectiveOpen, escapeKey: false });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([navigation, dismiss]);
  const referenceProps = getReferenceProps();
  const ariaLabelledBy = [labelledBy, isRenderable(label) && `${baseId}-label`].filter(Boolean).join(' ') || undefined;
  const mergedRef = useMergeRefs([ref, textRef, floating.refs.setReference]);
  const rowsMin = positiveInteger(minRows, 1);
  const rowsMax = Math.max(rowsMin, positiveInteger(maxRows, 8));

  const syncCaret = () => {
    const input = textRef.current;
    if (!input) return;
    setCaret(input.selectionStart === input.selectionEnd ? input.selectionStart : -1);
    if (mirrorRef.current) {
      mirrorRef.current.scrollTop = input.scrollTop;
      mirrorRef.current.scrollLeft = input.scrollLeft;
    }
    floating.update();
  };
  const requestDocument = (next: MentionValue, nextCaret: number) => {
    if (equalValue(acceptedRef.current, next)) return true;
    flushSync(() => requestValue(next));
    const acceptedNext = equalValue(acceptedRef.current, next);
    const input = textRef.current;
    if (input) {
      if (input.value !== acceptedRef.current.text) input.value = acceptedRef.current.text;
      const position = acceptedNext
        ? nextCaret
        : Math.min(caret < 0 ? input.selectionStart : caret, acceptedRef.current.text.length);
      if (!compositionRef.current) input.setSelectionRange(position, position);
      syncCaret();
    }
    return acceptedNext;
  };
  const write = (start: number, end: number, text: string, next: MentionValue) => {
    const input = textRef.current;
    if (!input || disabled || readOnly) return;
    if (equalValue(acceptedRef.current, next)) return;
    const previousCaret = input.selectionStart;
    // Request first, so a controlled rejection never mutates the native document or history.
    // Keep the DOM untouched during acceptance; the native edit then owns its undo entry.
    transactionRef.current = true;
    flushSync(() => requestValue(next));
    const acceptedNext = equalValue(acceptedRef.current, next);
    // execCommand is a compatibility path for native text history, not a metadata-undo guarantee.
    // Engines that reject it use setRangeText; that fallback has no native undo guarantee.
    if (acceptedNext) {
      input.setSelectionRange(start, end);
      let inserted = false;
      try {
        if (input.ownerDocument.activeElement === input) {
          inserted = input.ownerDocument.execCommand('insertText', false, text);
        }
      } catch {
        /* unsupported engine */
      }
      if (!inserted || input.value !== next.text) input.setRangeText(text, start, end, 'end');
    }
    transactionRef.current = false;
    if (input.value !== acceptedRef.current.text) input.value = acceptedRef.current.text;
    const position = acceptedNext ? start + text.length : Math.min(previousCaret, acceptedRef.current.text.length);
    input.setSelectionRange(position, position);
    syncCaret();
  };
  const insertText = (text: string) => {
    const input = textRef.current;
    if (!input || disabled || readOnly) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    write(start, end, text, replace(documentValue, start, end, text));
  };
  const selectSuggestion = (item: MentionSuggestion) => {
    if (!trigger || disabled || readOnly || compositionRef.current) return;
    const tokenText = mentionText(item.kind, item.name);
    const text = tokenText + (/^\s/u.test(accepted.text.slice(trigger.end)) ? '' : ' ');
    const mention: Mention = {
      kind: item.kind,
      id: item.id,
      label: item.name,
      start: trigger.start,
      end: trigger.start + tokenText.length,
    };
    const next = replace(documentValue, trigger.start, trigger.end, text);
    write(trigger.start, trigger.end, text, {
      text: next.text,
      mentions: [...next.mentions, mention].sort((a, b) => a.start - b.start),
    });
    onMentionAdd?.(mention);
    setAnnouncement(copy.added(mention));
    requestOpen(false);
  };
  useImperativeHandle(actionsRef, () => ({
    insert: insertText,
    clear: () => {
      if (disabled || readOnly) return;
      write(0, accepted.text.length, '', EMPTY_VALUE);
      requestOpen(false);
    },
    openSuggestions: (kind) => {
      if (disabled || readOnly || !(kind === 'person' ? people : channels)) return;
      insertText(SYMBOL[kind]);
      requestOpen(true);
    },
  }));

  useLayoutEffect(() => {
    if (mentions.length !== accepted.mentions.length && process.env.NODE_ENV !== 'production')
      console.warn(copy.invalidValue);
  }, [accepted, copy.invalidValue, mentions.length]);
  useLayoutEffect(() => {
    const input = textRef.current;
    if (!input) return;
    const beforeInput = (event: InputEvent) => {
      nativeEditRef.current = transactionRef.current
        ? null
        : {
            value: acceptedRef.current,
            start: input.selectionStart,
            end: input.selectionEnd,
            inputType: event.inputType,
          };
    };
    input.addEventListener('beforeinput', beforeInput);
    return () => input.removeEventListener('beforeinput', beforeInput);
  }, []);
  useLayoutEffect(() => {
    const input = textRef.current;
    const mirror = mirrorRef.current;
    if (!input || !mirror) return;
    const measure = () => {
      const styles = input.ownerDocument.defaultView!.getComputedStyle(input);
      const lineHeight = parseFloat(styles.lineHeight);
      const padding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const borders = parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);
      input.style.height = '0px';
      input.style.height = `${Math.min(Math.max(input.scrollHeight + borders, rowsMin * lineHeight + padding + borders), rowsMax * lineHeight + padding + borders)}px`;
      mirror.style.width = `${input.clientWidth + borders}px`;
      mirror.scrollTop = input.scrollTop;
      mirror.scrollLeft = input.scrollLeft;
      floating.refs.setPositionReference({
        contextElement: input,
        getBoundingClientRect: () => caretRef.current?.getBoundingClientRect() ?? input.getBoundingClientRect(),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(input);
    let mounted = true;
    void input.ownerDocument.fonts?.ready.then(() => {
      if (mounted) measure();
    });
    return () => {
      mounted = false;
      observer.disconnect();
    };
  }, [accepted.text, caret, size, rowsMin, rowsMax, floating.refs]);
  useLayoutEffect(() => {
    const input = textRef.current;
    const form = input?.form;
    if (!input || !form) return;
    const reset = (event: Event) => {
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        flushSync(() => resetValue());
        if (input.value !== acceptedRef.current.text) input.value = acceptedRef.current.text;
        requestOpen(false);
        setCaret(0);
      });
    };
    form.addEventListener('reset', reset);
    return () => form.removeEventListener('reset', reset);
  }, [resetValue, requestOpen, rest.form]);

  const snapSelection = () => {
    const input = textRef.current;
    if (!input || compositionRef.current || transactionRef.current) return;
    let start = input.selectionStart;
    let end = input.selectionEnd;
    for (const mention of mentions) {
      if (start === end && start > mention.start && start < mention.end) {
        start = end = start - mention.start < mention.end - start ? mention.start : mention.end;
      } else {
        if (start > mention.start && start < mention.end) start = mention.start;
        if (end > mention.start && end < mention.end) end = mention.end;
      }
    }
    if (start !== input.selectionStart || end !== input.selectionEnd)
      input.setSelectionRange(start, end, input.selectionDirection);
    syncCaret();
  };
  const painted: ReactNode[] = [];
  let cursor = 0;
  useLayoutEffect(() => {
    const input = textRef.current;
    if (!input) return;
    if (!transactionRef.current && input.value !== accepted.text) {
      const { selectionStart, selectionEnd, selectionDirection } = input;
      input.value = accepted.text;
      input.setSelectionRange(
        Math.min(selectionStart, accepted.text.length),
        Math.min(selectionEnd, accepted.text.length),
        selectionDirection,
      );
    }
    const select = () => snapSelection();
    input.addEventListener('select', select);
    return () => input.removeEventListener('select', select);
  });
  const paintText = (text: string, start: number) => {
    if (caret >= start && caret <= start + text.length) {
      const split = caret - start;
      return (
        <>
          {text.slice(0, split)}
          <span ref={caretRef}>{'\u200b'}</span>
          {text.slice(split)}
        </>
      );
    }
    return text;
  };
  for (const mention of mentions) {
    painted.push(<span key={`text-${cursor}`}>{paintText(accepted.text.slice(cursor, mention.start), cursor)}</span>);
    painted.push(
      <FieldSlot
        element="span"
        component={slots?.token}
        slotProps={slotProps?.token}
        data-ui="mention-input-token"
        key={`${mention.start}-${mention.end}`}
        styles={[tokenStyle]}
      >
        {mentionText(mention.kind, mention.label)}
      </FieldSlot>,
    );
    cursor = mention.end;
  }
  painted.push(
    <span key="tail">
      {paintText(accepted.text.slice(cursor), cursor)}
      {'\n\u200b'}
    </span>,
  );
  return (
    <FieldRoot
      style={rest.style}
      title={rest.title}
      component={slots?.root ?? component}
      data-ui="mention-input"
      dir={dir}
      className={className}
      sx={sx}
      part={{ ...slotProps?.root, css: [rootLayoutStyle, slotProps?.root?.css] }}
    >
      <FieldLabel
        component={slots?.label}
        id={`${baseId}-label`}
        htmlFor={field.id}
        required={required}
        part={slotProps?.label}
      >
        {label}
      </FieldLabel>
      <FieldSlot
        element="div"
        component={slots?.control}
        slotProps={slotProps?.control}
        role="combobox"
        aria-label={rest['aria-label']}
        aria-labelledby={ariaLabelledBy}
        aria-haspopup="listbox"
        aria-expanded={effectiveOpen}
        aria-controls={effectiveOpen ? `${baseId}-list` : undefined}
        styles={[shellStyle]}
      >
        <FieldSlot
          element="div"
          component={slots?.mirror}
          slotProps={slotProps?.mirror}
          ref={mirrorRef}
          aria-hidden="true"
          dir={dir}
          styles={[metricsStyle, sizeStyles[size], mirrorStyle]}
        >
          {painted}
        </FieldSlot>
        <FieldSlot
          element="textarea"
          component={slots?.input}
          slotProps={slotProps?.input}
          {...referenceProps}
          {...rest}
          onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
            onKeyDown?.(event);
            if (
              event.defaultPrevented ||
              disabled ||
              readOnly ||
              compositionRef.current ||
              event.nativeEvent.isComposing ||
              event.keyCode === 229
            )
              return;
            const plain = !event.ctrlKey && !event.metaKey && !event.altKey;
            if (
              plain &&
              (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
              typeof referenceProps.onKeyDown === 'function'
            )
              referenceProps.onKeyDown(event);
            if (event.key === 'Escape' && effectiveOpen) {
              event.preventDefault();
              requestOpen(false);
            } else if (
              plain &&
              !event.shiftKey &&
              effectiveOpen &&
              active !== null &&
              (event.key === 'Enter' || event.key === 'Tab')
            ) {
              event.preventDefault();
              const item = matches[active];
              if (!event.repeat && item) selectSuggestion(item);
            } else if (event.key === 'Tab') requestOpen(false);
            else if (event.key === 'Enter' && plain && !event.shiftKey && submitOnEnter) {
              event.preventDefault();
              if (!event.repeat && accepted.text.trim()) onSubmit?.(accepted);
            } else if (
              plain &&
              !event.shiftKey &&
              event.currentTarget.selectionStart === event.currentTarget.selectionEnd
            ) {
              const position = event.currentTarget.selectionStart;
              const deleting =
                event.key === 'Backspace'
                  ? mentions.find((mention) => mention.end === position)
                  : event.key === 'Delete'
                    ? mentions.find((mention) => mention.start === position)
                    : undefined;
              if (deleting) {
                event.preventDefault();
                write(deleting.start, deleting.end, '', replace(documentValue, deleting.start, deleting.end, ''));
                setAnnouncement(copy.removed(deleting));
              }
              const jumping =
                event.key === 'ArrowLeft'
                  ? mentions.find((mention) => mention.end === position)
                  : event.key === 'ArrowRight'
                    ? mentions.find((mention) => mention.start === position)
                    : undefined;
              if (jumping) {
                event.preventDefault();
                const next = event.key === 'ArrowLeft' ? jumping.start : jumping.end;
                event.currentTarget.setSelectionRange(next, next);
                syncCaret();
              }
            }
          }}
          ref={mergedRef}
          id={field.id}
          dir={dir}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          rows={rowsMin}
          defaultValue={initialText.current}
          aria-multiline="true"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-controls={effectiveOpen ? `${baseId}-list` : undefined}
          aria-activedescendant={effectiveOpen && active !== null ? `${baseId}-option-${active}` : undefined}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={field.describedBy}
          aria-invalid={field.ariaInvalid}
          styles={[inputControlStyle, metricsStyle, sizeStyles[size], inputStyle]}
          onChange={onChange}
          onInput={(event) => {
            onInput?.(event);
            const edit = nativeEditRef.current;
            nativeEditRef.current = null;
            if (transactionRef.current) return;
            const position = event.currentTarget.selectionStart;
            const next = reconcile(documentValue, event.currentTarget.value, edit);
            requestDocument(next, position);
            if (!compositionRef.current) {
              setActiveIndex(0);
              if (findTrigger(next, position, people !== undefined, channels !== undefined)) requestOpen(true);
            }
          }}
          onSelect={(event) => {
            onSelect?.(event);
            snapSelection();
          }}
          onFocus={(event) => {
            onFocus?.(event);
            setFocused(true);
            syncCaret();
            if (
              findTrigger(
                documentValue,
                event.currentTarget.selectionStart,
                people !== undefined,
                channels !== undefined,
              )
            )
              requestOpen(true);
          }}
          onBlur={(event) => {
            onBlur?.(event);
            setFocused(false);
            requestOpen(false);
          }}
          onScroll={(event) => {
            onScroll?.(event);
            syncCaret();
          }}
          onCompositionStart={(event) => {
            onCompositionStart?.(event);
            compositionRef.current = true;
            setComposing(true);
          }}
          onCompositionEnd={(event) => {
            onCompositionEnd?.(event);
            compositionRef.current = false;
            setComposing(false);
            syncCaret();
            if (
              findTrigger(
                acceptedRef.current,
                event.currentTarget.selectionStart,
                people !== undefined,
                channels !== undefined,
              )
            )
              requestOpen(true);
          }}
        />
      </FieldSlot>
      <FieldDescription component={slots?.description} id={field.descriptionId} part={slotProps?.description}>
        {description}
      </FieldDescription>
      <FieldError component={slots?.error} id={field.errorId} part={slotProps?.error}>
        {error}
      </FieldError>
      <FieldSlot
        element="span"
        component={slots?.status}
        slotProps={slotProps?.status}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        styles={[visuallyHiddenStyle]}
      >
        {effectiveOpen && trigger
          ? matches.length
            ? copy.results(matches.length, trigger.kind)
            : copy.empty(trigger.kind, trigger.query)
          : announcement}
      </FieldSlot>
      {effectiveOpen && trigger && (
        <OverlayPortal>
          <FieldSlot
            element="div"
            component={slots?.panel}
            slotProps={slotProps?.panel}
            ref={floating.refs.setFloating}
            style={floating.floatingStyles}
            dir={dir}
            styles={[listboxSurfaceStyle, panelStyle]}
          >
            <FieldSlot
              element="div"
              component={slots?.list}
              slotProps={slotProps?.list}
              {...getFloatingProps()}
              role="listbox"
              id={`${baseId}-list`}
              aria-label={trigger.kind === 'person' ? copy.peopleLabel : copy.channelsLabel}
              styles={[listStyle]}
            >
              {matches.map((item, index) => (
                <FieldSlot
                  element="div"
                  component={slots?.option}
                  slotProps={slotProps?.option}
                  {...getItemProps({
                    onClick: () => selectSuggestion(item),
                    onMouseDown: (event) => event.preventDefault(),
                    onMouseMove: () => setActiveIndex(index),
                  })}
                  key={`${item.kind}-${item.id}`}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  id={`${baseId}-option-${index}`}
                  role="option"
                  aria-selected={active === index}
                  data-active={active === index ? '' : undefined}
                  styles={[listboxItemStyle, listboxItemStateStyle, optionStyle]}
                >
                  {renderSuggestion ? (
                    renderSuggestion(item, trigger.query)
                  ) : (
                    <>
                      <span css={suggestionNameStyle}>
                        {item.kind === 'person' && isRenderable(item.avatar) && (
                          <span aria-hidden="true">{item.avatar}</span>
                        )}
                        {item.name}
                      </span>
                      <span css={metadataStyle}>
                        {item.kind === 'person'
                          ? item.role
                          : (item.description ?? (item.members === undefined ? null : formatter.format(item.members)))}
                      </span>
                    </>
                  )}
                </FieldSlot>
              ))}
            </FieldSlot>
            {!matches.length && (
              <FieldSlot element="div" component={slots?.empty} slotProps={slotProps?.empty} styles={[emptyStyle]}>
                {copy.empty(trigger.kind, trigger.query)}
              </FieldSlot>
            )}
          </FieldSlot>
        </OverlayPortal>
      )}
    </FieldRoot>
  );
}
MentionInput.displayName = 'MentionInput';
