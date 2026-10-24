import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, palette, radius, shadow, shadowStrong, springs, type } from "./theme";
import { NineSlice } from "./Plate";
import { GLYPH_ICONS, Icon, type IconName } from "./Icon";
import { sprites } from "../sprites";
import { feedback, type Sfx } from "../audio/sfx";

/**
 * Button hierarchy from the art direction (every face is the button_primary art, nine-sliced, baked recolours):
 *  primary   — the cyan-to-teal glass plate with a strong soft shadow and white label
 *  secondary — the same plate in warm amber
 *  tertiary  — the plate in graphite (quiet actions)
 *  danger    — the plate in red
 * Older names map onto the hierarchy: accent → primary, light → secondary, neutral → tertiary.
 */
type Variant = "primary" | "secondary" | "tertiary" | "danger" | "accent" | "light" | "neutral";
type Kind = "primary" | "secondary" | "tertiary" | "danger";
const KIND: Record<Variant, Kind> = {
  primary: "primary", accent: "primary",
  secondary: "secondary", light: "secondary",
  tertiary: "tertiary", neutral: "tertiary",
  danger: "danger",
};

const FACE: Record<Kind, { src: number; w: number; h: number; cap: { l: number; t: number; r: number; b: number } }> = {
  primary: { src: sprites.button.teal, w: 381, h: 512, cap: { l: 72, t: 72, r: 72, b: 84 } },
  secondary: { src: sprites.button.amber, w: 190, h: 256, cap: { l: 36, t: 36, r: 36, b: 42 } },
  tertiary: { src: sprites.button.graphite, w: 190, h: 256, cap: { l: 36, t: 36, r: 36, b: 42 } },
  danger: { src: sprites.button.red, w: 190, h: 256, cap: { l: 36, t: 36, r: 36, b: 42 } },
};

function Face({ kind, h }: { kind: Kind; h: number }) {
  const f = FACE[kind];
  return <NineSlice source={f.src} w={f.w} h={f.h} cap={f.cap} scale={(h * 0.8) / (f.cap.t + f.cap.b)} style={StyleSheet.absoluteFill} />;
}

/**
 * Tactile plate button: press scales to 96% (120 ms ease-out) with a specular
 * sweep across the face, then springs back; tap sound + haptic on every press.
 * `icon` takes an IconName (or a legacy glyph such as "↻"); `badge` is a
 * small corner count (e.g. hints left).
 */
export function GameButton({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  badge,
  disabled,
  sound = "tap",
  style,
}: {
  label?: string;
  onPress?: () => void;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode | IconName;
  badge?: string | number;
  disabled?: boolean;
  sound?: Sfx;
  style?: ViewStyle;
}) {
  const kind = KIND[variant];
  const press = useSharedValue(0);
  const sweep = useSharedValue(-1);
  const glow = useSharedValue(0);
  const face = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.06 * press.value }, { translateY: 2 * press.value }] }));
  const pressShade = useAnimatedStyle(() => ({ opacity: press.value * 0.28 }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 1 + (1 - glow.value) * 0.06 }] }));
  const sweepStyle = useAnimatedStyle(() => ({ opacity: sweep.value > -1 && sweep.value < 1 ? 1 : 0, transform: [{ translateX: sweep.value * 220 }, { rotate: "18deg" }] }));
  const h = size === "lg" ? 64 : size === "sm" ? 48 : 56;
  const fs = size === "lg" ? 23 : size === "sm" ? 17 : 20;
  const is = size === "lg" ? 26 : size === "sm" ? 20 : 23;
  const textColor = palette.onPrimary;

  // A lone glyph label (e.g. "⚙") renders as an icon.
  let iconName: IconName | undefined;
  let text = label;
  if (typeof icon === "string") iconName = (GLYPH_ICONS[icon] ?? icon) as IconName;
  if (!icon && label && GLYPH_ICONS[label]) { iconName = GLYPH_ICONS[label]; text = undefined; }
  const iconNode = iconName ? <Icon name={iconName} size={is} color={textColor} /> : icon && typeof icon !== "string" ? icon : null;

  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => {
        press.value = withTiming(1, { duration: 80, easing: Easing.out(Easing.quad) });
        sweep.value = -1;
        sweep.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });
      }}
      onPressOut={() => {
        press.value = withSpring(0, springs.press);
        // Release: a soft rim glow blooms off the plate and fades.
        glow.value = withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 320, easing: Easing.out(Easing.quad) }));
      }}
      onPress={() => {
        feedback(sound, "light");
        onPress?.();
      }}
      style={[{ height: h, minWidth: h, opacity: disabled ? 0.45 : 1 }, style]}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label && !GLYPH_ICONS[label] ? label : iconName}
    >
      <Animated.View pointerEvents="none" style={[styles.glow, { height: h + 6, borderRadius: radius.lg + 3 }, kind === "danger" ? styles.glowDanger : kind === "primary" ? styles.glowPrimary : kind === "secondary" ? styles.glowSecondary : null, glowStyle]} />
      <Animated.View style={[styles.body, { height: h, borderRadius: radius.lg }, kind === "primary" ? shadowStrong : shadow, face]}>
        <Face kind={kind} h={h} />
        {/* pressed: the glossy topcoat darkens as the plate pushes in */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.press, { borderRadius: radius.lg }, pressShade]} />
        <View style={[StyleSheet.absoluteFill, { borderRadius: radius.lg, overflow: "hidden" }]} pointerEvents="none">
          <Animated.View style={[styles.sweep, sweepStyle]}>
            <LinearGradient colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.38)", "rgba(255,255,255,0)"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
        <View style={[styles.content, { paddingHorizontal: size === "sm" ? 12 : size === "lg" ? 24 : 16, paddingBottom: Math.round(h * 0.06) }]}>
          {iconNode}
          {text ? (
            <Text
              // Keep labels on ONE line and shrink to fit narrow 3-up rows.
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={[type.button, styles.label, { color: textColor, fontSize: fs, letterSpacing: -0.01 * fs }, styles.labelShadow]}
            >
              {text}
            </Text>
          ) : null}
        </View>
      </Animated.View>
      {badge !== undefined && badge !== "" ? (
        <View style={styles.badge}>
          {badge === "▶" ? <Icon name="play" size={10} color={palette.ink} /> : <Text style={styles.badgeText}>{badge}</Text>}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { justifyContent: "center" },
  press: { backgroundColor: "#04121A", margin: 3 },
  content: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  label: { flexShrink: 1, textAlign: "center" },
  labelShadow: { textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 3, textShadowOffset: { width: 0, height: 1.5 } },
  glow: {
    position: "absolute", left: -3, right: -3, top: -3, borderWidth: 2, borderColor: palette.glow,
    shadowColor: palette.glow, shadowOpacity: 0.9, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  glowPrimary: { borderColor: "#9FF4FF", shadowColor: palette.primary },
  glowSecondary: { borderColor: "#FFD9A0", shadowColor: palette.secondary },
  glowDanger: { borderColor: "#FFB0A8", shadowColor: palette.danger },
  sweep: { position: "absolute", top: -20, bottom: -20, left: -60, width: 60 },
  badge: {
    position: "absolute", top: -6, right: -6, minWidth: 24, height: 24, paddingHorizontal: 6, borderRadius: 12,
    backgroundColor: palette.secondaryDark, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: palette.ink, ...shadow, elevation: 16,
  },
  badgeText: { ...type.number, fontFamily: fonts.display, fontSize: 12, color: palette.ink, includeFontPadding: false },
});
