'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentPropsWithRef, type CSSProperties } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type Theme } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';

export type InViewTitleVariant = 'word' | 'line' | 'blur' | 'tracking' | 'wipe';
export interface InViewTitlePartProps {
  className?: string;
  css?: Interpolation<Theme>;
}
export interface InViewTitleProps extends Omit<ComponentPropsWithRef<'h2'>, 'children'>, SxProps {
  text: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  variant?: InViewTitleVariant;
  once?: boolean;
  locale?: Intl.LocalesArgument;
  slotProps?: { visual?: InViewTitlePartProps; segment?: InViewTitlePartProps };
}

const headings = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5', 6: 'h6' } as const;
const ENTRY_THRESHOLD = 0.45;
const DESCENDER_ALLOWANCE = '0.15em';
const rise = keyframes({ from: { transform: 'translateY(0.6em)' }, to: { transform: 'none' } });
const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const blur = keyframes({ from: { filter: 'blur(0.12em)' }, to: { filter: 'none' } });
const tracking = keyframes({ from: { letterSpacing: '-0.04em' }, to: { letterSpacing: 'inherit' } });
const wipe = keyframes({
  from: { maskImage: `linear-gradient(to right, ${vars.color.text} 50%, transparent 50%)`, maskSize: '200% 100%', maskPosition: '100% 0' },
  to: { maskImage: `linear-gradient(to right, ${vars.color.text} 50%, transparent 50%)`, maskSize: '200% 100%', maskPosition: '0% 0' },
});
const wipeRtl = keyframes({
  from: { maskImage: `linear-gradient(to left, ${vars.color.text} 50%, transparent 50%)`, maskSize: '200% 100%', maskPosition: '0% 0' },
  to: { maskImage: `linear-gradient(to left, ${vars.color.text} 50%, transparent 50%)`, maskSize: '200% 100%', maskPosition: '100% 0' },
});
const animation = (name: ReturnType<typeof keyframes>, duration: string) =>
  `${name} ${duration} ${vars.motion.easeStandard} var(--in-view-delay, 0ms) backwards`;
const variantStyles = {
  word: css({ animation: `${animation(rise, vars.motion.duration.slow)}, ${animation(fade, vars.motion.duration.fast)}` }),
  line: css({ animation: `${animation(rise, vars.motion.duration.slow)}, ${animation(fade, vars.motion.duration.fast)}` }),
  blur: css({ animation: `${animation(rise, vars.motion.duration.base)}, ${animation(blur, vars.motion.duration.base)}, ${animation(fade, vars.motion.duration.fast)}` }),
  tracking: css({ animation: `${animation(tracking, vars.motion.duration.base)}, ${animation(fade, vars.motion.duration.fast)}` }),
  wipe: css({ animation: animation(wipe, vars.motion.duration.slow), '&:dir(rtl)': { animation: animation(wipeRtl, vars.motion.duration.slow) } }),
};
const rootStyle = css({
  position: 'relative',
  margin: 0,
  minInlineSize: 0,
  maxInlineSize: '100%',
  color: vars.color.text,
  font: 'inherit',
  '& [data-in-view-plain]': { display: 'none' },
  '&:not([data-state="revealing"]) [data-in-view-segment]': { animation: 'none' },
  [REDUCED_MOTION]: {
    '& [data-in-view-parts]': { display: 'none' },
    '& [data-in-view-plain]': { display: 'inline', whiteSpace: 'pre-wrap' },
    '& [data-in-view-segment]': { animation: 'none', transform: 'none', filter: 'none', maskImage: 'none', opacity: 1 },
  },
  [FORCED_COLORS]: {
    color: 'CanvasText',
    '& [data-in-view-parts]': { display: 'none' },
    '& [data-in-view-plain]': { display: 'inline', whiteSpace: 'pre-wrap' },
    '& [data-in-view-segment]': { animation: 'none', transform: 'none', filter: 'none', maskImage: 'none', opacity: 1 },
  },
});
const visualStyle = css({ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' });
const lineStyle = css({ display: 'block', minInlineSize: 0, maxInlineSize: '100%' });
const rising = { word: true, line: true, blur: true, tracking: false, wipe: false } satisfies Record<InViewTitleVariant, boolean>;
const clipStyle = css({
  display: 'inline-block',
  verticalAlign: 'bottom',
  maxInlineSize: '100%',
  overflowX: 'visible',
  overflowY: 'clip',
  paddingBlock: DESCENDER_ALLOWANCE,
  marginBlock: `-${DESCENDER_ALLOWANCE}`,
});
const segmentStyle = css({ display: 'inline-block', maxInlineSize: '100%', verticalAlign: 'bottom' });

export function InViewTitle({
  text,
  level = 2,
  variant = 'blur',
  once = true,
  locale,
  slotProps,
  ref,
  className,
  sx,
  ...rest
}: InViewTitleProps) {
  const [element, setElement] = useState<HTMLHeadingElement | null>(null);
  const attach = useCallback((node: HTMLHeadingElement | null) => {
    setElement(node);
    const cleanup = typeof ref === 'function' ? ref(node) : undefined;
    if (ref && typeof ref !== 'function') ref.current = node;
    return () => {
      setElement(null);
      if (typeof cleanup === 'function') cleanup();
      else if (typeof ref === 'function') ref(null);
      else if (ref) ref.current = null;
    };
  }, [ref]);

  useEffect(() => {
    if (!element) return;
    const view = element.ownerDocument.defaultView;
    element.dataset.state = 'settled';
    if (!view) return;
    let active = true;
    let stopped = false;
    let observer: IntersectionObserver | undefined;
    let entered = false;
    let armed = element.getBoundingClientRect().top > view.innerHeight;
    let seen = !armed;
    let reduced: MediaQueryList | undefined;
    let forced: MediaQueryList | undefined;
    const settle = () => {
      if (active) element.dataset.state = 'settled';
    };
    const stop = () => {
      settle();
      observer?.disconnect();
      armed = false;
      stopped = true;
    };
    const complete = (event: AnimationEvent) => {
      const target = event.target;
      if (!(target instanceof view.HTMLElement) || !target.hasAttribute('data-in-view-last')) return;
      if (element.dataset.state !== 'revealing' || event.animationName === fade.name) return;
      settle();
      if (once) observer?.disconnect();
    };
    const environment = () => { if (reduced?.matches || forced?.matches) stop(); };
    const navigate = () => {
      if (element.id && view.location.hash.slice(1) === element.id) stop();
    };
    const select = () => {
      const selection = element.ownerDocument.getSelection();
      if (selection?.anchorNode && element.contains(selection.anchorNode)) stop();
    };
    try {
      reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
      forced = view.matchMedia('(forced-colors: active)');
      if (
        !text.trim() || !view.IntersectionObserver ||
        !view.CSS?.supports('animation-name', 'none') || reduced.matches || forced.matches
      ) return;
      navigate();
      if (stopped || (!armed && once)) return;
      observer = new view.IntersectionObserver((entries) => {
        if (!active || stopped) return;
        for (const entry of entries) {
          if (entry.target !== element) continue;
          if (!entry.isIntersecting || entry.intersectionRatio === 0) {
            if (seen) {
              settle();
              if (!once) armed = true;
              else if (entered) observer?.disconnect();
            }
            entered = false;
          } else {
            seen = true;
            if (entry.intersectionRatio >= ENTRY_THRESHOLD && !entered) {
              entered = true;
              if (armed) {
                element.dataset.state = 'revealing';
                armed = false;
              }
            }
          }
        }
      }, { threshold: [0, ENTRY_THRESHOLD] });
      if (armed) element.dataset.state = 'idle';
      observer.observe(element);
      element.addEventListener('animationend', complete);
      element.addEventListener('focusin', stop);
      element.ownerDocument.addEventListener('selectionchange', select);
      view.addEventListener('hashchange', navigate);
      reduced.addEventListener('change', environment);
      forced.addEventListener('change', environment);
    } catch {
      stop();
    }
    return () => {
      active = false;
      observer?.disconnect();
      element.removeEventListener('animationend', complete);
      element.removeEventListener('focusin', stop);
      element.ownerDocument.removeEventListener('selectionchange', select);
      view.removeEventListener('hashchange', navigate);
      reduced?.removeEventListener('change', environment);
      forced?.removeEventListener('change', environment);
    };
  }, [element, text, variant, once, locale]);

  const Heading = headings[level];
  const whole = variant === 'tracking' || variant === 'wipe';
  const segmenter = useMemo(
    () => typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(locale, { granularity: 'word' }) : undefined,
    [locale],
  );
  const lines = whole ? [text] : text.split('\n');
  const groups = lines.map((line) => variant === 'line' || whole || !segmenter
    ? [line]
    : Array.from(segmenter.segment(line), ({ segment }) => segment));
  const count = groups.flat().filter((part) => part.trim()).length;
  return (
    <WithSx className={className} styles={rootStyle} sx={sx}>
      {(mergedClassName) => {
        let order = 0;
        return (
          <Heading {...rest} ref={attach} data-ui="in-view-title" data-state="settled" className={mergedClassName}>
            <span css={visuallyHiddenStyle}>{text.replace(/\s+/gu, ' ').trim()}</span>
            <span
              data-ui="in-view-title-visual"
              aria-hidden="true"
              className={slotProps?.visual?.className}
              css={[visualStyle, slotProps?.visual?.css]}
            >
              <span data-in-view-plain="">{text}</span>
              <span data-in-view-parts="">
                {groups.map((parts, lineIndex) => (
                  <span key={lineIndex} css={!whole && lineStyle}>
                    {parts.map((part, partIndex) => {
                      if (!part.trim()) return <span key={partIndex}>{part || '\u200b'}</span>;
                      const index = order++;
                      return (
                        <span key={partIndex} css={rising[variant] && clipStyle}>
                          <span
                            data-in-view-segment=""
                            data-in-view-last={index === count - 1 ? '' : undefined}
                            className={slotProps?.segment?.className}
                            style={{
                              '--in-view-delay': `calc(${vars.motion.duration.slow} * ${count > 1 ? index / (count - 1) : 0})`,
                            } as CSSProperties}
                            css={[segmentStyle, variantStyles[variant], slotProps?.segment?.css]}
                          >
                            {part}
                          </span>
                        </span>
                      );
                    })}
                  </span>
                ))}
              </span>
            </span>
          </Heading>
        );
      }}
    </WithSx>
  );
}
InViewTitle.displayName = 'InViewTitle';
