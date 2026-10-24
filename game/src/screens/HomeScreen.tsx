import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing, FadeInDown, FadeInUp, ZoomIn, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from "react-native-reanimated";
import { Background, CurrencyPill, ForgePopup, GameButton, Icon, NineSlice, SteelPlate, Well, feedback, fonts, palette, springs, type, type IconName } from "../ui";
import { CHAPTER_INFO, dailyDoneToday, liveStreak, nextStarGoal, tokensCollected, unclaimedChapters } from "../game/meta";
import { store } from "../modules/store";
import { LEVELS } from "../game/levels";
import { CHAPTERS } from "../game/designs";
import { useBannerHeight } from "../modules/layout";
import { art } from "../art";
import { sprites } from "../sprites";

/** assets/art/logo.png is 900x564; the hero key art is 401x512. */
const LOGO_ASPECT = 564 / 900;
const HERO_ASPECT = 512 / 401;

/**
 * HOME = Flow Forge's title screen (target: .agf/art/target_home.png): stars + gear tokens → the illustrated logo →
 * the hero key art (the valve manifold) breathing in the workshop light, its fluids sparkling → chapter progress →
 * ONE big "Play · Level N" → Levels / Shop / Settings.
 */
export function HomeScreen({ onPlay, onLevels, onShop, onSettings, onDaily }: {
  onPlay: (levelNumber: number) => void; onLevels: () => void; onShop: () => void; onSettings: () => void;
  /** Today's Daily Pipework board. */
  onDaily: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const logoW = Math.floor(Math.min(winW * 0.84, 440, (winH * (winH < 700 ? 0.15 : 0.18)) / LOGO_ASPECT));
  const bannerH = useBannerHeight();
  // Short phones (720x1280 = 360x640 dp): tighter bottom stack so the hero keeps its stage.
  const compact = winH < 700;
  const [s, setS] = useState(store.get());
  useEffect(() => store.subscribe(setS), []);
  const current = Math.min(LEVELS.length, Math.max(1, s.level));
  const allDone = s.level > LEVELS.length;
  const chapter = LEVELS[current - 1]?.chapter ?? "";
  const chapterNo = CHAPTERS.indexOf(chapter) + 1;
  const inChapter = LEVELS.filter((l) => l.chapter === chapter);
  const doneInChapter = inChapter.filter((l) => l.number < current || allDone).length;
  const stars = s.stars ?? {};
  const totalStars = Object.values(stars).reduce((a, b) => a + b, 0);
  const chapterStars = inChapter.reduce((a, l) => a + (stars[l.id] ?? 0), 0);

  // Idle life: the logo floats, the Play button breathes.
  const float = useSharedValue(0);
  const breathe = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }), -1, true);
    breathe.value = withDelay(900, withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })), -1));
  }, [float, breathe]);
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -4 + float.value * 8 }, { rotate: `${-0.6 + float.value * 1.2}deg` }] }));
  const playStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breathe.value * 0.035 }] }));

  const [hero, setHero] = useState({ w: 0, h: 0 });
  const [forge, setForge] = useState(false);
  // Meta strip: today's daily + streak, the next star goal, the Forge Token collection.
  const streak = liveStreak(s);
  const dailyDone = dailyDoneToday(s);
  const goal = nextStarGoal(s);
  const tokensReady = unclaimedChapters(s).length;
  return (
    <View style={styles.root}>
      <Background chapter={Math.max(0, chapterNo - 1)} />

      <View style={[styles.hud, { paddingTop: insets.top + 8 }]}>
        {/* Stars open Forge Progress (star goals, tokens, daily) — the progression screen. */}
        <Pressable onPress={() => { feedback("tap", "light"); setForge(true); }} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${totalStars} stars, open progress`}>
          <CurrencyPill icon="star" value={totalStars} />
        </Pressable>
        <CurrencyPill icon="coin" value={s.coins} />
      </View>

      <Animated.View entering={FadeInDown.duration(500)} style={[styles.logoWrap, logoStyle]}>
        <Image
          source={art.logo}
          style={{ width: logoW, height: Math.floor(logoW * LOGO_ASPECT) }}
          resizeMode="contain"
          fadeDuration={0}
          accessibilityRole="header"
          accessibilityLabel="Flow Forge"
        />
      </Animated.View>

      <View style={styles.heroArea} pointerEvents="none" onLayout={(e) => setHero({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {hero.h > 40 ? <HeroArt w={hero.w} h={hero.h} /> : null}
      </View>

      <View style={[styles.bottom, compact && { gap: 8 }, { paddingBottom: insets.bottom + bannerH + (compact ? 8 : 14) }]}>
        <Animated.View entering={FadeInUp.delay(100).duration(450)} style={styles.metaRow}>
          <MetaTile
            compact={compact}
            icon={<Icon name="drop" size={24} color={dailyDone ? palette.success : palette.secondary} />}
            title="Daily"
            sub={dailyDone ? "Cleared" : streak > 0 ? `${streak}-day streak` : "New board"}
            alert={!dailyDone}
            onPress={dailyDone ? () => setForge(true) : onDaily}
          />
          <MetaTile
            compact={compact}
            icon={<Icon name="star" size={24} />}
            title={goal ? `${Math.min(goal.have, goal.target)}/${goal.target}` : "All goals"}
            sub={goal?.ready ? "Claim reward" : "Star goal"}
            alert={!!goal?.ready}
            onPress={() => setForge(true)}
          />
          <MetaTile
            compact={compact}
            icon={<Image source={art.reward_gear_token} style={{ width: 28, height: 28 }} fadeDuration={0} />}
            title={`${tokensCollected(s)}/${CHAPTER_INFO.length}`}
            sub={tokensReady ? "Token ready" : "Forge Tokens"}
            alert={tokensReady > 0}
            onPress={() => setForge(true)}
          />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(150).duration(450)}>
          <SteelPlate style={[styles.chapterCard, compact ? { paddingVertical: 8, gap: 6 } : {}]} radius={14}>
            <View style={styles.chapterRow}>
              <Text style={styles.chapterKicker}>CHAPTER {chapterNo}</Text>
              <Text style={styles.chapterLabel} numberOfLines={1}>{chapter}</Text>
              <View style={styles.chapterStars}>
                <Icon name="star" size={16} />
                <Text style={styles.chapterCount}>{chapterStars}/{inChapter.length * 3}</Text>
              </View>
            </View>
            <Well style={styles.progressTrack} radius={8}>
              <LinearGradient
                colors={["#7BF3FF", palette.primary, palette.primaryDark]}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                style={[styles.progressFill, { width: `${Math.max(8, (doneInChapter / Math.max(1, inChapter.length)) * 100)}%` }]}
              />
              <Text style={styles.progressText}>{doneInChapter}/{inChapter.length} levels</Text>
            </Well>
          </SteelPlate>
        </Animated.View>

        <Animated.View entering={ZoomIn.delay(250).springify()} style={playStyle}>
          <GameButton label={allDone ? `Replay · Level ${LEVELS.length}` : `Play · Level ${current}`} variant="primary" size="lg" icon="play" sound="whoosh" onPress={() => onPlay(current)} />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(350).duration(450)} style={styles.iconRow}>
          <RoundButton compact={compact} icon="map" label="Levels" onPress={onLevels} />
          <RoundButton compact={compact} icon="shop" label="Shop" onPress={onShop} />
          <RoundButton compact={compact} icon="gear" label="Settings" onPress={onSettings} />
        </Animated.View>
      </View>
      <ForgePopup visible={forge} onClose={() => setForge(false)} onDaily={onDaily} />
    </View>
  );
}

/** A twinkle of the sparkle art over the hero's glass pipes. */
function Twinkle({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 900 }), withTiming(0, { duration: 1700 })), -1));
  }, [t, delay]);
  const st = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ scale: 0.4 + t.value * 0.7 }, { rotate: `${t.value * 25}deg` }] }));
  return (
    <Animated.View style={[{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size }, st]}>
      <Image source={art.fx_sparkle_burst} style={{ width: size, height: size }} resizeMode="contain" fadeDuration={0} />
    </Animated.View>
  );
}

/** The key art: the brass valve manifold with its cyan / violet glass pipes, bobbing gently with a warm glow. */
function HeroArt({ w, h }: { w: number; h: number }) {
  const ih = Math.floor(Math.min(h, (w * 0.78) * HERO_ASPECT));
  const iw = Math.floor(ih / HERO_ASPECT);
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [bob]);
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -6 + bob.value * 12 }, { rotate: `${-1 + bob.value * 2}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.55 + bob.value * 0.35, transform: [{ scale: 0.95 + bob.value * 0.08 }] }));
  // Sparkle spots on the glass (fractions of the key art).
  const spots = useMemo(() => [[0.12, 0.42, 0], [0.36, 0.25, 700], [0.3, 0.86, 1400], [0.62, 0.86, 2100], [0.08, 0.58, 2800]], []);
  return (
    <Animated.View entering={ZoomIn.delay(120).duration(420)} style={[{ width: iw, height: ih }, bobStyle]}>
      <Animated.View style={[styles.heroGlow, { width: iw * 1.25, height: iw * 1.25, borderRadius: iw, left: -iw * 0.125, top: ih / 2 - iw * 0.62 }, glowStyle]} />
      <Image source={art.title_hero_key_art} style={{ width: iw, height: ih }} resizeMode="contain" fadeDuration={0} />
      {spots.map(([fx, fy, d], i) => <Twinkle key={i} x={fx * iw} y={fy * ih} size={Math.round(iw * 0.16)} delay={d} />)}
    </Animated.View>
  );
}

/** One meta tile (daily / star goal / tokens): a raised graphite plate; a pulsing amber pip when something waits. */
function MetaTile({ icon, title, sub, alert, onPress, compact }: { icon: React.ReactNode; title: string; sub: string; alert?: boolean; onPress: () => void; compact?: boolean }) {
  const p = useSharedValue(0);
  const pip = useSharedValue(0);
  useEffect(() => {
    pip.value = alert ? withRepeat(withSequence(withTiming(1, { duration: 520 }), withTiming(0, { duration: 520 })), -1) : withTiming(0);
  }, [alert, pip]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: 1 - p.value * 0.05 }, { translateY: p.value * 2 }] }));
  const pipStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pip.value * 0.25 }], opacity: 0.75 + pip.value * 0.25 }));
  return (
    <Pressable
      style={styles.metaTile}
      onPressIn={() => (p.value = withTiming(1, { duration: 80 }))}
      onPressOut={() => (p.value = withSpring(0, springs.press))}
      onPress={() => { feedback("tap", "light"); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={`${title} ${sub}`}
    >
      <Animated.View style={[styles.metaFace, compact && { height: 50 }, st]}>
        <NineSlice source={sprites.button.graphite} w={190} h={256} cap={{ l: 36, t: 36, r: 36, b: 42 }} scale={0.5} style={StyleSheet.absoluteFill} />
        {icon}
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.metaTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{title}</Text>
          <Text style={styles.metaSub} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{sub}</Text>
        </View>
      </Animated.View>
      {alert ? <Animated.View style={[styles.pip, pipStyle]} /> : null}
    </Pressable>
  );
}

/** Square graphite icon button (the button art) with a label — secondary actions on the title screen. */
function RoundButton({ icon, label, onPress, compact }: { icon: IconName; label: string; onPress: () => void; compact?: boolean }) {
  const p = useSharedValue(0);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: 1 - p.value * 0.08 }, { translateY: p.value * 2 }] }));
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
      <Animated.View style={[styles.roundFace, compact && { width: 54, height: 54 }, st]}>
        <NineSlice source={sprites.button.graphite} w={190} h={256} cap={{ l: 36, t: 36, r: 36, b: 42 }} scale={0.6} style={StyleSheet.absoluteFill} />
        <View style={{ marginBottom: 4 }}><Icon name={icon} size={28} color={palette.ink} stroke={2.4} /></View>
      </Animated.View>
      <Text style={styles.roundLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hud: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14 },
  logoWrap: { marginTop: 2, alignItems: "center" },
  heroArea: { flex: 1, alignItems: "center", justifyContent: "center", marginVertical: 4 },
  heroGlow: { position: "absolute", backgroundColor: "rgba(255,178,77,0.16)", shadowColor: "#FFB24D", shadowOpacity: 0.6, shadowRadius: 40, shadowOffset: { width: 0, height: 0 } },
  bottom: { paddingHorizontal: 20, gap: 12, width: "100%", maxWidth: 520, alignSelf: "center" },
  metaRow: { flexDirection: "row", gap: 8 },
  metaTile: { flex: 1 },
  metaFace: { height: 56, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingBottom: 3 },
  metaTitle: { fontFamily: fonts.display, fontSize: 15, color: palette.ink, includeFontPadding: false },
  metaSub: { fontFamily: fonts.medium, fontSize: 11, color: palette.inkSoft, includeFontPadding: false },
  pip: { position: "absolute", top: -4, right: -3, width: 14, height: 14, borderRadius: 7, backgroundColor: palette.secondary, borderWidth: 2, borderColor: palette.ink },
  chapterCard: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chapterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  chapterKicker: { fontFamily: fonts.displayMedium, fontSize: 13, letterSpacing: 0.8, color: palette.secondary, includeFontPadding: false },
  chapterLabel: { fontFamily: fonts.display, fontSize: 17, color: palette.ink, flex: 1, includeFontPadding: false },
  chapterStars: { flexDirection: "row", alignItems: "center", gap: 3 },
  chapterCount: { ...type.number, fontSize: 15, color: palette.ink },
  progressTrack: { height: 22, overflow: "hidden", justifyContent: "center" },
  progressFill: { position: "absolute", left: 3, top: 3, bottom: 3, borderRadius: 6 },
  progressText: { fontFamily: fonts.medium, fontSize: 12, color: palette.ink, textAlign: "center", includeFontPadding: false, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 3 },
  iconRow: { flexDirection: "row", justifyContent: "center", gap: 28 },
  round: { alignItems: "center", gap: 4 },
  roundFace: { width: 62, height: 62, alignItems: "center", justifyContent: "center" },
  roundLabel: { fontFamily: fonts.displayMedium, fontSize: 14, color: palette.inkSoft },
});
