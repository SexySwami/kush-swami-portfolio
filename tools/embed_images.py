"""Embed images/* into index.html so the page works as a single file.

Rewrites the block between the EMBEDDED-IMAGES markers in index.html with a
`window.EMBEDDED_IMAGES = { "<name>": "data:image/...;base64,..." }` map,
re-encoding each image at a web-friendly size. JPEGs stay JPEG; PNGs (e.g.
transparent cutouts) become WebP so they keep their alpha. Full-screen story
images (story-*) are kept larger than project images. Run after changing
images/:

    python3 tools/embed_images.py
"""
import base64, io, pathlib, re
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
START, END = "/* EMBEDDED-IMAGES:START */", "/* EMBEDDED-IMAGES:END */"


def encode(path):
    im = Image.open(path)
    big = path.stem.startswith("story-")
    max_edge = 2000 if big else 1200
    buf = io.BytesIO()
    if im.mode in ("RGBA", "LA", "P") and path.suffix.lower() == ".png":
        im = im.convert("RGBA")
        im.thumbnail((max_edge, max_edge), Image.LANCZOS)
        im.save(buf, "WEBP", quality=86, method=6)
        mime = "image/webp"
    else:
        im = im.convert("RGB")
        im.thumbnail((max_edge, max_edge), Image.LANCZOS)
        im.save(buf, "JPEG", quality=82 if big else 76, optimize=True, progressive=True)
        mime = "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(buf.getvalue()).decode()}"


files = sorted(p for p in (ROOT / "images").iterdir() if p.suffix.lower() in (".jpg", ".jpeg", ".png"))
entries = [f'  "{p.stem}": "{encode(p)}"' for p in files]

block = f"{START}\nwindow.EMBEDDED_IMAGES = {{\n" + ",\n".join(entries) + f"\n}};\n{END}"
html = (ROOT / "index.html").read_text()
html, n = re.subn(re.escape(START) + r".*?" + re.escape(END), lambda _: block, html, flags=re.S)
if n != 1:
    raise SystemExit("EMBEDDED-IMAGES markers not found in index.html")
(ROOT / "index.html").write_text(html)
print(f"embedded {len(entries)} images")
