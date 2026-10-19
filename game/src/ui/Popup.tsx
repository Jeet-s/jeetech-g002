import { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
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
export function Popup({ visible, title, onClose, children }: { visible: boolean; title?: string; onClose?: () => void; children: React.ReactNode }) {
  const s = useSharedValue(0);
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
        <LinearGradient colors={["rgba(8,16,22,0.80)", "rgba(6,12,17,0.90)"]} style={StyleSheet.absoluteFill} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <View style={styles.center} pointerEvents="box-none">
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22 },
  cardWrap: { width: "100%", maxWidth: 420 },
  title: { color: palette.ink, textAlign: "center", marginBottom: 16 },
  titlePad: { paddingHorizontal: 40 },
  close: {
    position: "absolute", top: 10, right: 10, width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "rgba(142,167,178,0.35)", backgroundColor: "rgba(15,26,36,0.5)",
  },
});
