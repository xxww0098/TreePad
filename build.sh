#!/usr/bin/env bash
#
# TreePad 构建脚本
#
# 用法:
#   ./build.sh                 构建 dev + 正式版本（自动读取 package.json 版本号）
#   ./build.sh --zip           构建并打包为 .zip
#
# 构建流程:
#   1. TypeScript 类型检查
#   2. Vite 构建 Content Script（IIFE 单文件，含 Vue + 样式）
#   3. Vite 构建 Service Worker（ES Module 单文件）
#   4. 复制 manifest.json + 图标到输出目录
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

ZIP=false
for arg in "$@"; do
  case "$arg" in
    --zip) ZIP=true ;;
    *)     echo "未知参数: $arg" >&2; exit 1 ;;
  esac
done

# 读取 package.json 中的版本号
VERSION=$(node -p "require('./package.json').version")

# 保存原始 package.json 和 manifest.json
PKG_ORIG="$ROOT/package.json.bak"
MANIFEST_ORIG="$ROOT/public/manifest.json.bak"
cp "$ROOT/package.json" "$PKG_ORIG"
cp "$ROOT/public/manifest.json" "$MANIFEST_ORIG"

cleanup() {
  cp "$PKG_ORIG" "$ROOT/package.json"
  cp "$MANIFEST_ORIG" "$ROOT/public/manifest.json"
  rm -f "$PKG_ORIG" "$MANIFEST_ORIG"
}
trap cleanup EXIT

update_version() {
  local v="$1"
  node -e "
    const fs = require('fs');
    for (const f of ['package.json', 'public/manifest.json']) {
      const data = JSON.parse(fs.readFileSync(f, 'utf8'));
      data.version = '$v';
      fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n');
    }
  "
}

assemble_output() {
  local target="$1"
  rm -rf "$target"
  mkdir -p "$target/icons"
  cp "$ROOT/dist/content.js"         "$target/"
  cp "$ROOT/dist/background.js"      "$target/"
  cp "$ROOT/public/manifest.json"    "$target/"
  cp "$ROOT/public/icons"/*          "$target/icons/"
}

# 1. 类型检查
echo "--- typecheck"
bunx vue-tsc -b

# 2. 构建 Content Script（IIFE，输出到 dist/）
echo "--- build content script"
bunx vite build -c vite.config.content.ts

# 3. 构建 Service Worker（ESM，追加到 dist/）
echo "--- build service worker"
bunx vite build -c vite.config.background.ts

# ========== 构建 dev 版本 ==========
echo ""
echo "==> 构建 TreePad-dev"
update_version "0.0.0"
assemble_output "$ROOT/TreePad-dev"
echo "==> 产物: $ROOT/TreePad-dev"

# ========== 构建正式版本 ==========
echo ""
echo "==> 构建 TreePad-v${VERSION}"
rm -rf "$ROOT/TreePad-v${VERSION}" "$ROOT/TreePad-v${VERSION}.zip"
update_version "$VERSION"
assemble_output "$ROOT/TreePad-v${VERSION}"

FILE_COUNT=$(find "$ROOT/TreePad-v${VERSION}" -type f | wc -l | tr -d ' ')
DIR_SIZE=$(du -sh "$ROOT/TreePad-v${VERSION}" | cut -f1)
echo "    文件数: $FILE_COUNT"
echo "    体积:   $DIR_SIZE"

if $ZIP; then
  (cd "$ROOT/TreePad-v${VERSION}" && zip -qr "../TreePad-v${VERSION}.zip" .)
  ZIP_SIZE=$(du -sh "$ROOT/TreePad-v${VERSION}.zip" | cut -f1)
  echo "==> Zip: $ROOT/TreePad-v${VERSION}.zip ($ZIP_SIZE)"
fi

echo ""
echo "==> 完成。"
