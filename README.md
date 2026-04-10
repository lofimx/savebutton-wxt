# kaya-wxt

Kaya browser extensions

## Browser Support

* Firefox
* Chrome
* Edge
* Safari (macOS, iOS, iPadOS)
* Orion (via Firefox or Chrome)
* Chromium:
  * Vivaldi
  * Brave
  * Arc

## Architecture

The browser extension is self-sufficient: it stores files locally using OPFS (Origin Private File System) and syncs them directly with the Save Button Server over HTTP. The Save Button desktop apps (GTK on Linux/macOS, WPF on Windows) listen on `localhost:21420` and mirror files to `~/.kaya/` on disk; the extension pushes files to them when available.

Read the [Architecture Decision Records](doc/arch/) for full details.

## Prerequisites

* Node.js 24 (managed via [mise](https://mise.jdx.dev/))
* PNPM

## Development

```bash
cd extension
pnpm install
pnpm dev:chrome    # Chrome with hot reload
pnpm dev:firefox   # Firefox with hot reload
```

### Testing

```bash
cd extension
pnpm test          # run tests once
pnpm test:watch    # run tests in watch mode
```

### Building

```bash
cd extension
pnpm build:chrome   # build for Chrome
pnpm build:firefox  # build for Firefox
pnpm build:edge     # build for Edge
pnpm build:safari   # build for Safari
```

Build output goes to `extension/.output/<browser>-<manifest>/`.

To create distribution zips:

```bash
pnpm zip:chrome
pnpm zip:firefox
pnpm zip:edge
pnpm zip:safari
```

### Cleaning

```bash
cd extension
pnpm clean
pnpm install       # reinstall dependencies after clean
```

This removes all build artifacts (`.output/`), WXT caches (`.wxt/`), installed dependencies (`node_modules/`), and browser dev profiles (`web-ext-artifacts/`).

### Generating Icons

```bash
bin/generate-icons.sh          # extension icons (PNG + SVG) from source SVG
bin/generate-safari-icons.sh   # Safari-specific icons (AppIcon, LargeIcon)
bin/generate-store-assets.sh   # store listing assets (128px, 300px, promo tile)
```

### Safari

Safari requires an Xcode project wrapping the web extension. The Xcode project lives in `safari/` and references the WXT build output at `extension/.output/safari-mv2/`.

```bash
bin/build-safari.sh                  # build WXT output (required before Xcode build)
open "safari/Save Button/Save Button.xcodeproj"  # open in Xcode, then build & run
```

To regenerate the Xcode project from scratch (e.g. after changing entrypoints):

```bash
bin/build-safari.sh --regen
```

### Desktop App Integration

The desktop apps (`savebutton-gtk` for Linux/macOS, `savebutton-wpf` for Windows) are not required for development or normal use. When running, they listen on `localhost:21420` and the browser extension pushes files to them so they can mirror anga to `~/.kaya/` on disk.

## Release

To release a new version:

```bash
ruby bin/release.rb
```

This bumps the patch version in `extension/package.json`, commits, tags (e.g. `v0.1.1`), and pushes. The tag triggers the GitHub Actions workflow which builds the extension for Firefox, Chrome, Edge, and Safari, runs tests, publishes to all four browser stores, and creates a GitHub Release with extension zips.

**Note:** CI only uploads extension zips -- it does not update store listing metadata (icons, screenshots, descriptions). Update those manually in each store's dashboard using the assets in `doc/stores/` (e.g. `store-icon-128.png` for Chrome/Firefox, `store-icon-300.png` for Edge). Edge and Safari also require manual steps after CI completes. See [doc/stores/STORES.md](doc/stores/STORES.md) for details.

For detailed store setup, secrets configuration, and first-time submission instructions, see [doc/stores/STORES.md](doc/stores/STORES.md).

## Safari: Manual Tasks

These steps must be completed in Xcode and App Store Connect before the Safari extension can be distributed.

### One-time Xcode setup

1. Open the project: `open "safari/Save Button/Save Button.xcodeproj"`
2. Select your Apple Developer team for all 4 targets (iOS app, macOS app, iOS extension, macOS extension) and enable automatic signing
3. Register App IDs in the Apple Developer portal:
   - `org.savebutton.safari` (container app)
   - `org.savebutton.safari.Extension` (web extension)
4. Add the **App Groups** capability (`group.org.savebutton`) to both the container app and extension targets on both platforms so they can share data with the full iOS app

### Local testing

**macOS:**
1. Select the "Save Button (macOS)" scheme, press Cmd+R
2. Safari > Settings > Extensions > enable "Save Button"
3. Test: bookmark a page, save text via context menu, save an image, verify sync
4. Check Safari Web Inspector for console errors in the extension background page

**iOS (Simulator or device):**
1. Select the "Save Button (iOS)" scheme, choose a simulator or connected device
2. Build and run
3. Settings > Safari > Extensions > enable "Save Button"
4. Open Safari, test bookmarking and context menu actions

### App Store submission

App Store submissions are automated via CI. See [doc/stores/STORES.md](doc/stores/STORES.md) for details.

## Open Questions

* Ladybird and Servo Browser support in the future?
* "Unsaved" icon: should it just be an outline, instead of grayscale?

## TODO

* [x] First submission to Chrome Web Store (update Chrome Extension ID after publish)
* [x] First submission to Edge Add-ons (update Edge Extension ID after publish)
* [x] Configure GitHub repository secrets for automated store publishing
* [x] Automate Safari CI: secrets configured, see [doc/stores/STORES.md](doc/stores/STORES.md) for details
