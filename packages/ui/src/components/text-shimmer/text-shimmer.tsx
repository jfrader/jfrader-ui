'use client';

import {
  useEffect,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type CSSProperties,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type Theme } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';

export type TextShimmerTone = 'neutral' | 'accent';
export type TextShimmerPartProps = ComponentPropsWithRef<'span'> & {
  css?: Interpolation<Theme>;
  'data-ui'?: string;
};
export interface TextShimmerSlots {
  root?: ComponentType<ComponentPropsWithRef<'span'>>;
  text?: ComponentType<ComponentPropsWithRef<'span'>>;
}
export interface TextShimmerProps extends Omit<ComponentPropsWithRef<'span'>, 'children'>, SxProps {
  children: string;
  /** Task activity; animation ending does not mark the task complete. */
  active?: boolean;
  tone?: TextShimmerTone;
  /** Full sweep cycle in milliseconds, clamped to 600–10000. */
  durationMs?: number;
  /** Animation-time budget, default 4000ms. Use 0 only with a pause control. */
  maxDurationMs?: number;
  paused?: boolean;
  'data-ui'?: string;
  component?: TextShimmerSlots['root'];
  slots?: TextShimmerSlots;
  slotProps?: { root?: TextShimmerPartProps; text?: TextShimmerPartProps };
}

const DEFAULT_CYCLE_MS = 1800;
const DEFAULT_BUDGET_MS = 4000;
const MIN_CYCLE_MS = 600;
const MAX_CYCLE_MS = 10000;
const MAX_BUDGET_MS = 5000;
const OBSERVER_MARGIN = '64px';
const sweep = keyframes({
  '0%': { backgroundPosition: '200% 0' },
  '80%, 100%': { backgroundPosition: '-100% 0' },
});
const settle = keyframes({ to: { backgroundImage: 'none', WebkitTextFillColor: 'currentColor' } });
const staticText = {
  animation: 'none',
  backgroundImage: 'none',
  WebkitTextFillColor: 'currentColor',
  transition: 'none',
};
const rootStyle = css({
  color: vars.color.text,
  maxInlineSize: '100%',
  '&[data-tone="accent"]': { color: vars.color.accentText },
});
const textStyle = css({
  transition: `color ${vars.motion.duration.fast} ${vars.motion.easeStandard}`,
  '@supports ((background-clip: text) or (-webkit-background-clip: text))': {
    '&[data-active="true"]': {
      backgroundImage: `linear-gradient(90deg, ${vars.color.textMuted} 35%, currentColor 50%, ${vars.color.textMuted} 65%)`,
      backgroundSize: '200% 100%',
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      animation: `${sweep} var(--text-shimmer-duration) linear var(--text-shimmer-iterations), ${settle} var(--text-shimmer-budget) steps(1, end) forwards`,
      '&:dir(rtl)': { animationDirection: 'reverse, normal' },
      '&[data-continuous="true"]': { animationName: `${sweep}` },
      '&[data-paused="true"]': { animationPlayState: 'paused' },
    },
  },
  '&::selection': { WebkitTextFillColor: 'currentColor' },
  [REDUCED_MOTION]: { '&&': staticText },
  [FORCED_COLORS]: { '&&': { ...staticText, color: 'CanvasText' } },
});

export function TextShimmer({
  children,
  active = true,
  tone = 'neutral',
  durationMs = DEFAULT_CYCLE_MS,
  maxDurationMs = DEFAULT_BUDGET_MS,
  paused = false,
  component,
  slots,
  slotProps,
  ref,
  className,
  style,
  sx,
  ...rest
}: TextShimmerProps) {
  const [element, setElement] = useState<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const {
    css: rootCss,
    className: slotClassName,
    style: slotStyle,
    ref: slotRef,
    ...rootProps
  } = slotProps?.root ?? {};
  const mergedRef = useMergeRefs([ref, slotRef, setElement]);
  const Root = slots?.root ?? component ?? 'span';
  const Text = slots?.text ?? 'span';
  const duration = Number.isFinite(durationMs)
    ? Math.min(MAX_CYCLE_MS, Math.max(MIN_CYCLE_MS, durationMs))
    : DEFAULT_CYCLE_MS;
  const budget =
    maxDurationMs === 0
      ? 0
      : Number.isFinite(maxDurationMs) && maxDurationMs > 0
        ? Math.min(MAX_BUDGET_MS, Math.max(1, maxDurationMs))
        : DEFAULT_BUDGET_MS;
  const dataUi = [
    ...new Set([
      'text-shimmer',
      ...[rest['data-ui'], rootProps['data-ui']].flatMap(
        (value) => value?.split(/\s+/).filter(Boolean) ?? [],
      ),
    ]),
  ].join(' ');

  useEffect(() => {
    if (!element) return;
    const document = element.ownerDocument;
    const updateVisibility = () => setPageVisible(document.visibilityState !== 'hidden');
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    const Observer = document.defaultView?.IntersectionObserver;
    setVisible(!Observer);
    const observer = Observer
      ? new Observer(([entry]) => setVisible(entry?.isIntersecting ?? false), { rootMargin: OBSERVER_MARGIN })
      : undefined;
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, [element]);

  return (
    <WithSx
      className={[className, slotClassName].filter(Boolean).join(' ')}
      styles={[rootStyle, rootCss]}
      sx={sx}
    >
      {(resolvedClassName) => (
        <Root
          {...rest}
          {...rootProps}
          ref={mergedRef}
          className={resolvedClassName}
          style={{ ...style, ...slotStyle }}
          data-ui={dataUi}
          data-state={active ? 'active' : 'idle'}
          data-tone={tone}
          aria-busy={active ? true : (rootProps['aria-busy'] ?? rest['aria-busy'])}
        >
          <Text
            {...slotProps?.text}
            key={String(active)}
            data-ui="text-shimmer-text"
            data-active={active}
            data-continuous={budget === 0}
            data-paused={paused || !visible || !pageVisible}
            css={[textStyle, slotProps?.text?.css]}
            style={
              {
                ...slotProps?.text?.style,
                '--text-shimmer-duration': `${duration}ms`,
                '--text-shimmer-budget': `${budget}ms`,
                '--text-shimmer-iterations': budget === 0 ? 'infinite' : budget / duration,
              } as CSSProperties
            }
          >
            {children}
          </Text>
        </Root>
      )}
    </WithSx>
  );
}

TextShimmer.displayName = 'TextShimmer';
