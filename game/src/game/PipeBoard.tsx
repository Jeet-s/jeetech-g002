/**
 * Flow Forge — the board renderer (Skia), drawn with the studio art
 * (assets/art): painted-steel pipe sprites seated in an anodized-teal tray.
 *
 * Every pipe is the same sprite in two states: an EMPTY copy (colour-matrixed
 * to dark satin steel with dry glass) and a FILLED copy (the luminous fluid —
 * the sprite's own cyan, hue-shifted for red / green / yellow) that is clipped
 * to exactly the arms the fluid reaches, so a mis-rotated pipe visibly breaks
 * the line. Fluid fades in with a 600 ms glow sweep, bubbles drift through lit
 * pipes, sources pulse a ring every 1.2 s, drains glow in their colour and a
 * leaking pipe flashes a red double-beat.
 *
 * FEEL: a tap reacts the INSTANT the finger lands (onPressIn: a 1.06 press
 * swell and a soft blue glow ring) and the engine's new rotation spins the
 * pipe a 150 ms quarter turn with an elastic settle. The drawn angle is driven
 * only by the engine state, so the board is always what the game evaluates. Every joint a
 * turn makes sends a pulse of the fluid's colour through both pipes and 7
 * sparks out of the seam; a joint it breaks puffs pale steam. Tapping a bolted
 * piece flashes a red X on that tile with a short "Blocked" toast.
 * Pure presentational — logic stays in the engine.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import {
  Canvas, Circle, ColorMatrix, DashPathEffect, Group, Image as SkImage, LinearGradient as SkGradient,
  Path, RadialGradient, RoundedRect, Skia, useImage, vec, type SkImage as SkImageT,
} from "@shopify/react-native-skia";
import {
  Easing, makeMutable, useDerivedValue, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Cell, Color, LevelDef, N, E, S, W, DIRS } from "./engine";
import { FlowView, TileFluid, litJoints, tileFluid } from "./board";
import { art } from "../art";
import { NineSlice, feedback, fonts, haptic, palette, springs } from "../ui";

// ── Board chrome (shared with GameScreen so fit maths + overlays match) ──────
/** The part of the level grid that holds pieces. Fully empty outer rows /
 *  columns are walls either way (flow can't enter an empty cell or leave the
 *  grid), so the board frames only this window and spends the space on bigger
 *  tiles instead of dead margin. */
export function boardView(def: LevelDef) {
  let r0 = def.h, r1 = -1, c0 = def.w, c1 = -1;
  def.cells.forEach((c, i) => {
    if (c.t === "empty") return;
    const r = (i / def.w) | 0, col = i % def.w;
    r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, col); c1 = Math.max(c1, col);
  });
  if (r1 < 0) return { r0: 0, c0: 0, rows: def.h, cols: def.w };
  return { r0, c0, rows: r1 - r0 + 1, cols: c1 - c0 + 1 };
}
/** Bezel (tray art) + inner well around the grid, in dp, for a tile size. */
export function boardChrome(tile: number) {
  const bezel = Math.round(Math.max(12, Math.min(20, tile * 0.2)));
  const well = Math.round(tile * 0.1);
  return { bezel, well, edge: bezel + well };
}

/** Per-tile visual state the touch overlay drives imperatively (no React round-trip). */
interface TileAnim {
  angle: SharedValue<number>; // live rotation in degrees
  scale: SharedValue<number>;
  flash: SharedValue<number>; // white glow (tap / win)
  error: SharedValue<number>; // red leak pulse
  fill: SharedValue<number>; // 0..1 fluid fill sweep
  ring: SharedValue<number>; // soft blue glow ring around a tapped tile
  pulse: SharedValue<number>; // fluid-coloured pulse when a joint connects
  deny: SharedValue<number>; // red X on a tap that can't rotate anything
}

/** Quarter-turn: 150 ms with a small elastic overshoot past the 90°. */
const TURN = { duration: 150, easing: Easing.out(Easing.back(2.2)) };

interface Sprites {
  straight: SkImageT | null; elbow: SkImageT | null; blocker: SkImageT | null;
  source: SkImageT | null; drainBlue: SkImageT | null; drainRed: SkImageT | null; sweep: SkImageT | null;
}

// ── Colour ───────────────────────────────────────────────────────────────────
const FLUID: Record<Color, { glow: string; hot: string }> = {
  blue: { glow: "#2EC4FF", hot: "#D8F6FF" },
  red: { glow: "#FF5D5D", hot: "#FFE1DC" },
  green: { glow: "#4FE38A", hot: "#E2FFEC" },
  yellow: { glow: "#FFC23D", hot: "#FFF4D6" },
};
/** Hue rotation (feColorMatrix) that turns the sprite's cyan fluid into each colour. */
function hueMatrix(deg: number, gain = 1): number[] {
  const c = Math.cos((deg * Math.PI) / 180), s = Math.sin((deg * Math.PI) / 180);
  const m = [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ].map((v) => v * gain);
  return [m[0], m[1], m[2], 0, 0, m[3], m[4], m[5], 0, 0, m[6], m[7], m[8], 0, 0, 0, 0, 0, 1, 0];
}
const HUE: Record<Color, number[] | null> = {
  blue: null, // the art's own cyan
  red: hueMatrix(162, 1.05),
  green: hueMatrix(-72),
  yellow: hueMatrix(-150, 1.08),
};
/** Dry pipe: dark satin steel; the cyan glass reads as an empty dark tube. */
const LW = [0.62, 0.26, 0.12];
const DRY = [
  ...LW.map((v) => v * 1.22), 0, 0,
  ...LW.map((v) => v * 1.34), 0, 0,
  ...LW.map((v) => v * 1.5), 0, 0,
  0, 0, 0, 1, 0,
];

// Global flow clock — drives the drifting bubbles in every lit pipe.
const FLOW_CLOCK = makeMutable(0);
let flowStarted = false;

// ── Geometry (cell-local 0..T frame) ─────────────────────────────────────────
function openDirs(cell: Cell) {
  return DIRS.filter((d) => cell.m & d);
}
function edgePt(d: number, T: number) {
  const c = T / 2;
  if (d === N) return [c, 0];
  if (d === S) return [c, T];
  if (d === E) return [T, c];
  return [0, c];
}
/** Centre-line of the given arms: through the middle, rounded on a bend. */
function armsPath(dirs: number[], T: number): string {
  const c = T / 2;
  if (dirs.length === 2) {
    const [a, b] = dirs.map((d) => edgePt(d, T));
    return `M${a[0]} ${a[1]}Q${c} ${c} ${b[0]} ${b[1]}`;
  }
  return dirs.map((d) => { const e = edgePt(d, T); return `M${c} ${c}L${e[0]} ${e[1]}`; }).join("");
}
/** Half-plane of the cell an arm occupies (used to clip fluid to lit arms). */
function halfRect(d: number, T: number) {
  const c = T / 2;
  if (d === N) return `M0 0H${T}V${c}H0Z`;
  if (d === S) return `M0 ${c}H${T}V${T}H0Z`;
  if (d === E) return `M${c} 0H${T}V${T}H${c}Z`;
  return `M0 0H${c}V${T}H0Z`;
}
function circlePath(cx: number, cy: number, r: number) {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
}
const pathCache =new Map<string, ReturnType<typeof Skia.Path.MakeFromSVGString>>();
function P(d: string) {
  if (!pathCache.has(d)) pathCache.set(d, Skia.Path.MakeFromSVGString(d));
  return pathCache.get(d)!;
}
/** Points along the fluid's route through a tile (centre-line of `dirs`), so
 *  bubbles can ride the pipe on the UI thread without touching Skia paths. */
function routeSamples(dirs: number[], T: number, n = 16): number[][] {
  const c = T / 2;
  const pts: number[] = [];
  const out: number[][] = [];
  if (dirs.length === 2) {
    const [a, b] = dirs.map((d) => edgePt(d, T));
    for (let k = 0; k <= n; k++) {
      const t = k / n, u = 1 - t;
      pts.push(u * u * a[0] + 2 * u * t * c + t * t * b[0], u * u * a[1] + 2 * u * t * c + t * t * b[1]);
    }
    out.push(pts);
    return out;
  }
  // tee / cross / single arm: centre → each port
  for (const d of dirs) {
    const e = edgePt(d, T);
    const arm: number[] = [];
    for (let k = 0; k <= n; k++) arm.push(c + ((e[0] - c) * k) / n, c + ((e[1] - c) * k) / n);
    out.push(arm);
  }
  return out;
}


/** One glass bubble riding a route, phase-offset on the shared flow clock (plain circles: no layers, no images). */
function Bubble({ route, offset, size, color }: { route: number[]; offset: number; size: number; color: string }) {
  const n = route.length / 2 - 1;
  const pos = (axis: 0 | 1) => {
    "worklet";
    const u = (FLOW_CLOCK.value + offset) % 1;
    const f = u * n, k = Math.min(n - 1, Math.floor(f)), t = f - k;
    return route[k * 2 + axis] + (route[k * 2 + 2 + axis] - route[k * 2 + axis]) * t;
  };
  const cx = useDerivedValue(() => pos(0));
  const cy = useDerivedValue(() => pos(1));
  const r = useDerivedValue(() => size * (0.7 + 0.5 * Math.sin(((FLOW_CLOCK.value + offset) % 1) * Math.PI)));
  const opacity = useDerivedValue(() => 0.85 * Math.sin(((FLOW_CLOCK.value + offset) % 1) * Math.PI));
  return (
    <Group opacity={opacity}>
      <Circle cx={cx} cy={cy} r={r} color={color} />
      <Circle cx={cx} cy={cy} r={r} style="stroke" strokeWidth={1} color="rgba(255,255,255,0.9)" />
    </Group>
  );
}

/** Quarter turns that bring a base sprite onto this mask. */
const STRAIGHT_K: Record<number, number> = { [E | W]: 0, [N | S]: 1 };
const ELBOW_K: Record<number, number> = { [E | S]: 0, [S | W]: 1, [W | N]: 2, [N | E]: 3 };
/** Quarter turns from the base "points East" frame to direction d. */
const DIR_K: Record<number, number> = { [E]: 0, [S]: 1, [W]: 2, [N]: 3 };

// ── Sprite pieces ─────────────────────────────────────────────────────────────
/** Draw a pipe sprite for `mask` (straight / elbow / generic arms) in the cell. */
function PipeSprite({ mask, T, sp, matrix }: { mask: number; T: number; sp: Sprites; matrix: number[] | null }) {
  const c = T / 2;
  const filter = matrix ? <ColorMatrix matrix={matrix} /> : null;
  if (STRAIGHT_K[mask] !== undefined) {
    const th = T * 0.44;
    return (
      <Group origin={vec(c, c)} transform={[{ rotate: (STRAIGHT_K[mask] * Math.PI) / 2 }]}>
        <SkImage image={sp.straight} x={0} y={c - th / 2} width={T} height={th} fit="fill">{filter}</SkImage>
      </Group>
    );
  }
  if (ELBOW_K[mask] !== undefined) {
    // Elbow art: arms leave S and E; arm centres sit at x=128 / y=130 of 451×512.
    const sx = c / 322, sy = c / 381;
    return (
      <Group origin={vec(c, c)} transform={[{ rotate: (ELBOW_K[mask] * Math.PI) / 2 }]}>
        <SkImage image={sp.elbow} x={c - 128 * sx} y={c - 130 * sy} width={451 * sx} height={512 * sy} fit="fill">{filter}</SkImage>
      </Group>
    );
  }
  // Tee / cross: one half-straight per arm, collar in the middle.
  const th = T * 0.44;
  return (
    <Group>
      {DIRS.filter((d) => mask & d).map((d) => (
        <Group key={d} origin={vec(c, c)} transform={[{ rotate: (DIR_K[d] * Math.PI) / 2 }]} clip={P(`M${c - th * 0.3} 0H${T}V${T}H${c - th * 0.3}Z`)}>
          <SkImage image={sp.straight} x={0} y={c - th / 2} width={T} height={th} fit="fill">{filter}</SkImage>
        </Group>
      ))}
      <Circle cx={c} cy={c} r={th * 0.62} color="#2B3740" />
      <Circle cx={c} cy={c} r={th * 0.62} style="stroke" strokeWidth={2} color="rgba(190,215,228,0.35)" />
    </Group>
  );
}

/** A straight stub from the centre to one port (endpoint connectors). */
function Stub({ d, T, sp, matrix }: { d: number; T: number; sp: Sprites; matrix: number[] | null }) {
  const c = T / 2;
  const th = T * 0.4;
  return (
    <Group origin={vec(c, c)} transform={[{ rotate: (DIR_K[d] * Math.PI) / 2 }]} clip={P(`M${c} 0H${T}V${T}H${c}Z`)}>
      <SkImage image={sp.straight} x={0} y={c - th / 2} width={T} height={th} fit="fill">
        {matrix ? <ColorMatrix matrix={matrix} /> : null}
      </SkImage>
    </Group>
  );
}

/** Fluid layer: the coloured sprite clipped to the lit arms, plus glow + bubbles. */
function Fluid({ cell, fluid, T, sp, fill }: {
  cell: Cell; fluid: TileFluid; T: number; sp: Sprites; fill: SharedValue<number>;
}) {
  const dirs = openDirs(cell);
  const lit = dirs.filter((d) => fluid.arm[d]);
  const colors = [...new Set(lit.map((d) => fluid.arm[d]!))];
  const sweepEnd = useDerivedValue(() => fill.value);
  if (!colors.length) return null;
  return (
    <>
      {colors.map((col) => {
        const arms = lit.filter((d) => fluid.arm[d] === col);
        const all = arms.length === dirs.length;
        const clip = all ? undefined : P(arms.map((d) => halfRect(d, T)).join(""));
        const center = armsPath(all ? dirs : arms, T);
        const hex = FLUID[col];
        return (
          <Group key={col}>
            {/* soft halo under the metal (two feathered strokes) — sweeps along the pipe as it fills */}
            <Path path={P(center)} style="stroke" strokeWidth={T * 0.62} strokeCap="round" color={hex.glow} opacity={0.12} end={sweepEnd} />
            <Path path={P(center)} style="stroke" strokeWidth={T * 0.5} strokeCap="round" color={hex.glow} opacity={0.18} end={sweepEnd} />
            <Group clip={clip} opacity={fill}>
              <PipeSprite mask={cell.m} T={T} sp={sp} matrix={HUE[col]} />
            </Group>
          </Group>
        );
      })}
    </>
  );
}

/** Bolted pipes sit on a riveted steel plate so players read "fixed" at a glance. */
function BoltPlate({ T }: { T: number }) {
  const p = T * 0.07, s = T - p * 2, r = T * 0.035;
  const corners = [[p + T * 0.09, p + T * 0.09], [T - p - T * 0.09, p + T * 0.09], [p + T * 0.09, T - p - T * 0.09], [T - p - T * 0.09, T - p - T * 0.09]];
  return (
    <Group>
      <RoundedRect x={p} y={p} width={s} height={s} r={T * 0.12}>
        <SkGradient start={vec(0, p)} end={vec(0, p + s)} colors={["#3A4A55", "#26333C"]} />
      </RoundedRect>
      <RoundedRect x={p} y={p} width={s} height={s} r={T * 0.12} style="stroke" strokeWidth={1.5} color="rgba(190,215,228,0.22)" />
      {corners.map(([x, y], k) => (
        <Group key={k}>
          <Circle cx={x} cy={y + 1} r={r} color="rgba(0,0,0,0.55)" />
          <Circle cx={x} cy={y} r={r}>
            <RadialGradient c={vec(x - r * 0.3, y - r * 0.3)} r={r * 1.4} colors={["#DCE7EC", "#7F939D", "#45545D"]} />
          </Circle>
        </Group>
      ))}
    </Group>
  );
}

/** Cross-overpass: the N–S channel runs underneath, the E–W channel bridges over it. */
function Overpass({ fluid, T, sp, fill }: { fluid: TileFluid; T: number; sp: Sprites; fill: SharedValue<number> }) {
  const c = T / 2, th = T * 0.44;
  const under = fluid.arm[N] ?? fluid.arm[S] ?? null;
  const over = fluid.arm[E] ?? fluid.arm[W] ?? null;
  const straight = (vertical: boolean, col: Color | null) => (
    <Group origin={vec(c, c)} transform={[{ rotate: vertical ? Math.PI / 2 : 0 }]}>
      <SkImage image={sp.straight} x={0} y={c - th / 2} width={T} height={th} fit="fill">
        <ColorMatrix matrix={DRY} />
      </SkImage>
      {col ? (
        <Group opacity={fill}>
          <SkImage image={sp.straight} x={0} y={c - th / 2} width={T} height={th} fit="fill">
            {HUE[col] ? <ColorMatrix matrix={HUE[col]!} /> : null}
          </SkImage>
        </Group>
      ) : null}
    </Group>
  );
  return (
    <Group>
      {straight(true, under)}
      {/* the bridge's shadow falls across the lower channel */}
      <RoundedRect x={T * 0.04} y={c - th * 0.62} width={T * 0.92} height={th * 1.24} r={th * 0.3} color="rgba(0,0,0,0.38)" />
      {straight(false, over)}
      {/* bridge collars where the upper channel lifts off */}
      {[c - th * 0.75, c + th * 0.75].map((x) => (
        <RoundedRect key={x} x={x - T * 0.035} y={c - th * 0.62} width={T * 0.07} height={th * 1.24} r={T * 0.02} color="#5B6C76" />
      ))}
    </Group>
  );
}

const Tile = memo(function Tile({ cell, rot, fluid, T, anim, sp, winPulse, winDelay }: {
  cell: Cell; rot: number; fluid: TileFluid; T: number; anim: TileAnim; sp: Sprites; winPulse: number; winDelay: number;
}) {
  const c = T / 2;
  const rotatable = !cell.f;
  const dirs = openDirs(cell);
  const live = !!fluid.body || dirs.some((d) => fluid.arm[d]);
  const leaking = live && cell.t === "pipe" && dirs.some((d) => !fluid.arm[d]);

  // Fluid arrives: 600 ms fill sweep + a soft swell, acknowledged where it happens.
  const wasLive = useRef(false);
  useEffect(() => {
    if (live && !wasLive.current) {
      anim.fill.value = 0;
      anim.fill.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
      anim.scale.value = withSequence(withTiming(1.05, { duration: 90 }), withSpring(1, springs.pop));
    } else if (!live) {
      anim.fill.value = 0;
    }
    wasLive.current = live;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  // The drawn angle follows the engine's rotation and nothing else: `turns` is a
  // plain-JS quarter-turn counter (unbounded, so a tap always spins forward) that
  // each new `rot` advances the shortest way to. Mount / new board snaps to it.
  const firstRot = useRef(true);
  const turns = useRef(rot);
  const turnsAnim = useRef(anim);
  useEffect(() => {
    if (!rotatable) return;
    if (firstRot.current || turnsAnim.current !== anim) {
      turnsAnim.current = anim;
      turns.current = rot;
      anim.angle.value = rot * 90;
    } else {
      let delta = (((rot - turns.current) % 4) + 4) % 4;
      if (delta === 3) delta = -1;
      if (delta !== 0) {
        turns.current += delta;
        anim.angle.value = withTiming(turns.current * 90, TURN);
      }
    }
    // Dead end: this turn feeds fluid into a pipe whose other end goes nowhere —
    // a small red drip pulses at that open end only.
    if (!firstRot.current && leaking) {
      anim.error.value = withSequence(
        withTiming(1, { duration: 60 }), withTiming(0.3, { duration: 90 }),
        withTiming(0.9, { duration: 70 }), withTiming(0, { duration: 260 }),
      );
    }
    firstRot.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rot, anim]);

  useEffect(() => {
    if (winPulse > 0) {
      anim.scale.value = withDelay(winDelay, withSequence(withTiming(1.1, { duration: 150 }), withSpring(1, springs.pop)));
      anim.flash.value = withDelay(winDelay, withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 380 })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winPulse]);

  const transform = useDerivedValue(() =>
    rotatable
      ? [{ rotateZ: (anim.angle.value * Math.PI) / 180 }, { scale: anim.scale.value }]
      : [{ rotateZ: (rot * Math.PI) / 2 }, { scale: anim.scale.value }],
  );
  const flashOpacity = useDerivedValue(() => anim.flash.value * 0.55);
  const errorOpacity = useDerivedValue(() => anim.error.value * 0.9);
  const dripR = useDerivedValue(() => T * (0.06 + anim.error.value * 0.05));
  const pulseOpacity = useDerivedValue(() => anim.pulse.value * 0.9);
  const pulseCol = FLUID[fluid.body ?? "blue"];
  // Open (leaking) ends of a live pipe, in the tile's base frame.
  const leaks = leaking ? dirs.filter((d) => !fluid.arm[d]) : [];

  if (cell.t === "empty") return null;
  const isEndpoint = cell.t === "source" || cell.t === "sink";
  const glowPath = P(armsPath(dirs, T));

  return (
    <Group origin={vec(c, c)} transform={transform}>
      {isEndpoint ? (
        <Endpoint cell={cell} T={T} fluid={fluid} sp={sp} fill={anim.fill} />
      ) : (
        <>
          {cell.f && cell.t === "pipe" ? <BoltPlate T={T} /> : null}
          {/* ambient occlusion under the pipe */}
          <Path path={glowPath} style="stroke" strokeWidth={T * 0.5} strokeCap="round" color="rgba(0,0,0,0.18)" transform={[{ translateY: T * 0.06 }]} />
          <Path path={glowPath} style="stroke" strokeWidth={T * 0.44} strokeCap="round" color="rgba(0,0,0,0.3)" transform={[{ translateY: T * 0.045 }]} />
          {cell.x ? (
            <Overpass fluid={fluid} T={T} sp={sp} fill={anim.fill} />
          ) : (
            <>
              <PipeSprite mask={cell.m} T={T} sp={sp} matrix={DRY} />
              <Fluid cell={cell} fluid={fluid} T={T} sp={sp} fill={anim.fill} />
            </>
          )}
        </>
      )}
      {/* connection pulse: the fluid's colour races through the pipe */}
      <Group opacity={pulseOpacity}>
        <Path path={glowPath} style="stroke" strokeWidth={T * 0.42} strokeCap="round" color={pulseCol.glow} opacity={0.35} />
        <Path path={glowPath} style="stroke" strokeWidth={T * 0.26} strokeCap="round" color={pulseCol.glow} opacity={0.6} />
        <Path path={glowPath} style="stroke" strokeWidth={T * 0.07} strokeCap="round" color={pulseCol.hot} />
      </Group>
      {/* leak: a red drip pulsing at each open end the fluid spills from */}
      {leaks.length ? (
        <Group opacity={errorOpacity}>
          {leaks.map((d) => {
            const [x, y] = edgePt(d, T);
            const ix = c + (x - c) * 0.86, iy = c + (y - c) * 0.86;
            return (
              <Group key={d}>
                <Circle cx={ix} cy={iy} r={T * 0.18}>
                  <RadialGradient c={vec(ix, iy)} r={T * 0.18} colors={["rgba(255,93,93,0.6)", "rgba(255,93,93,0)"]} />
                </Circle>
                <Circle cx={ix} cy={iy} r={dripR} color="#FFD0CA" />
              </Group>
            );
          })}
        </Group>
      ) : null}
      {/* glow flash on tap / win sweep */}
      <Group opacity={flashOpacity}>
        <Path path={glowPath} style="stroke" strokeWidth={T * 0.4} strokeCap="round" color="#FFFFFF" opacity={0.4} />
        <Path path={glowPath} style="stroke" strokeWidth={T * 0.28} strokeCap="round" color="#FFFFFF" />
      </Group>
    </Group>
  );
});

/** Sources: beveled emitter housing with a flow-arrow decal and a 1.2 s pulsing
 *  ring. Drains: deep-set ports that glow in their colour, brighter once filled. */
function Endpoint({ cell, T, fluid, sp, fill }: { cell: Cell; T: number; fluid: TileFluid; sp: Sprites; fill: SharedValue<number> }) {
  const c = T / 2;
  const col: Color = cell.c ?? "blue";
  const hex = FLUID[col];
  const isSource = cell.t === "source";
  const port = openDirs(cell)[0] ?? S;

  // The endless source ring / unsolved-drain breathing lives on the ambient overlay (EndpointFx).

  // Drain-solved beat: a bright ring that expands and fades.
  const burst = useSharedValue(0);
  const wasSolved = useRef(false);
  useEffect(() => {
    if (fluid.solvedSink && !wasSolved.current) {
      burst.value = withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 600, easing: Easing.out(Easing.quad) }));
    }
    wasSolved.current = fluid.solvedSink;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fluid.solvedSink]);
  const burstR = useDerivedValue(() => T * (0.36 + (1 - burst.value) * 0.3));
  const burstOp = useDerivedValue(() => burst.value * 0.9);

  if (isSource) {
    // Emitter art: head centre (188,188), stem leaves straight down to y=512.
    const s = c / 324;
    return (
      <Group>
        <Circle cx={c} cy={c} r={T * 0.5}>
          <RadialGradient c={vec(c, c)} r={T * 0.5} colors={[hex.glow, "rgba(0,0,0,0)"]} positions={[0.35, 1]} />
        </Circle>
        {/* housing + stem toward the port */}
        <Group origin={vec(c, c)} transform={[{ rotate: ((DIR_K[port] - 1) * Math.PI) / 2 }]}>
          <SkImage image={sp.source} x={c - 188.5 * s} y={c - 188 * s} width={378 * s} height={512 * s} fit="fill">
            {HUE[col] ? <ColorMatrix matrix={HUE[col]!} /> : null}
          </SkImage>
        </Group>
        {/* the round emitter head again, turned so its arrow decal points the way the fluid flows */}
        <Group origin={vec(c, c)} transform={[{ rotate: ((DIR_K[port] + 1) * Math.PI) / 2 }]} clip={P(circlePath(c, c, 186 * s))}>
          <SkImage image={sp.source} x={c - 188.5 * s} y={c - 188 * s} width={378 * s} height={512 * s} fit="fill">
            {HUE[col] ? <ColorMatrix matrix={HUE[col]!} /> : null}
          </SkImage>
        </Group>
      </Group>
    );
  }

  const disc = T * 0.76;
  const drainImg = col === "red" ? sp.drainRed : sp.drainBlue;
  const drainMatrix = col === "red" || col === "blue" ? null : HUE[col];
  return (
    <Group>
      <Stub d={port} T={T} sp={sp} matrix={DRY} />
      {fluid.arm[port] ? (
        <Group opacity={fill}>
          <Stub d={port} T={T} sp={sp} matrix={HUE[col]} />
        </Group>
      ) : null}
      <Circle cx={c} cy={c + T * 0.04} r={disc * 0.54}>
        <RadialGradient c={vec(c, c + T * 0.04)} r={disc * 0.54} colors={["rgba(0,0,0,0.6)", "rgba(0,0,0,0)"]} positions={[0.8, 1]} />
      </Circle>
      <SkImage image={drainImg} x={c - disc / 2} y={c - disc / 2} width={disc} height={disc} fit="contain">
        {drainMatrix ? <ColorMatrix matrix={drainMatrix} /> : null}
      </SkImage>
      {/* soft inner glow in the drain's colour */}
      <Circle cx={c} cy={c} r={disc * 0.34} opacity={fluid.solvedSink ? 0.95 : 0.3}>
        <RadialGradient c={vec(c, c)} r={disc * 0.34} colors={[hex.hot, hex.glow, "rgba(0,0,0,0)"]} positions={[0, 0.35, 1]} />
      </Circle>
      <Circle cx={c} cy={c} r={burstR} style="stroke" strokeWidth={Math.max(2, T * 0.05)} color={hex.hot} opacity={burstOp} />
    </Group>
  );
}

/** One spark / steam puff flying out of a joint seam. */
function Spark({ x, y, angle, dist, size, color, t }: {
  x: number; y: number; angle: number; dist: number; size: number; color: string; t: SharedValue<number>;
}) {
  const cx = useDerivedValue(() => x + Math.cos(angle) * dist * t.value);
  const cy = useDerivedValue(() => y + Math.sin(angle) * dist * t.value - (color === STEAM ? dist * 0.5 * t.value : 0));
  const r = useDerivedValue(() => size * (color === STEAM ? 0.6 + t.value : 1 - t.value * 0.6));
  const op = useDerivedValue(() => (t.value < 0.15 ? t.value / 0.15 : 1 - (t.value - 0.15) / 0.85));
  return <Circle cx={cx} cy={cy} r={r} color={color} opacity={op} />;
}
const STEAM = "rgba(214,228,236,0.85)";

/** 7 sparks (joint made, in the fluid's colour) or steam puffs (joint broken). */
function JointBurst({ x, y, color, T, seed }: { x: number; y: number; color: string; T: number; seed: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: color === STEAM ? 520 : 440, easing: Easing.out(Easing.quad) });
  }, [t, color]);
  const flash = useDerivedValue(() => (1 - t.value) * 0.8);
  const flashR = useDerivedValue(() => T * (0.08 + t.value * 0.16));
  return (
    <Group>
      {color !== STEAM ? (
        <Circle cx={x} cy={y} r={flashR} color={color} opacity={flash} />
      ) : null}
      {Array.from({ length: 7 }, (_, k) => {
        const a = (k / 7) * Math.PI * 2 + seed;
        const dist = T * (0.22 + ((k * 37 + seed * 11) % 10) / 40);
        return <Spark key={k} x={x} y={y} angle={a} dist={dist} size={T * (color === STEAM ? 0.05 : 0.035)} color={color} t={t} />;
      })}
    </Group>
  );
}

/** Ambient life of one lit pipe: a caustic shimmer and glass bubbles riding the fluid, turned with the tile. */
function FlowFx({ cell, fluid, rot, x, y, T, anim }: { cell: Cell; fluid: TileFluid; rot: number; x: number; y: number; T: number; anim: TileAnim }) {
  const c = T / 2;
  const dirs = openDirs(cell);
  const lit = dirs.filter((d) => fluid.arm[d]);
  const colors = [...new Set(lit.map((d) => fluid.arm[d]!))];
  const rotatable = !cell.f;
  const turn = useDerivedValue(() => [{ rotateZ: rotatable ? (anim.angle.value * Math.PI) / 180 : (rot * Math.PI) / 2 }]);
  const phase = useDerivedValue(() => -FLOW_CLOCK.value * T * 0.5);
  return (
    <Group transform={[{ translateX: x }, { translateY: y }]}>
      <Group origin={vec(c, c)} transform={turn}>
        {colors.map((col) => {
          const arms = lit.filter((d) => fluid.arm[d] === col);
          const all = arms.length === dirs.length;
          const hex = FLUID[col];
          return (
            <Group key={col}>
              <Path path={P(armsPath(all ? dirs : arms, T))} style="stroke" strokeWidth={T * 0.05} strokeCap="round" color={hex.hot} opacity={0.45}>
                <DashPathEffect intervals={[T * 0.12, T * 0.3]} phase={phase} />
              </Path>
              {routeSamples(all ? dirs : arms, T, 8).map((route, j, rs) => (
                <Bubble key={j} route={route} offset={j / rs.length} size={T * 0.045} color={hex.hot} />
              ))}
            </Group>
          );
        })}
      </Group>
    </Group>
  );
}

/** Sources pulse a ring every 1.2 s; drains still waiting for fluid breathe in their colour. */
function EndpointFx({ x, y, T, color, source, solved }: { x: number; y: number; T: number; color: Color; source: boolean; solved: boolean }) {
  const pulse = useSharedValue(0);
  const on = source || !solved;
  useEffect(() => {
    if (!on) { pulse.value = withTiming(0, { duration: 300 }); return; }
    pulse.value = 0;
    pulse.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }), -1);
  }, [on, pulse]);
  const c = T / 2, hex = FLUID[color];
  const ringR = useDerivedValue(() => T * (0.3 + pulse.value * 0.2));
  const ringOp = useDerivedValue(() => (1 - pulse.value) * 0.85);
  const coreOp = useDerivedValue(() => 0.3 * Math.sin(pulse.value * Math.PI));
  if (!on) return null;
  return (
    <Group transform={[{ translateX: x }, { translateY: y }]}>
      {source ? (
        <Circle cx={c} cy={c} r={ringR} style="stroke" strokeWidth={Math.max(2, T * 0.035)} color={hex.glow} opacity={ringOp} />
      ) : (
        <Circle cx={c} cy={c} r={T * 0.26} opacity={coreOp}>
          <RadialGradient c={vec(c, c)} r={T * 0.26} colors={[hex.hot, hex.glow, "rgba(0,0,0,0)"]} positions={[0, 0.35, 1]} />
        </Circle>
      )}
    </Group>
  );
}

/** Tap glow ring + red "blocked" X, drawn square to the grid (never spins). */
function TileOverlay({ x, y, T, anim }: { x: number; y: number; T: number; anim: TileAnim }) {
  const ringOp = useDerivedValue(() => anim.ring.value * 0.85);
  const ringIn = useDerivedValue(() => 4 - (1 - anim.ring.value) * 3);
  const ringW = useDerivedValue(() => T - (4 - (1 - anim.ring.value) * 3) * 2);
  const denyOp = useDerivedValue(() => anim.deny.value);
  const denyT = useDerivedValue(() => [{ scale: 0.7 + anim.deny.value * 0.35 }]);
  const c = T / 2, k = T * 0.2;
  return (
    <Group transform={[{ translateX: x }, { translateY: y }]}>
      <Group opacity={ringOp}>
        <RoundedRect x={ringIn} y={ringIn} width={ringW} height={ringW} r={T * 0.18} style="stroke" strokeWidth={T * 0.07} color={palette.accent} />
      </Group>
      <Group opacity={denyOp} origin={vec(c, c)} transform={denyT}>
        <Circle cx={c} cy={c} r={T * 0.34}>
          <RadialGradient c={vec(c, c)} r={T * 0.34} colors={["rgba(255,93,93,0.4)", "rgba(255,93,93,0)"]} />
        </Circle>
        <Path path={P(`M${c - k} ${c - k}L${c + k} ${c + k}M${c + k} ${c - k}L${c - k} ${c + k}`)} style="stroke" strokeWidth={T * 0.08} strokeCap="round" color={palette.danger} />
      </Group>
    </Group>
  );
}

/** Level-1 guide: a faint dotted line along the route and a breathing ring on the next pipe to turn. */
export interface Guide { route: number[]; next: number | null; drainPulse: boolean }

const TRAY = { w: 512, h: 508, cap: 72, inset: 54 };

/** The full board: the anodized tray, a recessed grid and the pipe tiles. */
export function PipeBoard({
  def, rot, fv, tile, onTapCell, hintIndex, winPulse, interactive = true, guide,
}: {
  def: LevelDef; rot: number[]; fv: FlowView; tile: number;
  onTapCell: (i: number) => void; hintIndex: number | null; winPulse: number; interactive?: boolean;
  guide?: Guide | null;
}) {
  const T = tile;
  // Keep each tile's fluid object identical while its fluid is unchanged, so a turn only re-renders the tiles it affects.
  const prevFluids = useRef<{ def: LevelDef; list: TileFluid[] } | null>(null);
  const fluids = useMemo(() => {
    const old = prevFluids.current?.def === def ? prevFluids.current.list : null;
    const list = def.cells.map((_, i) => {
      const f = tileFluid(def, rot, fv, i);
      return old && JSON.stringify(old[i]) === JSON.stringify(f) ? old[i] : f;
    });
    prevFluids.current = { def, list };
    return list;
  }, [def, rot, fv]);
  const view = useMemo(() => boardView(def), [def]);
  const { bezel, well } = boardChrome(T);

  const straight = useImage(art.pipe_straight);
  const elbow = useImage(art.pipe_elbow);
  const blocker = useImage(art.tile_blocker);
  const source = useImage(art.endpoint_source_blue);
  const drainBlue = useImage(art.endpoint_drain_blue);
  const drainRed = useImage(art.endpoint_drain_red);
  const sweep = useImage(art.fx_glow_sweep);
  const sp = useMemo<Sprites>(
    () => ({ straight, elbow, blocker, source, drainBlue, drainRed, sweep }),
    [straight, elbow, blocker, source, drainBlue, drainRed, sweep],
  );

  const anims = useMemo<TileAnim[]>(
    () => def.cells.map((cell) => ({
      angle: makeMutable(cell.r * 90),
      scale: makeMutable(1),
      flash: makeMutable(1e-6),
      error: makeMutable(0),
      fill: makeMutable(0),
      ring: makeMutable(0),
      pulse: makeMutable(0),
      deny: makeMutable(0),
    })),
    [def],
  );

  useEffect(() => {
    if (flowStarted) return;
    flowStarted = true;
    FLOW_CLOCK.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1);
  }, []);

  // Win: the art's glow bar sweeps across the board (600 ms cubic).
  const sweepX = useSharedValue(-2);
  useEffect(() => {
    if (winPulse > 0) {
      sweepX.value = -0.3;
      sweepX.value = withDelay(180, withTiming(1.3, { duration: 600, easing: Easing.inOut(Easing.cubic) }));
    }
  }, [winPulse, sweepX]);

  // Hint ring breathes so the suggested pipe is unmissable.
  const hintPulse = useSharedValue(0);
  const ringOn = hintIndex != null || guide?.next != null;
  useEffect(() => {
    hintPulse.value = !ringOn ? 0 : withRepeat(withTiming(1, { duration: 600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [ringOn, hintPulse]);
  const hintOp = useDerivedValue(() => 0.55 + hintPulse.value * 0.45);

  const gridW = T * view.cols;
  const gridH = T * view.rows;
  const innerW = gridW + well * 2;
  const innerH = gridH + well * 2;
  const outerW = innerW + bezel * 2;
  const outerH = innerH + bezel * 2;
  const capScale = bezel / TRAY.inset;
  const rr = Math.max(8, T * 0.14);

  const sweepW = innerW * 0.22;
  const sweepT = useDerivedValue(() => [{ translateX: sweepX.value * innerW - sweepW / 2 }]);
  const sweepOp = useDerivedValue(() => (sweepX.value > -0.3 && sweepX.value < 1.3 ? 0.85 : 0));

  const cellXY = (i: number) => {
    const col = (i % def.w) - view.c0, row = ((i / def.w) | 0) - view.r0;
    return { col, row, x: well + col * T, y: well + row * T };
  };
  const inView = (i: number) => {
    const { col, row } = cellXY(i);
    return col >= 0 && row >= 0 && col < view.cols && row < view.rows;
  };

  function spin(i: number) {
    const a = anims[i];
    a.scale.value = withSequence(withTiming(1.06, { duration: 60 }), withSpring(1, springs.pop));
    a.flash.value = withSequence(withTiming(0.8, { duration: 30 }), withTiming(0, { duration: 200 }));
    a.ring.value = withSequence(withTiming(1, { duration: 50 }), withTiming(0, { duration: 380, easing: Easing.out(Easing.quad) }));
    feedback("move", "light");
    onTapCell(i);
  }

  // Bolted pipes, sources and drains can't turn: red X on that tile + a "Blocked" toast.
  const [toast, setToast] = useState<{ i: number; k: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  function deny(i: number) {
    const a = anims[i];
    a.deny.value = withSequence(withTiming(1, { duration: 70 }), withTiming(0.55, { duration: 80 }), withTiming(1, { duration: 70 }), withDelay(160, withTiming(0, { duration: 200 })));
    a.scale.value = withSequence(withTiming(0.94, { duration: 60 }), withSpring(1, springs.press));
    feedback("error", "select");
    setToast((t) => ({ i, k: (t?.k ?? 0) + 1 }));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 900);
  }

  // Joints made / broken since the last board: pulse + sparks, or a puff of steam.
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const prevJoints = useRef<Map<string, Color> | null>(null);
  const burstId = useRef(0);
  const burstTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => burstTimers.current.forEach(clearTimeout), []);
  useEffect(() => { prevJoints.current = null; }, [def]);
  useEffect(() => {
    const now = litJoints(def, rot, fluids);
    const before = prevJoints.current;
    prevJoints.current = now;
    if (!before || !interactive) return;
    const added: typeof bursts = [];
    const at = (key: string) => {
      const i = parseInt(key, 10), d = key.endsWith("E") ? "E" : "S";
      const { x, y } = cellXY(i);
      return { i, nb: d === "E" ? i + 1 : i + def.w, x: d === "E" ? x + T : x + T / 2, y: d === "E" ? y + T / 2 : y + T };
    };
    now.forEach((col, key) => {
      if (before.get(key) === col) return;
      const j = at(key);
      for (const k of [j.i, j.nb]) {
        anims[k].pulse.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 420, easing: Easing.out(Easing.quad) }));
      }
      added.push({ id: ++burstId.current, x: j.x, y: j.y, color: FLUID[col].glow });
    });
    before.forEach((_, key) => {
      if (now.has(key)) return;
      const j = at(key);
      added.push({ id: ++burstId.current, x: j.x, y: j.y, color: STEAM });
    });
    if (!added.length) return;
    const keep = added.slice(0, 6);
    setBursts((b) => [...b.slice(-8), ...keep]);
    const ids = new Set(keep.map((b) => b.id));
    burstTimers.current.push(setTimeout(() => setBursts((b) => b.filter((x) => !ids.has(x.id))), 650));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fluids]);

  // Guide: the drain throbs once the first pipe has been turned right.
  const guidePulse = useSharedValue(0);
  useEffect(() => {
    guidePulse.value = guide?.drainPulse ? withRepeat(withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }), -1) : 0;
  }, [guide?.drainPulse, guidePulse]);
  const drainRingR = useDerivedValue(() => T * (0.36 + guidePulse.value * 0.34));
  const drainRingOp = useDerivedValue(() => (1 - guidePulse.value) * 0.9);

  // grid line path (2 px, #2A3A45) with the cell corners rounded off
  const grid = useMemo(() => {
    let d = "";
    for (let r = 0; r < view.rows; r++) {
      for (let c = 0; c < view.cols; c++) {
        const x = well + c * T + 1.5, y = well + r * T + 1.5, s = T - 3, k = Math.min(6, s / 4);
        d += `M${x + k} ${y}H${x + s - k}Q${x + s} ${y} ${x + s} ${y + k}V${y + s - k}Q${x + s} ${y + s} ${x + s - k} ${y + s}H${x + k}Q${x} ${y + s} ${x} ${y + s - k}V${y + k}Q${x} ${y} ${x + k} ${y}Z`;
      }
    }
    return Skia.Path.MakeFromSVGString(d);
  }, [view, T, well]);

  return (
    <View style={[styles.frame, { width: outerW, height: outerH }]}>
      <NineSlice
        source={art.board_frame_tray}
        w={TRAY.w} h={TRAY.h}
        cap={{ l: TRAY.cap, t: TRAY.cap, r: TRAY.cap, b: TRAY.cap }}
        scale={capScale}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.inner, { left: bezel, top: bezel, width: innerW, height: innerH, borderRadius: rr }]}>
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* recessed well */}
          <RoundedRect x={0} y={0} width={innerW} height={innerH} r={rr}>
            <SkGradient start={vec(0, 0)} end={vec(0, innerH)} colors={["#16252F", "#0D171E"]} />
          </RoundedRect>
          {/* subtle 2 px grid, rounded 6 px tile corners */}
          {grid ? <Path path={grid} style="stroke" strokeWidth={2} color="rgba(42,58,69,0.75)" /> : null}
          {grid ? <Path path={grid} color="rgba(255,255,255,0.018)" /> : null}
          {/* blocked cells: matte steel plate with an embossed X */}
          {def.cells.map((cell, i) => {
            if (cell.t !== "empty" || !inView(i)) return null;
            const { x, y } = cellXY(i);
            const p = T * 0.14;
            return <SkImage key={`b${i}`} image={sp.blocker} x={x + p} y={y + p} width={T - p * 2} height={T - p * 2} fit="contain" opacity={0.65} />;
          })}
          {/* level-1 guide: faint dotted route, glowing ring on the next pipe */}
          {guide && guide.route.length > 1 ? (
            <Path
              path={P(guide.route.map((i, k) => { const { x, y } = cellXY(i); return `${k ? "L" : "M"}${x + T / 2} ${y + T / 2}`; }).join(""))}
              style="stroke" strokeWidth={Math.max(3, T * 0.05)} strokeCap="round" strokeJoin="round" color="rgba(46,196,255,0.55)"
            >
              <DashPathEffect intervals={[T * 0.04, T * 0.11]} />
            </Path>
          ) : null}
          {/* tiles */}
          {def.cells.map((cell, i) => {
            if (cell.t === "empty" || !inView(i)) return null;
            const { x, y, row, col } = cellXY(i);
            return (
              <Group key={`t${i}`} transform={[{ translateX: x }, { translateY: y }]}>
                <Tile cell={cell} rot={rot[i]} fluid={fluids[i]} T={T} anim={anims[i]} sp={sp} winPulse={winPulse} winDelay={200 + (row + col) * 65} />
              </Group>
            );
          })}
          {/* tap glow rings + blocked X (square to the grid) */}
          {def.cells.map((cell, i) => {
            if (cell.t === "empty" || !inView(i)) return null;
            const { x, y } = cellXY(i);
            return <TileOverlay key={`o${i}`} x={x} y={y} T={T} anim={anims[i]} />;
          })}
          {/* joint sparks / steam */}
          {bursts.map((b) => <JointBurst key={b.id} x={b.x} y={b.y} color={b.color} T={T} seed={b.id * 0.7} />)}
          {/* win glow sweep */}
          <Group transform={sweepT} opacity={sweepOp} blendMode="plus">
            <SkImage image={sp.sweep} x={0} y={-innerH * 0.1} width={sweepW} height={innerH * 1.2} fit="fill" />
          </Group>
          {/* soft inner shadow pushes the grid into the tray (stacked strokes, no blur pass) */}
          {[[3, 0.42], [7, 0.24], [12, 0.12]].map(([w, a]) => (
            <RoundedRect key={w} x={0} y={0} width={innerW} height={innerH} r={rr} style="stroke" strokeWidth={w * 2} color={`rgba(0,0,0,${a})`} />
          ))}
          <RoundedRect x={0} y={0} width={innerW} height={innerH} r={rr}>
            <RadialGradient c={vec(innerW / 2, innerH * 0.45)} r={Math.max(innerW, innerH) * 0.7} colors={["rgba(46,196,255,0.05)", "rgba(0,0,0,0)", "rgba(0,0,0,0.3)"]} positions={[0, 0.6, 1]} />
          </RoundedRect>
        </Canvas>
        {/* Ambient layer: everything that moves forever (bubbles, shimmer, source rings, drain breathing, hint and
            guide rings) lives on its own light canvas, so the board above only redraws when the game changes. */}
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          {def.cells.map((cell, i) => {
            if (cell.t === "empty" || !inView(i)) return null;
            const { x, y } = cellXY(i);
            if (cell.t === "source" || cell.t === "sink") {
              return <EndpointFx key={`a${i}`} x={x} y={y} T={T} color={cell.c ?? "blue"} source={cell.t === "source"} solved={fluids[i].solvedSink} />;
            }
            if (cell.x || !Object.values(fluids[i].arm).some(Boolean)) return null;
            return <FlowFx key={`a${i}`} cell={cell} fluid={fluids[i]} rot={rot[i]} x={x} y={y} T={T} anim={anims[i]} />;
          })}
          {hintIndex != null && def.cells[hintIndex] && inView(hintIndex) ? (() => {
            const { x, y } = cellXY(hintIndex);
            return (
              <Group opacity={hintOp}>
                <RoundedRect x={x + 2} y={y + 2} width={T - 4} height={T - 4} r={T * 0.16} style="stroke" strokeWidth={T * 0.1} color="rgba(217,122,43,0.35)" />
                <RoundedRect x={x + 4} y={y + 4} width={T - 8} height={T - 8} r={T * 0.15} style="stroke" strokeWidth={T * 0.05} color={palette.primary} />
              </Group>
            );
          })() : null}
          {guide?.next != null && inView(guide.next) ? (() => {
            const { x, y } = cellXY(guide.next);
            return (
              <Group opacity={hintOp}>
                <RoundedRect x={x + 3} y={y + 3} width={T - 6} height={T - 6} r={T * 0.16} color="rgba(46,196,255,0.14)" />
                <RoundedRect x={x + 2} y={y + 2} width={T - 4} height={T - 4} r={T * 0.16} style="stroke" strokeWidth={T * 0.1} color="rgba(46,196,255,0.3)" />
                <RoundedRect x={x + 4} y={y + 4} width={T - 8} height={T - 8} r={T * 0.15} style="stroke" strokeWidth={T * 0.05} color={palette.accent} />
              </Group>
            );
          })() : null}
          {guide?.drainPulse && guide.route.length ? (() => {
            const { x, y } = cellXY(guide.route[guide.route.length - 1]);
            return <Circle cx={x + T / 2} cy={y + T / 2} r={drainRingR} style="stroke" strokeWidth={Math.max(3, T * 0.05)} color={palette.accent} opacity={drainRingOp} />;
          })() : null}
        </Canvas>
        {/* transparent hit targets — rotate on press-in so the spin starts within a frame */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {Array.from({ length: view.rows }, (_, r) => (
            <View key={r} style={[styles.row, { top: well + r * T, left: well, height: T }]}>
              {Array.from({ length: view.cols }, (_, cc) => {
                const i = (r + view.r0) * def.w + cc + view.c0;
                const cell = def.cells[i];
                const can = interactive && cell.t !== "empty" && !cell.f;
                return (
                  <Pressable
                    key={i}
                    onPressIn={can ? () => spin(i) : cell.t !== "empty" && interactive ? () => deny(i) : undefined}
                    disabled={!interactive || cell.t === "empty"}
                    hitSlop={2}
                    style={{ width: T, height: T }}
                  />
                );
              })}
            </View>
          ))}
        </View>
        {toast ? (() => {
          const { x, y } = cellXY(toast.i);
          const above = y > T * 0.5;
          return (
            <Animated.View
              key={toast.k}
              pointerEvents="none"
              entering={FadeIn.duration(120)}
              exiting={FadeOut.duration(300)}
              style={[styles.toast, { left: Math.max(4, Math.min(innerW - 112, x + T / 2 - 54)), top: above ? y - 20 : y + T - 16 }]}
            >
              <Text style={styles.toastText}>Blocked</Text>
            </Animated.View>
          );
        })() : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: "center",
    shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 22, shadowOffset: { width: 0, height: 14 }, elevation: 16,
  },
  inner: { position: "absolute", overflow: "hidden", backgroundColor: "#0D171E" },
  row: { position: "absolute", flexDirection: "row" },
  toast: {
    position: "absolute", width: 108, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(40,14,16,0.92)", borderWidth: 1.5, borderColor: palette.danger,
  },
  toastText: { fontFamily: fonts.display, fontSize: 15, color: "#FFE1DC", includeFontPadding: false },
});
