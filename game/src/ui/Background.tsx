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
 * The workshop backdrop for every screen: the painted dark-steel plate art,
 * a bgTop→bgBottom wash, a soft 20% vignette and faint drifting dust motes.
 * `colors` tints the wash (e.g. per chapter) without changing the material.
 */
export function Background({ colors, children, motes = true }: { colors?: [string, string]; children?: React.ReactNode; motes?: boolean }) {
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
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: bottom }]} pointerEvents="box-none">
      <LinearGradient colors={[top, bottom]} style={StyleSheet.absoluteFill} />
      <Image source={art.background_chapter_industrial_steel_teal} style={[StyleSheet.absoluteFill, { opacity: 0.9 }]} resizeMode="cover" fadeDuration={0} />
      <LinearGradient colors={[top + "66", bottom + "33", bottom + "88"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* cool top-down area light + 20% vignette */}
        <Rect x={0} y={0} width={width} height={height}>
          <RadialGradient c={vec(width / 2, height * 0.38)} r={Math.max(width, height) * 0.75} colors={["rgba(46,196,255,0.06)", "rgba(0,0,0,0)", "rgba(0,0,0,0.20)"]} positions={[0, 0.55, 1]} />
        </Rect>
      </Canvas>
      {motes ? dust.map((d, i) => <Mote key={i} {...d} />) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  mote: { position: "absolute", backgroundColor: "#CFE9F5" },
});
