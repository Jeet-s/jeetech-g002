# Art direction — Flow Forge: Pipes & Pressure — fix

Target: .agf/art/target.png (vs big-studio games Royal Match +2, Monument Valley -2, Homescapes +2 → net +0.7 (need ≥ 0)). Every screen must look like it.

## Style
Premium, tactile PBR rendering that fuses Royal Match’s candy polish with Monument Valley’s calm clarity and Homescapes’ warmth: forged brass and gunmetal housings with micro‑beveled edges, soft brushed anisotropy, and tight rim lights; translucent glass/acrylic pipe cores carrying luminous colored liquid with internal bloom and faint bubbles; clean contact shadows and ambient occlusion in every socket; subtle subsurface in rubber gaskets; gently graded studio lighting (cool top key, warm under‑bounce) to separate planes; edges stay crisp, forms read in two tones plus specular, backgrounds defocus for depth; mood is cozy workshop-at-dusk—soothing, clever, and reassuringly premium.

## Palette
#0B1021 #0F2C49 #12D1E6 #FFB24D #6EE06F #B16BFF

UI kit tokens (src/ui/theme.ts): {"primary":"#12D1E6","primaryDark":"#0A7A8C","secondary":"#FFB24D","secondaryDark":"#C7741C","accent":"#B16BFF","accentDark":"#6A2FCF","bgTop":"#0B1021","bgBottom":"#0F2C49","ink":"#F2F7FF"}

## Screen spec
- **background**: Soft vertical gradient from bgTop to bgBottom with a defocused workshop: hints of shelving, tool silhouettes and distant warm bulbs; faint volumetric haze and parallaxed dust motes for depth; no sharp details to avoid clutter.
- **board**: Centered recessed tray with rounded rectangle shape, chamfered 3D rim in matte graphite (#2B2E3B) and a satin specular; inner lip with thin cyan accent line; grid is shallow engraved grooves with AO in intersections; tray drops a soft, wide shadow onto background.
- **pieces**: Modular pipes seated in each grid cell: outer shell in brushed brass/gunmetal with micro-scratches; inner clear glass core. States—idle: neutral metal, glass lightly tinted; hover/selected: cyan rim light and thin ghosted outline; connected/filled: vivid colored liquid (cyan, lime, amber, violet) flows inside with moving bubbles, inner bloom and a soft halo; misfit/blocked: desaturated metal and reduced specular; valve pieces have a red rubber wheel with subtle wear. Endcaps show a convex glass lens with refracted liquid meniscus.
- **hud**: Top translucent frosted-glass bar (90% width, floating with 8dp corner radius) containing: left back icon in ink, center circular pressure gauge (animated fill ring), right reward token counter; bar casts a soft drop shadow; icons use solid ink with subtle outer glow for readability.
- **buttons**: Primary action buttons are chunky rounded rectangles with beveled rim, glossy topcoat and inner glow; default uses primary color with a cyan-to-teal vertical gradient, white icon, and a faint specular streak; pressed state darkens and pushes inner shadow; disabled is low-chroma with reduced gloss.
- **typography**: Friendly geometric sans with high x-height and wide apertures; bold for headlines, medium for counters; pure ink on light surfaces, ink at 85% on dark; numeral emphasis with slight tracking; no stroke outlines.
- **popups**: Center-card frosted glass with brass rim, drop shadow and soft entrance blur; large hero icon top, two buttons bottom; contents breathe with generous padding; no in-image text for export.
- **fx**: Tiny cyan-white star sparkles on connect; soft flow glow that snakes along completed paths; gentle steam puffs from valves on completion; particles are restrained and never obscure the board.
- **motion**: Board eases up from 96% scale on entry; tiles snap-rotate with a 120ms spring and 10° overshoot; liquid fills at 260 px/s with eased-in bubbles; gauge ring sweeps smoothly; sparkles pop with 80ms scale-up then fade; popups scale 0.9→1 with slight y-lag; parallax background drifts at 3% tilt.

## Assets (assets/art, indexed in src/art.ts)
- `bg_workshop_dawn` (background, 1080x1920): chapter_1_background
- `bg_nightshift_neon` (background, 1080x1920): chapter_2_background
- `board_tray` (sprite, 422x512): central_board_container
- `tile_slot` (sprite, 510x512): empty_cell_placeholder
- `pipe_straight` (sprite, 512x304): piece_straight_segment
- `pipe_elbow` (sprite, 512x179): piece_elbow_segment
- `pipe_t_junction` (sprite, 512x199): piece_t_segment
- `pipe_endcap` (sprite, 512x233): dead_end_piece
- `pipe_valve` (sprite, 512x295): interactive_valve_piece
- `hud_top_bar` (ui, 512x224): status_bar_container
- `button_primary` (ui, 381x512): primary_cta_buttons
- `reward_gear_token` (sprite, 494x512): soft_currency_icon
- `fx_sparkle_burst` (fx, 481x512): connection_success_vfx
- `fx_flow_glow` (fx, 110x512): completed_path_highlight
- `title_hero_key_art` (character, 401x512): app_store_promo_and_title_screen
- `logo` (ui, 900x564): the game logo — title/home screen and anywhere the name appears
