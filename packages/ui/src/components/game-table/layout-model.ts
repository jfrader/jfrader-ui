import type { BoardLayoutModel, BoardSurface } from './types';
import { buildSeatGeometries } from './geometry';
import type { BoardMeasurements } from './fit-layout';
import { resolveSeatCount } from './table-slots';

export const buildBoardLayoutModel = ({ surface, totalSeats, measurement }: {
  surface: BoardSurface;
  totalSeats: number;
  measurement?: BoardMeasurements;
}): BoardLayoutModel => {
  const playerCount = resolveSeatCount(totalSeats);
  const { fitted, seatGeometries } = buildSeatGeometries(playerCount, measurement);
  const seatConfig = { radiusX: fitted?.radiusX ?? 0, radiusY: fitted?.radiusY ?? 0,
    playRadiusX: fitted?.playRadiusX ?? 0, playRadiusY: fitted?.playRadiusY ?? 0,
    scale: fitted?.scale ?? 1, centerScale: fitted?.centerScale ?? 1, gap: fitted?.gap ?? 0 };
  let fit: BoardLayoutModel['fit'] = 'measuring';
  if (fitted) fit = !fitted.fits ? 'insufficient-space' : fitted.scale < 1 ? 'scaled' : 'fitted';
  return {
    surface, playerCount, seatConfig, fit, seatGeometries,
  };
};
