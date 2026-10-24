import { useState } from "react";
import { HomeScreen } from "./screens/HomeScreen";
import { LevelsScreen } from "./screens/LevelsScreen";
import { GameScreen } from "./screens/GameScreen";
import { LEVELS } from "./game/levels";
import { isWon, turn } from "./game/engine";
import { store } from "./modules/store";
import { CHAPTER_INFO, STAR_GOALS, dayKey } from "./game/meta";

/**
 * Screenshot mode: the factory opens the app with <scheme>://shot/<id> (iOS: -AGFShot <id>) and captures the
 * screen for the store listing. Every scene renders a REAL state of Flow Forge through the real screens — a
 * board a turn or two from flowing in each chapter's workshop, the win summary and the level map. Ads are off.
 */
const noop = () => {};

/** Fully routed board — only used under the win summary (the level is over). */
const solved = (n: number) => ({ rot: LEVELS[n - 1].solution.slice() });
/**
 * `taps` tap targets (a loose pipe or a whole gear group) turned back one step from the solved board, so each
 * is exactly ONE tap from home: fluid flows up to each gap and the board is 1-2 taps from solved. The move
 * counter shows par minus the taps still to go — never a finished board with moves left over.
 */
const nearly = (n: number, taps: 1 | 2) => {
  const l = LEVELS[n - 1];
  const back = (r: number[], i: number) => turn(l, turn(l, turn(l, r, i), i), i); // three quarter turns = one back
  // Targets ON the route (turning a decoy back would leave the board solved).
  const onRoute = l.taps.filter((i) => !isWon(l, back(l.solution, i)));
  const picks = taps === 1 ? [0.5] : [0.3, 0.75];
  let r = l.solution.slice();
  const used = new Set<number>();
  for (const f of picks) {
    const i = onRoute[Math.floor(onRoute.length * f)];
    if (i == null || used.has(i)) continue;
    used.add(i);
    r = back(r, i);
  }
  return { rot: r, moves: Math.max(0, l.par - used.size) };
};

/** A player deep in the campaign: stars on every cleared level, gear tokens banked, tutorial behind them. */
function progress(level: number) {
  const stars: Record<string, number> = {};
  LEVELS.slice(0, level - 1).forEach((l, i) => (stars[l.id] = i % 4 === 1 ? 2 : 3));
  // Meta: a 6-day daily streak still alive (today's board waiting), a Forge Token for every finished chapter,
  // the star goals they've passed collected.
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const claimedChapters = CHAPTER_INFO.filter((c) => c.last < level).map((c) => c.index);
  const have = Object.values(stars).reduce((a, b) => a + b, 0);
  const claimedStarGoals = STAR_GOALS.map((g, i) => (g <= have ? i : -1)).filter((i) => i >= 0);
  store.set({
    level, coins: 2480, stars, tutorialDone: true, hints: 4, wrenches: 3, extraMoves: 2,
    dailyDay: dayKey(y), streak: 6, bestStreak: 9, dailyWins: 21, claimedChapters, claimedStarGoals,
  });
}

export function ScreenshotScene({ id }: { id: string }) {
  useState(() => {
    progress(id === "map" ? 34 : id === "home" ? 41 : 55);
    return true;
  });
  const game = (level: number, demo: { rot?: number[]; win?: boolean; moves?: number }) => (
    <GameScreen levelNumber={level} onExit={noop} onSettings={noop} onNextLevel={noop} demo={demo} />
  );
  switch (id) {
    case "solve":
      return game(29, nearly(29, 1)); // Refinery Riddles — three fluids, one turn from flowing
    case "filters":
      return game(36, nearly(36, 2)); // Filter Works — colour filters sort three fluids
    case "gears":
      return game(42, nearly(42, 1)); // Gearworks — two gear groups turning together
    case "win":
      return game(54, { ...solved(54), win: true }); // Night Shift — the 5x5 blend finale, win summary
    case "map":
      return <LevelsScreen onPlay={noop} onBack={noop} />;
    case "home":
    default:
      return <HomeScreen onPlay={noop} onLevels={noop} onShop={noop} onSettings={noop} onDaily={noop} />;
  }
}
