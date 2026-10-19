import { useEffect, useRef } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { SteelPlate, Well } from "./Plate";
import { Icon } from "./Icon";
import { fonts, palette, type } from "./theme";
import { art } from "../art";
import { feedback } from "../audio/sfx";

/** Star bands mirror engine.starsFor: 3★ at/near par, 2★ ≤ 2·par+2, 1★ up to the budget. */
export function starBands(par: number, budget: number) {
  const three = Math.min(budget, par + Math.max(1, Math.round(par * 0.15)));
  const two = Math.min(budget, Math.max(three, par * 2 + 2));
  return { three, two };
}

/** One wrench segment of the meter: drains as the moves of its star band are spent. */
function Segment({ fill, lit, accent }: { fill: number; lit: boolean; accent: string }) {
  const w = useSharedValue(fill);
  useEffect(() => {
    w.value = withTiming(fill, { duration: 220 });
  }, [fill, w]);
  const bar = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <Well style={styles.seg} radius={6}>
      <Animated.View style={[styles.segFill, bar]}>
        <LinearGradient colors={[accent, palette.accentDark]} style={StyleSheet.absoluteFill} />
        <View style={styles.segShine} />
      </Animated.View>
      <Image source={art.icon_reward_wrench} style={[styles.wrench, { opacity: lit ? 1 : 0.28 }]} resizeMode="contain" fadeDuration={0} />
    </Well>
  );
}

/**
 * The single compact in-level HUD on a brushed-steel plate (12 px radius):
 * left — back button + level title with chapter; centre — a wide 3-segment
 * meter (one wrench per star, each segment draining as its moves are spent);
 * right — PAR target badge and a high-contrast "moves left" pill.
 * Pass `title` (and optionally `onBack` / `onSettings`) to use it as the only
 * bar at the top of the gameplay screen.
 */
export function HudBar({
  moves, budget, par, accent = palette.accent, title, chapter, onBack, onSettings,
}: {
  moves: number; budget: number; par: number; accent?: string;
  title?: string; chapter?: string; onBack?: () => void; onSettings?: () => void;
}) {
  const { three, two } = starBands(par, budget);
  const left = Math.max(0, budget - moves);
  const low = left <= 3;
  // Each segment holds the moves of its band and reaches 0 exactly when that star is lost.
  const band = (start: number, end: number) => Math.max(0, Math.min(1, (end + 1 - moves) / (end + 1 - start)));
  const fills = [band(two, budget), band(three, two), band(0, three)]; // star 1, 2, 3

  // Counter flip: the number tips over on its X axis and pops (100 ms) each time the moves change.
  const pop = useSharedValue(0);
  const flip = useSharedValue(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    pop.value = withSequence(withTiming(1, { duration: 90 }), withSpring(0, { damping: 10, stiffness: 260 }));
    flip.value = 0;
    flip.value = withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) });
  }, [moves, pop, flip]);
  const numStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 300 }, { rotateX: `${(1 - flip.value) * 90}deg` },
      { scale: 1 + pop.value * 0.18 }, { translateY: -pop.value * 2 },
    ],
  }));
  // Low on moves: the pill breathes at 1 Hz with a growing red halo.
  const beat = useSharedValue(0);
  useEffect(() => {
    beat.value = low ? withRepeat(withSequence(withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 700, easing: Easing.inOut(Easing.sin) })), -1) : withTiming(0, { duration: 200 });
  }, [low, beat]);
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + beat.value * 0.07 }], shadowRadius: 8 + beat.value * 10, shadowOpacity: 0.5 + beat.value * 0.4 }));

  return (
    <SteelPlate style={styles.wrap} glow>
      {title ? (
        <View style={styles.topRow}>
          {onBack ? <SquareIcon name="back" onPress={onBack} label="Back" /> : null}
          <View style={styles.titleBox}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {chapter ? <Text style={styles.chapter} numberOfLines={1}>{chapter}</Text> : null}
          </View>
          {onSettings ? <SquareIcon name="gear" onPress={onSettings} label="Settings" /> : null}
        </View>
      ) : null}
      <View style={styles.row}>
        <View style={styles.meter}>
          <Text style={styles.label}>Stars</Text>
          <View style={styles.segs}>
            {fills.map((f, i) => <Segment key={i} fill={f} lit={f > 0} accent={accent} />)}
          </View>
        </View>
        <View style={styles.parBadge}>
          <Icon name="target" size={16} color={palette.primary} />
          <View>
            <Text style={styles.parLabel}>Par</Text>
            <Text style={styles.parNum}>{par}</Text>
          </View>
        </View>
        <Animated.View style={[styles.movesPill, low && styles.movesLow, pillStyle]}>
          <Icon name="moves" size={18} color={low ? palette.ink : palette.bgBottom} stroke={2.6} />
          <View style={styles.movesCol}>
            <Animated.Text style={[styles.moves, low && { color: palette.ink }, numStyle]}>{left}</Animated.Text>
            <Text style={[styles.movesLabel, low && { color: "rgba(255,255,255,0.85)" }]}>left</Text>
          </View>
        </Animated.View>
      </View>
    </SteelPlate>
  );
}

/** Compact square steel icon button (48dp) used in the HUD. */
function SquareIcon({ name, onPress, label }: { name: "back" | "gear"; onPress: () => void; label: string }) {
  const s = useSharedValue(0);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.04 * s.value }] }));
  return (
    <Pressable
      onPressIn={() => (s.value = withTiming(1, { duration: 120 }))}
      onPressOut={() => (s.value = withSpring(0))}
      onPress={() => { feedback("tap", "light"); onPress(); }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.square, st]}>
        <Icon name={name} size={22} color={palette.ink} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 12, marginTop: 6, paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  titleBox: { flex: 1, alignItems: "center" },
  title: { ...type.title, fontSize: 24, letterSpacing: -0.24, color: palette.ink, includeFontPadding: false },
  chapter: { ...type.hud, color: palette.accent, marginTop: -2 },
  square: {
    width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(15,26,36,0.55)", borderWidth: 1, borderColor: "rgba(142,167,178,0.28)", borderTopColor: "rgba(200,225,235,0.32)",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  meter: { flex: 1, gap: 3 },
  label: { ...type.hud, fontSize: 12, color: palette.inkSoft, marginLeft: 2 },
  segs: { flexDirection: "row", gap: 4 },
  seg: { flex: 1, height: 22, justifyContent: "center" },
  segFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 5, overflow: "hidden" },
  segShine: { position: "absolute", left: 3, right: 3, top: 2, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.35)" },
  wrench: { position: "absolute", right: 3, width: 16, height: 16 },
  parBadge: {
    flexDirection: "row", alignItems: "center", gap: 5, height: 44, paddingHorizontal: 8, borderRadius: 12,
    backgroundColor: "rgba(15,26,36,0.6)", borderWidth: 1.5, borderColor: "rgba(217,122,43,0.55)",
  },
  parLabel: { ...type.hud, fontSize: 11, color: palette.inkSoft, lineHeight: 13 },
  parNum: { ...type.number, fontSize: 18, lineHeight: 21, color: palette.ink },
  movesPill: {
    flexDirection: "row", alignItems: "center", gap: 5, height: 44, paddingLeft: 9, paddingRight: 12, borderRadius: 22,
    backgroundColor: palette.ink, borderWidth: 2, borderColor: palette.accent,
    shadowColor: palette.accent, shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  movesLow: { backgroundColor: palette.danger, borderColor: "#FFB0A8", shadowColor: palette.danger },
  movesCol: { alignItems: "center" },
  moves: { ...type.number, fontSize: 22, lineHeight: 24, color: palette.bgBottom, minWidth: 24, textAlign: "center", includeFontPadding: false },
  movesLabel: { fontFamily: fonts.medium, fontSize: 10, lineHeight: 11, color: "#3B4E5A", marginTop: -2 },
});
