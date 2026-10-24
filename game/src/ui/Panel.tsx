import { StyleSheet, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { radius, shadow } from "./theme";
import { NineSlice } from "./Plate";
import { art } from "../art";

/** board_tray art (422x512): chamfered graphite rim, cyan accent line, warm graphite face. */
const TRAY = { w: 422, h: 512, cap: { l: 62, t: 62, r: 62, b: 62 } };

/**
 * Popup / menu card: the board's graphite tray (nine-sliced so the chamfered rim and cyan accent line keep
 * their size) with a soft top-key highlight and a wide drop shadow. `dark` = a deeper face.
 */
export function Panel({ children, style, dark }: { children: React.ReactNode; style?: ViewStyle; dark?: boolean }) {
  return (
    <View style={[styles.wrap, shadow, style]}>
      <View style={styles.glow} pointerEvents="none" />
      <NineSlice source={art.board_tray} w={TRAY.w} h={TRAY.h} cap={TRAY.cap} scale={0.5} fill={dark ? "#2A2622" : "#39332D"} style={StyleSheet.absoluteFill} />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,236,210,0.07)", "rgba(255,236,210,0)", "rgba(0,0,0,0.12)"]}
        locations={[0, 0.4, 1]}
        style={[StyleSheet.absoluteFill, styles.sheen]}
      />
      <View style={styles.face}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.xl },
  glow: {
    position: "absolute", left: 4, right: 4, top: 4, bottom: 4, borderRadius: radius.xl,
    shadowColor: "#12D1E6", shadowOpacity: 0.3, shadowRadius: 22, shadowOffset: { width: 0, height: 0 }, backgroundColor: "rgba(18,209,230,0.04)",
  },
  sheen: { margin: 26, borderRadius: radius.lg },
  face: { paddingHorizontal: 30, paddingVertical: 30 },
});
