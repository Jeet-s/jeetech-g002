import { useEffect, useRef } from "react";
import { Image, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Icon, type IconName } from "./Icon";
import { fonts, palette, springs } from "./theme";
import { art } from "../art";
import { feedback } from "../audio/sfx";

/**
 * One booster in the in-level tray: a raised orange-rimmed steel socket with
 * the booster's icon, its name under it and a count badge (▶ = free with a
 * video when the bank is empty). Press sinks it 2 px; using it pops the icon.
 */
export function BoosterSlot({ icon, label, count, onPress, disabled, style }: {
  icon: IconName | "wrench-art"; label: string; count: number | "▶"; onPress: () => void; disabled?: boolean; style?: ViewStyle;
}) {
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
      onPressIn={() => (press.value = withTiming(1, { duration: 70, easing: Easing.out(Easing.quad) }))}
      onPressOut={() => (press.value = withSpring(0, springs.press))}
      onPress={() => { feedback("tap", "light"); onPress(); }}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={`${label} booster`}
      style={[{ opacity: disabled ? 0.45 : 1 }, style]}
    >
      <Animated.View style={[styles.socket, face]}>
        <LinearGradient colors={["#3C4F5B", "#22313B"]} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
        <Animated.View style={iconStyle}>
          {icon === "wrench-art"
            ? <Image source={art.icon_reward_wrench} style={styles.art} resizeMode="contain" fadeDuration={0} />
            : <Icon name={icon} size={26} color={icon === "bulb" ? palette.ink : palette.accent} stroke={2.6} />}
        </Animated.View>
        <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{label}</Text>
      </Animated.View>
      <View style={[styles.badge, count === 0 ? styles.badgeEmpty : null]}>
        {count === "▶" ? <Icon name="play" size={10} color={palette.ink} /> : <Text style={styles.badgeText}>{count}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  socket: {
    height: 64, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 4,
    borderWidth: 2, borderColor: palette.primary, borderBottomWidth: 4, borderBottomColor: "#8A4A16", overflow: "hidden",
  },
  art: { width: 28, height: 28 },
  label: { fontFamily: fonts.display, fontSize: 13, color: palette.ink, includeFontPadding: false },
  badge: {
    position: "absolute", top: -6, right: -4, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5,
    alignItems: "center", justifyContent: "center", backgroundColor: palette.accentDark, borderWidth: 2, borderColor: palette.ink,
  },
  badgeEmpty: { backgroundColor: "#5A6870" },
  badgeText: { fontFamily: fonts.display, fontSize: 12, color: palette.ink, includeFontPadding: false },
});
