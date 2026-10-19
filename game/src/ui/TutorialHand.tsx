import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { palette } from "./theme";

/**
 * Animated pointer demonstrating a tap at `from` or a swipe from → to, with a
 * cyan tap ring rippling out of the target. Show on the first levels.
 */
export function TutorialHand({ from, to }: { from: { x: number; y: number }; to?: { x: number; y: number } }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }), withTiming(1, { duration: 400 }), withTiming(0, { duration: 0 })), -1);
  }, [t]);
  const style = useAnimatedStyle(() => {
    const dest = to ?? from;
    const x = from.x + (dest.x - from.x) * t.value;
    const y = from.y + (dest.y - from.y) * t.value;
    const press = to ? 1 : 1 - 0.15 * Math.sin(Math.PI * t.value);
    return { transform: [{ translateX: x - 20 }, { translateY: y + 2 }, { scale: press }], opacity: t.value > 0.98 ? 0.6 : 1 };
  });
  const ring = useAnimatedStyle(() => {
    const dest = to ?? from;
    const k = Math.max(0, (t.value - 0.45) / 0.55);
    return { opacity: (1 - k) * 0.9, transform: [{ translateX: dest.x - 28 }, { translateY: dest.y - 28 }, { scale: 0.4 + k * 0.9 }] };
  });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.ring, ring]} />
      <Animated.View style={[styles.hand, style]}>
        <Text style={styles.emoji}>👆</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  hand: { position: "absolute", left: 0, top: 0 },
  ring: { position: "absolute", left: 0, top: 0, width: 56, height: 56, borderRadius: 28, borderWidth: 3, borderColor: palette.accent, backgroundColor: "rgba(46,196,255,0.12)" },
  emoji: { fontSize: 46, textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 8 },
});
