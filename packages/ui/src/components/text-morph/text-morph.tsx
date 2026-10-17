'use client';

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
} from 'react';
import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  useMotionValue,
  useReducedMotionConfig,
} from 'motion/react';
import { useMergeRefs } from '@floating-ui/react';
import { css } from '../../styling/css';
import { WithSx, type SlotCss, type SxProps } from '../../styling/sx';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { motionDurationMs } from '../../styling/motion-timings';
import { Sand, type SandOptions } from './sand';
import { Reel } from './reel';

export type TextMorphVariant = 'auto' | 'glyph' | 'crossfade' | 'slot' | 'sand';
export type TextMorphPartProps = ComponentPropsWithRef<'span'> & SlotCss & { 'data-ui'?: string };
export type TextMorphCanvasProps = ComponentPropsWithRef<'canvas'> & SlotCss;
export interface TextMorphSlots {
  root?: ComponentType<TextMorphPartProps>;
  text?: ComponentType<TextMorphPartProps>;
  frame?: ComponentType<TextMorphPartProps>;
  glyph?: ComponentType<TextMorphPartProps>;
  canvas?: ComponentType<TextMorphCanvasProps>;
}
export interface TextMorphSlotProps {
  root?: TextMorphPartProps;
  text?: TextMorphPartProps;
  frame?: TextMorphPartProps;
  glyph?: TextMorphPartProps;
  canvas?: TextMorphCanvasProps;
}
type Content = { children: string; value?: never } | { value: string | number; children?: never };
export type TextMorphProps = Omit<ComponentPropsWithRef<'span'>, 'children'> &
  SxProps &
  Content & {
    /** Choose matched glyphs, a shaped-label fade, rolling cells, or decorative sand. */
    variant?: TextMorphVariant;
    /** Use the same locale on the server and client. Also controls grapheme segmentation. */
    locale?: Intl.LocalesArgument;
    formatOptions?: Intl.NumberFormatOptions;
    format?: (value: number) => string;
    /** Slot landing duration in milliseconds, clamped to 0–2000. */
    durationMs?: number;
    /** Slot landing delay per cell in milliseconds, capped at 400ms overall. */
    staggerMs?: number;
    /** Additional digit-wheel turns, clamped to 0–3. */
    spins?: number;
    align?: 'start' | 'end';
    /** Announce unsolicited changes. Leave off for labels inside controls. */
    announce?: boolean;
    /** Stop decoration and show the current text. */
    paused?: boolean;
    /** Sand geometry and rendering budgets. */
    sand?: SandOptions;
    component?: ComponentType<TextMorphPartProps>;
    slots?: TextMorphSlots;
    slotProps?: TextMorphSlotProps;
  };
const WIDTH_SPRING = { type: 'spring', stiffness: 320, damping: 36, mass: 1 } as const;
const SECONDS = 1000;
const rootStyle = css({
  label: 'text-morph',
  position: 'relative',
  display: 'inline-block',
  verticalAlign: 'baseline',
  minInlineSize: 0,
  whiteSpace: 'pre',
  fontVariantNumeric: 'tabular-nums',
  '&[data-variant="sand"]': {
    maxInlineSize: '100%',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
  '&[data-animated="true"] > [data-ui="text-morph-text"]': {
    position: 'absolute',
    insetInlineStart: 0,
    insetBlockStart: 0,
    color: 'transparent',
  },
  [REDUCED_MOTION]: {
    '&[data-animated="true"] > [data-ui="text-morph-text"]': {
      position: 'static',
      color: 'inherit',
    },
    '& > [data-ui="text-morph-frame"]': { display: 'none' },
  },
  [FORCED_COLORS]: {
    '&[data-animated="true"] > [data-ui="text-morph-text"]': {
      position: 'static',
      color: 'CanvasText',
    },
    '& > [data-ui="text-morph-frame"]': { display: 'none' },
  },
});
const textStyle = css({ whiteSpace: 'inherit', userSelect: 'text' });
const frameStyle = css({
  display: 'inline-block',
  verticalAlign: 'baseline',
  pointerEvents: 'none',
  userSelect: 'none',
});
const widthStyle = css({ display: 'inline-block', verticalAlign: 'baseline' });
const trackStyle = css({
  display: 'inline-flex',
  position: 'relative',
  verticalAlign: 'baseline',
  whiteSpace: 'pre',
});
const glyphStyle = css({ display: 'inline-block', whiteSpace: 'pre' });
const SAFE_GLYPHS = /^[\p{Script=Latin}\p{Number}\p{Punctuation}\p{Separator}\p{Mark}]*$/u;
const SLOT_LIMITS = {
  duration: 900,
  maxDuration: 2000,
  stagger: 70,
  maxStagger: 160,
  totalStagger: 400,
  spins: 1,
  maxSpins: 3,
  maxGlyphs: 80,
} as const;
function bounded(value: number | undefined, fallback: number, max: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(0, value!)) : fallback;
}

interface TextCell {
  text: string;
  key: string;
  static?: boolean;
}
function glyphs(text: string, locale: Intl.LocalesArgument | undefined): TextCell[] | null {
  if (typeof Intl.Segmenter !== 'function') return null;
  const occurrences = new Map<string, number>();
  return Array.from(
    new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(text),
    ({ segment }) => {
      const occurrence = occurrences.get(segment) ?? 0;
      occurrences.set(segment, occurrence + 1);
      return { text: segment, key: `${segment}:${occurrence}` };
    },
  );
}

function Decoration({
  text,
  variant,
  locale,
  slots,
  slotProps,
  direction,
  digits,
  numberParts,
  trend,
  durationMs,
  staggerMs,
  spins,
  align,
}: {
  text: string;
  variant: Exclude<TextMorphVariant, 'sand'>;
  locale?: Intl.LocalesArgument;
  slots?: TextMorphSlots;
  slotProps?: TextMorphSlotProps;
  direction: 'ltr' | 'rtl';
  digits?: readonly string[];
  numberParts?: readonly Intl.NumberFormatPart[];
  trend: 1 | -1;
  durationMs: number;
  staggerMs: number;
  spins: number;
  align: 'start' | 'end';
}) {
  const track = useRef<HTMLSpanElement>(null);
  const width = useMotionValue(0);
  const [measured, setMeasured] = useState(false);
  const previous = useRef(text);
  const lastWidth = useRef<number | null>(null);
  const controller = useRef<ReturnType<typeof animate> | null>(null);
  const Frame = slots?.frame ?? 'span';
  const Glyph = slots?.glyph ?? 'span';
  const segments = useMemo(() => glyphs(text, locale), [text, locale]);
  const numericCells = useMemo(() => {
    if (!numberParts || variant !== 'slot' || direction === 'rtl') return null;
    const occurrences = new Map<string, number>();
    const cells: TextCell[] = [];
    for (const part of numberParts) {
      if (part.type === 'integer' || part.type === 'fraction') {
        const partGlyphs = glyphs(part.value, locale);
        if (!partGlyphs) return null;
        cells.push(...partGlyphs);
      } else {
        const occurrence = occurrences.get(part.type) ?? 0;
        occurrences.set(part.type, occurrence + 1);
        cells.push({ text: part.value, key: `${part.type}:${occurrence}`, static: true });
      }
    }
    if (cells.length > SLOT_LIMITS.maxGlyphs) return null;
    const digitCount = cells.filter((cell) => !cell.static).length;
    let ordinal = 0;
    return cells.map((cell) =>
      cell.static
        ? cell
        : {
            ...cell,
            key: `digit:${align === 'end' ? digitCount - ordinal++ : ordinal++}`,
          },
    );
  }, [numberParts, variant, direction, locale, align]);
  const safe = SAFE_GLYPHS.test(text) && SAFE_GLYPHS.test(previous.current) && direction !== 'rtl';
  const split =
    segments !== null &&
    segments.length <= SLOT_LIMITS.maxGlyphs &&
    variant !== 'crossfade' &&
    (variant === 'glyph' || safe);
  const cells: TextCell[] = numericCells ?? (split ? segments : [{ text, key: text }]);
  useLayoutEffect(() => {
    const target = track.current;
    if (!target) return;
    const next = target.getBoundingClientRect().width;
    controller.current?.stop();
    if (lastWidth.current === null) width.set(next);
    else controller.current = animate(width, next, WIDTH_SPRING);
    lastWidth.current = next;
    previous.current = text;
    setMeasured(true);
    const settle = () => {
      const current = target.getBoundingClientRect().width;
      if (current === lastWidth.current) return;
      controller.current?.stop();
      width.set(current);
      lastWidth.current = current;
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(settle) : null;
    observer?.observe(target);
    target.ownerDocument.fonts?.addEventListener('loadingdone', settle);
    return () => {
      controller.current?.stop();
      observer?.disconnect();
      target.ownerDocument.fonts?.removeEventListener('loadingdone', settle);
    };
  }, [text, locale, direction, width]);
  return (
    <WithSx className={slotProps?.frame?.className} styles={[frameStyle, slotProps?.frame?.css]}>
      {(className) => (
        <Frame
          {...slotProps?.frame}
          className={className}
          aria-hidden="true"
          data-ui="text-morph-frame"
        >
          <motion.span css={widthStyle} style={{ width: measured ? width : undefined }}>
            <span ref={track} css={trackStyle} data-ui="text-morph-track" dir={direction}>
              {variant === 'slot' ? (
                cells.map((cell, index) =>
                  cell.static ? (
                    <Glyph
                      key={cell.key}
                      {...slotProps?.glyph}
                      css={slotProps?.glyph?.css}
                      data-ui="text-morph-glyph"
                    >
                      {cell.text}
                    </Glyph>
                  ) : (
                    <Reel
                      key={numericCells ? cell.key : align === 'end' ? cells.length - index : index}
                      text={cell.text}
                      digits={digits}
                      direction={trend}
                      durationMs={durationMs}
                      spins={spins}
                      delayMs={Math.min(index * staggerMs, SLOT_LIMITS.totalStagger)}
                      Glyph={Glyph}
                      glyphProps={slotProps?.glyph}
                    />
                  ),
                )
              ) : (
                <AnimatePresence initial={false} mode="popLayout">
                  {cells.map((cell, index) => (
                    <motion.span
                      key={cell.key}
                      css={glyphStyle}
                      layout="position"
                      initial={{ opacity: 0, y: '0.14em' }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: '-0.14em' }}
                      transition={{
                        duration: motionDurationMs.slow / SECONDS,
                        delay:
                          Math.min((index * motionDurationMs.fast) / 4, motionDurationMs.slow) /
                          SECONDS,
                      }}
                    >
                      <WithSx
                        className={slotProps?.glyph?.className}
                        styles={slotProps?.glyph?.css}
                      >
                        {(className) => (
                          <Glyph
                            {...slotProps?.glyph}
                            className={className}
                            data-ui="text-morph-glyph"
                          >
                            {cell.text}
                          </Glyph>
                        )}
                      </WithSx>
                    </motion.span>
                  ))}
                </AnimatePresence>
              )}
            </span>
          </motion.span>
        </Frame>
      )}
    </WithSx>
  );
}

function TextMorphRoot({
  children,
  value,
  variant = 'auto',
  locale,
  formatOptions,
  format,
  announce = false,
  paused = false,
  sand,
  component,
  slots,
  slotProps,
  className,
  sx,
  ref,
  style,
  durationMs,
  staggerMs,
  spins,
  align,
  ...props
}: TextMorphProps) {
  const reduced = useReducedMotionConfig();
  const root = useRef<HTMLSpanElement>(null);
  const mergedRef = useMergeRefs([root, ref, slotProps?.root?.ref]);
  const [direction, setDirection] = useState<'ltr' | 'rtl'>(
    (slotProps?.root?.dir ?? props.dir) === 'rtl' ? 'rtl' : 'ltr',
  );
  const isNumber = typeof value === 'number';
  const formattingKey = JSON.stringify(formatOptions);
  const numberFormat = useMemo(
    () => (isNumber && !format ? new Intl.NumberFormat(locale, formatOptions) : null),
    [isNumber, format, locale, formattingKey],
  );
  const resolvedFormattingKey = numberFormat ? JSON.stringify(numberFormat.resolvedOptions()) : 'text';
  const numberParts = useMemo(
    () =>
      numberFormat && typeof value === 'number' && Number.isFinite(value)
        ? numberFormat.formatToParts(value)
        : undefined,
    [numberFormat, value],
  );
  const text = useMemo(
    () =>
      typeof value === 'number'
        ? format
          ? format(value)
          : numberFormat
            ? numberFormat.format(value)
            : String(value)
        : (value ?? children ?? ''),
    [value, children, numberFormat, format],
  );
  const [numericChange, setNumericChange] = useState<{ value: typeof value; trend: 1 | -1 }>({
    value,
    trend: 1,
  });
  if (!Object.is(numericChange.value, value)) {
    setNumericChange({
      value,
      trend:
        typeof value === 'number' &&
        typeof numericChange.value === 'number' &&
        value < numericChange.value
          ? -1
          : 1,
    });
  }
  const digits = useMemo(() => {
    if (typeof value !== 'number' || !Number.isFinite(value) || format) return undefined;
    const decimal = new Intl.NumberFormat(locale, {
      numberingSystem: numberFormat!.resolvedOptions().numberingSystem,
      useGrouping: false,
    });
    return Array.from({ length: 10 }, (_, digit) => decimal.format(digit));
  }, [value, locale, numberFormat, format]);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const update = () =>
      setDirection(
        element.ownerDocument.defaultView?.getComputedStyle(element).direction === 'rtl'
          ? 'rtl'
          : 'ltr',
      );
    update();
    const observer = new MutationObserver(update);
    for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
      observer.observe(parent, { attributes: true, attributeFilter: ['dir', 'class', 'style'] });
    }
    return () => observer.disconnect();
  }, []);
  const Root = slots?.root ?? component ?? 'span';
  const Text = slots?.text ?? 'span';
  const animated = !reduced && !paused && variant !== 'sand';
  const rootProps = { ...props, ...slotProps?.root };
  const rootLive = rootProps['aria-live'] !== undefined;
  const identity = [
    ...new Set(`text-morph ${rootProps['data-ui'] ?? ''}`.trim().split(/\s+/)),
  ].join(' ');
  return (
    <WithSx
      className={[className, slotProps?.root?.className].filter(Boolean).join(' ')}
      styles={[rootStyle, slotProps?.root?.css]}
      sx={sx}
    >
      {(resolvedClassName) => (
        <Root
          {...rootProps}
          ref={mergedRef}
          className={resolvedClassName}
          style={{ ...style, ...slotProps?.root?.style }}
          data-ui={identity}
          data-variant={variant}
          data-animated={animated}
        >
          <Text
            {...slotProps?.text}
            css={[textStyle, slotProps?.text?.css]}
            data-ui="text-morph-text"
            aria-live={announce && !rootLive ? 'polite' : undefined}
            aria-atomic={announce && !rootLive ? true : undefined}
          >
            {text}
          </Text>
          {animated && (
            <Decoration
              key={resolvedFormattingKey}
              text={text}
              variant={typeof value === 'number' && !Number.isFinite(value) ? 'crossfade' : variant}
              locale={locale}
              direction={direction}
              slots={slots}
              slotProps={slotProps}
              digits={digits}
              numberParts={numberParts}
              trend={numericChange.trend}
              align={align ?? (typeof value === 'number' ? 'end' : 'start')}
              durationMs={bounded(durationMs, SLOT_LIMITS.duration, SLOT_LIMITS.maxDuration)}
              staggerMs={bounded(staggerMs, SLOT_LIMITS.stagger, SLOT_LIMITS.maxStagger)}
              spins={Math.floor(bounded(spins, SLOT_LIMITS.spins, SLOT_LIMITS.maxSpins))}
            />
          )}
          {variant === 'sand' && !reduced && !paused && (
            <Sand {...sand} text={text} slots={slots} slotProps={slotProps} />
          )}
        </Root>
      )}
    </WithSx>
  );
}

/** Animate short, caller-owned text without adding a control or automatic announcements. */
export function TextMorph(props: TextMorphProps) {
  const reduced = useReducedMotionConfig();
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
      <TextMorphRoot {...props} />
    </MotionConfig>
  );
}
TextMorph.displayName = 'TextMorph';
