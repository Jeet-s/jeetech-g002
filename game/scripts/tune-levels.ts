/// <reference types="node" />
/**
 * Flow Forge budget tuner — paces the HAND-AUTHORED levels (src/game/designs.ts)
 * by MEASURING, not guessing. Boards are never generated or edited here; only
 * each level's move budget is chosen. Writes src/game/budgets.json.
 *
 * It measures with an exact replica of the factory playtest (scripts/playtest.ts
 * + scripts/bots.ts: same personas, order, trial count and RNG), so what we tune
 * is what QA sees. The bots' RNG walks a short cycle, which means a level's
 * win-rate depends on where in that cycle its trials start — and therefore on
 * every budget before it. So budgets are chosen jointly, by coordinate descent
 * on a score built from the pacing rules:
 *   • levels 1-3 won by ≥80% of casual players (we aim ≥85%)
 *   • after level 5: ≤2 consecutive levels at ≥90% casual, ≤25% of them that easy
 *   • middle third casual 50-85%, last third casual 30-65% and skilled ≥50%
 *     (last-third skilled mean ≤95%), no wall, no spike, falling curve (ρ ≤ -0.5)
 *   • and, softly, a target curve with a breather at each chapter's teach level
 *     and a dip at each finale; never a budget below par + 2.
 *
 *   npx tsx scripts/tune-levels.ts          # tune from the current budgets.json
 *   npx tsx scripts/tune-levels.ts --check  # just print the replica playtest
 */
import { writeFileSync, readFileSync } from "fs";
import * as path from "path";
import { DESIGNS } from "../src/game/designs";
import { buildLevel } from "../src/game/levels";
import { GState, LevelDef, applyMove, legalMoves, progressOf, startState, statusOf } from "../src/game/engine";
import { PERSONAS } from "./bots";

const N = DESIGNS.length;
const TRIALS = Number(process.env.PLAYTEST_TRIALS ?? 150);
const FILE = path.join(__dirname, "../src/game/budgets.json");

// ---- exact replica of scripts/bots.ts (its RNG is module state we cannot reset) ----
let seed = 1234567;
const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
function playOnce(start: GState, noise: number, cap = 400): boolean {
  let s = start;
  for (let n = 0; n < cap; n++) {
    const st = statusOf(s);
    if (st !== "playing") return st === "won";
    const moves = legalMoves(s);
    if (!moves.length) return false;
    let pick = moves[Math.floor(rand() * moves.length)];
    if (rand() > noise) {
      let best = -Infinity;
      for (const m of moves) {
        const next = applyMove(s, m);
        const v = statusOf(next) === "won" ? Infinity : progressOf(next) + rand() * 1e-6;
        if (v > best) { best = v; pick = m; }
      }
    }
    s = applyMove(s, pick);
  }
  return false;
}

/** Skilled + casual win-rates per level, exactly as `npm run playtest` reports them. */
export function replica(budgets: number[]): { skilled: number[]; casual: number[] } {
  seed = 1234567;
  const defs: LevelDef[] = DESIGNS.map((d, i) => buildLevel(d, i + 1, budgets[i]));
  const out: Record<string, number[]> = { skilled: [], casual: [] };
  for (const p of ["skilled", "casual"] as const) {
    for (const def of defs) {
      let wins = 0;
      for (let t = 0; t < TRIALS; t++) if (playOnce(startState(def), PERSONAS[p])) wins++;
      out[p].push(Number((wins / TRIALS).toFixed(3)));
    }
  }
  return out as { skilled: number[]; casual: number[] };
}

/** Target casual win-rate (soft) at level n (1-based). */
function target(n: number): number {
  const role = DESIGNS[n - 1].role;
  if (n <= 5) return 0.95;
  let t = 0.9 - 0.5 * ((n - 6) / (N - 6));
  if (role === "teach" || role === "breather") t += 0.05;
  if (role === "finale") t -= 0.05;
  return t;
}

function spearman(ys: number[]): number {
  const rank = (a: number[]) => {
    const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
    const r = new Array(a.length);
    for (let i = 0; i < idx.length;) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2;
      i = j + 1;
    }
    return r as number[];
  };
  const rx = rank(ys.map((_, i) => i)), ry = rank(ys);
  const m = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = m(rx), my = m(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < ys.length; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return num / Math.sqrt(dx * dy);
}

/** 0 when every pacing rule passes with margin; grows with each violation. */
export function score(r: { skilled: number[]; casual: number[] }, budgets: number[], pars: number[]): { hard: number; soft: number } {
  const c = r.casual, s = r.skilled;
  let hard = 0, soft = 0;
  const under = (v: number, lo: number) => Math.max(0, lo - v);
  const over = (v: number, hi: number) => Math.max(0, v - hi);
  for (let i = 0; i < N; i++) {
    const n = i + 1;
    if (n <= 3) hard += under(c[i], 0.86);
    if (n > N / 3 && n <= (2 * N) / 3) hard += under(c[i], 0.53) + over(c[i], 0.82);
    if (n > (2 * N) / 3) hard += under(c[i], 0.33) + over(c[i], 0.62) + under(s[i], 0.56);
    if (c[i] < 0.12 && s[i] < 0.62) hard += 1; // wall
    if (i >= 3) hard += over((c[i - 1] + c[i - 2] + c[i - 3]) / 3 - c[i], 0.3); // spike
    soft += Math.abs(c[i] - target(n)) * 0.3;
    if (budgets[i] < pars[i] + 2) soft += 0.05;
  }
  // Easy-level pacing after level 5.
  let run = 0, easy = 0;
  for (let i = 5; i < N; i++) {
    if (c[i] >= 0.9) { easy++; run++; if (run > 2) hard += 0.2; } else run = 0;
  }
  hard += Math.max(0, easy - Math.floor(0.25 * (N - 5))) * 0.2;
  const late = s.slice(Math.ceil((2 * N) / 3));
  hard += over(late.reduce((a, v) => a + v, 0) / late.length, 0.93);
  hard += over(spearman(c), -0.6);
  return { hard, soft };
}

if (require.main === module) {
  const pars = DESIGNS.map((d, i) => buildLevel(d, i + 1, 99).par);
  let budgets: number[] = (() => {
    try { const b = JSON.parse(readFileSync(FILE, "utf8")); if (b.length === N) return b; } catch { /* fresh */ }
    return pars.map((p, i) => p + (i < 5 ? 20 : 6));
  })();
  const total = (r: ReturnType<typeof replica>, b: number[]) => { const sc = score(r, b, pars); return sc.hard * 10 + sc.soft; };
  let cur = replica(budgets);
  let best = total(cur, budgets);
  const report = (r: ReturnType<typeof replica>) => {
    const sc = score(r, budgets, pars);
    process.stderr.write(`hard ${sc.hard.toFixed(3)} soft ${sc.soft.toFixed(3)}\n`);
    for (let i = 0; i < N; i++) {
      process.stderr.write(`  L${i + 1} ${DESIGNS[i].role.padEnd(8)} par ${String(pars[i]).padStart(2)} budget ${String(budgets[i]).padStart(2)}  casual ${r.casual[i].toFixed(2)} skilled ${r.skilled[i].toFixed(2)}\n`);
    }
  };
  if (!process.argv.includes("--check")) {
    for (let pass = 0; pass < 4; pass++) {
      let improved = false;
      for (let i = 0; i < N; i++) {
        const lo = pars[i] + 1, hi = pars[i] + (i < 5 ? 30 : 14);
        for (let b = lo; b <= hi; b++) {
          if (b === budgets[i]) continue;
          const trial = budgets.slice(); trial[i] = b;
          const r = replica(trial);
          const t = total(r, trial);
          if (t < best - 1e-9) { best = t; budgets = trial; cur = r; improved = true; }
        }
        process.stderr.write(`pass ${pass} L${i + 1}: budget ${budgets[i]} score ${best.toFixed(3)}\n`);
      }
      writeFileSync(FILE, JSON.stringify(budgets) + "\n");
      if (!improved || score(cur, budgets, pars).hard === 0 && pass > 0) break;
    }
  }
  report(cur);
}
