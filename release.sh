#!/usr/bin/env bash
set -euo pipefail

# ─── helpers ────────────────────────────────────────────────────────────────
die()  { echo "ERROR: $*" >&2; exit 1; }
info() { echo "→ $*"; }

# ─── read version from manifest.json ────────────────────────────────────────
MANIFEST="public/manifest.json"
[[ -f "$MANIFEST" ]] || die "$MANIFEST not found"
VERSION=$(node -p "require('./$MANIFEST').version")
[[ -n "$VERSION" ]] || die "version not found in $MANIFEST"
TAG="v$VERSION"

# ─── optional flags ─────────────────────────────────────────────────────────
DRAFT=false
PRERELEASE=false
SKIP_BUILD=false
NOTES=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --draft)       DRAFT=true ;;
    --pre)         PRERELEASE=true ;;
    --skip-build)  SKIP_BUILD=true ;;
    --notes)       NOTES="$2"; shift ;;
    -h|--help)
      echo "Usage: ./release.sh [--draft] [--pre] [--skip-build] [--notes \"msg\"]"
      exit 0 ;;
    *) die "unknown flag: $1" ;;
  esac
  shift
done

# ─── guard: tag must not already exist ──────────────────────────────────────
if git tag --list "$TAG" | grep -q "$TAG"; then
  die "tag $TAG already exists — bump the version first"
fi

# ─── guard: working tree clean ──────────────────────────────────────────────
if [[ -n $(git status --porcelain) ]]; then
  die "working tree is dirty — commit or stash changes before releasing"
fi

info "releasing $TAG"

# ─── build ──────────────────────────────────────────────────────────────────
if [[ "$SKIP_BUILD" == false ]]; then
  info "building..."
  npm run build
fi

[[ -d dist ]] || die "dist/ not found after build"

# ─── package ────────────────────────────────────────────────────────────────
ZIP="TreePad-$VERSION.zip"
info "packaging → $ZIP"
(cd dist && zip -qr "../$ZIP" .)

# ─── git tag ────────────────────────────────────────────────────────────────
info "tagging $TAG"
git tag "$TAG"
git push origin "$TAG"

# ─── gh release ─────────────────────────────────────────────────────────────
GH_ARGS=(
  release create "$TAG"
  --title "TreePad $TAG"
  "$ZIP"
)

[[ "$DRAFT" == true ]]      && GH_ARGS+=(--draft)
[[ "$PRERELEASE" == true ]] && GH_ARGS+=(--prerelease)
[[ -n "$NOTES" ]]           && GH_ARGS+=(--notes "$NOTES") || GH_ARGS+=(--generate-notes)

info "creating GitHub release..."
gh "${GH_ARGS[@]}"

# ─── cleanup ────────────────────────────────────────────────────────────────
rm -f "$ZIP"

info "done — https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/releases/tag/$TAG"
