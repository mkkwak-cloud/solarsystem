# 홈 화면 아이콘 생성 (icons/*.png). 사용: py scripts/make-icons.py
# solar: 태양+행성 궤도, sat: 지구+위성 궤도. 가장자리 여백을 두어 둥근 모서리로 잘려도 그림이 남게 한다(maskable 안전 영역).
import math, random
from PIL import Image, ImageDraw, ImageFilter

S = 1024  # 크게 그린 뒤 줄여서 부드럽게

def base(bg1, bg2):
    img = Image.new('RGB', (S, S), bg1)
    px = img.load()
    for y in range(S):
        for x in range(S):
            t = math.hypot(x - S / 2, y - S / 2) / (S * 0.75)
            t = min(1, t)
            px[x, y] = tuple(int(bg1[i] * (1 - t) + bg2[i] * t) for i in range(3))
    d = ImageDraw.Draw(img)
    random.seed(7)
    for _ in range(60):
        x, y, r = random.randint(0, S), random.randint(0, S), random.choice([2, 3, 4])
        d.ellipse([x - r, y - r, x + r, y + r], fill=(220, 230, 255))
    return img

def glow(img, cx, cy, r, color, blur):
    g = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (200,))
    g = g.filter(ImageFilter.GaussianBlur(blur))
    img.paste(g, (0, 0), g)

def ring(d, cx, cy, rx, ry, color, w):
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=color, width=w)

def solar():
    img = base((10, 16, 40), (2, 3, 10))
    c = S // 2
    glow(img, c, c, 190, (255, 170, 40), 70)
    d = ImageDraw.Draw(img)
    for rx, ry, ang, col, pr, pc in [(250, 120, 0, (90, 110, 150), 22, (170, 160, 150)), (350, 190, 0, (90, 110, 150), 30, (80, 140, 230)),
                                      (440, 260, 0, (90, 110, 150), 26, (220, 120, 80))]:
        ring(d, c, c, rx, ry, col, 6)
    d.ellipse([c - 120, c - 120, c + 120, c + 120], fill=(255, 196, 80))
    d.ellipse([c - 60, c - 90, c + 20, c - 20], fill=(255, 224, 140))
    for (rx, ry, a, pr, pc) in [(250, 120, 2.2, 22, (170, 160, 150)), (350, 190, 0.6, 32, (80, 140, 230)), (440, 260, 4.0, 26, (220, 120, 80))]:
        x, y = c + rx * math.cos(a), c + ry * math.sin(a)
        d.ellipse([x - pr, y - pr, x + pr, y + pr], fill=pc)
    return img

def sat():
    img = base((8, 14, 34), (2, 3, 10))
    c = S // 2
    glow(img, c, c, 300, (70, 140, 255), 60)
    d = ImageDraw.Draw(img)
    d.ellipse([c - 270, c - 270, c + 270, c + 270], fill=(40, 100, 200))
    for box, col in [([c - 190, c - 160, c - 60, c - 40], (70, 170, 90)), ([c - 40, c - 100, c + 130, c + 20], (80, 180, 100)), ([c + 20, c + 60, c + 190, c + 190], (70, 160, 90))]:
        d.ellipse(box, fill=col)
    # 위성 궤도(기울어진 타원)와 위성
    orb = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    od = ImageDraw.Draw(orb)
    od.ellipse([c - 360, c - 130, c + 360, c + 130], outline=(255, 210, 90, 255), width=10)
    orb = orb.rotate(28, resample=Image.BICUBIC, center=(c, c))
    img.paste(orb, (0, 0), orb)
    d = ImageDraw.Draw(img)
    a = math.radians(28)
    x0, y0 = 360 * math.cos(math.radians(-50)), 130 * math.sin(math.radians(-50))
    x, y = c + x0 * math.cos(a) - y0 * math.sin(a), c + x0 * math.sin(a) + y0 * math.cos(a)
    sat_img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sat_img)
    sd.rectangle([x - 30, y - 30, x + 30, y + 30], fill=(235, 238, 245, 255))
    sd.rectangle([x - 120, y - 15, x - 38, y + 15], fill=(40, 90, 190, 255))
    sd.rectangle([x + 38, y - 15, x + 120, y + 15], fill=(40, 90, 190, 255))
    sat_img = sat_img.rotate(-20, resample=Image.BICUBIC, center=(x, y))
    img.paste(sat_img, (0, 0), sat_img)
    return img

for name, fn in [('solar', solar), ('sat', sat)]:
    im = fn()
    for size in (512, 192, 180):
        im.resize((size, size), Image.LANCZOS).save(f'icons/{name}-{size}.png')
    print('OK', name)
