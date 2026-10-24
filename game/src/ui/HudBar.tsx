import { useEffect, useMemo, useRef } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { Canvas, Circle, Path, Skia, SweepGradient, vec } from "@shopify/react-native-skia";
import { Icon } from "./Icon";
import { MiniStars } from "./Stars";
import { fonts, palette, type } from "./theme";
import { sprites } from "../sprites";
import { feedback } from "../audio/sfx";

/** Star bands mirror engine.starsFor: 3★ at/near par, 2★ ≤ 2·par+2, 1★ up to the budget. */
export function starBands(par: number, budget: number) {
  const three = Math.min(budget, par + Math.max(1, Math.round(par * 0.15)));
  const two = Math.min(budget, Math.max(three, par * 2 + 2));
  return { three, two };
}

/**
 * hud_bar art (512x224): [left square slot][plain][round gauge socket][plain][right square slot]. The three
 * sockets keep their shape; only the two plain stretches widen, so the bar spans any phone at a fixed height.
 */
const SRC = { w: 512, h: 224 };
const PIECES = [
  { x0: 0, x1: 170, stretch: false },
  { x0: 170, x1: 184, stretch: true },
  { x0: 184, x1: 328, stretch: false },
  { x0: 328, x1: 344, stretch: true },
  { x0: 344, x1: 512, stretch: false },
];
const LEFT_SLOT = { cx: 100, cy: 102, s: 128 };
const GAUGE = { cx: 256, cy: 110, r: 66 };
const RIGHT_SLOT = { cx: 414, cy: 102, s: 128 };

/** Animated pressure-gauge ring: sweeps to the share of moves left; turns red and beats when low. */
function Gauge({ size, frac, low }: { size: number; frac: number; low: boolean }) {
  const f = useSharedValue(frac);
  useEffect(() => {
    f.value = withTiming(frac, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [frac, f]);
  const c = size / 2, r = size / 2 - size * 0.09, sw = size * 0.11;
  // A full ring starting at 12 o'clock, trimmed to the share of moves left.
  const ring = useMemo(() => Skia.Path.MakeFromSVGString(`M${c} ${c - r}a${r} ${r} 0 1 1 0 ${2 * r}a${r} ${r} 0 1 1 0 ${-2 * r}`)!, [c, r]);
  const end = useDerivedValue(() => Math.max(0.002, f.value));
  const col = low ? [palette.danger, "#FFB0A8", palette.danger] : [palette.glow, "#9FF4FF", palette.glow];
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Circle cx={c} cy={c} r={r} style="stroke" strokeWidth={sw} color="rgba(2,10,16,0.55)" />
      <Path path={ring} end={end} style="stroke" strokeWidth={sw} strokeCap="round">
        <SweepGradient c={vec(c, c)} colors={col} />
      </Path>
      <Circle cx={c} cy={c} r={r - sw * 0.9} style="stroke" strokeWidth={1} color="rgba(255,255,255,0.12)" />
    </Canvas>
  );
}

/**
 * The in-level HUD on the forge's HUD bar art: left socket — pause; next to it the level number; centre — the
 * pressure gauge (moves left, ring = share of the budget, the number punches on every move); right of it — par;
 * right socket — the stars this run still earns.
 */
export function HudBar({
  level, moves, budget, par, onPause, width, daily,
}: {
  level: number; daily?: boolean; moves: number; budget: number; par: number; onPause: () => void; width: number;
}) {
  const { three, two } = starBands(par, budget);
  const left = Math.max(0, budget - moves);
  const low = left <= 3;
  const forecast = moves <= three ? 3 : moves <= two ? 2 : 1;

  const H = Math.round(Math.min(96, Math.max(80, width * 0.25)));
  const k = H / SRC.h;
  const fixed = PIECES.filter((p) => !p.stretch).reduce((a, p) => a + (p.x1 - p.x0) * k, 0);
  const stretchW = Math.max(8, (width - fixed) / 2);
  const W = Math.round(fixed + stretchW * 2);
  const xs: number[] = [];
  let acc = 0;
  const widths = PIECES.map((p) => {
    xs.push(acc);
    const w = p.stretch ? stretchW : (p.x1 - p.x0) * k;
    acc += w;
    return w;
  });
  // src x → dp x (only for points inside fixed pieces)
  const at = (sx: number) => {
    const i = PIECES.findIndex((p) => sx >= p.x0 && sx <= p.x1);
    return xs[i] + (sx - PIECES[i].x0) * k;
  };

  // Counter punch: the number pops and lifts each time the moves change.
  const pop = useSharedValue(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    pop.value = withSequence(withTiming(1, { duration: 80 }), withSpring(0, { damping: 9, stiffness: 260 }));
  }, [moves, pop]);
  const numStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pop.value * 0.28 }, { translateY: -pop.value * 3 }] }));
  const beat = useSharedValue(0);
  useEffect(() => {
    beat.value = low ? withRepeat(withSequence(withTiming(1, { duration: 300 }), withTiming(0, { duration: 700 })), -1) : withTiming(0, { duration: 200 });
  }, [low, beat]);
  const gaugeStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + beat.value * 0.05 }] }));

  const slot = LEFT_SLOT.s * k;
  const gaugeD = GAUGE.r * 2 * k;
  return (
    <View style={[styles.wrap, { width: W, height: H }]}>
      {PIECES.map((p, i) => {
        const sx = widths[i] / (p.x1 - p.x0);
        return (
          <View key={i} style={{ position: "absolute", left: xs[i], top: 0, width: Math.ceil(widths[i]) + 0.5, height: H, overflow: "hidden" }}>
            <Image source={sprites.hudBar} resizeMode="stretch" fadeDuration={0} style={{ position: "absolute", left: -p.x0 * sx, top: 0, width: SRC.w * sx, height: H }} />
          </View>
        );
      })}

      <Pressable
        onPress={() => { feedback("tap", "light"); onPause(); }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Pause"
        style={({ pressed }) => [styles.slotBtn, { left: at(LEFT_SLOT.cx) - slot / 2, top: LEFT_SLOT.cy * k - slot / 2, width: slot, height: slot, transform: [{ scale: pressed ? 0.9 : 1 }], opacity: pressed ? 0.8 : 1 }]}
      >
        <Icon name="pause" size={Math.round(slot * 0.46)} color={palette.ink} stroke={3.4} />
      </Pressable>

      <View style={[styles.zone, { left: xs[1] - 6, width: stretchW + 12, top: 0, height: H }]} pointerEvents="none">
        <Text style={styles.zoneLabel} numberOfLines={1}>{daily ? "DAILY" : "LEVEL"}</Text>
        <Text style={styles.zoneNum} numberOfLines={1} adjustsFontSizeToFit>{daily ? new Date().getDate() : level}</Text>
      </View>

      <Animated.View pointerEvents="none" style={[styles.gauge, { left: at(GAUGE.cx) - gaugeD / 2, top: GAUGE.cy * k - gaugeD / 2, width: gaugeD, height: gaugeD }, gaugeStyle]}>
        <View style={StyleSheet.absoluteFill}>
          <Gauge size={gaugeD} frac={budget ? left / budget : 0} low={low} />
        </View>
        <Animated.Text style={[styles.moves, { fontSize: Math.round(gaugeD * 0.36) }, low && { color: "#FFD0CA" }, numStyle]}>{left}</Animated.Text>
        <Text style={[styles.movesLabel, { fontSize: Math.max(9, Math.round(gaugeD * 0.13)) }]}>MOVES</Text>
      </Animated.View>

      <View style={[styles.zone, { left: xs[3] - 6, width: stretchW + 12, top: 0, height: H }]} pointerEvents="none">
        <Text style={styles.zoneLabel} numberOfLines={1}>PAR</Text>
        <Text style={styles.zoneNum} numberOfLines={1} adjustsFontSizeToFit>{par}</Text>
      </View>

      <View pointerEvents="none" style={[styles.slotBtn, { left: at(RIGHT_SLOT.cx) - slot / 2, top: RIGHT_SLOT.cy * k - slot / 2, width: slot, height: slot }]}>
        <MiniStars count={forecast} size={Math.round(slot * 0.27)} bare />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "center",
    shadowColor: "#000", shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  slotBtn: { position: "absolute", alignItems: "center", justifyContent: "center" },
  zone: { position: "absolute", alignItems: "center", justifyContent: "center" },
  zoneLabel: { ...type.hud, fontSize: 11, color: "rgba(242,247,255,0.72)", includeFontPadding: false },
  zoneNum: { ...type.number, fontSize: 26, color: palette.ink, includeFontPadding: false, textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  gauge: { position: "absolute", alignItems: "center", justifyContent: "center" },
  moves: { ...type.number, color: palette.ink, includeFontPadding: false, marginTop: 2, textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4 },
  movesLabel: { fontFamily: fonts.medium, color: "rgba(242,247,255,0.7)", letterSpacing: 0.6, marginTop: -2, includeFontPadding: false },
});
