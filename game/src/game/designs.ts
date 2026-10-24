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
  "Filter Works",
  "Gearworks",
  "Blend Lab",
  "Night Shift",
  "Grand Refinery",
];

export type Role = "teach" | "practise" | "twist" | "combine" | "finale" | "breather";

export interface Design {
  chapter: number;
  role: Role;
  solved: string[];
  taps: string[];
  /** Pin an endpoint's mouth ("row,col" → side) where decoys make it ambiguous. */
  mouths?: Record<string, "N" | "E" | "S" | "W">;
  /** Filter gates ("row,col" → colour letter): that pipe only lets its own colour through. */
  gates?: Record<string, "b" | "r" | "g" | "y">;
  /** Geared pipes: each entry lists "row,col" cells (loose pipes) that turn together. */
  gears?: string[][];
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
  // ── Chapter 6 · Filter Works — colour filters: only their own colour gets through ──
  {
    chapter: 5, role: "teach",
    hint: "A filter only lets its own colour through. Fluids may share a pipe before it.",
    solved: ["B┐┌b", ".├┤.", "R┘└r"],
    taps: [".12.", ".12.", ".01."],
    gates: { "0,2": "b", "2,2": "r" },
    intent: "TEACH colour filters. Both sources pour into the same two middle pipes — for 30 levels that meant spoiled drains — but each drain sits behind a filter of its own colour. Aha: fluids MAY share a pipe now; the blue filter lets only blue through to the blue drain, the red one only red.",
    mechanics: ["Colour filters", "Shared pipe"],
  },
  {
    chapter: 5, role: "practise",
    solved: ["B┬━┌b", ".├━┤.", "R┤━└r"],
    taps: [".2.1.", ".1.1.", ".1.2."],
    gates: { "0,2": "r", "2,2": "b", "0,3": "b", "2,3": "r" },
    intent: "PRACTISE filters as walls. The top and bottom rows look like free straight runs to each drain, but each is barred by a BOLTED filter of the OTHER colour. Aha: blue cannot pass a red filter — both fluids must dive into the shared middle bar, and the loose filters at the far end sort them back out.",
    mechanics: ["Colour filters", "Bolted filters", "Shared pipe"],
  },
  {
    chapter: 5, role: "practise",
    solved: ["b━┬━b", "r─┤..", "B─┴─R"],
    taps: ["..2..", ".12..", ".111."],
    gates: { "0,2": "b", "1,1": "r" },
    intent: "PRACTISE a filter SPLITTER. Blue and red meet in the bottom trunk; a blue-filter tee lifts only blue out of the mix and sends it to BOTH top drains, while red must leave the trunk earlier through its own filter on the left. Aha: the middle tee must open left, up and down, so red peels off through its filter before the blue filter shuts it out.",
    mechanics: ["Colour filters", "Splitter tee", "Shared pipe", "Decoy branch"],
  },
  {
    chapter: 5, role: "twist",
    hint: "Filters can sort fluids to either side.",
    solved: ["B─┬─R", "..│..", "r─┴─b"],
    taps: [".12..", "..1..", "..31."],
    gates: { "2,1": "r", "2,3": "b" },
    intent: "TWIST: swap sides without an overpass. Blue starts top-left but its drain is bottom-right, red the reverse, and the only link between the rows is one shared drop. Aha: let both fluids fall down the same pipe — the filters at the bottom send each colour to the far side. Sharing replaces crossing.",
    mechanics: ["Colour filters", "Swap sides", "Shared pipe"],
  },
  {
    chapter: 5, role: "combine",
    solved: ["B┐G┌r", ".├+┤.", "R┘g└b"],
    taps: [".1.2.", ".2.1.", ".3.1."],
    gates: { "0,3": "r", "2,3": "b" },
    intent: "COMBINE filters with an overpass and three fluids. Green falls straight down the middle while blue and red share a trunk that must cross it. Aha: the mixed trunk rides the overpass's left-right channel, so green never joins the mix — then the filters swap blue and red to the opposite corners.",
    mechanics: ["Colour filters", "Cross-overpass", "Three fluids", "Swap sides"],
  },
  {
    chapter: 5, role: "finale",
    solved: ["B.R.G", "├┬┴─┤", "││..│", "gr..b"],
    taps: ["....." , "21311", "11..1", "....."],
    gates: { "2,0": "g", "2,1": "r", "2,4": "b" },
    intent: "FINALE of Filter Works: three fluids, ONE trunk. All three sources pour into the same bar and the three filters below hand each colour to its own drain — in a different order from the sources. Aha: stop keeping colours apart; connect everything into one trunk and let the filters do the sorting, then check each drop's tee faces down.",
    mechanics: ["Colour filters", "Three fluids", "Shared trunk", "Splitter tees"],
  },

  // ── Chapter 7 · Gearworks — geared pipes turn together ──────────────────────
  {
    chapter: 6, role: "teach",
    hint: "Pipes with gears turn together. One tap turns both.",
    solved: ["B┐.b", ".└─┘"],
    taps: [".2..", ".212"],
    gears: [["0,1", "1,3"]],
    intent: "TEACH geared pipes. The two corners at either end of the dip are linked by gears and both need a half turn. Aha: one tap on either turns BOTH — two taps line up two corners at once.",
    mechanics: ["Geared pipes"],
  },
  {
    chapter: 6, role: "practise",
    solved: ["B─┐.", ".┌┘.", ".└─b"],
    taps: [".01.", ".12.", ".11."],
    gears: [["0,1", "1,2"], ["0,2", "2,2"]],
    intent: "PRACTISE gears that join different shapes. The first straight already lines up, but it is geared to a corner that needs a half turn. Aha: turning the pair once knocks the straight out — turn it twice and the straight is back where it was while the corner flips round.",
    mechanics: ["Geared pipes", "Half turn"],
  },
  {
    chapter: 6, role: "practise",
    solved: ["B──┐", "R┐.│", ".└┐│", ".r┘b"],
    taps: [".101", ".2.1", ".310", "..2."],
    gears: [["0,3", "2,2"], ["0,2", "1,1"]],
    intent: "PRACTISE gears across two fluids. Blue's lane runs round the outside and red's tucks inside it, and each gear pair links a blue pipe to a red one. Aha: read each pair as ONE piece — fixing blue's corner fixes red's at the same time, and the straight on blue's top row comes back after the half turn its red partner needs.",
    mechanics: ["Geared pipes", "Two fluids", "Lanes"],
  },
  {
    chapter: 6, role: "twist",
    hint: "A pipe's gear partner turns with it. Watch both.",
    solved: ["R──┐", "B┴b│", ".┐┳┘", "..r."],
    taps: [".112", ".2.1", ".2.1", "...."],
    gears: [["1,1", "2,1"]],
    intent: "TWIST: the gear partner decides. Blue's tee can carry blue to its drain facing DOWN or facing UP, and down looks natural — but its geared partner then swings round into the spare arm of red's bolted tee and the colours mix. Aha: a half turn of the pair points the tee's spare arm harmlessly against the side of red's top lane and turns the partner away from red.",
    mechanics: ["Geared pipes", "Two fluids", "Bolted splitter"],
  },
  {
    chapter: 6, role: "combine",
    solved: [".┏─┐.", "B┐.┌b", ".│.│.", ".└─┘."],
    taps: ["..13.", ".1.2.", ".1.1.", ".213."],
    gears: [["1,1", "0,2"], ["0,3", "3,3"]],
    intent: "COMBINE gears with the long way round. The top route is three-quarters built and only needs its two corners turned — but the left corner is geared to the top straight, and whenever that corner points up the straight stands on end. Aha: the gears forbid the short route, so take the long loop under the board; the top pieces are decoys that just turn along.",
    mechanics: ["Geared pipes", "Decoy route", "Long way round"],
  },
  {
    chapter: 6, role: "finale",
    solved: ["R──┐.", "B┴─+┐", ".┐┳┘│", "..r.b"],
    taps: [".112.", ".20.3", ".2.11", "....."],
    gears: [["1,1", "2,1"], ["0,3", "1,2"]],
    intent: "FINALE of Gearworks: blue crosses red's loop on the overpass. Blue's first tee can face down or up; down looks right, but its geared partner then joins blue to the spare arm of red's bolted splitter. Aha: give the pair a half turn so the tee's spare arm rests against the side of red's top lane — and red's corner over the overpass needs a half turn too, which leaves its geared blue straight exactly where it was.",
    mechanics: ["Geared pipes", "Cross-overpass", "Two fluids", "Half turn"],
  },

  // ── Chapter 8 · Blend Lab — mixer vats need two colours ON PURPOSE ─────────
  {
    chapter: 7, role: "teach",
    hint: "The purple vat needs BOTH blue and red. Mix them on purpose!",
    solved: ["B┐.", ".├p", "R┘."],
    taps: [".1.", ".3.", ".1."],
    intent: "TEACH the mixer vat. For seven chapters touching colours spoiled everything; this purple vat is only satisfied when BOTH blue and red pour in. Aha: join the two lanes into one tee on purpose and send the blend into the vat.",
    mechanics: ["Mixer vat", "Merge on purpose"],
  },
  {
    chapter: 7, role: "practise",
    solved: [".┌B..", "R┴─┬p", "b──┘."],
    taps: [".2...", ".211.", ".011."],
    gates: { "2,1": "b" },
    intent: "PRACTISE a vat and a pure drain on one pipe. Blue and red meet at the first tee and the blend runs right, where a second tee feeds the vat AND loops back along the bottom to the blue drain. Aha: the blue drain is fed by the same mixed pipe, but its blue filter strips the red out — so mix early and let the filter clean up.",
    mechanics: ["Mixer vat", "Colour filters", "Splitter tee"],
  },
  {
    chapter: 7, role: "practise",
    solved: [".┌r.b", "p┤.┌┘", "B┴─┴R"],
    taps: [".3...", ".0.22", ".103."],
    gates: { "0,1": "r", "1,4": "b" },
    intent: "PRACTISE one network, three outlets. Both sources sit on the bottom bar, so everything is mixed; the vat takes the blend straight from the left tee, while the red drain and the blue drain each hang behind a filter of their colour at opposite corners. Aha: every tee on the bar must open UP — one network can serve a vat and two pure drains at once.",
    mechanics: ["Mixer vat", "Colour filters", "Shared trunk"],
  },
  {
    chapter: 7, role: "twist",
    hint: "An overpass never mixes. Cross first, then join.",
    solved: ["..┌━R", "B┬+─┐", ".│└━┤", ".b..p"],
    taps: ["..1..", ".2.12", ".11.1", "....."],
    gates: { "2,1": "b" },
    intent: "TWIST: an overpass never mixes. The vat needs blue and red, and their lanes meet head-on at the overpass — the obvious place to blend them, where nothing blends. Aha: let both cross straight through it, then join them at the tee beyond on the right; blue's own drain hangs below the first tee behind a blue filter, so the blend that floods back across the overpass can't spoil it.",
    mechanics: ["Mixer vat", "Cross-overpass", "Colour filters", "Cross then merge"],
  },
  {
    chapter: 7, role: "combine",
    solved: ["b┳─┬B", ".─.│.", "p┻─┴R"],
    taps: ["..13.", ".1.1.", "..13."],
    gates: { "1,3": "b" },
    gears: [["1,1", "1,3"], ["0,3", "2,3"]],
    intent: "COMBINE gears with the vat. Blue's top lane runs left to its drain and must also feed the vat at the end of red's bottom lane. Two uprights can bridge the lanes, and they are geared so only one stands at a time: the plain one on the left (standing at the start) or the blue filter on the right. Aha: through the plain bridge red climbs straight into blue's drain; through the filter blue pours down but red can never climb back — a filter is a one-way valve. Turn the pair so the filter stands.",
    mechanics: ["Mixer vat", "Geared pipes", "Colour filters", "One-way valve"],
  },
  {
    chapter: 7, role: "finale",
    solved: [".pb┐.", "G+┐├B", "R┴+┴┐", "..└gr"],
    taps: ["...2.", "..12.", ".3.02", "..2.."],
    gates: { "0,3": "b", "2,4": "r" },
    intent: "FINALE of the Blend Lab: red sits under the vat but blue's source is on the far right, so blue must run back left through BOTH overpasses that green zig-zags across, meeting red at the tee under the vat; meanwhile red also flows right to its own drain and blue up to its own, each behind a filter. Aha: the overpasses keep green out of the mix both times — plan green's zig-zag first, then every tee simply opens toward the vat and the filters.",
    mechanics: ["Mixer vat", "Colour filters", "Two overpasses", "Three fluids"],
  },

  // ── Chapter 9 · Night Shift — every tool on the bench, three at a time ─────
  {
    chapter: 8, role: "breather",
    solved: ["B.R", "└┬┘", "┌┴┐", "p.p"],
    taps: ["...", "112", "201", "..."],
    intent: "BREATHER: blend once, fill twice. Blue and red fall into one tee in the middle, and the blend must split again to TWO vats in the bottom corners. Aha: a splitter works on a blend just like on a pure fluid — turn the upper tee to catch both sources and the lower tee to open left and right.",
    mechanics: ["Mixer vat", "Splitter tee", "Two vats"],
  },
  {
    chapter: 8, role: "practise",
    solved: ["B.G.R", "└┬+┬┘", ".│││.", ".rgb."],
    taps: [".....", "12.31", ".101.", "....."],
    gates: { "2,1": "r", "2,3": "b" },
    gears: [["1,0", "1,4"], ["1,1", "2,2"]],
    intent: "PRACTISE swapping through a blend while a third fluid drops straight through it. Blue and red pour into one bar that green crosses on the overpass, and the two filters hand each colour to the OPPOSITE side. Aha: the overpass keeps green out of the shared bar; the left tee is geared to green's drop, so its half turn leaves green's straight standing, and the two corners under the sources turn as one pair.",
    mechanics: ["Colour filters", "Cross-overpass", "Geared pipes", "Swap sides", "Three fluids"],
  },
  {
    chapter: 8, role: "practise",
    solved: ["r┐┌━┐", "B┤bR┃", ".└━┴┘"],
    taps: [".12.1", ".2...", ".1.31"],
    gates: { "0,1": "r", "0,2": "b" },
    gears: [["0,4", "2,4"]],
    intent: "PRACTISE the long way round a shared loop. Blue's drain sits inside the loop right under a blue-filter door, one step from the source — but the short way up is barred by red's filter. Aha: blue must run all the way round the loop, through red's half of it, and come in through the door from the far side, while red takes the short way to its drain through its own filter. Both fluids share the bottom of the loop and nothing spoils. The two right-hand corners are geared.",
    mechanics: ["Colour filters", "Shared loop", "Long way round", "Geared pipes"],
  },
  {
    chapter: 8, role: "twist",
    hint: "Filters can pick colours OUT of a mix — and they can meet again.",
    solved: ["B┬─┐.", ".├─┻p", "G┤...", "R┴━g."],
    taps: [".212.", ".31..", ".1...", ".2..."],
    gates: { "0,2": "r", "1,2": "b", "3,2": "g" },
    intent: "TWIST: sort, then blend again. All three sources feed one spine down the left, so everything in it is mixed — but the vat must get blue and red WITHOUT green. Aha: send red out along the top through the red filter and blue out through the blue filter, then let the two pure streams rejoin at the bolted tee in front of the vat; green leaves only through its own filter at the bottom. Filters don't just separate — they choose who gets to mix.",
    mechanics: ["Mixer vat", "Colour filters", "Three fluids", "Re-blend"],
  },
  {
    chapter: 8, role: "combine",
    solved: ["p┐.G.", "B+┐│.", "R┴┘└┐", "...g┘"],
    taps: [".1...", "..20.", ".3131", "....2"],
    gears: [["2,2", "2,4"], ["1,2", "1,3"]],
    intent: "COMBINE a self-crossing loop with the vat. The vat sits right above blue's source, but blue first has to run through the overpass, swing down to collect red at the bottom tee, and bring the blend back UP through the same overpass. Aha: the overpass lets the blend cross its own pipe without short-circuiting. Green hooks round on the right, and its corners are geared to the loop's: a half turn on the upper pair keeps green's straight upright.",
    mechanics: ["Mixer vat", "Self-crossing loop", "Cross-overpass", "Geared pipes", "Three fluids"],
  },
  {
    chapter: 8, role: "finale",
    solved: ["R┓.┌p", ".└┬┘.", "G━+━g", "B┐│┌b", ".└┴┛."],
    taps: ["...2.", ".231.", ".....", ".112.", ".13.."],
    gates: { "3,2": "b" },
    gears: [["1,1", "3,3"], ["1,3", "3,1"]],
    intent: "FINALE of the Night Shift: the vat is up in red's corner, blue's source and pure drain are down at the bottom, and green's bolted lane runs straight across the middle. Aha: blue climbs from its bottom tee up through the blue filter and over green on the overpass to meet red's tee — the filter lets blue rise but stops red falling into blue's drain. The corner pairs are geared diagonally across the board: line up one hook and its mirror comes with it.",
    mechanics: ["Mixer vat", "Colour filters", "One-way valve", "Cross-overpass", "Geared pipes", "Three fluids"],
  },

  // ── Chapter 10 · Grand Refinery — the whole plant, every trick at once ─────
  {
    chapter: 9, role: "breather",
    solved: ["R┬r", ".│.", "p┤.", ".│.", "B┴b"],
    taps: [".2.", ".1.", ".3.", ".1.", ".2."],
    gates: { "1,1": "r", "3,1": "b" },
    intent: "BREATHER: two one-way valves. Red's lane runs along the top, blue's along the bottom, and the vat waits halfway up the spine between them. Aha: the red filter lets red fall to the vat but stops blue climbing to the red drain, and the blue filter does the same from below — both pure drains and the blend share one spine.",
    mechanics: ["Mixer vat", "Colour filters", "One-way valve"],
  },
  {
    chapter: 9, role: "practise",
    solved: ["B┐p┌r", ".├┴┤.", "R┘.└b"],
    taps: [".1.3.", ".231.", ".3.1."],
    gates: { "0,3": "r", "2,3": "b" },
    gears: [["0,1", "2,3"], ["2,1", "0,3"]],
    intent: "PRACTISE swap and blend in one trunk. Blue and red share the middle bar; the vat drinks the blend straight from the bar's centre tee, while the filters at the far end swap the pure colours to the opposite corners. Aha: one trunk can do three jobs at once — open the centre tee upward to the vat and both end tees toward the filters. The corner pairs are geared corner-to-filter across the board.",
    mechanics: ["Mixer vat", "Colour filters", "Swap sides", "Geared pipes"],
  },
  {
    chapter: 9, role: "practise",
    solved: ["B┐Gg┐", "R┴+p│", "..└─┘"],
    taps: [".1..2", ".2..1", "..311"],
    gears: [["0,1", "2,4"]],
    intent: "PRACTISE the walled-in vat. The vat sits inside green's loop, boxed in by green pipe on every side, and green's drain is right next to it. Aha: blend blue and red OUTSIDE the loop at the left tee, then send the blend straight through the overpass in green's wall — the overpass is the only door, and green flows across it without mixing.",
    mechanics: ["Mixer vat", "Cross-overpass", "Enclosed drain", "Three fluids", "Geared pipes"],
  },
  {
    chapter: 9, role: "twist",
    hint: "A filter in the wrong place can starve the vat.",
    solved: ["B┳━┬┐", ".┃R││", ".┗└┘p"],
    taps: ["...21", "...11", "..21."],
    gates: { "0,2": "b" },
    intent: "TWIST: a filter can starve the vat. A bolted bridge on the left is already built, and red's elbow needs just one turn to join blue's lane through it — but that joins red BEFORE the blue filter in the lane, which strips the red straight back out and the vat never sees it. Aha: turn red's elbow the other way and bring it up the right-hand column to join blue AFTER the filter, right before the vat.",
    mechanics: ["Mixer vat", "Colour filters", "Merge after the filter", "Bolted decoy bridge"],
  },
  {
    chapter: 9, role: "combine",
    solved: ["b..┌r", "└┐G+g", ".├─┤.", "B┴Rp."],
    taps: ["...1.", "22...", ".212.", ".2..."],
    gates: { "1,0": "b", "0,3": "r" },
    gears: [["1,1", "2,3"]],
    intent: "COMBINE vats, filters and an overpass with three fluids. Blue and red sit side by side on the bottom row and blend at once; the vat drinks from below, the blue drain hangs top-left behind its filter, and the red drain is top-right — on the far side of green's lane. Aha: red's way home climbs straight UP through the overpass in green's lane, and the red filter at the top keeps the blend's blue out of it. The left elbow and the right tee are geared, so both must be read together.",
    mechanics: ["Mixer vat", "Colour filters", "Cross-overpass", "Three fluids", "Geared pipes"],
  },
  {
    chapter: 9, role: "finale",
    solved: ["B┬─━┐", ".┣─┐┃", "G┤.├┘", ".├━+g", ".R.p."],
    taps: [".11.3", "..12.", ".2.23", ".3...", "....."],
    gates: { "0,2": "r", "1,2": "b", "3,2": "g" },
    gears: [["0,4", "2,4"], ["1,3", "2,1"]],
    intent: "GRAND FINALE: the whole refinery. Blue, green and red all pour into one spine on the left, so the spine is a three-colour mix. Aha: pull red out along the top through its filter and blue through the one below, rejoin them on the right and drop the blend straight down through the overpass into the vat — while green leaves through its own bolted filter and crosses that same overpass sideways to its drain. Sort, re-blend and cross, with geared corners tying red's return path to the spine.",
    mechanics: ["Mixer vat", "Colour filters", "Re-blend", "Cross-overpass", "Geared pipes", "Three fluids", "Bolted pipes"],
  },
];
