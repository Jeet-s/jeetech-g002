import type { PlayerState } from "../modules/store";

/**
 * Boosters — fixed, known bundles bought with earned coins (never random):
 *  Hint     — rings the pipe that is furthest from lining up.
 *  Wrench   — snaps one wrong pipe straight into place without spending a move.
 *  +5 Moves — five more moves on the current level's budget.
 */
export type BoosterId = "hint" | "wrench" | "moves";

export interface Booster {
  id: BoosterId;
  name: string;
  short: string;
  what: string;
  key: "hints" | "wrenches" | "extraMoves";
  pack: number;
  coins: number;
}

export const BOOSTERS: Booster[] = [
  { id: "hint", name: "Hint", short: "Hint", what: "Rings the pipe that's furthest from lining up.", key: "hints", pack: 3, coins: 150 },
  { id: "wrench", name: "Wrench", short: "Wrench", what: "Snaps one wrong pipe into place. Costs no move.", key: "wrenches", pack: 2, coins: 200 },
  { id: "moves", name: "+5 Moves", short: "+5 Moves", what: "Adds 5 moves to this level's budget.", key: "extraMoves", pack: 3, coins: 120 },
];

export const booster = (id: BoosterId) => BOOSTERS.find((b) => b.id === id)!;
export const owned = (s: PlayerState, id: BoosterId) => s[booster(id).key] ?? 0;
