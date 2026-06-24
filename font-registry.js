(function initFontBridgeRegistry(global) {
  "use strict";

  const FONTBRIDGE_STORAGE_KEY = "fontBridgeSettings";

  const FONTBRIDGE_FALLBACKS = Object.freeze({
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
    mono:
      'ui-monospace, SFMono-Regular, SF Mono, Cascadia Code, Consolas, Liberation Mono, Menlo, monospace',
    display: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  });

  const WEIGHT_LABELS = Object.freeze({
    400: "Regular",
    500: "Medium",
    600: "SemiBold",
    700: "Bold"
  });

  const BUNDLED_FONT_CANDIDATES = [
    { id: "inter", name: "Inter", category: "sans", packageName: "@fontsource/inter" },
    { id: "geist-sans", name: "Geist Sans", category: "sans", packageName: "@fontsource/geist-sans" },
    { id: "be-vietnam-pro", name: "Be Vietnam Pro", category: "sans", packageName: "@fontsource/be-vietnam-pro" },
    { id: "noto-sans", name: "Noto Sans", category: "sans", packageName: "@fontsource/noto-sans" },
    { id: "ibm-plex-sans", name: "IBM Plex Sans", category: "sans", packageName: "@fontsource/ibm-plex-sans" },
    { id: "roboto", name: "Roboto", category: "sans", packageName: "@fontsource/roboto" },
    { id: "source-sans-3", name: "Source Sans 3", category: "sans", packageName: "@fontsource/source-sans-3" },
    { id: "open-sans", name: "Open Sans", category: "sans", packageName: "@fontsource/open-sans" },
    { id: "lato", name: "Lato", category: "sans", packageName: "@fontsource/lato" },
    { id: "figtree", name: "Figtree", category: "sans", packageName: "@fontsource/figtree" },
    { id: "dm-sans", name: "DM Sans", category: "sans", packageName: "@fontsource/dm-sans" },
    { id: "manrope", name: "Manrope", category: "sans", packageName: "@fontsource/manrope" },
    {
      id: "plus-jakarta-sans",
      name: "Plus Jakarta Sans",
      category: "sans",
      packageName: "@fontsource/plus-jakarta-sans"
    },
    { id: "work-sans", name: "Work Sans", category: "sans", packageName: "@fontsource/work-sans" },
    { id: "nunito-sans", name: "Nunito Sans", category: "sans", packageName: "@fontsource/nunito-sans" },
    {
      id: "atkinson-hyperlegible",
      name: "Atkinson Hyperlegible",
      category: "sans",
      packageName: "@fontsource/atkinson-hyperlegible"
    },
    { id: "lexend", name: "Lexend", category: "sans", packageName: "@fontsource/lexend" },
    { id: "public-sans", name: "Public Sans", category: "sans", packageName: "@fontsource/public-sans" },
    {
      id: "instrument-sans",
      name: "Instrument Sans",
      category: "sans",
      packageName: "@fontsource/instrument-sans"
    },
    { id: "reddit-sans", name: "Reddit Sans", category: "sans", packageName: "@fontsource/reddit-sans" },
    { id: "onest", name: "Onest", category: "sans", packageName: "@fontsource/onest" },

    { id: "literata", name: "Literata", category: "serif", packageName: "@fontsource/literata" },
    { id: "merriweather", name: "Merriweather", category: "serif", packageName: "@fontsource/merriweather" },
    { id: "source-serif-4", name: "Source Serif 4", category: "serif", packageName: "@fontsource/source-serif-4" },
    { id: "noto-serif", name: "Noto Serif", category: "serif", packageName: "@fontsource/noto-serif" },
    { id: "ibm-plex-serif", name: "IBM Plex Serif", category: "serif", packageName: "@fontsource/ibm-plex-serif" },
    { id: "lora", name: "Lora", category: "serif", packageName: "@fontsource/lora" },
    {
      id: "libre-baskerville",
      name: "Libre Baskerville",
      category: "serif",
      packageName: "@fontsource/libre-baskerville"
    },
    { id: "crimson-pro", name: "Crimson Pro", category: "serif", packageName: "@fontsource/crimson-pro" },
    { id: "alegreya", name: "Alegreya", category: "serif", packageName: "@fontsource/alegreya" },

    {
      id: "jetbrains-mono",
      name: "JetBrains Mono",
      category: "mono",
      packageName: "@fontsource/jetbrains-mono"
    },
    { id: "geist-mono", name: "Geist Mono", category: "mono", packageName: "@fontsource/geist-mono" },
    { id: "ibm-plex-mono", name: "IBM Plex Mono", category: "mono", packageName: "@fontsource/ibm-plex-mono" },
    { id: "fira-code", name: "Fira Code", category: "mono", packageName: "@fontsource/fira-code" },
    {
      id: "cascadia-code",
      name: "Cascadia Code",
      category: "mono",
      packageName: "@fontsource/cascadia-code"
    },
    {
      id: "source-code-pro",
      name: "Source Code Pro",
      category: "mono",
      packageName: "@fontsource/source-code-pro"
    },
    { id: "roboto-mono", name: "Roboto Mono", category: "mono", packageName: "@fontsource/roboto-mono" },
    { id: "space-mono", name: "Space Mono", category: "mono", packageName: "@fontsource/space-mono" },
    { id: "ubuntu-mono", name: "Ubuntu Mono", category: "mono", packageName: "@fontsource/ubuntu-mono" },

    { id: "sora", name: "Sora", category: "display", packageName: "@fontsource/sora" },
    {
      id: "space-grotesk",
      name: "Space Grotesk",
      category: "display",
      packageName: "@fontsource/space-grotesk"
    },
    { id: "outfit", name: "Outfit", category: "display", packageName: "@fontsource/outfit" },
    { id: "urbanist", name: "Urbanist", category: "display", packageName: "@fontsource/urbanist" },
    { id: "montserrat", name: "Montserrat", category: "display", packageName: "@fontsource/montserrat" },
    { id: "poppins", name: "Poppins", category: "display", packageName: "@fontsource/poppins" },
    {
      id: "bricolage-grotesque",
      name: "Bricolage Grotesque",
      category: "display",
      packageName: "@fontsource/bricolage-grotesque"
    },
    { id: "raleway", name: "Raleway", category: "display", packageName: "@fontsource/raleway" },
    { id: "exo-2", name: "Exo 2", category: "display", packageName: "@fontsource/exo-2" },
    { id: "rubik", name: "Rubik", category: "display", packageName: "@fontsource/rubik" }
  ];

  const MONO_COMPANION_MAP = Object.freeze({
    "geist-sans": "geist-mono",
    "ibm-plex-sans": "ibm-plex-mono",
    "ibm-plex-serif": "ibm-plex-mono",
    "roboto": "roboto-mono",
    "source-sans-3": "source-code-pro",
    "source-serif-4": "source-code-pro",
    "space-grotesk": "space-mono",
    "sf-pro": "sf-mono"
  });

  const LICENSE_REVIEW_CANDIDATES = [
    {
      id: "satoshi",
      name: "Satoshi",
      fontFamily: "Satoshi",
      fallback: FONTBRIDGE_FALLBACKS.sans,
      note: "Skipped bundled assets because the redistribution path was not verified in a local open-source package."
    },
    {
      id: "switzer",
      name: "Switzer",
      fontFamily: "Switzer",
      fallback: FONTBRIDGE_FALLBACKS.sans,
      note: "Skipped bundled assets because the redistribution path was not verified in a local open-source package."
    },
    {
      id: "clash-grotesk",
      name: "Clash Grotesk",
      fontFamily: "Clash Grotesk",
      fallback: FONTBRIDGE_FALLBACKS.sans,
      note: "Skipped bundled assets because the redistribution path was not verified in a local open-source package."
    },
    {
      id: "cabinet-grotesk",
      name: "Cabinet Grotesk",
      fontFamily: "Cabinet Grotesk",
      fallback: FONTBRIDGE_FALLBACKS.sans,
      note: "Skipped bundled assets because the redistribution path was not verified in a local open-source package."
    },
    {
      id: "charter",
      name: "Charter",
      fontFamily: "Charter",
      fallback: FONTBRIDGE_FALLBACKS.serif,
      note: "Skipped bundled assets because the redistribution path was not verified in a local open-source package."
    }
  ];

  const SYSTEM_ONLY_CANDIDATES = [
    {
      id: "avenir-next",
      name: "Avenir Next",
      fontFamily: "Avenir Next",
      fallback: 'Avenir, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    },
    {
      id: "helvetica-neue",
      name: "Helvetica Neue",
      fontFamily: "Helvetica Neue",
      fallback: "Helvetica, Arial, system-ui, sans-serif"
    },
    {
      id: "segoe-ui-variable",
      name: "Segoe UI Variable",
      fontFamily: "Segoe UI Variable",
      fallback: '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
    },
    {
      id: "segoe-ui-variable-display",
      name: "Segoe UI Variable Display",
      fontFamily: "Segoe UI Variable Display",
      fallback: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif'
    },
    {
      id: "segoe-ui",
      name: "Segoe UI",
      fontFamily: "Segoe UI",
      fallback: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
    },
    {
      id: "sf-pro",
      name: "SF Pro",
      fontFamily: "SF Pro Display",
      fallback: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif'
    },
    {
      id: "sf-mono",
      name: "SF Mono",
      fontFamily: "SF Mono",
      fallback:
        'ui-monospace, SFMono-Regular, Cascadia Code, Consolas, Liberation Mono, Menlo, monospace'
    },
    {
      id: "google-sans",
      name: "Google Sans",
      fontFamily: "Google Sans",
      fallback: 'Roboto, Arial, system-ui, sans-serif'
    },
    {
      id: "arial",
      name: "Arial",
      fontFamily: "Arial",
      fallback: 'Helvetica, system-ui, sans-serif'
    },
    {
      id: "consolas",
      name: "Consolas",
      fontFamily: "Consolas",
      fallback:
        'ui-monospace, SFMono-Regular, Cascadia Code, Liberation Mono, Menlo, monospace'
    }
  ];

  function buildWeightMap(id, fileStem) {
    const weights = {};

    for (const [weight, label] of Object.entries(WEIGHT_LABELS)) {
      weights[weight] = `fonts/${id}/${fileStem}-${label}.woff2`;
    }

    return weights;
  }

  function fontFileStem(name) {
    return String(name).replace(/[^A-Za-z0-9]+/g, "");
  }

  function getFontBridgeFallback(category) {
    if (category === "mono") {
      return FONTBRIDGE_FALLBACKS.mono;
    }

    if (category === "serif") {
      return FONTBRIDGE_FALLBACKS.serif;
    }

    if (category === "display") {
      return FONTBRIDGE_FALLBACKS.display;
    }

    return FONTBRIDGE_FALLBACKS.sans;
  }

  function createBundledEntry(spec) {
    return {
      id: spec.id,
      name: spec.name,
      category: spec.category,
      source: "bundled",
      status: "bundled",
      fontFamily: spec.name,
      fallback: getFontBridgeFallback(spec.category),
      weights: buildWeightMap(spec.id, fontFileStem(spec.name)),
      packageName: spec.packageName,
      note:
        spec.note ||
        "Bundled through local @fontsource package preparation when matching files are available."
    };
  }

  function createSystemEntry(spec, status) {
    return {
      id: spec.id,
      name: spec.name,
      category: "system",
      source: "system",
      status,
      fontFamily: spec.fontFamily || spec.name,
      fallback: spec.fallback || FONTBRIDGE_FALLBACKS.sans,
      weights: null,
      note: spec.note || ""
    };
  }

  const FONT_REGISTRY = Object.freeze(
    BUNDLED_FONT_CANDIDATES.map(createBundledEntry)
      .concat(LICENSE_REVIEW_CANDIDATES.map((spec) => createSystemEntry(spec, "license-review-skipped")))
      .concat(SYSTEM_ONLY_CANDIDATES.map((spec) => createSystemEntry(spec, "system-only")))
  );

  const FONT_REGISTRY_BY_ID = Object.freeze(
    FONT_REGISTRY.reduce((accumulator, entry) => {
      accumulator[entry.id] = entry;
      return accumulator;
    }, {})
  );

  const FONTBRIDGE_DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    selectedFontId: "inter",
    preserveMonospace: true,
    forceShadowDom: true,
    disabledDomains: [],
    customProfiles: []
  });

  function sanitizeId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function sanitizeFontFamily(value) {
    return String(value || "")
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/[\n\r;]/g, "")
      .slice(0, 140);
  }

  function sanitizeFallback(value) {
    return String(value || "")
      .replace(/[{};@\n\r]/g, "")
      .trim()
      .slice(0, 320);
  }

  function normalizeDomain(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^www\./, "")
      .replace(/:\d+$/, "")
      .replace(/[^a-z0-9.-]/g, "");
  }

  function normalizeCategory(value) {
    const category = String(value || "").trim().toLowerCase();
    return ["sans", "serif", "mono", "display", "system"].includes(category)
      ? category
      : "sans";
  }

  function createFontBridgeCustomProfile(profile) {
    const displayName = String(profile?.name || profile?.displayName || profile?.fontFamily || "")
      .trim()
      .slice(0, 120);
    const fontFamily = sanitizeFontFamily(profile?.fontFamily || displayName);
    const category = normalizeCategory(profile?.category);
    const idBase = sanitizeId(profile?.id || displayName || fontFamily || "custom-font");
    const id = idBase.startsWith("custom-") ? idBase : `custom-${idBase}`;

    return {
      id,
      name: displayName || fontFamily,
      category,
      source: "custom",
      status: "custom",
      fontFamily,
      fallback: sanitizeFallback(profile?.fallback || getFontBridgeFallback(category)),
      weights: null,
      note: "Custom local/system font profile."
    };
  }

  function normalizeCustomProfiles(customProfiles) {
    if (!Array.isArray(customProfiles)) {
      return [];
    }

    const map = new Map();

    for (const profile of customProfiles) {
      if (!profile || typeof profile !== "object") {
        continue;
      }

      const normalized = createFontBridgeCustomProfile(profile);
      if (!normalized.id || !normalized.fontFamily) {
        continue;
      }

      let candidateId = normalized.id;
      let suffix = 2;
      while (map.has(candidateId)) {
        candidateId = `${normalized.id}-${suffix}`;
        suffix += 1;
      }

      map.set(candidateId, {
        ...normalized,
        id: candidateId
      });
    }

    return Array.from(map.values());
  }

  function mergeFontBridgeProfiles(customProfiles) {
    return FONT_REGISTRY.concat(normalizeCustomProfiles(customProfiles));
  }

  function normalizeFontBridgeSettings(rawSettings) {
    const source = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
    const normalized = {
      ...FONTBRIDGE_DEFAULT_SETTINGS,
      ...source,
      enabled: source.enabled !== false,
      selectedFontId: String(source.selectedFontId || FONTBRIDGE_DEFAULT_SETTINGS.selectedFontId),
      preserveMonospace: source.preserveMonospace !== false,
      forceShadowDom: source.forceShadowDom !== false,
      disabledDomains: Array.isArray(source.disabledDomains)
        ? Array.from(new Set(source.disabledDomains.map(normalizeDomain).filter(Boolean)))
        : [],
      customProfiles: normalizeCustomProfiles(source.customProfiles)
    };

    const fontMap = mergeFontBridgeProfiles(normalized.customProfiles).reduce((map, entry) => {
      map[entry.id] = entry;
      return map;
    }, {});

    if (!fontMap[normalized.selectedFontId]) {
      normalized.selectedFontId = FONTBRIDGE_DEFAULT_SETTINGS.selectedFontId;
    }

    return normalized;
  }

  function getFontBridgeProfileById(fontId, customProfiles) {
    const profiles = mergeFontBridgeProfiles(customProfiles);
    return profiles.find((entry) => entry.id === fontId) || FONT_REGISTRY_BY_ID.inter || profiles[0];
  }

  function findMonoCompanion(fontId, customProfiles) {
    const companionId = MONO_COMPANION_MAP[fontId];
    if (!companionId) {
      return null;
    }
    const profiles = mergeFontBridgeProfiles(customProfiles);
    return profiles.find((entry) => entry.id === companionId) || null;
  }

  const api = {
    FONTBRIDGE_STORAGE_KEY,
    FONTBRIDGE_FALLBACKS,
    FONTBRIDGE_DEFAULT_SETTINGS,
    FONT_REGISTRY,
    FONT_REGISTRY_BY_ID,
    MONO_COMPANION_MAP,
    WEIGHT_LABELS,
    buildWeightMap,
    createFontBridgeCustomProfile,
    findMonoCompanion,
    getFontBridgeFallback,
    getFontBridgeProfileById,
    mergeFontBridgeProfiles,
    normalizeCategory,
    normalizeCustomProfiles,
    normalizeDomain,
    normalizeFontBridgeSettings,
    sanitizeFallback,
    sanitizeFontFamily,
    sanitizeId
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (global) {
    Object.assign(global, api);
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
