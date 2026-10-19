/**
 * Flow Forge — board VIEW MODEL. Pure helpers that turn the engine's flow
 * snapshot into what the renderer needs: per-tile hub colour and per-arm fluid
 * colour (so fluid visibly stops where a pipe is still mis-rotated), plus the
 * HUD objective line. No React here — just data for PipeBoard.
 */
import {
  Cell, Color, LevelDef, N, E, S, W, DIRS, maskAt, flow,
} from "./engine";

export const COLOR_HEX: Record<Color, { fluid: string; glow: string; light: string }> = {
  blue: { fluid: "#2EC4FF", glow: "rgba(46,196,255,0.55)", light: "#D8F6FF" },
  red: { fluid: "#FF5D5D", glow: "rgba(255,93,93,0.55)", light: "#FFE1DC" },
  green: { fluid: "#43A047", glow: "rgba(67,160,71,0.55)", light: "#B6E8B8" },
  yellow: { fluid: "#FFB300", glow: "rgba(255,179,0,0.55)", light: "#FFE49B" },
};

const OPP: Record<number, number> = { [N]: S, [E]: W, [S]: N, [W]: E };

/** Rotate a single-port bit `r` quarter-turns clockwise (N→E→S→W). */
export function rotateDir(d: number, r: number): number {
  let m = d & 15;
  for (let i = 0; i < ((r % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 15;
  return m;
}

function neighbor(idx: number, dir: number, w: number, h: number): number {
  const r = (idx / w) | 0, c = idx % w;
  if (dir === N) return r > 0 ? idx - w : -1;
  if (dir === S) return r < h - 1 ? idx + w : -1;
  if (dir === E) return c < w - 1 ? idx + 1 : -1;
  return c > 0 ? idx - 1 : -1;
}

export type FlowView = ReturnType<typeof flow>;

/** Per-tile fluid, expressed in the tile's BASE (unrotated) frame so the
 *  renderer can draw once and spin the whole tile to `rot`. */
export interface TileFluid {
  /** Colour filling the tile body (hub), or null. */
  body: Color | null;
  /** Fluid colour carried by the arm pointing at each base direction. */
  arm: Partial<Record<number, Color | null>>;
  /** True when a sink tile is satisfied (its colour, no foreign). */
  solvedSink: boolean;
}

export function tileFluid(def: LevelDef, rot: number[], fv: FlowView, i: number): TileFluid {
  const { w, h, cells } = def;
  const cell = cells[i];
  const here = def.colors.filter((c) => fv.byColor[c][i]);
  const arm: Partial<Record<number, Color | null>> = {};
  for (const bd of DIRS) {
    if (!(cell.m & bd)) continue;
    const d = rotateDir(bd, rot[i]); // where this arm actually points now
    const nb = neighbor(i, d, w, h);
    let col: Color | null = null;
    if (nb >= 0) {
      const nbCell = cells[nb];
      for (const c of here) {
        if (!fv.byColor[c][nb]) continue;
        if (nbCell.t === "empty") continue;
        if (nbCell.g && nbCell.c !== c) continue;
        if (cell.g && cell.c !== c) continue;
        if (maskAt(nbCell.m, rot[nb]) & OPP[d]) { col = c; break; }
      }
    }
    arm[bd] = col;
  }
  const sinkIdx = fv.sinks.indexOf(i);
  return {
    body: here[0] ?? null,
    arm,
    solvedSink: sinkIdx >= 0 ? fv.satisfied[sinkIdx] : false,
  };
}

/** The visual shape a cell draws (independent of fluid). */
export type Shape = "straight" | "elbow" | "tee" | "cross" | "source" | "sink" | "none";
export function shapeOf(cell: Cell): Shape {
  if (cell.t === "source") return "source";
  if (cell.t === "sink") return "sink";
  if (cell.t === "empty") return "none";
  if (cell.x || cell.t === "cross") return "cross";
  const bits = DIRS.filter((d) => cell.m & d).length;
  if (bits >= 3) return "tee";
  if (bits === 2) {
    // straight = opposite ports (N|S or E|W)
    return cell.m === (N | S) || cell.m === (E | W) ? "straight" : "elbow";
  }
  return "straight";
}

/** Short human objective line per chapter, for the HUD goal text. */
export function goalFor(def: LevelDef): string {
  const drains = def.cells.filter((c) => c.t === "sink").length;
  const crosses = def.cells.some((c) => c.x);
  if (def.colors.length >= 3) return crosses ? "Route all three fluids home. Use the overpasses" : "Route all three fluids to their drains";
  if (drains > def.colors.length) return "Fill every drain. Tees split the flow";
  if (crosses) return "Cross the fluids on the overpass. Never mix them";
  if (def.colors.length === 2) return "Route both fluids to their matching drains";
  return "Rotate the pipes to connect source to drain";
}

/**
 * The solved route of a level, source → drain, as an ordered list of cell
 * indices (the first source's route). Used by the tutorial guide to draw the
 * dotted path and to pick the next pipe a beginner should turn.
 */
export function routeOf(def: LevelDef): number[] {
  const { w, h, cells, solution } = def;
  const src = cells.findIndex((c) => c.t === "source");
  if (src < 0) return [];
  const prev = new Map<number, number>([[src, -1]]);
  const queue = [src];
  while (queue.length) {
    const i = queue.shift()!;
    const cell = cells[i];
    if (cell.t === "sink" && cell.c === cells[src].c) {
      const out: number[] = [];
      for (let k = i; k >= 0; k = prev.get(k)!) out.unshift(k);
      return out;
    }
    const m = maskAt(cell.m, solution[i]);
    for (const d of DIRS) {
      if (!(m & d)) continue;
      const nb = neighbor(i, d, w, h);
      if (nb < 0 || prev.has(nb) || cells[nb].t === "empty") continue;
      if (!(maskAt(cells[nb].m, solution[nb]) & OPP[d])) continue;
      prev.set(nb, i);
      queue.push(nb);
    }
  }
  return [];
}

/** Lit joints between neighbouring tiles ("<i>E" / "<i>S" → colour). */
export function litJoints(def: LevelDef, rot: number[], fluids: TileFluid[]): Map<string, Color> {
  const out = new Map<string, Color>();
  def.cells.forEach((cell, i) => {
    for (const bd of DIRS) {
      const col = fluids[i]?.arm[bd];
      if (!col || !(cell.m & bd)) continue;
      const d = rotateDir(bd, rot[i]);
      if (d === E || d === S) out.set(`${i}${d === E ? "E" : "S"}`, col);
    }
  });
  return out;
}
