import { useState } from "react";
import { HomeScreen } from "./screens/HomeScreen";
import { LevelsScreen } from "./screens/LevelsScreen";
import { GameScreen } from "./screens/GameScreen";
import { LEVELS } from "./game/levels";
import { isWon } from "./game/engine";
import { store } from "./modules/store";

/**
 * Screenshot mode: the factory opens the app with <scheme>://shot/<id> on an
 * emulator and captures the screen for the Play Store listing. Every scene
 * renders a REAL state of Flow Forge through the real screens — a nearly-solved
 * board in the steel-and-teal workshop, the win summary, and the
 * level map with progress. Ads are off here.
 */
const noop = () => {};

/** Fully routed board — only used under the win summary (the level is over). */
const solved = (n: number) => ({ rot: LEVELS[n - 1].solution.slice() });
/**
 * `taps` route pipes turned back one step, so each is exactly ONE tap from
 * home: fluid flows up to each gap and the board is 1-2 taps from solved.
 * The move counter shows par minus the taps still to go — never a finished
 * board with moves left over.
 */
const nearly = (n: number, taps: 1 | 2) => {
  const l = LEVELS[n - 1];
  const r = l.solution.slice();
  // Pipes ON the route (turning a decoy would leave the board solved).
  const onRoute = l.rotatable.filter((k) => {
    const t = r.slice();
    t[k] = (t[k] + 3) % 4;
    return !isWon(l, t);
  });
  const picks = taps === 1 ? [0.5] : [0.3, 0.75];
  let turned = 0;
  for (const f of picks) {
    const i = onRoute[Math.floor(onRoute.length * f)];
    if (i == null || r[i] !== l.solution[i]) continue;
    r[i] = (r[i] + 3) % 4;
    turned++;
  }
  return { rot: r, moves: Math.max(0, l.par - turned) };
};

export function ScreenshotScene({ id }: { id: string }) {
  // A player mid-campaign: wrenches earned, coins banked, tutorial behind them.
  useState(() => {
    const stars: Record<string, number> = {};
    LEVELS.slice(0, 22).forEach((l, i) => (stars[l.id] = i % 3 === 0 ? 2 : 3));
    store.set({ level: 23, coins: 2480, stars, tutorialDone: true });
    return true;
  });
  const game = (level: number, demo: { rot?: number[]; win?: boolean; moves?: number }) => (
    <GameScreen levelNumber={level} onExit={noop} onSettings={noop} onNextLevel={noop} demo={demo} />
  );
  switch (id) {
    case "solve":
      return game(6, nearly(6, 1)); // Workshop — one turn from flowing
    case "two":
      return game(21, nearly(21, 1)); // Color Lab — two fluids braided over two overpasses
    case "hard":
      return game(29, nearly(29, 2)); // Refinery — three fluids, two turns from done
    case "win":
      return game(30, { ...solved(30), win: true }); // Refinery finale — win summary
    case "map":
      return <LevelsScreen onPlay={noop} onBack={noop} />;
    case "home":
    default:
      return <HomeScreen onPlay={noop} onLevels={noop} onShop={noop} onSettings={noop} />;
  }
}
