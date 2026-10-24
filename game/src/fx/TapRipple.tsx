import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import { palette } from "../ui/theme";

/**
 * Two-ring tap ripple at (x, y) in the parent's frame: a tight bright ring snaps out in 80 ms, a wider soft ring
 * follows and fades over 140 ms — so every tap reads even when the piece under it barely changes. Re-key to replay.
 */
export function TapRipple({ x, y, size = 64, color = palette.glow }: { x: number; y: number; size?: number; color?: string }) {
  const a = useSharedValue(0);
  const b = useSharedValue(0);
  useEffect(() => {
    // inner: 0→1 snaps out (80 ms), 1→2 fades (140 ms)
    a.value = withSequence(withTiming(1, { duration: 80, easing: Easing.out(Easing.quad) }), withTiming(2, { duration: 140 }));
    b.value = withDelay(40, withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) }));
  }, [a, b]);
  const inner = useAnimatedStyle(() => ({
    opacity: a.value <= 1 ? 1 : 2 - a.value,
    transform: [{ scale: 0.35 + Math.min(1, a.value) * 0.55 + Math.max(0, a.value - 1) * 0.1 }],
  }));
  const outer = useAnimatedStyle(() => ({ opacity: b.value > 0 ? 0.75 * (1 - b.value) : 0, transform: [{ scale: 0.6 + b.value * 0.75 }] }));
  const box = { left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size / 2 };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.ring, box, { borderColor: color, borderWidth: 3 }, inner]} />
      <Animated.View style={[styles.ring, box, { borderColor: color, borderWidth: 2, backgroundColor: "rgba(18,209,230,0.10)" }, outer]} />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: "absolute" },
});
