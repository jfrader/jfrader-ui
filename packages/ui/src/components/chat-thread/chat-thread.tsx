'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ComponentPropsWithRef, type ComponentType } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { REDUCED_MOTION } from '../../styling/media';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { PresentationSlot, type PresentationProps } from '../../utils/presentation-slot';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { focusRingOutset } from '../../styling/focus-ring';
import { dateTimeFormatter } from '../../utils/intl';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button } from '../button';
import {
  DEFAULT_TIME_ZONE,
  formatCount,
  resolveFormatters,
  toEpoch,
  uniqueBy,
  validEpoch,
  type ThreadFormatters,
} from '../thread/thread-core';
import {
  ThreadComposer,
  threadSizeStyles,
  type ThreadButtonProps,
  type ThreadPartProps,
  type ThreadReactionLabels,
  type ThreadSize,
  type ThreadTextareaProps,
} from '../thread/thread-parts';
import { acceptsFile, fileSize } from '../../utils/attachment';
import {
  ChatMessageView,
  reactToChatMessage,
  DEFAULT_CHAT_EMOJI,
  defaultChatMessageLabels,
  fadeStyle,
  rowStyle,
  errorStyle,
  previewStyle,
  fileStyle,
  type ChatAttachment,
  type ChatMessage,
  type ChatMessageStatus,
  type ChatParticipant,
  type ChatReaction,
} from '../chat-message/chat-message';

export type {
  ChatAttachment,
  ChatMessage,
  ChatMessageStatus,
  ChatParticipant,
  ChatReaction,
} from '../chat-message';
export type ChatThreadSize = ThreadSize;
export interface ChatDraft {
  text: string;
  files: File[];
}
export type ChatThreadEvent =
  | { type: 'send'; message: ChatMessage; draft: ChatDraft }
  | { type: 'react'; id: string; emoji: string; added: boolean };
export interface ChatThreadLabels extends ThreadReactionLabels {
  conversation: string;
  transcript: string;
  composer: string;
  placeholder: string;
  send: string;
  attach: string;
  attachments: string;
  sending: string;
  sent: string;
  delivered: string;
  read: string;
  failed: string;
  retry: string;
  jumpToLatest: string;
  unknownAuthor: string;
  empty: string;
  invalidTime: string;
  sendFailed: string;
  removeFile: (name: string) => string;
  readBy: (names: string) => string;
  typing: (names: string) => string;
  newMessages: (count: number) => string;
  showAttachments: (count: number) => string;
  fileRejected: (reason: 'type' | 'size' | 'count', name: string) => string;
}
type ChatThreadPart =
  | /** Container constraining the scrollable chat thread view. */
    'viewport'
  | /** Scroller element managing message log scroll position. */
    'scroller'
  | /** Message log container holding thread messages and alerts. */
    'log'
  | /** List element rendering chat message items. */
    'list'
  | /** Message item element wrapping an individual chat message. */
    'message'
  | /** Container bubble holding message body content. */
    'bubble'
  | /** Timestamp element displaying when the message was sent. */
    'time'
  | /** Container rendering message file attachments. */
    'attachments'
  | /** Delivery receipt element displaying message status. */
    'receipt'
  | /** Reaction button element displaying an emoji reaction. */
    'reaction';
export type ChatThreadSlotProps = Partial<Record<ChatThreadPart, ThreadPartProps>> & {
  /** Props for the outer div. */
  root?: Omit<PresentationProps<'div'>, 'children'>;
  /** Floating button that scrolls the thread to the latest message. */
  jumpButton?: ThreadButtonProps;
};
export type ChatThreadComposerSlotProps = Partial<
  Record<
    | /** Tray container holding staged attachment items. */
      'tray'
    | /** Attachment item preview chip in the composer tray. */
      'file'
    | /** Error message element displaying validation or upload errors. */
      'error',
    ThreadPartProps
  >
> & {
  /** Form element wrapping composer inputs and action buttons. */
  form?: ComponentPropsWithRef<'form'>;
  /** Multiline textarea input for typing messages. */
  textarea?: ThreadTextareaProps;
  /** Button element opening the file attachment picker. */
  attachButton?: ThreadButtonProps;
  /** Hidden file input element handling attachment selection. */
  fileInput?: Omit<ComponentPropsWithRef<'input'>, 'type' | 'multiple' | 'accept' | 'disabled'>;
  /** Button element removing a staged attachment from the tray. */
  removeButton?: ThreadButtonProps;
  /** Button element submitting and sending the message. */
  sendButton?: ThreadButtonProps;
};
export interface ChatThreadComposerProps extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange' | 'children'>, SxProps {
  value?: ChatDraft;
  defaultValue?: ChatDraft;
  onValueChange?: (draft: ChatDraft) => void;
  onSend: (draft: ChatDraft) => void | Promise<void>;
  allowAttachments?: boolean;
  accept?: string;
  maxFiles?: number;
  maxFileSize?: number;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  locale?: Intl.LocalesArgument;
  size?: ChatThreadSize;
  labels?: Partial<ChatThreadLabels>;
  slotProps?: ChatThreadComposerSlotProps;
  slots?: ChatThreadComposerSlots;
}

export interface ChatThreadComposerSlots {
    /** Displays the message field. */
    textarea?: ComponentType<ThreadTextareaProps>;
    /** Sends the message. */
    sendButton?: ComponentType<ThreadButtonProps>;
    /** Lists staged attachments. */
    tray?: ComponentType<ThreadPartProps>;
    /** Displays a staged attachment. */
    file?: ComponentType<ThreadPartProps>;
    /** Displays an attachment error. */
    error?: ComponentType<ThreadPartProps>;
    /** Holds the message fields and actions. */
    form?: ComponentType<NonNullable<ChatThreadComposerSlotProps['form']>>;
    /** Opens the attachment picker. */
    attachButton?: ComponentType<ThreadButtonProps>;
    /** Selects attachment files. */
    fileInput?: ComponentType<NonNullable<ChatThreadComposerSlotProps['fileInput']>>;
    /** Removes a staged attachment. */
    removeButton?: ComponentType<ThreadButtonProps>;
}
export interface ChatThreadProps extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange' | 'children'>, SxProps {
  participants: readonly ChatParticipant[];
  currentUserId: string;
  value?: readonly ChatMessage[];
  defaultValue?: readonly ChatMessage[];
  onValueChange?: (next: ChatMessage[], event: ChatThreadEvent) => void;
  now: number;
  locale?: Intl.LocalesArgument;
  timeZone?: string;
  typing?: readonly string[];
  readBy?: Readonly<Record<string, string>>;
  onSend?: (draft: ChatDraft) => void | Promise<void>;
  onReact?: (id: string, emoji: string) => void;
  onRetry?: (id: string) => void | Promise<void>;
  reactions?: readonly string[];
  groupWindow?: number;
  composer?: boolean;
  disabled?: boolean;
  composerProps?: Omit<ChatThreadComposerProps, 'onSend'>;
  getNewId?: () => string;
  size?: ChatThreadSize;
  labels?: Partial<ChatThreadLabels>;
  slotProps?: ChatThreadSlotProps;
  slots?: ChatThreadSlots;
  /** Shorthand for slots.root; slots.root takes precedence. */
  component?: ChatThreadSlots['root'];
}

export interface ChatThreadSlots {
    /** Replaces the outer div; forwards its props, ref and className. */
    root?: ComponentType<ComponentPropsWithRef<'div'>>;
    /** Holds the scrollable viewport. */
    viewport?: ComponentType<ThreadPartProps>;
    /** Lists the message attachments. */
    attachments?: ComponentType<ThreadPartProps & ComponentPropsWithRef<'ul'>>;
    /** Holds the scrollable transcript. */
    scroller?: ComponentType<ThreadPartProps>;
    /** Announces arriving messages. */
    log?: ComponentType<ThreadPartProps>;
    /** Lists the conversation messages. */
    list?: ComponentType<ThreadPartProps>;
    /** Holds a message and its day heading. */
    message?: ComponentType<ThreadPartProps>;
    /** Holds the message body. */
    bubble?: ComponentType<ThreadPartProps>;
    /** Displays the message timestamp. */
    time?: ComponentType<ThreadPartProps>;
    /** Displays the delivery receipt. */
    receipt?: ComponentType<ThreadPartProps>;
    /** Holds the message reactions. */
    reaction?: ComponentType<ThreadPartProps>;
    /** Scrolls to the latest message. */
    jumpButton?: ComponentType<ThreadButtonProps>;
}

const UI = 'chat-thread';
const EMPTY_MESSAGES: readonly ChatMessage[] = [];
const EMPTY_DRAFT: ChatDraft = { text: '', files: [] };
const EMPTY_IDS: readonly string[] = [];
const EMPTY_REACTIONS: readonly ChatReaction[] = [];
const GROUP_WINDOW = 300_000;
const PIN_THRESHOLD = 48;
const MAX_FILES = 10;
const newId = () => crypto.randomUUID();

function defaultLabels(format: ThreadFormatters): ChatThreadLabels {
  const count = (n: number, one: string, other: string) => formatCount(format, n, one, other);
  return {
    ...defaultChatMessageLabels(format),
    conversation: 'Conversation',
    transcript: 'Conversation transcript',
    composer: 'Message',
    placeholder: 'Write a message',
    send: 'Send',
    attach: 'Attach files',
    removeFile: (name) => `Remove ${name}`,
    jumpToLatest: 'Jump to latest',
    empty: 'No messages yet',
    sendFailed: 'Message could not be sent',
    typing: (names) => `Typing: ${names}`,
    newMessages: (n) => count(n, 'new message', 'new messages'),
    fileRejected: (reason, name) => ({
      type: `${name}: file type not accepted`,
      size: `${name}: file too large`,
      count: `${name}: too many files`,
    })[reason],
  };
}

const rootStyle = css({
  display: 'flex',
  flexDirection: 'column',
  minBlockSize: 0,
  minInlineSize: 0,
  blockSize: '100%',
  gap: vars.space[3],
  containerType: 'inline-size',
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
});
const viewportStyle = css({ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minBlockSize: 0, gap: vars.space[2] });
const scrollerStyle = css({
  overflowY: 'auto',
  overflowAnchor: 'none',
  minBlockSize: 0,
  flex: '1 1 auto',
  padding: vars.space[3],
  '&:focus-visible': focusRingOutset,
});
const listStyle = css({ display: 'flex', flexDirection: 'column', gap: vars.space[4], listStyle: 'none', margin: 0, padding: 0 });
const compactListStyle = css({ gap: vars.space[2] });
const messageStyle = css({
  minInlineSize: 0,
  inlineSize: '100%',
  display: 'grid',
  '&[data-grouped="true"]': { marginBlockStart: `calc(-1 * ${vars.space[2]})` },
});
const dateStyle = css({ marginBlock: vars.space[3], fontSize: vars.textSize.xs, fontWeight: vars.fontWeight.medium, textAlign: 'center', color: vars.color.textMuted });
const composerRootStyle = css({ display: 'grid', gap: vars.space[2], minInlineSize: 0, flexShrink: 0 });
const trayStyle = css({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2], margin: 0, padding: vars.space[2], listStyle: 'none', maxBlockSize: '12rem', overflow: 'auto' });
const textareaControlStyle = css({ maxBlockSize: `calc(6lh + 2 * ${vars.space[2]})`, overflowY: 'auto' });
const typingStyle = css({ color: vars.color.textMuted, transitionProperty: 'opacity', transitionDuration: vars.motion.duration.base, [REDUCED_MOTION]: { transitionDuration: '0s' } });
const jumpStyle = css({ alignSelf: 'center' });

function useFilePreviews(files: readonly File[]) {
  const registry = useRef(new Map<File, string>());
  const [urls, setUrls] = useState<ReadonlyMap<File, string>>(new Map());
  useLayoutEffect(() => {
    const wanted = new Set(files.filter((file) => file.type.startsWith('image/')));
    for (const [file, url] of registry.current) {
      if (!wanted.has(file)) {
        URL.revokeObjectURL(url);
        registry.current.delete(file);
      }
    }
    for (const file of wanted) if (!registry.current.has(file)) registry.current.set(file, URL.createObjectURL(file));
    setUrls(new Map(registry.current));
  }, [files]);
  useEffect(() => () => {
    for (const url of registry.current.values()) URL.revokeObjectURL(url);
    registry.current.clear();
  }, []);
  return urls;
}

type ComposerInternalProps = Omit<ChatThreadComposerProps, 'onSend'> & {
  onSend: (draft: ChatDraft) => void | boolean | Promise<void | boolean>;
  acknowledged?: ChatDraft | null;
  onDraftInteraction?: () => void;
};

function ChatComposer({
  ref,
  value,
  defaultValue = EMPTY_DRAFT,
  onValueChange,
  onSend,
  acknowledged,
  onDraftInteraction,
  allowAttachments = true,
  accept,
  maxFiles = MAX_FILES,
  maxFileSize = Infinity,
  disabled = false,
  placeholder,
  label,
  locale,
  size = 'md',
  labels: labelProps,
  slotProps,
  slots,
  className,
  sx,
  ...rest
}: ComposerInternalProps) {
  const { formatters } = useMemo(() => resolveFormatters('ChatThread.Composer', locale, DEFAULT_TIME_ZONE), [locale]);
  const labels = { ...defaultLabels(formatters), ...labelProps };
  const [draft = EMPTY_DRAFT, requestDraft] = useControlledState(value, defaultValue, onValueChange);
  const [pending, setPending] = useState(false);
  const [awaiting, setAwaiting] = useState<ChatDraft | null>(null);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const alive = useRef(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergeRefs([ref, rootRef]);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputRefs = useMergeRefs([inputRef, slotProps?.fileInput?.ref]);
  const inputId = useId();
  const errorId = useId();
  const preview = useFilePreviews(draft.files);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useLayoutEffect(() => {
    if (awaiting && acknowledged === awaiting) { setAwaiting(null); requestDraft({ text: '', files: [] }); }
  }, [acknowledged, awaiting, requestDraft]);
  const change = (next: ChatDraft) => {
    if (disabled || lock.current) return;
    onDraftInteraction?.();
    setAwaiting(null);
    setError('');
    requestDraft(next);
  };
  const addFiles = (files: readonly File[]) => {
    if (disabled || lock.current || !allowAttachments) return;
    const next = [...draft.files];
    const errors: string[] = [];
    const limit = Number.isFinite(maxFiles) ? Math.max(0, Math.floor(maxFiles)) : MAX_FILES;
    for (const file of files) {
      const reason = !acceptsFile(file, accept) ? 'type' : file.size > Math.max(0, maxFileSize) ? 'size' : next.length >= limit ? 'count' : null;
      if (reason) errors.push(labels.fileRejected(reason, file.name)); else next.push(file);
    }
    if (next.length !== draft.files.length) change({ ...draft, files: next });
    setError(formatters.facts.format(errors));
  };
  const submit = async () => {
    if (disabled || lock.current || awaiting || (!draft.text.trim() && draft.files.length === 0)) return;
    const submitted = { text: draft.text.trim(), files: [...draft.files] };
    lock.current = true;
    setPending(true);
    setError('');
    try {
      const accepted = await onSend(submitted);
      if (!alive.current) return;
      if (accepted === false) setAwaiting(submitted); else requestDraft({ text: '', files: [] });
    } catch {
      if (alive.current) setError(labels.sendFailed);
    } finally {
      lock.current = false;
      if (alive.current) setPending(false);
    }
  };
  const remove = (index: number) => {
    const root = rootRef.current;
    const focused = root?.ownerDocument.activeElement;
    change({ ...draft, files: draft.files.filter((_, position) => index !== position) });
    queueMicrotask(() => { if (focused && !focused.isConnected) (root?.querySelector<HTMLElement>('[data-action="remove-file"]') ?? root?.querySelector('textarea'))?.focus(); });
  };
  const textarea = slotProps?.textarea;
  const Tray = slots?.tray ?? 'ul';
  const File = slots?.file ?? 'li';
  const Error = slots?.error ?? 'p';
  const Form = slots?.form ?? 'form';
  const AttachButton = slots?.attachButton ?? Button;
  const FileInput = slots?.fileInput ?? 'input';
  const RemoveButton = slots?.removeButton ?? Button;
  const fileInput = slotProps?.fileInput;
  const form = slotProps?.form;
  return (
    <WithSx className={className} styles={[composerRootStyle, threadSizeStyles[size]]} sx={sx}>
      {(rootClass) => <div {...rest} ref={mergedRef} className={rootClass} data-ui={`${UI}-composer`}>
        {draft.files.length > 0 ? <Tray {...withoutSx(slotProps?.tray)} role="list" aria-label={labels.attachments} data-ui={`${UI}-tray`} className={slotProps?.tray?.className} css={[trayStyle, fadeStyle, slotProps?.tray?.sx]}>
          {draft.files.map((file, index) => <File {...withoutSx(slotProps?.file)} key={index} className={slotProps?.file?.className} css={[fileStyle, slotProps?.file?.sx]}>
            {preview.get(file) ? <img src={preview.get(file)} alt="" css={previewStyle} /> : null}
            <span>{file.name} · {fileSize(file.size, locale)}</span>
            <RemoveButton size="sm" variant="ghost" {...slotProps?.removeButton} aria-label={labels.removeFile(file.name)} disabled={disabled || pending || slotProps?.removeButton?.disabled} data-action="remove-file" onClick={(event) => { slotProps?.removeButton?.onClick?.(event); if (!event.defaultPrevented) remove(index); }}>×</RemoveButton>
          </File>)}
        </Tray> : null}
        <Form
          {...form}
          data-ui={`${UI}-form`}
          onSubmit={(event) => {
            form?.onSubmit?.(event);
            if (!event.defaultPrevented) { event.preventDefault(); void submit(); }
          }}
          onDragOver={(event) => {
            form?.onDragOver?.(event);
            if (!event.defaultPrevented && allowAttachments && !disabled && !pending && event.dataTransfer.types.includes('Files')) event.preventDefault();
          }}
          onDrop={(event) => {
            form?.onDrop?.(event);
            if (!event.defaultPrevented && event.dataTransfer.files.length) {
              event.preventDefault();
              addFiles(Array.from(event.dataTransfer.files));
            }
          }}
        >
          <ThreadComposer
            ui={UI}
            kind="root"
            draft={draft.text}
            onDraftChange={(text) => change({ ...draft, text })}
            onSubmit={() => { void submit(); }}
            submitOnEnter
            allowEmpty={draft.files.length > 0}
            lockWhilePending={pending}
            cancelable={false}
            cancelOnEscape={false}
            label={label ?? labels.composer}
            placeholder={placeholder ?? labels.placeholder}
            submitLabel={labels.send}
            cancelLabel=""
            mentionsLabel=""
            people={[]}
            locale={locale}
            disabled={disabled}
            pending={pending || awaiting !== null}
            size={size}
            submitProps={slotProps?.sendButton}
            slots={{ submit: slots?.sendButton, textarea: slots?.textarea }}
            textareaProps={{
              ...textarea,
              'aria-describedby': [textarea?.['aria-describedby'], error ? errorId : undefined].filter(Boolean).join(' ') || undefined,
              slotProps: {
                ...textarea?.slotProps,
                control: { ...textarea?.slotProps?.control, sx: [textareaControlStyle, textarea?.slotProps?.control?.sx] },
              },
              onPaste: (event) => {
                textarea?.onPaste?.(event);
                if (!event.defaultPrevented && event.clipboardData.files.length) addFiles(Array.from(event.clipboardData.files));
              },
            }}
          />
          {allowAttachments ? <div css={rowStyle}>
            <FileInput
              {...fileInput}
              ref={inputRefs}
              id={fileInput?.id ?? inputId}
              type="file"
              multiple
              accept={accept}
              disabled={disabled || pending}
              aria-label={fileInput?.['aria-label'] ?? labels.attach}
              css={visuallyHiddenStyle}
              onChange={(event) => {
                fileInput?.onChange?.(event);
                if (!event.defaultPrevented) addFiles(Array.from(event.currentTarget.files ?? []));
                event.currentTarget.value = '';
              }}
            />
            <AttachButton
              variant="outline"
              size="sm"
              {...slotProps?.attachButton}
              aria-controls={fileInput?.id ?? inputId}
              disabled={disabled || pending || slotProps?.attachButton?.disabled}
              onClick={(event) => {
                slotProps?.attachButton?.onClick?.(event);
                if (!event.defaultPrevented) inputRef.current?.click();
              }}
            >
              {labels.attach}
            </AttachButton>
          </div> : null}
        </Form>
        <Error {...withoutSx(slotProps?.error)} id={errorId} role="status" aria-atomic="true" data-ui={`${UI}-error`} className={slotProps?.error?.className} css={[errorStyle, slotProps?.error?.sx]}>{error}</Error>
      </div>}
    </WithSx>
  );
}
function Composer(props: ChatThreadComposerProps) { return <ChatComposer {...props} />; }
Composer.displayName = 'ChatThread.Composer';

function ChatThreadRoot({
  ref,
  participants,
  currentUserId,
  value,
  defaultValue = EMPTY_MESSAGES,
  onValueChange,
  now,
  locale,
  timeZone = DEFAULT_TIME_ZONE,
  typing = EMPTY_IDS,
  readBy,
  onSend,
  onReact,
  onRetry,
  reactions = DEFAULT_CHAT_EMOJI,
  groupWindow = GROUP_WINDOW,
  composer = true,
  disabled = false,
  composerProps,
  getNewId = newId,
  size = 'md',
  labels: labelProps,
  slotProps,
  slots,
  component,
  className,
  sx,
  ...rest
}: ChatThreadProps) {
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const rootRefs = useMergeRefs([rootRef, ref]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const { formatters } = useMemo(() => resolveFormatters('ChatThread', locale, timeZone), [locale, timeZone]);
  const labels = { ...defaultLabels(formatters), ...labelProps };
  const dateFormat = useMemo(() => dateTimeFormatter(formatters.full.resolvedOptions().locale, {
    timeZone: formatters.full.resolvedOptions().timeZone,
    dateStyle: 'full',
  }), [formatters]);
  // Day grouping is keyed on a fixed ISO-8601 calendar with Latin digits so separators land on the same
  // instants for every locale; only the zone varies. Headings still render in the caller's locale and calendar.
  const dayKeyFormat = useMemo(() => dateTimeFormatter('en-US-u-ca-iso8601-nu-latn', {
    timeZone: formatters.full.resolvedOptions().timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }), [formatters]);
  const proposedEvent = useRef<ChatThreadEvent | null>(null);
  const [messages = EMPTY_MESSAGES, requestMessages] = useControlledState<readonly ChatMessage[]>(
    value,
    defaultValue,
    (next) => onValueChange?.([...next], proposedEvent.current!),
  );
  const messageRef = useRef(messages);
  messageRef.current = messages;
  const people = new Map(uniqueBy(participants, (person) => person.id).map((person) => [person.id, person]));
  const rendered = uniqueBy(messages, (message) => message.id);
  const [picker, setPicker] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [away, setAway] = useState(false);
  const [live, setLive] = useState(false);
  const [ack, setAck] = useState<{ id: string; draft: ChatDraft } | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [retryError, setRetryError] = useState('');
  const urls = useRef(new Map<string, string[]>());
  const proposals = useRef(new Set<string>());
  const previousIds = useRef(messages.map((message) => message.id));
  const entering = useMemo(() => {
    const previous = new Set(previousIds.current);
    return new Set(messages.filter((message) => !previous.has(message.id)).map((message) => message.id));
  }, [messages]);
  const prepending = previousIds.current.length > 0 && messages[0]?.id !== previousIds.current[0]
    && messages.some((message) => message.id === previousIds.current[0]);
  const geometry = useRef({ height: 0, top: 0, first: messages[0]?.id });
  const anchor = useRef<{ id: string; offset: number } | null>(null);
  const pinned = useRef(true);
  const jumping = useRef(false);
  const jumpFocus = useRef(false);
  const forcePin = useRef<string | null>(null);
  const ownSends = useRef(new Set<string>());
  const retryLock = useRef(false);
  const mounted = useRef(true);
  useLayoutEffect(() => {
    if (away || !jumpFocus.current) return;
    jumpFocus.current = false;
    const field = rootRef.current?.querySelector<HTMLTextAreaElement>('textarea:not(:disabled)');
    (field ?? scrollerRef.current)?.focus();
  }, [away]);
  const releaseUrls = (id: string) => {
    const owned = urls.current.get(id);
    if (!owned) return;
    for (const url of owned) URL.revokeObjectURL(url);
    urls.current.delete(id);
  };
  const rememberAnchor = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const top = scroller.getBoundingClientRect().top;
    const visible = Array.from(scroller.querySelectorAll<HTMLElement>('[data-message-id]'))
      .find((element) => element.getBoundingClientRect().bottom > top);
    anchor.current = visible ? { id: visible.dataset.messageId!, offset: visible.getBoundingClientRect().top - top } : null;
  };
  const restoreAnchor = () => {
    const scroller = scrollerRef.current;
    const saved = anchor.current;
    if (!scroller || !saved) return false;
    const element = scroller.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(saved.id)}"]`);
    if (!element) return false;
    scroller.scrollTop += element.getBoundingClientRect().top - scroller.getBoundingClientRect().top - saved.offset;
    return true;
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const owned of urls.current.values()) for (const url of owned) URL.revokeObjectURL(url);
      urls.current.clear();
    };
  }, []);
  useLayoutEffect(() => {
    const retained = new Set(messages.flatMap((message) => message.attachments?.map((attachment) => attachment.url) ?? []));
    for (const [id, owned] of urls.current) {
      if (proposals.current.has(id) && !messages.some((message) => message.id === id)) continue;
      proposals.current.delete(id);
      const keep: string[] = [];
      for (const url of owned) if (retained.has(url)) keep.push(url); else URL.revokeObjectURL(url);
      if (keep.length) urls.current.set(id, keep); else urls.current.delete(id);
    }
  }, [messages]);
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const previous = previousIds.current;
    const previousSet = new Set(previous);
    const fresh = messages.filter((message) => !previousSet.has(message.id));
    const prepend = prepending;
    if (prepend) setLive(false);
    const ownAccepted = forcePin.current !== null && messages.some((message) => message.id === forcePin.current);
    if (pinned.current || ownAccepted) {
      scroller.scrollTop = scroller.scrollHeight;
      pinned.current = true;
      if (ownAccepted) forcePin.current = null;
      setAway(false);
      setUnread(0);
    } else if (!restoreAnchor() && prepend) {
      scroller.scrollTop = geometry.current.top + scroller.scrollHeight - geometry.current.height;
    }
    if (!pinned.current && !prepend && fresh.length) setUnread((count) => count + fresh.filter((message) => !ownSends.current.has(message.id)).length);
    geometry.current = { top: scroller.scrollTop, height: scroller.scrollHeight, first: messages[0]?.id };
    rememberAnchor();
    previousIds.current = messages.map((message) => message.id);
    const frame = requestAnimationFrame(() => setLive(true));
    return () => cancelAnimationFrame(frame);
  }, [messages]);
  useEffect(() => {
    const scroller = scrollerRef.current;
    const list = listRef.current;
    if (!scroller || !list) return;
    const observer = new ResizeObserver(() => {
      if (pinned.current) scroller.scrollTop = scroller.scrollHeight;
      else if (!restoreAnchor()) scroller.scrollTop = geometry.current.top;
      geometry.current = { ...geometry.current, top: scroller.scrollTop, height: scroller.scrollHeight };
      rememberAnchor();
    });
    observer.observe(list);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);
  const commit = (next: readonly ChatMessage[], event: ChatThreadEvent) => {
    proposedEvent.current = event;
    requestMessages(next);
  };
  const send = async (draft: ChatDraft) => {
    if (disabled || !validEpoch(now)) throw new Error(labels.sendFailed);
    const id = getNewId();
    if (messageRef.current.some((message) => message.id === id)) throw new Error(labels.sendFailed);
    abandonProposal();
    const owned: string[] = [];
    urls.current.set(id, owned);
    let attachments: ChatAttachment[];
    try {
      attachments = draft.files.map((file, index): ChatAttachment => {
        const url = URL.createObjectURL(file);
        owned.push(url);
        return { id: `${id}:${index}`, name: file.name, kind: file.type.startsWith('image/') ? 'image' : 'file', url, size: file.size, alt: file.name };
      });
    } catch (error) {
      releaseUrls(id);
      throw error;
    }
    proposals.current.add(id);
    const message: ChatMessage = { id, authorId: currentUserId, text: draft.text, createdAt: now, attachments, status: 'sent' };
    ownSends.current.add(id);
    try {
      if (value !== undefined) {
        forcePin.current = id;
        commit([...messageRef.current, message], { type: 'send', message, draft });
      }
      await onSend?.(draft);
      if (!mounted.current) return false;
      if (value === undefined) {
        forcePin.current = id;
        commit([...messageRef.current, message], { type: 'send', message, draft });
      }
      setAck({ id, draft });
      return value === undefined || messageRef.current.some((entry) => entry.id === id);
    } catch (error) {
      proposals.current.delete(id);
      const retained = messageRef.current.some((entry) => entry.id === id);
      if (!retained) releaseUrls(id);
      throw error;
    }
  };
  const abandonProposal = () => {
    for (const id of proposals.current) {
      if (!messageRef.current.some((message) => message.id === id)) releaseUrls(id);
    }
    proposals.current.clear();
    setAck(null);
  };
  const react = (message: ChatMessage, emoji: string) => {
    if (disabled) return;
    const previous = message.reactions ?? [];
    const result = reactToChatMessage(previous, emoji, currentUserId);
    commit(messages.map((entry) => entry.id === message.id ? { ...entry, reactions: result.reactions } : entry), { type: 'react', id: message.id, emoji, added: result.added });
    onReact?.(message.id, emoji);
  };
  const retry = async (id: string) => {
    if (disabled || retryLock.current) return;
    retryLock.current = true;
    setRetrying(id);
    setRetryError('');
    try {
      await onRetry?.(id);
    } catch {
      if (mounted.current) setRetryError(labels.sendFailed);
    } finally {
      retryLock.current = false;
      if (mounted.current) setRetrying(null);
    }
  };
  const jump = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const reduced = scroller.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
    pinned.current = true;
    jumping.current = true;
    jumpFocus.current = true;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: reduced ? 'instant' : 'smooth' });
    setUnread(0); setAway(false);
  };
  const typingNames = uniqueBy(typing, (id) => id).filter((id) => id !== currentUserId && people.has(id)).map((id) => people.get(id)!.name);
  const typingText = typingNames.length ? labels.typing(formatters.people.format(typingNames)) : '';
  const acceptedDraft = ack && messages.some((message) => message.id === ack.id) ? ack.draft : null;
  const Viewport = slots?.viewport ?? 'div';
  const Scroller = slots?.scroller ?? 'div';
  const Log = slots?.log ?? 'div';
  const List = slots?.list ?? 'ol';
  const Message = slots?.message ?? 'li';
  const JumpButton = slots?.jumpButton ?? Button;
  return <PresentationSlot element="div" component={slots?.root ?? component} slotProps={{ ...slotProps?.root, 'data-size': size }} styles={[rootStyle, threadSizeStyles[size]]} sx={sx} {...rest} ref={rootRefs} className={className} marker={UI}>
      <Viewport {...withoutSx(slotProps?.viewport)} data-ui={`${UI}-viewport`} className={slotProps?.viewport?.className} css={[viewportStyle, slotProps?.viewport?.sx]}>
        <Scroller {...withoutSx(slotProps?.scroller)} ref={scrollerRef} tabIndex={0} role="group" aria-label={labels.transcript} data-ui={`${UI}-scroller`} className={slotProps?.scroller?.className} css={[scrollerStyle, slotProps?.scroller?.sx]} onScroll={(event) => {
          const el = event.currentTarget;
          const nearBottom = el.scrollHeight - el.clientHeight - el.scrollTop <= PIN_THRESHOLD;
          if (nearBottom) jumping.current = false;
          pinned.current = nearBottom || jumping.current;
          geometry.current = { ...geometry.current, top: el.scrollTop, height: el.scrollHeight };
          rememberAnchor();
          setAway(!pinned.current);
          if (pinned.current) setUnread(0);
        }} onWheel={() => { jumping.current = false; }}>
          <Log
            {...withoutSx(slotProps?.log)}
            role="log"
            aria-label={labels.conversation}
            aria-live={live && !prepending ? 'polite' : 'off'}
            aria-relevant="additions"
            aria-atomic="false"
            data-ui={`${UI}-log`}
            className={slotProps?.log?.className}
            css={slotProps?.log?.sx}
          >
            {rendered.length === 0 ? <p>{labels.empty}</p> : null}
            <List {...withoutSx(slotProps?.list)} ref={listRef} role="list" data-ui={`${UI}-list`} className={slotProps?.list?.className} css={[listStyle, size === 'sm' && compactListStyle, slotProps?.list?.sx]}>
              {rendered.map((message, index) => {
                const epoch = toEpoch(message.createdAt);
                const previous = rendered[index - 1];
                const previousEpoch = previous ? toEpoch(previous.createdAt) : null;
                const sameDay = epoch !== null && previousEpoch !== null && dayKeyFormat.format(epoch) === dayKeyFormat.format(previousEpoch);
                const grouped = sameDay && previous?.authorId === message.authorId && epoch! - previousEpoch! >= 0 && epoch! - previousEpoch! <= (Number.isFinite(groupWindow) && groupWindow >= 0 ? groupWindow : GROUP_WINDOW);
                const own = message.authorId === currentUserId;
                const author = people.get(message.authorId) ?? { id: message.authorId, name: labels.unknownAuthor };
                const readers = Object.entries(readBy ?? {}).filter(([id, last]) => id !== currentUserId && people.has(id) && last === message.id).map(([id]) => people.get(id)!.name);
                return <Message {...withoutSx(slotProps?.message)} key={message.id} data-ui={`${UI}-message`} data-message-id={message.id} data-own={own} data-grouped={grouped} className={slotProps?.message?.className} css={[messageStyle, entering.has(message.id) && message.status !== 'failed' && fadeStyle, slotProps?.message?.sx]}>
                  {!sameDay ? <h3 data-ui={`${UI}-day`} css={dateStyle}>{epoch === null ? labels.invalidTime : dateFormat.format(epoch)}</h3> : null}
                  <ChatMessageView
                    _ui={UI}
                    message={message}
                    baseId={baseId}
                    author={author}
                    now={validEpoch(now) ? now : null}
                    reactions={message.reactions ?? EMPTY_REACTIONS}
                    offeredReactions={reactions}
                    currentUserId={currentUserId}
                    readers={readers}
                    own={own}
                    size={size}
                    locale={locale}
                    timeZone={timeZone}
                    formatters={formatters}
                    disabled={disabled}
                    pickerOpen={picker === message.id}
                    onPickerOpenChange={(open) => setPicker(open ? message.id : null)}
                    onReact={(emoji) => react(message, emoji)}
                    onRetry={onRetry ? () => retry(message.id) : undefined}
                    retryLoading={retrying === message.id}
                    labels={labels}
                    slots={{ bubble: slots?.bubble, time: slots?.time, receipt: slots?.receipt, reactions: slots?.reaction, attachments: slots?.attachments }}
                    slotProps={{
                      bubble: slotProps?.bubble,
                      time: slotProps?.time,
                      attachments: slotProps?.attachments,
                      reactions: slotProps?.reaction,
                      receipt: slotProps?.receipt,
                    }}
                  />
                </Message>;
              })}
            </List>
          </Log>
        </Scroller>
        {away ? <JumpButton variant="outline" size="sm" {...withoutSx(slotProps?.jumpButton)} css={jumpStyle} onClick={(event) => { slotProps?.jumpButton?.onClick?.(event); if (!event.defaultPrevented) jump(); }}>{unread ? labels.newMessages(unread) : labels.jumpToLatest}</JumpButton> : null}
      </Viewport>
      <div aria-hidden="true" css={typingStyle}>{typingText}</div>
      <div role="status" aria-atomic="true" css={visuallyHiddenStyle}>{typingText}</div>
      {composer ? <ChatComposer locale={locale} size={size} labels={labels} {...composerProps} disabled={disabled || composerProps?.disabled} onSend={send} acknowledged={acceptedDraft} onDraftInteraction={abandonProposal} /> : null}
      {retryError ? <p role="status" aria-atomic="true" data-ui={`${UI}-retry-error`} css={errorStyle}>{retryError}</p> : null}
  </PresentationSlot>;
}
ChatThreadRoot.displayName = 'ChatThread';
export const ChatThread = Object.assign(ChatThreadRoot, { Composer });
