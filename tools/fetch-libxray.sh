#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAG="${LIBXRAY_TAG:-v26.10.17}"
DEST="$ROOT/apps/mobile/modules/ragenet-vpn/android/libs"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$DEST"
curl -fL --retry 3 \
  "https://github.com/XTLS/libXray/releases/download/${TAG}/libxray-android.zip" \
  -o "$TMP/libxray-android.zip"
unzip -p "$TMP/libxray-android.zip" libxray-android/libXray.aar > "$DEST/libXray.aar"
echo "libXray.aar -> $DEST/libXray.aar"
