'use client';

import {
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
  type Ref,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { REDUCED_MOTION, FORCED_COLORS } from '../../styling/media';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button } from '../button';
import { RadioGroup } from '../radio-group';

export type InkColor = 'black' | 'blue' | 'violet';
export type InkWidth = 'fine' | 'medium' | 'bold';
export interface SignaturePoint {
  x: number;
  y: number;
  pressure: number | null;
  time: number;
}
export interface SignatureStroke {
  id: string;
  points: SignaturePoint[];
  color: InkColor;
  width: InkWidth;
  startTime: number;
}
export interface SignatureExportOptions {
  crop?: boolean;
  scale?: number;
}
export type SignatureAction = 'undo' | 'redo' | 'clear' | 'replay' | 'stop' | 'png' | 'svg';
export interface SignaturePadMessages {
  ink: string;
  nib: string;
  colors: Record<InkColor, string>;
  widths: Record<InkWidth, string>;
  actions: Record<SignatureAction, string>;
  empty: string;
  signed: string;
  roleDescription: string;
  fallback: string;
  shortcuts: string;
  required: string;
  added: string;
  undone: string;
  redone: string;
  cleared: string;
  reset: string;
  replayComplete: string;
  exported: string;
  exportFailed: string;
}
export interface SignaturePadPartProps {
  className?: string;
  sx?: Interpolation<Theme>;
}
export interface SignaturePadSlotProps {
  /** Outer container wrapping the pad and toolbar. */
  root?: ComponentPropsWithRef<'div'> & SignaturePadPartProps;
  /** Label naming the signature pad. */
  label?: ComponentPropsWithRef<'span'> & SignaturePadPartProps;
  /** Canvas capturing signature strokes. */
  canvas?: ComponentPropsWithRef<'canvas'> & SignaturePadPartProps;
  /** Baseline guide behind the canvas. */
  guide?: ComponentPropsWithRef<'div'> & SignaturePadPartProps;
  /** Toolbar holding signature tools. */
  toolbar?: ComponentPropsWithRef<'div'> & SignaturePadPartProps;
  /** Button invoking a signature action. */
  action?: ComponentPropsWithRef<typeof Button> & SignaturePadPartProps;
  /** Supporting text below the canvas. */
  description?: ComponentPropsWithRef<'div'> & SignaturePadPartProps;
  /** Validation error message. */
  error?: ComponentPropsWithRef<'div'> & SignaturePadPartProps;
  /** Live region announcing signature updates. */
  status?: ComponentPropsWithRef<'div'> & SignaturePadPartProps;
}
export interface SignaturePadSlots {
  /** Outer container wrapping the pad and toolbar. */
  root?: ComponentType<NonNullable<SignaturePadSlotProps['root']>>;
  /** Label naming the signature pad. */
  label?: ComponentType<NonNullable<SignaturePadSlotProps['label']>>;
  /** Canvas capturing signature strokes. */
  canvas?: ComponentType<NonNullable<SignaturePadSlotProps['canvas']>>;
  /** Baseline guide behind the canvas. */
  guide?: ComponentType<NonNullable<SignaturePadSlotProps['guide']>>;
  /** Toolbar holding signature tools. */
  toolbar?: ComponentType<NonNullable<SignaturePadSlotProps['toolbar']>>;
  /** Button invoking a signature action. */
  action?: ComponentType<NonNullable<SignaturePadSlotProps['action']>>;
  /** Supporting text below the canvas. */
  description?: ComponentType<NonNullable<SignaturePadSlotProps['description']>>;
  /** Validation error message. */
  error?: ComponentType<NonNullable<SignaturePadSlotProps['error']>>;
  /** Live region announcing signature updates. */
  status?: ComponentType<NonNullable<SignaturePadSlotProps['status']>>;
}
export interface SignaturePadHandle {
  focus(): void;
  clear(): void;
  undo(): void;
  redo(): void;
  replay(): void;
  stopReplay(): void;
  toDataURL(options?: SignatureExportOptions): string;
  toBlob(options?: SignatureExportOptions): Promise<Blob>;
  toSvg(options?: SignatureExportOptions): string;
}
export interface SignaturePadProps
  extends
    Omit<
      ComponentPropsWithRef<'canvas'>,
      'onChange' | 'defaultValue' | 'width' | 'height' | 'color' | 'children'
    >,
    SxProps {
  value?: SignatureStroke[];
  defaultValue?: SignatureStroke[];
  onValueChange?: (value: SignatureStroke[]) => void;
  color?: InkColor;
  defaultColor?: InkColor;
  onColorChange?: (color: InkColor) => void;
  width?: InkWidth;
  defaultWidth?: InkWidth;
  onWidthChange?: (width: InkWidth) => void;
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  signer?: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  replay?: boolean;
  download?: boolean;
  fileName?: string;
  historyLimit?: number;
  messages: SignaturePadMessages;
  icons?: Partial<Record<SignatureAction, ReactNode>>;
  exportOptions?: SignatureExportOptions;
  apiRef?: Ref<SignaturePadHandle>;
  slotProps?: SignaturePadSlotProps;
  slots?: SignaturePadSlots;
}

const PAD_WIDTH = 600;
const PAD_HEIGHT = 260;
const MAX_EXPORT_DIMENSION = 4096;
const MAX_POINTS = 100000;
const MAX_STROKES = 1000;
const EXPORT_PADDING = 2;
const DEFAULT_EXPORT_SCALE = 3;
const DEFAULT_HISTORY_LIMIT = 60;
const MAX_REPLAY_DURATION = 8000;
const MAX_REPLAY_GAP = 500;
const EMPTY: SignatureStroke[] = [];
const hasContent = (node: ReactNode) => isRenderable(node) && node !== '';
const NIB: Record<InkWidth, number> = { fine: 2, medium: 4, bold: 7 };
const PRINT_INK: Record<InkColor, string> = {
  black: base.color.signatureInkBlack,
  blue: base.color.signatureInkBlue,
  violet: base.color.signatureInkViolet,
};
const PREVIEW_INK: Record<InkColor, string> = {
  black: '--ui-color-text',
  blue: '--ui-color-info',
  violet: '--ui-color-accent',
};

export class SignatureExportError extends Error {
  constructor(
    public readonly code: 'empty' | 'invalid' | 'size' | 'encoder',
    message: string,
  ) {
    super(message);
    this.name = 'SignatureExportError';
  }
}

// Bundlers replace `process.env.NODE_ENV` in consumer builds; library mode leaves it in place.
declare const process: { env: { NODE_ENV?: string } };

// Ids only need to be unique within one value; the random part keeps new strokes apart from persisted ones.
// `getRandomValues` works on insecure origins, unlike `randomUUID`.
let strokeSequence = 0;
function strokeId() {
  const random = new Uint32Array(2);
  globalThis.crypto?.getRandomValues?.(random);
  return [++strokeSequence, ...random].map((part) => part.toString(36)).join('-');
}

function isValid(strokes: SignatureStroke[]) {
  let count = 0;
  if (!Array.isArray(strokes) || strokes.length > MAX_STROKES) return false;
  for (const stroke of strokes) {
    if (
      !stroke ||
      typeof stroke.id !== 'string' ||
      !Object.hasOwn(NIB, stroke.width) ||
      !Object.hasOwn(PRINT_INK, stroke.color) ||
      !Number.isFinite(stroke.startTime) ||
      stroke.startTime < 0 ||
      !Array.isArray(stroke.points) ||
      !stroke.points.length
    )
      return false;
    let last = 0;
    for (const p of stroke.points) {
      if (
        ++count > MAX_POINTS ||
        !p ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        p.x < 0 ||
        p.x > PAD_WIDTH ||
        p.y < 0 ||
        p.y > PAD_HEIGHT ||
        !Number.isFinite(p.time) ||
        p.time < last ||
        (p.pressure !== null && (!Number.isFinite(p.pressure) || p.pressure < 0 || p.pressure > 1))
      )
        return false;
      last = p.time;
    }
  }
  return true;
}
function validate(strokes: SignatureStroke[]) {
  if (!isValid(strokes)) throw new SignatureExportError('invalid', 'Invalid signature strokes.');
}
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
/** Preview-safe copy of an untrusted value: unknown ink/nib and non-finite samples are skipped, the rest clamped. */
function drawable(strokes: SignatureStroke[]): SignatureStroke[] {
  if (isValid(strokes)) return strokes;
  const result: SignatureStroke[] = [];
  let count = 0;
  for (const stroke of Array.isArray(strokes) ? strokes.slice(0, MAX_STROKES) : []) {
    if (count >= MAX_POINTS) break;
    if (
      !stroke ||
      !Object.hasOwn(NIB, stroke.width) ||
      !Object.hasOwn(PRINT_INK, stroke.color) ||
      !Array.isArray(stroke.points)
    )
      continue;
    let last = 0;
    const points: SignaturePoint[] = [];
    for (const p of stroke.points) {
      if (count >= MAX_POINTS) break;
      count++;
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      if (Number.isFinite(p.time)) last = Math.max(last, p.time);
      points.push({
        x: clamp(p.x, 0, PAD_WIDTH),
        y: clamp(p.y, 0, PAD_HEIGHT),
        pressure: Number.isFinite(p.pressure) ? clamp(p.pressure!, 0, 1) : null,
        time: last,
      });
    }
    if (points.length)
      result.push({
        ...stroke,
        startTime: Number.isFinite(stroke.startTime) ? Math.max(0, stroke.startTime) : 0,
        points,
      });
  }
  return result;
}
const pointCount = (strokes: SignatureStroke[]) => strokes.reduce((sum, s) => sum + s.points.length, 0);

type Segment = {
  from: SignaturePoint;
  control: SignaturePoint;
  to: SignaturePoint;
  width: number;
};
const midpoint = (a: SignaturePoint, b: SignaturePoint): SignaturePoint => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  time: (a.time + b.time) / 2,
  pressure: a.pressure === null || b.pressure === null ? null : (a.pressure + b.pressure) / 2,
});
const pointWidth = (p: SignaturePoint, nib: InkWidth) =>
  NIB[nib] * (p.pressure === null ? 1 : 0.25 + p.pressure * 0.75);
function segments(stroke: SignatureStroke): Segment[] {
  const result: Segment[] = [];
  for (let i = 1; i < stroke.points.length; i++) {
    const a = stroke.points[i - 1]!;
    const b = stroke.points[i]!;
    const from = i === 1 ? a : midpoint(stroke.points[i - 2]!, a);
    const to = i === stroke.points.length - 1 ? b : midpoint(a, b);
    result.push({
      from,
      control: a,
      to,
      width: (pointWidth(a, stroke.width) + pointWidth(b, stroke.width)) / 2,
    });
  }
  return result;
}
function paint(context: CanvasRenderingContext2D, strokes: SignatureStroke[], ink: Record<InkColor, string>) {
  for (const stroke of strokes) {
    context.strokeStyle = context.fillStyle = ink[stroke.color];
    context.lineCap = context.lineJoin = 'round';
    if (stroke.points.length === 1) {
      const p = stroke.points[0]!;
      context.beginPath();
      context.arc(p.x, p.y, pointWidth(p, stroke.width) / 2, 0, Math.PI * 2);
      context.fill();
    }
    for (const s of segments(stroke)) {
      context.lineWidth = s.width;
      context.beginPath();
      context.moveTo(s.from.x, s.from.y);
      context.quadraticCurveTo(s.control.x, s.control.y, s.to.x, s.to.y);
      context.stroke();
    }
  }
}
function exportBounds(strokes: SignatureStroke[], options: SignatureExportOptions) {
  validate(strokes);
  if (!strokes.length) throw new SignatureExportError('empty', 'Cannot export an empty signature.');
  let left = 0,
    top = 0,
    right = PAD_WIDTH,
    bottom = PAD_HEIGHT;
  if (options.crop !== false) {
    left = Infinity;
    top = Infinity;
    right = -Infinity;
    bottom = -Infinity;
    for (const s of strokes)
      for (const p of s.points) {
        const padding = NIB[s.width] / 2 + EXPORT_PADDING;
        left = Math.min(left, p.x - padding);
        top = Math.min(top, p.y - padding);
        right = Math.max(right, p.x + padding);
        bottom = Math.max(bottom, p.y + padding);
      }
  }
  const scale = options.scale ?? DEFAULT_EXPORT_SCALE;
  const width = right - left,
    height = bottom - top;
  if (
    !Number.isFinite(scale) ||
    scale <= 0 ||
    Math.ceil(width * scale) > MAX_EXPORT_DIMENSION ||
    Math.ceil(height * scale) > MAX_EXPORT_DIMENSION
  )
    throw new SignatureExportError('size', 'Signature export exceeds the dimension budget.');
  return { left, top, width, height, scale };
}
function exportCanvas(strokes: SignatureStroke[], options: SignatureExportOptions = {}) {
  const bounds = exportBounds(strokes, options);
  if (typeof document === 'undefined')
    throw new SignatureExportError('encoder', 'Canvas rendering is unavailable.');
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(bounds.width * bounds.scale);
  canvas.height = Math.ceil(bounds.height * bounds.scale);
  const context = canvas.getContext('2d');
  if (!context) throw new SignatureExportError('encoder', 'Canvas rendering is unavailable.');
  context.scale(bounds.scale, bounds.scale);
  context.translate(-bounds.left, -bounds.top);
  paint(context, strokes, PRINT_INK);
  return canvas;
}

/** Transparent PNG from normalized samples; guides and preview theme are excluded. */
export function signatureToPng(
  strokes: SignatureStroke[],
  options: SignatureExportOptions = {},
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      exportCanvas(strokes, options).toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new SignatureExportError('encoder', 'PNG encoding failed.')),
        'image/png',
      );
    } catch (error) {
      reject(error);
    }
  });
}
/** The same midpoint-quadratic segments and round caps used by Canvas, with fixed print ink. */
export function signatureToSvg(strokes: SignatureStroke[], options: SignatureExportOptions = {}): string {
  const b = exportBounds(strokes, options);
  const paths = strokes
    .map((stroke) => {
      const ink = PRINT_INK[stroke.color];
      if (stroke.points.length === 1) {
        const p = stroke.points[0]!;
        return `<circle cx="${p.x}" cy="${p.y}" r="${pointWidth(p, stroke.width) / 2}" fill="${ink}"/>`;
      }
      return segments(stroke)
        .map(
          (s) =>
            `<path d="M ${s.from.x} ${s.from.y} Q ${s.control.x} ${s.control.y} ${s.to.x} ${s.to.y}" fill="none" stroke="${ink}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"/>`,
        )
        .join('');
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.left} ${b.top} ${b.width} ${b.height}" width="${Math.ceil(b.width * b.scale)}" height="${Math.ceil(b.height * b.scale)}">${paths}</svg>`;
}

const rootStyle = css({
  display: 'grid',
  gap: vars.space[3],
  minInlineSize: 0,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
});
const surfaceStyle = css({ position: 'relative', minInlineSize: 0 });
const canvasStyle = css({
  display: 'block',
  boxSizing: 'border-box',
  inlineSize: '100%',
  aspectRatio: `${PAD_WIDTH} / ${PAD_HEIGHT}`,
  backgroundColor: vars.color.surface,
  color: vars.color.text,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.lg,
  touchAction: 'none',
  '&:focus-visible': focusRingOutset,
  '&[aria-disabled="true"], &[data-readonly]': { touchAction: 'auto' },
  [FORCED_COLORS]: { borderColor: 'CanvasText', color: 'CanvasText' },
});
const guideStyle = css({
  position: 'absolute',
  insetInline: vars.space[4],
  insetBlockEnd: vars.space[8],
  borderBlockEnd: `1px solid ${vars.color.borderStrong}`,
  pointerEvents: 'none',
  color: vars.color.textMuted,
  display: 'flex',
  alignItems: 'end',
  justifyContent: 'space-between',
  gap: vars.space[2],
  overflowWrap: 'anywhere',
  fontSize: vars.textSize.xs,
  transitionProperty: 'opacity',
  transitionDuration: vars.motion.duration.base,
  [REDUCED_MOTION]: { transitionDuration: '0s' },
});
const guideTextStyle = css({ minInlineSize: 0 });
const signerStyle = css({ minInlineSize: 0, marginInlineStart: 'auto', textAlign: 'end' });
const toolbarStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
});
const labelStyle = css({ fontWeight: vars.fontWeight.medium });
const descriptionStyle = css({ color: vars.color.textMuted });
const errorStyle = css({ color: vars.color.dangerText });
const equal = (a: SignatureStroke[], b: SignatureStroke[]) =>
  a === b || JSON.stringify(a) === JSON.stringify(b);
type History = {
  present: SignatureStroke[];
  past: SignatureStroke[][];
  future: SignatureStroke[][];
};
type Pending = { value: SignatureStroke[]; history: History; status: string };
type ActiveStroke = {
  pointerId: number;
  started: number;
  stroke: SignatureStroke;
};

/** Draw a signature with a pointer. Forms must offer typed-name or upload alternatives.
 * Canvas shortcuts: Mod+Z undo, Shift+Mod+Z/Mod+Y redo, Delete clear, Escape cancel/stop.
 * Samples use 600×260 coordinates; pressure changes round line widths, not speed-based taper.
 * The drawing does not establish identity, consent or legal validity. */
export function SignaturePad({
  ref,
  apiRef,
  value: valueProp,
  defaultValue = EMPTY,
  onValueChange,
  color: colorProp,
  defaultColor = 'black',
  onColorChange,
  width: widthProp,
  defaultWidth = 'medium',
  onWidthChange,
  label,
  description,
  error,
  signer,
  hint,
  disabled = false,
  readOnly = false,
  required = false,
  replay: showReplay = true,
  download = false,
  fileName = 'signature',
  historyLimit = DEFAULT_HISTORY_LIMIT,
  messages,
  icons,
  exportOptions,
  slotProps,
  slots,
  className,
  sx,
  dir,
  style,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onKeyDown,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  ...rest
}: SignaturePadProps) {
  const Root = slots?.root ?? 'div';
  const Label = slots?.label ?? 'span';
  const Canvas = slots?.canvas ?? 'canvas';
  const Guide = slots?.guide ?? 'div';
  const Toolbar = slots?.toolbar ?? 'div';
  const Action = slots?.action ?? Button;
  const Description = slots?.description ?? 'div';
  const Error = slots?.error ?? 'div';
  const Status = slots?.status ?? 'div';
  const id = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mergedRef = useMergeRefs([canvasRef, ref, slotProps?.canvas?.ref]);
  const seed = useRef(defaultValue);
  const [current = EMPTY, requestValue] = useControlledState(valueProp, seed.current, onValueChange);
  const [color = 'black', requestColor] = useControlledState(colorProp, defaultColor, onColorChange);
  const [width = 'medium', requestWidth] = useControlledState(widthProp, defaultWidth, onWidthChange);
  const history = useRef<History>({ present: current, past: [], future: [] });
  const pending = useRef<Pending | null>(null);
  const active = useRef<ActiveStroke | null>(null);
  const animation = useRef<number | null>(null);
  const sessionStart = useRef<number | null>(null);
  const [announcement, setAnnouncement] = useState({ text: '', revision: 0 });
  function setStatus(text: string) {
    setAnnouncement((previous) => ({ text, revision: previous.revision + 1 }));
  }
  const [playing, setPlaying] = useState(false);
  const [, refresh] = useState(0);
  const locked = disabled || readOnly;
  const limit =
    Number.isFinite(historyLimit) && historyLimit > 0 ? Math.floor(historyLimit) : DEFAULT_HISTORY_LIMIT;

  function draw(
    strokes = active.current ? [...history.current.present, active.current.stroke] : history.current.present,
  ) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0 || canvas.clientWidth <= 0 || canvas.clientHeight <= 0)
      return;
    const view = canvas.ownerDocument.defaultView!;
    const dpr = view.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const pixelHeight = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(canvas.width / PAD_WIDTH, 0, 0, canvas.height / PAD_HEIGHT, 0, 0);
    const computed = view.getComputedStyle(canvas);
    const forced = view.matchMedia('(forced-colors: active)').matches;
    const ink = Object.fromEntries(
      Object.entries(PREVIEW_INK).map(([key, token]) => [
        key,
        forced ? computed.color : computed.getPropertyValue(token).trim(),
      ]),
    ) as Record<InkColor, string>;
    paint(context, drawable(strokes), ink);
  }
  function stopReplay() {
    if (animation.current !== null)
      canvasRef.current?.ownerDocument.defaultView?.cancelAnimationFrame(animation.current);
    animation.current = null;
    setPlaying(false);
    draw();
  }
  function completeReplay() {
    stopReplay();
    setStatus(messages.replayComplete);
  }
  function cancelStroke() {
    const captured = active.current?.pointerId;
    active.current = null;
    const canvas = canvasRef.current;
    if (captured !== undefined && canvas?.hasPointerCapture(captured)) canvas.releasePointerCapture(captured);
    draw();
  }
  function request(next: SignatureStroke[], nextHistory: History, text: string) {
    if (equal(next, history.current.present)) return;
    stopReplay();
    cancelStroke();
    pending.current = { value: next, history: nextHistory, status: text };
    requestValue(next);
  }
  function undo() {
    const h = history.current;
    if (locked || !h.past.length) return;
    const next = h.past[h.past.length - 1]!;
    request(
      next,
      {
        present: next,
        past: h.past.slice(0, -1),
        future: [h.present, ...h.future].slice(0, limit),
      },
      messages.undone,
    );
  }
  function redo() {
    const h = history.current;
    if (locked || !h.future.length) return;
    const next = h.future[0]!;
    request(
      next,
      {
        present: next,
        past: [...h.past, h.present].slice(-limit),
        future: h.future.slice(1),
      },
      messages.redone,
    );
  }
  function replace(next: SignatureStroke[], text: string) {
    const h = history.current;
    request(next, { present: next, past: [...h.past, h.present].slice(-limit), future: [] }, text);
  }
  function clear() {
    if (!locked) replace(EMPTY, messages.cleared);
  }
  function replay() {
    stopReplay();
    cancelStroke();
    const strokes = drawable(history.current.present);
    const view = canvasRef.current?.ownerDocument.defaultView;
    if (disabled || !strokes.length || !view) return;
    if (view.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      completeReplay();
      return;
    }
    const schedule: {
      stroke: SignatureStroke;
      offset: number;
    }[] = [];
    let end = 0;
    strokes.forEach((stroke, i) => {
      const previous = strokes[i - 1];
      const gap = previous
        ? Math.min(
            MAX_REPLAY_GAP,
            Math.max(0, stroke.startTime - previous.startTime - previous.points.at(-1)!.time),
          )
        : 0;
      const duration = stroke.points.at(-1)!.time;
      schedule.push({ stroke, offset: end + gap });
      end += gap + duration;
    });
    const playbackScale = end > MAX_REPLAY_DURATION ? MAX_REPLAY_DURATION / end : 1;
    const start = view.performance.now();
    setPlaying(true);
    const frame = (now: number) => {
      const elapsed = (now - start) / playbackScale;
      draw(
        schedule.flatMap(({ stroke, offset }) => {
          if (elapsed < offset) return [];
          const points = stroke.points.filter((p) => p.time <= elapsed - offset);
          return points.length ? [{ ...stroke, points }] : [];
        }),
      );
      if (elapsed >= end) {
        completeReplay();
      } else animation.current = view.requestAnimationFrame(frame);
    };
    animation.current = view.requestAnimationFrame(frame);
  }

  const warnedValue = useRef<SignatureStroke[] | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (isValid(current)) warnedValue.current = null;
    else if (warnedValue.current === null || !equal(warnedValue.current, current)) {
      warnedValue.current = current;
      console.warn(
        'SignaturePad: value contains malformed strokes; invalid samples are skipped when drawing and exports reject with an "invalid" SignatureExportError.',
      );
    }
  }, [current]);
  useLayoutEffect(() => {
    if (!equal(current, history.current.present)) {
      cancelStroke();
      stopReplay();
      if (pending.current && equal(current, pending.current.value)) {
        history.current = pending.current.history;
        setStatus(pending.current.status);
      } else history.current = { present: current, past: [], future: [] };
      pending.current = null;
      refresh((v) => v + 1);
    }
    if (animation.current === null)
      draw(active.current ? [...history.current.present, active.current.stroke] : history.current.present);
  });
  useLayoutEffect(() => {
    if (locked) {
      cancelStroke();
      stopReplay();
    }
  }, [locked]);
  const lifecycle = useRef({
    draw,
    completeReplay,
    reset: () => {
      if (!locked) replace(seed.current, messages.reset);
    },
  });
  useLayoutEffect(() => {
    lifecycle.current = {
      draw,
      completeReplay,
      reset: () => {
        if (!locked) replace(seed.current, messages.reset);
      },
    };
  });
  useLayoutEffect(() => {
    const canvas = canvasRef.current!;
    const view = canvas.ownerDocument.defaultView!;
    const redraw = () => {
      if (animation.current === null) lifecycle.current.draw();
    };
    const resize = new ResizeObserver(redraw);
    resize.observe(canvas);
    const theme = new MutationObserver(redraw);
    for (let node: HTMLElement | null = canvas.parentElement; node; node = node.parentElement)
      theme.observe(node, {
        attributes: true,
        attributeFilter: ['data-theme', 'class', 'style'],
      });
    const forced = view.matchMedia('(forced-colors: active)');
    forced.addEventListener('change', redraw);
    const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
    const motionChanged = () => {
      if (reduced.matches && animation.current !== null) lifecycle.current.completeReplay();
    };
    reduced.addEventListener('change', motionChanged);
    let dpr = view.matchMedia(`(resolution: ${view.devicePixelRatio}dppx)`);
    const dprChanged = () => {
      redraw();
      dpr.removeEventListener('change', dprChanged);
      dpr = view.matchMedia(`(resolution: ${view.devicePixelRatio}dppx)`);
      dpr.addEventListener('change', dprChanged);
    };
    dpr.addEventListener('change', dprChanged);
    view.addEventListener('resize', redraw);
    const form = canvas.closest('form');
    const reset = (event: Event) => {
      queueMicrotask(() => {
        if (!event.defaultPrevented && canvas.isConnected) lifecycle.current.reset();
      });
    };
    form?.addEventListener('reset', reset);
    return () => {
      resize.disconnect();
      theme.disconnect();
      forced.removeEventListener('change', redraw);
      reduced.removeEventListener('change', motionChanged);
      dpr.removeEventListener('change', dprChanged);
      view.removeEventListener('resize', redraw);
      form?.removeEventListener('reset', reset);
      if (animation.current !== null) view.cancelAnimationFrame(animation.current);
      animation.current = null;
      active.current = null;
    };
  }, []);
  function announceExport<T>(result: T): T {
    if (canvasRef.current) setStatus(messages.exported);
    return result;
  }
  function radioBoundary(event: KeyboardEvent<HTMLDivElement>) {
    if (locked || (event.key !== 'Home' && event.key !== 'End')) return;
    const radios = event.currentTarget.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]:not(:disabled)',
    );
    const radio = event.key === 'Home' ? radios[0] : radios[radios.length - 1];
    if (!radio) return;
    event.preventDefault();
    radio.focus();
    radio.click();
  }
  useImperativeHandle(apiRef, () => ({
    focus: () => canvasRef.current?.focus(),
    clear,
    undo,
    redo,
    replay,
    stopReplay,
    toDataURL: (options) =>
      announceExport(exportCanvas(history.current.present, options ?? exportOptions).toDataURL('image/png')),
    toBlob: (options) =>
      signatureToPng(history.current.present, options ?? exportOptions).then(announceExport),
    toSvg: (options) => announceExport(signatureToSvg(history.current.present, options ?? exportOptions)),
  }));

  function sample(event: PointerEvent, gesture: ActiveStroke) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (w <= 0 || h <= 0 || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    const points = gesture.stroke.points;
    const time = Math.max(
      points.at(-1)?.time ?? 0,
      Number.isFinite(event.timeStamp) ? event.timeStamp - gesture.started : 0,
    );
    const p: SignaturePoint = {
      x: Math.max(0, Math.min(PAD_WIDTH, ((event.clientX - rect.left - canvas.clientLeft) / w) * PAD_WIDTH)),
      y: Math.max(0, Math.min(PAD_HEIGHT, ((event.clientY - rect.top - canvas.clientTop) / h) * PAD_HEIGHT)),
      pressure:
        event.pointerType === 'pen' && Number.isFinite(event.pressure)
          ? Math.max(0, Math.min(1, event.pressure))
          : null,
      time,
    };
    const previous = points.at(-1);
    const available = MAX_POINTS - pointCount(drawable(history.current.present));
    if ((!previous || previous.x !== p.x || previous.y !== p.y) && points.length < available) points.push(p);
  }
  function move(event: ReactPointerEvent<HTMLCanvasElement>) {
    const gesture = active.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const item of samples) sample(item, gesture);
    sample(event.nativeEvent, gesture);
    draw([...history.current.present, gesture.stroke]);
  }
  async function downloadFile(format: 'png' | 'svg') {
    try {
      const blob =
        format === 'png'
          ? await signatureToPng(history.current.present, exportOptions)
          : new Blob([signatureToSvg(history.current.present, exportOptions)], {
              type: 'image/svg+xml',
            });
      const doc = canvasRef.current?.ownerDocument;
      if (!doc) return;
      const url = URL.createObjectURL(blob);
      try {
        const link = doc.createElement('a');
        link.href = url;
        link.download = `${fileName.replace(/[\\/\u0000-\u001f:*?"<>|]/g, '_') || 'signature'}.${format}`;
        link.click();
        setStatus(messages.exported);
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      if (canvasRef.current) setStatus(messages.exportFailed);
    }
  }
  const h = history.current;
  const actions: {
    action: SignatureAction;
    disabled: boolean;
    run: () => void;
  }[] = [
    { action: 'undo', disabled: locked || !h.past.length, run: undo },
    { action: 'redo', disabled: locked || !h.future.length, run: redo },
    ...(showReplay
      ? [
          {
            action: playing ? ('stop' as const) : ('replay' as const),
            disabled: disabled || !current.length,
            run: playing ? stopReplay : replay,
          },
        ]
      : []),
    { action: 'clear', disabled: locked || !current.length, run: clear },
    ...(download
      ? [
          {
            action: 'png' as const,
            disabled: disabled || !current.length,
            run: () => {
              void downloadFile('png');
            },
          },
          {
            action: 'svg' as const,
            disabled: disabled || !current.length,
            run: () => {
              void downloadFile('svg');
            },
          },
        ]
      : []),
  ];
  return (
    <WithSx
      className={[className, slotProps?.root?.className].filter(Boolean).join(' ')}
      styles={[rootStyle, slotProps?.root?.sx]}
      sx={sx}
    >
      {(rootClass) => (
        <Root
          {...withoutSx(slotProps?.root)}
          data-ui="signature-pad"
          data-state={current.length ? 'signed' : 'empty'}
          className={rootClass}
          css={undefined}
          dir={dir}
          style={{ ...style, ...slotProps?.root?.style }}
        >
          {hasContent(label) && (
            <Label
              {...withoutSx(slotProps?.label)}
              id={`${id}-label`}
              className={slotProps?.label?.className}
              css={[labelStyle, slotProps?.label?.sx]}
            >
              {label}
            </Label>
          )}
          <span id={`${id}-state`} css={visuallyHiddenStyle}>
            {current.length ? messages.signed : messages.empty}
          </span>
          <span id={`${id}-shortcuts`} css={visuallyHiddenStyle}>
            {messages.shortcuts}
          </span>
          <div css={surfaceStyle}>
            <Canvas
              {...withoutSx(slotProps?.canvas)}
              {...rest}
              ref={mergedRef}
              role="img"
              tabIndex={disabled ? -1 : (rest.tabIndex ?? 0)}
              aria-roledescription={messages.roleDescription}
              aria-disabled={disabled || undefined}
              data-readonly={readOnly || undefined}
              aria-invalid={hasContent(error) ? true : rest['aria-invalid']}
              aria-labelledby={
                [labelledBy, hasContent(label) && `${id}-label`, !rest['aria-label'] && `${id}-state`]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              aria-describedby={[
                describedBy,
                `${id}-state`,
                `${id}-shortcuts`,
                required && `${id}-required`,
                hasContent(description) && `${id}-description`,
                hasContent(error) && `${id}-error`,
              ]
                .filter(Boolean)
                .join(' ')}
              className={slotProps?.canvas?.className}
              css={[canvasStyle, slotProps?.canvas?.sx]}
              onPointerDown={(event) => {
                onPointerDown?.(event);
                if (
                  event.defaultPrevented ||
                  locked ||
                  !event.isPrimary ||
                  event.button !== 0 ||
                  active.current ||
                  current.length >= MAX_STROKES ||
                  pointCount(drawable(current)) >= MAX_POINTS ||
                  event.currentTarget.clientWidth <= 0 ||
                  event.currentTarget.clientHeight <= 0
                )
                  return;
                stopReplay();
                pending.current = null;
                const stamp = Number.isFinite(event.timeStamp) ? event.timeStamp : 0;
                sessionStart.current ??= stamp;
                const gesture = {
                  pointerId: event.pointerId,
                  started: stamp,
                  stroke: {
                    id: strokeId(),
                    points: [],
                    color,
                    width,
                    startTime: Math.max(0, stamp - sessionStart.current),
                  },
                };
                active.current = gesture;
                try {
                  event.currentTarget.setPointerCapture(event.pointerId);
                } catch {
                  active.current = null;
                  return;
                }
                sample(event.nativeEvent, gesture);
                draw([...h.present, gesture.stroke]);
                event.preventDefault();
              }}
              onPointerMove={(event) => {
                onPointerMove?.(event);
                if (!event.defaultPrevented) move(event);
              }}
              onPointerUp={(event) => {
                onPointerUp?.(event);
                if (active.current?.pointerId !== event.pointerId) return;
                if (event.defaultPrevented) {
                  cancelStroke();
                  return;
                }
                move(event);
                const stroke = active.current.stroke;
                cancelStroke();
                if (stroke.points.length) replace([...history.current.present, stroke], messages.added);
              }}
              onPointerCancel={(event) => {
                onPointerCancel?.(event);
                if (active.current?.pointerId === event.pointerId) cancelStroke();
              }}
              onLostPointerCapture={(event) => {
                onLostPointerCapture?.(event);
                if (active.current?.pointerId === event.pointerId) cancelStroke();
              }}
              onKeyDown={(event) => {
                onKeyDown?.(event);
                if (event.defaultPrevented || event.target !== event.currentTarget) return;
                const key = event.key.toLowerCase();
                if (key === 'escape' && (playing || active.current)) {
                  stopReplay();
                  cancelStroke();
                  event.preventDefault();
                  event.stopPropagation();
                } else if (!locked && (event.metaKey || event.ctrlKey) && (key === 'z' || key === 'y')) {
                  if (key === 'y' || event.shiftKey) redo();
                  else undo();
                  event.preventDefault();
                } else if (!locked && (key === 'delete' || key === 'backspace')) {
                  clear();
                  event.preventDefault();
                }
              }}
            >
              {messages.fallback}
            </Canvas>
            {(hasContent(hint) || hasContent(signer)) && (
              <Guide
                {...withoutSx(slotProps?.guide)}
                aria-hidden="true"
                data-ui="signature-pad-guide"
                className={slotProps?.guide?.className}
                css={[guideStyle, slotProps?.guide?.sx]}
              >
                {!current.length && hasContent(hint) && <span css={guideTextStyle}>{hint}</span>}
                {hasContent(signer) && <span css={signerStyle}>{signer}</span>}
              </Guide>
            )}
          </div>
          <Toolbar
            {...withoutSx(slotProps?.toolbar)}
            data-ui="signature-pad-toolbar"
            className={slotProps?.toolbar?.className}
            css={[toolbarStyle, slotProps?.toolbar?.sx]}
          >
            <RadioGroup
              aria-label={messages.ink}
              orientation="horizontal"
              value={color}
              onValueChange={(next) => requestColor(next as InkColor)}
              disabled={locked}
              onKeyDown={radioBoundary}
            >
              {(Object.keys(PRINT_INK) as InkColor[]).map((ink) => (
                <RadioGroup.Radio key={ink} value={ink} label={messages.colors[ink]} />
              ))}
            </RadioGroup>
            <RadioGroup
              aria-label={messages.nib}
              orientation="horizontal"
              value={width}
              onValueChange={(next) => requestWidth(next as InkWidth)}
              disabled={locked}
              onKeyDown={radioBoundary}
            >
              {(Object.keys(NIB) as InkWidth[]).map((nib) => (
                <RadioGroup.Radio key={nib} value={nib} label={messages.widths[nib]} />
              ))}
            </RadioGroup>
            {actions.map(({ action, disabled: inactive, run }) => (
              <Action
                {...withoutSx(slotProps?.action)}
                key={action}
                size="sm"
                variant="outline"
                disabled={inactive}
                onClick={run}
                className={slotProps?.action?.className}
                css={slotProps?.action?.sx}
              >
                {hasContent(icons?.[action]) && <span aria-hidden="true">{icons?.[action]}</span>}
                {messages.actions[action]}
              </Action>
            ))}
          </Toolbar>
          {required && (
            <span id={`${id}-required`} css={visuallyHiddenStyle}>
              {messages.required}
            </span>
          )}
          {hasContent(description) && (
            <Description
              {...withoutSx(slotProps?.description)}
              id={`${id}-description`}
              className={slotProps?.description?.className}
              css={[descriptionStyle, slotProps?.description?.sx]}
            >
              {description}
            </Description>
          )}
          {hasContent(error) && (
            <Error
              {...withoutSx(slotProps?.error)}
              id={`${id}-error`}
              role="alert"
              className={slotProps?.error?.className}
              css={[errorStyle, slotProps?.error?.sx]}
            >
              {error}
            </Error>
          )}
          <Status
            {...withoutSx(slotProps?.status)}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={slotProps?.status?.className}
            css={[visuallyHiddenStyle, slotProps?.status?.sx]}
          >
            {announcement.text && <span key={announcement.revision}>{announcement.text}</span>}
          </Status>
        </Root>
      )}
    </WithSx>
  );
}
SignaturePad.displayName = 'SignaturePad';
