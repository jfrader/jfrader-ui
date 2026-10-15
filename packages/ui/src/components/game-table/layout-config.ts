import { vars } from '@jfrader/tokens/vars';
import type { BoardSurfaceFrameConfig, BoardViewportProfile } from './types';

const space = (scale: number) => `calc(${vars.space[4]}*${scale})`;
const availableWidth = (inset: number) => `calc(100% - ${space(inset)})`;

// Percentages and aspect ratios are geometry. Lengths scale with the spacing token.
// Profiles choose the surface frame, never individual seat positions or content sizes.
const PHONE_TALL_FRAME: BoardSurfaceFrameConfig = {
  rootPadding: `${space(0.5)} ${space(0.22)} ${space(0.78)}`, shellMaxWidth: space(56), topStripGap: space(0.78),
  topStripMarginBottom: space(0.42), bottomStripMarginTop: space(0.42),
  boardWidth: `min(${availableWidth(0.45)}, ${space(56)})`, boardMaxWidth: availableWidth(0.45),
  boardHeight: `min(88%, ${space(41)})`, boardMaxHeight: '54vh', boardAspectRatio: 'auto',
  boardBorderRadius: '50% / 48%', boardInnerBorderRadius: '50% / 48%',
  boardBorderWidth: space(0.72), boardOutlineWidth: space(0.22), centerSize: '53%',
  seatWidth: '34%', seatMaxWidth: space(11.5),
};

export const FRAMES: Record<BoardViewportProfile, BoardSurfaceFrameConfig> = {
  phoneTall: PHONE_TALL_FRAME,
  phoneCompact: { ...PHONE_TALL_FRAME, boardHeight: 'auto', boardMaxHeight: '62vh', boardAspectRatio: '1 / 1.14', topStripGap: space(0.66), topStripMarginBottom: space(0.3) },
  phoneWide: {
    rootPadding: `${space(0.55)} ${space(0.25)} ${space(0.95)}`, shellMaxWidth: space(56), topStripGap: space(0.82),
    topStripMarginBottom: space(0.52), bottomStripMarginTop: space(0.5),
    boardWidth: 'auto', boardMaxWidth: availableWidth(1.5), boardHeight: `min(100%, ${space(18)})`,
    boardMaxHeight: space(18), boardAspectRatio: '2.15 / 1', boardBorderRadius: '50% / 48%',
    boardInnerBorderRadius: '50% / 48%', boardBorderWidth: space(0.72), boardOutlineWidth: space(0.22),
    centerSize: '52%', seatWidth: '33%', seatMaxWidth: space(11.2),
  },
  tablet: {
    rootPadding: `${space(0.86)} ${space(0.35)} ${space(1.12)}`, shellMaxWidth: space(56), topStripGap: space(0.92),
    topStripMarginBottom: space(0.7), bottomStripMarginTop: space(0.82),
    boardWidth: '108%', boardMaxWidth: space(46), boardHeight: 'auto', boardMaxHeight: space(34),
    boardAspectRatio: '1 / 1', boardBorderRadius: '50%', boardInnerBorderRadius: '50%',
    boardBorderWidth: space(0.9), boardOutlineWidth: space(0.24), centerSize: '55%', seatWidth: '35%', seatMaxWidth: space(11.8),
  },
  tabletWide: {
    rootPadding: `${space(1)} ${space(0.45)} ${space(1.2)}`, shellMaxWidth: space(56), topStripGap: space(0.94),
    topStripMarginBottom: space(0.72), bottomStripMarginTop: space(0.9),
    boardWidth: `min(${availableWidth(2.2)}, ${space(47)})`, boardMaxWidth: availableWidth(2.2),
    boardHeight: `min(60vh, ${space(39.5)})`, boardMaxHeight: space(41), boardAspectRatio: '1.2 / 1',
    boardBorderRadius: '50% / 48.6%', boardInnerBorderRadius: '50% / 48.6%',
    boardBorderWidth: space(0.86), boardOutlineWidth: space(0.23), centerSize: '53%', seatWidth: '34%', seatMaxWidth: space(11.5),
  },
  desktop: {
    rootPadding: `${space(1)} ${space(0.6)} ${space(1.35)}`, shellMaxWidth: space(56), topStripGap: space(1),
    topStripMarginBottom: space(0.72), bottomStripMarginTop: space(0.92),
    boardWidth: `min(${availableWidth(1.5)}, ${space(50)})`, boardMaxWidth: availableWidth(1.5),
    boardHeight: `min(56vh, ${space(38)})`, boardMaxHeight: '56vh', boardAspectRatio: '1.38 / 1',
    boardBorderRadius: '50% / 48.6%', boardInnerBorderRadius: '50% / 48.6%',
    boardBorderWidth: space(0.9), boardOutlineWidth: space(0.24), centerSize: '54%', seatWidth: '33%', seatMaxWidth: space(11.8),
  },
};
