"""Generate Quiet Link PNG icons with Python stdlib only (no downloads)."""
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).parent / "icons"
OUT.mkdir(parents=True, exist_ok=True)
BG = (0x12, 0x12, 0x1A, 0xFF)
ACCENT = (0x6C, 0x5C, 0xE7, 0xFF)
WHITE = (0xF5, 0xF5, 0xFB, 0xFF)


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def make_png(size: int) -> bytes:
    rows = bytearray()
    cx = cy = (size - 1) / 2
    r = size * 0.37
    slash = max(1, round(size * 0.09))
    for y in range(size):
        rows.append(0)  # filter: none
        for x in range(size):
            px = BG
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                px = ACCENT
                # diagonal slash from top-left to bottom-right
                if abs((x - y)) <= slash and abs(x - cx) <= r * 0.9:
                    px = WHITE
            rows.extend(px)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(rows), 9)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


for s in (16, 48, 128):
    (OUT / f"icon{s}.png").write_bytes(make_png(s))
    print(f"wrote icons/icon{s}.png ({s}x{s}, {len(make_png(s))} bytes)")
