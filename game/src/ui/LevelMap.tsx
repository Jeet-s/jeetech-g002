import { useEffect, useMemo, useRef } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from "react-native-reanimated";
import { MiniStars } from "./Stars";
import { Icon } from "./Icon";
import { SteelPlate } from "./Plate";
import { fonts, motion, palette, type } from "./theme";
import { sprites } from "../sprites";
import { feedback } from "../audio/sfx";

const COLS = 3;
const CARD_GAP = 26;

export interface MapLevel {
  id: string;
  number: number;
  stars: number; // 0-3, -1 = locked
  chapter?: string; // levels are grouped into a card per chapter
}

/** Cyan ring breathing around the current node (1.2 s loop). */
function Pulse({ size }: { size: number }) {
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = withRepeat(withTiming(1, { duration: motion.pulse, easing: Easing.out(Easing.sin) }), -1);
  }, [s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 0.92 + s.value * 0.35 }], opacity: 0.9 * (1 - s.value) }));
  return <Animated.View pointerEvents="none" style={[styles.pulse, { width: size, height: size, borderRadius: size / 2 }, style]} />;
}

/** One level: a glass lens — brimming cyan once cleared, amber under the valve wheel for the next level, dry when locked. */
function MapNode({ level, isCurrent, size, onPress }: { level: MapLevel; isCurrent: boolean; size: number; onPress: () => void }) {
  const press = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + press.value }] }));
  const locked = level.stars < 0;
  const cleared = !locked && !isCurrent;
  const lensH = size, lensW = Math.round(size * (148 / 160));
  const src = locked ? sprites.lens("dry") : isCurrent ? sprites.lens("yellow") : sprites.lens("blue");
  return (
    <Pressable
      disabled={locked}
      onPressIn={() => (press.value = withTiming(-0.07, { duration: 90 }))}
      onPressOut={() => (press.value = withSpring(0, { damping: 6, stiffness: 240, mass: 0.6 }))}
      onPress={onPress}
      hitSlop={6}
      style={{ width: size, height: size + 18, alignItems: "center" }}
      accessibilityRole="button"
      accessibilityLabel={locked ? `Level ${level.number}, locked` : `Level ${level.number}${cleared ? `, ${level.stars} stars` : ""}`}
    >
      <Animated.View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
        {isCurrent ? <Pulse size={size * 1.08} /> : null}
        <View style={[styles.lensShadow, { width: lensW * 0.9, height: lensH * 0.9, borderRadius: lensW }]} />
        <Image source={src} style={{ width: lensW, height: lensH }} resizeMode="contain" fadeDuration={0} />
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.center}>
            {locked ? (
              <Icon name="lock" size={Math.round(size * 0.34)} color="rgba(242,247,255,0.55)" stroke={2.6} />
            ) : (
              <Text style={[styles.num, { fontSize: Math.round(size * 0.36) }]}>{level.number}</Text>
            )}
          </View>
        </View>
        {isCurrent ? (
          <Image source={sprites.valveWheel} style={[styles.wheel, { width: size * 0.78, height: size * 0.78 * (43 / 158), top: -size * 0.1 }]} resizeMode="contain" fadeDuration={0} />
        ) : null}
      </Animated.View>
      {cleared ? <MiniStars count={level.stars} size={14} /> : isCurrent ? <Text style={styles.playTag}>PLAY</Text> : null}
    </Pressable>
  );
}

/** A brass-collared glass pipe joining two lenses; full of fluid once the player has flowed past it. */
function Connector({ x, y, len, thick, vertical, full }: { x: number; y: number; len: number; thick: number; vertical: boolean; full: boolean }) {
  // The baked straight tile carries its tube in the middle 72/192 of its height.
  const h = Math.round((thick * 192) / 72);
  const src = sprites.pipe("straight", full ? "blue" : "dry");
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: x - len / 2, top: y - h / 2, width: len, height: h, transform: vertical ? [{ rotate: "90deg" }] : undefined }}>
      <Image source={src} style={{ width: len, height: h }} resizeMode="stretch" fadeDuration={0} />
    </View>
  );
}

/**
 * The level map: one graphite tray per chapter (title + stars earned), its six levels laid out as a snaking
 * pipe network (left → right, down, right → left) that continues into the next chapter's tray. Cleared lenses
 * brim with cyan and keep their stars, the next level glows amber under a valve wheel, locked ones are dry glass.
 */
export function LevelMap({
  levels,
  current,
  onSelect,
  padTop = 120,
  padBottom = 200,
}: {
  levels: MapLevel[];
  current: number;
  onSelect: (l: MapLevel) => void;
  padTop?: number; // space covered by the HUD
  padBottom?: number; // space covered by the bottom buttons
}) {
  const { width, height: winH } = useWindowDimensions();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const cardW = Math.min(width - 24, 460);
  const pad = 26;
  const node = Math.floor(Math.min(84, (cardW - pad * 2) / (COLS + (COLS - 1) * 0.55)));
  const gapX = Math.floor((cardW - pad * 2 - node * COLS) / (COLS - 1));
  const rowH = node + 18;
  const gapY = Math.round(node * 0.42);

  const chapters = useMemo(() => {
    const out: { name: string; levels: MapLevel[] }[] = [];
    for (const l of levels) {
      const last = out[out.length - 1];
      if (last && last.name === (l.chapter ?? "")) last.levels.push(l);
      else out.push({ name: l.chapter ?? "", levels: [l] });
    }
    return out;
  }, [levels]);
  const rowsOf = (n: number) => Math.ceil(n / COLS);
  const header = 54;
  const cardH = (n: number) => header + rowsOf(n) * rowH + (rowsOf(n) - 1) * gapY + pad;
  const tops = useMemo(() => {
    let y = padTop;
    return chapters.map((c) => { const t = y; y += cardH(c.levels.length) + CARD_GAP; return t; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters, padTop, node]);
  const total = (tops[tops.length - 1] ?? padTop) + cardH(chapters[chapters.length - 1]?.levels.length ?? 0) + padBottom;

  // Node centre inside a card (snake order).
  const slot = (k: number) => {
    const row = Math.floor(k / COLS), pos = k % COLS;
    const col = row % 2 === 0 ? pos : COLS - 1 - pos;
    return { x: pad + col * (node + gapX) + node / 2, y: header + row * (rowH + gapY) + node / 2 };
  };

  useEffect(() => {
    // Bring the current chapter's tray into the visible band.
    const ci = chapters.findIndex((c) => c.levels.some((l) => l.number === current));
    const y = Math.max(0, (tops[ci] ?? 0) - padTop - 12);
    const id = setTimeout(() => scroll.current?.scrollTo({ y: Math.min(y, Math.max(0, total - winH)), animated: false }), 50);
    return () => clearTimeout(id);
  }, [current, chapters, tops, padTop, total, winH]);

  const left = (width - cardW) / 2;
  const thick = Math.round(node * 0.26);
  return (
    <ScrollView ref={scroll} contentContainerStyle={{ height: total }} showsVerticalScrollIndicator={false}>
      {chapters.map((c, ci) => {
        const earned = c.levels.reduce((a, l) => a + Math.max(0, l.stars), 0);
        const open = c.levels[0].stars >= 0;
        const next = chapters[ci + 1];
        return (
          <View key={c.name + ci} style={{ position: "absolute", left, top: tops[ci], width: cardW, height: cardH(c.levels.length) }}>
            {/* the feed pipe into the next chapter's tray */}
            {next ? (() => {
              const a = slot(c.levels.length - 1);
              const y0 = a.y + node / 2, y1 = cardH(c.levels.length) + CARD_GAP + header - node * 0.1;
              return <Connector x={a.x} y={(y0 + y1) / 2} len={y1 - y0 + node * 0.3} thick={thick} vertical full={c.levels[c.levels.length - 1].number < current} />;
            })() : null}
            <SteelPlate glow={open} radius={20} style={StyleSheet.absoluteFill}>
              <View style={[styles.cardHead, { height: header }]}>
                <Text style={styles.kicker}>CHAPTER {ci + 1}</Text>
                <Text style={[styles.cardTitle, !open && { color: palette.inkMuted }]} numberOfLines={1}>{c.name}</Text>
                <View style={styles.cardStars}>
                  <Icon name="star" size={16} />
                  <Text style={styles.cardStarsText}>{earned}/{c.levels.length * 3}</Text>
                </View>
              </View>
            </SteelPlate>
            {c.levels.map((l, k) => {
              if (k === 0) return null;
              const a = slot(k - 1), b = slot(k);
              const vertical = a.x === b.x;
              const len = vertical ? b.y - a.y + node * 0.3 : Math.abs(b.x - a.x) - node * 0.4;
              return <Connector key={`c${l.id}`} x={(a.x + b.x) / 2} y={(a.y + b.y) / 2} len={len} thick={thick} vertical={vertical} full={l.number <= current && c.levels[k - 1].number < current} />;
            })}
            {c.levels.map((l, k) => {
              const p = slot(k);
              return (
                <View key={l.id} style={{ position: "absolute", left: p.x - node / 2, top: p.y - node / 2 }}>
                  <MapNode level={l} isCurrent={l.number === current} size={node} onPress={() => { feedback("pop", "medium"); onSelect(l); }} />
                </View>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  lensShadow: { position: "absolute", top: "12%", backgroundColor: "rgba(0,0,0,0.45)" },
  num: { ...type.number, color: palette.ink, includeFontPadding: false, textShadowColor: "rgba(0,0,0,0.7)", textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },
  wheel: { position: "absolute" },
  pulse: { position: "absolute", borderWidth: 3, borderColor: palette.secondary, backgroundColor: "rgba(255,178,77,0.12)" },
  playTag: { fontFamily: fonts.display, fontSize: 12, letterSpacing: 1, color: palette.secondary, marginTop: 3 },
  cardHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, gap: 8 },
  kicker: { fontFamily: fonts.displayMedium, fontSize: 12, letterSpacing: 0.8, color: palette.secondary, includeFontPadding: false },
  cardTitle: { fontFamily: fonts.display, fontSize: 18, color: palette.ink, flex: 1, includeFontPadding: false },
  cardStars: { flexDirection: "row", alignItems: "center", gap: 3 },
  cardStarsText: { ...type.number, fontSize: 14, color: palette.ink },
});
