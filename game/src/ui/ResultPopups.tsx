import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Popup } from "./Popup";
import { Stars } from "./Stars";
import { GameButton } from "./GameButton";
import { AnimatedNumber } from "./AnimatedNumber";
import { Confetti } from "../fx/Confetti";
import { Icon } from "./Icon";
import { Well } from "./Plate";
import { fonts, palette, type } from "./theme";
import { play, haptic } from "../audio/sfx";

/** Soft rotating ray-burst behind the stars — the celebratory "shine". */
function Burst({ go }: { go: boolean }) {
  const spin = useSharedValue(0);
  const pop = useSharedValue(0);
  useEffect(() => {
    if (!go) { pop.value = 0; return; }
    pop.value = withDelay(120, withSpring(1, { damping: 10, stiffness: 120 }));
    spin.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1);
  }, [go, spin, pop]);
  const style = useAnimatedStyle(() => ({
    opacity: pop.value * 0.9,
    transform: [{ scale: 0.4 + pop.value * 0.6 }, { rotate: `${spin.value * 360}deg` }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.burst, style]}>
      <LinearGradient colors={["rgba(46,196,255,0.40)", "rgba(255,194,61,0.18)", "rgba(46,196,255,0)"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

/** One coin flying up from the solved grid into the reward well (400 ms cubic). */
function FlyCoin({ go, index }: { go: number; index: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!go) return;
    t.value = 0;
    t.value = withDelay(index * 55, withTiming(1, { duration: 400, easing: Easing.inOut(Easing.cubic) }));
  }, [go, index, t]);
  const dx = (index - 2) * 26;
  const style = useAnimatedStyle(() => ({
    opacity: t.value > 0 && t.value < 1 ? 1 : 0,
    transform: [
      { translateX: dx * (1 - t.value) },
      { translateY: 220 * (1 - t.value) - Math.sin(t.value * Math.PI) * 40 },
      { scale: 0.7 + 0.5 * Math.sin(t.value * Math.PI) },
    ],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.flyCoin, style]}>
      <Icon name="coin" size={26} />
    </Animated.View>
  );
}

/** Level complete: stars pop in with chimes, confetti, coin reward counts up. */
export function WinPopup({ visible, stars, coins, onNext, onReplay, onMap, title = "Level Complete!" }: {
  visible: boolean; stars: number; coins: number; onNext: () => void; onReplay?: () => void; onMap?: () => void; title?: string;
}) {
  const [burst, setBurst] = useState(0);
  const [shownCoins, setShownCoins] = useState(0);
  const [fly, setFly] = useState(0);
  useEffect(() => {
    if (!visible) return;
    setShownCoins(0);
    play("success");
    haptic("success");
    const a = setTimeout(() => setBurst((b) => b + 1), 200);
    const f = setTimeout(() => setFly((x) => x + 1), 1150);
    const c = setTimeout(() => {
      setShownCoins(coins);
      play("coin");
      haptic("light");
    }, 1550);
    return () => { clearTimeout(a); clearTimeout(f); clearTimeout(c); };
  }, [visible, coins]);
  return (
    <>
      <Popup visible={visible} title={title}>
        <View style={styles.starField}>
          <Burst go={visible} />
          <Stars count={stars} animate={visible} size={60} />
        </View>
        <Well style={styles.reward} radius={16}>
          {[0, 1, 2, 3, 4].map((i) => <FlyCoin key={i} go={fly} index={i} />)}
          <Icon name="coin" size={30} />
          <Text style={styles.plus}>+</Text>
          <AnimatedNumber value={shownCoins} style={styles.coinText} />
        </Well>
        <GameButton label="Next Level" variant="primary" size="lg" icon="play" onPress={onNext} />
        <View style={styles.row}>
          {onReplay ? <GameButton style={{ flex: 1 }} size="sm" variant="secondary" icon="restart" label="Replay" onPress={onReplay} /> : null}
          {onMap ? <GameButton style={{ flex: 1 }} size="sm" variant="tertiary" icon="map" label="Map" onPress={onMap} /> : null}
        </View>
      </Popup>
      {visible ? <Confetti trigger={burst} /> : null}
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
        <Icon name="pause" size={26} color={palette.accent} stroke={3} />
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
  reward: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginVertical: 16, paddingVertical: 12 },
  plus: { fontFamily: fonts.display, fontSize: 24, color: palette.coin },
  coinText: { ...type.number, fontSize: 32, letterSpacing: -0.32, color: palette.coin, minWidth: 40 },
  row: { flexDirection: "row", gap: 12, marginTop: 12 },
  flyCoin: { position: "absolute", left: "50%", marginLeft: -13, top: 14 },
  msg: { ...type.body, color: palette.inkSoft, textAlign: "center", marginBottom: 18 },
});
