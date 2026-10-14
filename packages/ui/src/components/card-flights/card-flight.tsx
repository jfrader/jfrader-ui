'use client';

import { useLayoutEffect, useRef } from 'react';
import { animate } from 'motion/mini';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { CARD_FRAME } from '../game-card/card-frame';
import { GameCard } from '../game-card';
import { FLIGHT_GEOMETRY as config } from './geometry';
import type { CardFlightSpec } from './card-flights';

const bodyStyle = css({
  position: 'fixed', left: 0, top: 0, pointerEvents: 'none', zIndex: vars.zIndex.cardFlight,
  perspective: `${config.perspectivePx}px`,
});
const shadowStyle = css({ position: 'absolute', inset: 0, boxShadow: vars.shadow.cardFlight, opacity: 0 });
const rotatorStyle = css({ position: 'relative', inlineSize: '100%', blockSize: '100%', transformStyle: 'preserve-3d' });
const faceStyle = css({
  position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
  '& > [data-ui~="game-card"]': { inlineSize: '100%', blockSize: '100%' },
});
const backStyle = css({ transform: 'rotateY(180deg)' });
const pose = (x: number, y: number, rotate: number, scale: number) =>
  `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${scale})`;

export function CardFlight({ flightId, spec, onStart, onFinish }: {
  flightId: number; spec: CardFlightSpec; onStart?: (cancel: () => void) => void; onFinish: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const turnRef = useRef<HTMLDivElement>(null);
  const { from, to, face, durationMs, delayMs = 0, card } = spec;
  const front = spec.front ?? card?.front ?? (card && <GameCard label={card.label} value={card.value} />);
  const back = spec.back ?? card?.back ?? (card && <GameCard label={card.label} value={card.value} face="back" backPattern={card.backPattern} />);
  const start = pose(from.cx - to.width / 2, from.cy - to.height / 2, from.rotate, from.width / to.width);
  // Only a new launch identity restarts tracks; equivalent spec objects do not.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const shadow = shadowRef.current;
    const turn = turnRef.current;
    if (!body || !shadow || !turn) return;
    body.style.display = '';
    if (typeof body.animate !== 'function' || durationMs <= 0) {
      onFinish();
      return;
    }
    const x = from.cx - to.width / 2;
    const y = from.cy - to.height / 2;
    const endX = to.cx - to.width / 2;
    const endY = to.cy - to.height / 2;
    const lift = Math.min(config.maxLiftPx, Math.hypot(endX - x, endY - y) * config.liftRatio);
    const options = { duration: durationMs / 1000, delay: delayMs / 1000, ease: config.easing, times: config.offsets };
    const travel = animate(body, { transform: [
      start,
      pose((x + endX) / 2, Math.min(y, endY) - lift, (from.rotate + to.rotate) / 2 + (face === 'reveal' ? config.spinDeg : 0), config.peakScale),
      pose(endX, endY, to.rotate, 1),
    ] }, options);
    const lifted = animate(shadow, {
      opacity: [0, 1 - lift / (config.maxLiftPx * config.shadowFadeRatio), 0],
      transform: ['scale(1)', `scale(${config.peakScale})`, 'scale(1)'],
    }, options);
    const departure = body.animate({ visibility: ['visible', 'visible'] }, {
      duration: durationMs, delay: delayMs, fill: 'forwards',
    });
    const flip = face === 'reveal' ? animate(turn, { transform: ['rotateY(180deg)', 'rotateY(0deg)'] }, {
      duration: options.duration * config.flipDurationRatio,
      delay: options.delay + options.duration * config.flipDelayRatio, ease: 'easeInOut',
    }) : null;
    let active = true;
    const cancel = () => {
      active = false;
      // Remove the painted flight before restoring its destination or starting a replacement.
      body.style.display = 'none';
      travel.cancel(); lifted.cancel(); flip?.cancel(); departure.cancel();
    };
    onStart?.(cancel);
    void Promise.all([travel, lifted, flip, departure.finished]).then(() => {
      if (active) { body.style.display = 'none'; onFinish(); }
    }).catch(() => { if (active) { cancel(); onFinish(); } });
    return cancel;
  }, [flightId]);
  return <div ref={bodyRef} css={bodyStyle} aria-hidden="true" data-ui="card-flight"
    data-flight-target={spec.target} style={{ width: to.width, height: to.height, transform: start, visibility: 'hidden' }}>
    <div ref={shadowRef} css={shadowStyle} data-ui="card-flight-shadow" style={{ borderRadius: to.width / CARD_FRAME.cornerDivisor }} />
    <div ref={turnRef} css={rotatorStyle} data-ui="card-flight-turn" style={{ transform: face === 'up' ? 'none' : 'rotateY(180deg)' }}>
      <div css={faceStyle}>{face !== 'down' && front}</div>
      <div css={[faceStyle, backStyle]}>{back}</div>
    </div>
  </div>;
}
