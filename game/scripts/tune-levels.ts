/// <reference types="node" />
/**
 * Flow Forge budget tuner — paces the HAND-AUTHORED levels (src/game/designs.ts)
 * by MEASURING, not guessing. Boards are never generated or edited here; only
 * each level's move budget is chosen. Writes src/game/budgets.json.
 *
 * It measures with an exact replica of the factory playtest (scripts/playtest.ts
 * + scripts/bots.ts: same personas, order, trial count, move order and RNG), so
 * what we tune is what QA sees. The bots' RNG walks a short cycle, which means a
 * level's win-rate depends on where in that cycle its trials start — and
 * therefore on every budget before it. So budgets are chosen jointly, by
 * coordinate descent on a score built from the factory's pacing rules:
 *   • levels 1-3 won by ≥80% of casual players (we aim ≥85%)
 *   • after level 5: ≤2 consecutive levels at ≥90% casual, ≤25% of them that easy
 *   • middle third casual mean 50-85%, last third casual mean 30-65% and skilled
 *     mean 50-95%, no wall, no spike, falling curve (ρ ≤ -0.5)
 *   • and, softly, a target curve with a breather at each chapter's teach level
 *     and a dip at each finale; never a budget below par + 2.
 *
 * Speed: the replica never flood-fills. Each level is reduced to "taps left" per
 * tap target (a loose pipe or a gear group) and the exact set of winning boards
 * is enumerated once, so a bot step is a few array reads — identical decisions
 * and RNG draws to the real engine (checked against it with --verify).
 *
 *   npx tsx scripts/tune-levels.ts          # tune from the current budgets.json
 *   npx tsx scripts/tune-levels.ts --check  # just print the replica playtest
 *   npx tsx scripts/tune-levels.ts --verify # replica vs real engine, same budgets
 */
import { writeFileSync, readFileSync } from "fs";
import * as path from "path";
import { DESIGNS } from "../src/game/designs";
import { buildLevel } from "../src/game/levels";
import { LevelDef, applyMove, isWon, legalMoves, progressOf, startState, statusOf, tapsToSolve, turn, turnsWith } from "../src/game/engine";
import { PERSONAS } from "./bots";

const N = DESIGNS.length;
const TRIALS = Number(process.env.PLAYTEST_TRIALS ?? 150);
const FILE = path.join(__dirname, "../src/game/budgets.json");

// ---- compact model of a level: taps-left per tap target + the exact win set ----
interface Fast { period: number[]; start: number[]; radix: number[]; wins: Set<number>; budget: number }
function compile(def: LevelDef): Fast {
  const period = def.taps.map((i) => turnsWith(def, i).reduce((a, j) => Math.max(a, def.cells[j].o), 1));
  const rot0 = def.cells.map((c) => c.r);
  const start = def.taps.map((i) => Math.max(0, tapsToSolve(def, rot0, i)));
  const radix: number[] = [];
  let r = 1;
  for (const p of period) { radix.push(r); r *= p; }
  // Enumerate every board by taps applied per target; record the winning ones by their taps-left code.
  const wins = new Set<number>();
  for (let code = 0; code < r; code++) {
    let rot = rot0;
    let left = 0;
    for (let t = 0; t < period.length; t++) {
      const k = Math.floor(code / radix[t]) % period[t];
      for (let m = 0; m < k; m++) rot = turn(def, rot, def.taps[t]);
      left += (((start[t] - k) % period[t]) + period[t]) % period[t] * radix[t];
    }
    if (isWon(def, rot)) wins.add(left);
  }
  return { period, start, radix, wins, budget: def.budget };
}

// ---- exact replica of scripts/bots.ts (its RNG is module state we cannot reset) ----
let seed = 1234567;
const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
function playOnce(f: Fast, noise: number, cap = 400): boolean {
  const left = f.start.slice();
  const n = left.length;
  let code = 0;
  for (let t = 0; t < n; t++) code += left[t] * f.radix[t];
  let score = 0;
  for (let t = 0; t < n; t++) score += 1 - left[t] / f.period[t];
  for (let moves = 0; moves < cap; moves++) {
    if (f.wins.has(code)) return true;
    if (moves >= f.budget) return false;
    let pick = Math.floor(rand() * n);
    if (rand() > noise) {
      let best = -Infinity;
      for (let m = 0; m < n; m++) {
        const nl = left[m] === 0 ? f.period[m] - 1 : left[m] - 1;
        const ncode = code + (nl - left[m]) * f.radix[m];
        // Same arithmetic order as engine.progressOf: sum over targets, then divide.
        let v: number;
        if (f.wins.has(ncode)) v = Infinity;
        else {
          let s = 0;
          for (let t = 0; t < n; t++) s += 1 - (t === m ? nl : left[t]) / f.period[t];
          v = s / n + rand() * 1e-6;
        }
        if (v > best) { best = v; pick = m; }
      }
    }
    const nl = left[pick] === 0 ? f.period[pick] - 1 : left[pick] - 1;
    code += (nl - left[pick]) * f.radix[pick];
    left[pick] = nl;
  }
  void score;
  return false;
}

const compiled = new Map<string, Fast>();
function fastOf(i: number, budget: number): Fast {
  const key = `${i}`;
  let f = compiled.get(key);
  if (!f) { f = compile(buildLevel(DESIGNS[i], i + 1, budget)); compiled.set(key, f); }
  return { ...f, budget };
}

/** Skilled + casual win-rates per level, exactly as `npm run playtest` reports them. */
export function replica(budgets: number[]): { skilled: number[]; casual: number[] } {
  seed = 1234567;
  const fs = budgets.map((b, i) => fastOf(i, b));
  const out: Record<string, number[]> = { skilled: [], casual: [] };
  for (const p of ["skilled", "casual"] as const) {
    for (const f of fs) {
      let wins = 0;
      for (let t = 0; t < TRIALS; t++) if (playOnce(f, PERSONAS[p])) wins++;
      out[p].push(Number((wins / TRIALS).toFixed(3)));
    }
  }
  return out as { skilled: number[]; casual: number[] };
}

/** The real engine through the same bot loop (slow) — used to prove the replica exact. */
function realReplica(budgets: number[]): { skilled: number[]; casual: number[] } {
  seed = 1234567;
  const defs = DESIGNS.map((d, i) => buildLevel(d, i + 1, budgets[i]));
  const out: Record<string, number[]> = { skilled: [], casual: [] };
  for (const p of ["skilled", "casual"] as const) {
    for (const def of defs) {
      let wins = 0;
      for (let t = 0; t < TRIALS; t++) {
        let s = startState(def), won = false;
        for (let n = 0; n < 400; n++) {
          const st = statusOf(s);
          if (st !== "playing") { won = st === "won"; break; }
          const moves = legalMoves(s);
          let pick = moves[Math.floor(rand() * moves.length)];
          if (rand() > PERSONAS[p]) {
            let best = -Infinity;
            for (const m of moves) {
              const next = applyMove(s, m);
              const v = statusOf(next) === "won" ? Infinity : progressOf(next) + rand() * 1e-6;
              if (v > best) { best = v; pick = m; }
            }
          }
          s = applyMove(s, pick);
        }
        if (won) wins++;
      }
      out[p].push(Number((wins / TRIALS).toFixed(3)));
    }
  }
  return out as { skilled: number[]; casual: number[] };
}

/** Target casual win-rate (soft) at level n (1-based). */
function target(n: number): number {
  const role = DESIGNS[n - 1].role;
  if (n <= 5) return 0.95;
  let t = 0.88 - 0.42 * ((n - 6) / (N - 6));
  if (role === "teach" || role === "breather") t += 0.06;
  if (role === "finale") t -= 0.05;
  return t;
}

function spearman(ys: number[]): number {
  // Same formula as the factory gate (rank by sort position, no tie averaging).
  const rank = (a: number[]) => { const o = a.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0]); const r = Array(a.length); o.forEach(([, i], k) => (r[i] = k)); return r as number[]; };
  const rx = rank(ys.map((_, i) => i)), ry = rank(ys);
  const n = ys.length;
  return 1 - (6 * rx.reduce((acc, v, i) => acc + (v - ry[i]) ** 2, 0)) / (n * (n * n - 1));
}

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

/** 0 when every pacing rule passes with margin; grows with each violation. */
export function score(r: { skilled: number[]; casual: number[] }, budgets: number[], pars: number[]): { hard: number; soft: number } {
  const c = r.casual, s = r.skilled;
  let hard = 0, soft = 0;
  const under = (v: number, lo: number) => Math.max(0, lo - v);
  const over = (v: number, hi: number) => Math.max(0, v - hi);
  const third = Math.max(3, Math.floor(N / 3));
  for (let i = 0; i < N; i++) {
    const n = i + 1;
    if (n <= 3) hard += under(c[i], 0.86);
    if (c[i] < 0.14 && s[i] < 0.65) hard += 1; // wall
    if (i >= 3) hard += over((c[i - 1] + c[i - 2] + c[i - 3]) / 3 - c[i], 0.3); // spike
    soft += Math.abs(c[i] - target(n)) * 0.3;
    if (budgets[i] < pars[i] + 2) soft += 0.05;
  }
  const mid = c.slice(third, N - third), late = c.slice(N - third), lateS = s.slice(N - third);
  hard += under(mean(mid), 0.55) + over(mean(mid), 0.8);
  hard += under(mean(late), 0.36) + over(mean(late), 0.6);
  hard += under(mean(lateS), 0.6) + over(mean(lateS), 0.92);
  // Easy-level pacing after level 5.
  let run = 0, easy = 0;
  for (let i = 5; i < N; i++) {
    if (c[i] >= 0.9) { easy++; run++; if (run > 2) hard += 0.2; } else run = 0;
  }
  hard += Math.max(0, easy - Math.floor(0.22 * (N - 5))) * 0.2;
  hard += over(spearman(c), -0.6);
  return { hard, soft };
}

if (require.main === module) {
  const pars = DESIGNS.map((d, i) => buildLevel(d, i + 1, 99).par);
  let budgets: number[] = (() => {
    try { const b = JSON.parse(readFileSync(FILE, "utf8")); if (Array.isArray(b)) return pars.map((p, i) => b[i] ?? p + 6); } catch { /* fresh */ }
    return pars.map((p, i) => p + (i < 5 ? 20 : 6));
  })();
  if (process.argv.includes("--verify")) {
    const a = replica(budgets), b = realReplica(budgets);
    const same = JSON.stringify(a) === JSON.stringify(b);
    console.log(same ? "replica == real engine" : `MISMATCH\nfast ${JSON.stringify(a)}\nreal ${JSON.stringify(b)}`);
    process.exit(same ? 0 : 1);
  }
  const total = (r: ReturnType<typeof replica>, b: number[]) => { const sc = score(r, b, pars); return sc.hard * 10 + sc.soft; };
  let cur = replica(budgets);
  let best = total(cur, budgets);
  const report = (r: ReturnType<typeof replica>) => {
    const sc = score(r, budgets, pars);
    const third = Math.max(3, Math.floor(N / 3));
    process.stderr.write(`hard ${sc.hard.toFixed(3)} soft ${sc.soft.toFixed(3)}  mid casual ${mean(r.casual.slice(third, N - third)).toFixed(2)}` +
      `  late casual ${mean(r.casual.slice(N - third)).toFixed(2)} skilled ${mean(r.skilled.slice(N - third)).toFixed(2)}  rho ${spearman(r.casual).toFixed(2)}\n`);
    for (let i = 0; i < N; i++) {
      process.stderr.write(`  L${i + 1} ${DESIGNS[i].role.padEnd(8)} par ${String(pars[i]).padStart(2)} budget ${String(budgets[i]).padStart(2)}  casual ${r.casual[i].toFixed(2)} skilled ${r.skilled[i].toFixed(2)}\n`);
    }
  };
  if (!process.argv.includes("--check")) {
    for (let pass = 0; pass < 6; pass++) {
      let improved = false;
      for (let i = 0; i < N; i++) {
        const lo = pars[i] + 1, hi = pars[i] + (i < 5 ? 30 : 16);
        for (let b = lo; b <= hi; b++) {
          if (b === budgets[i]) continue;
          const trial = budgets.slice(); trial[i] = b;
          const r = replica(trial);
          const t = total(r, trial);
          if (t < best - 1e-9) { best = t; budgets = trial; cur = r; improved = true; }
        }
      }
      process.stderr.write(`pass ${pass}: score ${best.toFixed(3)} hard ${score(cur, budgets, pars).hard.toFixed(3)}\n`);
      writeFileSync(FILE, JSON.stringify(budgets) + "\n");
      if (!improved) break;
    }
  }
  report(cur);
}
