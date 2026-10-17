'use client';

// Loading indicator: a role="status" (polite live region) named by a visually hidden label; the
// ring is decorative. Not focusable, no keyboard map. Screen readers announce live-region text
// reliably only when it changes inside a region that was already mounted, so render the spinner
// where the busy region already exists rather than relying on the mount itself being announced.
import { useEffect, useRef, useState, type ComponentPropsWithRef, type ComponentType } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { loadingRing, loadingRingPulse } from '../../styling/loading-ring';
import { REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerVariant = 'ring' | 'dots' | 'bars' | 'square';
export type SpinnerValue = 'loading' | 'success' | 'error';
export type SpinnerPartProps = ComponentPropsWithRef<'span'> & {
  css?: Interpolation<Theme>;
  'data-ui'?: string;
};
export interface SpinnerSlots {
  root?: ComponentType<ComponentPropsWithRef<'span'>>;
  indicator?: ComponentType<ComponentPropsWithRef<'span'>>;
  status?: ComponentType<ComponentPropsWithRef<'span'>>;
}

export interface SpinnerProps extends Omit<ComponentPropsWithRef<'span'>, 'children'>, SxProps {
  size?: SpinnerSize;
  /** Accessible text announced for the status region. */
  label?: string;
  /** Morph the loading strokes to a result without changing the footprint. */
  value?: SpinnerValue;
  defaultValue?: SpinnerValue;
  variant?: SpinnerVariant;
  /** Hide the drawing from assistive technology inside an already named control. */
  decorative?: boolean;
  successLabel?: string;
  errorLabel?: string;
  tone?: 'neutral' | 'status';
  /** Positive pixel dimension; invalid values use the size preset. */
  dimension?: number;
  /** Positive stroke width in the SVG's 24-unit grid; invalid values use 2. */
  strokeWidth?: number;
  component?: SpinnerSlots['root'];
  slots?: SpinnerSlots;
  slotProps?: {
    root?: SpinnerPartProps;
    indicator?: SpinnerPartProps;
    status?: SpinnerPartProps;
  };
  'data-ui'?: string;
}

const rootStyle = css({
  position: 'relative',
  display: 'inline-flex',
  verticalAlign: 'middle',
  flexShrink: 0,
  '&[data-tone="status"][data-state="success"]': { color: vars.color.success },
  '&[data-tone="status"][data-state="error"]': { color: vars.color.dangerText },
});

const ringStyle = css({
  ...loadingRing,
  flexShrink: 0,
  boxSizing: 'border-box',
  [REDUCED_MOTION]: {
    animation: `${loadingRingPulse} 1.6s ease-in-out infinite alternate`,
  },
});

const sizeStyles: Record<SpinnerSize, SerializedStyles> = {
  sm: css({ inlineSize: vars.space[4], blockSize: vars.space[4] }),
  md: css({ inlineSize: vars.space[5], blockSize: vars.space[5] }),
  lg: css({ inlineSize: vars.space[6], blockSize: vars.space[6] }),
  xl: css({ inlineSize: vars.space[12], blockSize: vars.space[12] }),
};

const drawingStyle = css({
  display: 'block',
  inlineSize: '100%',
  blockSize: '100%',
  overflow: 'visible',
});
const indicatorStyle = css({ display: 'inline-flex', flexShrink: 0 });
const MORPH_SPRING = { type: 'spring', stiffness: 360, damping: 36 } as const;
const LOOP_SECONDS = 1.6;
type Stroke = readonly [number, number, number, number];
const SHAPES: Record<SpinnerVariant | 'success' | 'error', readonly Stroke[]> = {
  dots: [
    [4, 12, 4.01, 12],
    [9.3, 12, 9.31, 12],
    [14.6, 12, 14.61, 12],
    [20, 12, 20.01, 12],
  ],
  bars: [
    [4, 9, 4, 15],
    [9.3, 5, 9.3, 19],
    [14.6, 7, 14.6, 17],
    [20, 10, 20, 14],
  ],
  ring: [
    [12, 4, 20, 12],
    [20, 12, 12, 20],
    [12, 20, 4, 12],
    [4, 12, 12, 4],
  ],
  square: [
    [5, 5, 19, 5],
    [19, 5, 19, 19],
    [19, 19, 5, 19],
    [5, 19, 5, 5],
  ],
  success: [
    [4, 12, 7, 15],
    [7, 15, 10, 18],
    [10, 18, 15, 12],
    [15, 12, 20, 6],
  ],
  error: [
    [5, 5, 12, 12],
    [12, 12, 19, 19],
    [19, 5, 12, 12],
    [12, 12, 5, 19],
  ],
};

function MorphIndicator({
  value,
  variant,
  strokeWidth,
  active,
}: {
  value: SpinnerValue;
  variant: SpinnerVariant;
  strokeWidth: number;
  active: boolean;
}) {
  const reduce = useReducedMotion();
  const looping = value === 'loading' && active && !reduce;
  const shape = SHAPES[value === 'loading' ? variant : value];
  const ringControls = [
    [20, 4],
    [20, 20],
    [4, 20],
    [4, 4],
  ] as const;
  return (
    <motion.svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      css={drawingStyle}
      animate={{
        rotate: looping && (variant === 'ring' || variant === 'square') ? [0, 360] : 0,
      }}
      transition={{
        duration: looping ? LOOP_SECONDS : 0,
        ease: 'linear',
        repeat: looping ? Infinity : 0,
      }}
    >
      {shape.map(([x1, y1, x2, y2], index) => {
        const [cx, cy] =
          value === 'loading' && variant === 'ring' ? ringControls[index]! : [(x1 + x2) / 2, (y1 + y2) / 2];
        return (
          <motion.path
            key={index}
            initial={false}
            animate={{
              d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`,
              opacity: looping && (variant === 'dots' || variant === 'bars') ? [0.35, 1, 0.35] : 1,
            }}
            transition={{
              ...(reduce ? { duration: 0 } : MORPH_SPRING),
              opacity: {
                duration: looping ? LOOP_SECONDS : 0,
                repeat: looping ? Infinity : 0,
                delay: looping ? (index * LOOP_SECONDS) / shape.length : 0,
              },
            }}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        );
      })}
    </motion.svg>
  );
}

export function Spinner({
  ref,
  size = 'md',
  label = 'Loading',
  className,
  sx,
  value,
  defaultValue = 'loading',
  variant = 'ring',
  decorative = false,
  successLabel = 'Complete',
  errorLabel = 'Failed',
  tone = 'neutral',
  dimension,
  strokeWidth = 2,
  component,
  slots,
  slotProps,
  style,
  ...rest
}: SpinnerProps) {
  const [initial] = useState(defaultValue);
  const current = value ?? initial;
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const element = useRef<HTMLSpanElement>(null);
  const {
    css: rootCss,
    className: rootClass,
    style: rootInline,
    ref: rootRef,
    ...rootProps
  } = slotProps?.root ?? {};
  const mergedRef = useMergeRefs([ref, rootRef, element]);
  const Root = slots?.root ?? component ?? 'span';
  const Indicator = slots?.indicator ?? 'span';
  const Status = slots?.status ?? 'span';
  const { css: indicatorCss, ...indicatorProps } = slotProps?.indicator ?? {};
  const { css: statusCss, ...statusProps } = slotProps?.status ?? {};
  const morph = value !== undefined || defaultValue !== 'loading' || variant !== 'ring';
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const document = node.ownerDocument;
    const update = () => setPageVisible(document.visibilityState !== 'hidden');
    update();
    document.addEventListener('visibilitychange', update);
    const Observer = document.defaultView?.IntersectionObserver;
    const observer = Observer
      ? new Observer(([entry]) => setVisible(entry?.isIntersecting ?? false))
      : undefined;
    observer?.observe(node);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  const dimensionStyle =
    dimension !== undefined && Number.isFinite(dimension) && dimension > 0
      ? { inlineSize: dimension, blockSize: dimension }
      : undefined;
  const marker = [
    ...new Set([
      'spinner',
      ...[rest['data-ui'], rootProps['data-ui']].flatMap((x) => x?.split(/\s+/).filter(Boolean) ?? []),
    ]),
  ].join(' ');
  return (
    <MotionConfig reducedMotion="user">
      <WithSx
        className={[className, rootClass].filter(Boolean).join(' ')}
        styles={[rootStyle, rootCss]}
        sx={sx}
      >
        {(className) => (
          <Root
            {...rest}
            {...rootProps}
            ref={mergedRef}
            role={decorative ? undefined : 'status'}
            aria-live={decorative ? undefined : 'polite'}
            aria-atomic={decorative ? undefined : true}
            aria-hidden={decorative ? true : (rootProps['aria-hidden'] ?? rest['aria-hidden'])}
            data-ui={marker}
            data-state={current}
            data-tone={tone}
            className={className}
            style={{ ...style, ...rootInline }}
          >
            <Indicator
              {...indicatorProps}
              aria-hidden="true"
              data-ui="spinner-indicator"
              style={{ ...dimensionStyle, ...indicatorProps.style }}
              css={[morph ? indicatorStyle : ringStyle, sizeStyles[size], indicatorCss]}
            >
              {morph && (
                <MorphIndicator
                  value={current}
                  variant={variant}
                  strokeWidth={Number.isFinite(strokeWidth) && strokeWidth > 0 ? strokeWidth : 2}
                  active={visible && pageVisible}
                />
              )}
            </Indicator>
            {!decorative && (
              <Status {...statusProps} data-ui="spinner-status" css={[visuallyHiddenStyle, statusCss]}>
                {current === 'loading' ? label : current === 'success' ? successLabel : errorLabel}
              </Status>
            )}
          </Root>
        )}
      </WithSx>
    </MotionConfig>
  );
}

Spinner.displayName = 'Spinner';
