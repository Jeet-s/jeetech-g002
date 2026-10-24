import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { NineSlice } from "./Plate";
import { Icon, type IconName } from "./Icon";
import { fonts, palette, springs } from "./theme";
import { sprites } from "../sprites";
import { feedback } from "../audio/sfx";
import { TapRipple } from "../fx/TapRipple";

/**
 * One booster in the in-level tray: a raised graphite plate (the button art) with
 * the booster's brass icon, its name under it and a count badge (▶ = free with a
 * video when the bank is empty). Press sinks it 2 px with a two-ring ripple at the finger; using it pops the icon.
 * Without `count` it is a plain labelled tool (Undo / Restart).
 */
export function BoosterSlot({ icon, label, count, onPress, disabled, style }: {
  icon: IconName | "wrench-art"; label: string; count?: number | "▶"; onPress: () => void; disabled?: boolean; style?: ViewStyle;
}) {
  const [tapAt, setTapAt] = useState<{ x: number; y: number; k: number } | null>(null);
  const press = useSharedValue(0);
  const pop = useSharedValue(0);
  const prev = useRef(count);
  useEffect(() => {
    if (prev.current !== count) pop.value = withSequence(withTiming(1, { duration: 90 }), withSpring(0, springs.pop));
    prev.current = count;
  }, [count, pop]);
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * 2 }, { scale: 1 - press.value * 0.04 }] }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pop.value * 0.25 }, { rotate: `${pop.value * -12}deg` }] }));
  return (
    <Pressable
      disabled={disabled}
      onPressIn={(e) => {
        press.value = withTiming(1, { duration: 70, easing: Easing.out(Easing.quad) });
        const { locationX: x, locationY: y } = e.nativeEvent;
        setTapAt((t) => ({ x, y, k: (t?.k ?? 0) + 1 }));
      }}
      onPressOut={() => (press.value = withSpring(0, springs.press))}
      onPress={() => { feedback("tap", "light"); onPress(); }}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={`${label} booster`}
      style={[{ opacity: disabled ? 0.45 : 1 }, style]}
    >
      <Animated.View style={[styles.socket, face]}>
        <NineSlice source={sprites.button.graphite} w={190} h={256} cap={{ l: 36, t: 36, r: 36, b: 42 }} scale={0.5} style={StyleSheet.absoluteFill} />
        <Animated.View style={iconStyle}>
          <Icon name={icon === "wrench-art" ? "wrench" : icon} size={26} color={icon === "bulb" ? palette.ink : palette.secondary} stroke={2.6} />
        </Animated.View>
        <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{label}</Text>
      </Animated.View>
      {count !== undefined ? (
        <View style={[styles.badge, count === 0 ? styles.badgeEmpty : null]}>
          {count === "▶" ? <Icon name="play" size={10} color={palette.ink} /> : <Text style={styles.badgeText}>{count}</Text>}
        </View>
      ) : null}
      {tapAt ? <TapRipple key={tapAt.k} x={tapAt.x} y={tapAt.y} size={52} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  socket: {
    height: 64, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 6, paddingBottom: 4,
  },
  label: { fontFamily: fonts.display, fontSize: 13, color: palette.ink, includeFontPadding: false },
  badge: {
    position: "absolute", top: -6, right: -4, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5,
    alignItems: "center", justifyContent: "center", backgroundColor: palette.primaryDark, borderWidth: 2, borderColor: palette.ink,
  },
  badgeEmpty: { backgroundColor: "#5A524A" },
  badgeText: { fontFamily: fonts.display, fontSize: 12, color: palette.ink, includeFontPadding: false },
});
