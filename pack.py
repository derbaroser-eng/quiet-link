#!/usr/bin/env python3
"""Build the store-upload ZIP for Quiet Link. Extension files must sit at ZIP root."""
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FILES = [
    "manifest.json", "background.js", "popup.html", "popup.js",
    "core/link.js", "icons/icon16.png", "icons/icon48.png", "icons/icon128.png",
    "LICENSE",
]
out = ROOT / "dist" / "quiet-link-1.0.0.zip"
out.parent.mkdir(exist_ok=True)
missing = [f for f in FILES if not (ROOT / f).is_file()]
if missing:
    raise SystemExit("missing files: " + ", ".join(missing))
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for rel in FILES:
        z.write(ROOT / rel, rel)
print(f"packed {out} ({out.stat().st_size} bytes, {len(FILES)} files)")
