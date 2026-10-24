import { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { Canvas, Group, LinearGradient, Path, vec } from "@shopify/react-native-skia";
import { Icon, STAR_PATH, svg } from "./Icon";
import { play, haptic } from "../audio/sfx";
import { art } from "../art";

/** One award star: spins in and pops to 1.2x with a bounce, a gold halo flashes and a sparkle twinkles across it. */
function Star({ on, index, animate, size }: { on: boolean; index: number; animate: boolean; size: number }) {
  const s = useSharedValue(animate ? 0 : 1);
  const halo = useSharedValue(0);
  const twinkle = useSharedValue(0);
  useEffect(() => {
    if (!animate) return;
    // Sequential: one star every 200 ms, so all three have landed ~0.6 s after the panel appears.
    const delay = 150 + index * 200;
    s.value = withDelay(delay, withSequence(
      withTiming(1.2, { duration: 200, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 7, stiffness: 260 }),
    ));
    if (on) {
      halo.value = withDelay(delay + 100, withSequence(withTiming(1, { duration: 140 }), withTiming(0, { duration: 480 })));
      twinkle.value = 0;
      twinkle.value = withDelay(delay + 140, withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) }));
      const id = setTimeout(() => {
        play(`star${index + 1}` as "star1");
        haptic("medium");
      }, delay + 120);
      return () => clearTimeout(id);
    }
  }, [animate, index, on, s, halo, twinkle]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: index === 1 ? -14 : 0 }, { scale: s.value }, { rotate: `${(1 - Math.min(1, s.value)) * -40}deg` }],
  }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value * 0.8, transform: [{ scale: 0.6 + halo.value * 0.9 }] }));
  const twinkleStyle = useAnimatedStyle(() => ({
    opacity: twinkle.value > 0 && twinkle.value < 1 ? Math.sin(twinkle.value * Math.PI) : 0,
    transform: [{ scale: 0.3 + twinkle.value * 0.9 }, { rotate: `${twinkle.value * 120}deg` }],
  }));
  const px = index === 1 ? size * 1.25 : size;
  return (
    <Animated.View style={[styles.star, style]}>
      <Animated.View style={[styles.halo, { width: px * 1.4, height: px * 1.4, borderRadius: px * 0.7 }, haloStyle]} />
      {/* recessed empty socket under every star so unearned ones still read as slots */}
      <View style={{ position: "absolute", opacity: on ? 0 : 1 }}>
        <Icon name="star" size={px} color="rgba(10,8,6,0.5)" />
      </View>
      <View style={{ opacity: on ? 1 : 0 }}>
        <Icon name="star" size={px} />
      </View>
      {on ? (
        <Animated.View pointerEvents="none" style={[styles.twinkle, { width: px * 0.8, height: px * 0.8, right: -px * 0.15, top: -px * 0.1 }, twinkleStyle]}>
          <Image source={art.fx_sparkle_burst} style={{ width: "100%", height: "100%" }} resizeMode="contain" fadeDuration={0} />
        </Animated.View>
      ) : null}
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
export function MiniStars({ count, size = 14, bare }: { count: number; size?: number; bare?: boolean }) {
  const p = svg(STAR_PATH);
  const k = size / 24;
  return (
    <View style={bare ? styles.miniBare : styles.mini}>
      <Canvas style={{ width: size * 3 + 2, height: size + 2 }} pointerEvents="none">
        {p ? [0, 1, 2].map((i) => (
          <Group key={i} transform={[{ translateX: i * (size + 1) }, { translateY: i === 1 ? 2 : 0 }, { scale: k }]}>
            {i < count ? (
              <Path path={p}>
                <LinearGradient start={vec(0, 3)} end={vec(0, 20)} colors={["#FFE27A", "#F2A71B"]} />
              </Path>
            ) : (
              <Path path={p} color="rgba(10,8,6,0.55)" />
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
  twinkle: { position: "absolute" },
  mini: { flexDirection: "row", gap: 1, marginTop: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10, backgroundColor: "rgba(16,13,10,0.8)" },
  miniBare: { flexDirection: "row" },
});
