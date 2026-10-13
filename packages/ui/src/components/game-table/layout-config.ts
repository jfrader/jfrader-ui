import type { BoardSurfaceFrameConfig, BoardViewportProfile } from './types';

// Profiles choose the surface frame, never individual seat positions or content sizes.
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
