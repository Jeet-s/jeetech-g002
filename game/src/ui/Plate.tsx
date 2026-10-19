import { Image, StyleSheet, View, type ImageSourcePropType, type ViewStyle } from "react-native";
import { art } from "../art";

/**
 * Nine-slice renderer for the painted UI art: corners keep their bevels at a
 * fixed size while the edges and centre stretch, so one 512px button plate
 * can skin any width without smeared corners. Pure Views + percentage
 * positioning, so it needs no onLayout measurement.
 */
export function NineSlice({
  source, w, h, cap, scale, style, children,
}: {
  source: ImageSourcePropType;
  w: number; h: number; // source pixel size
  cap: { l: number; t: number; r: number; b: number }; // source px
  scale: number; // dp per source px for the caps
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
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

/** Brushed dark-steel plate (from the HUD art) with a rounded, bevelled edge. */
export function SteelPlate({ style, children, radius = 12, glow }: { style?: ViewStyle | ViewStyle[]; children?: React.ReactNode; radius?: number; glow?: boolean }) {
  return (
    <View style={[{ borderRadius: radius }, styles.plateShadow, style]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]} pointerEvents="none">
        <Image source={art.hud_plate_steel} resizeMode="stretch" fadeDuration={0} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { borderRadius: radius }, styles.bevel, glow && styles.glowRim]} />
      </View>
      {children}
    </View>
  );
}

/** Recessed well cut into a steel plate (meters, counters, list rows). */
export function Well({ style, children, radius = 10 }: { style?: ViewStyle | ViewStyle[]; children?: React.ReactNode; radius?: number }) {
  return (
    <View style={[styles.well, { borderRadius: radius }, style]}>
      <View pointerEvents="none" style={[styles.wellShade, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  flexRow: { flexDirection: "row", flex: 1 },
  cell: { overflow: "hidden" },
  plateShadow: { shadowColor: "#000", shadowOpacity: 0.55, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  bevel: { borderWidth: 1, borderTopColor: "rgba(170,200,214,0.30)", borderLeftColor: "rgba(170,200,214,0.12)", borderRightColor: "rgba(0,0,0,0.35)", borderBottomColor: "rgba(0,0,0,0.6)" },
  glowRim: { borderColor: "rgba(46,196,255,0.30)", borderTopColor: "rgba(46,196,255,0.45)" },
  well: {
    backgroundColor: "#0E171E", overflow: "hidden",
    borderWidth: 1, borderTopColor: "rgba(0,0,0,0.75)", borderLeftColor: "rgba(0,0,0,0.55)",
    borderRightColor: "rgba(142,167,178,0.12)", borderBottomColor: "rgba(142,167,178,0.22)",
  },
  wellShade: { position: "absolute", left: 0, right: 0, top: 0, height: 5, backgroundColor: "rgba(0,0,0,0.35)" },
});
