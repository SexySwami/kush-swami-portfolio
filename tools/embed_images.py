"""Embed images/*.jpg into index.html so the page works as a single file.

Rewrites the block between the EMBEDDED-IMAGES markers in index.html with a
`window.EMBEDDED_IMAGES = { "<name>": "data:image/jpeg;base64,..." }` map,
re-encoding each image at a web-friendly size. Run after changing images/:

    python3 tools/embed_images.py
"""
import base64, io, pathlib, re
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAX_EDGE, QUALITY = 1200, 76
START, END = "/* EMBEDDED-IMAGES:START */", "/* EMBEDDED-IMAGES:END */"

entries = []
for f in sorted((ROOT / "images").glob("*.jpg")):
    im = Image.open(f).convert("RGB")
    im.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    entries.append(f'  "{f.stem}": "data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode()}"')

block = f"{START}\nwindow.EMBEDDED_IMAGES = {{\n" + ",\n".join(entries) + f"\n}};\n{END}"
html = (ROOT / "index.html").read_text()
html, n = re.subn(re.escape(START) + r".*?" + re.escape(END), lambda _: block, html, flags=re.S)
if n != 1:
    raise SystemExit("EMBEDDED-IMAGES markers not found in index.html")
(ROOT / "index.html").write_text(html)
print(f"embedded {len(entries)} images")
