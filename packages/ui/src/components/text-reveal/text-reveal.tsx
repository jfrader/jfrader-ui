'use client';

import { Fragment, type ComponentPropsWithRef, type ComponentType, type CSSProperties } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type Theme } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';

export type TextRevealVariant = 'standard' | 'soft';
export type TextRevealPartProps = ComponentPropsWithRef<'span'> & {
  css?: Interpolation<Theme>;
  'data-ui'?: string;
};
export interface TextRevealSlots {
  root?: ComponentType<ComponentPropsWithRef<'span'>>;
  visual?: ComponentType<ComponentPropsWithRef<'span'>>;
  word?: ComponentType<ComponentPropsWithRef<'span'>>;
}
export interface TextRevealProps extends Omit<ComponentPropsWithRef<'span'>, 'children'>, SxProps {
  /** Literal text, including deliberate newlines. */
  text: string;
  variant?: TextRevealVariant;
  /** Initial delay in milliseconds, clamped to 0–1000. */
  delayMs?: number;
  /** Use the same locale on server and client for matching segmentation. */
  locale?: Intl.LocalesArgument;
  'data-ui'?: string;
  component?: TextRevealSlots['root'];
  slots?: TextRevealSlots;
  slotProps?: { root?: TextRevealPartProps; visual?: TextRevealPartProps; word?: TextRevealPartProps };
}

const MAX_DELAY_MS = 1000;
const RISE = '0.6em';
const BLUR = { standard: '0.12em', soft: '0.06em' };
const rise = keyframes({ from: { transform: `translateY(${RISE})` }, to: { transform: 'none' } });
const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const focus = keyframes({ from: { filter: 'blur(var(--text-reveal-blur))' }, to: { filter: 'none' } });
const rootStyle = css({ color: vars.color.text, maxInlineSize: '100%', whiteSpace: 'pre-wrap' });
const hiddenStyle = css([visuallyHiddenStyle, { userSelect: 'none' }]);
const wordStyle = css({
  display: 'inline-block',
  animation: `${rise} ${vars.motion.duration.slow} ${vars.motion.easeStandard} backwards, ${fade} ${vars.motion.duration.fast} ${vars.motion.easeStandard} backwards, ${focus} ${vars.motion.duration.base} ${vars.motion.easeStandard} backwards`,
  animationDelay: 'var(--text-reveal-delay)',
  [REDUCED_MOTION]: { animation: 'none', opacity: 1, transform: 'none', filter: 'none' },
  [FORCED_COLORS]: { animation: 'none', color: 'CanvasText', filter: 'none' },
});

export function TextReveal({
  text,
  variant = 'standard',
  delayMs = 0,
  locale,
  component,
  slots,
  slotProps,
  ref,
  className,
  style,
  sx,
  ...rest
}: TextRevealProps) {
  const {
    css: rootCss,
    className: slotClassName,
    style: slotStyle,
    ref: slotRef,
    ...rootProps
  } = slotProps?.root ?? {};
  const mergedRef = useMergeRefs([ref, slotRef]);
  const Root = slots?.root ?? component ?? 'span';
  const Visual = slots?.visual ?? 'span';
  const Word = slots?.word ?? 'span';
  const segmenter =
    typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(locale, { granularity: 'word' }) : undefined;
  const lines = text
    .split('\n')
    .map((line) => (segmenter ? Array.from(segmenter.segment(line), ({ segment }) => segment) : [line]));
  const count = lines.flat().filter((segment) => segment.trim().length > 0).length;
  let nextWordIndex = 0;
  const indexedLines = lines.map((line) =>
    line.map((segment) => ({
      segment,
      wordIndex: segment.trim() ? nextWordIndex++ : null,
    })),
  );
  const delay = Number.isFinite(delayMs) ? Math.min(MAX_DELAY_MS, Math.max(0, delayMs)) : 0;
  const dataUi = [
    ...new Set([
      'text-reveal',
      ...[rest['data-ui'], rootProps['data-ui']].flatMap(
        (value) => value?.split(/\s+/).filter(Boolean) ?? [],
      ),
    ]),
  ].join(' ');
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
        >
          <span css={hiddenStyle}>{text.replaceAll('\n', ' ')}</span>
          <Visual {...slotProps?.visual} key={text} data-ui="text-reveal-visual" aria-hidden="true">
            {indexedLines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && '\n'}
                {line.map(({ segment, wordIndex }, segmentIndex) => {
                  if (wordIndex === null) return segment;
                  const wordDelay = `${delay}ms + ${wordIndex} * min(calc(${vars.motion.duration.fast} / 4), calc(${vars.motion.duration.slow} / ${Math.max(count - 1, 1)}))`;
                  return (
                    <Word
                      {...slotProps?.word}
                      key={segmentIndex}
                      data-ui="text-reveal-word"
                      css={[wordStyle, slotProps?.word?.css]}
                      style={
                        {
                          ...slotProps?.word?.style,
                          '--text-reveal-blur': BLUR[variant],
                          '--text-reveal-delay': `calc(${wordDelay})`,
                        } as CSSProperties
                      }
                    >
                      {segment}
                    </Word>
                  );
                })}
              </Fragment>
            ))}
          </Visual>
        </Root>
      )}
    </WithSx>
  );
}

TextReveal.displayName = 'TextReveal';
