import { withoutSx } from '../../styling/sx';
'use client';

import {
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { inputControlStyle } from '../../styling/input-control';
import type { SxProps } from '../../styling/sx';
import { useControlledState } from '../../utils/use-controlled-state';
import { isRenderable } from '../../utils/renderable';
import {
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
  useFieldAnatomy,
} from '../field/field-anatomy';
import {
  FieldSlot,
  type FieldParts,
  type FieldSlots,
} from '../field/field-slot';
import { Dialog } from '../dialog';
import { TextField } from '../text-field';
import { Select } from '../select';
import { Button } from '../button';
import {
  clamp,
  contrastColor,
  fromChannels,
  parseColor,
  serializeColor,
  type ColorFormat,
  type ContrastGrade,
  type PickerColor,
} from './color-adapter';
import {
  EyeDropperCapability,
  type EyeDropperConstructor,
} from './eye-dropper-capability';

export type { ColorFormat } from './color-adapter';
export interface ColorSwatch {
  id: string;
  color: string;
  label?: string;
}
export interface ColorPickerMessages {
  dialog: string;
  saturation: string;
  value: string;
  hue: string;
  opacity: string;
  format: string;
  color: string;
  invalid: string;
  gamutWarning: string;
  save: string;
  savedColors: string;
  movePrevious: string;
  moveNext: string;
  remove: string;
  eyeDropper: string;
  eyeDropperError: string;
  done: string;
  empty: string;
  grades: Record<ContrastGrade, string>;
  contrast: (ratio: string, grade: string) => string;
  result: (hex: string, contrast?: string) => string;
  swatch: (hex: string, label?: string) => string;
}
type Anatomy = {
  root: 'div';
  trigger: 'button';
  content: 'div';
  pad: 'div';
  range: 'input';
  field: 'input';
  contrast: 'div';
  swatches: 'div';
  description: 'span';
  error: 'span';
};
export type ColorPickerSlotProps = FieldParts<Anatomy>;
export type ColorPickerSlots = FieldSlots<Anatomy>;
type Seed =
  | { value: string; defaultValue?: string }
  | { value?: undefined; defaultValue: string };
export type ColorPickerProps = Omit<
  ComponentPropsWithRef<'div'>,
  'defaultValue' | 'onChange'
> &
  SxProps &
  Seed & {
    /** Receive normalized uppercase sRGB hex, including alpha when translucent. */
    onValueChange?: (hex: string) => void;
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    format?: ColorFormat;
    defaultFormat?: ColorFormat;
    onFormatChange?: (format: ColorFormat) => void;
    swatches?: ColorSwatch[];
    defaultSwatches?: ColorSwatch[];
    onSwatchesChange?: (swatches: ColorSwatch[]) => void;
    /** Maximum saved colors; saving at capacity removes the oldest. Default: 7. */
    maxSwatches?: number;
    /** Opaque comparison background. Omit to hide the contrast result. */
    background?: string;
    alpha?: boolean;
    eyeDropper?: boolean;
    label: ReactNode;
    description?: ReactNode;
    error?: ReactNode;
    disabled?: boolean;
    readOnly?: boolean;
    required?: boolean;
    locale?: string;
    messages: ColorPickerMessages;
    size?: 'sm' | 'md' | 'lg';
    name?: string;
    icons?: Partial<
      Record<
        'save' | 'movePrevious' | 'moveNext' | 'remove' | 'eyeDropper' | 'done',
        ReactNode
      >
    >;
    component?: ColorPickerSlots['root'];
    slots?: ColorPickerSlots;
    slotProps?: ColorPickerSlotProps;
  };

const panelStyle = css({
  display: 'grid',
  gap: vars.space[2],
  inlineSize: 'min(30rem, calc(100vi - 2rem))',
  maxInlineSize: '100%',
  minInlineSize: 0,
  containerType: 'inline-size',
  color: vars.color.text,
  '@media (min-width: 30rem)': { gap: vars.space[3] },
  '& button, & input, & [role="combobox"]': { minBlockSize: vars.space[8] },
});
const panelGridStyle = css({
  display: 'grid',
  gap: vars.space[4],
  gridTemplateColumns: 'minmax(0, 1fr)',
  alignItems: 'start',
  '@container (min-width: 26rem)': {
    gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)',
  },
});
const panelColumnStyle = css({
  display: 'grid',
  gap: vars.space[2],
  alignContent: 'start',
  minInlineSize: 0,
  '@container (min-width: 26rem)': { gap: vars.space[3] },
});
const rowStyle = css({
  display: 'flex',
  gap: vars.space[2],
  flexWrap: 'wrap',
  alignItems: 'center',
});
const channelStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)',
  alignItems: 'center',
  gap: vars.space[2],
  fontSize: vars.textSize.sm,
});
const rangeStyle = css({
  inlineSize: '100%',
  minBlockSize: vars.space[8],
  margin: 0,
  accentColor: vars.color.accentText,
  '&:focus-visible': focusRingOutset,
});
const swatchStyle = css({
  display: 'inline-block',
  inlineSize: vars.space[8],
  blockSize: vars.space[8],
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.borderControl}`,
  backgroundColor: 'var(--picker-color)',
  flexShrink: 0,
});
const triggerStyles = {
  sm: css({ minBlockSize: vars.space[8] }),
  md: css({ minBlockSize: vars.space[10] }),
  lg: css({ minBlockSize: vars.space[12] }),
};
const triggerStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[2],
  minInlineSize: '10rem',
  paddingInline: vars.space[3],
  cursor: 'pointer',
  textAlign: 'start',
  fontFamily: vars.font.mono,
});
const triggerValueStyle = css({
  minInlineSize: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const padStyle = css({
  position: 'relative',
  blockSize: '8rem',
  '@container (min-width: 26rem)': { blockSize: '10rem' },
  touchAction: 'none',
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.borderControl}`,
  backgroundColor: 'var(--picker-hue)',
  backgroundImage: `linear-gradient(to top, ${vars.color.colorPickerBlack}, transparent), linear-gradient(to right, ${vars.color.colorPickerWhite}, transparent)`,
  '&[data-invalid="true"]': {
    backgroundImage: 'none',
    backgroundColor: vars.color.surfaceInset,
  },
});
const thumbStyle = css({
  position: 'absolute',
  left: 'var(--picker-x)',
  top: 'var(--picker-y)',
  inlineSize: vars.space[3],
  blockSize: vars.space[3],
  borderRadius: vars.radius.full,
  border: `2px solid ${vars.color.colorPickerWhite}`,
  outline: `2px solid ${vars.color.colorPickerBlack}`,
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'none',
});
const paletteStyle = css({
  display: 'flex',
  gap: vars.space[2],
  overflowX: 'auto',
  padding: vars.space[2],
});
const optionStyle = css({
  display: 'grid',
  justifyItems: 'center',
  gap: vars.space[1],
  minInlineSize: vars.space[8],
  minBlockSize: vars.space[8],
  padding: vars.space[1],
  fontSize: vars.textSize.xs,
  lineHeight: vars.lineHeight.tight,
  textAlign: 'center',
  color: vars.color.text,
  backgroundColor: vars.color.surfaceInset,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  overflowWrap: 'anywhere',
  '@container (min-width: 26rem)': { padding: vars.space[2], fontSize: vars.textSize.sm },
  '&[aria-selected="true"]': { borderWidth: '2px' },
  '&:focus-visible': focusRingOutset,
});
const headingStyle = css({
  margin: 0,
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.semibold,
});
const noteStyle = css({
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
  overflowWrap: 'anywhere',
});
const checkerStyle = css({
  display: 'inline-flex',
  flexShrink: 0,
  lineHeight: 0,
  overflow: 'hidden',
  backgroundImage: `repeating-conic-gradient(${vars.color.colorPickerCheckerA} 0% 25%, ${vars.color.colorPickerCheckerB} 0% 50%)`,
  backgroundSize: `${vars.space[4]} ${vars.space[4]}`,
  borderRadius: vars.radius.md,
});
const formats: ColorFormat[] = ['hex', 'rgb', 'hsl', 'oklch'];
const colorStyle = (color?: string) =>
  ({ '--picker-color': color ?? 'transparent' }) as CSSProperties;
type DropperWindow = Window & { EyeDropper?: EyeDropperConstructor };
const equalSwatches = (a: ColorSwatch[], b: ColorSwatch[]) =>
  a.length === b.length &&
  a.every(
    (item, index) =>
      item.id === b[index]?.id &&
      (parseColor(item.color)?.hex ?? item.color) ===
        (parseColor(b[index]!.color)?.hex ?? b[index]!.color) &&
      item.label === b[index]?.label,
  );

export function ColorPicker({
  ref,
  value,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  format: formatProp,
  defaultFormat = 'hex',
  onFormatChange,
  swatches: swatchesProp,
  defaultSwatches = [],
  onSwatchesChange,
  maxSwatches = 7,
  background,
  alpha = true,
  eyeDropper = true,
  label,
  description,
  error,
  disabled = false,
  readOnly = false,
  required,
  locale,
  messages,
  size = 'md',
  name,
  icons,
  component,
  slots,
  slotProps,
  className,
  sx,
  dir,
  id: idProp,
  'aria-describedby': describedBy,
  'aria-labelledby': labelledBy,
  'aria-invalid': invalidProp,
  ...rest
}: ColorPickerProps) {
  if (!Number.isInteger(maxSwatches) || maxSwatches < 1)
    throw new RangeError('ColorPicker maxSwatches must be a positive integer.');
  const [raw = '', requestValue, resetValue] = useControlledState(
    value,
    defaultValue,
    onValueChange,
  );
  const [open = false, requestOpen] = useControlledState(
    openProp,
    defaultOpen,
    onOpenChange,
  );
  const [format = 'hex', requestFormat, resetFormat] = useControlledState(
    formatProp,
    defaultFormat,
    onFormatChange,
  );
  const [swatches = [], setSwatches, resetSwatches] = useControlledState(
    swatchesProp,
    defaultSwatches,
    onSwatchesChange,
  );
  if (new Set(swatches.map((item) => item.id)).size !== swatches.length)
    throw new Error('ColorPicker swatch IDs must be unique.');
  const parsed = parseColor(raw);
  const [precision, setPrecision] = useState<PickerColor>();
  const lastHue = useRef(parsed?.h ?? 0);
  const color =
    precision && precision.hex === parsed?.hex
      ? precision
      : parsed && parsed.s === 0
        ? { ...parsed, h: lastHue.current }
        : parsed;
  useEffect(() => {
    if (color && color.s > 0) lastHue.current = color.h;
  }, [color?.h, color?.s]);
  const [draft, setDraft] = useState<{ key: string; text: string }>();
  const submittedDraft = useRef<typeof draft>(undefined);
  const key = `${raw}:${format}`;
  const text =
    draft?.key === key
      ? draft.text
      : color
        ? serializeColor(color, format)
        : raw;
  const dirty = draft?.key === key;
  const draftInvalid = !!dirty && !parseColor(text);
  const invalid = !color || draftInvalid;
  const field = useFieldAnatomy({
    id: idProp,
    description,
    error: error ?? (invalid ? messages.invalid : undefined),
    'aria-describedby': describedBy,
    'aria-invalid': invalid ? true : invalidProp,
  });
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [inheritedDirection, setInheritedDirection] = useState<'ltr' | 'rtl'>(
    'ltr',
  );
  const effectiveDirection = dir ?? inheritedDirection;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const rootRefs = useMergeRefs([rootRef, ref]);
  const triggerRefs = useMergeRefs([triggerRef, slotProps?.trigger?.ref]);
  const [focused, setFocused] = useState<string>();
  const activeId = swatches.some(
    (item) => item.id === focused && parseColor(item.color),
  )
    ? focused
    : swatches.find((item) => parseColor(item.color))?.id;
  const selectedId = color ? swatches.find(item => parseColor(item.color)?.hex === color.hex)?.id : undefined;
  const options = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<
    { previous: ColorSwatch[]; next: ColorSwatch[]; id?: string } | undefined
  >(undefined);
  const [live, setLive] = useState('');
  const capability = useContext(EyeDropperCapability);
  const [nativeDropper, setNativeDropper] = useState<EyeDropperConstructor>();
  const Dropper = capability === undefined ? nativeDropper : capability;
  const [dropperError, setDropperError] = useState(false);
  const generation = useRef(0);
  const pointer = useRef<number | undefined>(undefined);
  const contrast =
    color && background ? contrastColor(color.hex, background) : undefined;
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  });
  const degrees = new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'degree',
    maximumFractionDigits: 1,
  });
  const ratio = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  function announceColor(next: PickerColor) {
    if (value !== undefined && next.hex !== parsed?.hex) return;
    const result = background ? contrastColor(next.hex, background) : undefined;
    setLive(
      messages.result(
        next.hex,
        result
          ? messages.contrast(
              ratio.format(result.ratio),
              messages.grades[result.grade],
            )
          : undefined,
      ),
    );
  }
  function commit(next: PickerColor, announce = true) {
    if (disabled || readOnly) return;
    setPrecision(next);
    if (value === undefined || next.hex === parsed?.hex)
      lastHue.current = next.h;
    if (next.hex !== parsed?.hex) requestValue(next.hex);
    if (announce) announceColor(next);
  }
  function submitDraft() {
    if (!dirty || readOnly) return true;
    if (submittedDraft.current === draft) return true;
    const next = parseColor(text);
    if (!next) return false;
    submittedDraft.current = draft;
    commit(next);
    if (value === undefined || next.hex === parsed?.hex) setDraft(undefined);
    return true;
  }
  function updateChannel(
    channel: 'h' | 's' | 'v' | 'a',
    amount: number,
    announce = true,
  ) {
    if (!color || !Number.isFinite(amount)) return;
    commit(fromChannels({ ...color, [channel]: amount }), announce);
  }
  function rangeKey(
    event: KeyboardEvent<HTMLInputElement>,
    channel: 'h' | 's' | 'v' | 'a',
    max: number,
  ) {
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const inline = rtl ? -1 : 1;
    const deltas: Record<string, number> = {
      ArrowRight: inline,
      ArrowLeft: -inline,
      ArrowUp: 1,
      ArrowDown: -1,
      PageUp: 10,
      PageDown: -10,
    };
    const delta = deltas[event.key];
    if (delta === undefined && event.key !== 'Home' && event.key !== 'End')
      return;
    event.preventDefault();
    const current = Number(event.currentTarget.value);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? max
          : clamp(
              current +
                delta! *
                  (event.shiftKey && !event.key.startsWith('Page') ? 10 : 1),
              max,
            );
    updateChannel(channel, channel === 'h' ? next : next / 100);
  }
  function padUpdate(event: PointerEvent<HTMLDivElement>) {
    if (disabled || readOnly || !color) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const next = fromChannels({
      ...color,
      s: clamp((event.clientX - rect.left) / rect.width),
      v: 1 - clamp((event.clientY - rect.top) / rect.height),
    });
    commit(next, false);
    return next;
  }
  function requestSwatches(next: ColorSwatch[], nextFocus?: string) {
    if (disabled || readOnly || equalSwatches(swatches, next)) return;
    pendingFocus.current = { previous: swatches, next, id: nextFocus };
    setSwatches(next);
  }
  function moveSwatch(itemId: string, delta: number) {
    const index = swatches.findIndex((item) => item.id === itemId);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= swatches.length) return;
    const next = [...swatches];
    [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
    requestSwatches(next, itemId);
  }
  function removeSwatch(itemId: string) {
    const index = swatches.findIndex((item) => item.id === itemId);
    const next = swatches.filter((item) => item.id !== itemId);
    const survivor =
      next.slice(index).find((item) => parseColor(item.color)) ??
      next
        .slice(0, index)
        .reverse()
        .find((item) => parseColor(item.color));
    requestSwatches(next, survivor?.id);
  }
  function swatchKey(event: KeyboardEvent<HTMLButtonElement>, itemId: string) {
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const delta =
      (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0) *
      (rtl ? -1 : 1);
    if (event.altKey && delta) {
      event.preventDefault();
      moveSwatch(itemId, delta);
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      removeSwatch(itemId);
      return;
    }
    if (!delta && !['Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const enabled = swatches.filter((item) => parseColor(item.color));
    const index = enabled.findIndex((item) => item.id === itemId);
    const next =
      event.key === 'Home'
        ? enabled[0]
        : event.key === 'End'
          ? enabled.at(-1)
          : enabled[(index + delta + enabled.length) % enabled.length];
    if (next) {
      setFocused(next.id);
      options.current.get(next.id)?.focus();
    }
  }

  useEffect(() => {
    const constructor = (
      rootRef.current?.ownerDocument.defaultView as DropperWindow | null
    )?.EyeDropper;
    setNativeDropper(() => constructor);
  }, []);
  useEffect(() => {
    if (rootRef.current)
      setInheritedDirection(
        getComputedStyle(rootRef.current).direction === 'rtl' ? 'rtl' : 'ltr',
      );
  }, [dir, open]);
  useEffect(() => {
    generation.current++;
    return () => {
      generation.current++;
    };
  }, [open, disabled, readOnly]);
  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending || equalSwatches(swatches, pending.previous)) return;
    pendingFocus.current = undefined;
    if (!equalSwatches(swatches, pending.next)) return;
    setFocused(pending.id);
    if (pending.id) options.current.get(pending.id)?.focus();
    else saveRef.current?.focus();
  }, [swatches]);
  useEffect(() => {
    const form = triggerRef.current?.closest('form');
    if (!form) return;
    const reset = () => {
      setDraft(undefined);
      setPrecision(undefined);
      if (value !== undefined) {
        const seed =
          defaultValue === undefined ? undefined : parseColor(defaultValue);
        if (seed && seed.hex !== parsed?.hex) requestValue(seed.hex);
      } else resetValue();
      if (formatProp !== undefined) requestFormat(defaultFormat);
      else resetFormat();
      if (swatchesProp !== undefined) {
        if (!equalSwatches(swatches, defaultSwatches))
          setSwatches(defaultSwatches);
      } else resetSwatches();
    };
    form.addEventListener('reset', reset);
    return () => form.removeEventListener('reset', reset);
  });

  async function pickFromScreen() {
    const Constructor = Dropper;
    if (!Constructor || readOnly || disabled || !color) return;
    const ticket = ++generation.current;
    setDropperError(false);
    try {
      const result = await new Constructor().open();
      if (ticket !== generation.current) return;
      const next = parseColor(result.sRGBHex);
      if (next) commit(fromChannels({ ...next, a: color.a }));
    } catch (error) {
      if (
        ticket === generation.current &&
        !(error instanceof DOMException && error.name === 'AbortError')
      )
        setDropperError(true);
    }
  }
  const action = (
    name: keyof NonNullable<ColorPickerProps['icons']>,
    onClick: () => void,
    unavailable = false,
  ) => (
    <Button
      type="button"
      disabled={disabled || readOnly || unavailable}
      onClick={onClick}
    >
      {isRenderable(icons?.[name]) && <span aria-hidden>{icons?.[name]}</span>}
      {messages[name]}
    </Button>
  );
  const channels = color
    ? [
        {
          channel: 's' as const,
          label: messages.saturation,
          value: color.s * 100,
          max: 100,
          text: percent.format(color.s),
        },
        {
          channel: 'v' as const,
          label: messages.value,
          value: color.v * 100,
          max: 100,
          text: percent.format(color.v),
        },
        {
          channel: 'h' as const,
          label: messages.hue,
          value: color.h,
          max: 359,
          text: degrees.format(color.h),
        },
        ...(alpha
          ? [
              {
                channel: 'a' as const,
                label: messages.opacity,
                value: color.a * 100,
                max: 100,
                text: percent.format(color.a),
              },
            ]
          : []),
      ]
    : [];
  const Trigger = (slots?.trigger ?? 'button') as ComponentType<
    ComponentPropsWithRef<'button'>
  >;
  const Content = (slots?.content ?? 'div') as ComponentType<
    ComponentPropsWithRef<'div'>
  >;
  const panel = (
    <>
      <div css={panelGridStyle}>
        <div css={panelColumnStyle}>
      <FieldSlot
        element="div"
        component={slots?.pad}
        data-ui="color-picker-pad"
        data-invalid={!color || undefined}
        slotProps={slotProps?.pad}
        aria-hidden
        styles={padStyle}
        style={
          {
            '--picker-hue': `hsl(${color?.h ?? 0} 100% 50%)`,
            '--picker-x': `${(color?.s ?? 0) * 100}%`,
            '--picker-y': `${(1 - (color?.v ?? 0)) * 100}%`,
          } as CSSProperties
        }
        onPointerDown={(event) => {
          if (event.button !== 0 || disabled || readOnly || !color) return;
          pointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          padUpdate(event);
        }}
        onPointerMove={(event) => {
          if (pointer.current === event.pointerId) padUpdate(event);
        }}
        onPointerUp={(event) => {
          if (pointer.current !== event.pointerId) return;
          const next = padUpdate(event);
          pointer.current = undefined;
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
          if (next) announceColor(next);
        }}
        onPointerCancel={() => {
          pointer.current = undefined;
        }}
        onLostPointerCapture={() => {
          pointer.current = undefined;
        }}
      >
        {color && <span css={thumbStyle} />}
      </FieldSlot>
      {channels.map((channel) => (
        <label key={channel.channel} css={channelStyle}>
          {channel.label}
          <FieldSlot
            element="input"
            component={slots?.range}
            slotProps={slotProps?.range}
            type="range"
            min={0}
            max={channel.max}
            step={1}
            value={channel.value}
            aria-label={channel.label}
            aria-valuetext={channel.text}
            disabled={readOnly || disabled}
            styles={rangeStyle}
            onChange={(event) =>
              updateChannel(
                channel.channel,
                Number(event.currentTarget.value) /
                  (channel.channel === 'h' ? 1 : 100),
                false,
              )
            }
            onPointerUp={() => announceColor(color!)}
            onKeyDown={(event) => rangeKey(event, channel.channel, channel.max)}
          />
        </label>
      ))}
        </div>
        <div css={panelColumnStyle}>
      <Select
        label={messages.format}
        value={format}
        onValueChange={(next) => {
          if (formats.includes(next as ColorFormat) && submitDraft())
            requestFormat(next as ColorFormat);
        }}
        disabled={readOnly}
        options={formats.map((value) => ({
          value,
          label: value.toUpperCase(),
        }))}
      />
      <TextField
        label={messages.color}
        dir="ltr"
        value={text}
        ref={inputRef}
        readOnly={readOnly}
        required={required}
        aria-invalid={field.ariaInvalid}
        aria-describedby={field.describedBy}
        slots={{ control: slots?.field }}
        slotProps={{ control: slotProps?.field }}
        onValueChange={(next) => setDraft({ key, text: next })}
        onBlur={() => {
          submitDraft();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            submitDraft();
          }
          if (event.key === 'Escape' && dirty) {
            event.preventDefault();
            event.stopPropagation();
            setDraft(undefined);
          }
        }}
      />
      {color?.mapped && <span css={noteStyle}>{messages.gamutWarning}</span>}
      {contrast && (
        <FieldSlot
          element="div"
          component={slots?.contrast}
          slotProps={slotProps?.contrast}
          styles={noteStyle}
        >
          <output>
            {messages.contrast(
              ratio.format(contrast.ratio),
              messages.grades[contrast.grade],
            )}
          </output>
        </FieldSlot>
      )}
      <Button
        ref={saveRef}
        type="button"
        disabled={readOnly || !color}
        onClick={() => {
          if (!color) return;
          const savedId = globalThis.crypto.randomUUID();
          requestSwatches(
            [...swatches, { id: savedId, color: color.hex }].slice(
              -maxSwatches,
            ),
          );
        }}
      >
        {isRenderable(icons?.save) && <span aria-hidden>{icons?.save}</span>}
        {messages.save}
      </Button>
        </div>
      </div>
      <FieldSlot
        element="div"
        component={slots?.swatches}
        slotProps={slotProps?.swatches}
        role="listbox"
        aria-label={messages.savedColors}
        aria-orientation="horizontal"
        aria-readonly={readOnly || undefined}
        styles={paletteStyle}
      >
        {swatches.map((item) => {
          const saved = parseColor(item.color);
          return (
            <button
              key={item.id}
              ref={(node) => {
                if (node) options.current.set(item.id, node);
                else options.current.delete(item.id);
              }}
              type="button"
              role="option"
                aria-selected={item.id === selectedId}
              aria-disabled={!saved || readOnly || undefined}
              disabled={!saved}
              tabIndex={item.id === activeId ? 0 : -1}
              css={optionStyle}
              onFocus={() => setFocused(item.id)}
              onClick={() => {
                if (saved) commit(saved);
              }}
              onKeyDown={(event) => swatchKey(event, item.id)}
            >
              <span
                css={swatchStyle}
                style={colorStyle(saved?.hex)}
                aria-hidden
              />
              {messages.swatch(saved?.hex ?? item.color, item.label)}
                {item.id === selectedId && <span aria-hidden> ✓</span>}
            </button>
          );
        })}
      </FieldSlot>
      <div css={rowStyle}>
        {action(
          'movePrevious',
          () => {
            if (activeId) moveSwatch(activeId, -1);
          },
          !activeId || activeId === swatches[0]?.id,
        )}
        {action(
          'moveNext',
          () => {
            if (activeId) moveSwatch(activeId, 1);
          },
          !activeId || activeId === swatches.at(-1)?.id,
        )}
        {action(
          'remove',
          () => {
            if (activeId) removeSwatch(activeId);
          },
          !activeId,
        )}
        {eyeDropper &&
          Dropper &&
          action(
            'eyeDropper',
            () => {
              void pickFromScreen();
            },
            !color,
          )}
      </div>
      {dropperError && <span role="alert">{messages.eyeDropperError}</span>}
      <Button
        type="button"
        onClick={() => {
          if (submitDraft()) requestOpen(false);
          else inputRef.current?.focus();
        }}
      >
        {isRenderable(icons?.done) && <span aria-hidden>{icons?.done}</span>}
        {messages.done}
      </Button>
      <span role="status" aria-live="polite" css={noteStyle}>
        {live}
      </span>
    </>
  );
  return (
    <Dialog
      open={open && !disabled}
      onOpenChange={(next) => {
        if (!disabled) requestOpen(next);
      }}
    >
    <FieldRoot
      {...rest}
      ref={rootRefs}
      component={slots?.root ?? component}
      part={slotProps?.root}
      data-ui="color-picker"
      dir={dir}
      className={className}
      sx={sx}
    >
      <FieldLabel id={`${id}-label`} htmlFor={field.id} required={required}>
        {label}
      </FieldLabel>
        <Trigger
          {...withoutSx(slotProps?.trigger)}
          ref={triggerRefs}
          id={field.id}
          type="button"
          disabled={disabled}
          dir={dir}
          aria-haspopup="dialog"
          aria-expanded={open && !disabled}
          aria-labelledby={[
            `${id}-label`,
            `${id}-value`,
            labelledBy,
            slotProps?.trigger?.['aria-labelledby'],
          ]
            .filter(Boolean)
            .join(' ')}
          aria-describedby={
            [field.describedBy, slotProps?.trigger?.['aria-describedby']]
              .filter(Boolean)
              .join(' ') || undefined
          }
          aria-invalid={field.ariaInvalid ?? slotProps?.trigger?.['aria-invalid']}
          css={[inputControlStyle, triggerStyle, triggerStyles[size], slotProps?.trigger?.sx]}
          onClick={(event) => {
            slotProps?.trigger?.onClick?.(event);
            if (!event.defaultPrevented && !disabled) requestOpen(true);
          }}
        >
          <span css={checkerStyle} aria-hidden>
            <span css={swatchStyle} style={colorStyle(color?.hex)} />
          </span>
          <span id={`${id}-value`} css={triggerValueStyle} dir="ltr">{color?.hex ?? messages.empty}</span>
        </Trigger>
      <FieldDescription
        id={field.descriptionId}
        component={slots?.description}
        part={slotProps?.description}
      >
        {description}
      </FieldDescription>
      <FieldError
        id={field.errorId}
        component={slots?.error}
        part={slotProps?.error}
      >
        {error ?? (invalid ? messages.invalid : undefined)}
      </FieldError>
      {name && (
        <input
          type="hidden"
          name={name}
          value={color?.hex ?? ''}
          disabled={disabled}
        />
      )}
      </FieldRoot>
      <Dialog.Content dir={effectiveDirection}>
        <Dialog.Panel>
          <Dialog.Title>{messages.dialog}</Dialog.Title>
          <Content {...withoutSx(slotProps?.content)} css={[panelStyle, slotProps?.content?.sx]}>
            {panel}
          </Content>
        </Dialog.Panel>
      </Dialog.Content>
    </Dialog>
  );
}
ColorPicker.displayName = 'ColorPicker';
