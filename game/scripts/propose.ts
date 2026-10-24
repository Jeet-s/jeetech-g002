/// <reference types="node" />
/**
 * Flow Forge level PROPOSER — a designer's assistant, never the designer. It grows random
 * pipe networks for a brief (sizes, fluids, which pipes are shared, overpasses, filters,
 * gears, mixer vats), scrambles them and keeps only boards the real engine proves have ONE
 * answer (or a few harmless variants), a small search space and the feature doing real work
 * (filters / gears / overpasses that actually matter). A human then picks a candidate, edits
 * it and writes its intent into src/game/designs.ts.
 *
 *   npx tsx scripts/propose.ts '{"w":5,"h":4,"nets":[{"src":"br","dst":"pb"}],"gears":1,"count":4}'
 *
 * Brief fields: w, h, nets [{src: source letters, dst: drain letters}] (one network = one
 * connected pipe tree; several sources in one net share pipes), crosses (max overpasses),
 * gears (pairs), bolts (share of route pipes bolted), decoys (share of free cells), parMin,
 * parMax, maxWins, seed, count, tries, needGears/needGates/needCross (feature must matter).
 */
import { buildLevel } from "../src/game/levels";
import { Design } from "../src/game/designs";
import { LevelDef, isWon, startState } from "../src/game/engine";
import { shortest, solutions } from "./level-lab";

type Brief = {
  w: number; h: number; nets: { src: string; dst: string }[];
  crosses?: number; gears?: number; bolts?: number; decoys?: number;
  parMin?: number; parMax?: number; maxWins?: number; seed?: number; count?: number; tries?: number;
  needGears?: boolean; needGates?: boolean; needCross?: boolean; maxExplored?: number; minTaps?: number;
  minFill?: number; minW?: number; minH?: number; selfCross?: boolean;
};
const B: Brief = JSON.parse(process.argv[2] ?? "{}");
const { w, h } = B;
let seed = B.seed ?? 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

const N = 1, E = 2, S = 4, W = 8;
const DIRS = [N, E, S, W];
const OPP: Record<number, number> = { [N]: S, [E]: W, [S]: N, [W]: E };
const DR: Record<number, [number, number]> = { [N]: [-1, 0], [E]: [0, 1], [S]: [1, 0], [W]: [0, -1] };
const LIGHT: Record<number, string> = { [N | S]: "│", [E | W]: "─", [N | E]: "└", [E | S]: "┌", [S | W]: "┐", [W | N]: "┘", [N | E | S]: "├", [E | S | W]: "┬", [S | W | N]: "┤", [W | N | E]: "┴" };
const HEAVY: Record<number, string> = { [N | S]: "┃", [E | W]: "━", [N | E]: "┗", [E | S]: "┏", [S | W]: "┓", [W | N]: "┛", [N | E | S]: "┣", [E | S | W]: "┳", [S | W | N]: "┫", [W | N | E]: "┻" };
const bits = (m: number) => DIRS.filter((d) => m & d).length;

interface Cell { kind: "free" | "pipe" | "end" | "cross"; ports: number; net: number; letter?: string; cross?: [number, number] }

function grow(): { grid: Cell[]; nets: number } | null {
  const grid: Cell[] = Array.from({ length: w * h }, () => ({ kind: "free", ports: 0, net: -1 }));
  const nb = (i: number, d: number) => {
    const r = Math.floor(i / w) + DR[d][0], c = (i % w) + DR[d][1];
    return r < 0 || c < 0 || r >= h || c >= w ? -1 : r * w + c;
  };
  let crosses = B.crosses ?? 0;
  const free = () => grid.map((c, i) => (c.kind === "free" ? i : -1)).filter((i) => i >= 0);
  for (let n = 0; n < B.nets.length; n++) {
    const net = B.nets[n];
    const ends = [...net.src.split("").map((l) => l.toUpperCase()), ...net.dst.split("")];
    // first endpoint: anywhere free with a free neighbour
    const tree: number[] = [];
    for (let e = 0; e < ends.length; e++) {
      const cand = free().filter((i) => DIRS.some((d) => nb(i, d) >= 0 && grid[nb(i, d)].kind === "free"));
      if (!cand.length) return null;
      const at = pick(cand);
      grid[at] = { kind: "end", ports: 0, net: n, letter: ends[e] };
      if (e === 0) { tree.push(at); continue; }
      // Dijkstra with random costs from `at` to any attachable tree cell.
      const dist = new Map<number, number>(); const prev = new Map<number, number>();
      const key = (i: number, d: number) => i * 16 + d;
      const q: [number, number, number][] = [];
      for (const d of DIRS) {
        const j = nb(at, d);
        if (j < 0) continue;
        q.push([1 + rnd() * 3, j, d]);
        dist.set(key(j, d), q[q.length - 1][0]); prev.set(key(j, d), -1);
      }
      let hit: [number, number] | null = null;
      while (q.length) {
        q.sort((a, b) => a[0] - b[0]);
        const [cost, i, dIn] = q.shift()!;
        if (cost > (dist.get(key(i, dIn)) ?? Infinity)) continue;
        const cell = grid[i];
        const attach = (cell.net === n && ((cell.kind === "pipe" && bits(cell.ports) === 2) || (cell.kind === "end" && cell.ports === 0 && i !== at)));
        if (attach) { hit = [i, dIn]; break; }
        let nexts: number[] = [];
        if (cell.kind === "free") nexts = DIRS;
        else if (cell.kind === "pipe" && (cell.net !== n || B.selfCross) && crosses > 0 && (cell.ports === (N | S) || cell.ports === (E | W)) && !(cell.ports & dIn)) nexts = [dIn];
        for (const d of nexts) {
          const j = nb(i, d);
          if (j < 0) continue;
          const nc = cost + 1 + rnd() * 3;
          if (nc < (dist.get(key(j, d)) ?? Infinity)) { dist.set(key(j, d), nc); prev.set(key(j, d), key(i, dIn)); q.push([nc, j, d]); }
        }
      }
      if (!hit) return null;
      // Walk back: lay ports.
      let [ci, cd] = hit;
      let k = key(ci, cd);
      grid[ci].ports |= OPP[cd];
      if (grid[ci].kind === "end" && bits(grid[ci].ports) > 1) return null;
      for (;;) {
        const pk = prev.get(k)!;
        const prevCell = pk === -1 ? at : Math.floor(pk / 16);
        // the step went prevCell --cd--> ci
        const pc = grid[prevCell];
        if (pk === -1) { pc.ports |= cd; break; }
        if (pc.kind === "pipe" && (pc.net !== n || (B.selfCross && bits(pc.ports) === 2 && (pc.ports & cd) === 0 && pc.ports !== 0))) { // crossing
          grid[prevCell] = { kind: "cross", ports: 15, net: -2, cross: [pc.net, n] };
          crosses--;
        } else {
          pc.kind = "pipe"; pc.net = n; pc.ports |= cd;
        }
        const pd = pk % 16;
        if (grid[prevCell].kind !== "cross") grid[prevCell].ports |= OPP[pd];
        ci = prevCell; cd = pd; k = pk;
      }
      tree.push(at);
    }
  }
  return { grid, nets: B.nets.length };
}

function toDesign(g: Cell[]): { design: Design; loose: [number, number][] } | null {
  const solved: string[] = [];
  const loose: [number, number][] = [];
  const decoyShare = B.decoys ?? 0.3;
  for (let r = 0; r < h; r++) {
    let row = "";
    for (let c = 0; c < w; c++) {
      const cell = g[r * w + c];
      if (cell.kind === "end") row += cell.letter;
      else if (cell.kind === "cross") row += "+";
      else if (cell.kind === "pipe") {
        if (bits(cell.ports) < 2) return null;
        const bolt = rnd() < (B.bolts ?? 0);
        row += (bolt ? HEAVY : LIGHT)[cell.ports];
        if (!bolt) loose.push([r, c]);
      } else if (rnd() < decoyShare) {
        row += pick(["│", "─", "└", "┌", "┐", "┘", "└", "┌", "┐", "┘", "┬"]);
        loose.push([r, c]);
      } else row += ".";
    }
    solved.push(row);
  }
  return { design: { chapter: 9, role: "practise", solved, taps: [], intent: "", mechanics: [] }, loose };
}

const found: string[] = [];
const why: Record<string, number> = {};
const no = (r: string) => { why[r] = (why[r] ?? 0) + 1; };
const tries = B.tries ?? 4000;
for (let t = 0; t < tries && found.length < (B.count ?? 5); t++) {
  const g = grow();
  if (!g) { no("grow"); continue; }
  const td = toDesign(g.grid);
  if (!td) { no("design"); continue; }
  const { design, loose } = td;
  // gears: random pairs of loose cells
  const gears: string[][] = [];
  const pool = loose.slice();
  for (let k = 0; k < (B.gears ?? 0) && pool.length >= 2; k++) {
    const a = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    const b = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    gears.push([`${a[0]},${a[1]}`, `${b[0]},${b[1]}`]);
  }
  design.gears = gears.length ? gears : undefined;
  // scramble
  const taps = design.solved.map((row) => [...row].map(() => "."));
  const groupK = gears.map(() => 1 + Math.floor(rnd() * 3));
  for (const [r, c] of loose) {
    const ch = [...design.solved[r]][c];
    const o = "│─".includes(ch) ? 2 : 4;
    const gi = gears.findIndex((gg) => gg.includes(`${r},${c}`));
    const isDecoy = g.grid[r * w + c].kind === "free";
    let k = gi >= 0 ? groupK[gi] : isDecoy ? 0 : Math.floor(rnd() * o);
    if (gi < 0 && !isDecoy && k === 0 && rnd() < 0.7) k = 1 + Math.floor(rnd() * (o - 1));
    taps[r][c] = String(k % o);
  }
  design.taps = taps.map((row) => row.join(""));
  // Filters on the pipe feeding each pure drain of a network that carries several colours.
  const gates: Record<string, "b" | "r" | "g" | "y"> = {};
  g.grid.forEach((cell, i) => {
    if (cell.kind !== "end" || cell.letter === "p" || cell.letter !== cell.letter!.toLowerCase()) return;
    if (B.nets[cell.net].src.length < 2) return;
    const d = [N, E, S, W].find((dd) => cell.ports & dd)!;
    const j = i + ({ [N]: -w, [E]: 1, [S]: w, [W]: -1 } as Record<number, number>)[d];
    if (g.grid[j]?.kind === "pipe") gates[`${Math.floor(j / w)},${j % w}`] = cell.letter as "b";
  });
  // Crop blocked border rows / columns, then demand a well-filled board.
  {
    const rows = design.solved.map((r) => [...r]);
    const tp = design.taps.map((r) => [...r]);
    const usedR = rows.map((r) => r.some((ch) => ch !== "."));
    const usedC = rows[0].map((_, c) => rows.some((r) => r[c] !== "."));
    const r0 = usedR.indexOf(true), r1 = usedR.lastIndexOf(true), c0 = usedC.indexOf(true), c1 = usedC.lastIndexOf(true);
    const remap = (key: string) => { const [r, c] = key.split(",").map(Number); return `${r - r0},${c - c0}`; };
    design.solved = rows.slice(r0, r1 + 1).map((r) => r.slice(c0, c1 + 1).join(""));
    design.taps = tp.slice(r0, r1 + 1).map((r) => r.slice(c0, c1 + 1).join(""));
    if (design.gears) design.gears = design.gears.map((gg) => gg.map(remap));
    if (Object.keys(gates).length) design.gates = Object.fromEntries(Object.entries(gates).map(([k, v]) => [remap(k), v]));
    const cells = design.solved.join("");
    const fill = [...cells].filter((ch) => ch !== ".").length / [...cells].length;
    if (fill < (B.minFill ?? 0.7) || design.solved.length < (B.minH ?? 3) || [...design.solved[0]].length < (B.minW ?? 4)) { no("fill"); continue; }
  }
  let def: LevelDef;
  try {
    def = buildLevel(design, 99, 999);
  } catch (e) { no("build: " + String(e).replace(/L99: /, "").replace(/\d+,\d+/, "").slice(0, 40)); continue; }
  if (!isWon(def, def.solution)) { no("notwon"); continue; }
  if (def.taps.length < (B.minTaps ?? 5)) { no("taps"); continue; }
  if (def.par < (B.parMin ?? 6) || def.par > (B.parMax ?? 12)) { no("par"); continue; }
  const sol = solutions(def, 400_000);
  if (!sol || sol.wins > (B.maxWins ?? 1) || sol.fewest !== def.par) { no("wins"); continue; }
  if (B.needGears && design.gears) {
    const plain = buildLevel({ ...design, gears: undefined }, 99, 999);
    const ps = solutions(plain, 2_000_000);
    // Gears must CONSTRAIN: without them a cheaper (different) answer would exist.
    if (!ps || ps.fewest >= sol.fewest) { no("gears-unneeded"); continue; }
  }
  if (B.needGates && design.gates) {
    let essential = true;
    try {
      const plain = buildLevel({ ...design, gates: undefined }, 99, 999);
      const ps = solutions(plain, 400_000);
      essential = !!ps && ps.wins === 0;
    } catch { /* the plain board cannot even be read as a win: filters are essential */ }
    if (!essential) { no("gates-unneeded"); continue; } // must be unsolvable without its filters
  }
  if (B.needCross && !design.solved.some((r) => r.includes("+"))) continue;
  const sp = shortest(startState(def));
  if (sp.optimal === null || sp.explored > (B.maxExplored ?? 20000)) { no("explored"); continue; }
  const out = `// par ${def.par} taps ${def.taps.length} explored ${sp.explored} wins ${sol.wins}\n` +
    `{ solved: ${JSON.stringify(design.solved)}, taps: ${JSON.stringify(design.taps)}` +
    `${design.gates ? `, gates: ${JSON.stringify(design.gates)}` : ""}${design.gears ? `, gears: ${JSON.stringify(design.gears)}` : ""} },`;
  found.push(out);
  console.log(out);
  console.log(design.solved.map((r) => "    " + r).join("\n"));
}
if (!found.length) console.log("nothing found");
console.error(JSON.stringify(why));
