import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, palette, radius, shadow, shadowStrong, springs, type } from "./theme";
import { NineSlice } from "./Plate";
import { GLYPH_ICONS, Icon, type IconName } from "./Icon";
import { art } from "../art";
import { feedback, type Sfx } from "../audio/sfx";

/**
 * Button hierarchy from the art direction:
 *  primary   — orange plate (#D97A2B) with a strong soft shadow and white label
 *  secondary — brushed-steel plate with a lighter edge
 *  tertiary  — ghost outline
 * Older names map onto the hierarchy: accent → primary, light → secondary,
 * neutral → tertiary.
 */
type Variant = "primary" | "secondary" | "tertiary" | "danger" | "accent" | "light" | "neutral";
type Kind = "primary" | "secondary" | "tertiary" | "danger";
const KIND: Record<Variant, Kind> = {
  primary: "primary", accent: "primary",
  secondary: "secondary", light: "secondary",
  tertiary: "tertiary", neutral: "tertiary",
  danger: "danger",
};

const ORANGE = { w: 512, h: 507, cap: { l: 120, t: 110, r: 120, b: 130 } };
const STEEL = { w: 512, h: 186, cap: { l: 80, t: 66, r: 80, b: 76 } };

function Face({ kind, h }: { kind: Kind; h: number }) {
  if (kind === "primary") {
    return <NineSlice source={art.button_primary_orange} w={ORANGE.w} h={ORANGE.h} cap={ORANGE.cap} scale={(h * 0.82) / (ORANGE.cap.t + ORANGE.cap.b)} style={StyleSheet.absoluteFill} />;
  }
  if (kind === "secondary") {
    return <NineSlice source={art.button_secondary_steel} w={STEEL.w} h={STEEL.h} cap={STEEL.cap} scale={(h * 0.86) / (STEEL.cap.t + STEEL.cap.b)} style={StyleSheet.absoluteFill} />;
  }
  if (kind === "danger") {
    return (
      <LinearGradient colors={["#FF7C70", palette.danger, palette.dangerDark]} locations={[0, 0.5, 1]} style={[StyleSheet.absoluteFill, styles.dangerFace]} />
    );
  }
  return <View style={[StyleSheet.absoluteFill, styles.ghost]} />;
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
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 1 + (1 - glow.value) * 0.06 }] }));
  const sweepStyle = useAnimatedStyle(() => ({ opacity: sweep.value > -1 && sweep.value < 1 ? 1 : 0, transform: [{ translateX: sweep.value * 220 }, { rotate: "18deg" }] }));
  const h = size === "lg" ? 64 : size === "sm" ? 48 : 56;
  const fs = size === "lg" ? 23 : size === "sm" ? 17 : 20;
  const is = size === "lg" ? 26 : size === "sm" ? 20 : 23;
  const textColor = kind === "tertiary" ? palette.inkSoft : palette.onPrimary;

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
      <Animated.View pointerEvents="none" style={[styles.glow, { height: h + 6, borderRadius: radius.lg + 3 }, kind === "danger" ? styles.glowDanger : kind === "primary" ? styles.glowPrimary : null, glowStyle]} />
      <Animated.View style={[styles.body, { height: h, borderRadius: radius.lg }, kind === "primary" ? shadowStrong : kind === "tertiary" ? null : shadow, face]}>
        <Face kind={kind} h={h} />
        <View style={[StyleSheet.absoluteFill, { borderRadius: radius.lg, overflow: "hidden" }]} pointerEvents="none">
          <Animated.View style={[styles.sweep, sweepStyle]}>
            <LinearGradient colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.38)", "rgba(255,255,255,0)"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
        <View style={[styles.content, { paddingHorizontal: size === "sm" ? 12 : size === "lg" ? 24 : 16, paddingBottom: kind === "primary" ? 3 : 1 }]}>
          {iconNode}
          {text ? (
            <Text
              // Keep labels on ONE line and shrink to fit narrow 3-up rows.
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={[type.button, styles.label, { color: textColor, fontSize: fs, letterSpacing: -0.01 * fs }, kind !== "tertiary" && styles.labelShadow]}
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
  content: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  label: { flexShrink: 1, textAlign: "center" },
  labelShadow: { textShadowColor: "rgba(0,0,0,0.35)", textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  ghost: { borderRadius: radius.lg, borderWidth: 2, borderColor: "rgba(142,167,178,0.45)", backgroundColor: "rgba(15,26,36,0.35)" },
  dangerFace: { borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  glow: {
    position: "absolute", left: -3, right: -3, top: -3, borderWidth: 2, borderColor: palette.accent,
    shadowColor: palette.accent, shadowOpacity: 0.9, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  glowPrimary: { borderColor: "#FFB36B", shadowColor: palette.primary },
  glowDanger: { borderColor: "#FFB0A8", shadowColor: palette.danger },
  sweep: { position: "absolute", top: -20, bottom: -20, left: -60, width: 60 },
  badge: {
    position: "absolute", top: -6, right: -6, minWidth: 24, height: 24, paddingHorizontal: 6, borderRadius: 12,
    backgroundColor: palette.accentDark, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: palette.ink, ...shadow, elevation: 16,
  },
  badgeText: { ...type.number, fontFamily: fonts.display, fontSize: 12, color: palette.ink, includeFontPadding: false },
});
