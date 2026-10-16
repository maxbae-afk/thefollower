"""Contact sheet of images over a mid-grey backdrop, for quick review.

usage: python contact.py out.png cols cell_w img1 img2 ...
"""
import sys
from PIL import Image, ImageDraw

out, cols, cell = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
paths = sys.argv[4:]
ims = [Image.open(p).convert("RGBA") for p in paths]
cells = []
for im in ims:
    s = cell / im.width
    cells.append(im.resize((cell, max(1, round(im.height * s))), Image.LANCZOS))
rows = [cells[i:i + cols] for i in range(0, len(cells), cols)]
pad = 16
W = cols * (cell + pad) + pad
H = sum(max(c.height for c in r) + pad + 22 for r in rows) + pad
sheet = Image.new("RGBA", (W, H), (70, 74, 82, 255))
d = ImageDraw.Draw(sheet)
y = pad
k = 0
for r in rows:
    h = max(c.height for c in r)
    for i, c in enumerate(r):
        x = pad + i * (cell + pad)
        sheet.alpha_composite(c, (x, y))
        d.text((x, y + h + 4), paths[k].replace("\\", "/").split("/")[-1], fill=(255, 255, 255, 255))
        k += 1
    y += h + pad + 22
sheet.convert("RGB").save(out)
print(out, sheet.size)
