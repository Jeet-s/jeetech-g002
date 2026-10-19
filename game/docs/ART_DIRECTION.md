# Art direction — Flow Forge: Pipes & Pressure

Target: .agf/art/target.png (judged 7/10 vs the top competitors). Every screen must look like it.

## Style
Premium, industrial-modern workshop lit by cool top-down area lights and a warm rim light, with materials that feel tactile but never noisy: satin-brushed dark steel plates and anodized teal bezels, beveled 2–3 px highlights on every hard edge, and subtle micro-scratches catching speculars; pipes are semi-gloss painted metal with crisp chamfers and soft occlusion in joints, liquids read as luminous gel with inner glow and faint bubbles; depth comes from a raised board tray with inner shadow and parallaxed dust motes over a gentle vignette; mood is focused, calm, and technical—high contrast on the puzzle, restrained glow accents elsewhere, everything tuned for quick readability in motion.

## Palette
#0F1A24 #274454 #2EC4FF #FF5D5D #D97A2B #8EA7B2

UI kit tokens (src/ui/theme.ts): {"primary":"#D97A2B","primaryDark":"#A85E1F","secondary":"#4E5E68","secondaryDark":"#324049","accent":"#2EC4FF","accentDark":"#108AB4","bgTop":"#22313C","bgBottom":"#0F1A24","ink":"#F2F6FA"}

## Screen spec
- **background**: Dark steel workshop plates in a vertical gradient from bgTop to bgBottom, soft 20% vignette and 10% opacity drifting dust motes; faint beveled seams and two rivets per corner at 8% contrast so they never fight the board.
- **board**: Make the board 18% larger and centered. A floating tray with anodized teal bezel (2 mm bevel, inner 2 px neon-accent rim), soft 12 px inner shadow to push grid inward; grid is a subtle 2 px line pattern (#2A3A45 at 35% opacity) with rounded 6 px tile corners; blocked cells show a matte steel plate with an embossed X icon (no text) at 65% opacity.
- **pieces**: Pipes are 3D-painted metal with a gentle gloss, 1.5 px highlight on edges, AO under each joint; blue fluid tint #2EC4FF, red #FF5D5D, both with 600 ms fill sweep and a 24 px glow halo on completion; endpoints are distinct housings: sources have a beveled emitter with a pulsing ring (1.2 s loop) and a tiny flow arrow decal; drains are deep-set ports with a soft inner glow in their color; states: idle (no glow), selected (accent rim + 2% scale up), rotating (140 ms spring with haptic), filled (animated caustic), error (80 ms red pulse overlay).
- **hud**: Single compact top bar: left—level title and chapter icon; center—wide segmented progress meter (3 segments for wrenches), right—PAR badge and a high-contrast pill for moves left with an icon; timer variant replaces PAR when time mode is active; all elements on a semi-opaque steel plate with 12 px radius and drop shadow.
- **buttons**: Primary buttons use orange (#D97A2B) plates with strong soft shadow and white label; secondary are steel gray with lighter edge; tertiary are ghost outlines. Bottom row: Undo (tertiary), Restart (secondary), Hint (primary) with a small count badge. Press states scale to 96% with 120 ms ease-out and a specular sweep.
- **typography**: One rounded sans (SF Pro Rounded/Nunito) across the game: titles 28 semibold, HUD labels 14 medium, body/tutorial 16 regular; no ALL CAPS, -1% tracking for tighter, pro feel; numerals tabular.
- **popups**: Modal sheets in dark steel with teal edge glow at 6% intensity, blurred background at 12 px radius; large primary CTA, secondary ghost; iconography is geometric and line-based, no text baked into art.
- **fx**: Connection glow sweep along the path (600 ms), tiny bubble sprites rising at 1–2 Hz in filled pipes, leak/error pulse as a quick red concentric ring (80/120 ms double-beat); Freeze applies a crystalline frost shader with a faint blue tint and a shrinking time ring.
- **motion**: Pipe rotate 140 ms spring (overshoot 1.06, damp 0.6), board drop-in 220 ms ease, HUD counter flips 90 ms per digit, endpoint pulse 1.2 s sine, glow sweep 600 ms cubic; dead-end error pulse 80 ms + 120 ms; haptics: light tap on rotate, success soft buzz, error tick.

## Assets (assets/art, indexed in src/art.ts)
- `background_chapter_industrial_steel_teal` (background, 1080x1920): chapter and gameplay backdrop
- `board_frame_tray` (ui, 512x508): puzzle board bezel and tray
- `pipe_straight` (sprite, 512x225): gameplay tile piece
- `pipe_elbow` (sprite, 451x512): gameplay tile piece
- `pipe_tee` (sprite, 512x512): gameplay tile piece
- `tile_blocker` (sprite, 512x504): blocked cell iconography on grid
- `endpoint_source_blue` (sprite, 378x512): blue fluid source tile
- `endpoint_source_red` (sprite, 391x512): red fluid source tile
- `endpoint_drain_blue` (sprite, 511x512): blue fluid drain tile
- `endpoint_drain_red` (sprite, 510x512): red fluid drain tile
- `hud_top_bar` (ui, 512x271): compact HUD container
- `button_primary_orange` (ui, 512x507): primary CTAs like Hint
- `button_secondary_steel` (ui, 512x186): secondary CTAs like Restart
- `icon_reward_wrench` (ui, 449x512): rewards and progress gates
- `fx_glow_sweep` (fx, 70x512): connection completion effect
- `fx_particles_pack` (fx, 482x512): bubbles and error pulse
