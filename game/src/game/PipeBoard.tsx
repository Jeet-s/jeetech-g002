/**
 * Flow Forge — the board renderer (Skia), drawn with the studio art (assets/art, baked by scripts/bake-art.py):
 * a recessed graphite tray (board_tray) with an engraved socket (tile_slot) under every cell, brass-collared
 * glass pipes seated in the sockets, valve-wheel sources, glass-lens drains, colour filter lenses, gear-linked
 * pipe groups and the mixer vat.
 *
 * Every pipe is one baked sprite in two states: DRY (smoky empty glass, brass collars) and FILLED (the luminous
 * fluid of its colour) clipped to exactly the arms the fluid reaches, so a mis-rotated pipe visibly breaks the
 * line. Fluid fades in with a 600 ms sweep, bubbles drift through lit pipes, sources pulse a ring, drains glow
 * in the colour they want, and a leaking pipe pulses a red drip at its open end.
 *
 * FEEL: a tap reacts the INSTANT the finger lands (press swell + cyan rim ring on every pipe that turns) and the
 * engine's new rotation spins the pipe a 150 ms quarter turn with an elastic settle. The drawn angle is driven
 * only by the engine state (`rot`), so the board is always what the game evaluates. Each joint a turn makes
 * pops the sparkle-burst art in the fluid's colour; a joint it breaks puffs pale steam. Tapping a bolted piece
 * flashes a red X with a short "Bolted" toast. Pure presentational — logic stays in the engine.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import {
  Canvas, Circle, DashPathEffect, Group, Image as SkImage, Path, RadialGradient, RoundedRect, Skia,
  SweepGradient, useImage, vec, type SkImage as SkImageT,
} from "@shopify/react-native-skia";
import {
  Easing, makeMutable, useDerivedValue, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Cell, Color, LevelDef, N, E, S, W, DIRS, turnsWith } from "./engine";
import { FlowView, TileFluid, litJoints, rotateDir, tileFluid } from "./board";
import { art } from "../art";
import { sprites } from "../sprites";
import { NineSlice, TapRipple, feedback, fonts, palette, springs } from "../ui";

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
/** Tray rim (board_tray art) + inner margin around the grid, in whole dp, for a tile size. */
export function boardChrome(tile: number) {
  const bezel = Math.round(Math.max(14, Math.min(28, tile * 0.3)));
  const well = Math.round(Math.max(4, tile * 0.1));
  return { bezel, well, edge: bezel + well };
}

/** Per-tile visual state the touch overlay drives imperatively (no React round-trip). */
interface TileAnim {
  angle: SharedValue<number>; // live rotation in degrees
  scale: SharedValue<number>;
  flash: SharedValue<number>; // white glow (tap / win)
  error: SharedValue<number>; // red leak pulse
  fill: SharedValue<number>; // 0..1 fluid fill sweep
  ring: SharedValue<number>; // cyan rim ring around a tapped tile
  pulse: SharedValue<number>; // fluid-coloured pulse when a joint connects
  deny: SharedValue<number>; // red X on a tap that can't rotate anything
}

/** Quarter-turn: a quick swing 10° PAST the new angle, then a 140 ms ease-out settle onto it. */
const OVERSHOOT = 10;
const SWING = { duration: 90, easing: Easing.out(Easing.quad) };
const SETTLE = { duration: 140, easing: Easing.out(Easing.cubic) };

type State = "dry" | Color;
type Sheet = Record<State, SkImageT | null>;
interface Sprites {
  straight: Sheet; elbow: Sheet; tee: Sheet; stub: Sheet; lens: Sheet;
  wheel: SkImageT | null; slot: SkImageT | null; slotSunk: SkImageT | null; slotLift: SkImageT | null; gears: (SkImageT | null)[]; sparkle: SkImageT | null; glow: SkImageT | null;
}
const STATES: State[] = ["dry", "blue", "red", "green", "yellow", "purple"];

/** All board sprites, loaded once per board (fixed hook order). */
function useSprites(): Sprites {
  const sheet = (shape: "straight" | "elbow" | "tee" | "stub"): Sheet => {
    const out = {} as Sheet;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    for (const st of STATES) out[st] = useImage(sprites.pipe(shape, st));
    return out;
  };
  const straight = sheet("straight"), elbow = sheet("elbow"), tee = sheet("tee"), stub = sheet("stub");
  const lens = {} as Sheet;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  for (const st of STATES) lens[st] = useImage(sprites.lens(st));
  const wheel = useImage(sprites.valveWheel);
  const slot = useImage(sprites.slot);
  const slotSunk = useImage(sprites.slotSunk);
  const slotLift = useImage(sprites.slotLift);
  const g0 = useImage(sprites.gear[0]), g1 = useImage(sprites.gear[1]), g2 = useImage(sprites.gear[2]);
  const sparkle = useImage(art.fx_sparkle_burst);
  const glow = useImage(art.fx_flow_glow);
  const all = [...STATES.flatMap((s) => [straight[s], elbow[s], tee[s], stub[s], lens[s]]), wheel, slot, slotSunk, slotLift, g0, g1, g2, sparkle, glow];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ({ straight, elbow, tee, stub, lens, wheel, slot, slotSunk, slotLift, gears: [g0, g1, g2], sparkle, glow }), all);
}

// ── Colour ───────────────────────────────────────────────────────────────────
const FLUID: Record<Color, { glow: string; hot: string }> = {
  blue: { glow: "#12D1E6", hot: "#D6FBFF" },
  red: { glow: "#FF5D5D", hot: "#FFE1DC" },
  green: { glow: "#6EE06F", hot: "#E4FFE4" },
  yellow: { glow: "#FFB24D", hot: "#FFF1D6" },
  purple: { glow: "#B16BFF", hot: "#F1E2FF" },
};
const GEAR_TINT = ["#E7B74A", "#C9D2DA", "#D9814A"];

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
const pathCache = new Map<string, ReturnType<typeof Skia.Path.MakeFromSVGString>>();
function P(d: string) {
  if (!pathCache.has(d)) pathCache.set(d, Skia.Path.MakeFromSVGString(d));
  return pathCache.get(d)!;
}
/** Points along the fluid's route through a tile (centre-line of `dirs`), so
 *  bubbles can ride the pipe on the UI thread without touching Skia paths. */
function routeSamples(dirs: number[], T: number, n = 16): number[][] {
  const c = T / 2;
  const out: number[][] = [];
  if (dirs.length === 2) {
    const [a, b] = dirs.map((d) => edgePt(d, T));
    const pts: number[] = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n, u = 1 - t;
      pts.push(u * u * a[0] + 2 * u * t * c + t * t * b[0], u * u * a[1] + 2 * u * t * c + t * t * b[1]);
    }
    out.push(pts);
    return out;
  }
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
  const opacity = useDerivedValue(() => 0.8 * Math.sin(((FLOW_CLOCK.value + offset) % 1) * Math.PI));
  return (
    <Group opacity={opacity}>
      <Circle cx={cx} cy={cy} r={r} color={color} opacity={0.5} />
      <Circle cx={cx} cy={cy} r={r} style="stroke" strokeWidth={1} color="rgba(255,255,255,0.9)" />
    </Group>
  );
}

/** Quarter turns that bring each baked base sprite onto a mask. */
const STRAIGHT_K: Record<number, number> = { [E | W]: 0, [N | S]: 1 };
const ELBOW_K: Record<number, number> = { [E | S]: 0, [S | W]: 1, [W | N]: 2, [N | E]: 3 };
const TEE_K: Record<number, number> = { [E | S | W]: 0, [S | W | N]: 1, [W | N | E]: 2, [N | E | S]: 3 };
/** Quarter turns from the base "points East" frame to direction d. */
const DIR_K: Record<number, number> = { [E]: 0, [S]: 1, [W]: 2, [N]: 3 };

// ── Sprite pieces ─────────────────────────────────────────────────────────────
function Turned({ k, T, children }: { k: number; T: number; children: React.ReactNode }) {
  return k ? <Group origin={vec(T / 2, T / 2)} transform={[{ rotate: (k * Math.PI) / 2 }]}>{children}</Group> : <>{children}</>;
}

/** The pipe sprite for `mask` (in the tile's base frame), dry or filled with one fluid. */
function PipeSprite({ mask, T, sp, state }: { mask: number; T: number; sp: Sprites; state: State }) {
  const img = (sheet: Sheet) => <SkImage image={sheet[state]} x={0} y={0} width={T} height={T} fit="fill" />;
  if (STRAIGHT_K[mask] !== undefined) return <Turned k={STRAIGHT_K[mask]} T={T}>{img(sp.straight)}</Turned>;
  if (ELBOW_K[mask] !== undefined) return <Turned k={ELBOW_K[mask]} T={T}>{img(sp.elbow)}</Turned>;
  if (TEE_K[mask] !== undefined) return <Turned k={TEE_K[mask]} T={T}>{img(sp.tee)}</Turned>;
  // Fallback (single port): a stub capped by the dead-end lens.
  const d = DIRS.find((x) => mask & x) ?? E;
  return (
    <Group>
      <Turned k={DIR_K[d]} T={T}>{img(sp.stub)}</Turned>
      <SkImage image={sp.lens.dry} x={T * 0.3} y={T * 0.3} width={T * 0.4} height={T * 0.4} fit="contain" />
    </Group>
  );
}

/** A straight stub from the centre to one port (endpoint mouths). */
function Stub({ d, T, sp, state }: { d: number; T: number; sp: Sprites; state: State }) {
  return <Turned k={DIR_K[d]} T={T}><SkImage image={sp.stub[state]} x={0} y={0} width={T} height={T} fit="fill" /></Turned>;
}

/** Fluid layer: the filled sprite clipped to the lit arms, with a soft halo that sweeps in as it fills. */
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
            {/* inner bloom: two feathered strokes under the glass, sweeping along the pipe as it fills */}
            <Path path={P(center)} style="stroke" strokeWidth={T * 0.5} strokeCap="round" color={hex.glow} opacity={0.1} end={sweepEnd} />
            <Path path={P(center)} style="stroke" strokeWidth={T * 0.36} strokeCap="round" color={hex.glow} opacity={0.16} end={sweepEnd} />
            <Group clip={clip} opacity={fill}>
              <PipeSprite mask={cell.m} T={T} sp={sp} state={col} />
            </Group>
          </Group>
        );
      })}
    </>
  );
}

/** Loose pipes ride a turntable cradle: two brass rails on opposite sides of the tile that turn WITH the pipe. They
 *  read "this one turns" (bolted pipes get the riveted plate instead), and since the pair swaps between the
 *  N/S and E/W edges on every quarter turn, each turn visibly changes every part of the tile — even an edge or
 *  corner the pipe's arms never reach. */
function Cradle({ T }: { T: number }) {
  const h = Math.max(3, Math.round(T * 0.06));
  const x0 = T * 0.12, len = T * 0.76, inset = Math.max(2, Math.round(T * 0.045));
  const rv = Math.max(1.5, h * 0.42);
  return (
    <Group>
      {[inset, T - inset - h].map((y) => (
        <Group key={y}>
          <RoundedRect x={x0} y={y + 1.2} width={len} height={h} r={h / 2} color="rgba(0,0,0,0.5)" />
          <RoundedRect x={x0} y={y} width={len} height={h} r={h / 2} color={palette.brassDark} />
          <RoundedRect x={x0 + 1} y={y} width={len - 2} height={h * 0.55} r={h / 2} color={palette.brass} opacity={0.9} />
          {[x0 + h * 0.8, x0 + len - h * 0.8].map((cx) => (
            <Circle key={cx} cx={cx} cy={y + h / 2} r={rv} color="#FFE7A8" />
          ))}
        </Group>
      ))}
    </Group>
  );
}

/** Bolted pipes sit on a raised, riveted plate (the socket art lifted) so players read "fixed" at a glance. */
function BoltPlate({ T, sp }: { T: number; sp: Sprites }) {
  const p = T * 0.04, r = T * 0.04, q = T * 0.15;
  const corners = [[q, q], [T - q, q], [q, T - q], [T - q, T - q]];
  return (
    <Group>
      <SkImage image={sp.slotLift} x={p} y={p} width={T - p * 2} height={T - p * 2} fit="fill" />
      {corners.map(([x, y], k) => (
        <Group key={k}>
          <Circle cx={x} cy={y + 1.2} r={r} color="rgba(0,0,0,0.55)" />
          <Circle cx={x} cy={y} r={r}>
            <RadialGradient c={vec(x - r * 0.35, y - r * 0.35)} r={r * 1.5} colors={["#FFE7A8", "#C8922F", "#6A4414"]} />
          </Circle>
        </Group>
      ))}
    </Group>
  );
}

/** Cross-overpass: the N–S channel runs underneath, the E–W channel bridges over it. */
function Overpass({ fluid, T, sp, fill }: { fluid: TileFluid; T: number; sp: Sprites; fill: SharedValue<number> }) {
  const c = T / 2;
  const under = fluid.arm[N] ?? fluid.arm[S] ?? null;
  const over = fluid.arm[E] ?? fluid.arm[W] ?? null;
  const channel = (vertical: boolean, col: Color | null) => (
    <Turned k={vertical ? 1 : 0} T={T}>
      <SkImage image={sp.straight.dry} x={0} y={0} width={T} height={T} fit="fill" />
      {col ? (
        <Group opacity={fill}>
          <SkImage image={sp.straight[col]} x={0} y={0} width={T} height={T} fit="fill" />
        </Group>
      ) : null}
    </Turned>
  );
  return (
    <Group>
      {channel(true, under)}
      {/* the bridge's shadow falls across the lower channel */}
      <RoundedRect x={T * 0.06} y={c - T * 0.2} width={T * 0.88} height={T * 0.44} r={T * 0.14} color="rgba(0,0,0,0.42)" />
      <Group transform={[{ translateY: -T * 0.03 }]}>{channel(false, over)}</Group>
    </Group>
  );
}

/** Colour filter: a glass lens of its colour set into the pipe's middle — only that fluid passes. */
function FilterLens({ T, sp, color, lit }: { T: number; sp: Sprites; color: Color; lit: boolean }) {
  const s = T * 0.44, x = (T - s) / 2;
  return (
    <Group>
      <Circle cx={T / 2} cy={T / 2 + T * 0.02} r={s * 0.52} color="rgba(0,0,0,0.45)" />
      <SkImage image={sp.lens[color]} x={x} y={x} width={s} height={s} fit="contain" opacity={lit ? 1 : 0.82} />
      <Circle cx={T / 2} cy={T / 2} r={s * 0.5} style="stroke" strokeWidth={Math.max(1.5, T * 0.025)} color={FLUID[color].glow} opacity={0.75} />
    </Group>
  );
}

const Tile = memo(function Tile({ cell, rot, fluid, T, anim, sp, winPulse, winDelay, beckon }: {
  cell: Cell; rot: number; fluid: TileFluid; T: number; anim: TileAnim; sp: Sprites; winPulse: number; winDelay: number;
  /** Tutorial beckon (the pipe the coach wants turned): a 1.05x double beat every 1.5 s. */
  beckon?: SharedValue<number>;
}) {
  const c = T / 2;
  const rotatable = !cell.f;
  const dirs = openDirs(cell);
  const live = !!fluid.body || dirs.some((d) => fluid.arm[d]);
  const leaking = live && (cell.t === "pipe" || cell.t === "gate") && dirs.some((d) => !fluid.arm[d]);

  // Fluid arrives: 500 ms fill sweep + a soft swell, acknowledged where it happens.
  const wasLive = useRef(false);
  useEffect(() => {
    if (live && !wasLive.current) {
      anim.fill.value = 0;
      // 500 ms (was 600): water reaches each joint ~17% sooner, so a connection lands snappier.
      anim.fill.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
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
        const target = turns.current * 90;
        anim.angle.value = withSequence(withTiming(target + delta * OVERSHOOT, SWING), withTiming(target, SETTLE));
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
    rotatable ? [{ rotateZ: (anim.angle.value * Math.PI) / 180 }] : [{ rotateZ: (rot * Math.PI) / 2 }],
  );
  const plain = useDerivedValue(() => [{ scale: anim.scale.value * (beckon ? beckon.value : 1) }]);
  const flashOpacity = useDerivedValue(() => anim.flash.value * 0.5);
  const errorOpacity = useDerivedValue(() => anim.error.value * 0.9);
  const dripR = useDerivedValue(() => T * (0.06 + anim.error.value * 0.05));
  const pulseOpacity = useDerivedValue(() => anim.pulse.value * 0.9);
  const pulseCol = FLUID[fluid.body ?? "blue"];
  const leaks = leaking ? dirs.filter((d) => !fluid.arm[d]) : [];

  if (cell.t === "empty") return null;
  const isEndpoint = cell.t === "source" || cell.t === "sink";
  const glowPath = P(armsPath(dirs, T));

  return (
    <Group origin={vec(c, c)} transform={plain}>
      {cell.f && !isEndpoint && !cell.x ? <BoltPlate T={T} sp={sp} /> : null}
      <Group origin={vec(c, c)} transform={transform}>
        {rotatable && !isEndpoint ? <Cradle T={T} /> : null}
        {isEndpoint ? (
          <Endpoint cell={cell} T={T} fluid={fluid} sp={sp} fill={anim.fill} />
        ) : (
          <>
            {/* contact shadow in the socket */}
            <Path path={glowPath} style="stroke" strokeWidth={T * 0.34} strokeCap="round" color="rgba(0,0,0,0.32)" transform={[{ translateY: T * 0.05 }]} />
            {cell.x ? (
              <Overpass fluid={fluid} T={T} sp={sp} fill={anim.fill} />
            ) : (
              <>
                <PipeSprite mask={cell.m} T={T} sp={sp} state="dry" />
                <Fluid cell={cell} fluid={fluid} T={T} sp={sp} fill={anim.fill} />
                {cell.g && cell.c ? <FilterLens T={T} sp={sp} color={cell.c} lit={live} /> : null}
              </>
            )}
          </>
        )}
        {/* connection pulse: the fluid's colour races through the pipe */}
        <Group opacity={pulseOpacity}>
          <Path path={glowPath} style="stroke" strokeWidth={T * 0.4} strokeCap="round" color={pulseCol.glow} opacity={0.3} />
          <Path path={glowPath} style="stroke" strokeWidth={T * 0.08} strokeCap="round" color={pulseCol.hot} />
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
          <Path path={glowPath} style="stroke" strokeWidth={T * 0.3} strokeCap="round" color="#FFFFFF" opacity={0.45} />
        </Group>
      </Group>
    </Group>
  );
});

/** Sources: the valve — a lens brimming with its colour under the red hand-wheel. Drains: an empty glass lens
 *  ringed in the colour it wants (pale fluid ghosted inside), brimming once filled. The mixer vat: a bigger lens
 *  ringed half blue / half red. */
function Endpoint({ cell, T, fluid, sp, fill }: { cell: Cell; T: number; fluid: TileFluid; sp: Sprites; fill: SharedValue<number> }) {
  const c = T / 2;
  const col: Color = cell.c ?? "blue";
  const hex = FLUID[col];
  const isSource = cell.t === "source";
  const vat = !isSource && col === "purple";
  const port = openDirs(cell)[0] ?? S;

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
  const burstR = useDerivedValue(() => T * (0.34 + (1 - burst.value) * 0.3));
  const burstOp = useDerivedValue(() => burst.value * 0.9);

  const d = (vat ? 0.78 : 0.64) * T;
  const lx = c - d / 2;
  const ringW = Math.max(2.5, T * (vat ? 0.07 : 0.055));
  const armCol = fluid.arm[port] ?? null;
  return (
    <Group>
      <Stub d={port} T={T} sp={sp} state="dry" />
      {isSource || armCol ? (
        <Group opacity={isSource ? 1 : fill}>
          <Stub d={port} T={T} sp={sp} state={isSource ? col : armCol!} />
        </Group>
      ) : null}
      {/* colour halo behind the housing */}
      <Circle cx={c} cy={c} r={d * 0.62}>
        <RadialGradient c={vec(c, c)} r={d * 0.62} colors={[hex.glow, "rgba(0,0,0,0)"]} positions={[0.3, 1]} />
      </Circle>
      <Circle cx={c} cy={c + T * 0.035} r={d * 0.5} color="rgba(0,0,0,0.5)" />
      {isSource ? (
        <>
          <SkImage image={sp.lens[col]} x={lx} y={lx} width={d} height={d} fit="contain" />
          {/* the valve's red hand-wheel across the lens */}
          <SkImage image={sp.wheel} x={c - d * 0.5} y={c - d * 0.17} width={d} height={d * 0.3} fit="contain" />
        </>
      ) : (
        <>
          <SkImage image={sp.lens.dry} x={lx} y={lx} width={d} height={d} fit="contain" />
          <SkImage image={sp.lens[col]} x={lx} y={lx} width={d} height={d} fit="contain" opacity={fluid.solvedSink ? 1 : 0.28} />
          {vat ? (
            <Circle cx={c} cy={c} r={d * 0.5 + ringW * 0.2} style="stroke" strokeWidth={ringW}>
              <SweepGradient c={vec(c, c)} colors={[FLUID.blue.glow, FLUID.purple.glow, FLUID.red.glow, FLUID.purple.glow, FLUID.blue.glow]} />
            </Circle>
          ) : (
            <Circle cx={c} cy={c} r={d * 0.5 + ringW * 0.2} style="stroke" strokeWidth={ringW} color={hex.glow} opacity={0.9} />
          )}
        </>
      )}
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
const STEAM = "rgba(226,232,238,0.85)";

/** Joint made: the sparkle-burst art pops (80 ms) and fades, tinted to the fluid. Joint broken: a steam puff. */
function JointBurst({ x, y, color, T, seed, sp }: { x: number; y: number; color: string; T: number; seed: number; sp: Sprites }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: color === STEAM ? 520 : 480, easing: Easing.out(Easing.quad) });
  }, [t, color]);
  const s = T * 0.7;
  const pop = useDerivedValue(() => [{ scale: t.value < 0.17 ? 0.3 + (t.value / 0.17) * 0.8 : 1.1 - (t.value - 0.17) * 0.25 }, { rotate: t.value * 0.6 + seed }]);
  const op = useDerivedValue(() => (t.value < 0.17 ? 1 : Math.max(0, 1 - (t.value - 0.17) / 0.83)));
  if (color === STEAM) {
    return (
      <Group>
        {Array.from({ length: 6 }, (_, k) => {
          const a = (k / 6) * Math.PI * 2 + seed;
          return <Spark key={k} x={x} y={y} angle={a} dist={T * (0.2 + ((k * 37) % 10) / 50)} size={T * 0.05} color={STEAM} t={t} />;
        })}
      </Group>
    );
  }
  return (
    <Group opacity={op} origin={vec(x, y)} transform={pop}>
      <Circle cx={x} cy={y} r={s * 0.32}>
        <RadialGradient c={vec(x, y)} r={s * 0.32} colors={[color, "rgba(0,0,0,0)"]} />
      </Circle>
      <SkImage image={sp.sparkle} x={x - s / 2} y={y - s / 2} width={s} height={s} fit="contain" />
    </Group>
  );
}

/** A turn's exhale: 3-4 tiny bubbles / steam puffs per open end (6-10 in all), fanned outward and fading in 420 ms. */
function TurnPuff({ ends, color, T, seed }: { ends: { x: number; y: number; a: number }[]; color: string; T: number; seed: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) });
  }, [t]);
  const per = Math.max(2, Math.min(4, Math.round(9 / Math.max(1, ends.length))));
  return (
    <Group>
      {ends.flatMap((e, n) => Array.from({ length: per }, (_, k) => {
        const h = ((seed * 7 + n * 13 + k * 29) % 17) / 17;
        const a = e.a + (k / Math.max(1, per - 1) - 0.5) * 1.1;
        return <Spark key={`${n}-${k}`} x={e.x} y={e.y} angle={a} dist={T * (0.16 + h * 0.18)} size={T * (0.03 + h * 0.025)} color={color} t={t} />;
      }))}
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
              <Path path={P(armsPath(all ? dirs : arms, T))} style="stroke" strokeWidth={T * 0.04} strokeCap="round" color={hex.hot} opacity={0.4}>
                <DashPathEffect intervals={[T * 0.1, T * 0.32]} phase={phase} />
              </Path>
              {routeSamples(all ? dirs : arms, T, 8).map((route, j, rs) => (
                <Bubble key={j} route={route} offset={j / rs.length} size={T * 0.035} color={hex.hot} />
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
  const ringR = useDerivedValue(() => T * (0.34 + pulse.value * 0.18));
  const ringOp = useDerivedValue(() => (1 - pulse.value) * 0.8);
  const coreOp = useDerivedValue(() => 0.35 * Math.sin(pulse.value * Math.PI));
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

/** Tap rim ring + red "bolted" X, drawn square to the grid (never spins). */
function TileOverlay({ x, y, T, anim }: { x: number; y: number; T: number; anim: TileAnim }) {
  const ringOp = useDerivedValue(() => anim.ring.value * 0.9);
  const ringIn = useDerivedValue(() => 3 - (1 - anim.ring.value) * 2);
  const ringW = useDerivedValue(() => T - (3 - (1 - anim.ring.value) * 2) * 2);
  const denyOp = useDerivedValue(() => anim.deny.value);
  const denyT = useDerivedValue(() => [{ scale: 0.7 + anim.deny.value * 0.35 }]);
  const c = T / 2, k = T * 0.2;
  return (
    <Group transform={[{ translateX: x }, { translateY: y }]}>
      <Group opacity={ringOp}>
        <RoundedRect x={ringIn} y={ringIn} width={ringW} height={ringW} r={T * 0.16} style="stroke" strokeWidth={T * 0.1} color={palette.glowSoft} />
        <RoundedRect x={ringIn} y={ringIn} width={ringW} height={ringW} r={T * 0.16} style="stroke" strokeWidth={T * 0.035} color={palette.glow} />
      </Group>
      <Group opacity={denyOp} origin={vec(c, c)} transform={denyT}>
        <Circle cx={c} cy={c} r={T * 0.34}>
          <RadialGradient c={vec(c, c)} r={T * 0.34} colors={["rgba(255,93,93,0.45)", "rgba(255,93,93,0)"]} />
        </Circle>
        <Path path={P(`M${c - k} ${c - k}L${c + k} ${c + k}M${c + k} ${c - k}L${c - k} ${c + k}`)} style="stroke" strokeWidth={T * 0.08} strokeCap="round" color={palette.danger} />
      </Group>
    </Group>
  );
}

/** A geared pipe's gear: the gear-token art (tinted per group) on the tile corner, spinning as the group turns. */
function GearBadge({ x, y, T, anim, group, sp }: { x: number; y: number; T: number; anim: TileAnim; group: number; sp: Sprites }) {
  const s = Math.round(T * 0.34);
  const gx = x + T * 0.03, gy = y + T * 0.03;
  const spin = useDerivedValue(() => [{ rotate: (anim.angle.value * Math.PI) / 180 }]);
  return (
    <Group>
      <Circle cx={gx + s / 2} cy={gy + s / 2 + 1.5} r={s * 0.48} color="rgba(0,0,0,0.45)" />
      <Group origin={vec(gx + s / 2, gy + s / 2)} transform={spin}>
        <SkImage image={sp.gears[group % 3]} x={gx} y={gy} width={s} height={s} fit="contain" />
      </Group>
    </Group>
  );
}

/** Level-1 guide: a faint dotted line along the route and a breathing ring on the next pipe to turn. */
export interface Guide { route: number[]; next: number | null; drainPulse: boolean }

/** board_tray art: 422x512, rim + cyan accent line inside 62 px caps (the inner panel starts at ~56 px). */
const TRAY = { w: 422, h: 512, cap: 62, inset: 56, fill: "#39332D" };

/** The full board: the graphite tray, a socket per cell and the pipe tiles. */
export function PipeBoard({
  def, rot, fv, tile, onTapCell, hintIndex, winPulse, interactive = true, guide, beckon = null,
}: {
  def: LevelDef; rot: number[]; fv: FlowView; tile: number;
  onTapCell: (i: number) => void; hintIndex: number | null; winPulse: number; interactive?: boolean;
  guide?: Guide | null;
  /** Tutorial target: this pipe beats 1.05x twice every 1.5 s until the player turns it. */
  beckon?: number | null;
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
  const sp = useSprites();

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

  // Win: the flow-glow art sweeps across the board (600 ms cubic).
  const sweepX = useSharedValue(-2);
  useEffect(() => {
    if (winPulse > 0) {
      sweepX.value = -0.3;
      sweepX.value = withDelay(180, withTiming(1.3, { duration: 600, easing: Easing.inOut(Easing.cubic) }));
    }
  }, [winPulse, sweepX]);

  // Tutorial beckon: two quick 1.05x beats, then rest — one cycle every 1.5 s.
  const beckonS = useSharedValue(1);
  useEffect(() => {
    if (beckon == null) { beckonS.value = withTiming(1, { duration: 120 }); return; }
    const beat = (ms: number) => withTiming(1.05, { duration: ms, easing: Easing.out(Easing.quad) });
    const back = (ms: number) => withTiming(1, { duration: ms, easing: Easing.in(Easing.quad) });
    beckonS.value = 1;
    beckonS.value = withDelay(400, withRepeat(withSequence(beat(130), back(130), beat(130), back(150), withTiming(1, { duration: 960 })), -1));
  }, [beckon, beckonS]);

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

  const sweepW = innerW * 0.3;
  const sweepT = useDerivedValue(() => [{ translateX: sweepX.value * innerW - sweepW / 2 }]);
  const sweepOp = useDerivedValue(() => (sweepX.value > -0.3 && sweepX.value < 1.3 ? 0.75 : 0));

  const cellXY = (i: number) => {
    const col = (i % def.w) - view.c0, row = ((i / def.w) | 0) - view.r0;
    return { col, row, x: well + col * T, y: well + row * T };
  };
  const inView = (i: number) => {
    const { col, row } = cellXY(i);
    return col >= 0 && row >= 0 && col < view.cols && row < view.rows;
  };

  // Two-ring ripples at the finger (inner-board frame), so every tap reads even when the turn is subtle.
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const rippleId = useRef(0);
  const rippleTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => rippleTimers.current.forEach(clearTimeout), []);
  function ripple(x: number, y: number) {
    const id = ++rippleId.current;
    setRipples((r) => [...r.slice(-3), { id, x, y }]);
    rippleTimers.current.push(setTimeout(() => setRipples((r) => r.filter((q) => q.id !== id)), 320));
  }

  function spin(i: number, x: number, y: number) {
    // Every pipe that turns with this tap (its gear group) pops to 1.08x in 120 ms, springs back and flashes its rim.
    for (const j of turnsWith(def, i)) {
      const a = anims[j];
      a.scale.value = withSequence(withTiming(1.08, { duration: 120, easing: Easing.out(Easing.back(2)) }), withSpring(1, springs.pop));
      a.flash.value = withSequence(withTiming(0.8, { duration: 30 }), withTiming(0, { duration: 220 }));
      a.ring.value = withSequence(withTiming(1, { duration: 50 }), withTiming(0.55, { duration: 90 }), withTiming(1, { duration: 70 }), withTiming(0, { duration: 320, easing: Easing.out(Easing.quad) }));
    }
    ripple(x, y);
    feedback("move", "light");
    onTapCell(i);
  }

  // Bolted pipes, sources and drains can't turn: red X on that tile + a "Bolted" toast.
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

  // Joints made / broken since the last board: pulse + sparkle, or a puff of steam.
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

  // Every pipe a turn moves breathes a few bubbles (lit pipe: its fluid) or steam puffs (dry pipe) out of its ends.
  const [puffs, setPuffs] = useState<{ id: number; ends: { x: number; y: number; a: number }[]; color: string }[]>([]);
  const prevRot = useRef<{ def: LevelDef; rot: number[] } | null>(null);
  useEffect(() => {
    const before = prevRot.current?.def === def ? prevRot.current.rot : null;
    prevRot.current = { def, rot };
    if (!before || !interactive) return;
    const added: typeof puffs = [];
    rot.forEach((r, i) => {
      if (r === before[i] || added.length >= 3 || !inView(i)) return;
      const { x, y } = cellXY(i);
      const ends = DIRS.filter((d) => def.cells[i].m & d).map((bd) => {
        const d = rotateDir(bd, r);
        const [ex, ey] = edgePt(d, T);
        return { x: x + T / 2 + (ex - T / 2) * 0.86, y: y + T / 2 + (ey - T / 2) * 0.86, a: d === N ? -Math.PI / 2 : d === E ? 0 : d === S ? Math.PI / 2 : Math.PI };
      });
      const col = Object.values(fluids[i].arm).find(Boolean) as Color | undefined;
      added.push({ id: ++burstId.current, ends, color: col ? FLUID[col].hot : STEAM });
    });
    if (!added.length) return;
    setPuffs((p) => [...p.slice(-4), ...added]);
    const ids = new Set(added.map((p) => p.id));
    burstTimers.current.push(setTimeout(() => setPuffs((p) => p.filter((x) => !ids.has(x.id))), 520));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rot, def]);

  // A drain just filled (or the board is won): a bright sweep races along the whole lit network, source → drains,
  // so the completed path telegraphs success before the celebration.
  const solvedCount = fluids.filter((f) => f.solvedSink).length;
  const prevSolved = useRef<{ def: LevelDef; n: number } | null>(null);
  useEffect(() => {
    const before = prevSolved.current?.def === def ? prevSolved.current.n : null;
    prevSolved.current = { def, n: solvedCount };
    if (before == null || solvedCount <= before || !interactive) return;
    const adj = new Map<number, number[]>();
    const link = (a: number, b: number) => { adj.set(a, [...(adj.get(a) ?? []), b]); adj.set(b, [...(adj.get(b) ?? []), a]); };
    litJoints(def, rot, fluids).forEach((_, key) => {
      const i = parseInt(key, 10);
      link(i, key.endsWith("E") ? i + 1 : i + def.w);
    });
    const dist = new Map<number, number>();
    const queue: number[] = [];
    def.cells.forEach((c, i) => { if (c.t === "source") { dist.set(i, 0); queue.push(i); } });
    while (queue.length) {
      const i = queue.shift()!;
      for (const j of adj.get(i) ?? []) if (!dist.has(j)) { dist.set(j, dist.get(i)! + 1); queue.push(j); }
    }
    const far = Math.max(1, ...dist.values());
    const step = Math.min(45, 520 / far);
    dist.forEach((d, i) => {
      anims[i].pulse.value = withDelay(60 + d * step, withSequence(withTiming(1, { duration: 70 }), withTiming(0, { duration: 340, easing: Easing.out(Easing.quad) })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solvedCount, def]);

  // Guide: the drain throbs once the first pipe has been turned right.
  const guidePulse = useSharedValue(0);
  useEffect(() => {
    guidePulse.value = guide?.drainPulse ? withRepeat(withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }), -1) : 0;
  }, [guide?.drainPulse, guidePulse]);
  const drainRingR = useDerivedValue(() => T * (0.36 + guidePulse.value * 0.34));
  const drainRingOp = useDerivedValue(() => (1 - guidePulse.value) * 0.9);

  // Gear drive belts: a brass chain linking the gears of each group (they turn together).
  const belts = useMemo(() => def.groups.map((g, k) => {
    const pts = g.filter(inView).map((i) => { const { x, y } = cellXY(i); const s = T * 0.34; return [x + T * 0.03 + s / 2, y + T * 0.03 + s / 2]; });
    return { k, path: P(pts.map(([x, y], n) => `${n ? "L" : "M"}${x} ${y}`).join("")) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [def, T, well, view]);

  return (
    <View style={[styles.frame, { width: outerW, height: outerH }]}>
      <NineSlice
        source={art.board_tray}
        w={TRAY.w} h={TRAY.h}
        cap={{ l: TRAY.cap, t: TRAY.cap, r: TRAY.cap, b: TRAY.cap }}
        scale={capScale}
        fill={TRAY.fill}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.inner, { left: bezel, top: bezel, width: innerW, height: innerH }]}>
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* an engraved socket under every cell; blocked cells sink darker and stay empty */}
          {def.cells.map((cell, i) => {
            if (!inView(i)) return null;
            const { x, y } = cellXY(i);
            const p = Math.max(1, Math.round(T * 0.015));
            return cell.t === "empty" ? (
              <SkImage key={`s${i}`} image={sp.slotSunk} x={x + p} y={y + p} width={T - p * 2} height={T - p * 2} fit="fill" />
            ) : (
              <SkImage key={`s${i}`} image={sp.slot} x={x + p} y={y + p} width={T - p * 2} height={T - p * 2} fit="fill" />
            );
          })}
          {/* level-1 guide: faint dotted route */}
          {guide && guide.route.length > 1 ? (
            <Path
              path={P(guide.route.map((i, k) => { const { x, y } = cellXY(i); return `${k ? "L" : "M"}${x + T / 2} ${y + T / 2}`; }).join(""))}
              style="stroke" strokeWidth={Math.max(3, T * 0.05)} strokeCap="round" strokeJoin="round" color="rgba(18,209,230,0.6)"
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
                <Tile cell={cell} rot={rot[i]} fluid={fluids[i]} T={T} anim={anims[i]} sp={sp} winPulse={winPulse} winDelay={200 + (row + col) * 65} beckon={i === beckon ? beckonS : undefined} />
              </Group>
            );
          })}
          {/* gear drive belts + gears (square to the grid, spinning with their group) */}
          {belts.map((b) => (
            <Group key={`belt${b.k}`}>
              <Path path={b.path} style="stroke" strokeWidth={T * 0.08} strokeCap="round" strokeJoin="round" color="rgba(0,0,0,0.55)" />
              <Path path={b.path} style="stroke" strokeWidth={T * 0.05} strokeCap="round" strokeJoin="round" color={GEAR_TINT[b.k % 3]}>
                <DashPathEffect intervals={[T * 0.05, T * 0.035]} />
              </Path>
            </Group>
          ))}
          {def.cells.map((cell, i) => {
            if (cell.k === undefined || !inView(i)) return null;
            const { x, y } = cellXY(i);
            return <GearBadge key={`g${i}`} x={x} y={y} T={T} anim={anims[i]} group={cell.k} sp={sp} />;
          })}
          {/* tap rim rings + bolted X (square to the grid) */}
          {def.cells.map((cell, i) => {
            if (cell.t === "empty" || !inView(i)) return null;
            const { x, y } = cellXY(i);
            return <TileOverlay key={`o${i}`} x={x} y={y} T={T} anim={anims[i]} />;
          })}
          {/* joint sparkles / steam */}
          {bursts.map((b) => <JointBurst key={b.id} x={b.x} y={b.y} color={b.color} T={T} seed={b.id * 0.7} sp={sp} />)}
          {puffs.map((p) => <TurnPuff key={p.id} ends={p.ends} color={p.color} T={T} seed={p.id} />)}
          {/* win glow sweep */}
          <Group transform={sweepT} opacity={sweepOp} blendMode="plus">
            <SkImage image={sp.glow} x={0} y={-innerH * 0.05} width={sweepW} height={innerH * 1.1} fit="fill" />
          </Group>
          {/* soft inner shadow pushes the grid into the tray (stacked strokes, no blur pass) */}
          {[[2, 0.35], [6, 0.18]].map(([w, a]) => (
            <RoundedRect key={w} x={0} y={0} width={innerW} height={innerH} r={Math.max(6, T * 0.1)} style="stroke" strokeWidth={w * 2} color={`rgba(0,0,0,${a})`} />
          ))}
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
                <RoundedRect x={x + 2} y={y + 2} width={T - 4} height={T - 4} r={T * 0.16} style="stroke" strokeWidth={T * 0.1} color="rgba(255,178,77,0.35)" />
                <RoundedRect x={x + 4} y={y + 4} width={T - 8} height={T - 8} r={T * 0.15} style="stroke" strokeWidth={T * 0.05} color={palette.secondary} />
              </Group>
            );
          })() : null}
          {guide?.next != null && inView(guide.next) ? (() => {
            const { x, y } = cellXY(guide.next);
            return (
              <Group opacity={hintOp}>
                <RoundedRect x={x + 3} y={y + 3} width={T - 6} height={T - 6} r={T * 0.16} color="rgba(18,209,230,0.12)" />
                <RoundedRect x={x + 2} y={y + 2} width={T - 4} height={T - 4} r={T * 0.16} style="stroke" strokeWidth={T * 0.1} color="rgba(18,209,230,0.3)" />
                <RoundedRect x={x + 4} y={y + 4} width={T - 8} height={T - 8} r={T * 0.15} style="stroke" strokeWidth={T * 0.05} color={palette.glow} />
              </Group>
            );
          })() : null}
          {guide?.drainPulse && guide.route.length ? (() => {
            const { x, y } = cellXY(guide.route[guide.route.length - 1]);
            return <Circle cx={x + T / 2} cy={y + T / 2} r={drainRingR} style="stroke" strokeWidth={Math.max(3, T * 0.05)} color={palette.glow} opacity={drainRingOp} />;
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
                    onPressIn={can
                      ? (e) => spin(i, well + cc * T + e.nativeEvent.locationX, well + r * T + e.nativeEvent.locationY)
                      : cell.t !== "empty" && interactive ? () => deny(i) : undefined}
                    disabled={!interactive || cell.t === "empty"}
                    hitSlop={2}
                    style={{ width: T, height: T }}
                    accessibilityLabel={can ? `Pipe row ${r + 1} column ${cc + 1}` : undefined}
                  />
                );
              })}
            </View>
          ))}
        </View>
        {ripples.map((r) => <TapRipple key={r.id} x={r.x} y={r.y} size={Math.round(T * 0.9)} />)}
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
              <Text style={styles.toastText}>{def.cells[toast.i].t === "pipe" || def.cells[toast.i].t === "gate" ? "Bolted" : "Fixed"}</Text>
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
    shadowColor: "#000", shadowOpacity: 0.65, shadowRadius: 24, shadowOffset: { width: 0, height: 16 }, elevation: 16,
  },
  inner: { position: "absolute", overflow: "hidden" },
  row: { position: "absolute", flexDirection: "row" },
  toast: {
    position: "absolute", width: 108, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(40,14,16,0.92)", borderWidth: 1.5, borderColor: palette.danger,
  },
  toastText: { fontFamily: fonts.display, fontSize: 15, color: "#FFE1DC", includeFontPadding: false },
});
