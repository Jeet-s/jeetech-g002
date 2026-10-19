/** Game art (assets/art/manifest.json: kind/usage/size; "legacy" ids are the previous art). Use with expo Image or Skia useImage. */
export const art = {
  logo: require("../assets/art/logo.png"),
  background_chapter_industrial_steel_teal: require("../assets/art/background_chapter_industrial_steel_teal.png"),
  board_frame_tray: require("../assets/art/board_frame_tray.png"),
  pipe_straight: require("../assets/art/pipe_straight.png"),
  pipe_elbow: require("../assets/art/pipe_elbow.png"),
  pipe_tee: require("../assets/art/pipe_tee.png"),
  tile_blocker: require("../assets/art/tile_blocker.png"),
  endpoint_source_blue: require("../assets/art/endpoint_source_blue.png"),
  endpoint_source_red: require("../assets/art/endpoint_source_red.png"),
  endpoint_drain_blue: require("../assets/art/endpoint_drain_blue.png"),
  endpoint_drain_red: require("../assets/art/endpoint_drain_red.png"),
  hud_top_bar: require("../assets/art/hud_top_bar.png"),
  button_primary_orange: require("../assets/art/button_primary_orange.png"),
  button_secondary_steel: require("../assets/art/button_secondary_steel.png"),
  icon_reward_wrench: require("../assets/art/icon_reward_wrench.png"),
  fx_glow_sweep: require("../assets/art/fx_glow_sweep.png"),
  fx_particles_pack: require("../assets/art/fx_particles_pack.png"),
  hud_plate_steel: require("../assets/art/hud_plate_steel.png"),
} as const;
export type ArtId = keyof typeof art;
