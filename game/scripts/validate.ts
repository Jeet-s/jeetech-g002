/// <reference types="node" />
/**
 * Level validation — run by the factory's QA with `npm run validate`.
 *
 * For Flow Forge every level is loaded through the REAL engine (src/game/*):
 *   • PROOF OF SOLVABILITY — starting from the level's real start board we
 *     REPLAY a solution as a player would: tap after tap through
 *     engine.applyMove (gear groups turn together), following engine.nextTap
 *     toward the stored solved board, and require statusOf() === "won" within
 *     the level's move budget. The scrambled start must NOT already be won.
 *   • INTEGRITY — every endpoint/filter/gear is well formed, every level is a
 *     distinct puzzle (no identical start boards), budgets leave room (≥ par + 1).
 *   • DIFFICULTY — a solver-flavoured number: (optimal taps + independent
 *     pieces) × average orientations × fluids, plus weight for every overpass,
 *     filter, gear group, mixer vat and bolted anchor the player must read, plus
 *     the CONCEPT LOAD: how many rule families the board mixes (second / third
 *     fluid, bolts, splitters, overpasses, filters, gears, vats).
 *
 * Final stdout line (required): {"levels": N, "solvable": N, "difficulty": [...]}
 * Exit non-zero if any level is unsolvable or fewer than 30 exist.
 */
import { LEVELS } from "../src/game/levels";
import { applyMove, nextTap, startState, statusOf, isWon, turnsWith } from "../src/game/engine";

let solvable = 0;
const difficulty: number[] = [];
const problems: string[] = [];
const seen = new Map<string, number>();

for (const lvl of LEVELS) {
  const startRot = lvl.cells.map((c) => c.r);
  if (isWon(lvl, startRot)) problems.push(`${lvl.id}: already solved at start`);

  // Replay: tap the solver's next target until the engine reports the win.
  let s = startState(lvl);
  let guard = 0;
  while (statusOf(s) === "playing" && guard++ < 400) {
    const t = nextTap(lvl, s.rot);
    if (t === null) break;
    s = applyMove(s, t);
  }
  const won = statusOf(s) === "won";
  if (!won) problems.push(`${lvl.id}: replaying the solution did not win (status ${statusOf(s)} after ${s.moves} taps)`);
  else if (s.moves > lvl.par) problems.push(`${lvl.id}: solution took ${s.moves} taps, par says ${lvl.par}`);
  if (lvl.budget < lvl.par + 1) problems.push(`${lvl.id}: budget ${lvl.budget} leaves no room over par ${lvl.par}`);
  if (won && !isWon(lvl, startRot)) solvable++;

  // Every gear group really turns together; every tap target is a loose pipe.
  for (const i of lvl.taps) {
    if (lvl.cells[i].f) problems.push(`${lvl.id}: tap target ${i} is fixed`);
    if (turnsWith(lvl, i).some((j) => lvl.cells[j].f)) problems.push(`${lvl.id}: gear group of ${i} holds a fixed pipe`);
  }

  const key = JSON.stringify([lvl.w, lvl.h, lvl.cells, lvl.groups]);
  if (seen.has(key)) problems.push(`${lvl.id}: same start board as L${seen.get(key)}`);
  seen.set(key, lvl.number);

  // Difficulty: what the player has to read and do.
  const rot = lvl.rotatable;
  const avgOrient = rot.length ? rot.reduce((a, i) => a + lvl.cells[i].o, 0) / rot.length : 1;
  const crosses = lvl.cells.filter((c) => c.x).length;
  const filters = lvl.cells.filter((c) => c.g).length;
  const vats = lvl.cells.filter((c) => c.t === "sink" && c.c === "purple").length;
  const bolted = lvl.cells.filter((c) => c.t === "pipe" && c.f).length;
  const tees = lvl.cells.some((c) => (c.t === "pipe" || c.t === "gate") && [1, 2, 4, 8].filter((b) => c.m & b).length === 3);
  const families = [lvl.colors.length >= 2, lvl.colors.length >= 3, bolted > 0, tees, crosses > 0, filters > 0, lvl.groups.length > 0, vats > 0]
    .filter(Boolean).length;
  const d = (lvl.par + lvl.taps.length) * avgOrient * lvl.colors.length
    + crosses * 4 + filters * 3 + lvl.groups.length * 5 + vats * 5 + bolted + families * 15;
  difficulty.push(Math.round(d * 100) / 100);
}

// Report curve health to stderr for tuning (QA gates on the JSON line below).
if (LEVELS.length >= 10) {
  const k = Math.max(3, Math.round(LEVELS.length * 0.2));
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const early = avg(difficulty.slice(0, k));
  const late = avg(difficulty.slice(-k));
  process.stderr.write(`curve: early≈${early.toFixed(1)} late≈${late.toFixed(1)} ratio≈${(late / early).toFixed(2)}x\n`);
}
for (const p of problems) process.stderr.write(`PROBLEM ${p}\n`);

console.log(JSON.stringify({ levels: LEVELS.length, solvable, difficulty }));
process.exit(solvable === LEVELS.length && LEVELS.length >= 30 && !problems.length ? 0 : 1);
