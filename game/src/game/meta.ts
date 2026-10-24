/**
 * Flow Forge — the progression layer players come back for (all rewards fixed and shown up front, never random):
 *
 *  DAILY PIPEWORK — one remixed board a day: a campaign network (one the player has reached) with every pipe
 *    re-scrambled from a date seed, so it is a fresh start state with a known solution. Clearing it pays coins
 *    that grow with the streak; every 7th day in a row adds a Wrench.
 *  STREAK — consecutive days with the daily cleared (kept alive until a whole day is missed).
 *  CHAPTER REWARDS — finishing a chapter's last level unlocks its Forge Token (the collection on Home:
 *    tokens / chapters) plus coins and a booster.
 *  STAR GOALS — star milestones across the campaign, each with its own reward.
 *
 * Save compatibility: everything lives in new optional PlayerState fields; campaign progress is untouched.
 */
import { LEVELS } from "./levels";
import { CHAPTERS } from "./designs";
import { isWon, type LevelDef } from "./engine";
import type { PlayerState } from "../modules/store";

// ---- Calendar ---------------------------------------------------------------
/** Local calendar day as YYYY-MM-DD. */
export function dayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function dayBefore(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

// ---- Streak -----------------------------------------------------------------
/** The streak as it stands today: alive if the daily was cleared today or yesterday, else 0. */
export function liveStreak(s: PlayerState, today = dayKey()): number {
  if (!s.dailyDay) return 0;
  return s.dailyDay === today || s.dailyDay === dayBefore(today) ? s.streak ?? 0 : 0;
}
export const dailyDoneToday = (s: PlayerState, today = dayKey()) => s.dailyDay === today;

/** Reward for clearing the daily on a streak of `streak` days (including today). */
export function dailyReward(streak: number): { coins: number; wrench: boolean } {
  return { coins: 40 + 10 * Math.min(Math.max(1, streak), 7), wrench: streak > 0 && streak % 7 === 0 };
}

/** Store patch for clearing today's daily (idempotent within a day). */
export function completeDaily(s: PlayerState, today = dayKey()): { patch: Partial<PlayerState>; streak: number; reward: { coins: number; wrench: boolean } } | null {
  if (s.dailyDay === today) return null;
  const streak = s.dailyDay === dayBefore(today) ? (s.streak ?? 0) + 1 : 1;
  const reward = dailyReward(streak);
  return {
    streak,
    reward,
    patch: {
      dailyDay: today,
      streak,
      bestStreak: Math.max(s.bestStreak ?? 0, streak),
      dailyWins: (s.dailyWins ?? 0) + 1,
      coins: s.coins + reward.coins,
      ...(reward.wrench ? { wrenches: (s.wrenches ?? 0) + 1 } : {}),
    },
  };
}

// ---- Daily board --------------------------------------------------------------
/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Today's daily board: a campaign network the player has already reached (never a tutorial level), every
 * route pipe re-scrambled from the date seed. Decoys keep their resting angle so each network's trick survives.
 * The move budget is the scramble's tap count plus a fair margin — a daily rewards showing up, not grinding.
 */
export function dailyLevel(reached: number, today = dayKey()): LevelDef {
  const hi = Math.max(12, Math.min(LEVELS.length, reached));
  const lo = 6;
  const r = rng(hash(`flowforge-daily-${today}`));
  const base = LEVELS[lo - 1 + Math.floor(r() * (hi - lo + 1))];
  for (let attempt = 0; ; attempt++) {
    const start = base.solution.slice();
    let par = 0;
    for (const i of base.taps) {
      const cell = base.cells[i];
      const group = cell.k === undefined ? [i] : base.groups[cell.k];
      // Route pipes start wrong in the campaign; decoys start at rest (r = 0) and stay that way.
      if (group.every((j) => base.cells[j].r === 0)) continue;
      const span = cell.k === undefined ? cell.o : 4;
      if (span < 2) continue;
      const k = 1 + Math.floor(r() * (span - 1)); // taps back to the solution: always at least one
      for (const j of group) start[j] = (4 - k) % 4;
      par += k;
    }
    const cells = base.cells.map((c, i) => ({ ...c, r: c.f ? c.r : start[i] }));
    const def: LevelDef = {
      ...base,
      id: `D${today}`,
      cells,
      par,
      budget: par + Math.max(5, Math.ceil(par * 0.6)),
    };
    if ((par >= 4 && !isWon(def, start)) || attempt > 20) return def;
  }
}

// ---- Chapters & Forge Tokens --------------------------------------------------
export interface ChapterInfo { index: number; name: string; first: number; last: number; levels: number }
export const CHAPTER_INFO: ChapterInfo[] = CHAPTERS.map((name, index) => {
  const ls = LEVELS.filter((l) => l.chapter === name);
  return { index, name, first: ls[0].number, last: ls[ls.length - 1].number, levels: ls.length };
});

/** Fixed reward for completing a chapter (the Forge Token is the collection piece). */
export function chapterReward(index: number): { coins: number; booster: "wrenches" | "extraMoves" | "hints" } {
  return { coins: 150 + index * 25, booster: index % 3 === 0 ? "wrenches" : index % 3 === 1 ? "hints" : "extraMoves" };
}
export const chapterComplete = (s: PlayerState, c: ChapterInfo) => s.level > c.last;
/** Completed chapters whose token hasn't been collected yet (oldest first). */
export const unclaimedChapters = (s: PlayerState) =>
  CHAPTER_INFO.filter((c) => chapterComplete(s, c) && !(s.claimedChapters ?? []).includes(c.index));
export const tokensCollected = (s: PlayerState) => (s.claimedChapters ?? []).length;

export function claimChapter(s: PlayerState, index: number): Partial<PlayerState> | null {
  const c = CHAPTER_INFO[index];
  if (!c || !chapterComplete(s, c) || (s.claimedChapters ?? []).includes(index)) return null;
  const r = chapterReward(index);
  return { claimedChapters: [...(s.claimedChapters ?? []), index], coins: s.coins + r.coins, [r.booster]: (s[r.booster] ?? 0) + 1 };
}

// ---- Star goals ---------------------------------------------------------------
export const STAR_GOALS = [12, 30, 50, 75, 100, 125, 150, 180];
export function starGoalReward(i: number): { coins: number; booster: "hints" | "extraMoves" | "wrenches" } {
  return { coins: 100 + i * 40, booster: (["hints", "extraMoves", "wrenches"] as const)[i % 3] };
}
export const totalStars = (s: PlayerState) => Object.values(s.stars ?? {}).reduce((a, b) => a + b, 0);
/** The first star goal not yet claimed (null when all are done). */
export function nextStarGoal(s: PlayerState): { index: number; target: number; have: number; ready: boolean } | null {
  const claimed = s.claimedStarGoals ?? [];
  const index = STAR_GOALS.findIndex((_, i) => !claimed.includes(i));
  if (index < 0) return null;
  const have = totalStars(s);
  return { index, target: STAR_GOALS[index], have, ready: have >= STAR_GOALS[index] };
}
export function claimStarGoal(s: PlayerState): Partial<PlayerState> | null {
  const g = nextStarGoal(s);
  if (!g?.ready) return null;
  const r = starGoalReward(g.index);
  return { claimedStarGoals: [...(s.claimedStarGoals ?? []), g.index], coins: s.coins + r.coins, [r.booster]: (s[r.booster] ?? 0) + 1 };
}

export const BOOSTER_NAME = { hints: "Hint", wrenches: "Wrench", extraMoves: "+5 Moves" } as const;
