'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { FloatingFocusManager, useInteractions, useMergeRefs } from '@floating-ui/react';
import { motion, MotionConfig, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { raisedSurface, modalShellReset } from '../../styling/surface';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { ThemeScopeContext, useThemeScope } from '../../styling/theme-scope';
import { OverlayLayer, useLayerDismiss } from '../../overlay/overlay-layer';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import { useNativeDialog, useNativeDialogRoot } from '../../overlay/use-native-dialog';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button } from '../button';
import { Avatar } from '../avatar';
import { Select } from '../select';

export interface ShareSheetPerson {
  id: string;
  name: string;
  src?: string;
}
export interface ShareSheetAccessOption {
  value: string;
  label: string;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}
export interface ShareSheetChannel {
  id: string;
  label: string;
  icon?: ReactNode;
  doneLabel?: string;
  disabled?: boolean;
}
export interface ShareSheetSubmission {
  people: ShareSheetPerson[];
  access: string;
}
export interface ShareSheetMessages {
  trigger: string;
  heading: (title: string) => string;
  copy: string;
  copied: string;
  copyFailed: string;
  recentPeople: string;
  sendTo: string;
  remove: (name: string) => string;
  send: (count: string, category: Intl.LDMLPluralRule) => string;
  sending: string;
  sent: (names: string) => string;
  done: string;
  close: string;
  selectionRequired: string;
  accessUnavailable: string;
  sendFailed: string;
  channelFailed: string;
  announce: (event: string) => string;
}
type Slot<E extends 'button' | 'div' | 'h2' | 'span'> = ComponentPropsWithRef<E> & {
  css?: Interpolation<Theme>;
};
export interface ShareSheetSlotProps {
  trigger?: Slot<'button'>;
  content?: Omit<Slot<'div'>, 'onCancel' | 'onClose'> &
    Pick<ComponentPropsWithRef<'dialog'>, 'onCancel' | 'onClose'>;
  title?: Slot<'h2'>;
  copyButton?: Slot<'button'>;
  accessControl?: Slot<'button'>;
  channelList?: Slot<'div'>;
  selectedList?: Slot<'div'>;
  peopleList?: Slot<'div'>;
  sendButton?: Slot<'button'>;
  doneButton?: Slot<'button'>;
  status?: Slot<'div'>;
  grabber?: Slot<'div'>;
}
export interface ShareSheetProps
  extends Omit<ComponentPropsWithRef<'div'>, 'title' | 'defaultValue' | 'onCopy'>, SxProps {
  title: string;
  link: string;
  people: readonly ShareSheetPerson[];
  accessOptions: readonly ShareSheetAccessOption[];
  channels?: readonly ShareSheetChannel[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (next: boolean) => void;
  value?: readonly string[];
  defaultValue?: readonly string[];
  onValueChange?: (next: string[]) => void;
  access?: string;
  defaultAccess?: string;
  onAccessChange?: (next: string) => void;
  onSend?: (submission: ShareSheetSubmission) => void | Promise<unknown>;
  onChannel?: (id: string) => void | Promise<unknown>;
  onCopy?: (access: string) => void;
  align?: 'start' | 'end' | 'center';
  presentation?: 'responsive' | 'popover' | 'sheet';
  locale?: string;
  messages?: Partial<ShareSheetMessages>;
  slotProps?: ShareSheetSlotProps;
}
const PHONE_QUERY = '(max-width: 520px)';
const COPY_RESET_MS = 1800;
const DRAG_DISTANCE = 80;
const DRAG_MIN_DISTANCE = 24;
const DRAG_VELOCITY = 0.6;
const SHAPE_SPRING = { type: 'spring', stiffness: 380, damping: 36 } as const;
const EMPTY_IDS: readonly string[] = [];
const DEFAULT_MESSAGES: ShareSheetMessages = {
  trigger: 'Share',
  heading: (title) => `Share ${title}`,
  copy: 'Copy link',
  copied: 'Copied',
  copyFailed: 'Could not copy link. Try again.',
  recentPeople: 'Recent people',
  sendTo: 'Access',
  remove: (name) => `Remove ${name}`,
  send: (count, category) => `Send to ${count} ${category === 'one' ? 'person' : 'people'}`,
  sending: 'Sending…',
  sent: (names) => `Sent to ${names}`,
  done: 'Done',
  close: 'Close',
  selectionRequired: 'Choose at least one person.',
  accessUnavailable: 'Access unavailable',
  sendFailed: 'Could not send. Try again.',
  channelFailed: 'Could not share. Try again.',
  announce: (event) => event,
};
const rootStyle = css({
  display: 'inline-block',
  fontFamily: vars.font.sans,
  color: vars.color.text,
});
const panelStyle = css({
  ...raisedSurface,
  position: 'relative',
  isolation: 'isolate',
  boxSizing: 'border-box',
  borderRadius: vars.radius.lg,
  inlineSize: `min(var(--share-sheet-width, 24rem), calc(100vw - 2 * ${vars.space[4]}))`,
  maxBlockSize: `min(calc(100dvh - 2 * ${vars.space[4]}), var(--share-sheet-available-height, 100dvh))`,
  overflow: 'auto',
  padding: vars.space[4],
  fontSize: vars.textSize.sm,
  containerType: 'inline-size',
  '&[data-face="sent"]': {
    inlineSize: `min(var(--share-sheet-width, 19rem), calc(100vw - 2 * ${vars.space[4]}))`,
  },
  '&[data-sheet]': {
    maxBlockSize: '85dvh',
    paddingBlockEnd: `calc(${vars.space[4]} + env(safe-area-inset-bottom, 0px))`,
  },
  [FORCED_COLORS]: {
    background: 'Canvas',
    color: 'CanvasText',
    border: '1px solid CanvasText',
    boxShadow: 'none',
  },
  [REDUCED_MOTION]: { transition: 'none' },
});
const shapeStyle = css({
  ...raisedSurface,
  position: 'absolute',
  inset: 0,
  zIndex: -1,
  pointerEvents: 'none',
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.floating,
  [FORCED_COLORS]: { display: 'none' },
});
const triggerBoxStyle = css({ position: 'relative', isolation: 'isolate' });
const shellStyle = css({
  ...modalShellReset,
  position: 'fixed',
  inset: 0,
  margin: 0,
  inlineSize: '100%',
  blockSize: '100dvh',
  maxInlineSize: 'none',
  maxBlockSize: 'none',
  background: 'transparent',
  '&::backdrop': { background: vars.color.scrim },
});
const sheetPositionStyle = css({
  position: 'absolute',
  insetBlockEnd: 0,
  insetInline: 0,
  display: 'flex',
  justifyContent: 'center',
});
const columnStyle = css({ display: 'grid', gap: vars.space[4] });
const rowStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[2],
});
const titleStyle = css({
  margin: 0,
  fontSize: vars.textSize.lg,
  fontWeight: vars.fontWeight.semibold,
  overflowWrap: 'anywhere',
});
const peopleStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: vars.space[2],
  '@container (max-width: 18rem)': { gridTemplateColumns: 'minmax(0, 1fr)' },
});
const personStyle = css({
  minBlockSize: vars.space[10],
  blockSize: 'auto',
  paddingBlock: vars.space[2],
  justifyContent: 'flex-start',
  whiteSpace: 'normal',
  textAlign: 'start',
  overflowWrap: 'anywhere',
  '&[aria-pressed="true"]': {
    background: vars.color.surfaceHover,
    outline: `1px solid ${vars.color.borderControl}`,
  },
  [FORCED_COLORS]: { '&[aria-pressed="true"]': { outline: '2px solid Highlight' } },
});
const copyStyle = css({
  display: 'grid',
  blockSize: 'auto',
  minBlockSize: vars.space[10],
  whiteSpace: 'normal',
  '& > span': { gridArea: '1 / 1', overflowWrap: 'anywhere' },
  '& > [aria-hidden="true"]': { visibility: 'hidden' },
});
const errorStyle = css({ margin: 0, color: vars.color.dangerText });
const grabberStyle = css({
  display: 'flex',
  justifyContent: 'center',
  minBlockSize: vars.space[8],
  touchAction: 'none',
  '&::after': {
    content: '""',
    inlineSize: vars.space[10],
    blockSize: vars.space[1],
    marginBlock: vars.space[3],
    borderRadius: vars.radius.full,
    background: vars.color.borderControl,
  },
  [FORCED_COLORS]: { '&::after': { background: 'CanvasText' } },
});

function ShareSheetLayer({
  nodeId,
  ref,
  className,
  sx,
  title,
  link,
  people,
  accessOptions,
  channels = [],
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  value: valueProp,
  defaultValue = EMPTY_IDS,
  onValueChange,
  access: accessProp,
  defaultAccess,
  onAccessChange,
  onSend,
  onChannel,
  onCopy,
  align = 'end',
  presentation = 'responsive',
  locale,
  messages,
  slotProps: slots = {},
  ...props
}: ShareSheetProps & { nodeId?: string }) {
  const text = { ...DEFAULT_MESSAGES, ...messages };
  const id = useId();
  const [open = false, requestOpen] = useControlledState(openProp, defaultOpen, onOpenChange);
  const [selected = EMPTY_IDS, requestSelected] = useControlledState<readonly string[]>(
    valueProp,
    defaultValue,
    (next) => onValueChange?.([...next]),
  );
  const [access = '', requestAccess] = useControlledState(
    accessProp,
    defaultAccess ?? accessOptions.find((option) => !option.disabled)?.value,
    onAccessChange,
  );
  const [phone, setPhone] = useState(false);
  const [direction, setDirection] = useState<'ltr' | 'rtl'>(props.dir === 'rtl' ? 'rtl' : 'ltr');
  const sheet = presentation === 'sheet' || (presentation === 'responsive' && phone);
  const [accessOpen, setAccessOpen] = useState(false);
  const [face, setFace] = useState<'panel' | 'sent'>('panel');
  const [pending, setPending] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'pending' | 'copied' | 'error'>('idle');
  const [channelStates, setChannelStates] = useState<Record<string, 'pending' | 'done' | 'error'>>(
    {},
  );
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const selectedAnnouncement = useRef<{ value: readonly string[]; message: string } | null>(null);
  const accessAnnouncement = useRef<{ value: string; message: string } | null>(null);
  const [sentNames, setSentNames] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const copyRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const doneRef = useRef<HTMLButtonElement | null>(null);
  const peopleRef = useRef<HTMLDivElement | null>(null);
  const generation = useRef(0);
  const sendBusy = useRef(false);
  const copyBusy = useRef(false);
  const channelBusy = useRef(new Set<string>());
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreFocus = useRef(false);
  const wasOpen = useRef(false);
  const scope = useThemeScope();
  const reduced = useReducedMotion();
  const validAccess = accessOptions.some((option) => option.value === access && !option.disabled);
  const selectedPeople = people.filter((person) => selected.includes(person.id));
  const native = useNativeDialogRoot(sheet && open, requestOpen);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [dialogHost, setDialogHost] = useState<HTMLDialogElement | null>(null);
  const [availableHeight, setAvailableHeight] = useState<number>();
  const floating = useOverlayFloating({
    open,
    nodeId,
    placement: align === 'center' ? 'bottom' : `bottom-${align}`,
    transform: false,
    onAvailableSize: ({ height }) => setAvailableHeight(Math.max(0, height)),
    onOpenChange: (next, _event, reason) => {
      if (accessOpen && !next) return;
      restoreFocus.current = reason === 'escape-key';
      if (sheet && !next) native.requestClose();
      else requestOpen(next);
    },
  });
  const interactions = useInteractions(useLayerDismiss(floating.context, 'container'));
  const { onCancel, onClose, ...contentSlot } = slots.content ?? {};
  const nativeProps = useNativeDialog(
    { ...native, open: sheet && open },
    { onCancel, onClose },
    undefined,
    dialogRef,
  );
  const dialogMergedRef = useMergeRefs([
    nativeProps.ref,
    sheet ? floating.refs.setFloating : null,
    setDialogHost,
  ]);
  const triggerMergedRef = useMergeRefs([
    triggerRef,
    slots.trigger?.ref,
    floating.refs.setReference,
  ]);
  const rootMergedRef = useMergeRefs([ref, rootRef]);
  const copyMergedRef = useMergeRefs([copyRef, slots.copyButton?.ref]);
  const peopleMergedRef = useMergeRefs([peopleRef, slots.peopleList?.ref]);
  const doneMergedRef = useMergeRefs([doneRef, slots.doneButton?.ref]);
  const panelMergedRef = useMergeRefs([panelRef, contentSlot.ref]);
  const previousSheet = useRef(sheet);
  const migrationTarget = useRef<string | null>(null);
  if (previousSheet.current !== sheet) {
    const active = rootRef.current?.ownerDocument.activeElement;
    migrationTarget.current =
      active && panelRef.current?.contains(active)
        ? active.getAttribute('data-share-control')
        : null;
    previousSheet.current = sheet;
  }
  const latestOpen = useRef(open);
  latestOpen.current = open;
  const drag = useRef<{ id: number; y: number; time: number } | null>(null);

  useEffect(() => {
    const win = rootRef.current?.ownerDocument.defaultView;
    if (!win) return;
    const media = win.matchMedia(PHONE_QUERY);
    if (rootRef.current)
      setDirection(win.getComputedStyle(rootRef.current).direction === 'rtl' ? 'rtl' : 'ltr');
    const update = () => setPhone(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setFace('panel');
      setError('');
      setStatus('');
      setChannelStates({});
      setCopyState('idle');
    }
    if (!open) {
      generation.current += 1;
      sendBusy.current = false;
      copyBusy.current = false;
      channelBusy.current.clear();
      setPending(false);
      setAccessOpen(false);
      selectedAnnouncement.current = null;
      accessAnnouncement.current = null;
      if (wasOpen.current && (sheet || restoreFocus.current)) triggerRef.current?.focus();
      restoreFocus.current = false;
    }
    wasOpen.current = open;
  }, [open, sheet]);
  useEffect(() => {
    if (!open) return;
    const win = rootRef.current?.ownerDocument.defaultView;
    const frame = win?.requestAnimationFrame(() => {
      const target = migrationTarget.current;
      migrationTarget.current = null;
      const equivalent = target
        ? Array.from(
            panelRef.current?.querySelectorAll<HTMLElement>('[data-share-control]') ?? [],
          ).find((element) => element.getAttribute('data-share-control') === target)
        : undefined;
      (equivalent ?? (face === 'sent' ? doneRef : copyRef).current)?.focus();
    });
    return () => {
      if (frame !== undefined) win?.cancelAnimationFrame(frame);
    };
  }, [open, sheet, face]);
  useEffect(
    () => () => {
      generation.current += 1;
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );
  const announce = (event: string) => setStatus(text.announce(event));
  useEffect(() => {
    const selection = selectedAnnouncement.current;
    if (
      selection &&
      selection.value.length === selected.length &&
      selection.value.every((value, index) => value === selected[index])
    ) {
      selectedAnnouncement.current = null;
      setError('');
      setStatus(text.announce(selection.message));
    }
    const choice = accessAnnouncement.current;
    if (choice && choice.value === access) {
      accessAnnouncement.current = null;
      setStatus(text.announce(choice.message));
    }
  }, [selected, access, text.announce]);
  const activeRequest = (token: number) => token === generation.current && latestOpen.current;
  const toggle = (person: ShareSheetPerson) => {
    const removing = selected.includes(person.id);
    const next = removing
      ? selected.filter((value) => value !== person.id)
      : [...selected, person.id];
    if (next.length === selected.length && next.every((value, index) => value === selected[index]))
      return;
    selectedAnnouncement.current = {
      value: next,
      message: removing ? text.remove(person.name) : person.name,
    };
    requestSelected(next);
  };
  const close = () => {
    restoreFocus.current = true;
    if (sheet) native.requestClose();
    else requestOpen(false);
  };
  const copy = async () => {
    if (!validAccess || copyBusy.current) return;
    const token = generation.current;
    const snapshot = access;
    copyBusy.current = true;
    setCopyState('pending');
    if (copyTimer.current) clearTimeout(copyTimer.current);
    try {
      const clipboard = rootRef.current?.ownerDocument.defaultView?.navigator.clipboard;
      if (!clipboard?.writeText) throw new Error('Clipboard unavailable');
      await clipboard.writeText(link);
    } catch {
      if (activeRequest(token)) {
        setCopyState('error');
        announce(text.copyFailed);
      }
      if (token === generation.current) copyBusy.current = false;
      return;
    }
    if (!activeRequest(token)) return;
    copyBusy.current = false;
    setCopyState('copied');
    announce(text.copied);
    copyTimer.current = setTimeout(() => {
      if (activeRequest(token)) setCopyState('idle');
    }, COPY_RESET_MS);
    onCopy?.(snapshot);
  };
  const send = async () => {
    if (!validAccess || !onSend || sendBusy.current) return;
    if (!selectedPeople.length) {
      setError(text.selectionRequired);
      announce(text.selectionRequired);
      peopleRef.current?.querySelector('button')?.focus();
      return;
    }
    const token = generation.current;
    const submission = { people: [...selectedPeople], access };
    sendBusy.current = true;
    setPending(true);
    setError('');
    try {
      await onSend(submission);
      if (activeRequest(token)) {
        const names = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(
          submission.people.map((person) => person.name),
        );
        setSentNames(names);
        setFace('sent');
        announce(text.sent(names));
      }
    } catch {
      if (activeRequest(token)) {
        setError(text.sendFailed);
        announce(text.sendFailed);
      }
    } finally {
      if (activeRequest(token)) {
        sendBusy.current = false;
        setPending(false);
      }
    }
  };
  const channel = async (item: ShareSheetChannel) => {
    if (
      !validAccess ||
      !onChannel ||
      item.disabled ||
      channelBusy.current.has(item.id) ||
      channelStates[item.id] === 'done'
    )
      return;
    const token = generation.current;
    channelBusy.current.add(item.id);
    setChannelStates((states) => ({ ...states, [item.id]: 'pending' }));
    try {
      await onChannel(item.id);
      if (activeRequest(token)) {
        setChannelStates((states) => ({ ...states, [item.id]: 'done' }));
        announce(item.doneLabel ?? text.done);
      }
    } catch {
      if (activeRequest(token)) {
        setChannelStates((states) => ({ ...states, [item.id]: 'error' }));
        announce(text.channelFailed);
      }
    } finally {
      if (token === generation.current) channelBusy.current.delete(item.id);
    }
  };
  const titleId = `${id}-title`;
  const errorId = `${id}-error`;
  const copyErrorId = `${id}-copy-error`;
  const channelErrorId = (channelId: string) =>
    `${id}-channel-${encodeURIComponent(channelId)}-error`;
  const contentId = `${id}-content`;
  const count = new Intl.NumberFormat(locale).format(selectedPeople.length);
  const category = new Intl.PluralRules(locale).select(selectedPeople.length);
  const contentStyle: CSSProperties & { '--share-sheet-available-height'?: string } = {
    ...contentSlot.style,
    '--share-sheet-available-height':
      !sheet && availableHeight !== undefined ? `${availableHeight}px` : undefined,
  };
  const surface = (
    <div
      {...contentSlot}
      ref={panelMergedRef}
      dir={props.dir ?? direction}
      id={sheet ? undefined : contentId}
      data-ui="share-sheet-content"
      data-sheet={sheet || undefined}
      data-face={face}
      role={sheet ? undefined : 'dialog'}
      aria-busy={pending || undefined}
      aria-labelledby={[slots.content?.['aria-labelledby'], titleId].filter(Boolean).join(' ')}
      aria-describedby={
        [slots.content?.['aria-describedby'], error && errorId].filter(Boolean).join(' ') ||
        undefined
      }
      css={[panelStyle, slots.content?.css]}
      style={contentStyle}
      onKeyDownCapture={(event) => {
        slots.content?.onKeyDownCapture?.(event);
        if (sheet && event.key === 'Escape' && !event.defaultPrevented) event.preventDefault();
      }}
    >
      <motion.div
        aria-hidden="true"
        css={shapeStyle}
        layout={!reduced}
        layoutId={reduced ? undefined : `${id}-shape`}
        transition={SHAPE_SPRING}
      />
      {sheet && (
        <div
          {...slots.grabber}
          data-ui="share-sheet-grabber"
          css={[grabberStyle, slots.grabber?.css]}
          aria-hidden="true"
          onPointerDown={(event) => {
            slots.grabber?.onPointerDown?.(event);
            if (event.defaultPrevented || event.button !== 0 || !event.isPrimary) return;
            drag.current = { id: event.pointerId, y: event.clientY, time: event.timeStamp };
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerUp={(event) => {
            slots.grabber?.onPointerUp?.(event);
            const start = drag.current;
            drag.current = null;
            if (!start || start.id !== event.pointerId || event.defaultPrevented) return;
            const distance = event.clientY - start.y;
            const velocity = distance / Math.max(1, event.timeStamp - start.time);
            if (
              distance >= DRAG_DISTANCE ||
              (distance >= DRAG_MIN_DISTANCE && velocity >= DRAG_VELOCITY)
            )
              close();
          }}
          onPointerCancel={(event) => {
            slots.grabber?.onPointerCancel?.(event);
            drag.current = null;
          }}
          onLostPointerCapture={(event) => {
            slots.grabber?.onLostPointerCapture?.(event);
            drag.current = null;
          }}
        />
      )}
      <div css={columnStyle}>
        <h2 {...slots.title} id={titleId} css={[titleStyle, slots.title?.css]}>
          {text.heading(title)}
        </h2>
        {face === 'sent' ? (
          <>
            <p>{text.sent(sentNames)}</p>
            <Button
              {...slots.doneButton}
              data-share-control="done"
              ref={doneMergedRef}
              onClick={(event) => {
                slots.doneButton?.onClick?.(event);
                if (!event.defaultPrevented) close();
              }}
            >
              {text.done}
            </Button>
          </>
        ) : (
          <>
            <div css={rowStyle}>
              <Button
                {...slots.copyButton}
                data-share-control="copy"
                ref={copyMergedRef}
                css={[copyStyle, slots.copyButton?.css]}
                disabled={!validAccess || slots.copyButton?.disabled}
                aria-disabled={copyState === 'pending' || undefined}
                aria-busy={copyState === 'pending' || undefined}
                aria-describedby={
                  [slots.copyButton?.['aria-describedby'], copyState === 'error' && copyErrorId]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                onClick={(event) => {
                  slots.copyButton?.onClick?.(event);
                  if (!event.defaultPrevented) void copy();
                }}
              >
                <span aria-hidden={copyState === 'copied'}>{text.copy}</span>
                <span aria-hidden={copyState !== 'copied'}>{text.copied}</span>
              </Button>
              <Select
                value={access}
                onValueChange={(next) => {
                  accessAnnouncement.current = {
                    value: next,
                    message: accessOptions.find((option) => option.value === next)?.label ?? next,
                  };
                  requestAccess(next);
                }}
                open={accessOpen}
                onOpenChange={setAccessOpen}
                disabled={!accessOptions.some((option) => !option.disabled)}
              >
                <Select.Trigger
                  {...slots.accessControl}
                  data-share-control="access"
                  aria-label={slots.accessControl?.['aria-label'] ?? text.sendTo}
                  onKeyDownCapture={(event) => {
                    slots.accessControl?.onKeyDownCapture?.(event);
                    if (
                      event.defaultPrevented ||
                      !accessOpen ||
                      !['ArrowLeft', 'ArrowRight'].includes(event.key)
                    )
                      return;
                    const rtl =
                      event.currentTarget.ownerDocument.defaultView?.getComputedStyle(
                        event.currentTarget,
                      ).direction === 'rtl';
                    const forward = (event.key === 'ArrowRight') !== rtl;
                    event.preventDefault();
                    event.stopPropagation();
                    event.currentTarget.dispatchEvent(
                      new KeyboardEvent('keydown', {
                        key: forward ? 'ArrowDown' : 'ArrowUp',
                        bubbles: true,
                      }),
                    );
                  }}
                >
                  <Select.Value placeholder={text.accessUnavailable} />
                </Select.Trigger>
                <Select.Content>
                  {accessOptions.map((option) => (
                    <Select.Item key={option.value} value={option.value} disabled={option.disabled}>
                      {isRenderable(option.icon) && option.icon !== '' && (
                        <span data-ui="share-sheet-icon" aria-hidden="true">
                          {option.icon}
                        </span>
                      )}
                      {option.label}
                      {isRenderable(option.description) && option.description !== '' && (
                        <span data-ui="share-sheet-access-description">{option.description}</span>
                      )}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            {copyState === 'error' && (
              <p id={copyErrorId} css={errorStyle}>
                {text.copyFailed}
              </p>
            )}
            {!validAccess && <p>{text.accessUnavailable}</p>}
            {channels.length > 0 && (
              <div {...slots.channelList} css={[rowStyle, slots.channelList?.css]}>
                {channels.map((item) => (
                  <div key={item.id}>
                    <Button
                      variant="outline"
                      data-share-control={`channel-${item.id}`}
                      loading={channelStates[item.id] === 'pending'}
                      aria-describedby={
                        channelStates[item.id] === 'error' ? channelErrorId(item.id) : undefined
                      }
                      disabled={
                        !validAccess ||
                        !onChannel ||
                        item.disabled ||
                        channelStates[item.id] === 'done'
                      }
                      onClick={() => void channel(item)}
                    >
                      {isRenderable(item.icon) && item.icon !== '' && (
                        <span data-ui="share-sheet-icon" aria-hidden="true">
                          {item.icon}
                        </span>
                      )}
                      {channelStates[item.id] === 'done'
                        ? (item.doneLabel ?? text.done)
                        : item.label}
                    </Button>
                    {channelStates[item.id] === 'error' && (
                      <p id={channelErrorId(item.id)} css={errorStyle}>
                        {text.channelFailed}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {selectedPeople.length > 0 && (
              <div {...slots.selectedList} css={[rowStyle, slots.selectedList?.css]}>
                {selectedPeople.map((person) => (
                  <Button
                    key={person.id}
                    size="sm"
                    variant="outline"
                    aria-label={text.remove(person.name)}
                    css={personStyle}
                    onClick={() => toggle(person)}
                  >
                    {person.name} <span aria-hidden="true">×</span>
                  </Button>
                ))}
              </div>
            )}
            <section aria-labelledby={`${id}-recent`}>
              <h3 id={`${id}-recent`}>{text.recentPeople}</h3>
              <div
                {...slots.peopleList}
                ref={peopleMergedRef}
                css={[peopleStyle, slots.peopleList?.css]}
              >
                {people.map((person) => (
                  <Button
                    key={person.id}
                    data-share-control={`person-${person.id}`}
                    variant="outline"
                    aria-pressed={selected.includes(person.id)}
                    css={personStyle}
                    onClick={() => toggle(person)}
                  >
                    <span aria-hidden="true">
                      <Avatar name={person.name} src={person.src} size="sm" />
                    </span>
                    {person.name}
                    {selected.includes(person.id) && <span aria-hidden="true">✓</span>}
                  </Button>
                ))}
              </div>
            </section>
            {error && (
              <p id={errorId} css={errorStyle}>
                {error}
              </p>
            )}
            <div css={rowStyle}>
              <Button
                {...slots.sendButton}
                data-share-control="send"
                loading={pending}
                disabled={!validAccess || !onSend || slots.sendButton?.disabled}
                aria-describedby={
                  [slots.sendButton?.['aria-describedby'], error && errorId]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                onClick={(event) => {
                  slots.sendButton?.onClick?.(event);
                  if (!event.defaultPrevented) void send();
                }}
              >
                {pending ? text.sending : text.send(count, category)}
              </Button>
              <Button variant="ghost" data-share-control="close" onClick={close}>
                {text.close}
              </Button>
            </div>
          </>
        )}
        <div
          {...slots.status}
          css={[visuallyHiddenStyle, slots.status?.css]}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {status}
        </div>
      </div>
    </div>
  );
  const dialogScope = {
    theme:
      scope?.theme ??
      ((rootRef.current?.closest('[data-theme]')?.getAttribute('data-theme') === 'light'
        ? 'light'
        : 'dark') as 'light' | 'dark'),
    portalContainer: dialogHost,
  };
  return (
    <WithSx className={className} styles={rootStyle} sx={sx}>
      {(rootClass) => (
        <div {...props} ref={rootMergedRef} className={rootClass} data-ui="share-sheet">
          <div css={triggerBoxStyle}>
            <motion.div
              aria-hidden="true"
              css={shapeStyle}
              layoutId={reduced ? undefined : `${id}-shape`}
              transition={SHAPE_SPRING}
            />
            <Button
              {...slots.trigger}
              ref={triggerMergedRef}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls={contentId}
              onClick={(event) => {
                slots.trigger?.onClick?.(event);
                if (!event.defaultPrevented) {
                  restoreFocus.current = false;
                  if (sheet) native.setOpen(true);
                  else requestOpen(true);
                }
              }}
            >
              {text.trigger}
            </Button>
          </div>
          <dialog
            {...interactions.getFloatingProps({
              ...nativeProps,
              onKeyDownCapture: (event) => {
                if (event.key === 'Escape') event.preventDefault();
              },
            })}
            ref={dialogMergedRef}
            id={sheet ? contentId : undefined}
            css={shellStyle}
            aria-modal="true"
            aria-label={slots.content?.['aria-label']}
            aria-labelledby={[slots.content?.['aria-labelledby'], titleId]
              .filter(Boolean)
              .join(' ')}
            aria-describedby={
              [slots.content?.['aria-describedby'], error && errorId].filter(Boolean).join(' ') ||
              undefined
            }
          >
            {sheet && open && (
              <div css={sheetPositionStyle}>
                <ThemeScopeContext.Provider value={dialogScope}>
                  {surface}
                </ThemeScopeContext.Provider>
              </div>
            )}
          </dialog>
          {!sheet && open && (
            <OverlayPortal>
              <FloatingFocusManager
                context={floating.context}
                modal={false}
                initialFocus={-1}
                returnFocus={false}
                closeOnFocusOut={false}
              >
                <div
                  {...interactions.getFloatingProps()}
                  ref={floating.refs.setFloating}
                  style={floating.floatingStyles}
                >
                  {surface}
                </div>
              </FloatingFocusManager>
            </OverlayPortal>
          )}
        </div>
      )}
    </WithSx>
  );
}

export function ShareSheet(props: ShareSheetProps) {
  return (
    <MotionConfig reducedMotion="user">
      <OverlayLayer>{(nodeId) => <ShareSheetLayer {...props} nodeId={nodeId} />}</OverlayLayer>
    </MotionConfig>
  );
}
ShareSheet.displayName = 'ShareSheet';
