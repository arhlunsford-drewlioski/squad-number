# Draws the app icons into public/. Run: python3 scripts/make-icons.py
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public')
S = 1024
BG, PITCH, LINE, GOLD = (20, 23, 28), (31, 95, 58), (255, 255, 255, 200), (245, 200, 76)
FONTS = ['/System/Library/Fonts/Supplemental/Arial Black.ttf', '/System/Library/Fonts/Supplemental/Impact.ttf', '/System/Library/Fonts/Helvetica.ttc']

def font(size):
    for f in FONTS:
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()

def draw(full_bleed: bool, inset: float) -> Image.Image:
    img = Image.new('RGBA', (S, S), BG if full_bleed else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if not full_bleed:
        d.rounded_rectangle([0, 0, S, S], radius=int(S * 0.19), fill=BG)
    m = int(S * inset)                      # margin around the pitch
    d.rounded_rectangle([m, m, S - m, S - m], radius=int(S * 0.12), fill=PITCH)
    lw = int(S * 0.012)
    pm = m + int(S * 0.05)
    d.rounded_rectangle([pm, pm, S - pm, S - pm], radius=int(S * 0.04), outline=LINE, width=lw)
    d.line([pm, S // 2, S - pm, S // 2], fill=LINE, width=lw)
    r = int(S * 0.13)
    d.ellipse([S // 2 - r, S // 2 - r, S // 2 + r, S // 2 + r], outline=LINE, width=lw)
    f = font(int(S * 0.5))
    bb = d.textbbox((0, 0), '9', font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((S - tw) / 2 - bb[0], (S - th) / 2 - bb[1] + int(S * 0.02)), '9', font=f, fill=GOLD)
    return img

def save(img, name, size):
    img.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name))

rounded = draw(False, 0.08)
bleed = draw(True, 0.16)       # maskable: the artwork stays inside the safe zone
save(rounded, 'icon-512.png', 512)
save(rounded, 'icon-192.png', 192)
save(bleed, 'icon-maskable-512.png', 512)
save(bleed, 'apple-touch-icon.png', 180)
save(rounded, 'favicon-64.png', 64)
print('wrote icons to', os.path.abspath(OUT))

# The iOS app icon: 1024 pixels, square, no transparency (the system rounds the corners).
ios = os.path.join(os.path.dirname(__file__), '..', 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset')
if os.path.isdir(ios):
    full = draw(True, 0.1).convert('RGB')
    full.save(os.path.join(ios, 'AppIcon-512@2x.png'))
    print('wrote the iOS app icon')
