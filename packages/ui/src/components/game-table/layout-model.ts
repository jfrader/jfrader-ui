import type { BoardLayoutModel, BoardSurface, BoardViewport } from './types';
import { buildSeatGeometries } from './geometry';
import type { BoardMeasurements } from './fit-layout';
import { resolveSeatCount, resolveBoardViewportProfile } from './viewport';
import { FRAMES } from './layout-config';

export const buildBoardLayoutModel = ({ surface, totalSeats, viewport, measurement }: {
  surface: BoardSurface;
  totalSeats: number;
  viewport: BoardViewport;
  measurement?: BoardMeasurements;
}): BoardLayoutModel => {
  const profile = resolveBoardViewportProfile(viewport);
  const playerCount = resolveSeatCount(totalSeats);
  const baseFrame = FRAMES[profile];
  const frame = surface === 'lobby' && profile === 'phoneWide'
    ? { ...baseFrame, boardAspectRatio: '1 / 1', boardBorderRadius: '50%', boardInnerBorderRadius: '50%',
      boardHeight: 'auto', seatWidth: '35%', seatMaxWidth: '11.7rem' }
    : baseFrame;
  const { fitted, seatGeometries } = buildSeatGeometries(playerCount, measurement);
  const seatConfig = { radiusX: fitted?.radiusX ?? 0, radiusY: fitted?.radiusY ?? 0,
    playRadiusX: fitted?.playRadiusX ?? 0, playRadiusY: fitted?.playRadiusY ?? 0,
    scale: fitted?.scale ?? 1, centerScale: fitted?.centerScale ?? 1, gap: fitted?.gap ?? 0 };
  let fit: BoardLayoutModel['fit'] = 'measuring';
  if (fitted) fit = fitted.fits ? 'fitted' : 'insufficient-space';
  return {
    surface, profile, playerCount, viewport, frame, seatConfig, fit,
    boardTranslateY: '0rem', seatGeometries,
  };
};
