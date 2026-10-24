import { useEffect, useMemo } from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Canvas, Rect, RadialGradient, vec } from "@shopify/react-native-skia";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";
import { palette } from "./theme";
import { art } from "../art";

/** One faint dust mote drifting up and sideways in a slow loop (10% opacity). */
function Mote({ x, y, size, dur, delay, drift }: { x: number; y: number; size: number; dur: number; delay: number; drift: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: Easing.linear }), -1));
  }, [t, dur, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.1 * Math.sin(Math.PI * t.value),
    transform: [{ translateY: -90 * t.value }, { translateX: drift * Math.sin(t.value * Math.PI * 2) }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.mote, { left: x, top: y, width: size, height: size, borderRadius: size / 2 }, style]} />;
}

/**
 * The workshop backdrop for every screen: the defocused workshop-at-dusk art (chapters 1-5: the dawn workshop with
 * its warm bulb; chapters 6-10: the night shift's neon bokeh), drifting a slow 3% parallax, a bgTop→bgBottom haze
 * so the UI reads on top, a soft vignette and faint dust motes. `chapter` (0-based) picks the scene.
 */
export function Background({ colors, children, motes = true, chapter = 0 }: { colors?: [string, string]; children?: React.ReactNode; motes?: boolean; chapter?: number }) {
  const { width, height } = useWindowDimensions();
  const [top, bottom] = colors ?? [palette.bgTop, palette.bgBottom];
  const dust = useMemo(() => {
    // Fixed pseudo-random layout so the scene is stable between renders/screenshots.
    let s = 7;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    return Array.from({ length: 16 }, () => ({
      x: rnd() * width, y: 80 + rnd() * (height - 80), size: 2 + rnd() * 3, dur: 7000 + rnd() * 7000, delay: rnd() * 5000, drift: 6 + rnd() * 14,
    }));
  }, [width, height]);
  // Parallax: the scene is 6% larger than the screen and drifts slowly within that margin.
  const drift = useSharedValue(0);
  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [drift]);
  const bw = Math.ceil(width * 1.06), bh = Math.ceil(height * 1.06);
  const scene = useAnimatedStyle(() => ({ transform: [{ translateX: -(bw - width) * drift.value }, { translateY: -(bh - height) * 0.5 * (1 - drift.value) }] }));
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: bottom, overflow: "hidden" }]} pointerEvents="box-none">
      <Animated.View style={[styles.scene, { width: bw, height: bh }, scene]} pointerEvents="none">
        <Image source={chapter >= 5 ? art.bg_nightshift_neon : art.bg_workshop_dawn} style={{ width: bw, height: bh }} resizeMode="cover" fadeDuration={0} />
      </Animated.View>
      <LinearGradient pointerEvents="none" colors={[top + "55", bottom + "22", bottom + "77"]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* faint volumetric haze in the middle + soft vignette */}
        <Rect x={0} y={0} width={width} height={height}>
          <RadialGradient c={vec(width / 2, height * 0.42)} r={Math.max(width, height) * 0.75} colors={["rgba(18,209,230,0.05)", "rgba(0,0,0,0)", "rgba(0,0,0,0.32)"]} positions={[0, 0.55, 1]} />
        </Rect>
      </Canvas>
      {motes ? dust.map((d, i) => <Mote key={i} {...d} />) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { position: "absolute", left: 0, top: 0 },
  mote: { position: "absolute", backgroundColor: "#FFE2B8" },
});
