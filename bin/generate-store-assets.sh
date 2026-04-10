#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SVG_PATH="${1:-$PROJECT_ROOT/doc/design/yellow-floppy5.svg}"
SOCIAL_SVG="$PROJECT_ROOT/flargon/doc/design/social-preview.svg"
OUTPUT_DIR="$PROJECT_ROOT/doc/stores"

if [ ! -f "$SVG_PATH" ]; then
  echo "Error: SVG file not found: $SVG_PATH"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "Generating store listing assets from: $SVG_PATH"
echo "Output directory: $OUTPUT_DIR"

# Store icons — rendered directly from SVG at target size
echo "  store-icon-128.png  (Chrome Web Store, Firefox AMO)"
rsvg-convert -w 128 -h 128 "$SVG_PATH" -o "$OUTPUT_DIR/store-icon-128.png"

echo "  store-icon-300.png  (Edge Add-ons)"
rsvg-convert -w 300 -h 300 "$SVG_PATH" -o "$OUTPUT_DIR/store-icon-300.png"

# Chrome small promo tile: 440x280
# Render from the social preview SVG, scaled to fit 440x280
echo "  promo-small-440x280.png  (Chrome Web Store, optional)"
if [ -f "$SOCIAL_SVG" ]; then
  rsvg-convert -w 440 -h 280 --keep-aspect-ratio "$SOCIAL_SVG" -o "$OUTPUT_DIR/promo-small-440x280.png"
else
  echo "  WARNING: social-preview.svg not found at $SOCIAL_SVG"
  echo "           Falling back to icon-based promo tile"
  ICON_SIZE=220
  rsvg-convert -w "$ICON_SIZE" -h "$ICON_SIZE" "$SVG_PATH" -o "$OUTPUT_DIR/_tmp_promo_icon.png"
  convert -size 440x280 xc:white \
    "$OUTPUT_DIR/_tmp_promo_icon.png" -gravity center -composite \
    "$OUTPUT_DIR/promo-small-440x280.png"
  rm "$OUTPUT_DIR/_tmp_promo_icon.png"
fi

echo ""
echo "Done. Generated store assets:"
ls -1 "$OUTPUT_DIR"/*.png 2>/dev/null | while read -r f; do
  echo "  $(basename "$f")  $(identify -format '%wx%h' "$f")"
done

echo ""
echo "Screenshots must be captured manually (1280x800)."
echo "See doc/stores/STORES.md for instructions."
