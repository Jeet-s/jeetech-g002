import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Icon, type IconName } from "./Icon";
import { palette, springs, type } from "./theme";
import { feedback } from "../audio/sfx";

/** Steel switch: recessed track that lights cyan when on. Whole row is the tap target. */
export function Toggle({ label, value, onChange, icon }: { label: string; value: boolean; onChange: (v: boolean) => void; icon?: IconName }) {
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(value ? 26 : 0, springs.press) }] }));
  const lit = useAnimatedStyle(() => ({ opacity: withTiming(value ? 1 : 0, { duration: 160 }) }));
  // Press: the knob squashes and the row dims a touch, so the switch answers the finger before it flips.
  const press = useSharedValue(0);
  const rowStyle = useAnimatedStyle(() => ({ opacity: 1 - press.value * 0.15 }));
  const squash = useAnimatedStyle(() => ({ transform: [{ scaleX: 1 + press.value * 0.18 }, { scaleY: 1 - press.value * 0.1 }] }));
  const ic = icon ?? (label === "Sound" ? "sound" : label === "Music" ? "music" : label === "Vibration" ? "vibrate" : undefined);
  return (
    <Pressable
      style={styles.row}
      onPressIn={() => (press.value = withTiming(1, { duration: 70 }))}
      onPressOut={() => (press.value = withSpring(0, springs.press))}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => {
        feedback("tap", "select");
        onChange(!value);
      }}
    >
      <Animated.View style={[styles.inner, rowStyle]}>
        {ic ? <Icon name={ic} size={22} color={palette.inkSoft} /> : null}
        <Text style={styles.label}>{label}</Text>
        <View style={styles.track}>
          <Animated.View style={[styles.trackOn, lit]} />
          <Animated.View style={[styles.knob, knob]}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.knobFace, squash]} />
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 52, paddingVertical: 6, justifyContent: "center" },
  inner: { flexDirection: "row", alignItems: "center", gap: 12 },
  label: { ...type.body, flex: 1, fontSize: 17, color: palette.ink },
  track: {
    width: 58, height: 32, borderRadius: 16, padding: 3, backgroundColor: "#15120F", overflow: "hidden",
    borderWidth: 1, borderTopColor: "rgba(0,0,0,0.7)", borderColor: "rgba(217,164,65,0.3)",
  },
  trackOn: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: palette.primaryDark, borderRadius: 16 },
  knobFace: { borderRadius: 12, backgroundColor: "#E4ECF1" },
  knob: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", elevation: 3,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 2 },
  },
});
