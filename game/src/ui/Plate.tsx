import { Image, StyleSheet, View, type ImageSourcePropType, type ViewStyle } from "react-native";
import { art } from "../art";

/**
 * Nine-slice renderer for the painted UI art: corners keep their bevels at a
 * fixed size while the edges and centre stretch, so one 512px button plate
 * can skin any width without smeared corners. Pure Views + percentage
 * positioning, so it needs no onLayout measurement.
 */
export function NineSlice({
  source, w, h, cap, scale, style, children, fill,
}: {
  source: ImageSourcePropType;
  w: number; h: number; // source pixel size
  cap: { l: number; t: number; r: number; b: number }; // source px
  scale: number; // dp per source px for the caps
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
  /** Paint the centre this colour instead of stretching the art's centre (trays with baked-in detail). */
  fill?: string;
}) {
  const xs = [0, cap.l, w - cap.r, w];
  const ys = [0, cap.t, h - cap.b, h];
  const cw = [Math.round(cap.l * scale), 0, Math.round(cap.r * scale)];
  const ch = [Math.round(cap.t * scale), 0, Math.round(cap.b * scale)];
  return (
    <View style={style}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {[0, 1, 2].map((r) => (
          <View key={r} style={r === 1 ? styles.flexRow : [styles.row, { height: ch[r] }]}>
            {[0, 1, 2].map((c) => {
              const sw = xs[c + 1] - xs[c];
              const sh = ys[r + 1] - ys[r];
              if (fill && r === 1 && c === 1) return <View key={c} style={{ flex: 1, backgroundColor: fill }} />;
              return (
                <View key={c} style={[styles.cell, c === 1 ? { flex: 1 } : { width: cw[c] }]}>
                  <Image
                    source={source}
                    resizeMode="stretch"
                    fadeDuration={0}
                    style={{
                      position: "absolute",
                      width: `${(w / sw) * 100}%`,
                      height: `${(h / sh) * 100}%`,
                      left: `${(-xs[c] / sw) * 100}%`,
                      top: `${(-ys[r] / sh) * 100}%`,
                    }}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
      {children}
    </View>
  );
}

/** board_tray art: 422x512, chamfered graphite rim + thin cyan accent line inside 62 px caps. */
const TRAY = { w: 422, h: 512, cap: { l: 62, t: 62, r: 62, b: 62 }, fill: "#39332D" };
/** tile_slot art: 510x512 sunken socket, bevel inside 50 px caps. */
const SLOT = { w: 510, h: 512, cap: { l: 50, t: 50, r: 50, b: 50 } };

/**
 * Graphite tray plate (the board_tray art, nine-sliced): chamfered rim, a thin cyan accent line and a warm
 * graphite face — for cards, pills, banners and HUD groups. `radius` sets the rim size; `glow` adds a cyan halo.
 */
export function SteelPlate({ style, children, radius = 12, glow }: { style?: ViewStyle | ViewStyle[]; children?: React.ReactNode; radius?: number; glow?: boolean }) {
  const scale = Math.min(0.34, Math.max(0.2, radius / 40));
  return (
    <View style={[{ borderRadius: radius }, styles.plateShadow, glow && styles.glowShadow, style]}>
      <NineSlice source={art.board_tray} w={TRAY.w} h={TRAY.h} cap={TRAY.cap} scale={scale} fill={TRAY.fill} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

/** Sunken socket cut into a tray (the tile_slot art, nine-sliced): meters, counters, list rows. */
export function Well({ style, children, radius = 10 }: { style?: ViewStyle | ViewStyle[]; children?: React.ReactNode; radius?: number }) {
  return (
    <View style={[{ borderRadius: radius }, style]}>
      <NineSlice source={art.tile_slot} w={SLOT.w} h={SLOT.h} cap={SLOT.cap} scale={Math.min(0.36, Math.max(0.16, radius / 44))} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  flexRow: { flexDirection: "row", flex: 1 },
  cell: { overflow: "hidden" },
  plateShadow: { shadowColor: "#000", shadowOpacity: 0.55, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  glowShadow: { shadowColor: "#12D1E6", shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
});
