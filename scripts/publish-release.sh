#!/usr/bin/env bash
set -euo pipefail

TAG="${1:?release tag is required}"
VERSION="${2:?version is required}"
shift 2

if [ "$#" -eq 0 ]; then
  echo "No release assets provided" >&2
  exit 1
fi

PRERELEASE="${PRERELEASE:-false}"
TITLE="${TITLE:-RageNet ${VERSION}}"
NOTES="${RELEASE_NOTES:-Build: ${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}}"

files=()
for target in "$@"; do
  if [ -d "$target" ]; then
    while IFS= read -r -d '' file; do
      files+=("$file")
    done < <(find "$target" -type f -print0)
  elif [ -f "$target" ]; then
    files+=("$target")
  else
    echo "Missing release asset: $target" >&2
    exit 1
  fi
done

if [ "${#files[@]}" -eq 0 ]; then
  echo "No files found in release assets" >&2
  exit 1
fi

if ! gh release view "$TAG" >/dev/null 2>&1; then
  args=(release create "$TAG" --title "$TITLE" --notes "$NOTES" --target "${GITHUB_SHA:-main}")
  if [ "$PRERELEASE" = "true" ]; then
    args+=(--prerelease)
  fi
  # Two platform workflows may race to create the same release. The loser
  # continues and uploads its assets to the release created by the winner.
  gh "${args[@]}" >/dev/null 2>&1 || true
fi

for _ in $(seq 1 10); do
  if gh release view "$TAG" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! gh release view "$TAG" >/dev/null 2>&1; then
  echo "Release $TAG was not created" >&2
  exit 1
fi

gh release upload "$TAG" "${files[@]}" --clobber

if [ "$PRERELEASE" != "true" ]; then
  gh release edit "$TAG" --prerelease=false --latest >/dev/null
fi

echo "Published ${#files[@]} asset(s) to $TAG"
