import type { BoardLayoutModel, BoardSurface, BoardViewport, MatchSeatPresentation } from './types';
import { buildSeatGeometries, mergeSeatConfig } from './geometry';
import { normalizeBoardPlayerCount, resolveBoardViewportProfile } from './viewport';
import {
  DEFAULT_HIDDEN_HAND_RADIAL_RULES, DEFAULT_SEAT_CONFIG, DEFAULT_TABLE_POINTS_PLACEMENT_RULES,
  FRAMES, LOBBY_SEATS, MATCH_PRESENTATIONS, MATCH_SEATS, MATCH_SEAT_OVERRIDES,
} from './layout-config';

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
    seatGeometries: buildSeatGeometries({ totalSeats: Math.max(totalSeats, 2), config: seatConfig }),
    match: surface === 'match' ? { seatPresentation: MATCH_PRESENTATIONS[profile] } : null,
  };
};

export const getMatchSeatPresentationForIndex = ({ layout, seatIndex, isMe }: {
  layout: BoardLayoutModel;
  seatIndex: number;
  isMe: boolean;
}): MatchSeatPresentation => {
  if (!layout.match) {
    return { avatarFrameSizePx: 56, translateY: 0, avatarNudgeY: 0,
      hiddenHandCardWidth: 'clamp(1.82rem, 5.1vw, 2.02rem)', hiddenHandScale: 1,
      hiddenHandRules: { ...DEFAULT_HIDDEN_HAND_RADIAL_RULES }, tablePoints: { ...DEFAULT_TABLE_POINTS_PLACEMENT_RULES } };
  }
  const { seatPresentation } = layout.match;
  const isLowerSideSeat = layout.playerCount === 6 && (seatIndex === 1 || seatIndex === 5);
  const isTopSeat = seatIndex === layout.seatGeometries.length / 2;
  const translateY = isMe ? seatPresentation.meTranslateY : isLowerSideSeat ? seatPresentation.lowerSideTranslateY : 0;
  const avatarNudgeBlocked = seatPresentation.hideTopSeatAvatarNudgeOnProfiles.includes(layout.profile);
  return {
    avatarFrameSizePx: seatPresentation.avatarFrameSizePx, translateY,
    avatarNudgeY: isTopSeat && !avatarNudgeBlocked ? seatPresentation.topSeatAvatarNudgeY : 0,
    hiddenHandCardWidth: seatPresentation.hiddenHandCardWidth, hiddenHandScale: seatPresentation.hiddenHandScale,
    hiddenHandRules: seatPresentation.hiddenHandRules,
    tablePoints: { ...DEFAULT_TABLE_POINTS_PLACEMENT_RULES, ...(seatPresentation.tablePoints || {}) },
  };
};
