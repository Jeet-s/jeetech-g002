/// <reference types="node" />
/**
 * Flow Forge designer's microscope: for the given levels prints the start board,
 * the solver facts and EVERY winning board (when there are only a few), so a
 * designer can see whether a level has the one intended answer or loopholes.
 *
 *   npx tsx scripts/design-try.ts 31 32
 */
import { LEVELS } from "../src/game/levels";
import { LevelDef, N, E, S, W, isWon, maskAt, startState, turn } from "../src/game/engine";
import { sim } from "../src/game/sim";
import { shortest, solutions, trapRate } from "./level-lab";

const PIPE: Record<number, string> = {
  [N | S]: "│", [E | W]: "─", [N | E]: "└", [E | S]: "┌", [S | W]: "┐", [W | N]: "┘",
  [N | E | S]: "├", [E | S | W]: "┬", [S | W | N]: "┤", [W | N | E]: "┴", [N]: "╵", [E]: "╶", [S]: "╷", [W]: "╴",
};

function render(def: LevelDef, rot: number[]): string[] {
  const out: string[] = [];
  for (let y = 0; y < def.h; y++) {
    let row = "";
    for (let x = 0; x < def.w; x++) {
      const c = def.cells[y * def.w + x];
      const L = (c.c ?? "b")[0];
      row += c.t === "empty" ? "." : c.t === "source" ? L.toUpperCase() : c.t === "sink" ? L : c.x ? "+" : PIPE[maskAt(c.m, rot[y * def.w + x])] ?? "?";
    }
    out.push(row);
  }
  return out;
}

for (const n of process.argv.slice(2).map(Number)) {
  const def = LEVELS[n - 1];
  const d = sim.describe(n - 1);
  const sol = solutions(def);
  const sp = shortest(startState(def));
  console.log(`\nL${n} ${def.w}x${def.h} par ${def.par} opt ${sp.optimal} explored ${sp.explored} trap ${trapRate(def)} ` +
    `taps ${def.taps.length} space ${sol?.space} wins ${sol?.wins} fewest ${sol?.fewest}`);
  console.log(d.grid.map((r) => "  start  " + r).join("\n"));
  for (const [k, v] of Object.entries(d.legend)) if (k.startsWith("gears") || k.startsWith("═")) console.log(`  ${k}: ${v}`);
  if (sol && sol.wins <= Number(process.env.SHOW ?? 6)) {
    const orient = def.taps.map((i) => (def.groups[def.cells[i].k ?? -1] ?? [i]).reduce((a, j) => Math.max(a, def.cells[j].o), 1));
    const start = def.cells.map((c) => c.r);
    const seen = new Set<string>();
    for (let code = 0; code < sol.space; code++) {
      let q = code, rot = start;
      for (let t = 0; t < def.taps.length; t++) {
        const k = q % orient[t];
        q = Math.floor(q / orient[t]);
        for (let m = 0; m < k; m++) rot = turn(def, rot, def.taps[t]);
      }
      if (!isWon(def, rot)) continue;
      const pic = render(def, rot).join(" / ");
      if (seen.has(pic)) continue;
      seen.add(pic);
      console.log(`  win    ${pic}`);
    }
  }
}
