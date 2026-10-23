import { useEffect, useRef, useState } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { GameButton, Icon, Popup, Well, feedback, fonts, palette, type IconName } from "../ui";
import { iap, type ShopItem } from "../modules/iap";
import { ads } from "../modules/ads";
import { store } from "../modules/store";
import { BOOSTERS, owned, type Booster, type BoosterId } from "../game/boosters";
import { art } from "../art";

const IOS = Platform.OS === "ios";
const ICON: Record<string, string> = { remove_ads: "🚫", coins_small: "🪙", coins_large: "💰" };
const BOOSTER_ICON: Record<BoosterId, IconName | "wrench-art"> = { hint: "bulb", wrench: "wrench-art", moves: "plus" };

function BoosterIcon({ id, size }: { id: BoosterId; size: number }) {
  const i = BOOSTER_ICON[id];
  return i === "wrench-art"
    ? <Image source={art.icon_reward_wrench} style={{ width: size, height: size }} resizeMode="contain" fadeDuration={0} />
    : <Icon name={i} size={size} color={i === "bulb" ? palette.ink : palette.accent} stroke={2.8} />;
}

/**
 * Shop: Boosters (pick one → its card shows what it does, how many you own and
 * its fixed coin price), Remove Ads (opens its own purchase sheet), coin packs,
 * free coins via an opt-in video, restore purchases. Every action ends in a
 * result line pinned under the coin balance.
 */
export function ShopScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { height } = useWindowDimensions();
  const [state, setState] = useState(store.get());
  const [items, setItems] = useState<ShopItem[]>(iap.items());
  const [page, setPage] = useState<"shop" | "noads">("shop");
  const [pick, setPick] = useState<BoosterId>("hint");
  const [note, setNote] = useState<{ text: string; good: boolean; k: number } | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = (text: string, good: boolean) => {
    feedback(good ? "success" : "error", good ? "success" : "error");
    setNote((n) => ({ text, good, k: (n?.k ?? 0) + 1 }));
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(null), 3600);
  };
  useEffect(() => () => { if (noteTimer.current) clearTimeout(noteTimer.current); }, []);
  useEffect(() => store.subscribe(setState), []);
  useEffect(() => {
    if (!visible) { setNote(null); setPage("shop"); return; }
    setItems(iap.items());
    if (IOS) iap.refresh().then(setItems).catch(() => {});
  }, [visible]);
  // iOS: only products StoreKit returned, at StoreKit's prices — never a placeholder row.
  const list = IOS ? items : items.length ? items : [
    { sku: "remove_ads", title: "Remove Ads", price: "Buy" },
    { sku: "coins_small", title: "Pile of Coins", price: "Buy" },
    { sku: "coins_large", title: "Chest of Coins", price: "Buy" },
  ];
  const noAds = list.find((i) => i.sku === "remove_ads");
  const packs = list.filter((i) => i.sku !== "remove_ads");

  const buy = (sku: string) => {
    iap.purchase(sku).then((ok) => {
      if (!ok) say("The store isn't reachable right now. Check your connection and try again.", false);
    });
  };
  const restore = () => {
    iap.restore(true).then((ok) => {
      if (ok == null) say("The store isn't reachable right now. Check your connection and try again.", false);
      else say(ok ? "Purchases restored. Ads are removed." : "No previous purchases found to restore.", ok);
    });
  };
  const buyBooster = (b: Booster) => {
    const s = store.get();
    if (s.coins < b.coins) { say(`You need ${b.coins - s.coins} more coins for ${b.pack} ${b.name}. Clear levels to earn them.`, false); return; }
    const have = owned(s, b.id) + b.pack;
    store.set({ coins: s.coins - b.coins, [b.key]: have });
    say(`+${b.pack} ${b.name}! You now have ${have}.`, true);
  };
  const freeBooster = (b: Booster) => {
    const shown = ads.showRewarded(() => {
      const have = owned(store.get(), b.id) + 1;
      store.set({ [b.key]: have });
      say(`+1 ${b.name}! You now have ${have}.`, true);
    });
    if (!shown) say("No video is ready right now. Try again in a minute.", false);
  };

  const sel = BOOSTERS.find((b) => b.id === pick)!;
  const noteView = note ? (
    <Animated.View key={note.k} entering={FadeIn.duration(140)} exiting={FadeOut.duration(220)} style={[styles.note, note.good ? styles.noteGood : styles.noteBad]}>
      <Text style={styles.noteText}>{note.text}</Text>
    </Animated.View>
  ) : null;

  if (page === "noads") {
    return (
      <Popup visible={visible} title="Remove Ads" onClose={() => setPage("shop")}>
        <Animated.View entering={FadeInDown.duration(220)}>
          <View style={styles.heroIcon}><Icon name="noads" size={56} color={palette.primary} stroke={2.4} /></View>
          {state.adsRemoved ? (
            <Text style={styles.sheetLead}>Ads are removed on this device. Thank you for supporting Flow Forge!</Text>
          ) : (
            <>
              <Text style={styles.sheetLead}>One purchase, yours forever:</Text>
              {["No banner under the board", "No ads between levels", "Free-booster videos stay optional, only when you tap them", "Restore it any time on a new device"].map((t) => (
                <View key={t} style={styles.bullet}>
                  <Icon name="check" size={18} color={palette.success} stroke={3} />
                  <Text style={styles.bulletText}>{t}</Text>
                </View>
              ))}
            </>
          )}
          {noteView}
          {!state.adsRemoved && noAds ? (
            <GameButton style={{ marginTop: 14 }} size="lg" variant="primary" label={noAds.price === "Buy" ? "Buy Remove Ads" : `Buy for ${noAds.price}`} onPress={() => buy("remove_ads")} />
          ) : null}
          <GameButton style={{ marginTop: 10 }} size="sm" variant="secondary" label="Restore purchases" onPress={restore} />
          <GameButton style={{ marginTop: 10 }} size="sm" variant="tertiary" icon="back" label="Back to shop" onPress={() => setPage("shop")} />
        </Animated.View>
      </Popup>
    );
  }

  return (
    <Popup visible={visible} title="Shop" onClose={onClose}>
      <Text style={styles.balance}>🪙 {state.coins.toLocaleString()}</Text>
      {noteView}
      <ScrollView style={{ maxHeight: Math.max(300, height - 330) }} contentContainerStyle={{ paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.section}>Boosters</Text>
        <View style={styles.cards}>
          {BOOSTERS.map((b) => {
            const on = b.id === pick;
            return (
              <Pressable
                key={b.id}
                onPress={() => { feedback("tap", "select"); setPick(b.id); }}
                style={[styles.card, on && styles.cardOn]}
                accessibilityRole="button"
                accessibilityLabel={`${b.name} booster`}
                accessibilityState={{ selected: on }}
              >
                <BoosterIcon id={b.id} size={30} />
                <Text style={styles.cardName} numberOfLines={1} adjustsFontSizeToFit>{b.name}</Text>
                <Text style={styles.cardOwned}>×{owned(state, b.id)}</Text>
              </Pressable>
            );
          })}
        </View>
        <Animated.View key={pick} entering={FadeIn.duration(160)}>
          <Well style={styles.detail} radius={16}>
            <View style={styles.detailHead}>
              <BoosterIcon id={sel.id} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{sel.name}</Text>
                <Text style={styles.sub}>{sel.what}</Text>
                <Text style={styles.have}>You have {owned(state, sel.id)} · use it from the tray under the board</Text>
              </View>
            </View>
            <View style={styles.detailBtns}>
              <GameButton style={{ flex: 1.3 }} size="sm" variant="primary" label={`Buy ${sel.pack} · 🪙 ${sel.coins}`} onPress={() => buyBooster(sel)} />
              <GameButton style={{ flex: 1 }} size="sm" variant="secondary" icon="play" label="Free 1" onPress={() => freeBooster(sel)} />
            </View>
          </Well>
        </Animated.View>

        {noAds && !state.adsRemoved ? (
          <Pressable onPress={() => { feedback("tap", "light"); setPage("noads"); }} style={styles.row} accessibilityRole="button" accessibilityLabel="Remove Ads">
            <Text style={styles.icon}>{ICON.remove_ads}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Remove Ads</Text>
              <Text style={styles.sub}>No banners, no ads between levels</Text>
            </View>
            <GameButton size="sm" variant="accent" label={noAds.price} onPress={() => setPage("noads")} />
          </Pressable>
        ) : null}
        {IOS && !items.length ? <Text style={styles.policy}>The App Store is unavailable right now. Please try again later.</Text> : null}
        {packs.map((i) => (
          <View key={i.sku} style={styles.row}>
            <Text style={styles.icon}>{ICON[i.sku] ?? "✨"}</Text>
            <Text style={[styles.title, { flex: 1 }]}>{i.title}</Text>
            <GameButton size="sm" variant="primary" label={i.price} onPress={() => buy(i.sku)} />
          </View>
        ))}
        <View style={styles.row}>
          <Text style={styles.icon}>🎬</Text>
          <Text style={[styles.title, { flex: 1 }]}>Free 50 coins</Text>
          <GameButton
            size="sm" variant="secondary" label="Watch"
            onPress={() => {
              const shown = ads.showRewarded(() => {
                store.set({ coins: store.get().coins + 50 });
                say("+50 coins added!", true);
              });
              if (!shown) say("No video is ready right now. Try again in a minute.", false);
            }}
          />
        </View>
        <GameButton style={{ marginTop: 4 }} size="sm" variant="light" label="Restore purchases" onPress={restore} />
        <Text style={styles.policy}>No forced ads early on. Every booster has a fixed price and contents. Remove Ads is one tap, one time, forever.</Text>
      </ScrollView>
      <GameButton style={{ marginTop: 12 }} label="Close" onPress={onClose} />
    </Popup>
  );
}

const styles = StyleSheet.create({
  balance: { fontFamily: fonts.display, fontSize: 24, color: palette.coin, textAlign: "center", marginBottom: 10 },
  section: { fontFamily: fonts.display, fontSize: 16, color: palette.inkSoft, marginBottom: 8, marginLeft: 2 },
  cards: { flexDirection: "row", gap: 8, marginBottom: 8 },
  card: {
    flex: 1, alignItems: "center", gap: 3, paddingVertical: 10, borderRadius: 16, backgroundColor: palette.surfaceAlt,
    borderWidth: 2, borderColor: "rgba(142,167,178,0.18)",
  },
  cardOn: { backgroundColor: "#24414F", borderColor: palette.accent, transform: [{ translateY: -2 }] },
  cardName: { fontFamily: fonts.display, fontSize: 14, color: palette.ink },
  cardOwned: { fontFamily: fonts.body, fontSize: 13, color: palette.coin },
  detail: { padding: 12, marginBottom: 12, gap: 10 },
  detailHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  detailBtns: { flexDirection: "row", gap: 8 },
  have: { fontFamily: fonts.body, fontSize: 12, color: palette.accent, marginTop: 3 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: palette.surfaceAlt, borderRadius: 18, padding: 10, marginBottom: 10 },
  icon: { fontSize: 30 },
  title: { fontFamily: fonts.body, fontSize: 17, color: palette.ink },
  sub: { fontFamily: fonts.bodyRegular, fontSize: 12, lineHeight: 16, color: palette.inkSoft, marginTop: 1 },
  note: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10, borderWidth: 1.5 },
  noteGood: { backgroundColor: "rgba(40,110,70,0.35)", borderColor: palette.success },
  noteBad: { backgroundColor: "rgba(120,30,30,0.35)", borderColor: palette.danger },
  noteText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: palette.ink, textAlign: "center" },
  policy: { fontFamily: fonts.bodyRegular, fontSize: 12, color: palette.inkSoft, textAlign: "center", marginTop: 12, lineHeight: 17, paddingHorizontal: 4 },
  heroIcon: { alignSelf: "center", width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center", backgroundColor: palette.surfaceAlt, borderWidth: 2, borderColor: palette.primary, marginBottom: 12 },
  sheetLead: { fontFamily: fonts.display, fontSize: 18, color: palette.ink, textAlign: "center", marginBottom: 10 },
  bullet: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  bulletText: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: palette.ink },
});
