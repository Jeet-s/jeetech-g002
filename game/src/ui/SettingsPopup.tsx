import { useEffect, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Popup } from "./Popup";
import { Toggle } from "./Toggle";
import { GameButton } from "./GameButton";
import { store } from "../modules/store";
import { iap } from "../modules/iap";
import { palette, type } from "./theme";

/** Settings: sound, music, haptics, restore purchases, privacy. */
export function SettingsPopup({ visible, onClose, privacyUrl }: { visible: boolean; onClose: () => void; privacyUrl?: string }) {
  const [s, setS] = useState(store.get());
  useEffect(() => store.subscribe(setS), []);
  return (
    <Popup visible={visible} title="Settings" onClose={onClose}>
      <View style={styles.group}>
        <Toggle label="Sound" value={s.sound !== false} onChange={(v) => store.set({ sound: v })} />
        <View style={styles.sep} />
        <Toggle label="Music" value={s.music !== false} onChange={(v) => store.set({ music: v })} />
        <View style={styles.sep} />
        <Toggle label="Vibration" value={s.haptics !== false} onChange={(v) => store.set({ haptics: v })} />
      </View>
      <GameButton style={{ marginTop: 16 }} size="sm" variant="secondary" label="Restore purchases" onPress={() => iap.restore()} />
      {privacyUrl ? (
        <Text style={styles.link} onPress={() => Linking.openURL(privacyUrl)}>Privacy policy</Text>
      ) : null}
      <GameButton style={{ marginTop: 14 }} label="Done" onPress={onClose} />
    </Popup>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: 14, paddingHorizontal: 14, backgroundColor: palette.surfaceAlt, borderWidth: 1, borderColor: "rgba(142,167,178,0.14)" },
  sep: { height: 1, backgroundColor: "rgba(142,167,178,0.14)" },
  link: { ...type.caption, color: palette.inkSoft, textAlign: "center", marginTop: 14, paddingVertical: 6, textDecorationLine: "underline" },
});
