import type { BoardLayoutModel, BoardSurface, BoardViewport } from './types';
import { buildSeatGeometries, mergeSeatConfig } from './geometry';
import { normalizeBoardPlayerCount, resolveBoardViewportProfile } from './viewport';
import { DEFAULT_SEAT_CONFIG, FRAMES, LOBBY_SEATS, MATCH_SEATS, MATCH_SEAT_OVERRIDES, BOARD_TRANSLATE_Y } from './layout-config';

export const buildBoardLayoutModel = ({ surface, totalSeats, viewport }: {
  surface: BoardSurface;
  totalSeats: number;
  viewport: BoardViewport;
}): BoardLayoutModel => {
  const profile = resolveBoardViewportProfile(viewport);
  const playerCount = normalizeBoardPlayerCount(totalSeats);
  const baseFrame = FRAMES[profile];
  const frame = surface === 'lobby' && profile === 'phoneWide'
    ? { ...baseFrame, boardAspectRatio: '1 / 1', boardBorderRadius: '50%', boardInnerBorderRadius: '50%',
      boardHeight: 'auto', seatWidth: '35%', seatMaxWidth: '11.7rem' }
    : baseFrame;
  const seatConfig = surface === 'match'
    ? mergeSeatConfig(MATCH_SEATS[profile], MATCH_SEAT_OVERRIDES[playerCount])
    : LOBBY_SEATS[profile][playerCount] || mergeSeatConfig(DEFAULT_SEAT_CONFIG);
  return {
    surface, profile, playerCount, viewport, frame, seatConfig,
    boardTranslateY: surface === 'match' ? BOARD_TRANSLATE_Y[profile] : '0rem',
    seatGeometries: buildSeatGeometries({ totalSeats: Math.max(totalSeats, 2), config: seatConfig }),
  };
};
