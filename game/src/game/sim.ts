/**
 * Simulation interface for the factory's bot playtesters (scripts/playtest.ts).
 * It exposes the REAL Flow Forge engine (src/game/engine.ts) with no UI, so the
 * human-like bots rotate tiles exactly as a player would and QA can measure the
 * difficulty / pacing of every level.
 */
import { E, GState, N, S, W, applyMove, legalMoves, maskAt, progressOf, startState, statusOf } from "./engine";
import { LEVELS } from "./levels";
import { DESIGNS } from "./designs";

export type Status = "playing" | "won" | "lost";

export interface Sim<S, M> {
  levelCount: number;
  /** Fresh state of level `index` (0-based). */
  start(index: number): S;
  /** Legal moves from this state (what a player could tap/swipe now). */
  moves(state: S): M[];
  apply(state: S, move: M): S;
  status(state: S): Status;
  /** Higher = closer to winning — what a human "sees" as progress. Used by human-like bots. */
  progress(state: S): number;
  /** The level as a designer reads it: start board (ASCII rows + legend), intent and mechanics. */
  describe(index: number): { grid: string[]; legend: Record<string, string>; intent: string; mechanics: string[] };
}

// Box-drawing glyph for a pipe's open ports at its START rotation (heavy = bolted).
const PIPE: Record<number, string> = {
  [N | S]: "│", [E | W]: "─", [N | E]: "└", [E | S]: "┌", [S | W]: "┐", [W | N]: "┘",
  [N | E | S]: "├", [E | S | W]: "┬", [S | W | N]: "┤", [W | N | E]: "┴",
};
const BOLTED: Record<number, string> = {
  [N | S]: "┃", [E | W]: "━", [N | E]: "┗", [E | S]: "┏", [S | W]: "┓", [W | N]: "┛",
  [N | E | S]: "┣", [E | S | W]: "┳", [S | W | N]: "┫", [W | N | E]: "┻",
};
// Filter gates use the double-line set (their colour is listed in the legend).
const GATE: Record<number, string> = {
  [N | S]: "║", [E | W]: "═", [N | E]: "╚", [E | S]: "╔", [S | W]: "╗", [W | N]: "╝",
  [N | E | S]: "╠", [E | S | W]: "╦", [S | W | N]: "╣", [W | N | E]: "╩",
};
const LETTER = { blue: "b", red: "r", green: "g", yellow: "y", purple: "p" } as const;

function describe(index: number) {
  const def = LEVELS[index];
  const design = DESIGNS[index];
  const grid: string[] = [];
  for (let y = 0; y < def.h; y++) {
    let row = "";
    for (let x = 0; x < def.w; x++) {
      const c = def.cells[y * def.w + x];
      const L = LETTER[c.c ?? "blue"];
      if (c.t === "empty") row += ".";
      else if (c.t === "source") row += L.toUpperCase();
      else if (c.t === "sink") row += L;
      else if (c.t === "cross") row += "+";
      else if (c.t === "gate") row += GATE[maskAt(c.m, c.r)] ?? "=";
      else row += (c.f ? BOLTED : PIPE)[maskAt(c.m, c.r)] ?? "?";
    }
    grid.push(row);
  }
  const legend: Record<string, string> = {
    ".": "blocked steel plate",
    "B R G": "fluid source (blue, red, green); its mouth faces the one pipe that connects to it",
    "b r g": "drain of that colour (a level may have several drains of one colour, fed by splitters)",
    "│ ─ └ ┌ ┐ ┘": "loose straight / elbow pipe at its start rotation (tap = rotate 90° clockwise)",
    "├ ┬ ┤ ┴": "loose tee (splitter): fluid leaves by every open arm",
    "┃ ━ ┗ ┏ ┓ ┛ ┣ ┳ ┫ ┻": "bolted pipe or tee (riveted plate): fixed, cannot rotate",
    "+": "cross-overpass: two straight channels, fluids pass straight through without mixing (fixed)",
  };
  const at = (i: number) => `row ${Math.floor(i / def.w) + 1} col ${(i % def.w) + 1}`;
  const gates = def.cells.map((c, i) => (c.t === "gate" ? i : -1)).filter((i) => i >= 0);
  if (gates.length) {
    legend["═ ║ ╚ ╔ ╗ ╝ ╠ ╦ ╣ ╩"] =
      "colour FILTER gate (pipe of that shape; only its own colour may pass, others are stopped dead — so colours can share pipes " +
      "and only drains must stay pure): " + gates.map((i) => `${at(i)} = ${def.cells[i].c}${def.cells[i].f ? " (bolted)" : " (loose)"}`).join("; ");
  }
  if (def.cells.some((c) => c.t === "sink" && c.c === "purple")) {
    legend["p"] = "mixer vat (purple drain): satisfied only when BOTH blue and red reach it, and no other colour";
  }
  def.groups.forEach((g, k) => {
    legend[`gears ${String.fromCharCode(65 + k)}`] = `geared pipes ${g.map(at).join(" + ")}: a tap on either turns all of them 90° clockwise together`;
  });
  const fixed = def.cells.filter((c) => c.t === "pipe" && c.f).length;
  const crosses = def.cells.filter((c) => c.x).length;
  const facts =
    ` [${def.w}x${def.h}, ${def.colors.length} fluid${def.colors.length > 1 ? "s" : ""}, ${def.rotatable.length} loose pipes` +
    `${fixed ? `, ${fixed} bolted` : ""}${crosses ? `, ${crosses} overpass${crosses > 1 ? "es" : ""}` : ""}` +
    `${gates.length ? `, ${gates.length} filter${gates.length > 1 ? "s" : ""}` : ""}${def.groups.length ? `, ${def.groups.length} gear group${def.groups.length > 1 ? "s" : ""}` : ""}` +
    `; par ${def.par} taps, ${def.budget} allowed]`;
  const plan = `Chapter ${design.chapter + 1} "${def.chapter}", level ${index + 1}, role ${design.role.toUpperCase()}`;
  return { grid, legend, intent: `${plan} — ${design.intent}${facts}`, mechanics: def.mechanics };
}

export const sim: Sim<GState, number> = {
  levelCount: LEVELS.length,
  start: (i) => startState(LEVELS[i]),
  moves: legalMoves,
  apply: applyMove,
  status: statusOf,
  progress: progressOf,
  describe,
};
