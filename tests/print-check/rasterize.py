"""Rastérise tests/output/batch.pdf à 300 dpi et découpe chaque étiquette (RGBA brut) pour decode.ts."""
import json
import os
import sys

import fitz  # PyMuPDF

DPI = int(sys.argv[1]) if len(sys.argv) > 1 else 300
OUT = "tests/output/slots"
os.makedirs(OUT, exist_ok=True)
slots = json.load(open("tests/output/slots.json", encoding="utf-8"))
doc = fitz.open("tests/output/batch.pdf")
px_per_mm = DPI / 25.4
pages = {}
for i, s in enumerate(slots):
    if s["page"] not in pages:
        pages[s["page"]] = doc[s["page"]].get_pixmap(dpi=DPI, alpha=False)
        if s["page"] == 0:
            pages[0].save("tests/output/page1.png")
    pix = pages[s["page"]]
    x0, y0 = int(s["x"] * px_per_mm), int(s["y"] * px_per_mm)
    w, h = int(s["w"] * px_per_mm), int(s["h"] * px_per_mm)
    crop = fitz.Pixmap(pix, 0) if False else None
    rect = fitz.IRect(x0, y0, x0 + w, y0 + h)
    sub = fitz.Pixmap(fitz.csRGB, rect, False)
    sub.copy(pix, rect)
    rgba = bytearray()
    samples = sub.samples
    for p in range(0, len(samples), 3):
        rgba += samples[p:p + 3] + b"\xff"
    with open(f"{OUT}/{i}.raw", "wb") as f:
        f.write(rgba)
    json.dump({"w": sub.width, "h": sub.height}, open(f"{OUT}/{i}.json", "w"))
print(f"{len(slots)} étiquettes rastérisées à {DPI} dpi")
