import { useEffect, useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { Popup } from "./Popup";
import { Toggle } from "./Toggle";
import { GameButton } from "./GameButton";
import { store } from "../modules/store";
import { iap } from "../modules/iap";
import { notify } from "../modules/notify";
import { palette, type } from "./theme";

/** Settings: sound, music, haptics, restore purchases, privacy. */
export function SettingsPopup({ visible, onClose, privacyUrl }: { visible: boolean; onClose: () => void; privacyUrl?: string }) {
  const [s, setS] = useState(store.get());
  const [restoreNote, setRestoreNote] = useState<string | null>(null);
  useEffect(() => store.subscribe(setS), []);
  const [reminderNote, setReminderNote] = useState<string | null>(null);
  useEffect(() => { if (!visible) { setRestoreNote(null); setReminderNote(null); } }, [visible]);
  // The player opted in: only now ask for notification permission, then schedule the 6 pm Daily Pipework nudge.
  async function setReminders(on: boolean) {
    if (!on) {
      store.set({ reminders: false });
      notify.cancel("daily-pipework");
      setReminderNote(null);
      return;
    }
    const ok = await notify.ask("A daily nudge when a fresh Daily Pipework board is ready");
    store.set({ reminders: ok });
    if (ok) notify.daily("daily-pipework", { hour: 18, minute: 0 }, { title: "Today's Daily Pipework is ready", body: "A fresh remixed board is waiting. Keep your streak flowing!" });
    setReminderNote(ok ? "We'll remind you at 6 pm when the daily board is ready." : "Notifications are off for Flow Forge in your phone's settings.");
  }
  return (
    <Popup visible={visible} title="Settings" onClose={onClose}>
      <View style={styles.group}>
        <Toggle label="Sound" value={s.sound !== false} onChange={(v) => store.set({ sound: v })} />
        <View style={styles.sep} />
        <Toggle label="Music" value={s.music !== false} onChange={(v) => store.set({ music: v })} />
        <View style={styles.sep} />
        <Toggle label={Platform.OS === "ios" ? "Haptics" : "Vibration"} icon="vibrate" value={s.haptics !== false} onChange={(v) => store.set({ haptics: v })} />
        <View style={styles.sep} />
        <Toggle label="Daily reminder" icon="bulb" value={!!s.reminders} onChange={setReminders} />
      </View>
      {reminderNote ? <Text style={styles.note}>{reminderNote}</Text> : null}
      <GameButton style={{ marginTop: 16 }} size="sm" variant="secondary" label="Restore purchases" onPress={() => {
        setRestoreNote("Checking your purchases…");
        iap.restore(true).then((owned) => setRestoreNote(
          owned == null ? "The store isn't reachable right now. Try again later."
            : owned ? "Purchases restored. Ads are removed." : "No previous purchases found to restore.",
        ));
      }} />
      {restoreNote ? <Text style={styles.note}>{restoreNote}</Text> : null}
      {privacyUrl ? (
        <Text style={styles.link} onPress={() => Linking.openURL(privacyUrl)}>Privacy policy</Text>
      ) : null}
      <GameButton style={{ marginTop: 14 }} label="Done" onPress={onClose} />
    </Popup>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: 14, paddingHorizontal: 14, backgroundColor: palette.surfaceDark, borderWidth: 1, borderColor: "rgba(217,164,65,0.22)" },
  sep: { height: 1, backgroundColor: "rgba(217,164,65,0.16)" },
  note: { ...type.caption, color: palette.ink, textAlign: "center", marginTop: 8 },
  link: { ...type.caption, color: palette.inkSoft, textAlign: "center", marginTop: 14, paddingVertical: 6, textDecorationLine: "underline" },
});
