import { useEffect, useMemo, useRef } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Canvas, DashPathEffect, Path, Skia } from "@shopify/react-native-skia";
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withRepeat, withSpring, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { MiniStars } from "./Stars";
import { Icon } from "./Icon";
import { SteelPlate } from "./Plate";
import { fonts, motion, palette, shadow, type } from "./theme";
import { art } from "../art";
import { feedback } from "../audio/sfx";

const NODE = 84; // 20% larger than before — easy 48dp+ targets
const GAP = 124;
const BANNER_GAP = 80; // extra room where a chapter starts, so its banner never covers a node
const MILESTONE = 5; // every 5th level is a milestone node
const FLOW_PERIOD = 64; // dash + gap length of the flowing light

export interface MapLevel {
  id: string;
  number: number;
  stars: number; // 0-3, -1 = locked
  chapter?: string; // shown as a banner where it changes
}

/** Cyan ring breathing around the current node (1.2 s loop). */
function Pulse() {
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = withRepeat(withTiming(1, { duration: motion.pulse, easing: Easing.out(Easing.sin) }), -1);
  }, [s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + s.value * 0.4 }], opacity: 0.85 * (1 - s.value) }));
  return <Animated.View pointerEvents="none" style={[styles.pulse, style]} />;
}

/** A single level node — presses in instantly then springs back with a soft overshoot. */
function MapNode({ locked, isCurrent, stars, number, left, top, onPress }: {
  locked: boolean; isCurrent: boolean; stars: number; number: number; left: number; top: number; onPress: () => void;
}) {
  const press = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + press.value }] }));
  const milestone = number % MILESTONE === 0;
  const cleared = !locked && !isCurrent;
  const face: [string, string] = locked ? ["#2A3640", "#18232C"] : isCurrent ? ["#F0A05A", palette.primary] : ["#5A6C78", "#2E3C46"];
  return (
    <Pressable
      disabled={locked}
      onPressIn={() => (press.value = withTiming(-0.06, { duration: 90 }))}
      onPressOut={() => (press.value = withSpring(0, { damping: 6, stiffness: 240, mass: 0.6 }))}
      onPress={onPress}
      style={{ position: "absolute", left, top, width: NODE }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={locked ? `Level ${number}, locked` : `Level ${number}${cleared ? `, ${stars} stars` : ""}`}
    >
      <Animated.View style={[styles.nodeInner, style]}>
        {isCurrent ? <Pulse /> : null}
        {milestone ? (
          <View style={[styles.milestoneRing, { borderColor: locked ? "rgba(142,167,178,0.25)" : palette.star, opacity: locked ? 1 : 0.9 }]} />
        ) : null}
        <View style={[styles.lip, { backgroundColor: locked ? "#0B1218" : isCurrent ? palette.primaryDark : "#151F27" }]} />
        <LinearGradient colors={face} style={[styles.node, shadow, { borderColor: locked ? "rgba(142,167,178,0.2)" : isCurrent ? "#FFD1A6" : cleared ? "rgba(46,196,255,0.7)" : palette.rim }]}>
          <View style={styles.nodeShine} />
          {locked ? (
            <Icon name="lock" size={30} color="rgba(142,167,178,0.6)" />
          ) : (
            <Text style={[styles.num, { color: palette.ink }]}>{number}</Text>
          )}
        </LinearGradient>
        {milestone ? (
          <View style={[styles.badge, locked && { opacity: 0.55 }]}>
            <Image source={art.icon_reward_wrench} style={styles.badgeIcon} resizeMode="contain" fadeDuration={0} />
          </View>
        ) : null}
        {cleared ? <MiniStars count={stars} size={15} /> : null}
      </Animated.View>
    </Pressable>
  );
}

/**
 * Winding level map (bottom = level 1) on the workshop floor: the trail is a
 * steel pipe, and a cyan light flows along the stretch the player has already
 * cleared. Cleared nodes keep their earned stars, the current node pulses,
 * every 5th level is a milestone with a wrench badge, future ones are locked.
 */
export function LevelMap({
  levels,
  current,
  onSelect,
  header,
  padTop = 120,
  padBottom = 200,
}: {
  levels: MapLevel[];
  current: number;
  onSelect: (l: MapLevel) => void;
  header?: React.ReactNode;
  padTop?: number; // space covered by the HUD
  padBottom?: number; // space covered by the bottom buttons
}) {
  const { width, height: winH } = useWindowDimensions();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const { pos, height } = useMemo(() => {
    let up = 0;
    const offs = levels.map((l, i) => {
      if (i > 0) up += GAP;
      if (l.chapter && l.chapter !== levels[i - 1]?.chapter) up += BANNER_GAP;
      return up;
    });
    const h = padBottom + NODE / 2 + up + NODE / 2 + padTop;
    return {
      height: Math.max(h, winH),
      pos: offs.map((o, i) => ({ x: width / 2 + Math.sin(i * 0.9) * (width * 0.26), y: Math.max(h, winH) - padBottom - NODE / 2 - o })),
    };
  }, [levels, width, winH, padTop, padBottom]);
  const trail = (upto: number) => {
    const b = Skia.PathBuilder.Make();
    pos.slice(0, upto).forEach((q, i) => {
      if (i === 0) b.moveTo(q.x, q.y);
      else {
        const prev = pos[i - 1];
        b.cubicTo(prev.x, prev.y - GAP / 2, q.x, q.y + GAP / 2, q.x, q.y);
      }
    });
    return b.detach();
  };
  const path = useMemo(() => trail(pos.length), [pos]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = useMemo(() => trail(Math.max(1, Math.min(pos.length, current))), [pos, current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flowing light: dash phase runs backwards so light travels from level 1 upward.
  const flow = useSharedValue(0);
  useEffect(() => {
    flow.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1);
  }, [flow]);
  const phase = useDerivedValue(() => -flow.value * FLOW_PERIOD);

  useEffect(() => {
    // Centre the current level in the visible band between the HUD and the bottom buttons.
    const y = pos[Math.max(0, current - 1)]?.y ?? 0;
    const target = Math.min(height - winH, Math.max(0, y - (padTop + (winH - padTop - padBottom) / 2)));
    const id = setTimeout(() => scroll.current?.scrollTo({ y: target, animated: false }), 50);
    return () => clearTimeout(id);
  }, [current, pos, height, winH, padTop, padBottom]);

  return (
    <ScrollView ref={scroll} contentContainerStyle={{ height }} showsVerticalScrollIndicator={false}>
      {header}
      <Canvas style={{ position: "absolute", left: 0, top: 0, width, height }} pointerEvents="none">
        {/* steel pipe trail: soft occlusion → dark casing → satin body → top highlight, with collar joints */}
        <Path path={path} style="stroke" strokeWidth={32} color="rgba(0,0,0,0.12)" strokeCap="round" />
        <Path path={path} style="stroke" strokeWidth={26} color="rgba(0,0,0,0.2)" strokeCap="round" />
        <Path path={path} style="stroke" strokeWidth={20} color="#1A252D" strokeCap="round" />
        <Path path={path} style="stroke" strokeWidth={15} color="#3E4E59" strokeCap="round" />
        <Path path={path} style="stroke" strokeWidth={4} color="rgba(200,225,235,0.28)" strokeCap="round" />
        <Path path={path} style="stroke" strokeWidth={22} color="#56687480" strokeCap="butt">
          <DashPathEffect intervals={[4, 38]} />
        </Path>
        {/* cleared stretch: luminous cyan core with a flowing light */}
        <Path path={done} style="stroke" strokeWidth={14} color="rgba(46,196,255,0.12)" strokeCap="round" />
        <Path path={done} style="stroke" strokeWidth={9} color="rgba(46,196,255,0.22)" strokeCap="round" />
        <Path path={done} style="stroke" strokeWidth={5} color="#1C7FA6" strokeCap="round" />
        <Path path={done} style="stroke" strokeWidth={5} color="#9BE6FF" strokeCap="round">
          <DashPathEffect intervals={[16, FLOW_PERIOD - 16]} phase={phase} />
        </Path>
      </Canvas>
      {levels.map((l, i) => {
        const locked = l.stars < 0;
        const isCurrent = l.number === current;
        const showBanner = l.chapter && l.chapter !== levels[i - 1]?.chapter;
        return (
          <View key={l.id}>
            {showBanner ? (
              <SteelPlate glow style={[styles.banner, { top: pos[i].y + NODE / 2 + (GAP + BANNER_GAP - NODE) / 2 - 24 }]}>
                <Text style={styles.bannerText} numberOfLines={1}>{l.chapter}</Text>
              </SteelPlate>
            ) : null}
            <MapNode
              locked={locked}
              isCurrent={isCurrent}
              stars={l.stars}
              number={l.number}
              left={pos[i].x - NODE / 2}
              top={pos[i].y - NODE / 2}
              onPress={() => {
                feedback("pop", "medium");
                onSelect(l);
              }}
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  nodeInner: { width: NODE, alignItems: "center" },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: "center", justifyContent: "center", borderWidth: 3, overflow: "hidden" },
  nodeShine: { position: "absolute", top: 5, left: 14, right: 14, height: NODE * 0.32, borderRadius: NODE, backgroundColor: "rgba(255,255,255,0.14)" },
  lip: { position: "absolute", top: 6, width: NODE, height: NODE, borderRadius: NODE / 2 },
  milestoneRing: { position: "absolute", top: -7, width: NODE + 14, height: NODE + 14, borderRadius: (NODE + 14) / 2, borderWidth: 3, borderStyle: "dashed" },
  badge: {
    position: "absolute", top: -10, right: -12, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "#1B2731", borderWidth: 2, borderColor: palette.star, ...shadow, elevation: 12,
  },
  badgeIcon: { width: 22, height: 22 },
  num: { ...type.number, fontSize: 30, letterSpacing: -0.3, textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  pulse: { position: "absolute", width: NODE + 20, height: NODE + 20, top: -10, borderRadius: (NODE + 20) / 2, borderWidth: 4, borderColor: palette.accent, backgroundColor: "rgba(46,196,255,0.12)" },
  banner: { position: "absolute", alignSelf: "center", paddingHorizontal: 24, height: 48, justifyContent: "center", borderRadius: 14 },
  bannerText: { fontFamily: fonts.displayMedium, fontSize: 20, letterSpacing: -0.2, color: palette.ink },
});
