/**
 * Flow Forge — core pipe-routing engine (pure TypeScript, no UI).
 *
 * The board is a W×H grid of tiles. Each tile exposes "ports" on its four
 * sides (N/E/S/W). The player rotates tiles so that a continuous pipe network
 * carries each coloured fluid from its SOURCE to the matching SINK. Fluid
 * spreads by flood-fill: two neighbouring tiles are connected only when both
 * have a port facing each other.
 *
 * A level is WON when every sink is reached by its own colour and no foreign
 * colour reaches it. A level is LOST when the move budget runs out first
 * (the budget is the in-engine stand-in for the GDD's soft timer). Leaks and
 * efficiency never fail the level — they only cost wrenches (stars).
 *
 * Every function here is deterministic and side-effect free so the solver
 * (scripts/validate.ts) and the bot playtesters (scripts/sim.ts) see exactly
 * what a human sees.
 */

// ---- Directions (bit flags) -------------------------------------------------
export const N = 1, E = 2, S = 4, W = 8;
export const DIRS = [N, E, S, W] as const;
export type Color = "blue" | "red" | "green" | "yellow";

/** Rotate a 4-bit port mask 90° clockwise (N→E→S→W→N). */
export function rotCW(mask: number): number {
  return ((mask << 1) | (mask >> 3)) & 15;
}
/** Port mask after applying `rot` quarter-turns clockwise. */
export function maskAt(base: number, rot: number): number {
  let m = base & 15;
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) m = rotCW(m);
  return m;
}
const OPP: Record<number, number> = { [N]: S, [E]: W, [S]: N, [W]: E };

/** Number of visually-distinct orientations a port mask has (used for stars + scramble). */
export function orientationsOf(mask: number): number {
  const seen = new Set<number>();
  let m = mask & 15;
  for (let i = 0; i < 4; i++) { seen.add(m); m = rotCW(m); }
  return seen.size; // 1 (empty/cross/single), 2 (straight), 4 (elbow/tee)
}

// ---- Tile / level data ------------------------------------------------------
export type TileType = "empty" | "pipe" | "source" | "sink" | "cross" | "gate";

export interface Cell {
  /** Tile kind. "pipe" covers straight / elbow / tee (distinguished by mask). */
  t: TileType;
  /** Port mask at rotation 0 (the SOLVED orientation for routed pipes). */
  m: number;
  /** Starting rotation (0..3). Scrambled for rotatable pipes. */
  r: number;
  /** Visually-distinct orientations (1/2/4). */
  o: number;
  /** True when the tile cannot be rotated (sources, sinks, crosses, fixed pipes). */
  f: boolean;
  /** Colour for source / sink / gate tiles. */
  c?: Color;
  /** Cross-overpass: two independent straight channels (fluids cross, never mix). */
  x?: boolean;
  /** Colour gate: only its own colour may pass through. */
  g?: boolean;
}

export interface LevelDef {
  id: string;
  number: number;
  w: number;
  h: number;
  cells: Cell[]; // length w*h, row-major
  /** Target rotation per cell proving solvability (fixed cells keep r). */
  solution: number[];
  /** Indices of rotatable cells — the moves available to a player. */
  rotatable: number[];
  /** Minimum clockwise taps from the start state to a solved state. */
  par: number;
  /** Taps allowed before the level is lost (tuned by the bots). */
  budget: number;
  colors: Color[];
  chapter: string;
  mechanics: string[];
}

// ---- Runtime state ----------------------------------------------------------
export interface GState {
  def: LevelDef;
  rot: number[]; // current rotation per cell
  moves: number;
}

export type Status = "playing" | "won" | "lost";

export const startState = (def: LevelDef): GState => ({
  def,
  rot: def.cells.map((c) => c.r),
  moves: 0,
});

export const legalMoves = (s: GState): number[] => s.def.rotatable;

/** A tap rotates one tile 90° clockwise. */
export function applyMove(s: GState, i: number): GState {
  const rot = s.rot.slice();
  rot[i] = (rot[i] + 1) % 4;
  return { def: s.def, rot, moves: s.moves + 1 };
}

// ---- Flow simulation --------------------------------------------------------
function neighbor(idx: number, dir: number, w: number, h: number): number {
  const r = (idx / w) | 0, c = idx % w;
  if (dir === N) return r > 0 ? idx - w : -1;
  if (dir === S) return r < h - 1 ? idx + w : -1;
  if (dir === E) return c < w - 1 ? idx + 1 : -1;
  return c > 0 ? idx - 1 : -1; // W
}

/**
 * Flood-fill the cells reachable by a single colour given the current rotations.
 * Returns a boolean[] of filled cells. Cross-overpass tiles pass flow straight
 * through (channel-separated); colour gates admit only their own colour.
 */
export function floodColor(def: LevelDef, rot: number[], color: Color): boolean[] {
  const { w, h, cells } = def;
  const n = w * h;
  const filled = new Array<boolean>(n).fill(false);
  const seen = new Set<number>(); // key = cell*16 + enterDir  (per-channel for crosses)
  const stack: Array<[number, number]> = []; // [fromCell, exitDir]

  for (let i = 0; i < n; i++) {
    const cell = cells[i];
    if (cell.t === "source" && cell.c === color) {
      filled[i] = true;
      const m = maskAt(cell.m, rot[i]);
      for (const d of DIRS) if (m & d) stack.push([i, d]);
    }
  }

  while (stack.length) {
    const [from, exitDir] = stack.pop()!;
    const nb = neighbor(from, exitDir, w, h);
    if (nb < 0) continue; // off-grid: a leak, carries no flow
    const enter = OPP[exitDir];
    const cell = cells[nb];
    if (cell.t === "empty") continue; // wall
    const m = maskAt(cell.m, rot[nb]);
    if (!(m & enter)) continue; // no port facing us → not connected
    if (cell.g && cell.c !== color) continue; // colour gate rejects foreign fluid

    const key = nb * 16 + enter;
    if (seen.has(key)) continue;
    seen.add(key);
    filled[nb] = true;

    if (cell.t === "sink") continue; // endpoint
    if (cell.x) {
      // Cross-overpass: continue straight through only (never turn).
      if (m & exitDir) stack.push([nb, exitDir]);
      continue;
    }
    // Ordinary pipe / gate / source: flow leaves by every other open port.
    for (const d of DIRS) if (m & d && d !== enter) stack.push([nb, d]);
  }
  return filled;
}

function sinkIndices(def: LevelDef): number[] {
  const out: number[] = [];
  for (let i = 0; i < def.cells.length; i++) if (def.cells[i].t === "sink") out.push(i);
  return out;
}

/** Full flow snapshot: filled map per colour + which sinks are satisfied. */
export function flow(def: LevelDef, rot: number[]) {
  const byColor: Record<string, boolean[]> = {};
  for (const col of def.colors) byColor[col] = floodColor(def, rot, col);
  const sinks = sinkIndices(def);
  const satisfied = sinks.map((si) => {
    const want = def.cells[si].c!;
    const own = byColor[want][si];
    const foreign = def.colors.some((c) => c !== want && byColor[c][si]);
    return own && !foreign;
  });
  return { byColor, sinks, satisfied };
}

export function isWon(def: LevelDef, rot: number[]): boolean {
  const { satisfied } = flow(def, rot);
  return satisfied.length > 0 && satisfied.every(Boolean);
}

export function statusOf(s: GState): Status {
  if (isWon(s.def, s.rot)) return "won";
  if (s.moves >= s.def.budget) return "lost";
  return "playing";
}

/**
 * Heuristic progress in [0,1] — what a human reads as "closer to done".
 *
 * Each rotatable tile contributes how nearly it is aligned to a connecting
 * orientation: a tile one tap from lining up scores higher than one three taps
 * away. This mirrors a competent player who can see which way a pipe "wants" to
 * turn — the signal climbs on every useful tap with no dead-ends, so a careful
 * (low-noise) player reliably out-performs a careless one and level difficulty
 * comes cleanly from route length versus the move budget. Equals 1 only when
 * every tile lines up — the solved, fully-connected board.
 */
export function progressOf(s: GState): number {
  const { def, rot } = s;
  const rotatable = def.rotatable;
  if (!rotatable.length) return 1;
  let score = 0;
  for (const i of rotatable) {
    const cell = def.cells[i];
    const remaining = tapsBetween(cell.m, rot[i], 0); // CW taps left to line up
    score += 1 - remaining / cell.o;
  }
  return score / rotatable.length;
}

// ---- Scoring ----------------------------------------------------------------
/** Minimum clockwise taps to turn one rotation into an orientation-equivalent one. */
export function tapsBetween(base: number, from: number, to: number): number {
  const target = maskAt(base, to);
  for (let k = 0; k < 4; k++) if (maskAt(base, from + k) === target) return k;
  return 0;
}

/** Par = minimum taps from the start state to the stored solution. */
export function parOf(def: LevelDef): number {
  let sum = 0;
  for (const i of def.rotatable) sum += tapsBetween(def.cells[i].m, def.cells[i].r, def.solution[i]);
  return sum;
}

/** 3 wrenches if solved at/near par, 2 if reasonably efficient, else 1. */
export function starsFor(movesUsed: number, par: number): 1 | 2 | 3 {
  if (movesUsed <= par + Math.max(1, Math.round(par * 0.15))) return 3;
  if (movesUsed <= par * 2 + 2) return 2;
  return 1;
}
