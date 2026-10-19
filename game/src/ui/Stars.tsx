import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { Canvas, Group, LinearGradient, Path, vec } from "@shopify/react-native-skia";
import { Icon, STAR_PATH, svg } from "./Icon";
import { play, haptic } from "../audio/sfx";

/** One award star: pops to 1.15x with a bounce, a soft gold halo flashing behind it. */
function Star({ on, index, animate, size }: { on: boolean; index: number; animate: boolean; size: number }) {
  const s = useSharedValue(animate ? 0 : 1);
  const halo = useSharedValue(0);
  useEffect(() => {
    if (!animate) return;
    const delay = 250 + index * 320;
    s.value = withDelay(delay, withSequence(
      withTiming(1.15, { duration: 260, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 7, stiffness: 260 }),
    ));
    if (on) {
      halo.value = withDelay(delay + 120, withSequence(withTiming(1, { duration: 160 }), withTiming(0, { duration: 520 })));
      const id = setTimeout(() => {
        play(`star${index + 1}` as "star1");
        haptic("medium");
      }, delay + 120);
      return () => clearTimeout(id);
    }
  }, [animate, index, on, s, halo]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: index === 1 ? -14 : 0 }, { scale: s.value }, { rotate: `${(1 - Math.min(1, s.value)) * -40}deg` }],
  }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value * 0.8, transform: [{ scale: 0.6 + halo.value * 0.9 }] }));
  const px = index === 1 ? size * 1.25 : size;
  return (
    <Animated.View style={[styles.star, style]}>
      <Animated.View style={[styles.halo, { width: px * 1.4, height: px * 1.4, borderRadius: px * 0.7 }, haloStyle]} />
      {/* recessed empty socket under every star so unearned ones still read as slots */}
      <View style={{ position: "absolute", opacity: on ? 0 : 1 }}>
        <Icon name="star" size={px} color="rgba(142,167,178,0.22)" />
      </View>
      <View style={{ opacity: on ? 1 : 0 }}>
        <Icon name="star" size={px} />
      </View>
    </Animated.View>
  );
}

/** Three-star award with staggered pop + rising chimes. `animate` for the win screen. */
export function Stars({ count, animate = false, size = 48 }: { count: number; animate?: boolean; size?: number }) {
  return (
    <View style={styles.row}>
      {[0, 1, 2].map((i) => (
        <Star key={i} index={i} on={i < count} animate={animate} size={size} />
      ))}
    </View>
  );
}

/** Small static stars under level nodes — one canvas for all three (cheap on long maps). */
export function MiniStars({ count, size = 14 }: { count: number; size?: number }) {
  const p = svg(STAR_PATH);
  const k = size / 24;
  return (
    <View style={styles.mini}>
      <Canvas style={{ width: size * 3 + 2, height: size + 2 }} pointerEvents="none">
        {p ? [0, 1, 2].map((i) => (
          <Group key={i} transform={[{ translateX: i * (size + 1) }, { translateY: i === 1 ? 2 : 0 }, { scale: k }]}>
            {i < count ? (
              <Path path={p}>
                <LinearGradient start={vec(0, 3)} end={vec(0, 20)} colors={["#FFE27A", "#F2A71B"]} />
              </Path>
            ) : (
              <Path path={p} color="rgba(142,167,178,0.35)" />
            )}
          </Group>
        )) : null}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", gap: 8, marginVertical: 10 },
  star: { alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", backgroundColor: "rgba(255,194,61,0.45)" },
  mini: { flexDirection: "row", gap: 1, marginTop: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10, backgroundColor: "rgba(10,18,24,0.75)" },
});
