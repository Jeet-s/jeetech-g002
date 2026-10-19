import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GameButton } from "./GameButton";
import { palette, type } from "./theme";

/** Header: back, title, settings — steel square icon buttons. Sits under the status bar. */
export function TopBar({ title, onBack, onSettings, right }: { title?: string; onBack?: () => void; onSettings?: () => void; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
      <View style={styles.side}>{onBack ? <GameButton size="sm" variant="secondary" icon="back" onPress={onBack} /> : null}</View>
      <Text style={[type.title, styles.title]} numberOfLines={1}>{title}</Text>
      <View style={[styles.side, { alignItems: "flex-end" }]}>
        {right ?? (onSettings ? <GameButton size="sm" variant="secondary" icon="gear" onPress={onSettings} /> : null)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 6 },
  side: { width: 60 },
  title: { flex: 1, textAlign: "center", color: palette.ink, textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 6 },
});
