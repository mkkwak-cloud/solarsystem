#!/usr/bin/env python3
"""
가상(연출용) 행성/위성/소행성 텍스처 생성기.

실제 표면 지도가 아니다. 지도를 구하지 못한 천체의 구체에 입힐 equirectangular(2:1) 텍스처를
fractal noise + 크레이터로 만든다. 화면에는 "가상 텍스처" 표기가 필요하다.

사용: python3 gen_fictional_textures.py [출력폴더] [가로픽셀=1024]
필요: numpy, Pillow
"""
import sys
import os
import numpy as np
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else "textures-fictional"
W = int(sys.argv[2]) if len(sys.argv) > 2 else 1024
H = W // 2

# name: (base RGB, albedo variation, roughness(noise) strength, crater count, crater size range(frac of W), seed)
BODIES = {
    "deimos":  ((150, 138, 124), 0.10, 0.55, 140, (0.006, 0.035), 11),
    "proteus": ((105, 103, 102), 0.10, 0.60, 260, (0.006, 0.060), 12),
    "mimas":   ((190, 190, 190), 0.06, 0.35, 420, (0.005, 0.045), 13),
    "ariel":   ((178, 176, 172), 0.10, 0.45, 300, (0.005, 0.050), 14),
    "umbriel": ((98, 98, 98),    0.07, 0.40, 380, (0.005, 0.050), 15),
    "titania": ((160, 154, 148), 0.09, 0.45, 300, (0.005, 0.055), 16),
    "oberon":  ((138, 128, 120), 0.10, 0.50, 340, (0.005, 0.055), 17),
    "pallas":  ((120, 116, 112), 0.08, 0.55, 260, (0.006, 0.055), 21),
    "hygiea":  ((78, 76, 74),    0.07, 0.50, 240, (0.006, 0.055), 22),
    "eros":    ((172, 140, 105), 0.12, 0.60, 200, (0.006, 0.060), 23),
    "itokawa": ((150, 122, 96),  0.14, 0.75, 70,  (0.006, 0.030), 24),
    "ryugu":   ((70, 68, 66),    0.08, 0.65, 150, (0.006, 0.040), 25),
    "bennu":   ((62, 60, 58),    0.08, 0.70, 130, (0.006, 0.035), 26),
}


def fbm(rng, octaves=7, base=4, persistence=0.55):
    """가로 방향으로 이어지는(wrap) fractal noise, 0~1."""
    total = np.zeros((H, W), dtype=np.float32)
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        gw = base * (2 ** o)
        gh = max(2, gw // 2)
        g = rng.random((gh, gw)).astype(np.float32)
        tiled = np.tile(g, (1, 3))
        img = Image.fromarray(tiled, mode="F").resize((W * 3, H), Image.BICUBIC)
        layer = np.asarray(img)[:, W:2 * W]
        total += amp * layer
        norm += amp
        amp *= persistence
    total /= norm
    total -= total.min()
    total /= max(total.max(), 1e-6)
    return total


def add_craters(height, rng, count, size_range):
    for _ in range(count):
        # 작은 크레이터가 많고 큰 것은 적게 (거듭제곱 분포)
        u = rng.random() ** 2.5
        r = (size_range[0] + (size_range[1] - size_range[0]) * u) * W
        cx = rng.random() * W
        cy = rng.random() * H
        clat = (cy / (H - 1) - 0.5) * np.pi
        coslat = max(np.cos(clat), 0.25)
        # 위도 보정: 가로 방향으로 늘어나므로 그만큼 넓은 창을 본다
        half_w = int(r * 1.8 / coslat) + 2
        half_h = int(r * 1.8) + 2
        ys = np.arange(int(cy) - half_h, int(cy) + half_h + 1)
        xs = np.arange(int(cx) - half_w, int(cx) + half_w + 1)
        ys_c = np.clip(ys, 0, H - 1)
        xs_w = np.mod(xs, W)
        dy = (ys[:, None] - cy)
        dx = (xs[None, :] - cx) * coslat
        d = np.sqrt(dx * dx + dy * dy) / r
        # 작은 크레이터일수록 얕게, 큰 것도 완만하게 (거품처럼 보이지 않도록)
        depth = (0.05 + 0.10 * rng.random()) * (0.4 + 0.6 * min(r / (size_range[1] * W), 1.0))
        bowl = -depth * np.clip(1.0 - d ** 2, 0.0, None) ** 1.5
        rim = 0.18 * depth * np.exp(-((d - 1.03) / 0.18) ** 2)
        patch = (bowl + rim).astype(np.float32)
        mask_y = (ys >= 0) & (ys < H)
        sub = patch[mask_y][:, :]
        height[np.ix_(ys_c[mask_y], xs_w)] += sub


def make(name, params):
    base, albedo_var, rough, n_craters, size_range, seed = params
    rng = np.random.default_rng(seed)

    terrain = fbm(rng, octaves=8, base=4, persistence=0.62)
    height = 0.35 * rough * (terrain - 0.5)
    add_craters(height, rng, n_craters, size_range)

    # 조명 (좌상단에서 비춘다고 가정한 기복 음영)
    gy, gx = np.gradient(height)
    shade = np.clip(0.5 + 26.0 * (-gx - gy), 0.0, 1.0)

    albedo = 1.0 + albedo_var * (fbm(rng, octaves=5, base=3, persistence=0.6) - 0.5) * 2.0
    grain = 1.0 + 0.07 * (rng.random((H, W)).astype(np.float32) - 0.5)
    lum = (0.62 + 0.76 * shade) * albedo * grain
    lum = lum[..., None]

    base_rgb = np.array(base, dtype=np.float32)[None, None, :]
    img = np.clip(base_rgb * lum, 0, 255).astype(np.uint8)

    # 극 부근 가로 늘어짐 완화: 위/아래 가장자리를 평균색으로 부드럽게
    fade_rows = max(2, H // 40)
    mean_col = img.reshape(-1, 3).mean(axis=0)
    for i in range(fade_rows):
        t = (fade_rows - i) / fade_rows
        img[i] = (img[i] * (1 - 0.6 * t) + mean_col * 0.6 * t).astype(np.uint8)
        img[H - 1 - i] = (img[H - 1 - i] * (1 - 0.6 * t) + mean_col * 0.6 * t).astype(np.uint8)

    return Image.fromarray(img, mode="RGB")


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, params in BODIES.items():
        im = make(name, params)
        path = os.path.join(OUT, f"{W // 1024 if W >= 1024 else 1}k_{name}_fictional.jpg")
        im.save(path, quality=86, optimize=True)
        print("saved", path, os.path.getsize(path) // 1024, "KB")


if __name__ == "__main__":
    main()
