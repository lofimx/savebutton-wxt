# Save Button WXT Design

**Colors**: 

* Colors should follow the system theme (dark/light)
* Use theme system, never hardcoded values

**Accessibility**:

* Alt text/labels required for icons (use `null` only for decorative)
* Don't rely solely on color - pair with icons/text
* Loading indicators must have labels for screen readers

---

## CSS Framework: Tailwind CSS v4

The extension uses [Tailwind CSS v4](https://tailwindcss.com/) for all UI styling. Tailwind is integrated via the `@tailwindcss/vite` plugin in `wxt.config.ts`.

### Shared Design Tokens

The extension's design tokens are defined in `extension/assets/base.css` and are **copied from `savebutton-web`** (`app/assets/tailwind/application.css`) to ensure visual consistency across the web app and browser extensions.

**Shared tokens include:**

* **Primary palette** (`--color-primary-50` through `--color-primary-900`): Yellow from the floppy icon gradient
* **Neutral palette** (`--color-neutral-50` through `--color-neutral-950`): Zinc (shadcn-style)
* **Semantic colors**: `success`, `error`, `info` with light/default/dark variants
* **Font**: Inter with system font fallback stack

**When the web app's tokens change**, update `extension/assets/base.css` to match. The canonical source of truth for design tokens is `savebutton-web/app/assets/tailwind/application.css`.

### Font: Inter

The Inter variable font (`InterVariable.woff2`) is bundled in `extension/public/fonts/` and loaded via `@font-face` in `base.css`. This is the same font file used by `savebutton-web`.

### Dark Mode / System Theme

The extension follows the operating system's theme preference automatically using Tailwind's built-in `dark:` variant, which maps to `@media (prefers-color-scheme: dark)`. There is no manual theme toggle — the extension respects the user's system setting.

This differs slightly from `savebutton-web`, which uses a `data-theme` attribute with a user toggle (light/dark/auto). The visual result is the same: in both cases, dark mode uses the neutral-950 background and neutral-100 text from the shared token palette.

### File Structure

```
extension/
  assets/
    base.css              # Tailwind import + shared design tokens + base styles
  public/
    fonts/
      InterVariable.woff2 # Bundled Inter variable font
  entrypoints/
    popup/
      style.css           # Imports base.css + popup-specific component styles
    options/
      style.css           # Imports base.css + options-specific component styles
```

### Adding New UI Pages

When adding a new extension UI entrypoint:

1. Create a `style.css` that imports `../../assets/base.css`
2. Add page-specific component styles in `@layer components { }` if needed
3. Use Tailwind utility classes in HTML, including `dark:` variants for dark mode
4. Use the shared design tokens (`primary-*`, `neutral-*`, `success`, `error`, `info`) rather than hardcoded color values
