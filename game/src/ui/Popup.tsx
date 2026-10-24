import { useEffect } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Panel } from "./Panel";
import { Icon } from "./Icon";
import { palette, springs, type } from "./theme";
import { feedback, play } from "../audio/sfx";

/**
 * Modal sheet in dark steel that springs in over a deep, teal-tinted scrim.
 * With `onClose` a ghost close (X) sits in the corner (48dp target).
 */
export function Popup({ visible, title, onClose, children, overlay }: {
  visible: boolean; title?: string; onClose?: () => void; children: React.ReactNode;
  /** Full-screen FX drawn above the card inside the modal (confetti) — a Modal covers anything outside it. */
  overlay?: React.ReactNode;
}) {
  const s = useSharedValue(0);
  // iOS: keep the sheet clear of the Dynamic Island / status bar and home indicator (the scrim stays full-bleed).
  const insets = useSafeAreaInsets();
  const safe = Platform.OS === "ios" ? { paddingTop: 22 + insets.top, paddingBottom: 22 + insets.bottom } : null;
  useEffect(() => {
    if (visible) {
      play("whoosh", 0.6);
      s.value = 0;
      s.value = withSpring(1, springs.pop);
    }
  }, [visible, s]);
  const card = useAnimatedStyle(() => ({ transform: [{ scale: 0.8 + 0.2 * s.value }, { translateY: (1 - s.value) * 24 }], opacity: Math.min(1, s.value * 1.6) }));
  const dim = useAnimatedStyle(() => ({ opacity: withTiming(visible ? 1 : 0, { duration: 200, easing: Easing.out(Easing.quad) }) }));
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, dim]}>
        <LinearGradient colors={["rgba(6,10,24,0.80)", "rgba(10,8,6,0.90)"]} style={StyleSheet.absoluteFill} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <View style={[styles.center, safe]} pointerEvents="box-none">
        <Animated.View style={[styles.cardWrap, card]}>
          <Panel>
            {title ? <Text style={[type.title, styles.title, onClose ? styles.titlePad : null]}>{title}</Text> : null}
            {children}
          </Panel>
          {onClose ? (
            <Pressable
              onPress={() => { feedback("tap", "light"); onClose(); }}
              style={styles.close}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Icon name="close" size={20} color={palette.inkSoft} />
            </Pressable>
          ) : null}
        </Animated.View>
      </View>
      {overlay ? <View style={StyleSheet.absoluteFill} pointerEvents="none">{overlay}</View> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22 },
  cardWrap: { width: "100%", maxWidth: 420 },
  title: { color: palette.ink, textAlign: "center", marginBottom: 16 },
  titlePad: { paddingHorizontal: 40 },
  close: {
    position: "absolute", top: 18, right: 18, width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "rgba(217,164,65,0.5)", backgroundColor: "rgba(16,13,10,0.6)",
  },
});
