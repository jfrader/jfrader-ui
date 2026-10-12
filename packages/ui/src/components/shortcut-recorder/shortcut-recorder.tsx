'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button } from '../button';
import {
  FieldRoot,
  FieldDescription,
  FieldError,
  useFieldAnatomy,
  type FieldPartProps,
} from '../field/field-anatomy';
import { Kbd } from '../kbd';
import { TextField } from '../text-field';

export type ShortcutPlatform = 'mac' | 'other';
export interface ShortcutBinding {
  shortcut: string;
  label: string;
}
export interface ShortcutListGroup {
  label: string;
  items: readonly { label: string; shortcut: string; keywords?: string }[];
}
export interface ShortcutMessages {
  placeholder: string;
  recording: string;
  canceled: string;
  cleared: string;
  noShortcut: string;
  clearLabel: string;
  cancelLabel: string;
  confirmLabel: string;
  reset: (spoken: string) => string;
  set: (spoken: string) => string;
  requireModifier: (platform: ShortcutPlatform) => string;
  conflict: (spoken: string, binding: ShortcutBinding, reserved: boolean) => string;
  listLabel: string;
  searchLabel: string;
  searchPlaceholder: string;
  empty: string;
  results: (count: number) => string;
  keyName: (id: string, platform: ShortcutPlatform) => { label: string; spoken: string };
}
export interface KeyboardEventLike {
  code: string;
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  getModifierState?: (key: string) => boolean;
}

const modifiers = ['mod', 'ctrl', 'alt', 'shift', 'meta'] as const;
const physicalNames: Record<string, string> = {
  Comma: ',',
  Equal: '=',
  Minus: '-',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Backquote: '`',
  Space: 'space',
  Escape: 'escape',
  Backspace: 'backspace',
  Delete: 'delete',
  Enter: 'enter',
  ArrowUp: 'arrowup',
  ArrowDown: 'arrowdown',
  ArrowLeft: 'arrowleft',
  ArrowRight: 'arrowright',
  Home: 'home',
  End: 'end',
  PageUp: 'pageup',
  PageDown: 'pagedown',
  Insert: 'insert',
};
const namedKeys = new Set(Object.values(physicalNames));
const terminology: Record<string, string> = {
  ctrl: 'Control',
  alt: 'Alt',
  shift: 'Shift',
  meta: 'Meta',
  space: 'Space',
  escape: 'Escape',
  backspace: 'Backspace',
  delete: 'Delete',
  enter: 'Enter',
  arrowup: 'Up arrow',
  arrowdown: 'Down arrow',
  arrowleft: 'Left arrow',
  arrowright: 'Right arrow',
  pageup: 'Page Up',
  pagedown: 'Page Down',
  home: 'Home',
  end: 'End',
  insert: 'Insert',
  ',': 'Comma',
  '=': 'Equals',
  '-': 'Minus',
  '.': 'Period',
  '/': 'Slash',
  ';': 'Semicolon',
  "'": 'Quote',
  '[': 'Left bracket',
  ']': 'Right bracket',
  '\\': 'Backslash',
  '`': 'Backquote',
};
const macGlyphs: Record<string, string> = {
  ctrl: '⌃',
  alt: '⌥',
  shift: '⇧',
  meta: '⌘',
};
const baseKeyValid = (key: string) =>
  /^[a-z0-9]$/.test(key) || /^f(?:[1-9]|1[0-9]|2[0-4])$/.test(key) || namedKeys.has(key);
const primaryModifier = (platform: ShortcutPlatform) => (platform === 'mac' ? 'meta' : 'ctrl');

export function normalizeShortcut(shortcut: string, platform: ShortcutPlatform): string | null {
  const parts = shortcut
    .toLowerCase()
    .split('+')
    .map((part) => part.trim());
  const base = parts.at(-1);
  if (!base || !baseKeyValid(base)) return null;
  const prefix = parts.slice(0, -1);
  if (prefix.some((part) => !modifiers.some((modifier) => modifier === part))) return null;
  const normalized = prefix.map((part) => (part === primaryModifier(platform) ? 'mod' : part));
  if (new Set(normalized).size !== normalized.length) return null;
  return [...modifiers.filter((modifier) => normalized.includes(modifier)), base].join('+');
}

function eventModifiers(event: KeyboardEventLike, platform: ShortcutPlatform) {
  return modifiers.filter(
    (modifier) =>
      ({
        mod: platform === 'mac' ? event.metaKey : event.ctrlKey,
        ctrl: platform === 'mac' && event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: platform === 'other' && event.metaKey,
      })[modifier],
  );
}
function eventShortcut(event: KeyboardEventLike, platform: ShortcutPlatform): string | null {
  if (
    event.repeat ||
    event.isComposing ||
    ['Dead', 'Process', 'Unidentified', 'AltGraph'].includes(event.key) ||
    event.getModifierState?.('AltGraph')
  )
    return null;
  const base =
    physicalNames[event.code] ??
    (/^Key[A-Z]$/.test(event.code)
      ? event.code.slice(3).toLowerCase()
      : /^Digit[0-9]$/.test(event.code)
        ? event.code.slice(5)
        : event.code.toLowerCase());
  if (!baseKeyValid(base)) return null;
  return [...eventModifiers(event, platform), base].join('+');
}
export function matchesShortcut(
  event: KeyboardEventLike,
  shortcut: string,
  platform: ShortcutPlatform,
) {
  const normalized = normalizeShortcut(shortcut, platform);
  return normalized !== null && normalized === eventShortcut(event, platform);
}
function formatResults(count: number, locale?: Intl.LocalesArgument) {
  return `${new Intl.NumberFormat(locale).format(count)} ${new Intl.PluralRules(locale).select(count) === 'one' ? 'shortcut' : 'shortcuts'}`;
}

export const defaultShortcutMessages: ShortcutMessages = {
  placeholder: 'Record shortcut',
  recording: 'Recording',
  canceled: 'Recording canceled',
  cleared: 'Shortcut cleared',
  noShortcut: 'No shortcut',
  clearLabel: 'Clear shortcut',
  cancelLabel: 'Cancel',
  confirmLabel: 'Use anyway',
  reset: (spoken) => `Reset to ${spoken}`,
  set: (spoken) => `Shortcut set to ${spoken}`,
  requireModifier: (platform) =>
    `Use ${platform === 'mac' ? 'Command, Control' : 'Control, Meta'} or Alt, or a function key`,
  conflict: (spoken, binding, reserved) =>
    `${spoken}: ${reserved ? 'Reserved shortcut' : 'Already assigned'} — ${binding.label}`,
  listLabel: 'Keyboard shortcuts',
  searchLabel: 'Search shortcuts',
  searchPlaceholder: 'Search shortcuts',
  empty: 'No shortcuts found',
  results: formatResults,
  keyName: (id, platform) => {
    const physical = id === 'mod' ? primaryModifier(platform) : id;
    const spoken =
      physical === 'meta' && platform === 'mac'
        ? 'Command'
        : physical === 'alt' && platform === 'mac'
          ? 'Option'
          : (terminology[physical] ?? physical.toUpperCase());
    return {
      label:
        platform === 'mac'
          ? (macGlyphs[physical] ?? (physical.length === 1 ? physical.toUpperCase() : spoken))
          : physical.length === 1
            ? physical.toUpperCase()
            : spoken,
      spoken,
    };
  },
};
export function formatShortcut(
  shortcut: string,
  platform: ShortcutPlatform,
  messages: ShortcutMessages = defaultShortcutMessages,
) {
  const normalized = normalizeShortcut(shortcut, platform);
  const keys = normalized?.split('+').map((id) => messages.keyName(id, platform)) ?? [];
  return {
    text: keys.map((key) => key.label).join(' + '),
    spoken: keys.length ? keys.map((key) => key.spoken).join(' + ') : messages.noShortcut,
  };
}
const subscribePlatform = () => () => {};
const serverPlatform = (): ShortcutPlatform => 'other';
const detectPlatform = (): ShortcutPlatform =>
  /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '') ? 'mac' : 'other';
export function useShortcutPlatform(override?: ShortcutPlatform): ShortcutPlatform {
  const detected = useSyncExternalStore(subscribePlatform, detectPlatform, serverPlatform);
  return override ?? detected;
}

function useHeldKeys(enabled: boolean, ownerWindow?: Window | null): ReadonlySet<string> {
  const [held, setHeld] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const win = ownerWindow ?? (typeof window === 'undefined' ? undefined : window);
    if (!enabled || !win) {
      setHeld(new Set());
      return;
    }
    const down = (event: KeyboardEvent) => {
      if (event.isComposing || event.getModifierState('AltGraph')) return;
      const chord = eventShortcut(event, 'other');
      const ids = eventModifiers(event, 'other').map((id) => (id === 'mod' ? 'ctrl' : id));
      const base = chord?.split('+').at(-1);
      setHeld((previous) => new Set([...previous, ...ids, ...(base ? [base] : [])]));
    };
    const clear = () => setHeld(new Set());
    const up = (event: KeyboardEvent) => {
      if (event.key === 'Meta') {
        clear();
        return;
      }
      const chord = eventShortcut(
        {
          code: event.code,
          key: event.key,
          ctrlKey: false,
          altKey: false,
          shiftKey: false,
          metaKey: false,
        },
        'other',
      );
      const released =
        ({ Control: 'ctrl', Alt: 'alt', Shift: 'shift' } as Record<string, string>)[event.key] ??
        chord;
      setHeld((previous) => new Set([...previous].filter((id) => id !== released)));
    };
    const visibility = () => {
      if (win.document.visibilityState !== 'visible') clear();
    };
    win.addEventListener('keydown', down);
    win.addEventListener('keyup', up);
    win.addEventListener('blur', clear);
    win.document.addEventListener('visibilitychange', visibility);
    return () => {
      win.removeEventListener('keydown', down);
      win.removeEventListener('keyup', up);
      win.removeEventListener('blur', clear);
      win.document.removeEventListener('visibilitychange', visibility);
    };
  }, [enabled, ownerWindow]);
  return held;
}
export function usePressedShortcutKeys(enabled = true): ReadonlySet<string> {
  return useHeldKeys(enabled);
}

const rowStyle = css({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: vars.space[2],
  minInlineSize: 0,
  maxInlineSize: '100%',
});
const actionStyle = css({
  minBlockSize: vars.space[8],
  blockSize: 'auto',
  maxInlineSize: '100%',
  whiteSpace: 'normal',
  paddingBlock: vars.space[1],
});
const keysStyle = css({
  display: 'inline-flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[1],
  direction: 'ltr',
  maxInlineSize: '100%',
});
const capStyle = css({
  '@starting-style': { opacity: 0 },
  transitionProperty: 'border-color, color, opacity',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&[data-pressed="true"]': {
    borderColor: vars.color.borderControl,
    color: vars.color.accentText,
  },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: {
    borderColor: 'ButtonText',
    '&[data-pressed="true"]': {
      borderBlockEndColor: 'Highlight',
      color: 'Highlight',
    },
  },
});
const smallCapStyle = css({
  fontSize: vars.textSize.xs,
  paddingInline: vars.space[1],
});
const recorderStyle = css({
  display: 'inline-flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[2],
  boxSizing: 'border-box',
  maxInlineSize: '100%',
  paddingBlock: vars.space[1],
  paddingInline: vars.space[3],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.surface,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
  cursor: 'pointer',
  transitionProperty: 'background-color, border-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:focus-visible': focusRingOutset,
  '&[aria-pressed="true"]': { backgroundColor: vars.color.accentSoft },
  '&:disabled, &[aria-disabled="true"]': { cursor: 'not-allowed' },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: { borderColor: 'ButtonText' },
});
const sizeStyles = {
  sm: css({ minBlockSize: vars.space[8], fontSize: vars.textSize.sm }),
  md: css({ minBlockSize: vars.space[10], fontSize: vars.textSize.sm }),
  lg: css({ minBlockSize: vars.space[12], fontSize: vars.textSize.md }),
};
const labelStyle = css({
  color: vars.color.text,
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.medium,
});
const messageStyle = css({
  color: vars.color.text,
  backgroundColor: vars.color.warningSoft,
  padding: vars.space[2],
  borderRadius: vars.radius.sm,
  transitionProperty: 'opacity',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '@starting-style': { opacity: 0 },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
});
const listStyle = css({
  display: 'grid',
  gap: vars.space[4],
  color: vars.color.text,
});
// Narrowest a cheatsheet group column may get. The auto-fit grid adds a second column once the
// container fits two of these plus the gap, so the layout responds to its own width instead of a
// viewport breakpoint token.
const CHEATSHEET_GROUP_MIN_INLINE_SIZE = '16rem';
const groupsStyle = css({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${CHEATSHEET_GROUP_MIN_INLINE_SIZE}), 1fr))`,
  gap: vars.space[6],
});
const itemStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: vars.space[2],
  paddingBlock: vars.space[2],
});
const itemsStyle = css({ listStyle: 'none', padding: 0, margin: 0 });
const headingStyle = css({ fontSize: vars.textSize.md, margin: 0 });

export interface ShortcutKeysProps extends ComponentPropsWithRef<'span'>, SxProps {
  shortcut: string;
  platform?: ShortcutPlatform;
  pressed?: ReadonlySet<string>;
  size?: 'sm' | 'md';
  messages?: ShortcutMessages;
  locale?: Intl.LocalesArgument;
  slotProps?: { key?: FieldPartProps };
}
function ShortcutKeys({
  shortcut,
  platform: platformProp,
  pressed,
  size = 'md',
  messages = defaultShortcutMessages,
  locale: _locale,
  slotProps,
  className,
  sx,
  ...rest
}: ShortcutKeysProps) {
  const platform = useShortcutPlatform(platformProp);
  const normalized = normalizeShortcut(shortcut, platform);
  return (
    <WithSx className={className} styles={keysStyle} sx={sx}>
      {(className) => (
        <span
          role="img"
          aria-label={formatShortcut(shortcut, platform, messages).spoken}
          {...rest}
          data-ui="shortcut-recorder-keys"
          className={className}
        >
          <Kbd.Group aria-hidden css={keysStyle}>
            {normalized?.split('+').map((id) => (
              <Kbd
                key={id}
                data-pressed={
                  pressed?.has(id) ||
                  pressed?.has(id === 'mod' ? primaryModifier(platform) : id) ||
                  undefined
                }
                className={slotProps?.key?.className}
                css={[capStyle, size === 'sm' && smallCapStyle, slotProps?.key?.css]}
              >
                {messages.keyName(id, platform).label}
              </Kbd>
            ))}
          </Kbd.Group>
        </span>
      )}
    </WithSx>
  );
}
ShortcutKeys.displayName = 'ShortcutRecorder.Keys';

type RecorderSlot =
  | 'root'
  | 'label'
  | 'control'
  | 'recorder'
  | 'actions'
  | 'reset'
  | 'clear'
  | 'message'
  | 'confirm'
  | 'cancel'
  | 'description'
  | 'error'
  | 'status'
  | 'key';
export interface ShortcutRecorderProps
  extends Omit<ComponentPropsWithRef<'button'>, 'value' | 'defaultValue'>, SxProps {
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null, details: { replaced?: ShortcutBinding }) => void;
  recording?: boolean;
  defaultRecording?: boolean;
  onRecordingChange?: (recording: boolean) => void;
  resetValue?: string | null;
  bindings?: readonly ShortcutBinding[];
  reservedBindings?: readonly ShortcutBinding[];
  warnReserved?: boolean;
  requireModifier?: boolean;
  platform?: ShortcutPlatform;
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  hideLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  locale?: Intl.LocalesArgument;
  messages?: ShortcutMessages;
  readOnly?: boolean;
  slotProps?: Partial<Record<RecorderSlot, FieldPartProps>>;
}
function ShortcutRecorderRoot({
  ref,
  value,
  defaultValue = null,
  onValueChange,
  recording,
  defaultRecording = false,
  onRecordingChange,
  resetValue,
  bindings = [],
  reservedBindings = [],
  warnReserved = true,
  requireModifier = true,
  platform: platformProp,
  label,
  description,
  error,
  hideLabel = false,
  size = 'md',
  locale,
  messages = defaultShortcutMessages,
  readOnly = false,
  disabled = false,
  name,
  dir,
  slotProps,
  className,
  sx,
  onClick,
  onKeyDown,
  onKeyUp,
  onBlur,
  onFocus,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  id,
  children: _children,
  ...rest
}: ShortcutRecorderProps) {
  const platform = useShortcutPlatform(platformProp);
  const normalizeValue = (input: string | null) =>
    input === null ? null : normalizeShortcut(input, platform);
  const seed = useRef({ value: defaultValue, recording: defaultRecording });
  const replacement = useRef<ShortcutBinding | undefined>(undefined);
  const [current, requestValue] = useControlledState(
    value === undefined ? undefined : normalizeValue(value),
    normalizeValue(defaultValue),
    (next) => onValueChange?.(next, replacement.current ? { replaced: replacement.current } : {}),
  );
  const [active, requestRecording] = useControlledState(
    recording,
    defaultRecording,
    onRecordingChange,
  );
  const [pending, setPending] = useState<{
    shortcut: string;
    binding: ShortcutBinding;
    reserved: boolean;
  } | null>(null);
  const [status, setStatus] = useState('');
  const [recordingHint, setRecordingHint] = useState('');
  const [valueNotice, setValueNotice] = useState<{ value: string | null; text: string } | null>(
    null,
  );
  const [preview, setPreview] = useState<string[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mergedRef = useMergeRefs([buttonRef, ref]);
  const latch = useRef(false);
  const suppressClick = useRef(false);
  const tabExit = useRef(false);
  const visibleLabel = isRenderable(label) && label !== '';
  const field = useFieldAnatomy({
    id,
    description: description === '' ? undefined : description,
    error: error === '' ? undefined : error,
    'aria-describedby': describedBy,
    'aria-invalid': invalid,
  });
  const uid = useId();
  const summaryId = `${uid}-summary`,
    labelId = `${uid}-label`,
    conflictId = `${uid}-conflict`;
  const mutable =
    !disabled && !readOnly && rest['aria-disabled'] !== true && rest['aria-disabled'] !== 'true';
  const stop = () => {
    requestRecording(false);
    setPreview([]);
    setRecordingHint('');
  };
  const changeValue = (next: string | null, replaced?: ShortcutBinding) => {
    replacement.current = replaced;
    requestValue(next);
    replacement.current = undefined;
  };
  const clear = () => {
    setPending(null);
    stop();
    changeValue(null);
    setStatus('');
    setValueNotice({ value: null, text: messages.cleared });
  };
  const cancelConflict = () => {
    setPending(null);
    setValueNotice(null);
    setStatus(messages.canceled);
    buttonRef.current?.focus();
  };
  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;
    const win = button.ownerDocument.defaultView;
    const clearHeld = () => {
      setPreview([]);
      latch.current = false;
    };
    const visibility = () => {
      if (button.ownerDocument.visibilityState !== 'visible') clearHeld();
    };
    win?.addEventListener('blur', clearHeld);
    button.ownerDocument.addEventListener('visibilitychange', visibility);
    return () => {
      win?.removeEventListener('blur', clearHeld);
      button.ownerDocument.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  useEffect(() => {
    const form = buttonRef.current?.form;
    const reset = () => {
      if (value === undefined) requestValue(normalizeValue(seed.current.value));
      if (recording === undefined) requestRecording(seed.current.recording);
      setPending(null);
      setPreview([]);
      latch.current = false;
      setStatus('');
      setValueNotice(null);
      setRecordingHint('');
    };
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  });
  const pendingMessage = pending
    ? messages.conflict(
        formatShortcut(pending.shortcut, platform, messages).spoken,
        pending.binding,
        pending.reserved,
      )
    : '';
  const resetTarget = normalizeValue(resetValue === undefined ? seed.current.value : resetValue);
  const summary = current
    ? formatShortcut(current, platform, messages).spoken
    : messages.noShortcut;
  return (
    <FieldRoot
      data-ui="shortcut-recorder"
      dir={dir}
      className={className}
      sx={sx}
      part={slotProps?.root}
    >
      {visibleLabel && (
        <span
          id={labelId}
          className={slotProps?.label?.className}
          css={[labelStyle, hideLabel && visuallyHiddenStyle, slotProps?.label?.css]}
        >
          {label}
        </span>
      )}
      <div className={slotProps?.control?.className} css={[rowStyle, slotProps?.control?.css]}>
        <button
          {...rest}
          ref={mergedRef}
          id={field.id}
          type="button"
          disabled={disabled}
          aria-disabled={readOnly || rest['aria-disabled']}
          aria-pressed={active ?? false}
          aria-invalid={field.ariaInvalid}
          aria-labelledby={
            [
              labelledBy,
              visibleLabel && labelId,
              (labelledBy || visibleLabel || !rest['aria-label']) && summaryId,
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          aria-describedby={
            [field.describedBy, pending && conflictId].filter(Boolean).join(' ') || undefined
          }
          className={slotProps?.recorder?.className}
          css={[recorderStyle, sizeStyles[size], slotProps?.recorder?.css]}
          onFocus={(event) => {
            tabExit.current = false;
            onFocus?.(event);
          }}
          onBlur={(event) => {
            latch.current = false;
            suppressClick.current = false;
            if (!tabExit.current) {
              stop();
              if (active) setStatus(messages.canceled);
            } else setPreview([]);
            tabExit.current = false;
            onBlur?.(event);
          }}
          onClick={(event) => {
            onClick?.(event);
            if (!mutable || event.defaultPrevented || suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            setPending(null);
            setPreview([]);
            setValueNotice(null);
            setRecordingHint('');
            latch.current = false;
            requestRecording(!active);
            setStatus(active ? messages.canceled : '');
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (
              !mutable ||
              event.defaultPrevented ||
              event.currentTarget.ownerDocument.activeElement !== event.currentTarget
            )
              return;
            const native = event.nativeEvent;
            if (
              native.isComposing ||
              ['Dead', 'Process', 'Unidentified', 'AltGraph'].includes(native.key) ||
              native.getModifierState('AltGraph')
            )
              return;
            if (native.repeat) {
              if (active && event.key !== 'Tab') {
                event.preventDefault();
                event.stopPropagation();
              }
              return;
            }
            const bare = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
            if (event.key === 'Tab') {
              if (active) {
                tabExit.current = true;
                stop();
              }
              return;
            }
            if (bare && event.key === 'Escape' && (active || pending)) {
              event.preventDefault();
              event.stopPropagation();
              if (pending) cancelConflict();
              else {
                stop();
                setStatus(messages.canceled);
              }
              return;
            }
            if (bare && ['Backspace', 'Delete'].includes(event.key)) {
              event.preventDefault();
              event.stopPropagation();
              if (!latch.current) {
                latch.current = true;
                clear();
              }
              return;
            }
            if (!active) return;
            event.preventDefault();
            event.stopPropagation();
            if (bare && ['Enter', ' '].includes(event.key)) {
              suppressClick.current = event.key === ' ';
            }
            setPreview(eventModifiers(native, platform));
            const chord = eventShortcut(native, platform);
            if (!chord || latch.current) return;
            if (
              requireModifier &&
              !event.ctrlKey &&
              !event.altKey &&
              !event.metaKey &&
              !/^f\d+$/.test(chord)
            ) {
              setRecordingHint(messages.requireModifier(platform));
              return;
            }
            latch.current = true;
            stop();
            const binding = bindings.find(
              (item) => normalizeShortcut(item.shortcut, platform) === chord,
            );
            const reserved =
              !binding && warnReserved
                ? reservedBindings.find(
                    (item) => normalizeShortcut(item.shortcut, platform) === chord,
                  )
                : undefined;
            if (binding || reserved)
              setPending({
                shortcut: chord,
                binding: (binding ?? reserved)!,
                reserved: !!reserved,
              });
            else {
              changeValue(chord);
              setStatus('');
              setValueNotice({
                value: chord,
                text: messages.set(formatShortcut(chord, platform, messages).spoken),
              });
            }
          }}
          onKeyUp={(event) => {
            onKeyUp?.(event);
            latch.current = false;
            if (suppressClick.current && event.key === ' ') event.preventDefault();
            suppressClick.current = false;
            if (active)
              setPreview(event.key === 'Meta' ? [] : eventModifiers(event.nativeEvent, platform));
          }}
        >
          <span id={summaryId} css={visuallyHiddenStyle}>
            {active
              ? [
                  messages.recording,
                  ...preview.map((key) => messages.keyName(key, platform).spoken),
                  summary,
                ].join(' ')
              : current
                ? summary
                : `${messages.placeholder} ${summary}`}
          </span>
          <span aria-hidden css={keysStyle}>
            {active ? (
              <>
                {messages.recording}
                {preview.map((key) => (
                  <Kbd
                    key={key}
                    css={[capStyle, slotProps?.key?.css]}
                    className={slotProps?.key?.className}
                  >
                    {messages.keyName(key, platform).label}
                  </Kbd>
                ))}
              </>
            ) : current ? (
              <ShortcutKeys
                shortcut={current}
                platform={platform}
                messages={messages}
                locale={locale}
                aria-hidden
                role="presentation"
                slotProps={{ key: slotProps?.key }}
              />
            ) : (
              messages.placeholder
            )}
          </span>
        </button>
        <div css={[rowStyle, slotProps?.actions?.css]} className={slotProps?.actions?.className}>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            aria-disabled={!mutable}
            css={[actionStyle, slotProps?.reset?.css]}
            className={slotProps?.reset?.className}
            onClick={() => {
              if (!mutable) return;
              stop();
              setPending(null);
              setValueNotice(null);
              changeValue(resetTarget);
            }}
          >
            {messages.reset(
              resetTarget
                ? formatShortcut(resetTarget, platform, messages).spoken
                : messages.noShortcut,
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            aria-disabled={!mutable}
            css={[actionStyle, slotProps?.clear?.css]}
            className={slotProps?.clear?.className}
            onClick={() => {
              if (mutable) clear();
            }}
          >
            {messages.clearLabel}
          </Button>
        </div>
      </div>
      <FieldDescription id={field.descriptionId} part={slotProps?.description}>
        {description === '' ? undefined : description}
      </FieldDescription>
      <FieldError id={field.errorId} part={slotProps?.error}>
        {error === '' ? undefined : error}
      </FieldError>
      {pending && (
        <div
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !event.defaultPrevented) {
              event.preventDefault();
              event.stopPropagation();
              cancelConflict();
            }
          }}
        >
          <div
            id={conflictId}
            css={[messageStyle, slotProps?.message?.css]}
            className={slotProps?.message?.className}
          >
            {pendingMessage}
          </div>
          <div css={rowStyle}>
            <Button
              size="sm"
              disabled={disabled}
              aria-disabled={!mutable}
              css={[actionStyle, slotProps?.confirm?.css]}
              className={slotProps?.confirm?.className}
              onClick={() => {
                if (!mutable) return;
                changeValue(pending.shortcut, pending.reserved ? undefined : pending.binding);
                setPending(null);
                setStatus('');
                setValueNotice({
                  value: pending.shortcut,
                  text: messages.set(formatShortcut(pending.shortcut, platform, messages).spoken),
                });
                buttonRef.current?.focus();
              }}
            >
              {messages.confirmLabel}
            </Button>
            <Button
              size="sm"
              disabled={disabled}
              aria-disabled={!mutable}
              css={[actionStyle, slotProps?.cancel?.css]}
              className={slotProps?.cancel?.className}
              onClick={cancelConflict}
            >
              {messages.cancelLabel}
            </Button>
          </div>
        </div>
      )}
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        css={[visuallyHiddenStyle, slotProps?.status?.css]}
        className={slotProps?.status?.className}
      >
        {pendingMessage ||
          (active
            ? recordingHint || messages.recording
            : valueNotice && current === valueNotice.value
              ? valueNotice.text
              : status)}
      </span>
      {name !== undefined && (
        <input
          type="hidden"
          name={name}
          value={current ?? ''}
          disabled={disabled}
          form={rest.form}
        />
      )}
    </FieldRoot>
  );
}
ShortcutRecorderRoot.displayName = 'ShortcutRecorder';

type ListSlot =
  'root' | 'search' | 'groups' | 'group' | 'heading' | 'item' | 'keys' | 'empty' | 'status';
export interface ShortcutListProps extends ComponentPropsWithRef<'section'>, SxProps {
  groups: readonly ShortcutListGroup[];
  searchable?: boolean;
  highlightPressed?: boolean;
  platform?: ShortcutPlatform;
  locale?: Intl.LocalesArgument;
  messages?: ShortcutMessages;
  inputValue?: string;
  defaultInputValue?: string;
  onInputChange?: (value: string) => void;
  slotProps?: Partial<Record<ListSlot, FieldPartProps>>;
}
function ShortcutList({
  groups,
  searchable = true,
  highlightPressed = true,
  platform,
  locale,
  messages = defaultShortcutMessages,
  inputValue,
  defaultInputValue = '',
  onInputChange,
  slotProps,
  className,
  sx,
  ref,
  ...rest
}: ShortcutListProps) {
  const [query, requestQuery] = useControlledState(inputValue, defaultInputValue, onInputChange);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const mergedRef = useMergeRefs([ref, setRoot]);
  const held = useHeldKeys(highlightPressed, root?.ownerDocument.defaultView);
  const filtered = useMemo(() => {
    const collator = new Intl.Collator(locale, {
      usage: 'search',
      sensitivity: 'base',
    });
    const search = query ?? '';
    const needle = Array.from(search);
    const matches = (text: string) => {
      const chars = Array.from(text);
      return (
        !search ||
        chars.some(
          (_, index) =>
            collator.compare(chars.slice(index, index + needle.length).join(''), search) === 0,
        )
      );
    };
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          matches(`${item.label} ${item.keywords ?? ''} ${item.shortcut}`),
        ),
      }))
      .filter((group) => group.items.length);
  }, [locale, query, groups]);
  const count = filtered.reduce((total, group) => total + group.items.length, 0);
  const results =
    messages.results === formatResults ? formatResults(count, locale) : messages.results(count);
  return (
    <WithSx
      className={[className, slotProps?.root?.className].filter(Boolean).join(' ')}
      styles={[listStyle, slotProps?.root?.css]}
      sx={sx}
    >
      {(className) => (
        <section
          aria-label={messages.listLabel}
          {...rest}
          ref={mergedRef}
          data-ui="shortcut-recorder-list"
          className={className}
        >
          {searchable && (
            <TextField
              label={messages.searchLabel}
              placeholder={messages.searchPlaceholder}
              value={query ?? ''}
              onValueChange={requestQuery}
              slotProps={{ control: slotProps?.search }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  requestQuery('');
                }
              }}
            />
          )}
          <div css={[groupsStyle, slotProps?.groups?.css]} className={slotProps?.groups?.className}>
            {filtered.map((group) => (
              <div
                key={group.label}
                css={slotProps?.group?.css}
                className={slotProps?.group?.className}
              >
                <h3
                  css={[headingStyle, slotProps?.heading?.css]}
                  className={slotProps?.heading?.className}
                >
                  {group.label}
                </h3>
                <ul css={itemsStyle}>
                  {group.items.map((item) => (
                    <li
                      key={item.label}
                      css={[itemStyle, slotProps?.item?.css]}
                      className={slotProps?.item?.className}
                    >
                      <span>{item.label}</span>
                      <ShortcutKeys
                        shortcut={item.shortcut}
                        platform={platform}
                        locale={locale}
                        messages={messages}
                        pressed={highlightPressed ? held : undefined}
                        css={slotProps?.keys?.css}
                        className={slotProps?.keys?.className}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {!count && (
            <p css={slotProps?.empty?.css} className={slotProps?.empty?.className}>
              {messages.empty}
            </p>
          )}
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            css={[visuallyHiddenStyle, slotProps?.status?.css]}
            className={slotProps?.status?.className}
          >
            {results}
          </span>
        </section>
      )}
    </WithSx>
  );
}
ShortcutList.displayName = 'ShortcutRecorder.List';
export const ShortcutRecorder = Object.assign(ShortcutRecorderRoot, {
  Keys: ShortcutKeys,
  List: ShortcutList,
});
