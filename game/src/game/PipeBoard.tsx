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
 * FEEL: each tile's rotation lives in a shared value owned by the board, so a
 * tap spins it the INSTANT the finger lands (onPressIn, a 150 ms quarter turn
 * with an elastic settle and a 1.06 press swell) under a soft blue glow ring —
 * no JS round-trip. The engine state catches up a tick later. Every joint a
 * turn makes sends a pulse of the fluid's colour through both pipes and 7
 * sparks out of the seam; a joint it breaks puffs pale steam. Tapping a bolted
 * piece flashes a red X on that tile with a short "Blocked" toast.
 * Pure presentational — logic stays in the engine.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import {
  BlurMask, Canvas, Circle, ColorMatrix, DashPathEffect, Group, Image as SkImage, LinearGradient as SkGradient,
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
  target: SharedValue<number>; // rotation count (quarter turns) we're heading to
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
  particles: SkImageT | null;
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

// fx_particles_pack: small bubble centre (234,457) r≈46; red leak ring centre (358,178) r≈100.
const BUBBLE = { cx: 234, cy: 457, r: 46 };

/** One glassy bubble sprite riding a route, phase-offset on the shared flow clock. */
function Bubble({ route, offset, size, img }: { route: number[]; offset: number; size: number; img: SkImageT | null }) {
  const n = route.length / 2 - 1;
  const transform = useDerivedValue(() => {
    const u = (FLOW_CLOCK.value + offset) % 1;
    const f = u * n, k = Math.min(n - 1, Math.floor(f)), t = f - k;
    const x = route[k * 2] + (route[k * 2 + 2] - route[k * 2]) * t;
    const y = route[k * 2 + 1] + (route[k * 2 + 3] - route[k * 2 + 1]) * t;
    return [{ translateX: x }, { translateY: y }, { scale: 0.7 + 0.5 * Math.sin(u * Math.PI) }];
  });
  const opacity = useDerivedValue(() => 0.9 * Math.sin(((FLOW_CLOCK.value + offset) % 1) * Math.PI));
  const k = size / BUBBLE.r;
  return (
    <Group transform={transform} opacity={opacity} clip={P(circlePath(0, 0, size * 1.05))}>
      <SkImage image={img} x={-BUBBLE.cx * k} y={-BUBBLE.cy * k} width={482 * k} height={512 * k} fit="fill" />
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
  const bubblePhase = useDerivedValue(() => -FLOW_CLOCK.value * T * 0.5);
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
            {/* 24px-ish halo under the metal — sweeps along the pipe as it fills */}
            <Path path={P(center)} style="stroke" strokeWidth={T * 0.5} strokeCap="round" color={hex.glow} opacity={0.42} end={sweepEnd}>
              <BlurMask blur={T * 0.16} style="normal" />
            </Path>
            <Group clip={clip} opacity={fill}>
              <PipeSprite mask={cell.m} T={T} sp={sp} matrix={HUE[col]} />
            </Group>
            {/* animated caustic shimmer through the lit glass */}
            <Path path={P(center)} style="stroke" strokeWidth={T * 0.05} strokeCap="round" color={hex.hot} opacity={0.4}>
              <DashPathEffect intervals={[T * 0.12, T * 0.3]} phase={bubblePhase} />
            </Path>
            {/* tiny glass bubbles rising through the fluid (~1.4 Hz per pipe) */}
            {routeSamples(all ? dirs : arms, T).map((route, j, rs) => (
              [0, 0.5].map((o) => (
                <Bubble key={`${j}-${o}`} route={route} offset={o + j / (rs.length * 2)} size={T * 0.055} img={sp.particles} />
              ))
            ))}
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
      <RoundedRect x={T * 0.04} y={c - th * 0.62} width={T * 0.92} height={th * 1.24} r={th * 0.3} color="rgba(0,0,0,0.5)">
        <BlurMask blur={T * 0.04} style="normal" />
      </RoundedRect>
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

  // Reconcile with engine rot ONLY when something other than a tap changed it
  // (undo / restart / hint). A tap already advanced `target` on press-in, so
  // here target ≡ rot (mod 4) and this is a no-op.
  const firstRot = useRef(true);
  useEffect(() => {
    if (!rotatable) return;
    let delta = (((rot - anim.target.value) % 4) + 4) % 4;
    if (delta === 3) delta = -1;
    if (delta !== 0) {
      anim.target.value = anim.target.value + delta;
      anim.angle.value = withTiming(anim.target.value * 90, TURN);
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
  }, [rot]);

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
          <Path path={glowPath} style="stroke" strokeWidth={T * 0.46} strokeCap="round" color="rgba(0,0,0,0.55)" transform={[{ translateY: T * 0.05 }]}>
            <BlurMask blur={T * 0.05} style="normal" />
          </Path>
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
        <Path path={glowPath} style="stroke" strokeWidth={T * 0.3} strokeCap="round" color={pulseCol.glow}>
          <BlurMask blur={T * 0.08} style="normal" />
        </Path>
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
                <Circle cx={ix} cy={iy} r={T * 0.16} color={palette.danger} opacity={0.45}>
                  <BlurMask blur={T * 0.06} style="normal" />
                </Circle>
                <Circle cx={ix} cy={iy} r={dripR} color="#FFD0CA" />
              </Group>
            );
          })}
        </Group>
      ) : null}
      {/* glow flash on tap / win sweep */}
      <Group opacity={flashOpacity}>
        <Path path={glowPath} style="stroke" strokeWidth={T * 0.34} strokeCap="round" color="#FFFFFF">
          <BlurMask blur={T * 0.06} style="normal" />
        </Path>
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

  // 1.2 s sine loop: source ring / unsolved-drain breathing.
  const pulse = useSharedValue(0);
  const breathe = isSource || !fluid.solvedSink;
  useEffect(() => {
    if (!breathe) { pulse.value = withTiming(0, { duration: 300 }); return; }
    pulse.value = 0;
    pulse.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }), -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breathe]);
  const ringR = useDerivedValue(() => T * (0.3 + pulse.value * 0.2));
  const ringOp = useDerivedValue(() => (1 - pulse.value) * 0.85);
  const coreOp = useDerivedValue(() => (fluid.solvedSink ? 0.95 : 0.3 + 0.25 * Math.sin(pulse.value * Math.PI)));

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
        <Circle cx={c} cy={c} r={T * 0.42} color={hex.glow} opacity={0.35}>
          <BlurMask blur={T * 0.14} style="normal" />
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
        <Circle cx={c} cy={c} r={ringR} style="stroke" strokeWidth={Math.max(2, T * 0.035)} color={hex.glow} opacity={ringOp} />
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
      <Circle cx={c} cy={c} r={disc * 0.5} color="rgba(0,0,0,0.6)" transform={[{ translateY: T * 0.04 }]}>
        <BlurMask blur={T * 0.05} style="normal" />
      </Circle>
      <SkImage image={drainImg} x={c - disc / 2} y={c - disc / 2} width={disc} height={disc} fit="contain">
        {drainMatrix ? <ColorMatrix matrix={drainMatrix} /> : null}
      </SkImage>
      {/* soft inner glow in the drain's colour */}
      <Circle cx={c} cy={c} r={disc * 0.34} opacity={coreOp}>
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
        <Circle cx={x} cy={y} r={flashR} color={color} opacity={flash}>
          <BlurMask blur={T * 0.05} style="normal" />
        </Circle>
      ) : null}
      {Array.from({ length: 7 }, (_, k) => {
        const a = (k / 7) * Math.PI * 2 + seed;
        const dist = T * (0.22 + ((k * 37 + seed * 11) % 10) / 40);
        return <Spark key={k} x={x} y={y} angle={a} dist={dist} size={T * (color === STEAM ? 0.05 : 0.035)} color={color} t={t} />;
      })}
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
        <RoundedRect x={ringIn} y={ringIn} width={ringW} height={ringW} r={T * 0.18} style="stroke" strokeWidth={T * 0.07} color={palette.accent}>
          <BlurMask blur={T * 0.05} style="solid" />
        </RoundedRect>
      </Group>
      <Group opacity={denyOp} origin={vec(c, c)} transform={denyT}>
        <Circle cx={c} cy={c} r={T * 0.3} color="rgba(255,93,93,0.28)">
          <BlurMask blur={T * 0.06} style="normal" />
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
  const fluids = useMemo(() => def.cells.map((_, i) => tileFluid(def, rot, fv, i)), [def, rot, fv]);
  const view = useMemo(() => boardView(def), [def]);
  const { bezel, well } = boardChrome(T);

  const sp: Sprites = {
    straight: useImage(art.pipe_straight),
    elbow: useImage(art.pipe_elbow),
    blocker: useImage(art.tile_blocker),
    source: useImage(art.endpoint_source_blue),
    drainBlue: useImage(art.endpoint_drain_blue),
    drainRed: useImage(art.endpoint_drain_red),
    sweep: useImage(art.fx_glow_sweep),
    particles: useImage(art.fx_particles_pack),
  };

  const anims = useMemo<TileAnim[]>(
    () => def.cells.map((cell) => ({
      angle: makeMutable(cell.r * 90),
      target: makeMutable(cell.r),
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
    a.target.value = a.target.value + 1;
    a.angle.value = withTiming(a.target.value * 90, TURN);
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
          {/* hint ring */}
          {hintIndex != null && def.cells[hintIndex] && inView(hintIndex) ? (() => {
            const { x, y } = cellXY(hintIndex);
            return (
              <Group opacity={hintOp}>
                <RoundedRect x={x + 3} y={y + 3} width={T - 6} height={T - 6} r={T * 0.16} style="stroke" strokeWidth={T * 0.06} color={palette.primary}>
                  <BlurMask blur={4} style="solid" />
                </RoundedRect>
              </Group>
            );
          })() : null}
          {/* level-1 guide: faint dotted route, glowing ring on the next pipe */}
          {guide && guide.route.length > 1 ? (
            <Path
              path={P(guide.route.map((i, k) => { const { x, y } = cellXY(i); return `${k ? "L" : "M"}${x + T / 2} ${y + T / 2}`; }).join(""))}
              style="stroke" strokeWidth={Math.max(3, T * 0.05)} strokeCap="round" strokeJoin="round" color="rgba(46,196,255,0.55)"
            >
              <DashPathEffect intervals={[T * 0.04, T * 0.11]} />
            </Path>
          ) : null}
          {guide?.next != null && inView(guide.next) ? (() => {
            const { x, y } = cellXY(guide.next);
            return (
              <Group opacity={hintOp}>
                <RoundedRect x={x + 3} y={y + 3} width={T - 6} height={T - 6} r={T * 0.16} color="rgba(46,196,255,0.14)" />
                <RoundedRect x={x + 3} y={y + 3} width={T - 6} height={T - 6} r={T * 0.16} style="stroke" strokeWidth={T * 0.06} color={palette.accent}>
                  <BlurMask blur={4} style="solid" />
                </RoundedRect>
              </Group>
            );
          })() : null}
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
          {/* guide: the target drain throbs */}
          {guide?.drainPulse && guide.route.length ? (() => {
            const { x, y } = cellXY(guide.route[guide.route.length - 1]);
            return <Circle cx={x + T / 2} cy={y + T / 2} r={drainRingR} style="stroke" strokeWidth={Math.max(3, T * 0.05)} color={palette.accent} opacity={drainRingOp} />;
          })() : null}
          {/* win glow sweep */}
          <Group transform={sweepT} opacity={sweepOp} blendMode="plus">
            <SkImage image={sp.sweep} x={0} y={-innerH * 0.1} width={sweepW} height={innerH * 1.2} fit="fill" />
          </Group>
          {/* soft 12 px inner shadow pushes the grid into the tray */}
          <RoundedRect x={-6} y={-6} width={innerW + 12} height={innerH + 12} r={rr + 6} style="stroke" strokeWidth={18} color="rgba(0,0,0,0.75)">
            <BlurMask blur={12} style="normal" />
          </RoundedRect>
          <RoundedRect x={0} y={0} width={innerW} height={innerH} r={rr}>
            <RadialGradient c={vec(innerW / 2, innerH * 0.45)} r={Math.max(innerW, innerH) * 0.7} colors={["rgba(46,196,255,0.05)", "rgba(0,0,0,0)", "rgba(0,0,0,0.3)"]} positions={[0, 0.6, 1]} />
          </RoundedRect>
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
