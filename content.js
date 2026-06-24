(function fontBridgeContentScript() {
  "use strict";

  const DOCUMENT_STYLE_ID = "fontbridge-style";
  const SHADOW_STYLE_ID = "fontbridge-shadow-style";

  const ICON_EXCLUSIONS = [
    ".material-icons",
    ".material-icons *",
    ".material-symbols-outlined",
    ".material-symbols-outlined *",
    ".material-symbols-rounded",
    ".material-symbols-rounded *",
    ".material-symbols-sharp",
    ".material-symbols-sharp *",
    ".fa",
    ".fa *",
    ".fas",
    ".fas *",
    ".far",
    ".far *",
    ".fab",
    ".fab *",
    '[class*="icon"]',
    '[class*="icon"] *',
    '[class*="Icon"]',
    '[class*="Icon"] *',
    "svg",
    "svg *",
    "canvas"
  ];

  const MONOSPACE_EXCLUSIONS = [
    "code",
    "code *",
    "pre",
    "pre *",
    "kbd",
    "kbd *",
    "samp",
    "samp *",
    "textarea",
    'input[type="text"]',
    'input[type="search"]',
    'input[type="email"]',
    'input[type="url"]',
    'input[type="password"]'
  ];

  let settings = normalizeFontBridgeSettings(FONTBRIDGE_DEFAULT_SETTINGS);
  let documentCss = "";
  let shadowCss = "";
  let mutationObserver = null;
  let pendingScanTimer = 0;
  let pendingScanNodes = new Set();
  let knownShadowRoots = new Set();
  let historyPatched = false;

  init();

  async function init() {
    settings = await readSettings();
    installStorageListener();
    patchOpenShadowRoots();
    patchSpaNavigation();
    installMutationObserver();
    refreshFontBridge();
    scheduleShadowScan(document);
  }

  async function readSettings() {
    if (!chrome?.storage?.sync) {
      return normalizeFontBridgeSettings(FONTBRIDGE_DEFAULT_SETTINGS);
    }

    try {
      const result = await chrome.storage.sync.get({
        [FONTBRIDGE_STORAGE_KEY]: FONTBRIDGE_DEFAULT_SETTINGS
      });
      return normalizeFontBridgeSettings(result[FONTBRIDGE_STORAGE_KEY]);
    } catch (error) {
      console.warn("[FontBridge] Could not read settings.", error);
      return normalizeFontBridgeSettings(FONTBRIDGE_DEFAULT_SETTINGS);
    }
  }

  function installStorageListener() {
    if (!chrome?.storage?.onChanged) {
      return;
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync" || !changes[FONTBRIDGE_STORAGE_KEY]) {
        return;
      }

      settings = normalizeFontBridgeSettings(changes[FONTBRIDGE_STORAGE_KEY].newValue);
      refreshFontBridge();
      scheduleShadowScan(document);
    });
  }

  function refreshFontBridge() {
    if (!shouldApply(settings)) {
      removeDocumentStyle();
      removeShadowStyles();
      return;
    }

    const selectedFont = getFontBridgeProfileById(settings.selectedFontId, settings.customProfiles);
    documentCss = buildDocumentCss(selectedFont, settings);
    shadowCss = buildShadowCss(selectedFont, settings);

    ensureDocumentStyle(documentCss);

    if (settings.forceShadowDom) {
      refreshKnownShadowRoots();
    } else {
      removeShadowStyles();
    }
  }

  function shouldApply(nextSettings) {
    return Boolean(nextSettings.enabled) && !isCurrentDomainDisabled(nextSettings);
  }

  function isCurrentDomainDisabled(nextSettings) {
    const host = normalizeDomain(location.hostname || location.protocol.replace(":", ""));
    return nextSettings.disabledDomains.some((domain) => {
      const normalized = normalizeDomain(domain);
      return normalized && (host === normalized || host.endsWith(`.${normalized}`));
    });
  }

  function ensureDocumentStyle(cssText) {
    const mount = document.head || document.documentElement;
    if (!mount) {
      setTimeout(() => ensureDocumentStyle(cssText), 10);
      return;
    }

    let style = document.getElementById(DOCUMENT_STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = DOCUMENT_STYLE_ID;
      style.dataset.fontbridge = "document";
      mount.prepend(style);
    }

    if (style.textContent !== cssText) {
      style.textContent = cssText;
    }
  }

  function removeDocumentStyle() {
    const style = document.getElementById(DOCUMENT_STYLE_ID);
    if (style) {
      style.remove();
    }
  }

  function ensureShadowStyle(root) {
    if (!root || !settings.forceShadowDom || !shouldApply(settings)) {
      return;
    }

    try {
      let style = root.getElementById
        ? root.getElementById(SHADOW_STYLE_ID)
        : root.querySelector(`#${SHADOW_STYLE_ID}`);

      if (!style) {
        style = document.createElement("style");
        style.id = SHADOW_STYLE_ID;
        style.dataset.fontbridge = "shadow";
        root.prepend(style);
      }

      if (style.textContent !== shadowCss) {
        style.textContent = shadowCss;
      }

      knownShadowRoots.add(root);
    } catch (error) {
      console.debug("[FontBridge] Skipped a shadow root.", error);
    }
  }

  function refreshKnownShadowRoots() {
    for (const root of knownShadowRoots) {
      ensureShadowStyle(root);
    }
  }

  function removeShadowStyles() {
    for (const root of knownShadowRoots) {
      try {
        const style = root.getElementById
          ? root.getElementById(SHADOW_STYLE_ID)
          : root.querySelector(`#${SHADOW_STYLE_ID}`);
        if (style) {
          style.remove();
        }
      } catch (error) {
        console.debug("[FontBridge] Could not remove a shadow style.", error);
      }
    }

    knownShadowRoots.clear();
  }

  function installMutationObserver() {
    const root = document.documentElement || document;
    if (!root || mutationObserver) {
      return;
    }

    mutationObserver = new MutationObserver((mutations) => {
      if (!shouldApply(settings)) {
        return;
      }

      ensureDocumentStyle(documentCss);

      if (!settings.forceShadowDom) {
        return;
      }

      refreshKnownShadowRoots();

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          scheduleShadowScan(node);
        }
      }
    });

    mutationObserver.observe(root, { childList: true, subtree: true });
  }

  function patchOpenShadowRoots() {
    if (!Element.prototype.attachShadow || Element.prototype.attachShadow.__fontbridgePatched) {
      return;
    }

    const nativeAttachShadow = Element.prototype.attachShadow;
    const patchedAttachShadow = function patchedAttachShadow(initOptions) {
      const root = nativeAttachShadow.call(this, initOptions);

      if (initOptions?.mode === "open") {
        queueMicrotask(() => ensureShadowStyle(root));
      }

      return root;
    };

    patchedAttachShadow.__fontbridgePatched = true;
    Element.prototype.attachShadow = patchedAttachShadow;
  }

  function patchSpaNavigation() {
    if (historyPatched) {
      return;
    }

    historyPatched = true;
    const reapply = () =>
      setTimeout(() => {
        refreshFontBridge();
        scheduleShadowScan(document);
      }, 50);

    window.addEventListener("hashchange", reapply, true);
    window.addEventListener("popstate", reapply, true);

    for (const method of ["pushState", "replaceState"]) {
      const original = history[method];
      if (typeof original !== "function") {
        continue;
      }

      history[method] = function fontBridgeHistoryWrapper(...args) {
        const result = original.apply(this, args);
        reapply();
        return result;
      };
    }
  }

  function scheduleShadowScan(node) {
    if (!settings.forceShadowDom) {
      return;
    }

    if (!node || pendingScanNodes.size > 200) {
      pendingScanNodes = new Set([document]);
    } else {
      pendingScanNodes.add(node);
    }

    if (pendingScanTimer) {
      return;
    }

    pendingScanTimer = setTimeout(() => {
      const nodes = Array.from(pendingScanNodes);
      pendingScanNodes.clear();
      pendingScanTimer = 0;

      if (!shouldApply(settings) || !settings.forceShadowDom) {
        return;
      }

      for (const scanNode of nodes) {
        scanForOpenShadowRoots(scanNode);
      }
    }, 80);
  }

  function scanForOpenShadowRoots(node) {
    if (!node) {
      return;
    }

    if (node instanceof ShadowRoot) {
      ensureShadowStyle(node);
      scanDescendantsForShadowRoots(node);
      return;
    }

    if (!(node instanceof Element) && node !== document) {
      return;
    }

    if (node.shadowRoot) {
      ensureShadowStyle(node.shadowRoot);
      scanDescendantsForShadowRoots(node.shadowRoot);
    }

    scanDescendantsForShadowRoots(node);
  }

  function scanDescendantsForShadowRoots(root) {
    if (!root.querySelectorAll) {
      return;
    }

    for (const element of root.querySelectorAll("*")) {
      if (element.shadowRoot) {
        ensureShadowStyle(element.shadowRoot);
        scanDescendantsForShadowRoots(element.shadowRoot);
      }
    }
  }

  function buildDocumentCss(font, nextSettings) {
    const fontStack = buildFontStack(font);
    const monoCompanion = !nextSettings.preserveMonospace
      ? findMonoCompanion(font.id, nextSettings.customProfiles)
      : null;

    const protectedSelectors = (nextSettings.preserveMonospace || monoCompanion)
      ? ICON_EXCLUSIONS.concat(MONOSPACE_EXCLUSIONS)
      : ICON_EXCLUSIONS;

    const protectedSelector = `:where(${protectedSelectors.join(", ")})`;
    const target = `body *:not(${protectedSelector})`;

    const parts = [
      buildFontFaces(font),
      `:root { --fontbridge-font-stack: ${fontStack}; }`,
      [
        "html",
        "body",
        target,
        `${target}::before`,
        `${target}::after`
      ].join(",\n") +
        "\n{\n  font-family: var(--fontbridge-font-stack) !important;\n}"
    ];

    if (!nextSettings.preserveMonospace && monoCompanion) {
      const monoFaces = buildFontFaces(monoCompanion);
      if (monoFaces) {
        parts.splice(1, 0, monoFaces);
      }
      const monoSelector = `:where(${MONOSPACE_EXCLUSIONS.join(", ")})`;
      parts.push(
        `${monoSelector}\n{\n  font-family: ${buildFontStack(monoCompanion)} !important;\n}`
      );
    }

    return parts.filter(Boolean).join("\n\n");
  }

  function buildShadowCss(font, nextSettings) {
    const fontStack = buildFontStack(font);
    const monoCompanion = !nextSettings.preserveMonospace
      ? findMonoCompanion(font.id, nextSettings.customProfiles)
      : null;

    const protectedSelectors = (nextSettings.preserveMonospace || monoCompanion)
      ? ICON_EXCLUSIONS.concat(MONOSPACE_EXCLUSIONS)
      : ICON_EXCLUSIONS;

    const protectedSelector = `:where(${protectedSelectors.join(", ")})`;
    const target = `*:not(${protectedSelector})`;

    const parts = [
      `:host { --fontbridge-font-stack: ${fontStack}; }`,
      [
        ":host",
        target,
        `${target}::before`,
        `${target}::after`
      ].join(",\n") +
        "\n{\n  font-family: var(--fontbridge-font-stack) !important;\n}"
    ];

    if (!nextSettings.preserveMonospace && monoCompanion) {
      const monoSelector = `:where(${MONOSPACE_EXCLUSIONS.join(", ")})`;
      parts.push(
        `${monoSelector}\n{\n  font-family: ${buildFontStack(monoCompanion)} !important;\n}`
      );
    }

    return parts.filter(Boolean).join("\n\n");
  }

  function buildFontStack(font) {
    const family = `"${escapeCssString(font.fontFamily)}"`;
    const fallback = sanitizeFallback(font.fallback || FONTBRIDGE_FALLBACKS.sans);
    return fallback ? `${family}, ${fallback}` : family;
  }

  function buildFontFaces(font) {
    if (font.source !== "bundled" || !font.weights) {
      return "";
    }

    return Object.entries(font.weights)
      .map(([weight, filePath]) => buildFontFace(font.fontFamily, filePath, weight))
      .join("\n\n");
  }

  function buildFontFace(fontFamily, filePath, weight) {
    const url = chrome.runtime.getURL(String(filePath).replace(/^\/+/, ""));

    return [
      "@font-face {",
      `  font-family: "${escapeCssString(fontFamily)}";`,
      `  src: url("${escapeCssString(url)}") format("woff2");`,
      `  font-weight: ${weight};`,
      "  font-style: normal;",
      "  font-display: swap;",
      "}"
    ].join("\n");
  }

  function escapeCssString(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
})();
