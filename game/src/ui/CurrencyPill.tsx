import { StyleSheet, Text, View } from "react-native";
import { AnimatedNumber } from "./AnimatedNumber";
import { GLYPH_ICONS, Icon, type IconName } from "./Icon";
import { SteelPlate } from "./Plate";
import { palette, type } from "./theme";

/** HUD pill on a steel plate: icon + animated count (coins, stars). */
export function CurrencyPill({ icon, value }: { icon: string | IconName; value: number; color?: string }) {
  const name = (GLYPH_ICONS[icon] ?? icon) as IconName;
  return (
    <SteelPlate style={styles.pill} radius={22}>
      <View style={styles.icon}>
        {name ? <Icon name={name} size={26} /> : <Text>{icon}</Text>}
      </View>
      <AnimatedNumber value={value} style={styles.value} />
    </SteelPlate>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", height: 44, paddingLeft: 6, paddingRight: 16 },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginRight: 8, backgroundColor: "rgba(15,26,36,0.6)" },
  value: { ...type.number, fontSize: 19, letterSpacing: -0.19, color: palette.ink, minWidth: 28 },
});
