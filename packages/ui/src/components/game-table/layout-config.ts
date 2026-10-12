import type {
  BoardPlayerCount, BoardSeatGeometryConfig, BoardSurfaceFrameConfig, BoardViewportProfile,
} from './types';

export const DEFAULT_SEAT_CONFIG: BoardSeatGeometryConfig = {
  radiusXMultiplier: 1, radiusYMultiplier: 1, sideWeightedYMultiplier: false,
  outwardOffsetX: 0, outwardOffsetY: 0, sideInset: 0, sideVerticalOffset: 0,
  angleOffsetDeg: 0, sideAngleOffsetDeg: 0, topGroupShiftYPx: 0, bottomGroupShiftYPx: 0,
};

export const MATCH_SEAT_OVERRIDES: Partial<Record<BoardPlayerCount, Partial<BoardSeatGeometryConfig>>> = {
  2: { angleOffsetDeg: -14, sideAngleOffsetDeg: -14 },
  4: { angleOffsetDeg: -16, sideAngleOffsetDeg: -22 },
};

const PHONE_TALL_FRAME: BoardSurfaceFrameConfig = {
  rootPadding: '0.5rem 0.22rem 0.78rem', shellMaxWidth: '56rem', topStripGap: '0.78rem',
  topStripMarginBottom: '0.42rem', bottomStripMarginTop: '0.42rem',
  boardWidth: 'min(calc(100% - 0.45rem), 56rem)', boardMaxWidth: 'calc(100% - 0.45rem)',
  boardHeight: 'min(88%, 41rem)', boardMaxHeight: '54vh', boardAspectRatio: 'auto',
  boardBorderRadius: '50% / 48%', boardInnerBorderRadius: '50% / 48%',
  boardBorderWidth: '0.72rem', boardOutlineWidth: '0.22rem', centerSize: '53%',
  seatWidth: '34%', seatMaxWidth: '11.5rem',
};

export const FRAMES: Record<BoardViewportProfile, BoardSurfaceFrameConfig> = {
  phoneTall: PHONE_TALL_FRAME,
  phoneCompact: { ...PHONE_TALL_FRAME, boardHeight: 'auto', boardMaxHeight: '62vh', boardAspectRatio: '1 / 1.14', topStripGap: '0.66rem', topStripMarginBottom: '0.3rem' },
  phoneWide: {
    rootPadding: '0.55rem 0.25rem 0.95rem', shellMaxWidth: '56rem', topStripGap: '0.82rem',
    topStripMarginBottom: '0.52rem', bottomStripMarginTop: '0.5rem',
    boardWidth: 'auto', boardMaxWidth: 'calc(100% - 1.5rem)', boardHeight: 'min(100%, 18rem)',
    boardMaxHeight: '18rem', boardAspectRatio: '2.15 / 1', boardBorderRadius: '50% / 48%',
    boardInnerBorderRadius: '50% / 48%', boardBorderWidth: '0.72rem', boardOutlineWidth: '0.22rem',
    centerSize: '52%', seatWidth: '33%', seatMaxWidth: '11.2rem',
  },
  tablet: {
    rootPadding: '0.86rem 0.35rem 1.12rem', shellMaxWidth: '56rem', topStripGap: '0.92rem',
    topStripMarginBottom: '0.7rem', bottomStripMarginTop: '0.82rem',
    boardWidth: '108%', boardMaxWidth: '46rem', boardHeight: 'auto', boardMaxHeight: '34rem',
    boardAspectRatio: '1 / 1', boardBorderRadius: '50%', boardInnerBorderRadius: '50%',
    boardBorderWidth: '0.9rem', boardOutlineWidth: '0.24rem', centerSize: '55%', seatWidth: '35%', seatMaxWidth: '11.8rem',
  },
  tabletWide: {
    rootPadding: '1rem 0.45rem 1.2rem', shellMaxWidth: '56rem', topStripGap: '0.94rem',
    topStripMarginBottom: '0.72rem', bottomStripMarginTop: '0.9rem',
    boardWidth: 'min(calc(100% - 2.2rem), 47rem)', boardMaxWidth: 'calc(100% - 2.2rem)',
    boardHeight: 'min(60vh, 39.5rem)', boardMaxHeight: '41rem', boardAspectRatio: '1.2 / 1',
    boardBorderRadius: '50% / 48.6%', boardInnerBorderRadius: '50% / 48.6%',
    boardBorderWidth: '0.86rem', boardOutlineWidth: '0.23rem', centerSize: '53%', seatWidth: '34%', seatMaxWidth: '11.5rem',
  },
  desktop: {
    rootPadding: '1rem 0.6rem 1.35rem', shellMaxWidth: '56rem', topStripGap: '1rem',
    topStripMarginBottom: '0.72rem', bottomStripMarginTop: '0.92rem',
    boardWidth: 'min(calc(100% - 1.5rem), 50rem)', boardMaxWidth: 'calc(100% - 1.5rem)',
    boardHeight: 'min(56vh, 38rem)', boardMaxHeight: '56vh', boardAspectRatio: '1.38 / 1',
    boardBorderRadius: '50% / 48.6%', boardInnerBorderRadius: '50% / 48.6%',
    boardBorderWidth: '0.9rem', boardOutlineWidth: '0.24rem', centerSize: '54%', seatWidth: '33%', seatMaxWidth: '11.8rem',
  },
};

export const BOARD_TRANSLATE_Y: Record<BoardViewportProfile, string> = {
  phoneCompact: '0rem', phoneTall: '-0.65rem', phoneWide: '-0.45rem',
  tablet: '0rem', tabletWide: '0rem', desktop: '0rem',
};

const PHONE_TALL_SEAT: BoardSeatGeometryConfig = {
  ...DEFAULT_SEAT_CONFIG, outwardOffsetX: 3, outwardOffsetY: 6, sideInset: 3.4,
  sideVerticalOffset: 1.8, topGroupShiftYPx: 28, bottomGroupShiftYPx: 24,
};
export const MATCH_SEATS: Record<BoardViewportProfile, BoardSeatGeometryConfig> = {
  phoneTall: PHONE_TALL_SEAT,
  phoneCompact: { ...PHONE_TALL_SEAT, outwardOffsetY: 3, topGroupShiftYPx: 0, bottomGroupShiftYPx: 8 },
  phoneWide: {
    ...DEFAULT_SEAT_CONFIG, radiusYMultiplier: 0.96, outwardOffsetX: 2, outwardOffsetY: 4,
    sideInset: 2.8, sideVerticalOffset: 1.2, topGroupShiftYPx: 20, bottomGroupShiftYPx: 18,
  },
  tablet: {
    ...DEFAULT_SEAT_CONFIG, radiusXMultiplier: 1.07, radiusYMultiplier: 1.08,
    outwardOffsetX: 6, outwardOffsetY: 12, sideInset: 5.1, sideVerticalOffset: 3.2,
  },
  tabletWide: {
    ...DEFAULT_SEAT_CONFIG, radiusXMultiplier: 1.09, radiusYMultiplier: 1.08,
    outwardOffsetX: 5, outwardOffsetY: 11, sideInset: 4.9, sideVerticalOffset: 3,
  },
  desktop: {
    ...DEFAULT_SEAT_CONFIG, radiusXMultiplier: 1.1, radiusYMultiplier: 1.12,
    outwardOffsetX: 4, outwardOffsetY: 10, sideInset: 4.5, sideVerticalOffset: 2.8,
  },
};

const PHONE_LOBBY_SIX: BoardSeatGeometryConfig = {
  ...DEFAULT_SEAT_CONFIG, radiusXMultiplier: 0.94, radiusYMultiplier: 1.1, sideWeightedYMultiplier: true,
  sideInset: 3.8, sideVerticalOffset: 14, topGroupShiftYPx: 34, bottomGroupShiftYPx: 34,
};
const PHONE_LOBBY_FOUR: BoardSeatGeometryConfig = {
  ...DEFAULT_SEAT_CONFIG, radiusXMultiplier: 1.03, radiusYMultiplier: 1.08,
  outwardOffsetX: 2, outwardOffsetY: 6.5, sideInset: 2.8, angleOffsetDeg: -45,
  topGroupShiftYPx: 54, bottomGroupShiftYPx: 48,
};
const WIDE_LOBBY_FOUR: BoardSeatGeometryConfig = {
  ...DEFAULT_SEAT_CONFIG, radiusXMultiplier: 1.02, radiusYMultiplier: 1.04,
  outwardOffsetX: 1.5, outwardOffsetY: 4.5, sideInset: 2.4, angleOffsetDeg: -45,
  topGroupShiftYPx: 44, bottomGroupShiftYPx: 40,
};
const DESKTOP_SPARSE_LOBBY_SEAT = { ...DEFAULT_SEAT_CONFIG, outwardOffsetY: 32 };
export const LOBBY_SEATS: Record<BoardViewportProfile, Partial<Record<BoardPlayerCount, BoardSeatGeometryConfig>>> = {
  phoneCompact: { 4: PHONE_LOBBY_FOUR, 6: PHONE_LOBBY_SIX },
  phoneTall: { 4: PHONE_LOBBY_FOUR, 6: PHONE_LOBBY_SIX },
  phoneWide: { 4: WIDE_LOBBY_FOUR, 6: PHONE_LOBBY_SIX },
  tablet: {
    4: PHONE_LOBBY_FOUR,
    6: { ...DEFAULT_SEAT_CONFIG, radiusXMultiplier: 0.96, radiusYMultiplier: 1.05,
      sideWeightedYMultiplier: true, sideInset: 3.3, sideVerticalOffset: 2.4, topGroupShiftYPx: 34, bottomGroupShiftYPx: 34 },
  },
  tabletWide: {
    4: WIDE_LOBBY_FOUR,
    6: { ...DEFAULT_SEAT_CONFIG, radiusXMultiplier: 0.98, radiusYMultiplier: 1.03,
      sideWeightedYMultiplier: true, sideInset: 2.8, sideVerticalOffset: 2, topGroupShiftYPx: 24, bottomGroupShiftYPx: 24 },
  },
  desktop: {
    2: DESKTOP_SPARSE_LOBBY_SEAT, 4: DESKTOP_SPARSE_LOBBY_SEAT,
    6: { ...DEFAULT_SEAT_CONFIG, radiusYMultiplier: 1.02, sideWeightedYMultiplier: true,
      outwardOffsetY: 44, sideInset: 2.6, sideVerticalOffset: 1.8, topGroupShiftYPx: -22, bottomGroupShiftYPx: -22 },
  },
};
