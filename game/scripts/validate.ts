/// <reference types="node" />
/**
 * Level validation — run by the factory's QA with `npm run validate`.
 *
 * For Flow Forge every level is loaded through the REAL engine (src/game/*):
 *   • PROOF OF SOLVABILITY — we set every tile to its recorded solution
 *     orientation and confirm the engine reports the level WON (fluids reach
 *     every matching sink). We also confirm the scrambled start is NOT already
 *     won, so each level is a genuine puzzle.
 *   • DIFFICULTY — a solver-flavoured number: optimal taps (par) weighted by
 *     branching (how many orientations each routed tile could take) and the
 *     number of fluid colours that must be kept apart. It rises as grids grow,
 *     pipes gain turns, and colours are added.
 *
 * Final stdout line (required): {"levels": N, "solvable": N, "difficulty": [...]}
 * Exit non-zero if any level is unsolvable or fewer than 30 exist.
 */
import { LEVELS } from "../src/game/levels";
import { isWon, maskAt } from "../src/game/engine";

let solvable = 0;
const difficulty: number[] = [];
const problems: string[] = [];

for (const lvl of LEVELS) {
  const startRot = lvl.cells.map((c) => c.r);
  const solvedRot = lvl.solution.slice();

  const winsWhenSolved = isWon(lvl, solvedRot);
  const trivialAtStart = isWon(lvl, startRot);
  if (!winsWhenSolved) problems.push(`${lvl.id}: stored solution does not win`);
  if (trivialAtStart) problems.push(`${lvl.id}: already solved at start`);
  if (winsWhenSolved && !trivialAtStart) solvable++;

  // Difficulty = par × average branching × colours (+ overpass complexity).
  const rot = lvl.rotatable;
  const avgOrient = rot.length ? rot.reduce((a, i) => a + lvl.cells[i].o, 0) / rot.length : 1;
  const crosses = lvl.cells.filter((c) => c.x).length;
  const d = (lvl.par + rot.length) * avgOrient * lvl.colors.length + crosses * 4;
  difficulty.push(Math.round(d * 100) / 100);

  // Sanity: the solution orientation really does face solved ports (rot 0 for pipes).
  for (const i of rot) {
    if (maskAt(lvl.cells[i].m, solvedRot[i]) !== lvl.cells[i].m) {
      problems.push(`${lvl.id}: cell ${i} solution not canonical`);
    }
  }
}

// Report curve health to stderr for tuning (QA gates on the JSON line below).
if (LEVELS.length >= 6) {
  const third = Math.max(1, Math.floor(LEVELS.length / 3));
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const early = avg(difficulty.slice(0, third));
  const late = avg(difficulty.slice(-third));
  process.stderr.write(
    `curve: early≈${early.toFixed(1)} late≈${late.toFixed(1)} ratio≈${(late / early).toFixed(2)}x\n`,
  );
}
for (const p of problems) process.stderr.write(`PROBLEM ${p}\n`);

console.log(JSON.stringify({ levels: LEVELS.length, solvable, difficulty }));
process.exit(solvable === LEVELS.length && LEVELS.length >= 30 && !problems.length ? 0 : 1);
