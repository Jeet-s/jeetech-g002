import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Background, Confetti, FailPopup, FloatingText, GameButton, HudBar, Icon, SteelPlate, TutorialHand, WinPopup, feedback, fonts, motion, palette, type, useShake,
} from "../ui";
import { LEVELS, movesAllowed, starsFor } from "../game/levels";
import { flow, tapsBetween } from "../game/engine";
import { PipeBoard, boardChrome, boardView } from "../game/PipeBoard";
import { goalFor, routeOf } from "../game/board";
import { DESIGNS } from "../game/designs";
import { store } from "../modules/store";
import { ads } from "../modules/ads";
import { analytics } from "../modules/analytics";
import { useBannerHeight } from "../modules/layout";

/** One Flow Forge level: rotate pipes to route every fluid to its drain. */
export function GameScreen({ levelNumber, onExit, onSettings, onNextLevel, demo }: {
  levelNumber: number; onExit: () => void; onSettings: () => void; onNextLevel: (n: number) => void;
  /** Screenshot mode: show a fixed rotation state, optionally with the win popup. */
  demo?: { rot?: number[]; win?: boolean; moves?: number };
}) {
  const level = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelNumber - 1))];
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bannerH = useBannerHeight();

  const [rot, setRot] = useState<number[]>(() => level.cells.map((c) => c.r));
  // Mirror of `rot` read synchronously by tap() so back-to-back press-ins (the
  // board spins optimistically on touch) never act on a stale rotation.
  const rotRef = useRef<number[]>(rot);
  const [history, setHistory] = useState<number[][]>([]);
  const [moves, setMoves] = useState(0);
  const [result, setResult] = useState<"win" | "fail" | null>(null);
  const [hintIdx, setHintIdx] = useState<number | null>(null);
  const [floater, setFloater] = useState(0);
  const [winPulse, setWinPulse] = useState(0);
  const [area, setArea] = useState({ y: 0, h: 0 });
  const [hints, setHints] = useState(store.get().hints ?? 3);
  const [failing, setFailing] = useState(false);
  const { style: shakeStyle, shake } = useShake(12);
  // Fail beat: the playfield dims and an "Out of moves" banner slams in before the popup.
  const failDim = useSharedValue(0);
  const failDimStyle = useAnimatedStyle(() => ({ opacity: failDim.value }));
  const failBanner = useSharedValue(0);
  const failBannerStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, failBanner.value * 1.5),
    transform: [{ scale: 1.25 - 0.25 * failBanner.value }, { rotate: `${(1 - failBanner.value) * -4}deg` }],
  }));
  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  // Board drop-in (220 ms ease) each time a level opens.
  const drop = useSharedValue(0);
  const dropStyle = useAnimatedStyle(() => ({
    opacity: drop.value,
    transform: [{ translateY: (1 - drop.value) * -28 }, { scale: 0.96 + drop.value * 0.04 }],
  }));

  // Track deferred callbacks so they're cancelled if the screen unmounts mid
  // animation (e.g. the player leaves a level before the win/fail delay fires) —
  // otherwise the pending closures linger and setState runs on an unmounted tree.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current = []; }, []);

  const budget = movesAllowed(level);
  const stars = starsFor(moves, level.par);
  const reward = 15 + stars * 15;
  const fv = useMemo(() => flow(level, rot), [level, rot]);

  // Fit the board into the space between the HUD and the controls with
  // whole-pixel tiles. Only the window of the grid that holds pieces is framed;
  // the tray bezel + inner well (boardChrome) are folded in on both sides.
  const view = useMemo(() => boardView(level), [level]);
  const availW = width - 16;
  const availH = area.h - 8;
  const tile = useMemo(() => {
    let t = Math.floor(Math.min(availW / view.cols, availH / view.rows, 118));
    while (t > 34) {
      const e = boardChrome(t).edge * 2;
      if (t * view.cols + e <= availW && t * view.rows + e <= availH) break;
      t--;
    }
    return Math.max(34, t);
  }, [availW, availH, view]);

  useEffect(() => {
    const start = level.cells.map((c) => c.r);
    rotRef.current = start;
    setRot(start); setHistory([]); setMoves(0); setResult(null); setHintIdx(null); setWinPulse(0);
    failDim.value = 0; failBanner.value = 0;
    analytics.track("level_start", { level: level.number });
    drop.value = 0;
    drop.value = withTiming(1, { duration: motion.boardDrop, easing: Easing.out(Easing.cubic) });
    if (demo?.rot) {
      rotRef.current = demo.rot;
      setRot(demo.rot);
      setMoves(demo.moves ?? level.par);
      if (demo.win) later(() => { setWinPulse(1); setResult("win"); }, 350);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, demo]);

  function finishWin(usedMoves: number) {
    setWinPulse((w) => w + 1);
    setFloater((f) => f + 1);
    flash.value = withSequence(withDelay(220, withTiming(0.4, { duration: 90 })), withTiming(0, { duration: 460 }));
    feedback("success", "success");
    const first = level.number === 1 && !store.get().tutorialDone;
    // Earnable hints: +1 free hint for every 5 levels solved (first clear only).
    if (level.number % 5 === 0 && store.get().level <= level.number && !demo) {
      const h = (store.get().hints ?? 3) + 1;
      store.set({ hints: h });
      setHints(h);
    }
    later(() => {
      setResult("win");
      const prev = store.get().stars ?? {};
      store.set({
        stars: { ...prev, [level.id]: Math.max(prev[level.id] ?? 0, starsFor(usedMoves, level.par)) },
        coins: store.get().coins + reward,
        level: Math.max(store.get().level, level.number + 1),
        tutorialDone: store.get().tutorialDone || level.number >= 2,
      });
      analytics.track("level_complete", { level: level.number, moves: usedMoves });
      if (first) { store.set({ tutorialDone: true }); analytics.track("tutorial_done", { level: 1 }); }
    }, 1150);
  }

  function tap(i: number) {
    if (result || failing || level.cells[i].f) return;
    const prev = rotRef.current;
    const next = prev.slice();
    next[i] = (next[i] + 1) % 4;
    rotRef.current = next;
    setHistory((h) => [...h, prev]);
    setRot(next);
    setHintIdx(null);
    const used = moves + 1;
    setMoves(used);
    const nf = flow(level, next);
    const won = nf.satisfied.length > 0 && nf.satisfied.every(Boolean);
    if (won) {
      finishWin(used);
    } else {
      // Reward incremental progress: a pleasant chime + haptic the moment a
      // rotation newly connects a drain (satisfying on multi-fluid levels).
      const before = fv.satisfied.filter(Boolean).length;
      const after = nf.satisfied.filter(Boolean).length;
      if (after > before) feedback("pop", "medium");
      if (used >= budget) {
        failLevel();
      }
    }
  }

  function failLevel() {
    setFailing(true);
    shake();
    feedback("error", "error");
    failDim.value = withTiming(0.6, { duration: 200, easing: Easing.out(Easing.quad) });
    failBanner.value = withDelay(120, withTiming(1, { duration: 260, easing: Easing.out(Easing.back(1.8)) }));
    later(() => setResult("fail"), 1050);
    analytics.track("level_fail", { level: level.number });
  }

  function clearFail() {
    setFailing(false);
    failDim.value = withTiming(0, { duration: 220 });
    failBanner.value = withTiming(0, { duration: 160 });
  }

  function undo() {
    if (!history.length || result) return;
    feedback("move", "select");
    const prev = history[history.length - 1];
    rotRef.current = prev;
    setRot(prev);
    setHistory((h) => h.slice(0, -1));
    setMoves((m) => Math.max(0, m - 1));
    setHintIdx(null);
  }

  function restart() {
    feedback("tap", "medium");
    const start = level.cells.map((c) => c.r);
    rotRef.current = start;
    setRot(start); setHistory([]); setMoves(0); setResult(null); setHintIdx(null);
    clearFail();
  }

  // Hint = the mis-rotated pipe that is furthest from lining up (most useful to fix).
  const wrongTile = useMemo(() => {
    let best = -1, bestTaps = 0;
    for (const i of level.rotatable) {
      const t = tapsBetween(level.cells[i].m, rot[i], level.solution[i]);
      if (t > bestTaps) { bestTaps = t; best = i; }
    }
    return best;
  }, [level, rot]);

  function hint() {
    if (wrongTile < 0) return;
    const show = () => { setHintIdx(wrongTile); feedback("pop", "medium"); };
    if (hints > 0) {
      // Spend a banked hint — free, no ad.
      const h = hints - 1;
      setHints(h);
      store.set({ hints: h });
      show();
    } else if (!ads.showRewarded(show)) show();
    analytics.track("hint_view", { level: level.number });
  }

  // Level 1 is GUIDED: a dotted line shows where the water must go, the next
  // pipe on that route glows (and the hand taps it) until every pipe lines up.
  const route = useMemo(() => (level.number === 1 ? routeOf(level) : []), [level]);
  const wrongOnRoute = (r: number[]) => route.filter((i) => !level.cells[i].f && tapsBetween(level.cells[i].m, r[i], level.solution[i]) > 0);
  const startWrong = useMemo(() => wrongOnRoute(level.cells.map((c) => c.r)).length, [level, route]); // eslint-disable-line react-hooks/exhaustive-deps
  const wrongNow = wrongOnRoute(rot);
  const guided = level.number === 1 && !demo && !result && !failing && route.length > 0;
  const guide = guided ? { route, next: wrongNow[0] ?? null, drainPulse: wrongNow.length < startWrong } : null;
  const handTile = guide?.next ?? (level.number === 2 && moves === 0 && !result && !demo ? wrongTile : -1);
  const tileCenter = (i: number) => ({
    x: boardLeft + edge + ((i % level.w) - view.c0) * tile + tile / 2,
    y: boardTop + edge + (Math.floor(i / level.w) - view.r0) * tile + tile / 2,
  });
  // Distance from the framed board's outer edge to the first cell (tray bezel +
  // well). Keeps the tutorial hand and the floater on the real cell centres.
  const { edge } = boardChrome(tile);
  const boardOuter = tile * view.cols + edge * 2;
  const boardH = tile * view.rows + edge * 2;
  const boardLeft = (width - boardOuter) / 2;
  const boardTop = area.y + (area.h - boardH) / 2;

  return (
    <View style={styles.root}>
      <Background />
      <View style={{ paddingTop: insets.top + 4 }}>
        <HudBar
          moves={moves} budget={budget} par={level.par}
          title={`Level ${level.number}`} chapter={level.chapter}
          onBack={onExit} onSettings={onSettings}
        />
      </View>
      {guided ? (
        <SteelPlate style={styles.coach} radius={14} glow>
          <View style={styles.coachIcon}><Icon name="bulb" size={22} color={palette.bgBottom} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.coachTitle} numberOfLines={1} adjustsFontSizeToFit>
              {wrongNow.length ? "Tap the glowing pipe to turn it" : "Connected!"}
            </Text>
            <Text style={styles.coachSub} numberOfLines={2}>
              {wrongNow.length
                ? `Water flows by itself along the dotted line once the pipes line up. ${wrongNow.length} ${wrongNow.length === 1 ? "pipe" : "pipes"} to go.`
                : "The water reached the drain."}
            </Text>
          </View>
        </SteelPlate>
      ) : (
        <Text style={styles.goal} numberOfLines={2}>
          {DESIGNS[level.number - 1]?.hint ?? goalFor(level)}
        </Text>
      )}

      <View style={styles.boardArea} onLayout={(e) => setArea({ y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}>
        {area.h > 0 ? (
          <Animated.View style={[dropStyle, shakeStyle]}>
            <PipeBoard
              def={level}
              rot={rot}
              fv={fv}
              tile={tile}
              onTapCell={tap}
              hintIndex={hintIdx}
              winPulse={winPulse}
              interactive={!result && !failing && !demo}
              guide={guide}
            />
            <Animated.View pointerEvents="none" style={[styles.flash, { borderRadius: edge }, flashStyle]} />
            <Animated.View pointerEvents="none" style={[styles.failDim, { borderRadius: edge }, failDimStyle]} />
          </Animated.View>
        ) : null}
        {failing ? (
          <Animated.View pointerEvents="none" style={[styles.failBanner, failBannerStyle]}>
            <Icon name="moves" size={26} color={palette.ink} stroke={2.6} />
            <Text style={styles.failText}>Out of moves!</Text>
          </Animated.View>
        ) : null}
      </View>

      {handTile >= 0 && area.h > 0 ? <TutorialHand key={handTile} from={tileCenter(handTile)} /> : null}
      {floater ? (
        <FloatingText key={floater} text="Flow complete!" color={palette.accent} x={width / 2} y={boardTop - 6} duration={1500} />
      ) : null}
      <Confetti trigger={winPulse} count={70} origin={{ x: width / 2, y: area.y + area.h / 2 }} />

      <View style={[styles.actions, { paddingBottom: insets.bottom + bannerH + 12 }]}>
        <GameButton style={{ flex: 1 }} size="md" variant="tertiary" icon="undo" label="Undo" onPress={undo} disabled={!history.length} />
        <GameButton style={{ flex: 1 }} size="md" variant="secondary" icon="restart" label="Restart" onPress={restart} />
        <GameButton style={{ flex: 1.2 }} size="md" variant="primary" icon="bulb" label="Hint" badge={hints > 0 ? hints : "▶"} onPress={hint} disabled={wrongTile < 0 || !!result} />
      </View>

      <WinPopup
        visible={result === "win"}
        stars={stars}
        coins={reward}
        title={level.number >= LEVELS.length ? "Refinery Mastered!" : "Flow Complete!"}
        onNext={() => { ads.showInterstitial(); onNextLevel(Math.min(LEVELS.length, level.number + 1)); }}
        onReplay={restart}
        onMap={onExit}
      />
      <FailPopup
        visible={result === "fail"}
        message="Out of moves! Reroute and try again."
        onRetry={restart}
        onContinue={() => ads.showRewarded(() => { setResult(null); clearFail(); setMoves((m) => Math.max(0, m - 6)); })}
        onMap={onExit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  goal: { ...type.body, fontSize: 15, lineHeight: 20, color: palette.inkSoft, textAlign: "center", marginTop: 8, paddingHorizontal: 24 },
  boardArea: { flex: 1, justifyContent: "center", alignItems: "center" },
  flash: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: "#FFFFFF" },
  failDim: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: "#05090D" },
  failBanner: {
    position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 24, height: 64, borderRadius: 18, backgroundColor: palette.dangerDark,
    borderWidth: 2, borderColor: "#FFB0A8", shadowColor: palette.danger, shadowOpacity: 0.7, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 18,
  },
  failText: { fontFamily: fonts.display, fontSize: 26, color: palette.ink, includeFontPadding: false, textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 4 },
  coach: { marginHorizontal: 12, marginTop: 8, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  coachIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.accent, alignItems: "center", justifyContent: "center" },
  coachTitle: { fontFamily: fonts.display, fontSize: 18, color: palette.ink, includeFontPadding: false },
  coachSub: { ...type.body, fontSize: 14, lineHeight: 18, color: palette.inkSoft },
  actions: { flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingTop: 6 },
});
