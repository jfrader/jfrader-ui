import { CARD_FRAME } from '../game-card/card-frame';
import { PLAYED_PILE, getPileOffset } from './pile-layout';

interface AutoLayoutInput {
  count: number;
  width: number;
  height: number;
  preferredCardWidth: number;
  columnGap: number;
  rowGap: number;
  maxJitterPx: number;
  maxRotationOffsetDeg: number;
  maxCards: number;
}

function projection(horizontal: number, vertical: number, angle: number) {
  const peakAngle = Math.atan2(vertical, horizontal);
  const bounded = Math.min(Math.abs(angle) * Math.PI / 180, peakAngle);
  return horizontal * Math.cos(bounded) + vertical * Math.sin(bounded);
}

/** Reserve the largest inspected fan in every cell, including rotation, jitter and closed offsets. */
export function getAutoLayout(input: AutoLayoutInput) {
  const { count, width, height, preferredCardWidth, columnGap, rowGap, maxJitterPx, maxRotationOffsetDeg } = input;
  const horizontalSpread = Math.max(0, input.maxCards - 1) * PLAYED_PILE.openSpreadRatio;
  const widthRatio = PLAYED_PILE.openScale *
    (horizontalSpread + projection(1, CARD_FRAME.ratio, maxRotationOffsetDeg));
  const heightRatio = PLAYED_PILE.openScale * projection(CARD_FRAME.ratio, 1, maxRotationOffsetDeg);
  const edgeJitter = Math.abs(maxJitterPx) * 2;
  const closedOffset = getClosedEnvelope(input.maxCards);
  const verticalOffset = getOpenEnvelope(input.maxCards);
  let best = { columns: 1, rows: Math.max(1, count), cardWidth: 0, capacity: 0 };
  for (let columns = 1; columns <= Math.max(1, count); columns++) {
    const rows = Math.max(1, Math.ceil(count / columns));
    const cellWidth = (width - columnGap * (columns - 1)) / columns;
    const cellHeight = (height - rowGap * (rows - 1)) / rows;
    const capacity = Math.max(0, Math.min(
      (cellWidth - edgeJitter - closedOffset) / widthRatio,
      (cellHeight - edgeJitter - verticalOffset) / heightRatio,
    ));
    if (capacity > best.capacity) best = { columns, rows, capacity, cardWidth: Math.min(preferredCardWidth, capacity) };
  }
  return { columns: best.columns, rows: best.rows, cardWidth: best.cardWidth };
}

function getClosedEnvelope(total: number) {
  const edge = getPileOffset({ index: 0, total, open: false, openSpreadRatio: PLAYED_PILE.openSpreadRatio });
  return Math.abs(edge.xPx) * 2;
}

function getOpenEnvelope(total: number) {
  const edge = getPileOffset({ index: 0, total, open: true, openSpreadRatio: PLAYED_PILE.openSpreadRatio });
  return Math.abs(edge.y) * 2;
}
