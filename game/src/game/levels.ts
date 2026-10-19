/**
 * Flow Forge — level data. Every level is HAND-AUTHORED in ./designs.ts as two
 * small ASCII boards (the solved board + how many taps each pipe is scrambled
 * away from it) and compiled here into the engine's LevelDef.
 *
 * Board glyphs (solved orientation):
 *   │ ─ └ ┌ ┐ ┘ ├ ┬ ┤ ┴   rotatable straight / elbow / tee
 *   ┃ ━ ┗ ┏ ┓ ┛ ┣ ┳ ┫ ┻   the same pieces BOLTED (fixed, cannot rotate)
 *   +                     cross-overpass (fixed; two channels that never mix)
 *   B R G Y / b r g y     source / drain of that colour (mouth inferred from the
 *                         one neighbour that faces it in the solved board)
 *   .                     blocked plate
 * A design may pin an endpoint's mouth (`mouths: {"r,c": "E"}`) when a decoy
 * pressed against it would otherwise make the reading ambiguous.
 * Taps grid: a digit per rotatable pipe = clockwise taps from its start to its
 * solved orientation (0 = starts aligned / decoy at rest); "." elsewhere.
 *
 * Move budgets live in ./budgets.json, measured with the factory's bots by
 * scripts/tune-levels.ts (never guessed).
 *
 * The stored `solution` is the solved board, so validate.ts can PROVE each
 * level is winnable on the real engine; `par` is the tap count back to it.
 */
import { Cell, Color, LevelDef, N, E, S, W, DIRS, isWon, orientationsOf, parOf, starsFor as starsForEngine } from "./engine";
import { DESIGNS, CHAPTERS, type Design } from "./designs";
import BUDGETS from "./budgets.json";

export type { LevelDef, Color, Cell } from "./engine";
export { CHAPTERS } from "./designs";
export const starsFor = starsForEngine;
export const movesAllowed = (level: LevelDef): number => level.budget;

const LIGHT: Record<string, number> = {
  "│": N | S, "─": E | W, "└": N | E, "┌": E | S, "┐": S | W, "┘": W | N,
  "├": N | E | S, "┬": E | S | W, "┤": S | W | N, "┴": W | N | E,
};
const HEAVY: Record<string, number> = {
  "┃": N | S, "━": E | W, "┗": N | E, "┏": E | S, "┓": S | W, "┛": W | N,
  "┣": N | E | S, "┳": E | S | W, "┫": S | W | N, "┻": W | N | E,
};
const COLOR_OF: Record<string, Color> = { b: "blue", r: "red", g: "green", y: "yellow" };
const OPP: Record<number, number> = { [N]: S, [E]: W, [S]: N, [W]: E };
const DIR_OF = { N, E, S, W } as const;

function portsOf(ch: string): number {
  if (ch === "+") return 15;
  return LIGHT[ch] ?? HEAVY[ch] ?? 0;
}

/** Compile one hand-authored design into a LevelDef (throws on authoring errors). */
export function buildLevel(d: Design, number: number, budget = (BUDGETS as number[])[number - 1] ?? 99): LevelDef {
  const h = d.solved.length;
  const w = [...d.solved[0]].length;
  const solved = d.solved.map((row) => [...row]);
  const taps = d.taps.map((row) => [...row]);
  if (taps.length !== h) throw new Error(`L${number}: taps grid has ${taps.length} rows, want ${h}`);
  const at = (r: number, c: number) => (r >= 0 && c >= 0 && r < h && c < w ? solved[r][c] : ".");
  const step: Record<number, [number, number]> = { [N]: [-1, 0], [E]: [0, 1], [S]: [1, 0], [W]: [0, -1] };

  const cells: Cell[] = [];
  const colors: Color[] = [];
  // Endpoints with a decoy pressed against their back: resolved below to the mouth that wins.
  const ambiguous: { i: number; mouths: number[] }[] = [];
  for (let r = 0; r < h; r++) {
    if (solved[r].length !== w || taps[r].length !== w) throw new Error(`L${number}: row ${r} width mismatch`);
    for (let c = 0; c < w; c++) {
      const ch = solved[r][c];
      const tp = taps[r][c];
      if (ch === ".") { cells.push({ t: "empty", m: 0, r: 0, o: 1, f: true }); continue; }
      if (ch === "+") { cells.push({ t: "cross", m: 15, r: 0, o: 1, f: true, x: true }); continue; }
      const lower = ch.toLowerCase();
      if (COLOR_OF[lower]) {
        // Mouth = the single neighbour whose solved ports face this endpoint.
        const mouths = DIRS.filter((dir) => {
          const [dr, dc] = step[dir];
          const nb = at(r + dr, c + dc);
          return nb !== "." && !COLOR_OF[nb.toLowerCase()] && (portsOf(nb) & OPP[dir]) !== 0;
        });
        if (!mouths.length) throw new Error(`L${number}: endpoint ${ch} at ${r},${c} has no facing pipe`);
        const color = COLOR_OF[lower];
        if (!colors.includes(color)) colors.push(color);
        const forced = d.mouths?.[`${r},${c}`];
        if (forced) mouths.splice(0, mouths.length, DIR_OF[forced]);
        if (mouths.length > 1) ambiguous.push({ i: cells.length, mouths });
        cells.push({ t: ch === lower ? "sink" : "source", m: mouths[0], r: 0, o: 1, f: true, c: color });
        continue;
      }
      const m = portsOf(ch);
      if (!m) throw new Error(`L${number}: unknown glyph '${ch}' at ${r},${c}`);
      const fixed = HEAVY[ch] !== undefined;
      const o = orientationsOf(m);
      if (fixed) {
        if (tp !== "." && tp !== "0") throw new Error(`L${number}: bolted pipe at ${r},${c} cannot be scrambled`);
        cells.push({ t: "pipe", m, r: 0, o, f: true });
        continue;
      }
      const k = Number(tp);
      if (!(k >= 0 && k < o)) throw new Error(`L${number}: bad tap count '${tp}' at ${r},${c}`);
      cells.push({ t: "pipe", m, r: (o - k) % o, o, f: false });
    }
  }
  const order: Color[] = ["blue", "red", "green", "yellow"];
  colors.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  const rotatable: number[] = [];
  cells.forEach((cell, i) => { if (!cell.f) rotatable.push(i); });
  const def: LevelDef = {
    id: `L${number}`, number, w, h, cells,
    solution: cells.map(() => 0),
    rotatable,
    par: 0,
    budget,
    colors,
    chapter: CHAPTERS[d.chapter],
    mechanics: d.mechanics,
  };
  if (ambiguous.length) {
    const combos = ambiguous.reduce((a, x) => a * x.mouths.length, 1);
    const wins: number[] = [];
    for (let k = 0; k < combos; k++) {
      let q = k;
      for (const x of ambiguous) { cells[x.i].m = x.mouths[q % x.mouths.length]; q = Math.floor(q / x.mouths.length); }
      if (isWon(def, def.solution)) wins.push(k);
    }
    if (wins.length !== 1) throw new Error(`L${number}: ${wins.length} ways to read the endpoint mouths`);
    let q = wins[0];
    for (const x of ambiguous) { cells[x.i].m = x.mouths[q % x.mouths.length]; q = Math.floor(q / x.mouths.length); }
  }
  def.par = parOf(def);
  if (!isWon(def, def.solution)) throw new Error(`L${number}: solved board does not win`);
  if (isWon(def, cells.map((c) => c.r))) throw new Error(`L${number}: start board is already solved`);
  return def;
}

export const LEVELS: LevelDef[] = DESIGNS.map((d, i) => buildLevel(d, i + 1));
