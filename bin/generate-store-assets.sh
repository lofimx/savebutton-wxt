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

# Promo tiles from social preview SVG
# The SVG is 1200x630 (~1.9:1). The target tiles have different aspect ratios.
# Strategy: render the SVG to cover the target dimensions (scale up so the shorter
# axis fills the target), then center-crop to exact size.
# Background color (#fff3c4) matches the SVG gradient midpoint for any padding.
PROMO_BG="#fff3c4"

if [ -f "$SOCIAL_SVG" ]; then
  # Chrome small promo tile: 440x280 (~1.57:1, taller than SVG aspect)
  echo "  promo-small-440x280.png  (Chrome Web Store, optional)"
  # Need height=280; at SVG aspect 1200:630, that gives width=533. Crop width to 440.
  rsvg-convert -h 280 "$SOCIAL_SVG" -o "$OUTPUT_DIR/_tmp_promo_small.png"
  convert "$OUTPUT_DIR/_tmp_promo_small.png" -gravity center -crop 440x280+0+0 +repage \
    "$OUTPUT_DIR/promo-small-440x280.png"
  rm "$OUTPUT_DIR/_tmp_promo_small.png"

  # Chrome/Edge large promo tile: 1400x560 (2.5:1, wider than SVG aspect)
  echo "  promo-large-1400x560.png (Chrome Web Store, Edge Add-ons, optional)"
  # Need width=1400; at SVG aspect 1200:630, that gives height=735. Crop height to 560.
  rsvg-convert -w 1400 "$SOCIAL_SVG" -o "$OUTPUT_DIR/_tmp_promo_large.png"
  convert "$OUTPUT_DIR/_tmp_promo_large.png" -gravity center -crop 1400x560+0+0 +repage \
    "$OUTPUT_DIR/promo-large-1400x560.png"
  rm "$OUTPUT_DIR/_tmp_promo_large.png"
else
  echo "  WARNING: social-preview.svg not found at $SOCIAL_SVG"
  echo "           Skipping promo tile generation"
fi

echo ""
echo "Done. Generated store assets:"
ls -1 "$OUTPUT_DIR"/*.png 2>/dev/null | while read -r f; do
  echo "  $(basename "$f")  $(identify -format '%wx%h' "$f")"
done

echo ""
echo "Screenshots must be captured manually (1280x800)."
echo "See doc/stores/STORES.md for instructions."
