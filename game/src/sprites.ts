/**
 * Runtime sprites baked from the studio art (assets/art → assets/art/baked by scripts/bake-art.py):
 * square board tiles re-assembled from the pipe sheets (dry glass + one per fluid), the endcap lenses,
 * the valve hand-wheel, the HUD bar, button plates and gear-group tints. Raw art stays in src/art.ts.
 */
import type { Color } from "./game/engine";

type Shape = "straight" | "elbow" | "tee" | "stub";
type State = "dry" | Color;

const PIPES = {
  straight: {
    dry: require("../assets/art/baked/pipe_straight_dry.png"),
    blue: require("../assets/art/baked/pipe_straight_blue.png"),
    red: require("../assets/art/baked/pipe_straight_red.png"),
    green: require("../assets/art/baked/pipe_straight_green.png"),
    yellow: require("../assets/art/baked/pipe_straight_yellow.png"),
    purple: require("../assets/art/baked/pipe_straight_purple.png"),
  },
  elbow: {
    dry: require("../assets/art/baked/pipe_elbow_dry.png"),
    blue: require("../assets/art/baked/pipe_elbow_blue.png"),
    red: require("../assets/art/baked/pipe_elbow_red.png"),
    green: require("../assets/art/baked/pipe_elbow_green.png"),
    yellow: require("../assets/art/baked/pipe_elbow_yellow.png"),
    purple: require("../assets/art/baked/pipe_elbow_purple.png"),
  },
  tee: {
    dry: require("../assets/art/baked/pipe_tee_dry.png"),
    blue: require("../assets/art/baked/pipe_tee_blue.png"),
    red: require("../assets/art/baked/pipe_tee_red.png"),
    green: require("../assets/art/baked/pipe_tee_green.png"),
    yellow: require("../assets/art/baked/pipe_tee_yellow.png"),
    purple: require("../assets/art/baked/pipe_tee_purple.png"),
  },
  stub: {
    dry: require("../assets/art/baked/pipe_stub_dry.png"),
    blue: require("../assets/art/baked/pipe_stub_blue.png"),
    red: require("../assets/art/baked/pipe_stub_red.png"),
    green: require("../assets/art/baked/pipe_stub_green.png"),
    yellow: require("../assets/art/baked/pipe_stub_yellow.png"),
    purple: require("../assets/art/baked/pipe_stub_purple.png"),
  },
} satisfies Record<Shape, Record<State, number>>;

const LENSES = {
  dry: require("../assets/art/baked/lens_dry.png"),
  blue: require("../assets/art/baked/lens_blue.png"),
  red: require("../assets/art/baked/lens_red.png"),
  green: require("../assets/art/baked/lens_green.png"),
  yellow: require("../assets/art/baked/lens_yellow.png"),
  purple: require("../assets/art/baked/lens_purple.png"),
} satisfies Record<State, number>;

export const sprites = {
  pipe: (shape: Shape, state: State): number => PIPES[shape][state],
  lens: (state: State): number => LENSES[state],
  valveWheel: require("../assets/art/baked/valve_wheel.png"),
  slot: require("../assets/art/baked/slot.png"),
  slotSunk: require("../assets/art/baked/slot_sunk.png"),
  slotLift: require("../assets/art/baked/slot_lift.png"),
  hudBar: require("../assets/art/baked/hud_bar.png"),
  button: {
    teal: require("../assets/art/baked/button_teal.png"),
    amber: require("../assets/art/baked/button_amber.png"),
    violet: require("../assets/art/baked/button_violet.png"),
    graphite: require("../assets/art/baked/button_graphite.png"),
    red: require("../assets/art/baked/button_red.png"),
  },
  gear: [
    require("../assets/art/baked/gear_gold.png"),
    require("../assets/art/baked/gear_silver.png"),
    require("../assets/art/baked/gear_copper.png"),
  ],
};
export type PipeShape = Shape;
export type PipeState = State;

/** Baked pixel sizes (for aspect-correct drawing). */
export const SPRITE_SIZE = {
  tile: 192,
  lens: { w: 148, h: 160 },
  valveWheel: { w: 158, h: 43 },
  hudBar: { w: 512, h: 224 },
  button: { w: 381, h: 512 },
  buttonSmall: { w: 190, h: 256 },
};
