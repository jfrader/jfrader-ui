/** Validates a seat count and returns it. Any integer >= 2 is a valid table. */
export const resolveSeatCount = (totalSeats: number): number => {
  if (!Number.isInteger(totalSeats) || totalSeats < 2) {
    throw new Error('GameTable requires an integer seat count >= 2.');
  }
  return totalSeats;
};

/** The seat after yours appears on the right or the left. */
export type TableTurnDirection = 'clockwise' | 'counterclockwise';

export type SeatLike = { key: string; teamIdx?: number; isMe?: boolean };
export type GameTableSlot<T extends SeatLike = SeatLike> = {
  key: string;
  teamIdx: number;
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
  const slots = players.map((player, index) => ({ key: player.key, teamIdx: player.teamIdx ?? index % 2, player }));
  const meIndex = slots.findIndex((slot) => slot.player.isMe);
  const rotatedSlots = meIndex > 0 ? [...slots.slice(meIndex), ...slots.slice(0, meIndex)] : slots;
  return applyTableTurnDirection(rotatedSlots, direction);
};

/** Fill round-robin team places, rotate the local player first, then apply direction. */
export const buildAlternatingSlots = <T extends SeatLike>(
  players: readonly T[],
  fill: number | undefined,
  direction: TableTurnDirection,
  teamCount = 2,
): GameTableSlot<T>[] => {
  validateSeatKeys(players);
  const length = resolveSeatCount(fill ?? Math.max(players.length, 2));
  if (!Number.isInteger(teamCount) || teamCount < 1) throw new Error('GameTable requires an integer teamCount >= 1.');
  const teamPlayers = new Map<number, T[]>();
  for (const [index, player] of players.entries()) {
    const teamIdx = player.teamIdx ?? index % teamCount;
    if (!Number.isInteger(teamIdx) || teamIdx < 0 || teamIdx >= teamCount) {
      throw new Error(`GameTable team ${teamIdx} is outside the round-robin range 0–${teamCount - 1}. Use slots for arbitrary teams.`);
    }
    const team = teamPlayers.get(teamIdx) ?? [];
    team.push(player);
    teamPlayers.set(teamIdx, team);
  }
  for (const [teamIdx, team] of teamPlayers) {
    const capacity = Math.max(0, Math.ceil((length - teamIdx) / teamCount));
    if (team.length > capacity) {
      throw new Error(`GameTable alternating team ${teamIdx} capacity is ${capacity}; received ${team.length} players. Use slots for arbitrary orders.`);
    }
  }
  const keys = new Set(players.map((player) => player.key));
  const slots = Array.from({ length }, (_, i): GameTableSlot<T> => {
    const teamIdx = i % teamCount;
    const player = teamPlayers.get(teamIdx)?.[Math.floor(i / teamCount)] ?? null;
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

/** Bottom is the local/first occupied seat. Front is the nearest occupied rival to its antipode.
 * With teamCount=1 there is no team leader opposite: frontLeaderSeatIndex is -1.
 * Equal-distance rivals use visual slot order, including on odd-sized tables.
 */
export const getTablePointSeatIndexes = <T extends SeatLike>(slots: readonly GameTableSlot<T>[], teamCount = 2) => {
  const mySeatIndex = slots.findIndex((slot) => Boolean(slot.player?.isMe));
  const bottomLeaderSeatIndex = mySeatIndex >= 0 ? mySeatIndex : slots.findIndex((slot) => Boolean(slot.player));
  if (bottomLeaderSeatIndex < 0 || !slots.length) {
    return { bottomLeaderSeatIndex: -1, frontLeaderSeatIndex: -1 };
  }
  const bottomSlot = slots[bottomLeaderSeatIndex];
  if (!bottomSlot) return { bottomLeaderSeatIndex: -1, frontLeaderSeatIndex: -1 };
  const bottomTeamIdx = bottomSlot.teamIdx;
  let frontLeaderSeatIndex = -1;
  let nearestDistance = Infinity;
  if (teamCount !== 1) slots.forEach((slot, index) => {
    if (!slot.player || slot.teamIdx === bottomTeamIdx) return;
    const distance = Math.abs(((index - bottomLeaderSeatIndex + slots.length) % slots.length) - slots.length / 2);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      frontLeaderSeatIndex = index;
    }
  });
  return { bottomLeaderSeatIndex, frontLeaderSeatIndex };
};
