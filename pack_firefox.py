#!/usr/bin/env python3
"""Build the Firefox/AMO-signed XPI for Quiet Link.

The .xpi is a ZIP with the Firefox manifest at its root. AMO signing is free,
so this opens a second distribution rail with money-out = 0. No runtime file
makes a network call; the manifest is checked by test_no_remote_urls_in_manifest.
"""
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FILES = [
    "background.js", "popup.html", "popup.js",
    "core/link.js",
    "icons/icon16.png", "icons/icon48.png", "icons/icon128.png",
    "LICENSE",
]


def main() -> int:
    fx = ROOT / "firefox_manifest.json"
    if not fx.is_file():
        raise SystemExit("missing firefox_manifest.json")
    manifest = json.loads(fx.read_text(encoding="utf-8"))
    assert manifest.get("manifest_version") == 3

    missing = [f for f in FILES if not (ROOT / f).is_file()]
    if missing:
        raise SystemExit("missing files: " + ", ".join(missing))

    out = ROOT / "dist" / "quiet-link-1.0.0-fx.xpi"
    out.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        z.writestr("manifest.json", json.dumps(manifest, indent=2))
        for rel in FILES:
            z.write(ROOT / rel, rel)
    print(f"packed {out} ({out.stat().st_size} bytes, {len(FILES) + 1} files)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
