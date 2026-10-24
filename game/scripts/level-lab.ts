/// <reference types="node" />
/**
 * Flow Forge level lab — a designer's bench for the hand-authored boards in
 * src/game/designs.ts. For each level it prints the solver facts the factory's
 * `npm run levels` will report (same BFS semantics and 40k cap, but with compact
 * state keys so it runs in seconds) plus bot win-rates at the authored budget.
 *
 *   npx tsx scripts/level-lab.ts            # every level
 *   npx tsx scripts/level-lab.ts 19 20 21   # just these
 *   BOTS=0 npx tsx scripts/level-lab.ts     # solver facts only
 */
import { LEVELS } from "../src/game/levels";
import { GState, LevelDef, applyMove, isWon, legalMoves, progressOf, startState, statusOf, turn } from "../src/game/engine";
import { sim } from "../src/game/sim";
import type { Sim } from "../src/game/sim";
import { winRate } from "./bots";

const CAP = 40_000;
const key = (s: GState) => s.def.rotatable.map((i) => s.rot[i]).join("");

export function shortest(from: GState, cap = CAP): { optimal: number | null; explored: number; capped: boolean } {
  if (statusOf(from) === "won") return { optimal: 0, explored: 1, capped: false };
  const seen = new Set([key(from)]);
  let frontier = [from];
  for (let depth = 1; frontier.length && seen.size < cap; depth++) {
    const next: GState[] = [];
    for (const s of frontier) {
      if (statusOf(s) !== "playing") continue;
      for (const m of legalMoves(s)) {
        const t = applyMove(s, m);
        const st = statusOf(t);
        if (st === "won") return { optimal: depth, explored: seen.size, capped: false };
        const k = key(t);
        if (st === "lost" || seen.has(k)) continue;
        seen.add(k);
        next.push(t);
        if (seen.size >= cap) break;
      }
      if (seen.size >= cap) break;
    }
    frontier = next;
  }
  return { optimal: null, explored: seen.size, capped: seen.size >= cap };
}

export function trapRate(def: LevelDef): number | null {
  const start = startState(def);
  const firsts = legalMoves(start);
  const sample = firsts.length <= 12 ? firsts : Array.from({ length: 12 }, (_, k) => firsts[Math.floor((k * firsts.length) / 12)]);
  let dead = 0, known = 0;
  for (const m of sample) {
    const after = applyMove(start, m);
    const st = statusOf(after);
    if (st !== "playing") { known++; if (st === "lost") dead++; continue; }
    const r = shortest(after, CAP / 4);
    if (r.capped) continue;
    known++;
    if (r.optimal === null) dead++;
  }
  return known ? Number((dead / known).toFixed(2)) : null;
}

/**
 * Every winning board reachable from the start (exhaustive over the tap targets' orientations):
 * how many there are and the fewest taps to any of them. A good puzzle has few solutions.
 */
export function solutions(def: LevelDef, limit = 3_000_000): { wins: number; fewest: number; space: number } | null {
  const orient = def.taps.map((i) => (def.groups[def.cells[i].k ?? -1] ?? [i]).reduce((a, j) => Math.max(a, def.cells[j].o), 1));
  const space = orient.reduce((a, o) => a * o, 1);
  if (space > limit) return null;
  let wins = 0, fewest = Infinity;
  const start = def.cells.map((c) => c.r);
  for (let code = 0; code < space; code++) {
    let q = code, rot = start, taps = 0;
    for (let t = 0; t < def.taps.length; t++) {
      const k = q % orient[t];
      q = Math.floor(q / orient[t]);
      for (let n = 0; n < k; n++) rot = turn(def, rot, def.taps[t]);
      taps += k;
    }
    if (isWon(def, rot)) { wins++; fewest = Math.min(fewest, taps); }
  }
  return { wins, fewest, space };
}

const ENGINE: Sim<GState, number> = {
  levelCount: 0,
  start: () => { throw new Error("unused"); },
  moves: legalMoves, apply: applyMove, status: statusOf, progress: progressOf,
  describe: () => { throw new Error("unused"); },
};
export const rate = (def: LevelDef, persona: "skilled" | "casual" | "careless", trials = 300) =>
  winRate(ENGINE, startState(def), persona, trials).rate;

if (require.main === module) {
  const pick = process.argv.slice(2).map(Number).filter(Boolean);
  const bots = process.env.BOTS !== "0";
  for (const def of LEVELS) {
    if (pick.length && !pick.includes(def.number)) continue;
    const sp = shortest(startState(def));
    const sol = solutions(def);
    const space = sol ? `${sol.space} wins ${sol.wins} fewest ${sol.fewest}` : "big";
    const fixed = def.cells.filter((c) => c.t === "pipe" && c.f).length;
    const crosses = def.cells.filter((c) => c.x).length;
    let line = `L${def.number} ${def.w}x${def.h} ${def.colors.length}c taps ${def.taps.length} rot ${def.rotatable.length} fixed ${fixed} +${crosses} ` +
      `par ${def.par} opt ${sp.optimal ?? `>cap`} exp ${sp.explored} space ${space} trap ${trapRate(def)} budget ${def.budget}`;
    if (bots) line += ` | casual ${rate(def, "casual").toFixed(2)} skilled ${rate(def, "skilled").toFixed(2)} careless ${rate(def, "careless").toFixed(2)}`;
    console.log(line);
    if (process.env.GRID) console.log(sim.describe(def.number - 1).grid.map((r) => "    " + r).join("\n"));
  }
}
