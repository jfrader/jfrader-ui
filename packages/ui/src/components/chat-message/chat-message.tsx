'use client';

import {
  useId,
  useMemo,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { type SxProps } from '../../styling/sx';
import { focusRingOutset } from '../../styling/focus-ring';
import { partId } from '../../utils/part-id';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button } from '../button';
import { Card } from '../card';
import {
  DEFAULT_TIME_ZONE,
  formatCount,
  resolveFormatters,
  toEpoch,
  toggleReaction,
  uniqueBy,
  validEpoch,
  type ThreadAuthor,
  type ThreadFormatters,
  type ThreadReaction,
  type ThreadTimestamp,
} from '../thread/thread-core';
import {
  ThreadMessageView,
  ThreadReactions,
  threadSizeStyles,
  type ThreadButtonProps,
  type ThreadPartProps,
  type ThreadReactionLabels,
  type ThreadSize,
} from '../thread/thread-parts';

export type ChatParticipant = ThreadAuthor;
export type ChatMessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ChatAttachment {
  id: string;
  name: string;
  kind: 'image' | 'file';
  url?: string;
  size?: number;
  width?: number;
  height?: number;
  alt?: string;
}

export interface ChatReaction {
  emoji: string;
  count: number;
  mine?: boolean;
}

export interface ChatMessage {
  id: string;
  authorId: string;
  text?: string;
  createdAt: ThreadTimestamp;
  attachments?: readonly ChatAttachment[];
  reactions?: readonly ChatReaction[];
  status?: ChatMessageStatus;
}

export interface ChatMessageLabels extends ThreadReactionLabels {
  attachments: string;
  sending: string;
  sent: string;
  delivered: string;
  read: string;
  failed: string;
  retry: string;
  unknownAuthor: string;
  invalidTime: string;
  readBy: (names: string) => string;
  showAttachments: (count: number) => string;
}

export type ChatMessagePart = 'bubble' | 'time' | 'attachments' | 'receipt' | 'reactions' | 'avatar';

export type ChatMessageSlotProps = Partial<Record<ChatMessagePart, ThreadPartProps>> & {
  article?: ThreadPartProps & ComponentPropsWithRef<'article'>;
  receipt?: ThreadPartProps & ComponentPropsWithRef<'div'>;
  retryButton?: ThreadButtonProps;
};

export interface ChatMessageProps extends Omit<ComponentPropsWithRef<'article'>, 'defaultValue' | 'onChange' | 'children'>, SxProps {
  /** Optional message data record to seed defaults. */
  message?: ChatMessage;
  /** Author details or display name. Defaults to message.authorId or "Unknown author". */
  author?: ThreadAuthor | string;
  /** Custom avatar replacement. Pass `null` to omit the avatar column. */
  avatar?: ReactNode;
  /** Message text content (when children is not provided). */
  text?: string;
  /** Body children rendered inside the message bubble. */
  children?: ReactNode;
  /** Creation timestamp. Omit to show the unknown-time label. */
  createdAt?: ThreadTimestamp;
  /** Current epoch ms for relative time calculation. Defaults to null (full formatted date). */
  now?: number | null;
  /** Delivery status. */
  status?: ChatMessageStatus;
  /** File attachments. Defaults to message.attachments. */
  attachments?: readonly ChatAttachment[];
  /** Message reactions. Controlled when provided. */
  reactions?: readonly ChatReaction[];
  /** Default reactions for uncontrolled state. */
  defaultReactions?: readonly ChatReaction[];
  /** Called when reactions change. */
  onReactionsChange?: (reactions: readonly ChatReaction[]) => void;
  /** Emoji options offered in the reaction picker. Defaults to ['👍', '❤️', '🎉', '👀', '🚀', '✅']. Pass empty array to hide picker. */
  offeredReactions?: readonly string[];
  /** Stable ID of the active user for reaction toggling. Defaults to 'me'. */
  currentUserId?: string;
  /** Called when a reaction is toggled. */
  onReact?: (emoji: string) => void;
  /** Request another send attempt. Handle transport and errors in your app. */
  onRetry?: () => void;
  /** Show a pending retry while your app sends the message. */
  retryLoading?: boolean;
  /** Read receipt readers list. */
  readers?: readonly string[];
  /** Align to the inline-end and style as the current user's message. */
  own?: boolean;
  /** Visual density. Defaults to 'md'. */
  size?: ThreadSize;
  /** Locale for Intl formatting. */
  locale?: Intl.LocalesArgument;
  /** IANA time zone. Defaults to 'UTC'. */
  timeZone?: string;
  /** Controlled reaction picker visibility. */
  pickerOpen?: boolean;
  /** Default reaction picker visibility for uncontrolled state. */
  defaultPickerOpen?: boolean;
  /** Called when reaction picker visibility changes. */
  onPickerOpenChange?: (open: boolean) => void;
  /** Disables reaction interactions and retry. */
  disabled?: boolean;
  /** Read-only display of reactions without mutations. */
  readOnly?: boolean;
  /** Localized string overrides. */
  labels?: Partial<ChatMessageLabels>;
  /** Props forwarded to internal parts. */
  slotProps?: ChatMessageSlotProps;
  /** Text after the time, e.g. "(edited)". */
  meta?: ReactNode;
}

interface ChatMessageViewProps extends ChatMessageProps {
  _ui?: string;
  baseId?: string;
  formatters?: ThreadFormatters;
}

export const DEFAULT_CHAT_EMOJI: readonly string[] = ['👍', '❤️', '🎉', '👀', '🚀', '✅'];
export const PREVIEW_ATTACHMENTS_COUNT = 4;

export const arrival = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });

export const fadeStyle = css({
  animationName: arrival,
  animationDuration: vars.motion.duration.base,
  animationTimingFunction: vars.motion.easeStandard,
  [REDUCED_MOTION]: { animation: 'none' },
});

const typographyStyle = css({
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
});

const messageShellStyle = css({
  inlineSize: 'min(78%, 34rem)',
  minInlineSize: 0,
  '@container (max-width: 28rem)': { inlineSize: '84%' },
});

export const ownShellStyle = css({
  justifySelf: 'end',
  marginInlineStart: 'auto',
});

export const bubbleStyle = css({
  padding: vars.space[3],
  minInlineSize: 0,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  backgroundColor: vars.color.surfaceRaised,
});

export const ownBubbleStyle = css({
  backgroundColor: vars.color.accentSoft,
  color: vars.color.text,
});

export const rowStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[2],
});

export const receiptStyle = css({
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
  overflowWrap: 'anywhere',
});

export const errorStyle = css({
  color: vars.color.dangerText,
  margin: 0,
  overflowWrap: 'anywhere',
});

export const fileStyle = css({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: vars.space[2],
  padding: vars.space[2],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
  minInlineSize: 0,
  overflowWrap: 'anywhere',
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});

export const imageStyle = css({
  display: 'block',
  maxInlineSize: '100%',
  blockSize: 'auto',
  aspectRatio: '4 / 3',
  objectFit: 'contain',
  borderRadius: vars.radius.sm,
});

export const previewStyle = css({
  inlineSize: vars.space[12],
  blockSize: vars.space[12],
  objectFit: 'cover',
});

export const attachmentsStyle = css({
  display: 'grid',
  gap: vars.space[2],
  listStyle: 'none',
  padding: 0,
  margin: 0,
});

export const linkStyle = css({
  color: vars.color.accentText,
  overflowWrap: 'anywhere',
  '&:focus-visible': focusRingOutset,
});

export function safeUrl(url: string | undefined): string | undefined {
  if (!url || /[\u0000-\u0020\u007f\\]/u.test(url)) return undefined;
  try {
    return ['http:', 'https:', 'blob:'].includes(new URL(url, 'https://attachments.invalid/').protocol) ? url : undefined;
  } catch {
    return undefined;
  }
}

export function fileSize(size: number, locale: Intl.LocalesArgument): string {
  const units =
    size >= 1_000_000
      ? { size: 1_000_000, unit: 'megabyte' }
      : size >= 1_000
      ? { size: 1_000, unit: 'kilobyte' }
      : { size: 1, unit: 'byte' };
  return new Intl.NumberFormat(locale, { style: 'unit', unit: units.unit, maximumFractionDigits: 1 }).format(
    size / units.size,
  );
}

export function chatReactions(reactions: readonly ChatReaction[], currentUserId: string): ThreadReaction[] {
  return uniqueBy(reactions, (reaction) => reaction.emoji).map(({ emoji, mine }) => ({
    emoji,
    users: mine ? [currentUserId] : [],
  }));
}

export function reactToChatMessage(reactions: readonly ChatReaction[], emoji: string, currentUserId: string) {
  const { added } = toggleReaction(chatReactions(reactions, currentUserId), emoji, currentUserId);
  const existing = reactions.find((reaction) => reaction.emoji === emoji);
  const count = Math.max(0, (existing?.count ?? 0) + (added ? 1 : -1));
  const replacement: ChatReaction = { emoji, count, mine: added };
  return {
    added,
    reactions: existing
      ? reactions.flatMap((reaction) => reaction.emoji !== emoji ? [reaction] : count > 0 ? [replacement] : [])
      : [...reactions, replacement],
  };
}

export function defaultChatMessageLabels(format: ThreadFormatters): ChatMessageLabels {
  const count = (n: number, one: string, other: string) => formatCount(format, n, one, other);
  return {
    attachments: 'Attachments',
    sending: 'Sending',
    sent: 'Sent',
    delivered: 'Delivered',
    read: 'Read',
    failed: 'Failed',
    retry: 'Retry',
    unknownAuthor: 'Unknown author',
    invalidTime: 'Unknown time',
    addReaction: 'Add reaction',
    closeReactions: 'Close reactions',
    reactions: 'Reactions',
    readBy: (names) => `Read by ${names}`,
    showAttachments: (n) => `Show ${count(n, 'more attachment', 'more attachments')}`,
    reactWith: (emoji) => `React with ${emoji}`,
    reactionCount: (emoji, n, mine) => `${emoji} ${count(n, 'reaction', 'reactions')}${mine ? ', including you' : ''}`,
  };
}

export function AttachmentList({
  attachments,
  labels,
  locale,
  owner = 'chat-message',
  part,
}: {
  attachments: readonly ChatAttachment[];
  labels: Pick<ChatMessageLabels, 'attachments' | 'showAttachments'>;
  locale: Intl.LocalesArgument;
  owner?: string;
  part?: ThreadPartProps;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? attachments : attachments.slice(0, PREVIEW_ATTACHMENTS_COUNT);
  return (
    <>
      <ul
        role="list"
        aria-label={labels.attachments}
        data-ui={`${owner}-attachments`}
        className={part?.className}
        css={[attachmentsStyle, part?.css]}
      >
        {shown.map((attachment) => {
          const url = safeUrl(attachment.url);
          const content = (
            <>
              {attachment.kind === 'image' && url ? (
                <img
                  src={url}
                  alt={attachment.alt ?? attachment.name}
                  width={attachment.width}
                  height={attachment.height}
                  style={attachment.width && attachment.height ? { aspectRatio: `${attachment.width} / ${attachment.height}` } : undefined}
                  css={imageStyle}
                />
              ) : null}
              <span>
                {attachment.name}
                {attachment.size !== undefined ? ` · ${fileSize(attachment.size, locale)}` : ''}
              </span>
            </>
          );
          return (
            <li key={attachment.id} css={fileStyle}>
              {url ? (
                <a href={url} download={attachment.name} css={linkStyle}>
                  {content}
                </a>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
      {!expanded && attachments.length > PREVIEW_ATTACHMENTS_COUNT ? (
        <Button size="sm" variant="outline" onClick={() => setExpanded(true)}>
          {labels.showAttachments(attachments.length - PREVIEW_ATTACHMENTS_COUNT)}
        </Button>
      ) : null}
    </>
  );
}

export function ChatMessageView({
  ref,
  message,
  id: idProp,
  author: authorProp,
  avatar,
  text: textProp,
  children,
  createdAt: createdAtProp,
  now: nowProp,
  status: statusProp,
  attachments: attachmentsProp,
  reactions: reactionsProp,
  defaultReactions,
  onReactionsChange,
  offeredReactions = DEFAULT_CHAT_EMOJI,
  currentUserId = 'me',
  onReact,
  onRetry,
  retryLoading,
  readers,
  own,
  size = 'md',
  locale,
  timeZone = DEFAULT_TIME_ZONE,
  pickerOpen: pickerOpenProp,
  defaultPickerOpen = false,
  onPickerOpenChange: onPickerOpenChangeProp,
  disabled = false,
  readOnly = false,
  labels: labelProps,
  slotProps,
  meta,
  className,
  sx,
  _ui,
  baseId: baseIdProp,
  formatters: threadFormatters,
  ...restProps
}: ChatMessageViewProps) {
  const generatedId = useId();
  const id = idProp ?? message?.id ?? generatedId;
  const computedBaseId = baseIdProp ?? generatedId;
  const owner = _ui ?? 'chat-message';

  const { formatters } = useMemo(
    () => threadFormatters ? { formatters: threadFormatters } : resolveFormatters('ChatMessage', locale, timeZone),
    [threadFormatters, locale, timeZone],
  );
  const labels = useMemo(
    () => ({ ...defaultChatMessageLabels(formatters), ...labelProps }),
    [formatters, labelProps],
  );

  const resolvedAuthor: ThreadAuthor = useMemo(() => {
    if (authorProp && typeof authorProp === 'object') return authorProp;
    if (typeof authorProp === 'string') {
      return { id: authorProp, name: authorProp };
    }
    if (message?.authorId) {
      return { id: message.authorId, name: message.authorId };
    }
    return { id: 'unknown', name: labels.unknownAuthor };
  }, [authorProp, message?.authorId, labels.unknownAuthor]);

  const rawCreatedAt = createdAtProp ?? message?.createdAt;
  const epoch = rawCreatedAt !== undefined ? toEpoch(rawCreatedAt) : null;
  const now = typeof nowProp === 'number' && validEpoch(nowProp) ? nowProp : null;

  const effectiveText = textProp ?? message?.text;
  const effectiveAttachments = attachmentsProp ?? message?.attachments;
  const status = statusProp ?? message?.status;

  const [reactions = [], requestReactions] = useControlledState<readonly ChatReaction[]>(
    reactionsProp ?? message?.reactions,
    defaultReactions ?? message?.reactions ?? [],
    onReactionsChange,
  );

  const [pickerOpen = false, requestPickerOpen] = useControlledState(
    pickerOpenProp,
    defaultPickerOpen,
    onPickerOpenChangeProp,
  );

  const handleToggleReaction = (emoji: string) => {
    if (disabled || readOnly) return;
    requestReactions(reactToChatMessage(reactions, emoji, currentUserId).reactions);
    onReact?.(emoji);
  };

  const isOwn =
    own ??
    (currentUserId && (resolvedAuthor.id === currentUserId || message?.authorId === currentUserId) ? true : false);

  const actionName = (action: string) =>
    formatters.facts.format([
      action,
      resolvedAuthor.name,
      epoch === null ? labels.invalidTime : formatters.full.format(epoch),
      ...(effectiveText ? [effectiveText] : []),
    ]);

  const reactionLabels: ThreadReactionLabels = {
    ...labels,
    addReaction: actionName(labels.addReaction),
    closeReactions: actionName(labels.closeReactions),
    reactions: actionName(labels.reactions),
    reactWith: (emoji) => actionName(labels.reactWith(emoji)),
    reactionCount: (emoji, count, mine) => actionName(labels.reactionCount(emoji, count, mine)),
  };

  const retryAriaLabel =
    slotProps?.retryButton?.['aria-label'] ??
    actionName(labels.retry);

  const readReceiptText =
    readers && readers.length > 0
      ? labels.readBy(formatters.people.format(readers))
      : null;

  const bodyContent =
    children !== undefined ? (
      children
    ) : effectiveText !== undefined && effectiveText !== '' ? (
      <span data-ui={`${owner}-text`}>{effectiveText}</span>
    ) : null;

  const articleRef = useMergeRefs([ref, slotProps?.article?.ref]);

  return (
    <ThreadMessageView
      ui={owner}
      author={resolvedAuthor}
      epoch={epoch}
      now={now}
      formatters={formatters}
      invalidTimeLabel={labels.invalidTime}
      meta={meta}
      size={size}
      baseId={computedBaseId}
      messageId={id}
      avatar={avatar}
      articleProps={{
        ...restProps,
        id: idProp,
        ...slotProps?.article,
        ref: articleRef,
        'data-ui': owner === 'chat-message' ? 'chat-message' : `${owner}-article chat-message`,
        'data-own': isOwn,
        'data-size': size,
        style: { ...restProps.style, ...slotProps?.article?.style },
        className: [className, slotProps?.article?.className].filter(Boolean).join(' ') || undefined,
        css: [messageShellStyle, owner === 'chat-message' && [typographyStyle, threadSizeStyles[size]], isOwn && ownShellStyle, slotProps?.article?.css],
        sx,
      }}
      slots={{ time: slotProps?.time, avatar: slotProps?.avatar }}
    >
      <Card
        data-part={`${owner}-bubble`}
        className={slotProps?.bubble?.className}
        css={[bubbleStyle, isOwn && ownBubbleStyle, slotProps?.bubble?.css]}
      >
        {bodyContent}
        {effectiveAttachments?.length ? (
          <AttachmentList attachments={effectiveAttachments} labels={labels} locale={locale} owner={owner} part={slotProps?.attachments} />
        ) : null}
      </Card>
      <ThreadReactions
        ui={owner}
        reactions={chatReactions(reactions, currentUserId)}
        counts={new Map(reactions.map((reaction) => [reaction.emoji, Math.max(0, reaction.count)]))}
        offered={uniqueBy(offeredReactions, (emoji) => emoji)}
        currentUserId={currentUserId}
        formatters={formatters}
        labels={reactionLabels}
        readOnly={readOnly}
        disabled={disabled}
        pickerOpen={pickerOpen}
        onPickerOpenChange={requestPickerOpen}
        onToggle={handleToggleReaction}
        pickerId={partId(computedBaseId, 'picker', id)}
        part={slotProps?.reactions}
        overlay
      />
      <div
        {...slotProps?.receipt}
        className={slotProps?.receipt?.className}
        data-ui={`${owner}-receipt`}
        css={[receiptStyle, rowStyle, slotProps?.receipt?.css]}
      >
        {status ? (
          <span key={status} data-state={status} css={[status !== 'failed' && fadeStyle, status === 'failed' && errorStyle]}>{labels[status]}</span>
        ) : null}
        {readReceiptText ? <span>{readReceiptText}</span> : null}
        {status === 'failed' && onRetry ? (
          <Button
            size="sm"
            variant="outline"
            aria-label={retryAriaLabel}
            {...slotProps?.retryButton}
            disabled={disabled || slotProps?.retryButton?.disabled}
            loading={retryLoading}
            onClick={(event) => {
              slotProps?.retryButton?.onClick?.(event);
              if (!event.defaultPrevented && !disabled && !retryLoading) onRetry();
            }}
          >
            {labels.retry}
          </Button>
        ) : null}
      </div>
    </ThreadMessageView>
  );
}

export function ChatMessage(props: ChatMessageProps) { return <ChatMessageView {...props} />; }
ChatMessage.displayName = 'ChatMessage';
