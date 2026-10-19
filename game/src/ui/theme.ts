/**
 * Design tokens. Every screen uses these — never raw colours, sizes or system
 * fonts. Values come from docs/ART_DIRECTION.md (the studio's approved look):
 * a dark-steel industrial workshop, anodized-teal bezels, cyan/red luminous
 * fluids and one warm orange call-to-action colour.
 */
export const palette = {
  // UI kit tokens (ART_DIRECTION.md) — primary = orange CTA, secondary = steel, accent = cyan glow.
  primary: "#D97A2B",
  primaryDark: "#A85E1F",
  secondary: "#4E5E68",
  secondaryDark: "#324049",
  accent: "#2EC4FF",
  accentDark: "#108AB4",
  bgTop: "#22313C",
  bgBottom: "#0F1A24",
  ink: "#F2F6FA",
  // Art-bible palette
  teal: "#274454",
  steelLight: "#8EA7B2",
  fluidBlue: "#2EC4FF",
  fluidRed: "#FF5D5D",
  danger: "#FF5D5D",
  dangerDark: "#B83A3A",
  // Surfaces — dark satin steel sheets
  surface: "#1B2731",
  surfaceAlt: "#16222B", // recessed wells / list rows inside a sheet
  surfaceDark: "#111B23",
  line: "#2A3A45", // board grid lines (use at 35%)
  rim: "rgba(46,196,255,0.22)", // anodized teal edge
  inkSoft: "#A9BAC4",
  inkMuted: "#6F8693",
  onPrimary: "#FFFFFF",
  // Game feedback
  star: "#FFC23D",
  coin: "#FFC23D",
  success: "#3FD18A",
};

/** One rounded sans across the whole game (Nunito), per the art direction. */
export const fonts = {
  display: "Nunito_800ExtraBold", // big numerals, button labels
  displayMedium: "Nunito_700Bold", // titles (reads as semibold at 28)
  body: "Nunito_600SemiBold",
  medium: "Nunito_500Medium", // HUD labels
  bodyRegular: "Nunito_400Regular", // body / tutorial copy
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };
export const space = { xs: 4, sm: 8, md: 14, lg: 20, xl: 28, xxl: 40 };

/** -1% tracking for a tighter, pro feel. */
const track = (size: number) => -0.01 * size;

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 40, letterSpacing: track(40) },
  title: { fontFamily: fonts.displayMedium, fontSize: 28, letterSpacing: track(28) },
  heading: { fontFamily: fonts.displayMedium, fontSize: 22, letterSpacing: track(22) },
  hud: { fontFamily: fonts.medium, fontSize: 14, letterSpacing: track(14) },
  body: { fontFamily: fonts.bodyRegular, fontSize: 16, letterSpacing: track(16) },
  caption: { fontFamily: fonts.medium, fontSize: 13, letterSpacing: track(13) },
  button: { fontFamily: fonts.display, fontSize: 20, letterSpacing: track(20) },
  /** Tabular numerals so counters never jitter as digits change. */
  number: { fontFamily: fonts.display, fontVariant: ["tabular-nums" as const] },
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
  light: "#0B141B", // under steel sheets
  dark: "#070D12", // under the darkest surfaces
  scrim: "15,26,36", // rgb() of bgBottom — for dim/scrim overlays
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
