/** The seat after yours appears on the right or the left. */
export type TableTurnDirection = 'clockwise' | 'counterclockwise';

export type SeatLike = { key: string; teamIdx: 0 | 1; isMe?: boolean };
export type GameTableSlot<T extends SeatLike = SeatLike> = {
  key: string;
  teamIdx: 0 | 1;
  player: T | null;
};

export function validateSeatKeys(seats: readonly SeatLike[]) {
  const keys = new Set<string>();
  for (const seat of seats) {
    if (!seat.key || keys.has(seat.key)) throw new Error(`GameTable requires unique, nonempty player keys: "${seat.key}".`);
    keys.add(seat.key);
  }
}

export function validateSlots(slots: readonly GameTableSlot[]) {
  const keys = new Set<string>();
  for (const slot of slots) {
    if (!slot.key || keys.has(slot.key)) throw new Error(`GameTable requires unique, nonempty slot keys: "${slot.key}".`);
    keys.add(slot.key);
  }
  validateSeatKeys(slots.flatMap((slot) => slot.player ? [slot.player] : []));
}

export const resolveTableTurnDirection = (value?: string): TableTurnDirection =>
  value === 'clockwise' ? 'clockwise' : 'counterclockwise';

const applyTableTurnDirection = <T extends SeatLike>(slots: GameTableSlot<T>[], direction: TableTurnDirection) => {
  const [first, ...rest] = slots;
  return direction === 'clockwise' || first === undefined ? slots : [first, ...rest.reverse()];
};

export const buildTableOrderSlots = <T extends SeatLike>(
  players: readonly T[],
  direction: TableTurnDirection,
): GameTableSlot<T>[] => {
  validateSeatKeys(players);
  const slots = players.map((player) => ({ key: player.key, teamIdx: player.teamIdx, player }));
  const meIndex = slots.findIndex((slot) => slot.player.isMe);
  const rotatedSlots = meIndex > 0 ? [...slots.slice(meIndex), ...slots.slice(0, meIndex)] : slots;
  return applyTableTurnDirection(rotatedSlots, direction);
};

export const buildAlternatingSlots = <T extends SeatLike>(
  players: readonly T[],
  fill: number | undefined,
  direction: TableTurnDirection,
): GameTableSlot<T>[] => {
  validateSeatKeys(players);
  const length = Math.max(fill && players.length < fill ? fill : players.length, 2);
  const teamPlayers: Record<0 | 1, T[]> = { 0: [], 1: [] };
  players.forEach((player) => teamPlayers[player.teamIdx].push(player));
  for (const teamIdx of [0, 1] as const) {
    const capacity = teamIdx === 0 ? Math.ceil(length / 2) : Math.floor(length / 2);
    if (teamPlayers[teamIdx].length > capacity) {
      throw new Error(`GameTable alternating team ${teamIdx} capacity is ${capacity}; received ${teamPlayers[teamIdx].length} players. Use slots for arbitrary orders.`);
    }
  }
  const keys = new Set(players.map((player) => player.key));
  const teamIndex: Record<0 | 1, number> = { 0: 0, 1: 0 };
  const slots = Array.from({ length }, (_, i): GameTableSlot<T> => {
    const teamIdx = (i % 2) as 0 | 1;
    const player = teamPlayers[teamIdx][teamIndex[teamIdx]] || null;
    if (player) teamIndex[teamIdx] += 1;
    let key = player?.key ?? `slot-${i}`;
    if (!player) {
      while (keys.has(key)) key += '-empty';
      keys.add(key);
    }
    return { key, teamIdx, player };
  });
  const meIndex = slots.findIndex((slot) => slot.player?.isMe);
  const rotatedSlots = meIndex > 0 ? [...slots.slice(meIndex), ...slots.slice(0, meIndex)] : slots;
  return applyTableTurnDirection(rotatedSlots, direction);
};

export const getTablePointSeatIndexes = <T extends SeatLike>(slots: readonly GameTableSlot<T>[]) => {
  const mySeatIndex = slots.findIndex((slot) => Boolean(slot.player?.isMe));
  const bottomLeaderSeatIndex = mySeatIndex >= 0 ? mySeatIndex : slots.findIndex((slot) => Boolean(slot.player));
  if (bottomLeaderSeatIndex < 0 || !slots.length) {
    return { bottomLeaderSeatIndex: -1, frontLeaderSeatIndex: -1 };
  }
  const bottomSlot = slots[bottomLeaderSeatIndex];
  if (!bottomSlot) return { bottomLeaderSeatIndex: -1, frontLeaderSeatIndex: -1 };
  const bottomTeamIdx = bottomSlot.teamIdx;
  const oppositeSeatIndex = (bottomLeaderSeatIndex + Math.floor(slots.length / 2)) % slots.length;
  const oppositeSlot = slots[oppositeSeatIndex];
  const frontLeaderSeatIndex = oppositeSlot?.player && oppositeSlot.teamIdx !== bottomTeamIdx
    ? oppositeSeatIndex
    : slots.findIndex((slot) => Boolean(slot.player) && slot.teamIdx !== bottomTeamIdx);
  return { bottomLeaderSeatIndex, frontLeaderSeatIndex };
};
