'use client';

import {
  useEffect, useRef, useState, type ComponentPropsWithRef, type ComponentType, type CSSProperties,
  type KeyboardEvent, type ReactNode,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { moveRovingFocus, queryOwnedItems, type OwnedItemsQuery } from '../../utils/roving-focus';
import { useControlledState } from '../../utils/use-controlled-state';
import { Kbd } from '../kbd';
import { applyTextEdit, type TextTarget } from './text-entry';

export interface KeycapSpec {
  /** Identifies the key with a keyboard event `code` value. */
  code: string;
  /** Shows the key face. */
  legend: ReactNode;
  /** Sets the key width in key units. Defaults to `1`. */
  units?: number;
  /** Names the key button in `interactive` mode. Defaults to a string `legend`; required for other legends. */
  label?: string;
  /** Sets the text the key types in `interactive` mode. Letters follow Shift and Caps Lock through their case. */
  text?: string;
  /** Sets the text the key types while Shift is active in `interactive` mode. Defaults to `text`. */
  shiftText?: string;
}

export interface KeycapKeyboardSlotProps {
  className?: string;
  sx?: Interpolation<Theme>;
}

export interface KeycapKeyboardSlots {
  /** Groups a horizontal row of keycaps. */
  row?: ComponentType<KeycapKeyboardSlotProps>;
  /** Displays a keyboard key. */
  key?: ComponentType<KeycapKeyboardSlotProps>;
  /** Displays the key legend. */
  legend?: ComponentType<KeycapKeyboardSlotProps>;
}

export type KeycapKeyboardMode = 'visualizer' | 'interactive';

export interface KeycapKeyboardProps extends Omit<ComponentPropsWithRef<'div'>,
  'children' | 'defaultValue' | 'onChange' | 'tabIndex' | 'role' | 'onKeyDown' | 'onKeyUp'>, SxProps {
  /**
   * Choose how the board responds. `visualizer` lights the keys pressed in `eventTarget` and hides the
   * board from assistive technology. `interactive` also renders typing keys as buttons that type into
   * `eventTarget`: Backspace deletes, Enter adds a line in a textarea or submits an input's form, Shift
   * applies to the next key, and Caps Lock toggles letter case. Defaults to `visualizer`.
   */
  mode?: KeycapKeyboardMode;
  /** Choose the built-in key arrangement. Defaults to `compact`; ignored when `rows` is supplied. */
  layout?: 'compact' | 'letters';
  /** Replace the built-in layout with custom rows of keycaps. */
  rows?: readonly (readonly KeycapSpec[])[];
  /** Control the pressed keys using keyboard event `code` values. Board clicks do not change it. */
  value?: readonly string[];
  /** Set the initially pressed key codes when uncontrolled. Defaults to none. */
  defaultValue?: readonly string[];
  /** Receive requested pressed key codes, deduplicated and sorted. */
  onValueChange?: (codes: readonly string[]) => void;
  /** Observe key events on this input and, in `interactive` mode, type into it. Password inputs are not observed; defaults to no target. */
  eventTarget?: TextTarget | null;
  /** Set the pressed-key colour treatment. Defaults to `accent`. */
  tone?: 'neutral' | 'accent';
  /** Stop observing key events and clear uncontrolled pressed keys. Board keys keep typing. Defaults to `false`. */
  paused?: boolean;
  /** Replace row, keycap or legend elements. */
  slots?: KeycapKeyboardSlots;
  /** Pass props and `sx` to rows, keycaps and legends. */
  slotProps?: {
    /** Horizontal row container grouping keycaps. */
    row?: KeycapKeyboardSlotProps;
    /** Keycap element representing an individual key. Default: `Kbd`. */
    key?: KeycapKeyboardSlotProps;
    /** Text or symbol element displaying the key legend. */
    legend?: KeycapKeyboardSlotProps;
  };
}

type KeyAction = 'backspace' | 'enter' | 'shift' | 'capsLock';

const EMPTY_CODES: readonly string[] = [];
const DEFAULT_UNITS = 1;
const DEFAULT_INTERACTIVE_LABEL = 'Keyboard';
// The spacing scale has no 2px/3px steps; cap travel and edge depth sit below any spacing token.
const CAP_TRAVEL = '2px';
const CAP_DEPTH = '3px';
const ROOT_SELECTOR = '[data-ui="keycap-keyboard"]';
const KEY_QUERY: OwnedItemsQuery = {
  itemSelector: '[data-ui="keycap-keyboard-key-button"]',
  ownerSelector: '[data-ui~="keycap-keyboard-row"]',
};
const KEY_ACTIONS: Partial<Record<string, KeyAction>> = {
  Backspace: 'backspace', Enter: 'enter', NumpadEnter: 'enter', ShiftLeft: 'shift', ShiftRight: 'shift', CapsLock: 'capsLock',
};
const VERTICAL_STEPS: Partial<Record<string, 1 | -1>> = { ArrowDown: 1, ArrowUp: -1 };

const character = (code: string, legend: string, shiftText?: string): KeycapSpec => ({ code, legend, text: legend, shiftText });
const letterRows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((row) =>
  Array.from(row, (legend): KeycapSpec => ({ code: `Key${legend}`, legend, text: legend.toLowerCase() })),
);
const DIGIT_SHIFTS = '!@#$%^&*()';
const layouts: Record<NonNullable<KeycapKeyboardProps['layout']>, readonly (readonly KeycapSpec[])[]> = {
  letters: letterRows,
  compact: [
    [character('Backquote', '`', '~'), ...Array.from('1234567890', (legend, index) => character(`Digit${legend}`, legend, DIGIT_SHIFTS[index])),
      character('Minus', '-', '_'), character('Equal', '=', '+'), { code: 'Backspace', legend: '⌫', label: 'Backspace', units: 2 }],
    [{ code: 'Tab', legend: 'Tab', units: 1.5 }, ...letterRows[0]!,
      character('BracketLeft', '[', '{'), character('BracketRight', ']', '}'), { ...character('Backslash', '\\', '|'), units: 1.5 }],
    [{ code: 'CapsLock', legend: 'Caps', label: 'Caps Lock', units: 1.75 }, ...letterRows[1]!,
      character('Semicolon', ';', ':'), character('Quote', "'", '"'), { code: 'Enter', legend: '↵', label: 'Enter', units: 2.25 }],
    [{ code: 'ShiftLeft', legend: '⇧', label: 'Shift', units: 2.25 }, ...letterRows[2]!,
      character('Comma', ',', '<'), character('Period', '.', '>'), character('Slash', '/', '?'), { code: 'ShiftRight', legend: '⇧', label: 'Shift', units: 2.75 }],
    [{ code: 'ControlLeft', legend: 'Ctrl', units: 1.25 }, { code: 'MetaLeft', legend: 'Meta', units: 1.25 },
      { code: 'AltLeft', legend: 'Alt', units: 1.25 }, { code: 'Space', legend: 'Space', text: ' ', units: 6.25 },
      { code: 'AltRight', legend: 'Alt', units: 1.25 }, { code: 'MetaRight', legend: 'Meta', units: 1.25 },
      { code: 'ContextMenu', legend: 'Menu', units: 1.25 }, { code: 'ControlRight', legend: 'Ctrl', units: 1.25 }],
  ],
};

const rootStyle = css({
  label: 'keycap-keyboard',
  boxSizing: 'border-box',
  display: 'grid',
  gap: vars.space[1],
  inlineSize: '100%',
  minInlineSize: 0,
  padding: vars.space[2],
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surfaceInset,
  border: `1px solid ${vars.color.borderSubtle}`,
  boxShadow: vars.shadow.raised,
  [FORCED_COLORS]: { backgroundColor: 'Canvas', borderColor: 'CanvasText', boxShadow: 'none' },
});
const rowStyle = css({ display: 'grid', direction: 'ltr', gap: vars.space[1], minInlineSize: 0 });
const keyStyle = css({
  minInlineSize: 0,
  minBlockSize: vars.space[6],
  justifyContent: 'center',
  paddingInline: 0,
  paddingBlock: vars.space[2],
  whiteSpace: 'normal',
  borderColor: vars.color.borderStrong,
  borderBlockEndWidth: CAP_DEPTH,
  transition: `transform ${vars.motion.duration.slow} ${vars.motion.easeStandard}`,
  '&[data-state="pressed"]': {
    transform: `translateY(${CAP_TRAVEL})`,
    backgroundColor: vars.color.surfaceRaised,
    transitionDuration: vars.motion.duration.fast,
  },
  '[data-tone="accent"] &[data-state="pressed"]': {
    backgroundColor: vars.color.accentSoft,
    borderColor: vars.color.accent,
  },
  [REDUCED_MOTION]: { transitionDuration: '0s', '&[data-state="pressed"]': { transform: 'none', transitionDuration: '0s' } },
  [FORCED_COLORS]: {
    backgroundColor: 'ButtonFace', color: 'CanvasText', borderColor: 'CanvasText', boxShadow: 'none',
    '&[data-state="pressed"]': { backgroundColor: 'Highlight', color: 'HighlightText', borderColor: 'CanvasText' },
    '[data-tone="accent"] &[data-state="pressed"]': { backgroundColor: 'Highlight', borderColor: 'CanvasText' },
  },
});
const interactiveKeyStyle = css({ minBlockSize: vars.space[8] });
const keyButtonStyle = css({
  display: 'grid',
  minInlineSize: 0,
  margin: 0,
  padding: 0,
  border: 0,
  borderRadius: vars.radius.sm,
  backgroundColor: 'transparent',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
  touchAction: 'manipulation',
  '&:focus-visible': focusRingOutset,
});
const legendStyle = css({ minInlineSize: 0, overflowWrap: 'anywhere', textAlign: 'center' });

function normalize(codes: readonly string[]) {
  return [...new Set(codes)].sort();
}
function equalCodes(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((code, index) => code === b[index]);
}
function unitsOf(key: KeycapSpec) {
  return key.units !== undefined && Number.isFinite(key.units) && key.units > 0 ? key.units : DEFAULT_UNITS;
}
function spanSize(units: number, totalUnits: number) {
  return `calc((100% + ${vars.space[1]}) * ${units / totalUnits} - ${vars.space[1]})`;
}
function isOperable(key: KeycapSpec) {
  return KEY_ACTIONS[key.code] !== undefined || key.text !== undefined;
}
function keyName(key: KeycapSpec) {
  return key.label ?? (typeof key.legend === 'string' ? key.legend : undefined);
}
/** The text a typing key enters: letters change case, other keys switch to `shiftText`. */
function typedText(key: KeycapSpec & { text: string }, shifted: boolean, capsLock: boolean) {
  const upper = key.text.toLocaleUpperCase();
  const lower = key.text.toLocaleLowerCase();
  if (key.shiftText === undefined && upper !== lower) return shifted !== capsLock ? upper : lower;
  return shifted ? key.shiftText ?? key.text : key.text;
}
function centerX(element: Element) {
  const rect = element.getBoundingClientRect();
  return rect.left + rect.width / 2;
}
/** Moves focus to the nearest key in the next row that has keys, keeping the column. */
function moveVertical(event: KeyboardEvent<HTMLButtonElement>, step: 1 | -1) {
  const button = event.currentTarget;
  const root = button.closest<HTMLElement>(ROOT_SELECTOR);
  const row = button.closest<HTMLElement>(KEY_QUERY.ownerSelector);
  if (!root || !row) return;
  event.preventDefault();
  const rows = Array.from(root.querySelectorAll<HTMLElement>(KEY_QUERY.ownerSelector));
  const x = centerX(button);
  for (let index = rows.indexOf(row) + step; index >= 0 && index < rows.length; index += step) {
    const keys = queryOwnedItems(rows[index]!, KEY_QUERY);
    if (keys.length === 0) continue;
    keys.reduce((best, key) => (Math.abs(centerX(key) - x) < Math.abs(centerX(best) - x) ? key : best)).focus();
    return;
  }
}

/** Show a keyboard illustration, or an on-screen keyboard that types into a bound input. */
export function KeycapKeyboard({
  ref, mode = 'visualizer', layout = 'compact', rows = layouts[layout], value, defaultValue = EMPTY_CODES,
  onValueChange, eventTarget = null, tone = 'accent', paused = false, slotProps, slots, className, sx, style, ...rest
}: KeycapKeyboardProps) {
  const interactive = mode === 'interactive';
  const silent = useRef(false);
  const [active = EMPTY_CODES, requestChange] = useControlledState(value, normalize(defaultValue), (codes) => {
    if (!silent.current) onValueChange?.(codes);
  });
  const current = useRef(active);
  current.current = normalize(active);
  const previousScope = useRef({ eventTarget, paused });
  const composing = useRef(false);
  const [shiftLatched, setShiftLatched] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  // Board keys are identified by position: custom rows may repeat a code.
  const [tapped, setTapped] = useState<string | null>(null);
  const [tabStop, setTabStop] = useState<string | null>(null);

  useEffect(() => {
    const previous = previousScope.current;
    previousScope.current = { eventTarget, paused };
    if (value === undefined && (previous.eventTarget !== eventTarget || previous.paused !== paused)) {
      silent.current = true;
      requestChange(EMPTY_CODES);
      silent.current = false;
      current.current = EMPTY_CODES;
    }
    if (!eventTarget || paused || (eventTarget.tagName === 'INPUT' && eventTarget.type === 'password')) return;
    const target: HTMLElement = eventTarget;
    const doc = target.ownerDocument;
    const win = doc.defaultView;
    let observed = new Set(current.current);
    let composing = false;
    let lastRequest: readonly string[] | undefined;
    const request = (codes: readonly string[]) => {
      const next = normalize(codes);
      if (lastRequest && equalCodes(next, lastRequest)) return;
      lastRequest = next;
      if (!equalCodes(next, current.current)) requestChange(next);
    };
    const clear = () => {
      observed = new Set();
      request(EMPTY_CODES);
    };
    const down = (event: globalThis.KeyboardEvent) => {
      if (eventTarget.tagName === 'INPUT' && eventTarget.type === 'password') return;
      if (composing || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || !event.code || event.code === 'Tab' ||
        /^(Meta|Control|Alt)(Left|Right)$/.test(event.code)) return;
      if (observed.has(event.code)) return;
      observed.add(event.code);
      request([...observed]);
    };
    const up = (event: globalThis.KeyboardEvent) => {
      if (eventTarget.tagName === 'INPUT' && eventTarget.type === 'password') return;
      if (!observed.delete(event.code)) return;
      request([...observed]);
    };
    const compositionStart = () => { composing = true; clear(); };
    const compositionEnd = () => { composing = false; };
    const visibility = () => { if (doc.visibilityState === 'hidden') clear(); };
    target.addEventListener('keydown', down);
    target.addEventListener('keyup', up);
    target.addEventListener('blur', clear);
    target.addEventListener('compositionstart', compositionStart);
    target.addEventListener('compositionend', compositionEnd);
    win?.addEventListener('blur', clear);
    doc.addEventListener('visibilitychange', visibility);
    return () => {
      target.removeEventListener('keydown', down);
      target.removeEventListener('keyup', up);
      target.removeEventListener('blur', clear);
      target.removeEventListener('compositionstart', compositionStart);
      target.removeEventListener('compositionend', compositionEnd);
      win?.removeEventListener('blur', clear);
      doc.removeEventListener('visibilitychange', visibility);
    };
  }, [eventTarget, paused, requestChange, value === undefined]);

  // Board keys never type into an open composition; the IME owns the text until it ends.
  useEffect(() => {
    if (!interactive || !eventTarget) return;
    const start = () => { composing.current = true; };
    const end = () => { composing.current = false; };
    eventTarget.addEventListener('compositionstart', start);
    eventTarget.addEventListener('compositionend', end);
    return () => {
      composing.current = false;
      eventTarget.removeEventListener('compositionstart', start);
      eventTarget.removeEventListener('compositionend', end);
    };
  }, [interactive, eventTarget]);

  const activate = (key: KeycapSpec, shiftHeld: boolean) => {
    const action = KEY_ACTIONS[key.code];
    if (action === 'shift') { setShiftLatched((latched) => !latched); return; }
    if (action === 'capsLock') { setCapsLock((locked) => !locked); return; }
    if (!eventTarget || composing.current) return;
    if (action === 'backspace') applyTextEdit(eventTarget, { inputType: 'deleteContentBackward' });
    else if (action === 'enter') {
      if (eventTarget.tagName === 'TEXTAREA') applyTextEdit(eventTarget, { inputType: 'insertLineBreak' });
      else if (!eventTarget.disabled && !eventTarget.readOnly) eventTarget.form?.requestSubmit();
    } else if (key.text !== undefined) {
      applyTextEdit(eventTarget, { inputType: 'insertText', data: typedText({ ...key, text: key.text }, shiftLatched || shiftHeld, capsLock) });
    }
    setShiftLatched(false);
  };
  const isLatched = (code: string) => (KEY_ACTIONS[code] === 'shift' && shiftLatched) || (KEY_ACTIONS[code] === 'capsLock' && capsLock);

  const rowUnits = rows.map((row) => row.reduce((sum, key) => sum + unitsOf(key), 0));
  const Key = slots?.key ?? Kbd;
  const Row = slots?.row ?? 'div';
  const Legend = slots?.legend ?? 'span';
  const widest = Math.max(DEFAULT_UNITS, ...rowUnits);
  const firstOperable = rows.flatMap((row, rowIndex) => row.map((key, keyIndex) => (isOperable(key) ? `${rowIndex}-${keyIndex}` : null)))
    .find((position) => position !== null);
  const positionOperable = (position: string | null) => {
    if (position === null) return false;
    const [rowIndex, keyIndex] = position.split('-').map(Number);
    const key = rows[rowIndex!]?.[keyIndex!];
    return key !== undefined && isOperable(key);
  };
  const currentTabStop = positionOperable(tabStop) ? tabStop : firstOperable;
  const rootSemantics = interactive
    ? { role: 'group', 'aria-label': rest['aria-label'] ?? (rest['aria-labelledby'] === undefined ? DEFAULT_INTERACTIVE_LABEL : undefined) }
    : { 'aria-hidden': true };
  return (
    <WithSx className={className} styles={rootStyle} sx={sx}>
      {(rootClass) => (
        <div {...rest} {...rootSemantics} ref={ref} data-ui="keycap-keyboard" data-mode={mode} data-tone={tone} className={rootClass} style={style}>
          {rows.map((row, rowIndex) => (
            <Row {...withoutSx(slotProps?.row)} key={rowIndex} data-ui="keycap-keyboard-row" className={slotProps?.row?.className}
              css={[rowStyle, slotProps?.row?.sx]} style={{
                gridTemplateColumns: row.map((key) => `minmax(0, ${spanSize(unitsOf(key), rowUnits[rowIndex] || DEFAULT_UNITS)})`).join(' '),
                inlineSize: `max(0px, ${spanSize(rowUnits[rowIndex] ?? 0, widest)})`,
              } satisfies CSSProperties}>
              {row.map((key, keyIndex) => {
                const position = `${rowIndex}-${keyIndex}`;
                const operable = interactive && isOperable(key);
                const pressed = active.includes(key.code) || (interactive && (tapped === position || isLatched(key.code)));
                const cap = (
                  <Key {...withoutSx(slotProps?.key)} key={operable ? undefined : `${key.code}-${keyIndex}`} data-ui="keycap-keyboard-key" data-code={key.code}
                    data-state={pressed ? 'pressed' : 'idle'} aria-hidden={interactive && !operable ? true : undefined}
                    className={slotProps?.key?.className} css={[keyStyle, interactive && interactiveKeyStyle, slotProps?.key?.sx]}>
                    {isRenderable(key.legend) && key.legend !== '' && <Legend {...withoutSx(slotProps?.legend)} data-ui="keycap-keyboard-legend" className={slotProps?.legend?.className}
                      css={[legendStyle, slotProps?.legend?.sx]}>{key.legend}</Legend>}
                  </Key>
                );
                if (!operable) return cap;
                const action = KEY_ACTIONS[key.code];
                return (
                  <button key={`${key.code}-${keyIndex}`} type="button" data-ui="keycap-keyboard-key-button" data-code={key.code}
                    css={keyButtonStyle} tabIndex={position === currentTabStop ? 0 : -1} aria-label={keyName(key)}
                    aria-pressed={action === 'shift' || action === 'capsLock' ? isLatched(key.code) : undefined}
                    // Keeps focus and the caret in the bound input on pointer presses.
                    onMouseDown={(event) => event.preventDefault()}
                    onPointerDown={(event) => { if (event.button === 0) setTapped(position); }}
                    onPointerUp={() => setTapped(null)} onPointerLeave={() => setTapped(null)} onPointerCancel={() => setTapped(null)}
                    onFocus={() => setTabStop(position)} onBlur={() => setTapped(null)}
                    onKeyDown={(event) => {
                      const step = VERTICAL_STEPS[event.key];
                      if (step !== undefined) moveVertical(event, step);
                      else if (event.key === 'Enter' || event.key === ' ') { if (!event.repeat) setTapped(position); }
                      else {
                        const owner = event.currentTarget.closest<HTMLElement>(KEY_QUERY.ownerSelector);
                        if (owner) moveRovingFocus(event, owner, 'horizontal', KEY_QUERY);
                      }
                    }}
                    onKeyUp={() => setTapped(null)}
                    onClick={(event) => activate(key, event.shiftKey)}>
                    {cap}
                  </button>
                );
              })}
            </Row>
          ))}
        </div>
      )}
    </WithSx>
  );
}

KeycapKeyboard.displayName = 'KeycapKeyboard';
