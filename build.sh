#!/usr/bin/env bash
#
# TreePad 构建脚本
#
# 用法:
#   ./build.sh                 使用 package.json 中的版本号构建
#   ./build.sh 1.2.3           指定版本号构建（同时更新 package.json 和 manifest.json）
#   ./build.sh --zip           构建并打包为 .zip
#   ./build.sh 1.2.3 --zip    指定版本号构建并打包
#
# 前置条件:
#   - 已安装 bun（包管理器 + 运行时）
#   - 已执行过 bun install
#
# 构建流程:
#   1. TypeScript 类型检查
#   2. Vite 构建 Content Script（IIFE 单文件，含 Vue + 样式）
#   3. Vite 构建 Service Worker（ES Module 单文件）
#   4. 复制 manifest.json + 图标到输出目录
#
# 产物说明:
#   TreePad-v{版本号}/     <- 干净的扩展目录，可直接在 chrome://extensions 加载
#   TreePad-v{版本号}.zip  <- 仅 --zip 时生成
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

ZIP=false
INPUT_VERSION=""

for arg in "$@"; do
  case "$arg" in
    --zip) ZIP=true ;;
    *)     INPUT_VERSION="$arg" ;;
  esac
done

# 如果指定了版本号，同步写入 package.json 和 manifest.json
if [[ -n "$INPUT_VERSION" ]]; then
  if [[ ! "$INPUT_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "错误: 版本号格式不合法，应为 x.y.z（如 1.2.3）" >&2
    exit 1
  fi
  node -e "
    const fs = require('fs');
    for (const f of ['package.json', 'public/manifest.json']) {
      const data = JSON.parse(fs.readFileSync(f, 'utf8'));
      data.version = '$INPUT_VERSION';
      fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n');
    }
  "
  echo "--- 版本号已更新为 $INPUT_VERSION"
fi

VERSION=$(node -p "require('./package.json').version")
OUT="$ROOT/TreePad-v${VERSION}"

echo "==> TreePad build v${VERSION}"

# 1. 类型检查
echo "--- typecheck"
bunx vue-tsc -b

# 2. 构建 Content Script（IIFE，输出到 dist/）
echo "--- build content script"
bunx vite build -c vite.config.content.ts

# 3. 构建 Service Worker（ESM，追加到 dist/）
echo "--- build service worker"
bunx vite build -c vite.config.background.ts

# 4. 组装干净的输出目录
rm -rf "$OUT" "$OUT.zip"
mkdir -p "$OUT/icons"

cp "$ROOT/dist/content.js"         "$OUT/"
cp "$ROOT/dist/background.js"     "$OUT/"
cp "$ROOT/public/manifest.json"   "$OUT/"
cp "$ROOT/public/icons"/*         "$OUT/icons/"
mkdir -p "$OUT/docs"
cp "$ROOT/docs/GITHUB_OAUTH.md"   "$OUT/docs/"
node "$ROOT/scripts/write_oauth_release_info.mjs" "$ROOT" "$OUT"

# 5. 构建摘要
FILE_COUNT=$(find "$OUT" -type f | wc -l | tr -d ' ')
DIR_SIZE=$(du -sh "$OUT" | cut -f1)
echo ""
echo "==> 产物: $OUT"
echo "    文件数: $FILE_COUNT"
echo "    体积:   $DIR_SIZE"
echo ""
ls -lh "$OUT"/
echo ""

# 6. 可选：打 zip 包
if $ZIP; then
  (cd "$OUT" && zip -qr "$OUT.zip" .)
  ZIP_SIZE=$(du -sh "$OUT.zip" | cut -f1)
  echo "==> Zip: $OUT.zip ($ZIP_SIZE)"
fi

echo "==> 完成。在 chrome://extensions 加载 '$OUT' 即可使用"
