/// <reference types="node" />
/**
 * Scramble search for one hand-authored level: keeps the designed board (and
 * every bolted piece / decoy) exactly as authored and only re-deals how far the
 * loose route pipes start from solved, looking for a deal whose bot win-rates
 * can sit inside the level's pacing band at some budget.
 *
 *   npx tsx scripts/scramble-search.ts <level> <casualLo> <casualHi> [parMin] [parMax]
 * Prints candidate taps grids (paste the one you like into designs.ts).
 */
import { DESIGNS } from "../src/game/designs";
import { buildLevel } from "../src/game/levels";
import { applyMove, legalMoves, progressOf, startState, statusOf } from "../src/game/engine";
import { playOnce } from "./bots";
import { shortest } from "./level-lab";

const [lvl, lo, hi, pmin, pmax] = process.argv.slice(2).map(Number);
if (!DESIGNS[lvl - 1]) throw new Error(`no level ${process.argv.slice(2)}`);
const base = DESIGNS[lvl - 1];
const sim = { moves: legalMoves, apply: applyMove, status: statusOf, progress: progressOf } as never;
const basePar = buildLevel(base, lvl, 400).par;
const parMin = pmin || basePar - 1, parMax = pmax || basePar + 1;

let seed = 99 + lvl;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const tried = new Set<string>();
const found: string[] = [];
for (let it = 0; it < 400 && found.length < 6; it++) {
  // Perturb the authored deal: re-deal 1-3 loose pipes, keep the rest as designed.
  const grid = base.taps.map((row) => [...row]);
  const loose: [number, number][] = [];
  grid.forEach((row, r) => row.forEach((ch, c) => { if (ch !== "." && ch !== "0") loose.push([r, c]); }));
  const changes = 1 + Math.floor(rnd() * 3);
  for (let k = 0; k < changes; k++) {
    const [r, c] = loose[Math.floor(rnd() * loose.length)];
    const o = "│─".includes([...base.solved[r]][c]) ? 2 : 4;
    grid[r][c] = String(1 + Math.floor(rnd() * (o - 1)));
  }
  const taps = grid.map((row) => row.join(""));
  const key = taps.join("/");
  if (tried.has(key)) continue;
  tried.add(key);
  let def;
  try { def = buildLevel({ ...base, taps }, lvl, 400); } catch { continue; }
  if (def.par < parMin || def.par > parMax) continue;
  const runs = (noise: number) => { const r: number[] = []; for (let t = 0; t < 1200; t++) r.push(playOnce(sim, startState(def), noise).moves); return r; };
  const cas = runs(0.3), ski = runs(0.08);
  for (let b = def.par + 2; b <= def.par + 16; b += 2) {
    const c = cas.filter((m) => m <= b).length / cas.length;
    const s = ski.filter((m) => m <= b).length / ski.length;
    if (c >= lo && c <= hi && s >= 0.6 && s <= 0.96) {
      def.budget = b;
      const opt = shortest(startState(def));
      if (opt.optimal === null) break;
      found.push(`par ${def.par} budget ${b} casual ${c.toFixed(2)} skilled ${s.toFixed(2)} explored ${opt.explored}  taps: ${JSON.stringify(taps)}`);
      console.log(found[found.length - 1]);
      break;
    }
  }
}
if (!found.length) console.log("no deal found");
