#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SVG_PATH="${1:-$PROJECT_ROOT/doc/design/yellow-floppy5.svg}"
SAFARI_BASE="$PROJECT_ROOT/safari/Save Button/Shared (App)"
APPICON_DIR="$SAFARI_BASE/Assets.xcassets/AppIcon.appiconset"
LARGEICON_DIR="$SAFARI_BASE/Assets.xcassets/LargeIcon.imageset"
RESOURCES_DIR="$SAFARI_BASE/Resources"

if [ ! -f "$SVG_PATH" ]; then
  echo "Error: SVG file not found: $SVG_PATH"
  exit 1
fi

if [ ! -d "$APPICON_DIR" ]; then
  echo "Error: Safari AppIcon directory not found: $APPICON_DIR"
  echo "Run bin/build-safari.sh --regen first to create the Xcode project."
  exit 1
fi

echo "Generating Safari icons from: $SVG_PATH"

# macOS AppIcon sizes: 16@1x, 16@2x, 32@1x, 32@2x, 128@1x, 128@2x, 256@1x, 256@2x, 512@1x, 512@2x
declare -A MAC_ICONS=(
  ["mac-icon-16@1x.png"]=16
  ["mac-icon-16@2x.png"]=32
  ["mac-icon-32@1x.png"]=32
  ["mac-icon-32@2x.png"]=64
  ["mac-icon-128@1x.png"]=128
  ["mac-icon-128@2x.png"]=256
  ["mac-icon-256@1x.png"]=256
  ["mac-icon-256@2x.png"]=512
  ["mac-icon-512@1x.png"]=512
  ["mac-icon-512@2x.png"]=1024
)

for filename in "${!MAC_ICONS[@]}"; do
  size=${MAC_ICONS[$filename]}
  echo "  $filename (${size}x${size})"
  rsvg-convert -w "$size" -h "$size" "$SVG_PATH" -o "$APPICON_DIR/$filename"
done

# iOS universal icon: 1024x1024
echo "  universal-icon-1024@1x.png (1024x1024)"
rsvg-convert -w 1024 -h 1024 "$SVG_PATH" -o "$APPICON_DIR/universal-icon-1024@1x.png"

# LargeIcon imageset: 128x128
echo "  LargeIcon/icon-128.png (128x128)"
rsvg-convert -w 128 -h 128 "$SVG_PATH" -o "$LARGEICON_DIR/icon-128.png"

# Resources/Icon.png: 128x128
echo "  Resources/Icon.png (128x128)"
rsvg-convert -w 128 -h 128 "$SVG_PATH" -o "$RESOURCES_DIR/Icon.png"

echo ""
echo "Done. Generated Safari icons."
