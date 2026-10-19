# Flow Forge — Level Plan

Every level is hand-authored in `src/game/designs.ts` (solved board + scramble) and compiled by
`src/game/levels.ts`. Move budgets are measured with the factory's bots (`scripts/tune-levels.ts`
replays the QA playtest exactly) and stored in `src/game/budgets.json`. `npm run levels` reports the
solver facts (optimal taps, branching, trap rate) on the real engine; `npx tsx scripts/level-lab.ts`
is the quick designer's bench.

## Design rules we hold every board to
- **One idea per level**, stated below as its aha. New mechanics appear alone on a small board, are
  practised 2-3 times, twisted, then combined; each chapter ends on a finale and the next chapter opens
  with a gentler teach level (the breather).
- **No dead space:** boards are cropped to the puzzle (3x2 up to 5x4). Blocked plates only where they shape
  a route.
- **Fair:** everything is visible; every board settles under the solver's search cap; budgets always leave
  room for at least one wrong tap (par + 2 or more).
- **Anchors over brute force:** later levels use bolted pipes and overpasses to cut the loose-pipe count
  (8-9 loose pipes max), so difficulty comes from reading the board, not spinning everything.

## Mechanics
| Mechanic | Introduced | Notes |
|---|---|---|
| Rotate pipes (straight / elbow) | L1 | tap = quarter turn clockwise |
| Drain mouths | L3 | a source or drain only connects through its one open side |
| Decoy pipes | L4 | loose pipes the route never uses |
| Bolted pipes | L7 | riveted plate, cannot rotate: anchors and clues |
| Splitter tee, several drains | L8 | one source can fill several drains of its colour |
| Two fluids | L13 | if colours touch, both drains spoil |
| Cross-overpass `+` | L19 | two channels: fluids pass straight through without mixing |
| Three fluids | L25 | |


## Chapter 1 — Workshop Basics (L1–L6)
One fluid. Learn to rotate, read the drain's mouth and ignore decoys.

- **L1 · teach** (3x2, par 3) — tap-to-rotate. A U-turn: the bottom straight already lines up, so the player sees what 'connected' looks like and only has to turn the top straight and both corners. Aha: each tap turns a pipe a quarter turn, and fluid follows as soon as the ends meet. *Why here:* first contact — three taps, nothing to misread. It is GUIDED: a faint dotted line traces the route the water will take, the next pipe on it glows and the hand taps it, and a coach card says the water flows by itself (no start button) with a live "N pipes to go" count; the drain throbs after the first correct turn. `B│┌ / b─┐`
- **L2 · teach** (3x3, par 5) — corners chain together. A full 3x3 zig-zag with no spare cells: every elbow's turn is set by the pipe before it. Aha: follow the fluid tile by tile from the source — fix one corner, then the next one is obvious. *Why here:* one step up: a full board where every corner matters, still no choices. `B│┌ / └─┐ / ┘─b`
- **L3 · teach** (4x3, par 7) — the route is not the straight line. The path dips into a little valley (down, right, back up) before heading round to the drain beside the source. Aha: the drain's open mouth faces right, so the fluid must loop all the way round — read the drain before you start. *Why here:* first idea beyond 'line it up': the drain's mouth decides the route. `B┌└┌ / .┘┐│ / b─│┐`
- **L4 · practise** (4x4, par 8) — ignoring decoys. The first corner starts pointing down into two spare pipes that lead to a dead end beside the drain. Aha: not every pipe belongs to the route — the drain only opens to the right, so the fluid must climb over the top and come down the right edge. *Why here:* first choice — a decoy branch, on a board still small enough to see whole. `.└│└ / B┐.─ / .└┘─ / ..b┐`
- **L5 · twist** (4x3, par 8) — the short way is a trap. At the start the fluid already runs down and along the bottom row — straight into the back of the drain, which only opens upward. Aha: undo the obvious route (the first corner needs three taps, all the way round) and go over the top to drop into the drain's open mouth. *Why here:* twists L3+L4: the decoy is now the route the fluid already takes. `└││┌ / ┌B.─ / └──b`
- **L6 · finale** (4x3, par 9) — of the basics: the fork. The source sits in the middle and its first corner can turn LEFT — a two-pipe hop that ends at the back of the drain — or RIGHT, the long loop round the edge. It starts out pointing left, so the fluid already pours into that hop. Aha: read the drain first (it opens to the right), commit to the long loop, and leave the left column alone. *Why here:* finale: all three basics (mouths, decoys, undoing the obvious) on one compact fork. `┌┘│└ / │B.─ / b─│┌`

## Chapter 2 — Factory Floor (L7–L12)
Bolted pipes as anchors, and splitter tees that feed several drains.

- **L7 · teach** (5x3, par 7) — bolted pipes (riveted plates, can't turn). The two bolted corners beside the source and drain both point UP, so the route must bridge over the top — even though a loose row along the bottom looks like a straight shot. Aha: bolted pieces are clues, not obstacles: build from them. *Why here:* chapter opener and breather after L6; one new idea (bolts) on an easy route. `.┐│┘. / B┛.┗b / ┌───┘`
- **L8 · teach** (4x3, par 7) — splitters: one source, TWO drains, and a tee that feeds both. Aha: a tee sends fluid down every arm at once — face its arms down and right, with its flat back to the blocked plate. *Why here:* second new tool, introduced alone on a tiny board. `B┌.b / .┤│┐ / b┌..`
- **L9 · practise** (4x4, par 8) — splitters with a bolted feed. The bolted corridor drops onto a loose tee that starts facing right, pouring into a decoy column that ends at the back of the right drain. Aha: the right drain is fed from the middle column, so the tee must open LEFT and DOWN — away from the decoy. *Why here:* practise: splitter + bolts + a decoy, each from earlier levels. `B━┓. / .└├┐ / .──│ / b┐┐b`
- **L10 · practise** (4x4, par 8) — chained splitters: three drains from one source via two tees standing back to back. Bolted pipes anchor both ends of the trunk. Aha: the second tee is fed through its SIDE arm by the first, so it opens up and down; the corner pipes hugging the top drains are decoys that only touch their closed backs. *Why here:* practise with more drains; bolted trunk keeps the search small. `b└┘b / └┴├┘ / .─┃. / B┛┃.`
- **L11 · twist** (4x3, par 8) — a bolted splitter that faces DOWN. The fluid has to climb up the tee's stem; its left arm then needs a corner that turns down the middle column. Aha: a tee can be entered from any arm — and the edge column (where the first corner starts out pointing) is a dead end against the drain's back. *Why here:* twist on the splitter: fed through the stem instead of from the side. `┌┐┳b / │──. / b┌┘B`
- **L12 · finale** (5x4, par 9) — of the factory floor: one source, three drains, two splitters joined by a bolted choke. The bottom row looks like a straight run to the nearest drain — but that drain opens upward. Aha: everything flows UP through the first tee, across the bolted bar, and the second tee sends a branch back down and round into the bottom drain. *Why here:* finale: two splitters, a choke and a decoy row — everything from the chapter. `b└.└b / .┴━├. / .─.┘┌ / .B──b`

## Chapter 3 — Pressure Plant (L13–L18)
Two fluids that must never touch: lanes, seams, going around.

- **L13 · teach** (4x3, par 7) — two fluids. Blue and red each need their own route, and their two middle corners sit side by side — at the start they face each other. Aha: if two colours meet, both drains spoil; turn neighbouring corners back to back. *Why here:* chapter opener / breather: second colour on a 4x3 board with only one contact point. `B│└. / R┌┘b / .┘│r`
- **L14 · practise** (4x4, par 9) — lanes. Blue owns the top edge and the right side; red is bolted upward out of its source and must hug the INSIDE of blue's lane, then drop to its drain. Aha: red's lane runs directly under blue's — every pipe on that seam must turn its back to the other colour. *Why here:* practise: longer shared seam between two lanes. `B││┌ / └│┌─ / ┃.─b / R.┘r`
- **L15 · practise** (4x4, par 8) — the zipper: two staircases interlock corner-to-corner all the way down. Blue's first two steps already line up as a hint. Aha: every blue corner touches a red one, so solve them as pairs — each pair turns back to back. *Why here:* practise: contact on every step (zipper) with a hint line to start from. `B┐.. / R└└. / ┘└┘b / .┘│r`
- **L16 · twist** (4x4, par 8) — the straight line is cut. Blue's source and drain face each other across one row, but red's bolted drop sits right between them. Aha: blue can't go through red — it must swing all the way under red's drain; the loose straight beside the source is a decoy. *Why here:* twist: the colours can't cross yet, so one must go around. `R│┌. / B─┃b / ─.r─ / ┐│─┐`
- **L17 · combine** (4x4, par 8) — splitters with two fluids. Blue's tee must feed a drain on the top row AND one at the bottom-left, while red climbs up the middle between blue's arms. Aha: the tee opens left-right-down so its arms straddle red's hook; the two middle columns run side by side and must stay vertical. *Why here:* combine: two fluids + a splitter. `B┴│b / .─r. / .──┐ / b┐┘R`
- **L18 · finale** (5x4, par 10) — of the pressure plant: red's bolted drop walls off the middle, so blue must swing under it AND split to two drains on the right. The bolted pipe on the far-right edge is the pivot. Aha: put the splitter at the bottom-right corner of the swing — one arm climbs to the near drain, the other rides the right edge up to the far one. *Why here:* finale: go-around + splitter + bolted pivot. `R━┘.b / B.┃b┃ / ─.r─┃ / ┐━│┬┘`

## Chapter 4 — Color Lab (L19–L24)
The cross-overpass: let fluids cross without mixing.

- **L19 · teach** (5x3, par 8) — the overpass '+': two separate channels, so red can drop beneath blue's row without the colours mixing. Red has to cross blue's row to reach its drain, and the '+' is the only place it can. Aha: line both colours up so each goes STRAIGHT through the '+' — it never turns fluid. *Why here:* chapter opener / breather: the overpass alone, one obvious crossing. `R│└.. / B│+│b / ..┐│r`
- **L20 · practise** (4x4, par 8) — funnelling into an overpass. Blue runs top-left to bottom-right, red bottom-left to top-right: their routes MUST cross, and the '+' is the single crossing point. Aha: work outward from the '+' — each of its four sides fixes the pipe next to it. *Why here:* practise: the crossing is forced by the endpoints' positions. `B┌.r / .─.─ / └+│┐ / R┘│b`
- **L21 · practise** (5x4, par 10) — the braid: red and blue cross TWICE, on two overpasses that step diagonally. Aha: between the two '+' each colour takes one corner — red turns down-then-right, blue right-then-down — so the braid repeats. *Why here:* practise: two crossings in a row. `R│└.. / B━+┌. / ..┘+┌ / b││┌r`
- **L22 · twist** (4x4, par 10) — a fluid crossing ITSELF. Blue enters the overpass, loops round a tight square and comes back through the '+' the other way to reach the drain right above its source. Aha: an overpass isn't only for two colours — blue can bridge its own pipe. Red simply rides the outer edge. *Why here:* twist: the overpass used by a single colour. `b┌.r / B+└─ / .┘┌─ / R━│┐`
- **L23 · combine** (5x4, par 10) — a splitter with an overpass. Blue's tee feeds a near drain to the right and drops its second branch straight through red's overpass to a drain far below. Aha: the tee must open RIGHT and DOWN — the down arm is the only way past red's lane. *Why here:* combine: overpass + splitter. `.B┌.b / R┌┤━┐ / .┘+│r / b│┌..`
- **L24 · finale** (5x4, par 9) — of the Color Lab: red falls straight down a column with TWO overpasses, and blue hairpins across it twice (out on one row, back on the next) to reach a drain right under its source. Aha: plan the X — both '+' are needed, and the fold at the far right is what turns blue back. *Why here:* finale: two overpasses on one column, a hairpin. `R│┌.. / B━+│┌ / b│+│┐ / ..┘│r`

## Chapter 5 — Refinery Riddles (L25–L30)
Three fluids, combining overpasses, splitters and bolts.

- **L25 · teach** (4x4, par 10) — three fluids: nested L-shaped lanes. Each colour turns down into its drain, the inner one first. Aha: the lanes nest — green's short L sits inside red's, red's inside blue's — so every corner must turn down at its own column without touching its neighbour. *Why here:* chapter opener: three fluids, no overpass, so the new colour is the only new thing. `B││└ / R━└─ / G┌── / .grb`
- **L26 · practise** (5x4, par 10) — three fluids with one overpass. Red has to drop through blue's lane — the central '+' is the only gap — while green tucks into the bottom-left corner beneath both. Aha: decide the crossing first; once red is through the '+', red and blue fold down side by side to their drains. *Why here:* practise: three fluids + one overpass. `.R┌.. / B━+│┌ / G└┐┌─ / .┘grb`
- **L27 · practise** (5x4, par 11) — a splitter between two lanes. Blue and red run down the edge lanes; green's source sits between them and has two drains OUTSIDE the lanes. Aha: green's tee must open left and right, and each arm rides an overpass across a lane — its closed side faces down at the blocked plate, and its third arm takes the feed from above. *Why here:* practise: three fluids + splitter + two overpasses, symmetric and readable. `B┘G└R / .───. / g+┬+g / b┐.┘r`
- **L28 · twist** (5x4, par 10) — the walled-in drain. Green's drain sits inside blue's hook, boxed in on every side. Aha: the only door is the overpass in blue's top wall — green drops straight through blue's lane into its drain, while red climbs the outside edge. *Why here:* twist: the overpass as the only door into an enclosed drain. `G│└r┌ / B━+└─ / ..g─┃ / .b│┐R`
- **L29 · combine** (5x4, par 12) — everything: blue's splitter drops a branch down a column of TWO overpasses, so red and green each cross it once, while its other arm runs to the top-right drain. Aha: the tee must open RIGHT and DOWN; then red and green just run straight through their own '+' and turn down at the right edge. *Why here:* combine: splitter feeding a column of two overpasses crossed by both other colours. `B━┤│b / R━+│┌ / G━+┘─ / b│┐gr`
- **L30 · finale** (5x4, par 11) — — the offset X. Blue zig-zags down the board through TWO overpasses: over red's column, then over green's. Aha: the corner pair between the two '+' is the hinge — blue turns down then right to line up with the second overpass, while red and green each fold home underneath. *Why here:* finale: the offset X — a planned double crossover through two different colours. `R└.┘G / B+┌┃. / r┌┘+┌ / .g│┐b`

