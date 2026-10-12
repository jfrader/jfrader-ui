'use client';

import { useEffect, useRef, type ComponentPropsWithRef, type CSSProperties, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Kbd } from '../kbd';

export interface KeycapSpec {
  code: string;
  legend: ReactNode;
  units?: number;
}

export interface KeycapKeyboardSlotProps {
  className?: string;
  css?: Interpolation<Theme>;
}

export interface KeycapKeyboardProps extends Omit<ComponentPropsWithRef<'div'>,
  'children' | 'defaultValue' | 'onChange' | 'tabIndex' | 'role' | 'onKeyDown' | 'onKeyUp'>, SxProps {
  layout?: 'compact' | 'letters';
  rows?: readonly (readonly KeycapSpec[])[];
  value?: readonly string[];
  defaultValue?: readonly string[];
  onValueChange?: (codes: readonly string[]) => void;
  eventTarget?: HTMLInputElement | HTMLTextAreaElement | null;
  tone?: 'neutral' | 'accent';
  paused?: boolean;
  slotProps?: {
    row?: KeycapKeyboardSlotProps;
    key?: KeycapKeyboardSlotProps;
    legend?: KeycapKeyboardSlotProps;
  };
}

const EMPTY_CODES: readonly string[] = [];
const DEFAULT_UNITS = 1;
// The spacing scale has no 2px/3px steps; cap travel and edge depth sit below any spacing token.
const CAP_TRAVEL = '2px';
const CAP_DEPTH = '3px';

const letterRows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((row) =>
  Array.from(row, (legend) => ({ code: `Key${legend}`, legend })),
);
const layouts: Record<NonNullable<KeycapKeyboardProps['layout']>, readonly (readonly KeycapSpec[])[]> = {
  letters: letterRows,
  compact: [
    [{ code: 'Backquote', legend: '`' }, ...Array.from('1234567890', (legend) => ({ code: `Digit${legend}`, legend })),
      { code: 'Minus', legend: '-' }, { code: 'Equal', legend: '=' }, { code: 'Backspace', legend: '⌫', units: 2 }],
    [{ code: 'Tab', legend: 'Tab', units: 1.5 }, ...letterRows[0]!,
      { code: 'BracketLeft', legend: '[' }, { code: 'BracketRight', legend: ']' }, { code: 'Backslash', legend: '\\', units: 1.5 }],
    [{ code: 'CapsLock', legend: 'Caps', units: 1.75 }, ...letterRows[1]!,
      { code: 'Semicolon', legend: ';' }, { code: 'Quote', legend: "'" }, { code: 'Enter', legend: '↵', units: 2.25 }],
    [{ code: 'ShiftLeft', legend: '⇧', units: 2.25 }, ...letterRows[2]!,
      { code: 'Comma', legend: ',' }, { code: 'Period', legend: '.' }, { code: 'Slash', legend: '/' }, { code: 'ShiftRight', legend: '⇧', units: 2.75 }],
    [{ code: 'ControlLeft', legend: 'Ctrl', units: 1.25 }, { code: 'MetaLeft', legend: 'Meta', units: 1.25 },
      { code: 'AltLeft', legend: 'Alt', units: 1.25 }, { code: 'Space', legend: 'Space', units: 6.25 },
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
  paddingInline: vars.space[1],
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

/** Show a keyboard illustration. Supply text input, focus and shortcut descriptions separately. */
export function KeycapKeyboard({
  ref, layout = 'compact', rows = layouts[layout], value, defaultValue = EMPTY_CODES,
  onValueChange, eventTarget = null, tone = 'accent', paused = false, slotProps, className, sx, style, ...rest
}: KeycapKeyboardProps) {
  const silent = useRef(false);
  const [active = EMPTY_CODES, requestChange] = useControlledState(value, normalize(defaultValue), (codes) => {
    if (!silent.current) onValueChange?.(codes);
  });
  const current = useRef(active);
  current.current = normalize(active);
  const previousScope = useRef({ eventTarget, paused });

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
    const down = (event: KeyboardEvent) => {
      if (eventTarget.tagName === 'INPUT' && eventTarget.type === 'password') return;
      if (composing || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || !event.code || event.code === 'Tab' ||
        /^(Meta|Control|Alt)(Left|Right)$/.test(event.code)) return;
      if (observed.has(event.code)) return;
      observed.add(event.code);
      request([...observed]);
    };
    const up = (event: KeyboardEvent) => {
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

  const rowUnits = rows.map((row) => row.reduce((sum, key) => sum + unitsOf(key), 0));
  const widest = Math.max(DEFAULT_UNITS, ...rowUnits);
  const maxGaps = Math.max(0, ...rows.map((row) => row.length - 1));
  return (
    <WithSx className={className} styles={rootStyle} sx={sx}>
      {(rootClass) => (
        <div {...rest} ref={ref} aria-hidden="true" data-ui="keycap-keyboard" data-tone={tone} className={rootClass} style={style}>
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} data-ui="keycap-keyboard-row" className={slotProps?.row?.className}
              css={[rowStyle, slotProps?.row?.css]} style={{
                gridTemplateColumns: row.map((key) => `minmax(0, ${unitsOf(key)}fr)`).join(' '),
                inlineSize: `calc((100% - ${maxGaps} * ${vars.space[1]}) * ${(rowUnits[rowIndex] ?? 0) / widest} + ${Math.max(0, row.length - 1)} * ${vars.space[1]})`,
              } satisfies CSSProperties}>
              {row.map((key, keyIndex) => (
                <Kbd key={`${key.code}-${keyIndex}`} data-code={key.code} data-state={active.includes(key.code) ? 'pressed' : 'idle'}
                  className={slotProps?.key?.className} css={[keyStyle, slotProps?.key?.css]}>
                  {isRenderable(key.legend) && key.legend !== '' && <span data-ui="keycap-keyboard-legend" className={slotProps?.legend?.className}
                    css={[legendStyle, slotProps?.legend?.css]}>{key.legend}</span>}
                </Kbd>
              ))}
            </div>
          ))}
        </div>
      )}
    </WithSx>
  );
}

KeycapKeyboard.displayName = 'KeycapKeyboard';
