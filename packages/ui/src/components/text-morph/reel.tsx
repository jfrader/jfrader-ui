'use client';

import { useLayoutEffect, useRef, type ComponentType } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react';
import { base } from '@jfrader/tokens';
import { css } from '../../styling/css';
import { WithSx } from '../../styling/sx';
import type { TextMorphPartProps } from './text-morph';

const PITCH_EM = 1.6;
const DIGIT_COUNT = 10;
const WHEEL_COPIES = 9;
const CENTER = 4 * DIGIT_COUNT;
const EASE = base.motion.easeStandard.match(/[\d.]+/g)!.map(Number) as [
  number,
  number,
  number,
  number,
];
const wheelStyle = css({
  position: 'relative',
  display: 'inline-block',
  blockSize: `${PITCH_EM}em`,
  overflow: 'clip',
  verticalAlign: 'bottom',
});
const sizerStyle = css({ visibility: 'hidden', lineHeight: PITCH_EM });
const stripStyle = css({ position: 'absolute', insetInlineStart: 0, insetBlockStart: 0 });
const cellStyle = css({
  display: 'block',
  blockSize: `${PITCH_EM}em`,
  lineHeight: PITCH_EM,
  whiteSpace: 'pre',
});
const replaceStyle = css({
  display: 'inline-block',
  position: 'relative',
  overflow: 'clip',
  verticalAlign: 'bottom',
  lineHeight: PITCH_EM,
});

interface ReelProps {
  text: string;
  digits?: readonly string[];
  direction: 1 | -1;
  spins: number;
  durationMs: number;
  delayMs: number;
  Glyph: ComponentType<TextMorphPartProps> | 'span';
  glyphProps?: TextMorphPartProps;
}
function GlyphCell({ text, Glyph, glyphProps }: Pick<ReelProps, 'text' | 'Glyph' | 'glyphProps'>) {
  return (
    <WithSx className={glyphProps?.className} styles={glyphProps?.css}>
      {(className) => (
        <Glyph {...glyphProps} className={className} data-ui="text-morph-glyph">
          {text}
        </Glyph>
      )}
    </WithSx>
  );
}

function DigitReel({
  text,
  digits,
  direction,
  spins,
  durationMs,
  delayMs,
  Glyph,
  glyphProps,
}: ReelProps & { digits: readonly string[] }) {
  const digit = digits.indexOf(text);
  const offset = useMotionValue(CENTER + digit);
  const y = useTransform(offset, (value) => `${-value * PITCH_EM}em`);
  const previous = useRef(text);
  useLayoutEffect(() => {
    if (previous.current === text) {
      offset.set(CENTER + digit);
      return;
    }
    previous.current = text;
    const current = offset.get();
    const fractionalDigit = ((current % DIGIT_COUNT) + DIGIT_COUNT) % DIGIT_COUNT;
    const start = CENTER + fractionalDigit;
    offset.set(start);
    const distance =
      direction === 1
        ? (digit - fractionalDigit + DIGIT_COUNT) % DIGIT_COUNT
        : -((fractionalDigit - digit + DIGIT_COUNT) % DIGIT_COUNT);
    const controller = animate(offset, start + distance + direction * spins * DIGIT_COUNT, {
      type: 'tween',
      duration: durationMs / 1000,
      delay: delayMs / 1000,
      ease: EASE,
    });
    return () => controller.stop();
  }, [text, digit, direction, spins, durationMs, delayMs, offset]);
  return (
    <span
      css={wheelStyle}
      data-ui="text-morph-reel"
      data-direction={direction === 1 ? 'up' : 'down'}
    >
      <span css={sizerStyle}>{text}</span>
      <motion.span css={stripStyle} style={{ y }}>
        {Array.from({ length: WHEEL_COPIES * DIGIT_COUNT }, (_, index) => (
          <span key={index} css={cellStyle}>
            <GlyphCell text={digits[index % DIGIT_COUNT]!} Glyph={Glyph} glyphProps={glyphProps} />
          </span>
        ))}
      </motion.span>
    </span>
  );
}

export function Reel(props: ReelProps) {
  if (props.digits?.includes(props.text)) return <DigitReel {...props} digits={props.digits} />;
  return (
    <span css={replaceStyle} data-ui="text-morph-reel">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={props.text}
          css={cellStyle}
          initial={{ y: `${props.direction * 100}%` }}
          animate={{ y: 0 }}
          exit={{ y: `${props.direction * -100}%` }}
          transition={{
            duration: props.durationMs / 1000,
            delay: props.delayMs / 1000,
            ease: EASE,
          }}
        >
          <GlyphCell text={props.text} Glyph={props.Glyph} glyphProps={props.glyphProps} />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
