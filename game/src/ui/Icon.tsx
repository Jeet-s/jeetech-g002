import { memo, useMemo } from "react";
import { Canvas, Circle, Group, Path, Skia, LinearGradient, vec } from "@shopify/react-native-skia";
import { palette } from "./theme";

/**
 * Geometric line icons (24-unit grid, round caps) drawn with Skia — the art
 * direction wants line-based iconography, never emoji or text baked into art.
 */
const LINES = {
  back: "M15 5 L8 12 L15 19",
  close: "M6 6 L18 18 M18 6 L6 18",
  undo: "M9 15 L4 10 L9 5 M4 10 H14 A5.5 5.5 0 0 1 14 21 H10",
  restart: "M19.5 12 A7.5 7.5 0 1 1 17.3 6.7 M19.5 3.5 V8 H15",
  moves: "M4.5 12 A7.5 7.5 0 0 1 17.8 7.2 M18.5 3 V7.5 H14 M19.5 12 A7.5 7.5 0 0 1 6.2 16.8 M5.5 21 V16.5 H10",
  shop: "M5 8.5 H19 L18 20.5 H6 Z M9 8.5 V7 A3 3 0 0 1 15 7 V8.5",
  lock: "M6 11 H18 V20.5 H6 Z M8.5 11 V8 A3.5 3.5 0 0 1 15.5 8 V11 M12 14.5 V17",
  check: "M5 12.5 L10 17.5 L19 7",
  map: "M3.5 6.5 L9 4.5 L15 6.5 L20.5 4.5 V17.5 L15 19.5 L9 17.5 L3.5 19.5 Z M9 4.5 V17.5 M15 6.5 V19.5",
  sound: "M4 9.5 H7.5 L12 5.5 V18.5 L7.5 14.5 H4 Z M15.5 9 A4 4 0 0 1 15.5 15 M18 6.5 A7.5 7.5 0 0 1 18 17.5",
  music: "M9 17.5 V5.5 L19 3.5 V15.5 M9 17.5 A2.5 2.5 0 1 1 9 17.4 M19 15.5 A2.5 2.5 0 1 1 19 15.4",
  vibrate: "M8 4 H16 V20 H8 Z M4.5 8 V16 M19.5 8 V16 M11 17 H13",
  pause: "M9 5.5 V18.5 M15 5.5 V18.5",
  wrench: "M14.5 4.2 A4.6 4.6 0 0 0 9.7 10.3 L4.3 15.7 A2 2 0 0 0 7.1 18.5 L12.5 13.1 A4.6 4.6 0 0 0 18.6 8.3 L16 10.9 L13.3 10.4 L12.8 7.7 Z",
  plus: "M12 5 V19 M5 12 H19",
  noads: "M4 6.5 H20 V17.5 H4 Z M8 14.5 L9.8 9.5 L11.6 14.5 M8.6 13 H11 M14 9.5 V14.5 H15 A2.5 2.5 0 0 0 15 9.5 Z M3 3 L21 21",
} as const;

const FILLS = {
  play: "M8 5 L19 12 L8 19 Z",
  star: "M12 2.6 L14.8 8.6 L21.3 9.3 L16.4 13.7 L17.8 20.2 L12 16.9 L6.2 20.2 L7.6 13.7 L2.7 9.3 L9.2 8.6 Z",
  bulb: "M12 2.8 A6.6 6.6 0 0 0 8.1 14.7 C8.8 15.3 9.2 16 9.2 16.9 H14.8 C14.8 16 15.2 15.3 15.9 14.7 A6.6 6.6 0 0 0 12 2.8 Z",
  drop: "M12 3 C12 3 5.5 10.5 5.5 14.5 A6.5 6.5 0 0 0 18.5 14.5 C18.5 10.5 12 3 12 3 Z",
} as const;

export type IconName = keyof typeof LINES | keyof typeof FILLS | "gear" | "coin" | "target";

/** Star outline on the 24-unit grid (shared with MiniStars). */
export const STAR_PATH = FILLS.star;

const cache = new Map<string, ReturnType<typeof Skia.Path.MakeFromSVGString>>();
export function svg(d: string) {
  if (!cache.has(d)) cache.set(d, Skia.Path.MakeFromSVGString(d));
  return cache.get(d)!;
}

/** Legacy emoji/glyph → icon, so older call sites keep working with the new set. */
export const GLYPH_ICONS: Record<string, IconName> = {
  "‹": "back", "↶": "undo", "↻": "restart", "💡": "bulb", "▶": "play", "⚙": "gear", "🛍": "shop",
  "⭐": "star", "★": "star", "🪙": "coin", "🔒": "lock", "✕": "close", "✓": "check",
};

function gearPath() {
  const b = Skia.PathBuilder.Make();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.moveTo(12 + Math.cos(a) * 7.2, 12 + Math.sin(a) * 7.2);
    b.lineTo(12 + Math.cos(a) * 10, 12 + Math.sin(a) * 10);
  }
  return b.detach();
}
const GEAR = gearPath();

export const Icon = memo(function Icon({ name, size = 24, color = palette.ink, stroke = 2.3 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  const k = size / 24;
  const body = useMemo(() => {
    if (name === "gear") {
      return (
        <>
          <Circle cx={12} cy={12} r={6.4} style="stroke" strokeWidth={stroke} color={color} />
          <Circle cx={12} cy={12} r={2.4} style="stroke" strokeWidth={stroke} color={color} />
          <Path path={GEAR} style="stroke" strokeWidth={stroke + 0.6} strokeCap="round" color={color} />
        </>
      );
    }
    if (name === "target") {
      return (
        <>
          <Circle cx={12} cy={12} r={9} style="stroke" strokeWidth={stroke} color={color} />
          <Circle cx={12} cy={12} r={5} style="stroke" strokeWidth={stroke} color={color} />
          <Circle cx={12} cy={12} r={1.8} color={color} />
        </>
      );
    }
    if (name === "coin") {
      return (
        <>
          <Circle cx={12} cy={12} r={10}>
            <LinearGradient start={vec(0, 2)} end={vec(0, 22)} colors={["#FFE08A", "#E59A1C"]} />
          </Circle>
          <Circle cx={12} cy={12} r={6.6} style="stroke" strokeWidth={1.6} color="rgba(120,62,0,0.55)" />
          <Circle cx={12} cy={12} r={10} style="stroke" strokeWidth={1.2} color="rgba(90,45,0,0.6)" />
        </>
      );
    }
    if (name in FILLS) {
      const p = svg(FILLS[name as keyof typeof FILLS]);
      if (!p) return null;
      if (name === "star" || name === "bulb") {
        // Gilded fill with a darker rim so it reads on any plate.
        const [hi, lo] = name === "star" ? ["#FFE27A", "#F2A71B"] : ["#FFF0A0", "#F5B82E"];
        return (
          <>
            <Path path={p}>
              <LinearGradient start={vec(0, 3)} end={vec(0, 20)} colors={color === palette.ink ? [hi, lo] : [color, color]} />
            </Path>
            <Path path={p} style="stroke" strokeWidth={1.3} strokeJoin="round" color="rgba(80,40,0,0.45)" />
            {name === "bulb" ? <Path path={svg("M9.6 19.4 H14.4 M10.4 21.6 H13.6")!} style="stroke" strokeWidth={1.8} strokeCap="round" color={palette.ink} /> : null}
          </>
        );
      }
      return <Path path={p} color={color} />;
    }
    const p = svg(LINES[name as keyof typeof LINES]);
    return p ? <Path path={p} style="stroke" strokeWidth={stroke} strokeCap="round" strokeJoin="round" color={color} /> : null;
  }, [name, color, stroke]);
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Group transform={[{ scale: k }]}>{body}</Group>
    </Canvas>
  );
});
