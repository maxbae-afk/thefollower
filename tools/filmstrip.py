"""Sample N frames from a video into one strip image for review.

usage: python filmstrip.py clip.mp4 out.png [n=10] [cell_w=180]
"""
import sys

import cv2
import numpy as np

src, out = sys.argv[1], sys.argv[2]
n = int(sys.argv[3]) if len(sys.argv) > 3 else 10
cw = int(sys.argv[4]) if len(sys.argv) > 4 else 180
cap = cv2.VideoCapture(src)
total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
cells = []
for i in range(n):
    idx = round(i * (total - 1) / (n - 1))
    cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
    ok, f = cap.read()
    if not ok:
        continue
    h = round(f.shape[0] * cw / f.shape[1])
    f = cv2.resize(f, (cw, h), interpolation=cv2.INTER_AREA)
    cv2.putText(f, str(idx), (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    cells.append(f)
cv2.imwrite(out, np.hstack(cells))
print(out, total)
