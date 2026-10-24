import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Popup } from "./Popup";
import { GameButton } from "./GameButton";
import { Icon } from "./Icon";
import { Well } from "./Plate";
import { Confetti } from "../fx/Confetti";
import { fonts, palette, type } from "./theme";
import { feedback } from "../audio/sfx";
import { art } from "../art";
import { store } from "../modules/store";
import { analytics } from "../modules/analytics";
import {
  BOOSTER_NAME, CHAPTER_INFO, chapterComplete, chapterReward, claimChapter, claimStarGoal, dailyDoneToday, dailyReward,
  liveStreak, nextStarGoal, starGoalReward, tokensCollected, unclaimedChapters,
} from "../game/meta";

/**
 * Forge Progress (opened from the title screen's meta strip): the daily streak, the next star goal and the
 * Forge Token collection — one token per finished chapter, each claimed here for its fixed reward.
 */
export function ForgePopup({ visible, onClose, onDaily }: { visible: boolean; onClose: () => void; onDaily: () => void }) {
  const [s, setS] = useState(store.get());
  useEffect(() => store.subscribe(setS), []);
  const [burst, setBurst] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => { if (!visible) setNote(null); }, [visible]);
  const streak = liveStreak(s);
  const doneToday = dailyDoneToday(s);
  const goal = nextStarGoal(s);
  const pending = unclaimedChapters(s);

  const celebrate = (text: string) => {
    feedback("success", "success");
    setBurst((b) => b + 1);
    setNote(text);
  };
  const claimGoal = () => {
    if (!goal) return;
    const patch = claimStarGoal(store.get());
    if (!patch) return;
    const r = starGoalReward(goal.index);
    store.set(patch);
    analytics.track("star_goal_claim", { goal: goal.target });
    celebrate(`+${r.coins} coins · +1 ${BOOSTER_NAME[r.booster]}`);
  };
  const claimToken = (index: number) => {
    const patch = claimChapter(store.get(), index);
    if (!patch) return;
    const r = chapterReward(index);
    store.set(patch);
    analytics.track("chapter_reward_claim", { chapter: index + 1 });
    celebrate(`Forge Token ${index + 1} · +${r.coins} coins · +1 ${BOOSTER_NAME[r.booster]}`);
  };

  return (
    <Popup visible={visible} title="Forge Progress" onClose={onClose} overlay={<Confetti trigger={burst} count={60} />}>
      {/* Daily streak */}
      <Well style={styles.row} radius={14}>
        <View style={[styles.badge, { backgroundColor: palette.secondaryDark }]}><Icon name="drop" size={24} color={palette.ink} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{streak > 0 ? `${streak}-day streak` : "Daily Pipework"}</Text>
          <Text style={styles.rowSub} numberOfLines={2}>
            {doneToday ? `Cleared today. Tomorrow pays ${dailyReward(streak + 1).coins} coins.` : `Today's board pays ${dailyReward(streak + 1).coins} coins. Every 7th day adds a Wrench.`}
          </Text>
        </View>
        {doneToday ? <Icon name="check" size={26} color={palette.success} stroke={3} /> : (
          <GameButton size="sm" variant="primary" label="Play" onPress={() => { onClose(); onDaily(); }} />
        )}
      </Well>

      {/* Star goal */}
      <Well style={styles.row} radius={14}>
        <View style={[styles.badge, { backgroundColor: "#6A4A12" }]}><Icon name="star" size={24} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{goal ? `Star goal · ${goal.target}` : "Every star goal reached"}</Text>
          {goal ? (
            <>
              <View style={styles.bar}><View style={[styles.barFill, { width: `${Math.min(100, (goal.have / goal.target) * 100)}%` }]} /></View>
              <Text style={styles.rowSub} numberOfLines={1}>
                {Math.min(goal.have, goal.target)}/{goal.target} stars · {starGoalReward(goal.index).coins} coins + {BOOSTER_NAME[starGoalReward(goal.index).booster]}
              </Text>
            </>
          ) : <Text style={styles.rowSub}>A true Forge Master.</Text>}
        </View>
        {goal?.ready ? <GameButton size="sm" variant="secondary" label="Claim" onPress={claimGoal} /> : null}
      </Well>

      {/* Forge Token collection */}
      <Text style={styles.section}>FORGE TOKENS · {tokensCollected(s)}/{CHAPTER_INFO.length}</Text>
      <View style={styles.tokens}>
        {[0, 1].map((row) => (
          <View key={row} style={styles.tokenRow}>
            {CHAPTER_INFO.slice(row * 5, row * 5 + 5).map((c) => {
              const have = (s.claimedChapters ?? []).includes(c.index);
              const ready = !have && chapterComplete(s, c);
              return (
                <View key={c.index} style={styles.token} accessibilityLabel={`${c.name} token ${have ? "collected" : ready ? "ready" : "locked"}`}>
                  {have ? (
                    <Animated.View entering={ZoomIn.springify()}>
                      <Image source={art.reward_gear_token} style={styles.tokenImg} fadeDuration={0} />
                    </Animated.View>
                  ) : (
                    <Image source={art.reward_gear_token} style={[styles.tokenImg, { tintColor: ready ? palette.secondary : "#2A2622", opacity: ready ? 0.9 : 1 }]} fadeDuration={0} />
                  )}
                  <Text style={[styles.tokenNo, have ? null : { color: palette.inkMuted }]}>{c.index + 1}</Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
      {pending.length ? (
        <GameButton style={{ marginTop: 6 }} size="sm" variant="secondary" icon="check" label={`Claim ${pending[0].name} token`} onPress={() => claimToken(pending[0].index)} />
      ) : (
        <Text style={styles.rowSub}>Finish a chapter to forge its token: coins and a booster with each one.</Text>
      )}
      {note ? <Animated.Text entering={ZoomIn.duration(220)} style={styles.note}>{note}</Animated.Text> : null}
    </Popup>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, marginBottom: 10 },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: palette.brass },
  rowTitle: { fontFamily: fonts.display, fontSize: 17, color: palette.ink, includeFontPadding: false },
  rowSub: { ...type.caption, color: palette.inkSoft, marginTop: 2 },
  bar: { height: 8, borderRadius: 4, backgroundColor: "#0E0C0A", marginTop: 6, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4, backgroundColor: palette.star },
  section: { fontFamily: fonts.displayMedium, fontSize: 13, letterSpacing: 0.8, color: palette.secondary, marginTop: 4, marginBottom: 6, textAlign: "center" },
  tokens: { gap: 6, marginBottom: 6 },
  tokenRow: { flexDirection: "row", justifyContent: "space-between" },
  token: { width: 52, alignItems: "center" },
  tokenImg: { width: 44, height: 44 },
  tokenNo: { fontFamily: fonts.display, fontSize: 12, color: palette.ink, marginTop: -2, includeFontPadding: false },
  note: { fontFamily: fonts.display, fontSize: 16, color: palette.coin, textAlign: "center", marginTop: 10 },
});
