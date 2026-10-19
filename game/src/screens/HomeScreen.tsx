import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing, FadeInDown, FadeInUp, ZoomIn, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from "react-native-reanimated";
import { Background, CurrencyPill, GameButton, Icon, SteelPlate, Well, feedback, fonts, palette, springs, type, type IconName } from "../ui";
import { store } from "../modules/store";
import { LEVELS } from "../game/levels";
import { flow } from "../game/engine";
import { PipeBoard, boardChrome, boardView } from "../game/PipeBoard";
import { useBannerHeight } from "../modules/layout";
import { art } from "../art";

/** assets/art/logo.png is 900x601. */
const LOGO_ASPECT = 601 / 900;

/** Two-fluid board shown fully routed as the title screen's key art. */
const HERO_LEVEL = 14;

/**
 * HOME = Flow Forge's title screen: currencies → logo → a live, fully routed
 * pipe board (fluids bubbling, a glow sweep every few seconds) → chapter
 * progress → ONE big "Play · Level N" → Levels / Shop / Settings.
 */
export function HomeScreen({ onPlay, onLevels, onShop, onSettings }: {
  onPlay: (levelNumber: number) => void; onLevels: () => void; onShop: () => void; onSettings: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  // ~80% of the width, capped so a short phone still leaves room for the hero board.
  const logoW = Math.floor(Math.min(winW * 0.8, (winH * 0.2) / LOGO_ASPECT));
  const bannerH = useBannerHeight();
  const [s, setS] = useState(store.get());
  useEffect(() => store.subscribe(setS), []);
  const current = Math.min(LEVELS.length, Math.max(1, s.level));
  const chapter = LEVELS[current - 1]?.chapter ?? "";
  const inChapter = LEVELS.filter((l) => l.chapter === chapter);
  const doneInChapter = inChapter.filter((l) => l.number < current).length;
  const totalStars = Object.values(s.stars ?? {}).reduce((a, b) => a + b, 0);

  // Idle life: the logo floats, the Play button breathes.
  const float = useSharedValue(0);
  const breathe = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }), -1, true);
    breathe.value = withDelay(900, withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })), -1));
  }, [float, breathe]);
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -5 + float.value * 10 }, { rotate: `${-0.6 + float.value * 1.2}deg` }] }));
  const playStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breathe.value * 0.035 }] }));

  const [hero, setHero] = useState({ w: 0, h: 0 });
  return (
    <View style={styles.root}>
      <Background />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(46,196,255,0)", "rgba(46,196,255,0.12)", "rgba(46,196,255,0)"]}
        style={[StyleSheet.absoluteFill, { top: "24%", bottom: "32%" }]}
      />

      <View style={[styles.hud, { paddingTop: insets.top + 8 }]}>
        <CurrencyPill icon="star" value={totalStars} />
        <CurrencyPill icon="coin" value={s.coins} />
      </View>

      <Animated.View entering={FadeInDown.duration(500)} style={[styles.logoWrap, logoStyle]}>
        <Image
          source={art.logo}
          style={{ width: logoW, height: Math.floor(logoW * LOGO_ASPECT) }}
          resizeMode="contain"
          fadeDuration={0}
          accessibilityRole="header"
          accessibilityLabel="Flow Forge: Pipes and Pressure"
        />
      </Animated.View>

      <View style={styles.heroArea} pointerEvents="none" onLayout={(e) => setHero({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {hero.h > 0 ? <HeroBoard w={hero.w - 48} h={hero.h - 12} /> : null}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + bannerH + 16 }]}>
        <Animated.View entering={FadeInUp.delay(150).duration(450)}>
          <SteelPlate style={styles.chapterCard} radius={14}>
            <View style={styles.chapterRow}>
              <Text style={styles.chapterLabel} numberOfLines={1}>{chapter}</Text>
              <Text style={styles.chapterCount}>{doneInChapter}/{inChapter.length}</Text>
            </View>
            <Well style={styles.progressTrack} radius={6}>
              <LinearGradient
                colors={[palette.accent, palette.accentDark]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${Math.max(6, (doneInChapter / Math.max(1, inChapter.length)) * 100)}%` }]}
              />
            </Well>
          </SteelPlate>
        </Animated.View>

        <Animated.View entering={ZoomIn.delay(250).springify()} style={playStyle}>
          <GameButton label={`Play · Level ${current}`} variant="primary" size="lg" icon="play" sound="whoosh" onPress={() => onPlay(current)} />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(350).duration(450)} style={styles.iconRow}>
          <RoundButton icon="map" label="Levels" onPress={onLevels} />
          <RoundButton icon="shop" label="Shop" onPress={onShop} />
          <RoundButton icon="gear" label="Settings" onPress={onSettings} />
        </Animated.View>
      </View>
    </View>
  );
}

/** A real level, fully routed, gently bobbing; a win glow sweeps it every 4.5 s. */
function HeroBoard({ w, h }: { w: number; h: number }) {
  const level = LEVELS[HERO_LEVEL - 1];
  const rot = level.solution;
  const fv = useMemo(() => flow(level, rot), [level, rot]);
  const view = boardView(level);
  let tile = Math.floor(Math.min(w / view.cols, h / view.rows, 84));
  while (tile > 30 && (tile * view.cols + boardChrome(tile).edge * 2 > w || tile * view.rows + boardChrome(tile).edge * 2 > h)) tile--;
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPulse((p) => p + 1), 4500);
    return () => clearInterval(t);
  }, []);
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [bob]);
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -5 + bob.value * 10 }, { rotate: `${-1 + bob.value * 2}deg` }] }));
  return (
    <Animated.View entering={ZoomIn.delay(120).duration(420)} style={bobStyle}>
      <PipeBoard def={level} rot={rot} fv={fv} tile={tile} onTapCell={() => {}} hintIndex={null} winPulse={pulse} interactive={false} />
    </Animated.View>
  );
}

/** Round steel icon button with a label — secondary actions on the title screen. */
function RoundButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const p = useSharedValue(0);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: 1 - p.value * 0.08 }] }));
  return (
    <Pressable
      onPressIn={() => (p.value = withTiming(1, { duration: 80 }))}
      onPressOut={() => (p.value = withSpring(0, springs.press))}
      onPress={() => { feedback("tap", "light"); onPress(); }}
      hitSlop={8}
      style={styles.round}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View style={st}>
        <SteelPlate style={styles.roundFace} radius={30}>
          <Icon name={icon} size={26} color={palette.ink} />
        </SteelPlate>
      </Animated.View>
      <Text style={styles.roundLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hud: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14 },
  logoWrap: { marginTop: 4, alignItems: "center" },
  heroArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  bottom: { paddingHorizontal: 20, gap: 14 },
  chapterCard: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  chapterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chapterLabel: { fontFamily: fonts.display, fontSize: 17, color: palette.ink, flexShrink: 1 },
  chapterCount: { ...type.hud, color: palette.accent },
  progressTrack: { height: 14, overflow: "hidden", justifyContent: "center" },
  progressFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 6 },
  iconRow: { flexDirection: "row", justifyContent: "center", gap: 32 },
  round: { alignItems: "center", gap: 4 },
  roundFace: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
  roundLabel: { fontFamily: fonts.medium, fontSize: 13, color: palette.inkSoft },
});
