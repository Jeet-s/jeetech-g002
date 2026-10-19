import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GameButton, Popup, fonts, palette } from "../ui";
import { iap, type ShopItem } from "../modules/iap";
import { ads } from "../modules/ads";
import { store } from "../modules/store";

const ICON: Record<string, string> = { remove_ads: "🚫", coins_small: "🪙", coins_large: "💰" };

/** Shop: Remove Ads, coin packs, free coins via rewarded ad, restore purchases. */
export function ShopScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [state, setState] = useState(store.get());
  const [items, setItems] = useState<ShopItem[]>(iap.items());
  useEffect(() => store.subscribe(setState), []);
  useEffect(() => { if (visible) setItems(iap.items()); }, [visible]);
  const list = items.length ? items : [
    { sku: "remove_ads", title: "Remove Ads", price: "—" },
    { sku: "coins_small", title: "Pile of Coins", price: "—" },
    { sku: "coins_large", title: "Chest of Coins", price: "—" },
  ];
  return (
    <Popup visible={visible} title="Shop" onClose={onClose}>
      <Text style={styles.balance}>🪙 {state.coins.toLocaleString()}</Text>
      {list.filter((i) => !(i.sku === "remove_ads" && state.adsRemoved)).map((i) => (
        <View key={i.sku} style={styles.row}>
          <Text style={styles.icon}>{ICON[i.sku] ?? "✨"}</Text>
          <Text style={styles.title}>{i.title}</Text>
          <GameButton size="sm" variant={i.sku === "remove_ads" ? "accent" : "primary"} label={i.price} onPress={() => iap.purchase(i.sku)} />
        </View>
      ))}
      <View style={styles.row}>
        <Text style={styles.icon}>🎬</Text>
        <Text style={styles.title}>Free 50 coins</Text>
        <GameButton size="sm" variant="secondary" label="Watch" onPress={() => ads.showRewarded(() => store.set({ coins: store.get().coins + 50 }))} />
      </View>
      <GameButton style={{ marginTop: 8 }} size="sm" variant="light" label="Restore purchases" onPress={() => iap.restore()} />
      <Text style={styles.policy}>No forced ads early on. Remove Ads is one tap, one time, forever — every pack stays fully playable offline.</Text>
      <GameButton style={{ marginTop: 12 }} label="Close" onPress={onClose} />
    </Popup>
  );
}

const styles = StyleSheet.create({
  balance: { fontFamily: fonts.display, fontSize: 24, color: palette.coin, textAlign: "center", marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: palette.surfaceAlt, borderRadius: 18, padding: 10, marginBottom: 10 },
  icon: { fontSize: 30 },
  title: { flex: 1, fontFamily: fonts.body, fontSize: 17, color: palette.ink },
  policy: { fontFamily: fonts.bodyRegular, fontSize: 12, color: palette.inkSoft, textAlign: "center", marginTop: 12, lineHeight: 17, paddingHorizontal: 4 },
});
