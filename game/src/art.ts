/** Game art (assets/art/manifest.json: kind/usage/size; "legacy" ids are the previous art). Use with expo Image or Skia useImage. */
export const art = {
  bg_workshop_dawn: require("../assets/art/bg_workshop_dawn.png"),
  bg_nightshift_neon: require("../assets/art/bg_nightshift_neon.png"),
  board_tray: require("../assets/art/board_tray.png"),
  tile_slot: require("../assets/art/tile_slot.png"),
  pipe_straight: require("../assets/art/pipe_straight.png"),
  pipe_elbow: require("../assets/art/pipe_elbow.png"),
  pipe_t_junction: require("../assets/art/pipe_t_junction.png"),
  pipe_endcap: require("../assets/art/pipe_endcap.png"),
  pipe_valve: require("../assets/art/pipe_valve.png"),
  hud_top_bar: require("../assets/art/hud_top_bar.png"),
  button_primary: require("../assets/art/button_primary.png"),
  reward_gear_token: require("../assets/art/reward_gear_token.png"),
  fx_sparkle_burst: require("../assets/art/fx_sparkle_burst.png"),
  fx_flow_glow: require("../assets/art/fx_flow_glow.png"),
  title_hero_key_art: require("../assets/art/title_hero_key_art.png"),
  logo: require("../assets/art/logo.png"),
} as const;
export type ArtId = keyof typeof art;
