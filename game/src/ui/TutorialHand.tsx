import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { Canvas, Group, LinearGradient, Path, PathOp, Skia, vec, type SkPath } from "@shopify/react-native-skia";
import { palette } from "./theme";

/** A white workshop glove pointing up (48-unit box, fingertip at 20,3): finger, fist, knuckles and thumb in one outline. */
function glovePath(): SkPath | null {
  const part = (fn: (b: ReturnType<typeof Skia.PathBuilder.Make>) => void) => {
    const b = Skia.PathBuilder.Make();
    fn(b);
    return b.detach();
  };
  const shapes = [
    part((b) => b.addRRect(Skia.RRectXY(Skia.XYWHRect(15.5, 2, 9, 30), 4.5, 4.5))), // index finger
    part((b) => b.addRRect(Skia.RRectXY(Skia.XYWHRect(12, 21, 25, 21), 8, 8))), // fist
    part((b) => b.addCircle(28.5, 22.5, 4.4)), // knuckles
    part((b) => b.addCircle(34, 25, 3.8)),
    part((b) => b.addRRect(Skia.RRectXY(Skia.XYWHRect(5, 26, 13, 8.5), 4.2, 4.2))), // thumb
  ];
  let p: SkPath | null = shapes[0];
  for (const s of shapes.slice(1)) p = p ? Skia.Path.MakeFromOp(p, s, PathOp.Union) : null;
  return p;
}
const GLOVE = glovePath();
const CUFF = (() => {
  const b = Skia.PathBuilder.Make();
  b.addRRect(Skia.RRectXY(Skia.XYWHRect(14, 40, 21, 6), 3, 3));
  return b.detach();
})();
const HAND = 56; // drawn size (dp)

/**
 * Animated pointer demonstrating a tap at `from` or a swipe from → to, with a
 * cyan tap ring rippling out of the target. Show on the first levels.
 */
export function TutorialHand({ from, to }: { from: { x: number; y: number }; to?: { x: number; y: number } }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }), withTiming(1, { duration: 400 }), withTiming(0, { duration: 0 })), -1);
  }, [t]);
  const k = HAND / 48;
  const style = useAnimatedStyle(() => {
    const dest = to ?? from;
    const x = from.x + (dest.x - from.x) * t.value;
    const y = from.y + (dest.y - from.y) * t.value;
    // Tap: the glove dips toward the cell and presses (fingertip lands on the cell centre).
    const press = to ? 1 : 1 - 0.12 * Math.sin(Math.PI * t.value);
    const dip = to ? 0 : 8 * (1 - Math.sin(Math.PI * t.value));
    return { transform: [{ translateX: x - 20 * k }, { translateY: y - 3 * k + dip }, { scale: press }], opacity: t.value > 0.98 ? 0.6 : 1 };
  });
  const ring = useAnimatedStyle(() => {
    const dest = to ?? from;
    const p = Math.max(0, (t.value - 0.45) / 0.55);
    return { opacity: (1 - p) * 0.9, transform: [{ translateX: dest.x - 28 }, { translateY: dest.y - 28 }, { scale: 0.4 + p * 0.9 }] };
  });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.ring, ring]} />
      <Animated.View style={[styles.hand, style]}>
        <Canvas style={{ width: HAND, height: HAND }}>
          <Group transform={[{ scale: k }]}>
            {GLOVE ? (
              <>
                <Group transform={[{ translateX: 1.5 }, { translateY: 2.5 }]}>
                  <Path path={GLOVE} color="rgba(0,0,0,0.35)" />
                </Group>
                <Path path={GLOVE}>
                  <LinearGradient start={vec(0, 2)} end={vec(0, 44)} colors={["#FFFFFF", "#DCE6EF"]} />
                </Path>
                <Path path={GLOVE} style="stroke" strokeWidth={2.2} strokeJoin="round" color="#1B2433" />
              </>
            ) : null}
            <Path path={CUFF} color={palette.primary} />
            <Path path={CUFF} style="stroke" strokeWidth={2} color="#1B2433" />
          </Group>
        </Canvas>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  hand: { position: "absolute", left: 0, top: 0, width: HAND, height: HAND },
  ring: { position: "absolute", left: 0, top: 0, width: 56, height: 56, borderRadius: 28, borderWidth: 3, borderColor: palette.glow, backgroundColor: "rgba(46,196,255,0.12)" },
});
