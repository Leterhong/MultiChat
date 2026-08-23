#!/usr/bin/env bash
set -euo pipefail

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FILE="${1:-}"
COUNT="${2:-all}"
OUT="${3:-}"
FONT_FILE="${4:-${WANGHONG_FONT_PATH:-}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "usage: render.sh <html-file> [N|all] [out-dir] [font-file]" >&2
  exit 1
fi

if [[ ! -x "$CHROME" ]]; then
  echo "error: Google Chrome not found" >&2
  exit 1
fi

if [[ -z "$FONT_FILE" ]]; then
  for candidate in \
    "$HOME/Library/Fonts/Hanzipen.ttc" \
    "$HOME/Library/Fonts/HanziPen.ttc" \
    "/Library/Fonts/Hanzipen.ttc" \
    "/Library/Fonts/HanziPen.ttc" \
    "/System/Library/Fonts/Supplemental/Hanzipen.ttc" \
    "/System/Library/Fonts/Supplemental/HanziPen.ttc"; do
    if [[ -f "$candidate" ]]; then
      FONT_FILE="$candidate"
      break
    fi
  done
fi
if [[ -z "$FONT_FILE" && -d "/System/Library/AssetsV2" ]]; then
  FONT_FILE="$(find /System/Library/AssetsV2 \
    \( -path '*/com_apple_MobileAsset_Font7/*/AssetData/Hanzipen.ttc' \
       -o -path '*/com_apple_MobileAsset_Font8/*/AssetData/Hanzipen.ttc' \) \
    -type f -print -quit 2>/dev/null || true)"
fi
if [[ -z "$FONT_FILE" || ! -f "$FONT_FILE" ]]; then
  echo "error: 找不到预览封面使用的字体文件" >&2
  echo "download: 在 macOS 字体册下载“翩翩体-简”" >&2
  echo "usage: render.sh <html-file> [N|all] [out-dir] [font-file]" >&2
  exit 1
fi

STEM="$(basename "${FILE%.*}")"

if [[ "$COUNT" == "all" ]]; then
  COUNT="$(python3 - "$FILE" <<'PY'
import re
import sys
from pathlib import Path

html = Path(sys.argv[1]).read_text(encoding="utf-8")
print(len(re.findall(r'<section\s+class="[^"]*\bslide\b', html)))
PY
)"
fi

if [[ -z "$COUNT" || "$COUNT" -lt 1 ]]; then
  echo "error: no slides found" >&2
  exit 1
fi

if [[ -z "$OUT" ]]; then
  OUT="$(dirname "$FILE")/${STEM}-png"
fi
mkdir -p "$OUT"

RENDER_DIR="$(mktemp -d "/tmp/wanghong-ppt-render.XXXXXX")"
RENDER_HTML="$RENDER_DIR/deck.html"
trap 'rm -f "$RENDER_HTML"; rmdir "$RENDER_DIR"' EXIT
python3 "$SCRIPT_DIR/prepare_render_html.py" "$FILE" "$FONT_FILE" "$RENDER_HTML"

if ! FONT_CHECK="$("$CHROME" \
  --headless=new \
  --allow-file-access-from-files \
  --disable-gpu \
  --hide-scrollbars \
  --no-sandbox \
  --virtual-time-budget=4000 \
  --dump-dom \
  "file://$RENDER_HTML#/1")"; then
  echo "error: Chrome 字体预检失败" >&2
  exit 1
fi
if [[ "$FONT_CHECK" != *'data-wanghong-font-ready="yes"'* ]]; then
  echo "error: 预览封面字体加载失败" >&2
  exit 1
fi

for i in $(seq 1 "$COUNT"); do
  target="$OUT/${STEM}_$(printf '%02d' "$i").png"
  "$CHROME" \
    --headless=new \
    --allow-file-access-from-files \
    --disable-gpu \
    --hide-scrollbars \
    --no-sandbox \
    --virtual-time-budget=4000 \
    --window-size=1920,1080 \
    --screenshot="$target" \
    "file://$RENDER_HTML#/$i" >/dev/null 2>&1
  [[ -s "$target" ]] || { echo "error: failed to render slide $i" >&2; exit 1; }
  echo "rendered: $target"
done

echo "done: $COUNT slide(s)"
