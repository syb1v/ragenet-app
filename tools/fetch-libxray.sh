#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAG="${LIBXRAY_TAG:-v26.10.17}"
ABI="${LIBXRAY_ABI:-arm64-v8a}"
DEST="$ROOT/apps/mobile/modules/ragenet-vpn/android/libs"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$DEST"
curl -fL --retry 3 \
  "https://github.com/XTLS/libXray/releases/download/${TAG}/libxray-android.zip" \
  -o "$TMP/libxray-android.zip"

unzip -p "$TMP/libxray-android.zip" libxray-android/libXray.aar > "$TMP/libXray-full.aar"
unzip -q "$TMP/libXray-full.aar" -d "$TMP/aar"
rm -rf "$TMP/aar/jni"
mkdir -p "$TMP/aar/jni/$ABI"
unzip -p "$TMP/libXray-full.aar" "jni/$ABI/libgojni.so" > "$TMP/aar/jni/$ABI/libgojni.so"

(
  cd "$TMP/aar"
  zip -qr "$DEST/libXray.aar" .
)
unzip -p "$DEST/libXray.aar" classes.jar > "$DEST/libXray-classes.jar"

echo "libXray.aar ($ABI) -> $DEST/libXray.aar"
du -h "$DEST/libXray.aar"
