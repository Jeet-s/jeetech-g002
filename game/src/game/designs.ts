/**
 * Flow Forge — the hand-authored level set (plan: docs/LEVELS.md).
 * Glyphs are documented in ./levels.ts. `solved` is the board once every pipe
 * is turned right; `taps` says how far each rotatable pipe starts from that.
 * Decoys (pipes the route never uses) have tap 0: they rest as shown.
 */
export const CHAPTERS = [
  "Workshop Basics",
  "Factory Floor",
  "Pressure Plant",
  "Color Lab",
  "Refinery Riddles",
];

export type Role = "teach" | "practise" | "twist" | "combine" | "finale" | "breather";

export interface Design {
  chapter: number;
  role: Role;
  solved: string[];
  taps: string[];
  /** Pin an endpoint's mouth ("row,col" → side) where decoys make it ambiguous. */
  mouths?: Record<string, "N" | "E" | "S" | "W">;
  /** Short on-screen hint shown above the board (teach levels / new mechanics). */
  hint?: string;
  /** What this level teaches / tests and the "aha" the player must find. */
  intent: string;
  mechanics: string[];
}

export const DESIGNS: Design[] = [
  // ── Chapter 1 · Workshop Basics — one fluid, tap to rotate ────────────────
  {
    chapter: 0, role: "teach",
    hint: "Tap the glowing pipe to turn it. Water flows by itself once the pipes line up.",
    solved: ["B─┐", "b─┘"],
    taps: [".11", ".01"],
    intent: "TEACH tap-to-rotate. A U-turn: the bottom straight already lines up, so the player sees what 'connected' looks like and only has to turn the top straight and both corners. Aha: each tap turns a pipe a quarter turn, and fluid follows as soon as the ends meet.",
    mechanics: ["Rotate pipes", "Single fluid"],
  },
  {
    chapter: 0, role: "teach",
    hint: "Each corner turns the flow. Follow it out from the source.",
    solved: ["B─┐", "┌─┘", "└─b"],
    taps: [".11", "101", "10."],
    intent: "TEACH corners chain together. A full 3x3 zig-zag with no spare cells: every elbow's turn is set by the pipe before it. Aha: follow the fluid tile by tile from the source — fix one corner, then the next one is obvious.",
    mechanics: ["Rotate pipes", "Elbows turn corners"],
  },
  {
    chapter: 0, role: "teach",
    hint: "Check which way the drain opens before you start.",
    solved: ["B┐┌┐", ".└┘│", "b──┘"],
    taps: [".111", ".110", ".011"],
    intent: "TEACH the route is not the straight line. The path dips into a little valley (down, right, back up) before heading round to the drain beside the source. Aha: the drain's open mouth faces right, so the fluid must loop all the way round — read the drain before you start.",
    mechanics: ["Rotate pipes", "Read the drain's mouth"],
  },
  {
    chapter: 0, role: "practise",
    hint: "Not every pipe is part of the route.",
    solved: [".┌─┐", "B┘.│", ".└┘│", "..b┘"],
    taps: [".112", ".1.1", ".001", "...1"],
    intent: "PRACTISE ignoring decoys. The first corner starts pointing down into two spare pipes that lead to a dead end beside the drain. Aha: not every pipe belongs to the route — the drain only opens to the right, so the fluid must climb over the top and come down the right edge.",
    mechanics: ["Decoy pipes", "Read the drain's mouth"],
  },
  {
    chapter: 0, role: "twist",
    hint: "The short way is a dead end. Try the long way round.",
    solved: ["┌──┐", "└B.│", "└──b"],
    taps: ["1111", "3..1", "000."],
    intent: "TWIST the short way is a trap. At the start the fluid already runs down and along the bottom row — straight into the back of the drain, which only opens upward. Aha: undo the obvious route (the first corner needs three taps, all the way round) and go over the top to drop into the drain's open mouth.",
    mechanics: ["Decoy route", "Long way round"],
  },
  {
    chapter: 0, role: "finale",
    solved: ["┌┌─┐", "│B.│", "b──┘"],
    taps: ["0212", "0..1", ".012"],
    intent: "FINALE of the basics: the fork. The source sits in the middle and its first corner can turn LEFT — a two-pipe hop that ends at the back of the drain — or RIGHT, the long loop round the edge. It starts out pointing left, so the fluid already pours into that hop. Aha: read the drain first (it opens to the right), commit to the long loop, and leave the left column alone.",
    mechanics: ["Decoy fork", "Read the drain's mouth", "Long way round"],
  },

  // ── Chapter 2 · Factory Floor — bolted pipes and splitters ────────────────
  {
    chapter: 1, role: "teach",
    hint: "Bolted pipes can't turn. Build your route from them.",
    solved: [".┌─┐.", "B┛.┗b", "┌───┘"],
    taps: [".313.", ".....", "00000"],
    intent: "TEACH bolted pipes (riveted plates, can't turn). The two bolted corners beside the source and drain both point UP, so the route must bridge over the top — even though a loose row along the bottom looks like a straight shot. Aha: bolted pieces are clues, not obstacles: build from them.",
    mechanics: ["Bolted pipes", "Decoy row"],
  },
  {
    chapter: 1, role: "teach",
    hint: "A tee splits the flow. Fill both drains at once.",
    solved: ["B┐.b", ".├─┘", "b┘.."],
    taps: [".1..", ".211", ".2.."],
    intent: "TEACH splitters: one source, TWO drains, and a tee that feeds both. Aha: a tee sends fluid down every arm at once — face its arms down and right, with its flat back to the blocked plate.",
    mechanics: ["Splitter tee", "Two drains"],
  },
  {
    chapter: 1, role: "practise",
    solved: ["B━┓.", ".┌┤┐", ".│││", "b┘└b"],
    taps: ["....", ".120", ".110", ".12."],
    intent: "PRACTISE splitters with a bolted feed. The bolted corridor drops onto a loose tee that starts facing right, pouring into a decoy column that ends at the back of the right drain. Aha: the right drain is fed from the middle column, so the tee must open LEFT and DOWN — away from the decoy.",
    mechanics: ["Splitter tee", "Bolted corridor", "Decoy column"],
  },
  {
    chapter: 1, role: "practise",
    solved: ["b┐┌b", "└├┤┘", ".│┃.", "B┛┃."],
    taps: [".22.", "0120", ".1..", "...."],
    intent: "PRACTISE chained splitters: three drains from one source via two tees standing back to back. Bolted pipes anchor both ends of the trunk. Aha: the second tee is fed through its SIDE arm by the first, so it opens up and down; the corner pipes hugging the top drains are decoys that only touch their closed backs.",
    mechanics: ["Two splitters", "Three drains", "Bolted anchors"],
  },
  {
    chapter: 1, role: "twist",
    hint: "A tee can be fed through any of its arms.",
    solved: ["┌┌┳b", "│││.", "b┘└B"],
    taps: ["03..", "011.", ".21."],
    intent: "TWIST a bolted splitter that faces DOWN. The fluid has to climb up the tee's stem; its left arm then needs a corner that turns down the middle column. Aha: a tee can be entered from any arm — and the edge column (where the first corner starts out pointing) is a dead end against the drain's back.",
    mechanics: ["Bolted splitter", "Enter through the stem", "Decoy column"],
  },
  {
    chapter: 1, role: "finale",
    solved: ["b┐.┌b", ".├━┤.", ".│.└┐", ".B──b"],
    taps: [".2.1.", ".1.2.", ".1.11", "..00."],
    intent: "FINALE of the factory floor: one source, three drains, two splitters joined by a bolted choke. The bottom row looks like a straight run to the nearest drain — but that drain opens upward. Aha: everything flows UP through the first tee, across the bolted bar, and the second tee sends a branch back down and round into the bottom drain.",
    mechanics: ["Two splitters", "Bolted choke", "Decoy row"],
  },

  // ── Chapter 3 · Pressure Plant — two fluids that must never touch ─────────
  {
    chapter: 2, role: "teach",
    hint: "Two fluids: never let the colours touch.",
    solved: ["B─┐.", "R┐└b", ".└─r"],
    taps: [".12.", ".11.", ".11."],
    intent: "TEACH two fluids. Blue and red each need their own route, and their two middle corners sit side by side — at the start they face each other. Aha: if two colours meet, both drains spoil; turn neighbouring corners back to back.",
    mechanics: ["Two fluids", "Keep colours apart"],
  },
  {
    chapter: 2, role: "practise",
    solved: ["B──┐", "┌─┐│", "┃.│b", "R.└r"],
    taps: [".111", "1111", "..1.", "..1."],
    intent: "PRACTISE lanes. Blue owns the top edge and the right side; red is bolted upward out of its source and must hug the INSIDE of blue's lane, then drop to its drain. Aha: red's lane runs directly under blue's — every pipe on that seam must turn its back to the other colour.",
    mechanics: ["Two fluids", "Lanes", "Bolted anchor"],
  },
  {
    chapter: 2, role: "practise",
    solved: ["B┐..", "R└┐.", "└┐└b", ".└─r"],
    taps: [".0..", ".02.", "121.", ".11."],
    intent: "PRACTISE the zipper: two staircases interlock corner-to-corner all the way down. Blue's first two steps already line up as a hint. Aha: every blue corner touches a red one, so solve them as pairs — each pair turns back to back.",
    mechanics: ["Two fluids", "Interlocking staircases"],
  },
  {
    chapter: 2, role: "twist",
    hint: "Can't go through? Go around.",
    solved: ["R─┐.", "B─┃b", "│.r│", "└──┘"],
    taps: [".11.", ".0..", "1..1", "2101"],
    intent: "TWIST the straight line is cut. Blue's source and drain face each other across one row, but red's bolted drop sits right between them. Aha: blue can't go through red — it must swing all the way under red's drain; the loose straight beside the source is a decoy.",
    mechanics: ["Two fluids", "Go around", "Bolted blocker"],
  },
  {
    chapter: 2, role: "combine",
    solved: ["B┬─b", ".│r.", ".││┐", "b┘└R"],
    taps: [".21.", ".1..", ".110", ".11."],
    intent: "COMBINE splitters with two fluids. Blue's tee must feed a drain on the top row AND one at the bottom-left, while red climbs up the middle between blue's arms. Aha: the tee opens left-right-down so its arms straddle red's hook; the two middle columns run side by side and must stay vertical.",
    mechanics: ["Two fluids", "Splitter tee"],
  },
  {
    chapter: 2, role: "finale",
    solved: ["R━┐.b", "B.┃b┃", "│.r│┃", "└━─┴┘"],
    taps: ["..3..", ".....", "1..1.", "2.120"],
    intent: "FINALE of the pressure plant: red's bolted drop walls off the middle, so blue must swing under it AND split to two drains on the right. The bolted pipe on the far-right edge is the pivot. Aha: put the splitter at the bottom-right corner of the swing — one arm climbs to the near drain, the other rides the right edge up to the far one.",
    mechanics: ["Two fluids", "Splitter tee", "Go around", "Bolted pivot"],
  },

  // ── Chapter 4 · Color Lab — cross-overpasses ──────────────────────────────
  {
    chapter: 3, role: "teach",
    hint: "Overpass: fluids cross straight through the + without mixing.",
    solved: ["R─┐..", "B─+─b", "..└─r"],
    taps: [".12..", ".1.1.", "..21."],
    intent: "TEACH the overpass '+': two separate channels, so red can drop beneath blue's row without the colours mixing. Red has to cross blue's row to reach its drain, and the '+' is the only place it can. Aha: line both colours up so each goes STRAIGHT through the '+' — it never turns fluid.",
    mechanics: ["Cross-overpass", "Two fluids"],
  },
  {
    chapter: 3, role: "practise",
    solved: ["B┐.r", ".│.│", "┌+─┘", "R└─b"],
    taps: [".1..", ".1.1", "1.11", ".11."],
    intent: "PRACTISE funnelling into an overpass. Blue runs top-left to bottom-right, red bottom-left to top-right: their routes MUST cross, and the '+' is the single crossing point. Aha: work outward from the '+' — each of its four sides fixes the pipe next to it.",
    mechanics: ["Cross-overpass", "Two fluids"],
  },
  {
    chapter: 3, role: "practise",
    solved: ["R─┐..", "B━+┐.", "..└+┐", "b──┘r"],
    taps: [".12..", "...1.", "..1.1", ".112."],
    intent: "PRACTISE the braid: red and blue cross TWICE, on two overpasses that step diagonally. Aha: between the two '+' each colour takes one corner — red turns down-then-right, blue right-then-down — so the braid repeats.",
    mechanics: ["Two overpasses", "Braid"],
  },
  {
    chapter: 3, role: "twist",
    hint: "A fluid can even cross its own path on an overpass.",
    solved: ["b┐.r", "B+┐│", ".└┘│", "R━─┘"],
    taps: [".1..", "..21", ".121", "..11"],
    intent: "TWIST a fluid crossing ITSELF. Blue enters the overpass, loops round a tight square and comes back through the '+' the other way to reach the drain right above its source. Aha: an overpass isn't only for two colours — blue can bridge its own pipe. Red simply rides the outer edge.",
    mechanics: ["Cross-overpass", "Self-crossing loop"],
  },
  {
    chapter: 3, role: "combine",
    solved: [".B┐.b", "R┐├━┘", ".└+─r", "b─┘.."],
    taps: ["..1..", ".12.1", ".1.1.", ".12.."],
    intent: "COMBINE a splitter with an overpass. Blue's tee feeds a near drain to the right and drops its second branch straight through red's overpass to a drain far below. Aha: the tee must open RIGHT and DOWN — the down arm is the only way past red's lane.",
    mechanics: ["Cross-overpass", "Splitter tee", "Two fluids"],
  },
  {
    chapter: 3, role: "finale",
    solved: ["R─┐..", "B━+─┐", "b─+─┘", "..└─r"],
    taps: [".11..", "...11", ".1.11", "..11."],
    intent: "FINALE of the Color Lab: red falls straight down a column with TWO overpasses, and blue hairpins across it twice (out on one row, back on the next) to reach a drain right under its source. Aha: plan the X — both '+' are needed, and the fold at the far right is what turns blue back.",
    mechanics: ["Two overpasses", "Hairpin", "Bolted anchor"],
  },

  // ── Chapter 5 · Refinery Riddles — three fluids ───────────────────────────
  {
    chapter: 4, role: "teach",
    hint: "Three fluids: give each colour its own lane.",
    solved: ["B──┐", "R━┐│", "G┐││", ".grb"],
    taps: [".112", "..21", ".111", "...."],
    intent: "TEACH three fluids: nested L-shaped lanes. Each colour turns down into its drain, the inner one first. Aha: the lanes nest — green's short L sits inside red's, red's inside blue's — so every corner must turn down at its own column without touching its neighbour.",
    mechanics: ["Three fluids", "Nested lanes"],
  },
  {
    chapter: 4, role: "practise",
    solved: [".R┐..", "B━+─┐", "G┐└┐│", ".└grb"],
    taps: ["..1..", "...11", ".2211", ".1..."],
    intent: "PRACTISE three fluids with one overpass. Red has to drop through blue's lane — the central '+' is the only gap — while green tucks into the bottom-left corner beneath both. Aha: decide the crossing first; once red is through the '+', red and blue fold down side by side to their drains.",
    mechanics: ["Three fluids", "Cross-overpass"],
  },
  {
    chapter: 4, role: "practise",
    solved: ["B┐G┌R", ".│││.", "g+┴+g", "b┘.└r"],
    taps: [".3.1.", ".111.", "..2..", ".1.1."],
    intent: "PRACTISE a splitter between two lanes. Blue and red run down the edge lanes; green's source sits between them and has two drains OUTSIDE the lanes. Aha: green's tee must open left and right, and each arm rides an overpass across a lane — its closed side faces down at the blocked plate, and its third arm takes the feed from above.",
    mechanics: ["Three fluids", "Splitter tee", "Two overpasses", "Edge lanes"],
  },
  {
    chapter: 4, role: "twist",
    hint: "Some drains can only be reached over an overpass.",
    solved: ["G─┐r┐", "B━+┐│", "..g│┃", ".b─┘R"],
    taps: [".12.1", "...21", "...1.", "..11."],
    intent: "TWIST the walled-in drain. Green's drain sits inside blue's hook, boxed in on every side. Aha: the only door is the overpass in blue's top wall — green drops straight through blue's lane into its drain, while red climbs the outside edge.",
    mechanics: ["Three fluids", "Cross-overpass", "Enclosed drain"],
  },
  {
    chapter: 4, role: "combine",
    solved: ["B━┬─b", "R━+─┐", "G━+┐│", "b─┘gr"],
    taps: ["..31.", "...11", "...31", ".11.."],
    intent: "COMBINE everything: blue's splitter drops a branch down a column of TWO overpasses, so red and green each cross it once, while its other arm runs to the top-right drain. Aha: the tee must open RIGHT and DOWN; then red and green just run straight through their own '+' and turn down at the right edge.",
    mechanics: ["Three fluids", "Splitter tee", "Two overpasses", "Bolted anchor"],
  },
  {
    chapter: 4, role: "finale",
    solved: ["R┐.┌G", "B+┐┃.", "r┘└+┐", ".g─┘b"],
    taps: [".2.2.", "..1..", ".21.1", "..11."],
    intent: "FINALE — the offset X. Blue zig-zags down the board through TWO overpasses: over red's column, then over green's. Aha: the corner pair between the two '+' is the hinge — blue turns down then right to line up with the second overpass, while red and green each fold home underneath.",
    mechanics: ["Three fluids", "Double crossover", "Bolted anchor"],
  },
];
