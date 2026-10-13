import { buildBoardLayoutModel, type BoardPlayerCount, type BoardViewportProfile } from '../game-table';
import { DEFAULT_TRICK_LAYOUT, type TrickLayout } from './trick-layout';

type CenterProfile = {
  overrides: Partial<TrickLayout>;
  overridesByPlayerCount?: Partial<Record<BoardPlayerCount, Partial<TrickLayout>>>;
  spreadBoost: number;
  widths: Record<BoardPlayerCount, string>;
};

// Literal match.center + match.playedCards fields from the reference's
// packages/core/src/board/config/breakpoints/*.ts. Seat geometry is already ported by GameTable.
const profiles: Record<BoardViewportProfile, CenterProfile> = {
  phoneCompact: {
    overrides: { centerShiftXPercent: 0, centerShiftYPercent: 0, playerSpreadXPercent: 31, playerSpreadYPercent: 25, maxJitterPx: 2 },
    overridesByPlayerCount: {
      2: { centerShiftYPercent: 6, playerSpreadYPercent: 30.5 },
      6: { playerSpreadXPercent: 34, playerSpreadYPercent: 28 },
    },
    spreadBoost: 3,
    widths: { 2: 'clamp(54px, 14vw, 58px)', 4: 'clamp(46px, 12vw, 52px)', 6: 'clamp(42px, 11vw, 48px)' },
  },
  phoneTall: {
    overrides: { centerShiftXPercent: 0, centerShiftYPercent: 0, playerSpreadXPercent: 31, playerSpreadYPercent: 25, maxJitterPx: 2 },
    overridesByPlayerCount: {
      2: { centerShiftYPercent: 3.5, playerSpreadYPercent: 31 },
      6: { playerSpreadXPercent: 34, playerSpreadYPercent: 28 },
    },
    spreadBoost: 3,
    widths: { 2: 'clamp(58px, 15vw, 64px)', 4: 'clamp(52px, 13.5vw, 58px)', 6: 'clamp(48px, 12.5vw, 54px)' },
  },
  phoneWide: {
    overrides: { centerShiftXPercent: 0, centerShiftYPercent: 0, playerSpreadXPercent: 36, playerSpreadYPercent: 32, maxJitterPx: 1, maxRotationOffsetDeg: 2 },
    spreadBoost: 1.2,
    widths: { 2: 'clamp(19px, 5.6dvh, 22px)', 4: 'clamp(17px, 5dvh, 20px)', 6: 'clamp(15px, 4.4dvh, 18px)' },
  },
  tablet: {
    overrides: { playerSpreadXPercent: 36, playerSpreadYPercent: 33 },
    spreadBoost: 0,
    widths: { 2: 'clamp(62px, 8vw, 72px)', 4: 'clamp(56px, 7vw, 64px)', 6: 'clamp(50px, 6.5vw, 58px)' },
  },
  tabletWide: {
    overrides: { playerSpreadXPercent: 36, playerSpreadYPercent: 34 },
    spreadBoost: 1,
    widths: { 2: 'clamp(64px, 6.8vw, 74px)', 4: 'clamp(58px, 6.2vw, 68px)', 6: 'clamp(52px, 5.6vw, 62px)' },
  },
  desktop: {
    overrides: { playerSpreadXPercent: 37, playerSpreadYPercent: 34 },
    overridesByPlayerCount: { 2: { playerSpreadYPercent: 30 }, 6: { playerSpreadYPercent: 32, sideVerticalSpreadBoost: 20 } },
    spreadBoost: 1,
    widths: { 2: 'clamp(66px, 4.8vw, 76px)', 4: 'clamp(60px, 4.4vw, 70px)', 6: 'clamp(54px, 4vw, 64px)' },
  },
};

// config/defaults.ts/MATCH_CENTER_OVERRIDES_BY_PLAYER_COUNT, merged before profile count overrides.
const playerOverrides: Partial<Record<BoardPlayerCount, Partial<TrickLayout>>> = {
  6: { sideVerticalSpreadBoost: 7 },
};

export function getReferenceLayout(totalSeats: number, viewport: { width: number; height: number }) {
  const board = buildBoardLayoutModel({ surface: 'match', totalSeats,
    viewport: { ...viewport, aspectRatio: viewport.width / Math.max(viewport.height, 1) } });
  const profile = profiles[board.profile];
  return {
    profile: board.profile,
    geometry: board.seatGeometries,
    cardWidth: profile.widths[board.playerCount],
    centerStack: {
      ...DEFAULT_TRICK_LAYOUT,
      ...profile.overrides,
      ...playerOverrides[board.playerCount],
      ...profile.overridesByPlayerCount?.[board.playerCount],
      spreadBoost: profile.spreadBoost,
    },
  };
}
