#!/usr/bin/env python3
"""Generate RageNet app icons from the cabinet logo.

Requires rsvg-convert and ImageMagick. The generated files are committed so
GitHub Actions does not need those tools just to build the app.
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOGO = ROOT / "assets" / "brand" / "logo.svg"
MOBILE_ASSETS = ROOT / "apps" / "mobile" / "assets"
DESKTOP_ICONS = ROOT / "apps" / "desktop" / "src-tauri" / "icons"
TMP = ROOT / ".icon-tmp"

NAVY = "#080D18"


def read_path() -> str:
    source = LOGO.read_text(encoding="utf-8")
    match = re.search(r'<path[^>]*\bd="([^"]+)"', source)
    if not match:
        raise SystemExit("logo.svg does not contain a path")
    return match.group(1)


def svg(size: int, logo_scale: float, background: str | None) -> str:
    path = read_path()
    logo_size = size * logo_scale
    offset = (size - logo_size) / 2
    scale = logo_size / 1000
    bg = ""
    glow = ""
    if background:
        bg = f'<rect width="{size}" height="{size}" fill="{background}"/>'
        glow = f"""
        <defs>
          <radialGradient id="glow" cx="18%" cy="6%" r="72%">
            <stop offset="0%" stop-color="#2F7BFF" stop-opacity="0.22"/>
            <stop offset="55%" stop-color="#2F7BFF" stop-opacity="0.04"/>
            <stop offset="100%" stop-color="#2F7BFF" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="{size}" height="{size}" fill="url(#glow)"/>
        """
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">
      {bg}
      {glow}
      <g transform="translate({offset:.3f} {offset:.3f}) scale({scale:.6f})">
        <path d="{path}" fill="#FFFFFF"/>
      </g>
    </svg>"""


def render(svg_text: str, output: Path, size: int) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temp_svg = TMP / f"{output.stem}.svg"
    temp_svg.write_text(svg_text, encoding="utf-8")
    subprocess.run(
        ["rsvg-convert", "-w", str(size), "-h", str(size), str(temp_svg), "-o", str(output)],
        check=True,
    )


def main() -> None:
    TMP.mkdir(exist_ok=True)
    MOBILE_ASSETS.mkdir(parents=True, exist_ok=True)
    DESKTOP_ICONS.mkdir(parents=True, exist_ok=True)

    render(svg(1024, 0.58, NAVY), MOBILE_ASSETS / "icon.png", 1024)
    render(svg(1024, 0.5, None), MOBILE_ASSETS / "android-icon-foreground.png", 1024)
    render(svg(1024, 0.0, NAVY), MOBILE_ASSETS / "android-icon-background.png", 1024)
    render(svg(1024, 0.5, None), MOBILE_ASSETS / "android-icon-monochrome.png", 1024)
    render(svg(512, 0.6, None), MOBILE_ASSETS / "splash-icon.png", 512)
    render(svg(64, 0.72, NAVY), MOBILE_ASSETS / "favicon.png", 64)

    render(svg(1024, 0.56, NAVY), DESKTOP_ICONS / "icon.png", 1024)
    for size, name in [(32, "32x32.png"), (128, "128x128.png"), (256, "128x128@2x.png")]:
        render(svg(size, 0.58, NAVY), DESKTOP_ICONS / name, size)

    subprocess.run(
        [
            "convert",
            str(DESKTOP_ICONS / "icon.png"),
            "-define",
            "icon:auto-resize=256,128,64,48,32,16",
            str(DESKTOP_ICONS / "icon.ico"),
        ],
        check=True,
    )
    # ImageMagick can write a basic icns container on Linux; macOS uses the PNG
    # fallback if the platform tooling rejects it.
    subprocess.run(
        ["convert", str(DESKTOP_ICONS / "icon.png"), str(DESKTOP_ICONS / "icon.icns")],
        check=True,
    )

    shutil.rmtree(TMP, ignore_errors=True)
    print("Generated mobile and desktop icons.")


if __name__ == "__main__":
    main()
