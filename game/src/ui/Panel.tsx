import { Image, StyleSheet, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { lip as lipTone, palette, radius, shadow } from "./theme";
import { art } from "../art";

/**
 * Dark satin-steel sheet with a bevelled top highlight and a faint anodized
 * teal edge glow — for popups, menus and HUD groups. `dark` = deeper inset.
 */
export function Panel({ children, style, dark }: { children: React.ReactNode; style?: ViewStyle; dark?: boolean }) {
  return (
    <View style={[styles.wrap, shadow, style]}>
      <View style={styles.glow} pointerEvents="none" />
      <View style={[styles.lip, { backgroundColor: dark ? lipTone.dark : lipTone.light }]} />
      <View style={styles.face}>
        <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none">
          <Image source={art.hud_plate_steel} resizeMode="stretch" fadeDuration={0} style={[StyleSheet.absoluteFill, { opacity: dark ? 0.35 : 0.6 }]} />
          <LinearGradient colors={dark ? ["rgba(17,27,35,0.85)", "rgba(11,18,24,0.95)"] : ["rgba(39,68,84,0.35)", "rgba(15,26,36,0.88)"]} style={StyleSheet.absoluteFill} />
          <View style={styles.highlight} />
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.xl },
  glow: { position: "absolute", left: -1, right: -1, top: -1, bottom: -1, borderRadius: radius.xl + 1, shadowColor: palette.accent, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, backgroundColor: "rgba(46,196,255,0.06)" },
  lip: { position: "absolute", left: 0, right: 0, top: 6, bottom: -6, borderRadius: radius.xl },
  face: {
    borderRadius: radius.xl, padding: 22, backgroundColor: palette.surface,
    borderWidth: 1.5, borderColor: palette.rim, borderTopColor: "rgba(46,196,255,0.38)",
  },
  clip: { borderRadius: radius.xl - 1, overflow: "hidden" },
  highlight: { position: "absolute", top: 0, left: 16, right: 16, height: 1.5, backgroundColor: "rgba(200,230,245,0.28)" },
});
