import { useEffect, useRef, useState } from "react";
import { Platform, StatusBar, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Popup } from "./Popup";
import { Stars } from "./Stars";
import { GameButton } from "./GameButton";
import { AnimatedNumber } from "./AnimatedNumber";
import { Confetti } from "../fx/Confetti";
import { Icon, type IconName } from "./Icon";
import { Well } from "./Plate";
import { CurrencyPill } from "./CurrencyPill";
import { fonts, palette, type } from "./theme";
import { play, haptic } from "../audio/sfx";

const BEAMS = [0, 30, 60, 90, 120, 150];
/** Beam burst behind the stars: 12 light beams blast out with the first star (overshoot), then turn slowly. */
function Burst({ go }: { go: boolean }) {
  const spin = useSharedValue(0);
  const pop = useSharedValue(0);
  useEffect(() => {
    if (!go) { pop.value = 0; return; }
    pop.value = 0;
    pop.value = withDelay(140, withSequence(withTiming(1.25, { duration: 220, easing: Easing.out(Easing.cubic) }), withSpring(1, { damping: 9, stiffness: 140 })));
    spin.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1);
  }, [go, spin, pop]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value) * 0.95,
    transform: [{ scale: 0.3 + pop.value * 0.7 }, { rotate: `${spin.value * 360}deg` }],
  }));
  const glow = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value) * 0.9, transform: [{ scale: 0.4 + pop.value * 0.6 }] }));
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.burst, glow]}>
        <LinearGradient colors={["rgba(18,209,230,0.40)", "rgba(255,194,61,0.2)", "rgba(18,209,230,0)"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.beams, style]}>
        {BEAMS.map((deg) => (
          <View key={deg} style={[styles.beam, { transform: [{ rotate: `${deg}deg` }] }]}>
            <LinearGradient
              colors={["rgba(255,226,122,0)", "rgba(255,226,122,0.55)", "rgba(255,255,255,0.75)", "rgba(255,226,122,0.55)", "rgba(255,226,122,0)"]}
              locations={[0, 0.3, 0.5, 0.7, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ))}
      </Animated.View>
    </>
  );
}

/** Next Level CTA: a gentle bounce every ~1.6 s once the rewards have landed, so the eye goes there next. */
function Bounce({ go, delay, children }: { go: boolean; delay: number; children: React.ReactNode }) {
  const b = useSharedValue(0);
  useEffect(() => {
    if (!go) { b.value = 0; return; }
    b.value = withDelay(delay, withRepeat(withSequence(
      withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }),
      withTiming(-0.35, { duration: 140, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 140, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 1200 }),
    ), -1));
  }, [go, delay, b]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * b.value }, { scale: 1 + 0.05 * b.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** One coin flying from the reward well up to the top-bar coin counter (window coordinates, 420 ms arc). */
function FlyCoin({ go, index, from, to }: { go: number; index: number; from: { x: number; y: number }; to: { x: number; y: number } }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!go) return;
    t.value = 0;
    t.value = withDelay(index * 50, withTiming(1, { duration: 420, easing: Easing.inOut(Easing.cubic) }));
  }, [go, index, t]);
  const spread = (index - 2) * 22;
  const style = useAnimatedStyle(() => {
    const u = t.value, arc = Math.sin(u * Math.PI);
    return {
      opacity: u > 0 && u < 1 ? 1 : 0,
      transform: [
        { translateX: from.x + (to.x - from.x) * u + spread * arc - 13 },
        { translateY: from.y + (to.y - from.y) * u - 13 },
        { scale: 0.8 + 0.5 * arc - 0.2 * u },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.flyCoin, style]}>
      <Icon name="coin" size={26} />
    </Animated.View>
  );
}

/** Level complete: stars pop in with chimes, confetti, coin reward counts up. */
export function WinPopup({ visible, stars, coins, total, onNext, onReplay, onMap, title = "Level Complete!", subtitle, nextLabel = "Next Level", nextIcon = "play", extra }: {
  visible: boolean; stars: number; coins: number; onNext: () => void; onReplay?: () => void; onMap?: () => void; title?: string;
  /** The player's coin bank INCLUDING this reward: the top-bar counter the coins fly up into. */
  total?: number;
  /** One line under the stars (e.g. the daily streak). */
  subtitle?: string;
  nextLabel?: string;
  nextIcon?: IconName;
  /** An extra opt-in action under the main button (e.g. daily reminders). */
  extra?: React.ReactNode;
}) {
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Inside a Modal Android reports no inset: keep the bank counter below the status bar there.
  const topY = (Platform.OS === "android" ? Math.max(insets.top, StatusBar.currentHeight ?? 24) : insets.top) + 8;
  const [burst, setBurst] = useState(0);
  const [shownCoins, setShownCoins] = useState(0);
  const [fly, setFly] = useState(0);
  const [bank, setBank] = useState(0);
  const bankPop = useSharedValue(0);
  const bankStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, bankPop.value * 3), transform: [{ scale: 1 + Math.max(0, bankPop.value - 0.34) * 0.3 }] }));
  const wellRef = useRef<React.ComponentRef<typeof View>>(null);
  const [from, setFrom] = useState({ x: winW / 2, y: winH / 2 });
  const to = { x: winW - 88, y: topY + 24 };
  // Timeline (popup lands ~650 ms after the winning tap): beams + stars pop 140-600 ms, the reward well counts up
  // at 650 ms, then the coins fly up into the top-bar bank (850-1300 ms), which ticks up and pops; Next Level bounces.
  useEffect(() => {
    if (!visible) return;
    setShownCoins(0);
    setBank(Math.max(0, (total ?? 0) - coins));
    bankPop.value = withTiming(0.34, { duration: 200 });
    play("success");
    haptic("success");
    const a = setTimeout(() => setBurst((b) => b + 1), 120);
    const c = setTimeout(() => {
      setShownCoins(coins);
      play("coin");
      haptic("light");
      wellRef.current?.measureInWindow((x, y, w, h) => { if (w > 0) setFrom({ x: x + w / 2, y: y + h / 2 }); });
    }, 650);
    const f = setTimeout(() => { if (total != null && coins > 0) setFly((x) => x + 1); }, 850);
    const land = setTimeout(() => {
      if (total == null || coins <= 0) return;
      setBank(total);
      play("coin");
      haptic("light");
      bankPop.value = withSequence(withTiming(1, { duration: 90 }), withSpring(0.34, { damping: 8, stiffness: 260 }));
    }, 1250);
    return () => { clearTimeout(a); clearTimeout(f); clearTimeout(c); clearTimeout(land); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, coins]);
  const overlay = (
    <>
      <Confetti trigger={burst} count={80} origin={{ x: winW / 2, y: winH * 0.3 }} />
      {total != null ? (
        <Animated.View style={[styles.bank, { top: topY }, bankStyle]}>
          <CurrencyPill icon="coin" value={bank} />
        </Animated.View>
      ) : null}
      {[0, 1, 2, 3, 4].map((i) => <FlyCoin key={i} go={fly} index={i} from={from} to={to} />)}
    </>
  );
  return (
    <>
      <Popup visible={visible} title={title} overlay={overlay}>
        <View style={styles.starField}>
          <Burst go={visible} />
          <Stars count={stars} animate={visible} size={60} />
        </View>
        <View ref={wellRef} collapsable={false}>
          <Well style={styles.reward} radius={16}>
            <Icon name="coin" size={30} />
            <Text style={styles.plus}>+</Text>
            <AnimatedNumber value={shownCoins} style={styles.coinText} />
          </Well>
        </View>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
        <Bounce go={visible} delay={1400}>
          <GameButton label={nextLabel} variant="primary" size="lg" icon={nextIcon} onPress={onNext} />
        </Bounce>
        {extra ? <View style={{ marginTop: 10 }}>{extra}</View> : null}
        <View style={styles.row}>
          {onReplay ? <GameButton style={{ flex: 1 }} size="sm" variant="secondary" icon="restart" label="Replay" onPress={onReplay} /> : null}
          {onMap ? <GameButton style={{ flex: 1 }} size="sm" variant="tertiary" icon="map" label="Map" onPress={onMap} /> : null}
        </View>
      </Popup>
    </>
  );
}

/** Level failed: encouraging copy, retry first, optional continue via rewarded ad. */
export function FailPopup({ visible, message = "So close! Try again?", onRetry, onContinue, onMap, extraMoves = 0, onExtraMoves }: {
  visible: boolean; message?: string; onRetry: () => void; onContinue?: () => void; onMap?: () => void;
  /** Banked +5 Moves boosters: offered first when the player has one. */
  extraMoves?: number; onExtraMoves?: () => void;
}) {
  useEffect(() => {
    if (visible) { play("fail"); haptic("warning"); }
  }, [visible]);
  return (
    <Popup visible={visible} title="Out of moves">
      <Text style={styles.msg}>{message}</Text>
      {onExtraMoves && extraMoves > 0 ? (
        <GameButton style={{ marginBottom: 12 }} label={`Use +5 Moves (${extraMoves} left)`} variant="primary" size="lg" icon="plus" onPress={onExtraMoves} />
      ) : null}
      <GameButton label="Try Again" variant={onExtraMoves && extraMoves > 0 ? "secondary" : "primary"} size="lg" icon="restart" onPress={onRetry} />
      {onContinue ? <GameButton style={{ marginTop: 12 }} icon="play" label="Continue (watch ad)" variant="secondary" onPress={onContinue} /> : null}
      {onMap ? <GameButton style={{ marginTop: 12 }} size="sm" variant="tertiary" icon="map" label="Back to map" onPress={onMap} /> : null}
    </Popup>
  );
}

/** Pause: the level freezes under a scrim until Resume; restart, settings and the map sit underneath. */
export function PausePopup({ visible, level, moves, budget, onResume, onRestart, onSettings, onMap }: {
  visible: boolean; level: number; moves: number; budget: number;
  onResume: () => void; onRestart: () => void; onSettings: () => void; onMap: () => void;
}) {
  return (
    <Popup visible={visible} title="Paused" onClose={onResume}>
      <Well style={styles.pauseInfo} radius={14}>
        <Icon name="pause" size={26} color={palette.primary} stroke={3} />
        <Text style={styles.pauseText}>Level {level} · {Math.max(0, budget - moves)} moves left</Text>
      </Well>
      <GameButton label="Resume" variant="primary" size="lg" icon="play" onPress={onResume} />
      <View style={styles.row}>
        <GameButton style={{ flex: 1 }} size="sm" variant="secondary" icon="restart" label="Restart" onPress={onRestart} />
        <GameButton style={{ flex: 1 }} size="sm" variant="secondary" icon="gear" label="Settings" onPress={onSettings} />
      </View>
      <GameButton style={{ marginTop: 12 }} size="sm" variant="tertiary" icon="map" label="Level map" onPress={onMap} />
    </Popup>
  );
}

const styles = StyleSheet.create({
  pauseInfo: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14, marginBottom: 16 },
  pauseText: { fontFamily: fonts.display, fontSize: 18, color: palette.ink, includeFontPadding: false },
  starField: { alignItems: "center", justifyContent: "center", marginTop: 2 },
  burst: { position: "absolute", width: 230, height: 230, alignItems: "center", justifyContent: "center", borderRadius: 115, overflow: "hidden" },
  beams: { position: "absolute", width: 300, height: 300, alignItems: "center", justifyContent: "center" },
  beam: { position: "absolute", width: 22, height: 300, borderRadius: 11, overflow: "hidden" },
  bank: { position: "absolute", right: 14 },
  reward: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginVertical: 16, paddingVertical: 12 },
  subtitle: { ...type.body, fontSize: 15, color: palette.secondary, textAlign: "center", marginTop: -4, marginBottom: 10 },
  plus: { fontFamily: fonts.display, fontSize: 24, color: palette.coin },
  coinText: { ...type.number, fontSize: 32, letterSpacing: -0.32, color: palette.coin, minWidth: 40 },
  row: { flexDirection: "row", gap: 12, marginTop: 12 },
  flyCoin: { position: "absolute", left: 0, top: 0 },
  msg: { ...type.body, color: palette.inkSoft, textAlign: "center", marginBottom: 18 },
});
