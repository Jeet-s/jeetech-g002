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
| Colour filters | L31 | a filter pipe passes only its own colour: fluids may share pipes, only drains must be pure; also walls (L32), splitters (L33), doors (L51) and one-way valves (L47) |
| Geared pipes | L37 | linked pipes turn together; economy (L37), half turns (L38), the partner decides (L40), gear-locked routes (L41) |
| Mixer vat (purple drain) | L43 | needs blue AND red together, nothing else; merge on purpose, cross-then-merge (L46), re-blend after sorting (L52) |

Campaign: **60 levels in 10 chapters**. Levels 1-30 are the original campaign, kept exactly as they were (same
boards, same numbering) so every player's reached level and stars stay valid; levels 31-60 are new chapters
built on top. Each chapter introduces or twists one idea: teach → practise ×2 → twist → combine → finale, and
the next chapter opens with a gentler level. Every new board is checked with `npx tsx scripts/design-try.ts <n>`
(it enumerates EVERY winning board: new levels have exactly one answer) and budgets are tuned with
`scripts/tune-levels.ts` (an exact, fast replica of the factory playtest).



## Meta: why players come back (src/game/meta.ts, visible from the title screen)
- **Daily Pipework**: one board a day. It takes a campaign network the player has already reached (L6 or
  later, never a tutorial) and re-scrambles every route pipe from a date seed. Decoys keep their resting angle,
  so each network's trick survives the remix. Every daily is solvable by construction: the stored solution is
  the start board with each route pipe turned back 1-3 taps. Budget = taps + max(5, 60%), because a daily
  rewards showing up, not grinding. Pays 40 + 10 x streak coins (capped at 7 days), and a Wrench every 7th day.
- **Streak**: consecutive days with the daily cleared; it survives until a whole day is missed.
- **Forge Tokens**: finishing a chapter's last level forges its token (collection 10/10 on Home). Each token is
  claimed in Forge Progress for fixed coins + a booster.
- **Star goals**: 12 / 30 / 50 / 75 / 100 / 125 / 150 / 180 stars, each with a fixed reward. This gives
  3-starring old levels a purpose.
- **Reminders**: the player turns on a 6 pm daily reminder (Settings, or the daily win summary), and only then
  do we ask for notification permission. A comeback nudge is re-armed on every launch.
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

## Chapter 6 — Filter Works (L31–L36)
Colour filters: a filter pipe only lets its own colour through, so fluids may finally SHARE pipes — only drains must stay pure.

- **L31 · teach** (4x3, par 7) — colour filters. Both sources pour into the same two middle pipes — for 30 levels that meant spoiled drains — but each drain sits behind a filter of its own colour. Aha: fluids MAY share a pipe now; the blue filter lets only blue through to the blue drain, the red one only red. `B┐┌b / .├┤. / R┘└r`
- **L32 · practise** (5x3, par 8) — filters as walls. The top and bottom rows look like free straight runs to each drain, but each is barred by a BOLTED filter of the OTHER colour. Aha: blue cannot pass a red filter — both fluids must dive into the shared middle bar, and the loose filters at the far end sort them back out. `B┬━┌b / .├━┤. / R┤━└r`
- **L33 · practise** (5x3, par 8) — a filter SPLITTER. Blue and red meet in the bottom trunk; a blue-filter tee lifts only blue out of the mix and sends it to BOTH top drains, while red must leave the trunk earlier through its own filter on the left. Aha: the middle tee must open left, up and down, so red peels off through its filter before the blue filter shuts it out. `b━┬━b / r─┤.. / B─┴─R`
- **L34 · twist** (5x3, par 8) — swap sides without an overpass. Blue starts top-left but its drain is bottom-right, red the reverse, and the only link between the rows is one shared drop. Aha: let both fluids fall down the same pipe — the filters at the bottom send each colour to the far side. Sharing replaces crossing. `B─┬─R / ..│.. / r─┴─b`
- **L35 · combine** (5x3, par 10) — filters with an overpass and three fluids. Green falls straight down the middle while blue and red share a trunk that must cross it. Aha: the mixed trunk rides the overpass's left-right channel, so green never joins the mix — then the filters swap blue and red to the opposite corners. `B┐G┌r / .├+┤. / R┘g└b`
- **L36 · finale** (5x4, par 11) — three fluids, ONE trunk. All three sources pour into the same bar and the three filters below hand each colour to its own drain — in a different order from the sources. Aha: stop keeping colours apart; connect everything into one trunk and let the filters do the sorting, then check each drop's tee faces down. `B.R.G / ├┬┴─┤ / ││..│ / gr..b`

## Chapter 7 — Gearworks (L37–L42)
Geared pipes: linked pipes turn together, so one tap can fix two corners — or knock a finished one out.

- **L37 · teach** (4x2, par 5) — geared pipes. The two corners at either end of the dip are linked by gears and both need a half turn. Aha: one tap on either turns BOTH — two taps line up two corners at once. `B┐.b / .└─┘`
- **L38 · practise** (4x3, par 5) — gears that join different shapes. The first straight already lines up, but it is geared to a corner that needs a half turn. Aha: turning the pair once knocks the straight out — turn it twice and the straight is back where it was while the corner flips round. `B─┐. / .┌┘. / .└─b`
- **L39 · practise** (4x4, par 10) — gears across two fluids. Blue's lane runs round the outside and red's tucks inside it, and each gear pair links a blue pipe to a red one. Aha: read each pair as ONE piece — fixing blue's corner fixes red's at the same time, and the straight on blue's top row comes back after the half turn its red partner needs. `B──┐ / R┐.│ / .└┐│ / .r┘b`
- **L40 · twist** (4x4, par 8) — the gear partner decides. Blue's tee can carry blue to its drain facing DOWN or facing UP, and down looks natural — but its geared partner then swings round into the spare arm of red's bolted tee and the colours mix. Aha: a half turn of the pair points the tee's spare arm harmlessly against the side of red's top lane and turns the partner away from red. `R──┐ / B┴b│ / .┐┳┘ / ..r.`
- **L41 · combine** (5x4, par 11) — gears with the long way round. The top route is three-quarters built and only needs its two corners turned — but the left corner is geared to the top straight, and whenever that corner points up the straight stands on end. Aha: the gears forbid the short route, so take the long loop under the board; the top pieces are decoys that just turn along. `.┏─┐. / B┐.┌b / .│.│. / .└─┘.`
- **L42 · finale** (5x4, par 11) — blue crosses red's loop on the overpass. Blue's first tee can face down or up; down looks right, but its geared partner then joins blue to the spare arm of red's bolted splitter. Aha: give the pair a half turn so the tee's spare arm rests against the side of red's top lane — and red's corner over the overpass needs a half turn too, which leaves its geared blue straight exactly where it was. `R──┐. / B┴─+┐ / .┐┳┘│ / ..r.b`

## Chapter 8 — Blend Lab (L43–L48)
Mixer vats: a purple vat needs blue AND red together. After seven chapters of keeping colours apart, mix them on purpose.

- **L43 · teach** (3x3, par 5) — the mixer vat. For seven chapters touching colours spoiled everything; this purple vat is only satisfied when BOTH blue and red pour in. Aha: join the two lanes into one tee on purpose and send the blend into the vat. `B┐. / .├p / R┘.`
- **L44 · practise** (5x3, par 8) — a vat and a pure drain on one pipe. Blue and red meet at the first tee and the blend runs right, where a second tee feeds the vat AND loops back along the bottom to the blue drain. Aha: the blue drain is fed by the same mixed pipe, but its blue filter strips the red out — so mix early and let the filter clean up. `.┌B.. / R┴─┬p / b──┘.`
- **L45 · practise** (5x3, par 11) — one network, three outlets. Both sources sit on the bottom bar, so everything is mixed; the vat takes the blend straight from the left tee, while the red drain and the blue drain each hang behind a filter of their colour at opposite corners. Aha: every tee on the bar must open UP — one network can serve a vat and two pure drains at once. `.┌r.b / p┤.┌┘ / B┴─┴R`
- **L46 · twist** (5x4, par 9) — an overpass never mixes. The vat needs blue and red, and their lanes meet head-on at the overpass — the obvious place to blend them, where nothing blends. Aha: let both cross straight through it, then join them at the tee beyond on the right; blue's own drain hangs below the first tee behind a blue filter, so the blend that floods back across the overpass can't spoil it. `..┌━R / B┬+─┐ / .│└━┤ / .b..p`
- **L47 · combine** (5x3, par 6) — gears with the vat. Blue's top lane runs left to its drain and must also feed the vat at the end of red's bottom lane. Two uprights can bridge the lanes, and they are geared so only one stands at a time: the plain one on the left (standing at the start) or the blue filter on the right. Aha: through the plain bridge red climbs straight into blue's drain; through the filter blue pours down but red can never climb back — a filter is a one-way valve. Turn the pair so the filter stands. `b┳─┬B / .─.│. / p┻─┴R`
- **L48 · finale** (5x4, par 12) — red sits under the vat but blue's source is on the far right, so blue must run back left through BOTH overpasses that green zig-zags across, meeting red at the tee under the vat; meanwhile red also flows right to its own drain and blue up to its own, each behind a filter. Aha: the overpasses keep green out of the mix both times — plan green's zig-zag first, then every tee simply opens toward the vat and the filters. `.pb┐. / G+┐├B / R┴+┴┐ / ..└gr`

## Chapter 9 — Night Shift (L49–L54)
Every tool at once, three at a time: filters as doors and one-way valves, re-blending, shared loops.

- **L49 · breather** (3x4, par 7) — blend once, fill twice. Blue and red fall into one tee in the middle, and the blend must split again to TWO vats in the bottom corners. Aha: a splitter works on a blend just like on a pure fluid — turn the upper tee to catch both sources and the lower tee to open left and right. `B.R / └┬┘ / ┌┴┐ / p.p`
- **L50 · practise** (5x4, par 8) — swapping through a blend while a third fluid drops straight through it. Blue and red pour into one bar that green crosses on the overpass, and the two filters hand each colour to the OPPOSITE side. Aha: the overpass keeps green out of the shared bar; the left tee is geared to green's drop, so its half turn leaves green's straight standing, and the two corners under the sources turn as one pair. `B.G.R / └┬+┬┘ / .│││. / .rgb.`
- **L51 · practise** (5x3, par 10) — the long way round a shared loop. Blue's drain sits inside the loop right under a blue-filter door, one step from the source — but the short way up is barred by red's filter. Aha: blue must run all the way round the loop, through red's half of it, and come in through the door from the far side, while red takes the short way to its drain through its own filter. Both fluids share the bottom of the loop and nothing spoils. The two right-hand corners are geared. `r┐┌━┐ / B┤bR┃ / .└━┴┘`
- **L52 · twist** (5x4, par 12) — sort, then blend again. All three sources feed one spine down the left, so everything in it is mixed — but the vat must get blue and red WITHOUT green. Aha: send red out along the top through the red filter and blue out through the blue filter, then let the two pure streams rejoin at the bolted tee in front of the vat; green leaves only through its own filter at the bottom. Filters don't just separate — they choose who gets to mix. `B┬─┐. / .├─┻p / G┤... / R┴━g.`
- **L53 · combine** (5x4, par 12) — a self-crossing loop with the vat. The vat sits right above blue's source, but blue first has to run through the overpass, swing down to collect red at the bottom tee, and bring the blend back UP through the same overpass. Aha: the overpass lets the blend cross its own pipe without short-circuiting. Green hooks round on the right, and its corners are geared to the loop's: a half turn on the upper pair keeps green's straight upright. `p┐.G. / B+┐│. / R┴┘└┐ / ...g┘`
- **L54 · finale** (5x5, par 13) — the vat is up in red's corner, blue's source and pure drain are down at the bottom, and green's bolted lane runs straight across the middle. Aha: blue climbs from its bottom tee up through the blue filter and over green on the overpass to meet red's tee — the filter lets blue rise but stops red falling into blue's drain. The corner pairs are geared diagonally across the board: line up one hook and its mirror comes with it. `R┓.┌p / .└┬┘. / G━+━g / B┐│┌b / .└┴┛.`

## Chapter 10 — Grand Refinery (L55–L60)
The finale chapter: the whole plant, every rule combined on the biggest boards.

- **L55 · breather** (3x5, par 9) — two one-way valves. Red's lane runs along the top, blue's along the bottom, and the vat waits halfway up the spine between them. Aha: the red filter lets red fall to the vat but stops blue climbing to the red drain, and the blue filter does the same from below — both pure drains and the blend share one spine. `R┬r / .│. / p┤. / .│. / B┴b`
- **L56 · practise** (5x3, par 10) — swap and blend in one trunk. Blue and red share the middle bar; the vat drinks the blend straight from the bar's centre tee, while the filters at the far end swap the pure colours to the opposite corners. Aha: one trunk can do three jobs at once — open the centre tee upward to the vat and both end tees toward the filters. The corner pairs are geared corner-to-filter across the board. `B┐p┌r / .├┴┤. / R┘.└b`
- **L57 · practise** (5x3, par 10) — the walled-in vat. The vat sits inside green's loop, boxed in by green pipe on every side, and green's drain is right next to it. Aha: blend blue and red OUTSIDE the loop at the left tee, then send the blend straight through the overpass in green's wall — the overpass is the only door, and green flows across it without mixing. `B┐Gg┐ / R┴+p│ / ..└─┘`
- **L58 · twist** (5x3, par 8) — a filter can starve the vat. A bolted bridge on the left is already built, and red's elbow needs just one turn to join blue's lane through it — but that joins red BEFORE the blue filter in the lane, which strips the red straight back out and the vat never sees it. Aha: turn red's elbow the other way and bring it up the right-hand column to join blue AFTER the filter, right before the vat. `B┳━┬┐ / .┃R││ / .┗└┘p`
- **L59 · combine** (5x4, par 10) — vats, filters and an overpass with three fluids. Blue and red sit side by side on the bottom row and blend at once; the vat drinks from below, the blue drain hangs top-left behind its filter, and the red drain is top-right — on the far side of green's lane. Aha: red's way home climbs straight UP through the overpass in green's lane, and the red filter at the top keeps the blend's blue out of it. The left elbow and the right tee are geared, so both must be read together. `b..┌r / └┐G+g / .├─┤. / B┴Rp.`
- **L60 · finale** (5x5, par 13) — FINALE: the whole refinery. Blue, green and red all pour into one spine on the left, so the spine is a three-colour mix. Aha: pull red out along the top through its filter and blue through the one below, rejoin them on the right and drop the blend straight down through the overpass into the vat — while green leaves through its own bolted filter and crosses that same overpass sideways to its drain. Sort, re-blend and cross, with geared corners tying red's return path to the spine. `B┬─━┐ / .┣─┐┃ / G┤.├┘ / .├━+g / .R.p.`

