import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Background, CurrencyPill, GameButton, LevelMap, type MapLevel, palette, type } from "../ui";
import { store } from "../modules/store";
import { LEVELS } from "../game/levels";
import { useBannerHeight } from "../modules/layout";

/** The level map (reached from the title screen's "Levels" button): every level, stars, chapters. */
export function LevelsScreen({ onPlay, onBack }: { onPlay: (levelNumber: number) => void; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  // Instant response to "play": the map dims the moment it's pressed, while the level screen loads.
  const leaving = useSharedValue(0);
  const leaveStyle = useAnimatedStyle(() => ({ opacity: 1 - leaving.value * 0.55, transform: [{ scale: 1 + leaving.value * 0.04 }] }));
  const play = (n: number) => {
    leaving.value = withTiming(1, { duration: 160 });
    onPlay(n);
  };
  const bannerH = useBannerHeight();
  const [s, setS] = useState(store.get());
  useEffect(() => store.subscribe(setS), []);
  const stars = s.stars ?? {};
  const current = Math.min(LEVELS.length, Math.max(1, s.level));
  const levels: MapLevel[] = LEVELS.map((l) => ({
    id: l.id,
    number: l.number,
    chapter: l.chapter,
    stars: l.number < current ? stars[l.id] ?? 1 : l.number === current ? 0 : -1,
  }));
  const totalStars = Object.values(stars).reduce((a, b) => a + b, 0);
  return (
    <Animated.View style={[styles.root, leaveStyle]}>
      <Background />
      <LevelMap
        levels={levels}
        current={current}
        onSelect={(l) => play(l.number)}
        padTop={insets.top + 120}
        padBottom={insets.bottom + bannerH + 180}
      />
      {/* Scrims so the map fades under the HUD and the buttons instead of colliding with them. */}
      <LinearGradient pointerEvents="none" colors={["rgba(15,26,36,1)", "rgba(15,26,36,0.95)", "rgba(15,26,36,0)"]} locations={[0, 0.55, 1]} style={[styles.scrimTop, { height: insets.top + 150 }]} />
      <LinearGradient pointerEvents="none" colors={["rgba(15,26,36,0)", "rgba(15,26,36,0.7)", "rgba(15,26,36,0.92)"]} style={[styles.scrimBottom, { height: insets.bottom + bannerH + 190 }]} />
      <View style={[styles.hud, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <CurrencyPill icon="star" value={totalStars} />
        <CurrencyPill icon="coin" value={s.coins} />
      </View>
      <Text style={[styles.logo, { top: insets.top + 60 }]} numberOfLines={1} adjustsFontSizeToFit pointerEvents="none">
        Levels
      </Text>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + bannerH + 16 }]} pointerEvents="box-none">
        <GameButton size="lg" variant="secondary" icon="back" onPress={onBack} />
        <GameButton label={`Play · Level ${current}`} variant="accent" size="lg" icon="play" style={{ flex: 1 }} onPress={() => play(current)} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hud: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14 },
  logo: { ...type.hero, fontSize: 36, letterSpacing: -0.36, position: "absolute", left: 24, right: 24, textAlign: "center", color: palette.ink, textShadowColor: "rgba(46,196,255,0.45)", textShadowRadius: 16 },
  scrimTop: { position: "absolute", left: 0, right: 0, top: 0 },
  scrimBottom: { position: "absolute", left: 0, right: 0, bottom: 0 },
  bottom: { position: "absolute", left: 16, right: 16, bottom: 0, flexDirection: "row", alignItems: "center", gap: 12 },
});
