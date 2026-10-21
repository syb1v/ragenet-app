#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAG="${LIBXRAY_TAG:-v26.10.17}"
DEST="$ROOT/apps/mobile/vendor/libxray/LibXray.xcframework"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$DEST"
if [ -n "${LIBXRAY_APPLE_ZIP:-}" ]; then
  cp "$LIBXRAY_APPLE_ZIP" "$TMP/libxray-apple.zip"
else
  curl -fL --retry 3 \
    "https://github.com/XTLS/libXray/releases/download/${TAG}/libxray-apple-cgo.zip" \
    -o "$TMP/libxray-apple.zip"
fi

unzip -q "$TMP/libxray-apple.zip" \
  'libxray-apple-cgo/LibXray.xcframework/ios-arm64/*' \
  'libxray-apple-cgo/LibXray.xcframework/Info.plist' \
  -d "$TMP/extract"

rm -rf "$DEST"
mv "$TMP/extract/libxray-apple-cgo/LibXray.xcframework" "$DEST"

python3 - "$DEST/Info.plist" <<'PY'
import plistlib
import sys

path = sys.argv[1]
with open(path, "rb") as handle:
    info = plistlib.load(handle)
info["AvailableLibraries"] = [
    library
    for library in info.get("AvailableLibraries", [])
    if library.get("LibraryIdentifier") == "ios-arm64"
]
with open(path, "wb") as handle:
    plistlib.dump(info, handle)
PY

echo "LibXray.xcframework (ios-arm64) -> $DEST"
du -sh "$DEST"
