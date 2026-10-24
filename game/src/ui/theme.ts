/**
 * Design tokens. Every screen uses these — never raw colours, sizes or system
 * fonts. Values come from docs/ART_DIRECTION.md (the studio's approved look):
 * a cozy workshop at dusk — navy haze, warm graphite trays, brass fittings,
 * luminous glass pipes (cyan, lime, amber, violet) and a cyan glass CTA.
 */
export const palette = {
  // UI kit tokens (docs/ART_DIRECTION.md): primary = cyan glass CTA, secondary = amber, accent = violet.
  primary: "#12D1E6",
  primaryDark: "#0A7A8C",
  secondary: "#FFB24D",
  secondaryDark: "#C7741C",
  accent: "#B16BFF",
  accentDark: "#6A2FCF",
  bgTop: "#0B1021",
  bgBottom: "#0F2C49",
  ink: "#F2F7FF",
  // Cyan glow for live flow, guides and selection rims.
  glow: "#12D1E6",
  glowSoft: "rgba(18,209,230,0.35)",
  brass: "#D9A441",
  brassDark: "#8A5A1C",
  lime: "#6EE06F",
  teal: "#0F2C49",
  steelLight: "#B9AE9E",
  fluidBlue: "#12D1E6",
  fluidRed: "#FF5D5D",
  danger: "#FF5D5D",
  dangerDark: "#B83A3A",
  // Surfaces — warm graphite trays (board_tray art) and sunken sockets (tile_slot art)
  surface: "#39332D",
  surfaceAlt: "#2A2622",
  surfaceDark: "#1C1916",
  line: "#2A2622",
  rim: "rgba(18,209,230,0.35)",
  inkSoft: "#D3DCE8", // ink at ~85% on dark
  inkMuted: "#97A0AD",
  onPrimary: "#FFFFFF",
  // Game feedback
  star: "#FFC23D",
  coin: "#FFB24D",
  success: "#6EE06F",
};

/** Friendly geometric sans (Fredoka) for display + numerals, Nunito for body copy, per the art direction. */
export const fonts = {
  display: "Fredoka_700Bold", // headlines, big numerals, button labels
  displayMedium: "Fredoka_600SemiBold", // titles, counters
  body: "Nunito_700Bold",
  medium: "Nunito_600SemiBold", // HUD labels
  bodyRegular: "Nunito_600SemiBold", // body / tutorial copy (wide apertures, readable on dark)
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };
export const space = { xs: 4, sm: 8, md: 14, lg: 20, xl: 28, xxl: 40 };

/** -1% tracking for a tighter, pro feel. */
const track = (size: number) => -0.01 * size;

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 40, letterSpacing: track(40) },
  title: { fontFamily: fonts.displayMedium, fontSize: 28, letterSpacing: track(28) },
  heading: { fontFamily: fonts.displayMedium, fontSize: 22, letterSpacing: track(22) },
  hud: { fontFamily: fonts.medium, fontSize: 14, letterSpacing: 0.2 },
  body: { fontFamily: fonts.bodyRegular, fontSize: 16, letterSpacing: track(16) },
  caption: { fontFamily: fonts.medium, fontSize: 13, letterSpacing: track(13) },
  button: { fontFamily: fonts.display, fontSize: 20, letterSpacing: track(20) },
  /** Tabular numerals so counters never jitter as digits change. */
  number: { fontFamily: fonts.display, letterSpacing: 0.4, fontVariant: ["tabular-nums" as const] },
};

/** Soft drop shadow used on cards and buttons (iOS + Android). */
export const shadow = {
  shadowColor: "#02070B",
  shadowOpacity: 0.55,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 8 },
  elevation: 10,
};

/** Strong soft shadow for primary CTAs. */
export const shadowStrong = {
  shadowColor: "#000000",
  shadowOpacity: 0.7,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 14,
};

/** Steel "lip" tones for the 3D under-edge of panels and cards. */
export const lip = {
  light: "#15120F", // under steel sheets
  dark: "#0B0907", // under the darkest surfaces
  scrim: "11,16,33", // rgb() of bgBottom — for dim/scrim overlays
};

/** Spring / timing presets — every animation in the game feels consistent. */
export const springs = {
  press: { damping: 14, stiffness: 320, mass: 0.6 },
  pop: { damping: 9, stiffness: 220, mass: 0.7 },
  gentle: { damping: 18, stiffness: 140, mass: 1 },
  /** Pipe rotate: 140 ms, overshoot ~1.06, damping ratio ~0.6. */
  rotate: { damping: 11, stiffness: 520, mass: 0.6 },
};

export const motion = {
  press: 120, // button press-in ease-out
  pulse: 1200, // endpoint / current-node pulse loop
  sweep: 600, // connection glow sweep
  boardDrop: 220,
};
