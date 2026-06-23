# FontBridge

FontBridge is a Chrome Manifest V3 extension that forces websites to use a selected font globally across normal webpage text.

It supports a registry of bundled open-source fonts, system-only profiles for proprietary fonts, custom local font profiles, per-site disable rules, live updates through Chrome storage, and optional open shadow-root styling.

## What It Does

- Overrides normal webpage text with the selected font on supported pages.
- Preserves the page's existing font-weight usage so bold and semibold text can still map to 600 and 700 faces when the selected family provides them.
- Lets you search and filter fonts by category in the popup.
- Supports bundled, system-only, custom, missing-file, and license-review-skipped font states.
- Stores only user settings and custom profiles in Chrome storage.
- Works offline after installation once the bundled font files are present inside the extension.

## Install Unpacked In Chrome

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the `D:\GitHub\FontBridge` folder.

## Current Bundle State

The extension registry is ready for many bundled fonts, but this repository snapshot only ships the Inter files by default.

- Already present in `fonts/`: `Inter`
- Registered as bundled candidates: the rest of the open-source families listed below
- Registered as system-only: proprietary or intentionally local-only families
- Registered as license-review skipped: families we did not bundle because the redistribution path was not clearly verified for this extension

If a bundled candidate has no local files yet, the popup shows `Missing files`. Run the font prep step below to populate the `fonts/` subfolders from local `@fontsource` packages.

## Prepare Bundled Fonts

FontBridge does not fetch fonts from a CDN or any remote runtime source.

Instead, `scripts/prepare-fonts.js` copies local `.woff2` files from installed `@fontsource` packages into the extension's `fonts/` directory.

### Install build-time font packages

```bash
npm install
```

### Copy bundled font files into the extension

```bash
npm run prepare-fonts
```

### Check which bundled files are present

```bash
npm run check-fonts
```

The script prints a report with:

- `Found`
- `Missing`
- `System-only`
- `Skipped due to license review`

If a family does not ship exact `500` or `600` files, the script uses the nearest available normal weight it can find and reports that fallback in the console output instead of failing silently.

## Bundled Open-Source Font Candidates

These are configured as `source: "bundled"` in `font-registry.js` and can be populated locally through `@fontsource`.

### Sans

- Inter
- Geist Sans
- Be Vietnam Pro
- Noto Sans
- IBM Plex Sans
- Roboto
- Source Sans 3
- Open Sans
- Lato
- Figtree
- DM Sans
- Manrope
- Plus Jakarta Sans
- Work Sans
- Nunito Sans
- Atkinson Hyperlegible
- Lexend
- Public Sans
- Instrument Sans
- Reddit Sans
- Onest

### Serif

- Literata
- Merriweather
- Source Serif 4
- Noto Serif
- IBM Plex Serif
- Lora
- Libre Baskerville
- Crimson Pro
- Alegreya

### Mono

- JetBrains Mono
- Geist Mono
- IBM Plex Mono
- Fira Code
- Cascadia Code
- Source Code Pro
- Roboto Mono
- Space Mono
- Ubuntu Mono

### Display / Modern Sans

- Sora
- Space Grotesk
- Outfit
- Urbanist
- Montserrat
- Poppins
- Bricolage Grotesque
- Raleway
- Exo 2
- Rubik

## System-Only Profiles

These are intentionally not bundled. FontBridge can still reference them by `font-family` if the user already has them installed locally.

- Avenir Next
- Helvetica Neue
- Segoe UI Variable
- Segoe UI Variable Display
- Segoe UI
- SF Pro
- SF Mono
- Google Sans
- Arial
- Consolas

## License-Review Skipped

These are exposed as local/system profiles only. They were not bundled because the redistribution path was not clearly verified for this extension through a local open-source package workflow.

- Satoshi
- Switzer
- Clash Grotesk
- Cabinet Grotesk
- Charter

## Why These Fonts Are Not Bundled

SF Pro, SF Mono, Google Sans, Segoe UI, Segoe UI Variable, Helvetica Neue, Avenir Next, Arial, and Consolas are not bundled because they are proprietary, platform fonts, or otherwise not appropriate to redistribute inside this extension bundle.

FontBridge can still reference those family names for users who already have them installed locally.

## Popup Features

- Enable or disable FontBridge globally
- Search fonts by name
- Filter by `Sans`, `Serif`, `Mono`, `Display`, `System`, or `All`
- Select a built-in or custom font profile
- See whether a font is `Bundled`, `System-only`, `Missing files`, `License skipped`, or `Custom`
- Save a custom local font profile
- Disable or re-enable the override on the current site
- Reset the current site
- Toggle `Preserve monospace`
- Toggle `Force monospace too`
- Toggle `Force shadow DOM`
- See the current hostname

## Storage Schema

```json
{
  "enabled": true,
  "selectedFontId": "inter",
  "preserveMonospace": true,
  "forceShadowDom": true,
  "disabledDomains": [],
  "customProfiles": []
}
```

Built-in font registry entries are not duplicated in storage. Only the user's settings and custom profiles are stored there.

## Custom Profiles

Custom profiles are local/system profiles by default.

In the popup, enter:

- `Display name`
- `Font-family name`
- `Category`
- `Fallback stack`

This is useful for local fonts such as `SF Pro Display`, `Segoe UI Variable`, `Avenir Next`, or any internal brand font already installed on the machine.

## How The Extension Applies Fonts

- `font-registry.js` defines the built-in registry and shared settings helpers.
- `content.js` reads the selected font and generates `@font-face` rules only for bundled entries.
- The content script injects a single `#fontbridge-style` tag at `document_start`.
- When `Force shadow DOM` is enabled, FontBridge also injects `#fontbridge-shadow-style` into open shadow roots.
- The extension listens for storage changes so open tabs can update without a reload in most cases.

## Known Limitations

- `chrome://` pages and other protected browser surfaces cannot be modified.
- Closed shadow roots cannot be styled.
- Canvas-rendered text cannot be changed.
- Some icon fonts may still need extra exclusions.
- Some sites may use image-based text or protected embedded frames.

## Privacy

FontBridge does not send browsing data anywhere, does not use analytics, and does not load remote runtime font assets.
