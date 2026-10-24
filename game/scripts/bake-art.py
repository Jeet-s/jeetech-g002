"""
Bake the studio art (assets/art) into the runtime sprites the board and UI kit draw (assets/art/baked).

The generated pipe sheets mix proportions (the tee's stem is long, the elbow's arms are uneven), so every board
tile is re-assembled on one square grid: the bend / junction from the art, cropped to the tile, with the same brass
collar (from pipe_straight) capping every arm at the tile edge — so neighbouring pipes always meet collar to collar.
Each shape is baked dry (smoky empty glass) and once per fluid (the art's cyan fluid hue-shifted; brass untouched).

  python3 scripts/bake-art.py
"""
import colorsys
import os

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC = os.path.join(ROOT, "assets/art")
OUT = os.path.join(SRC, "baked")
os.makedirs(OUT, exist_ok=True)

T = 192  # baked tile size (px)
TUBE = 52  # tube thickness in the tile
COLLAR_W = 72  # collar thickness
COLLAR_H = 30  # collar length along the pipe

# Fluid hue targets (degrees) + saturation / value gain. blue = the art's own cyan.
FLUIDS = {
    "blue": (None, 1.0, 1.05),
    "red": (358, 0.88, 1.05),
    "green": (118, 0.78, 1.0),
    "yellow": (40, 1.05, 1.15),
    "purple": (274, 0.9, 1.05),
}


def load(name, box=None):
    im = Image.open(os.path.join(SRC, name)).convert("RGBA")
    return im.crop(box) if box else im


def recolor(im, state):
    """Recolour the cyan glass/fluid pixels of `im` (brass and shading stay)."""
    a = np.asarray(im).astype(np.float32) / 255.0
    rgb = a[..., :3]
    mx = rgb.max(-1)
    mn = rgb.min(-1)
    d = mx - mn + 1e-6
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 0, d / (mx + 1e-6), 0)
    v = mx
    cyan = (h > 150) & (h < 215) & (s > 0.18)
    w = np.clip((s - 0.18) / 0.2, 0, 1) * cyan
    if state == "dry":
        # Empty glass: smoky warm grey, darker, a little gloss kept.
        lum = 0.3 * r + 0.59 * g + 0.11 * b
        tint = np.stack([lum * 0.62 + 0.05, lum * 0.6 + 0.045, lum * 0.56 + 0.04], -1)
        out = rgb * (1 - w[..., None]) + tint * w[..., None]
    else:
        hue, sg, vg = FLUIDS[state]
        nh = h if hue is None else np.full_like(h, hue)
        ns = np.clip(s * sg, 0, 1)
        nv = np.clip(v * vg, 0, 1)
        c = nv * ns
        x = c * (1 - np.abs(((nh / 60) % 2) - 1))
        m = nv - c
        hp = (nh // 60).astype(int) % 6
        z = np.zeros_like(c)
        lut = [(c, x, z), (x, c, z), (z, c, x), (z, x, c), (x, z, c), (c, z, x)]
        R = np.select([hp == k for k in range(6)], [t[0] for t in lut])
        G = np.select([hp == k for k in range(6)], [t[1] for t in lut])
        B = np.select([hp == k for k in range(6)], [t[2] for t in lut])
        col = np.stack([R + m, G + m, B + m], -1)
        out = rgb * (1 - w[..., None]) + col * w[..., None]
    res = np.concatenate([out, a[..., 3:]], -1)
    return Image.fromarray((np.clip(res, 0, 1) * 255).astype(np.uint8))


def scaled(im, sx, sy):
    return im.resize((max(1, round(im.width * sx)), max(1, round(im.height * sy))), Image.LANCZOS)


# --- source frames ---------------------------------------------------------
STRAIGHT = load("pipe_straight.png", (393, 0, 512, 304))  # filled cyan with bubbles (vertical)
ELBOW = load("pipe_elbow.png", (180, 0, 328, 179))  # cyan, arms W + S
TEE = load("pipe_t_junction.png", (172, 0, 338, 199)).crop((36, 0, 130, 199))  # cyan bar (own collars cut), stem S
LENS_DRY = load("pipe_endcap.png", (0, 0, 213, 233))
LENS_FULL = load("pipe_endcap.png", (296, 0, 512, 233))
VALVE = load("pipe_valve.png", (166, 0, 342, 48))  # the red hand-wheel


def collar():
    c = STRAIGHT.crop((0, 0, STRAIGHT.width, 50))
    return c.resize((COLLAR_W, COLLAR_H), Image.LANCZOS)  # vertical pipe's top collar (opening up)


def put_collar(tile, side):
    """Paste a collar capping the arm that leaves the tile on `side` (N/E/S/W)."""
    c = collar()
    if side == "N":
        tile.alpha_composite(c, (T // 2 - COLLAR_W // 2, 0))
    elif side == "S":
        tile.alpha_composite(c.rotate(180), (T // 2 - COLLAR_W // 2, T - COLLAR_H))
    elif side == "E":
        tile.alpha_composite(c.rotate(-90, expand=True), (T - COLLAR_H, T // 2 - COLLAR_W // 2))
    else:
        tile.alpha_composite(c.rotate(90, expand=True), (0, T // 2 - COLLAR_W // 2))


def straight_tile():
    """E-W straight: the tube scaled to TUBE thick, stretched edge to edge."""
    body = STRAIGHT.crop((0, 56, STRAIGHT.width, 248))
    k = TUBE / 86
    body = body.resize((round(STRAIGHT.width * k), T), Image.LANCZOS)
    t = Image.new("RGBA", (T, T))
    t.alpha_composite(body, (T // 2 - body.width // 2, 0))
    put_collar(t, "N")
    put_collar(t, "S")
    return t.rotate(90)  # N-S → E-W


def elbow_tile():
    """E-S elbow from the art's W-S bend (centreline corner at src 116,30)."""
    k = TUBE / 50
    e = scaled(ELBOW, k, k)
    t = Image.new("RGBA", (T, T))
    layer = Image.new("RGBA", (T * 2, T * 2))
    layer.alpha_composite(e, (T + T // 2 - round(116 * k), T + T // 2 - round(30 * k)))
    t.alpha_composite(layer.crop((T, T, 2 * T, 2 * T)))
    # Extend the arms to the edges where the scaled art stops short.
    tube = STRAIGHT.crop((0, 100, STRAIGHT.width, 160)).resize((round(STRAIGHT.width * TUBE / 86), 60), Image.LANCZOS)
    put_collar(t, "W")
    put_collar(t, "S")
    return t.rotate(90)  # W-S → S-E (counter-clockwise)


def tee_tile():
    """E-S-W tee: the art's junction (bar centre src 83,40) with collars on all three arms."""
    k = TUBE / 54
    e = scaled(TEE, k, k)
    t = Image.new("RGBA", (T, T))
    layer = Image.new("RGBA", (T * 2, T * 2))
    layer.alpha_composite(e, (T + T // 2 - round(47 * k), T + T // 2 - round(40 * k)))
    t.alpha_composite(layer.crop((T, T, 2 * T, 2 * T)))
    # Bridge the bar out to both edges with straight tube under the collars.
    st = straight_tile()
    for x0, x1 in ((0, 64), (T - 64, T)):
        strip = st.crop((x0, 0, x1, T))
        under = Image.new("RGBA", (T, T))
        under.alpha_composite(strip, (x0, 0))
        under.alpha_composite(t)
        t = under
    put_collar(t, "W")
    put_collar(t, "E")
    put_collar(t, "S")
    return t


def stub_tile():
    """Centre → E edge half pipe (endpoint mouths)."""
    st = straight_tile()
    t = Image.new("RGBA", (T, T))
    t.alpha_composite(st.crop((T // 2 - 20, 0, T, T)), (T // 2 - 20, 0))
    return t


def lens(img, size):
    s = min(size / img.width, size / img.height)
    return scaled(img, s, s)


def check_edges(name, tile, sides):
    a = np.asarray(tile)[..., 3]
    probe = {"N": a[2, T // 2], "S": a[T - 3, T // 2], "E": a[T // 2, T - 3], "W": a[T // 2, 2]}
    for side, v in probe.items():
        want = side in sides
        if (v > 100) != want:
            raise SystemExit(f"{name}: edge {side} alpha {v} (want {'open' if want else 'closed'})")


SHAPES = {"straight": (straight_tile(), "EW"), "elbow": (elbow_tile(), "ES"), "tee": (tee_tile(), "ESW"), "stub": (stub_tile(), "E")}
for name, (tile, sides) in SHAPES.items():
    check_edges(name, tile, sides)
    for state in ["dry", *FLUIDS]:
        recolor(tile, state).save(os.path.join(OUT, f"pipe_{name}_{state}.png"), optimize=True)

lens(LENS_DRY, 160).save(os.path.join(OUT, "lens_dry.png"), optimize=True)
full = lens(LENS_FULL, 160)
for state in FLUIDS:
    recolor(full, state).save(os.path.join(OUT, f"lens_{state}.png"), optimize=True)
scaled(VALVE, 0.9, 0.9).save(os.path.join(OUT, "valve_wheel.png"), optimize=True)

# UI: the HUD bar sunk to a deep dusk teal (white ink must read on it).
hud = np.asarray(load("hud_top_bar.png")).astype(np.float32)
hud[..., :3] = hud[..., :3] * np.array([0.34, 0.4, 0.46])
Image.fromarray(hud.astype(np.uint8)).save(os.path.join(OUT, "hud_bar.png"), optimize=True)

# Buttons: the teal plate + amber / violet / graphite / red recolours (whole plate, not just cyan).
btn = load("button_primary.png")
btn.save(os.path.join(OUT, "button_teal.png"), optimize=True)


def plate(im, hue, sg, vg):
    a = np.asarray(im).astype(np.float32) / 255
    out = np.zeros_like(a)
    out[..., 3] = a[..., 3]
    flat = a[..., :3].reshape(-1, 3)
    res = np.empty_like(flat)
    for i, (r, g, b) in enumerate(flat):
        h, s, v = colorsys.rgb_to_hsv(r, g, b)
        res[i] = colorsys.hsv_to_rgb(hue / 360 if hue is not None else h, min(1, s * sg), min(1, v * vg))
    out[..., :3] = res.reshape(a.shape[0], a.shape[1], 3)
    return Image.fromarray((out * 255).astype(np.uint8))


small = btn.resize((btn.width // 2, btn.height // 2), Image.LANCZOS)
plate(small, 34, 1.15, 1.45).save(os.path.join(OUT, "button_amber.png"), optimize=True)
plate(small, 272, 0.75, 1.25).save(os.path.join(OUT, "button_violet.png"), optimize=True)
plate(small, 30, 0.12, 0.9).save(os.path.join(OUT, "button_graphite.png"), optimize=True)
plate(small, 356, 1.0, 1.3).save(os.path.join(OUT, "button_red.png"), optimize=True)

# Gear-group tints (group 0 = the art's gold).
gear = lens(load("reward_gear_token.png"), 128)
gear.save(os.path.join(OUT, "gear_gold.png"), optimize=True)
plate(gear, None, 0.08, 1.15).save(os.path.join(OUT, "gear_silver.png"), optimize=True)
plate(gear, 14, 1.1, 0.95).save(os.path.join(OUT, "gear_copper.png"), optimize=True)
print("baked", len(os.listdir(OUT)), "files →", OUT)

# Board sockets at tile size: the engraved slot, a sunk (blocked) slot and a lifted bolt plate.
slot = load("tile_slot.png").resize((T, T), Image.LANCZOS)
slot.save(os.path.join(OUT, "slot.png"), optimize=True)
sa = np.asarray(slot).astype(np.float32)
sunk = sa.copy()
sunk[..., :3] *= np.array([0.55, 0.55, 0.58])
Image.fromarray(sunk.astype(np.uint8)).save(os.path.join(OUT, "slot_sunk.png"), optimize=True)
lift = sa.copy()
lift[..., :3] = np.clip(lift[..., :3] * np.array([1.45, 1.38, 1.25]) + np.array([8, 6, 4]), 0, 255)
lift = np.flip(lift, axis=0).copy()  # the bevel lit from below reads raised
Image.fromarray(lift.astype(np.uint8)).save(os.path.join(OUT, "slot_lift.png"), optimize=True)
