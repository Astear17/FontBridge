"use strict";

const elements = {
  globalToggle: document.getElementById("globalToggle"),
  hostname: document.getElementById("hostname"),
  siteStatus: document.getElementById("siteStatus"),
  fontSearch: document.getElementById("fontSearch"),
  categoryFilters: document.getElementById("categoryFilters"),
  selectedFontName: document.getElementById("selectedFontName"),
  selectedFontMeta: document.getElementById("selectedFontMeta"),
  selectedFontHint: document.getElementById("selectedFontHint"),
  selectedFontStatus: document.getElementById("selectedFontStatus"),
  fontCount: document.getElementById("fontCount"),
  fontList: document.getElementById("fontList"),
  preserveMonospace: document.getElementById("preserveMonospace"),
  forceMonospaceToo: document.getElementById("forceMonospaceToo"),
  forceShadowDom: document.getElementById("forceShadowDom"),
  customName: document.getElementById("customName"),
  customFamily: document.getElementById("customFamily"),
  customCategory: document.getElementById("customCategory"),
  customFallback: document.getElementById("customFallback"),
  saveCustomProfileButton: document.getElementById("saveCustomProfileButton"),
  applyButton: document.getElementById("applyButton"),
  disableSiteButton: document.getElementById("disableSiteButton"),
  resetSiteButton: document.getElementById("resetSiteButton"),
  message: document.getElementById("message")
};

const state = {
  settings: normalizeFontBridgeSettings(FONTBRIDGE_DEFAULT_SETTINGS),
  fonts: mergeFontBridgeProfiles([]),
  previewFontId: "inter",
  currentDomain: "",
  currentDisplayHost: "Unavailable",
  supportedTab: false,
  categoryFilter: "all",
  searchQuery: "",
  availabilityById: {},
  pathExistsCache: new Map(),
  availabilityAuditStarted: false
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

async function init() {
  try {
    const [settings, tabInfo] = await Promise.all([readSettings(), getCurrentTabInfo()]);
    state.settings = settings;
    Object.assign(state, tabInfo);
    rebuildFontCatalog();
    state.previewFontId = settings.selectedFontId;
    clearCustomProfileFields();

    bindEvents();
    render();
    startAvailabilityAudit();
  } catch (error) {
    console.error("[FontBridge] Popup init failed.", error);
    showMessage("FontBridge could not initialize. Try reopening the popup.", true);
  }
}

function bindEvents() {
  elements.globalToggle.addEventListener("change", async () => {
    state.settings.enabled = elements.globalToggle.checked;
    await persistSettings("Global setting updated.");
  });

  elements.fontSearch.addEventListener("input", () => {
    state.searchQuery = elements.fontSearch.value.trim().toLowerCase();
    renderFontList();
  });

  elements.categoryFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) {
      return;
    }

    state.categoryFilter = button.dataset.category || "all";
    renderCategoryFilters();
    renderFontList();
  });

  elements.fontList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-font-id]");
    if (!button) {
      return;
    }

    state.previewFontId = button.dataset.fontId;
    renderSelectedFont();
    renderFontList();
  });

  elements.preserveMonospace.addEventListener("change", async () => {
    state.settings.preserveMonospace = elements.preserveMonospace.checked;
    syncMonospaceToggles();
    await persistSettings("Monospace preference saved.");
  });

  elements.forceMonospaceToo.addEventListener("change", async () => {
    state.settings.preserveMonospace = !elements.forceMonospaceToo.checked;
    syncMonospaceToggles();
    await persistSettings("Monospace override updated.");
  });

  elements.forceShadowDom.addEventListener("change", async () => {
    state.settings.forceShadowDom = elements.forceShadowDom.checked;
    await persistSettings("Shadow DOM setting saved.");
  });

  elements.customCategory.addEventListener("change", () => {
    if (!elements.customFallback.value.trim()) {
      elements.customFallback.value = getFontBridgeFallback(elements.customCategory.value);
    }
  });

  elements.saveCustomProfileButton.addEventListener("click", async () => {
    const profile = buildCustomProfileFromInputs();
    if (!profile) {
      showMessage("Enter both a display name and a font-family name.", true);
      return;
    }

    upsertCustomProfile(profile);
    state.settings.selectedFontId = profile.id;
    state.previewFontId = profile.id;
    clearCustomProfileFields();
    await persistSettings("Custom font profile saved.");
  });

  elements.applyButton.addEventListener("click", async () => {
    state.settings.enabled = true;
    state.settings.selectedFontId = state.previewFontId;
    await persistSettings("Applied. Open pages update automatically.");
  });

  elements.disableSiteButton.addEventListener("click", async () => {
    if (!state.currentDomain) {
      showMessage("This tab cannot be controlled by FontBridge.", true);
      return;
    }

    if (isCurrentSiteDisabled()) {
      state.settings.disabledDomains = state.settings.disabledDomains.filter(
        (domain) => domain !== state.currentDomain
      );
      await persistSettings("FontBridge enabled on this site.");
      return;
    }

    state.settings.disabledDomains = Array.from(
      new Set(state.settings.disabledDomains.concat(state.currentDomain))
    );
    await persistSettings("FontBridge disabled on this site.");
  });

  elements.resetSiteButton.addEventListener("click", async () => {
    if (!state.currentDomain) {
      showMessage("This tab does not expose a site domain.", true);
      return;
    }

    state.settings.disabledDomains = state.settings.disabledDomains.filter(
      (domain) => domain !== state.currentDomain
    );
    await persistSettings("Current site reset.");
  });
}

function rebuildFontCatalog() {
  state.fonts = mergeFontBridgeProfiles(state.settings.customProfiles);
  if (!state.fonts.some((entry) => entry.id === state.previewFontId)) {
    state.previewFontId = state.settings.selectedFontId;
  }
  if (!state.fonts.some((entry) => entry.id === state.previewFontId)) {
    state.previewFontId = FONTBRIDGE_DEFAULT_SETTINGS.selectedFontId;
  }
}

function render() {
  elements.globalToggle.checked = state.settings.enabled;
  elements.hostname.textContent = state.currentDisplayHost;
  syncMonospaceToggles();
  elements.forceShadowDom.checked = state.settings.forceShadowDom;
  renderCategoryFilters();
  renderSelectedFont();
  renderSiteStatus();
  renderFontList();
}

function syncMonospaceToggles() {
  elements.preserveMonospace.checked = state.settings.preserveMonospace;
  elements.forceMonospaceToo.checked = !state.settings.preserveMonospace;
}

function renderCategoryFilters() {
  for (const button of elements.categoryFilters.querySelectorAll("[data-category]")) {
    button.classList.toggle("is-active", button.dataset.category === state.categoryFilter);
  }
}

function renderSelectedFont() {
  const font = getPreviewFont();
  const status = getDisplayStatus(font);

  elements.selectedFontName.textContent = font.name;
  elements.selectedFontMeta.textContent = `${formatCategory(font.category)} · ${describeStatus(status)}`;
  elements.selectedFontHint.textContent = font.note || `${font.fontFamily}, ${font.fallback}`;

  elements.selectedFontStatus.textContent = badgeText(status);
  elements.selectedFontStatus.className = `mini-badge ${badgeClass(status)}`;
}

function renderFontList() {
  const visibleFonts = getVisibleFonts();
  elements.fontCount.textContent = `${visibleFonts.length} shown`;

  if (!visibleFonts.length) {
    elements.fontList.innerHTML =
      '<div class="font-item"><strong>No fonts found</strong><small>Try another search or category.</small></div>';
    return;
  }

  elements.fontList.innerHTML = visibleFonts
    .map((font) => {
      const status = getDisplayStatus(font);
      const isSelected = font.id === state.previewFontId;
      const sourceLabel = font.source === "bundled" ? "Bundled candidate" : describeStatus(status);

      return `
        <button
          type="button"
          class="font-item${isSelected ? " is-selected" : ""}"
          data-font-id="${escapeHtml(font.id)}"
          aria-selected="${isSelected ? "true" : "false"}"
        >
          <div class="font-item-top">
            <strong>${escapeHtml(font.name)}</strong>
            <span class="item-badge ${badgeClass(status)}">${escapeHtml(badgeText(status))}</span>
          </div>
          <div class="font-item-bottom">
            <small>${escapeHtml(formatCategory(font.category))} · ${escapeHtml(sourceLabel)}</small>
            <div class="font-item-badges">
              <span class="item-badge ${badgeClass(status)}">${escapeHtml(font.fontFamily)}</span>
            </div>
          </div>
        </button>
      `;
    })
    .join("");
}

function renderSiteStatus() {
  const siteDisabled = isCurrentSiteDisabled();
  elements.siteStatus.className = "pill";

  if (!state.supportedTab) {
    elements.siteStatus.textContent = "Unsupported";
    elements.siteStatus.classList.add("is-off");
  } else if (!state.settings.enabled) {
    elements.siteStatus.textContent = "Globally off";
    elements.siteStatus.classList.add("is-off");
  } else if (siteDisabled) {
    elements.siteStatus.textContent = "Disabled here";
    elements.siteStatus.classList.add("is-blocked");
  } else {
    elements.siteStatus.textContent = "Active";
  }

  elements.disableSiteButton.textContent = siteDisabled
    ? "Enable on this site"
    : "Disable on this site";
  elements.disableSiteButton.disabled = !state.supportedTab || !state.currentDomain;
  elements.resetSiteButton.disabled = !state.supportedTab || !state.currentDomain || !siteDisabled;
}

function getVisibleFonts() {
  return state.fonts.filter((font) => {
    if (state.categoryFilter !== "all" && font.category !== state.categoryFilter) {
      return false;
    }

    if (!state.searchQuery) {
      return true;
    }

    const haystack = `${font.name} ${font.fontFamily} ${font.id}`.toLowerCase();
    return haystack.includes(state.searchQuery);
  });
}

function getPreviewFont() {
  return (
    state.fonts.find((entry) => entry.id === state.previewFontId) ||
    state.fonts.find((entry) => entry.id === state.settings.selectedFontId) ||
    FONT_REGISTRY_BY_ID.inter ||
    state.fonts[0]
  );
}

function getDisplayStatus(font) {
  const dynamicStatus = state.availabilityById[font.id];
  if (dynamicStatus) {
    return dynamicStatus;
  }

  if (font.status === "license-review-skipped") {
    return "license-review-skipped";
  }

  if (font.status === "system-only" || font.source === "system") {
    return "system-only";
  }

  if (font.status === "custom" || font.source === "custom") {
    return "custom";
  }

  return "bundled";
}

function badgeText(status) {
  switch (status) {
    case "missing-files":
      return "Missing files";
    case "system-only":
      return "System-only";
    case "license-review-skipped":
      return "License skipped";
    case "custom":
      return "Custom";
    default:
      return "Bundled";
  }
}

function badgeClass(status) {
  switch (status) {
    case "missing-files":
      return "is-missing";
    case "system-only":
      return "is-system";
    case "license-review-skipped":
      return "is-skipped";
    case "custom":
      return "is-custom";
    default:
      return "is-bundled";
  }
}

function describeStatus(status) {
  switch (status) {
    case "missing-files":
      return "Bundled files missing";
    case "system-only":
      return "System-only";
    case "license-review-skipped":
      return "License-review skipped";
    case "custom":
      return "Custom local profile";
    default:
      return "Bundled";
  }
}

function formatCategory(category) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function buildCustomProfileFromInputs() {
  const displayName = String(elements.customName.value || "").trim();
  const fontFamily = sanitizeFontFamily(elements.customFamily.value);
  const category = normalizeCategory(elements.customCategory.value);
  const fallback = sanitizeFallback(
    elements.customFallback.value || getFontBridgeFallback(category)
  );

  if (!displayName || !fontFamily) {
    return null;
  }

  return createFontBridgeCustomProfile({
    name: displayName,
    fontFamily,
    category,
    fallback
  });
}

function upsertCustomProfile(profile) {
  const nextProfiles = normalizeCustomProfiles(state.settings.customProfiles);
  const existingIndex = nextProfiles.findIndex((entry) => entry.id === profile.id);

  if (existingIndex >= 0) {
    nextProfiles[existingIndex] = profile;
  } else {
    nextProfiles.push(profile);
  }

  state.settings.customProfiles = nextProfiles;
  rebuildFontCatalog();
}

function clearCustomProfileFields() {
  elements.customName.value = "";
  elements.customFamily.value = "";
  elements.customCategory.value = "sans";
  elements.customFallback.value = getFontBridgeFallback("sans");
}

async function readSettings() {
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

async function persistSettings(message) {
  try {
    state.settings = normalizeFontBridgeSettings(state.settings);
    await chrome.storage.sync.set({ [FONTBRIDGE_STORAGE_KEY]: state.settings });
    rebuildFontCatalog();
    render();
    showMessage(message);
  } catch (error) {
    console.error("[FontBridge] Could not save settings.", error);
    showMessage("Could not save settings. Chrome storage may be unavailable.", true);
  }
}

async function getCurrentTabInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const parsed = parseTabUrl(tab?.url || "");
    return {
      currentDomain: parsed.domain,
      currentDisplayHost: parsed.displayHost,
      supportedTab: parsed.supported
    };
  } catch (error) {
    console.warn("[FontBridge] Could not inspect current tab.", error);
    return {
      currentDomain: "",
      currentDisplayHost: "Unavailable",
      supportedTab: false
    };
  }
}

function parseTabUrl(url) {
  if (!url) {
    return { domain: "", displayHost: "Unavailable", supported: false };
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return {
        domain: normalizeDomain(parsed.hostname),
        displayHost: parsed.hostname,
        supported: true
      };
    }

    if (parsed.protocol === "file:") {
      return { domain: "file", displayHost: "Local file", supported: true };
    }

    return {
      domain: "",
      displayHost: `${parsed.protocol.replace(":", "")} page`,
      supported: false
    };
  } catch {
    return { domain: "", displayHost: "Unavailable", supported: false };
  }
}

function isCurrentSiteDisabled() {
  return state.settings.disabledDomains.some((domain) => {
    const normalized = normalizeDomain(domain);
    return (
      normalized &&
      state.currentDomain &&
      (state.currentDomain === normalized || state.currentDomain.endsWith(`.${normalized}`))
    );
  });
}

async function startAvailabilityAudit() {
  if (state.availabilityAuditStarted) {
    return;
  }

  state.availabilityAuditStarted = true;
  const bundledFonts = state.fonts.filter((entry) => entry.source === "bundled");
  let dirty = false;

  for (let index = 0; index < bundledFonts.length; index += 1) {
    const font = bundledFonts[index];
    const status = await getBundledAvailability(font);
    if (state.availabilityById[font.id] !== status) {
      state.availabilityById[font.id] = status;
      dirty = true;
    }

    if (dirty && (font.id === state.previewFontId || index % 8 === 7)) {
      renderSelectedFont();
      renderFontList();
      dirty = false;
    }
  }

  if (dirty) {
    renderSelectedFont();
    renderFontList();
  }
}

async function getBundledAvailability(font) {
  if (!font.weights || !Object.keys(font.weights).length) {
    return "missing-files";
  }

  for (const resourcePath of Object.values(font.weights)) {
    const exists = await resourceExists(resourcePath);
    if (!exists) {
      return "missing-files";
    }
  }

  return "bundled";
}

async function resourceExists(resourcePath) {
  if (state.pathExistsCache.has(resourcePath)) {
    return state.pathExistsCache.get(resourcePath);
  }

  const promise = (async () => {
    const url = chrome.runtime.getURL(resourcePath);
    try {
      const headResponse = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (headResponse.ok) {
        return true;
      }
      if (headResponse.status && headResponse.status !== 405) {
        return false;
      }
    } catch (error) {
      console.debug("[FontBridge] HEAD check failed, retrying with GET.", error);
    }

    try {
      const getResponse = await fetch(url, { cache: "no-store" });
      return getResponse.ok;
    } catch (error) {
      console.debug("[FontBridge] Resource check failed.", error);
      return false;
    }
  })();

  state.pathExistsCache.set(resourcePath, promise);
  return promise;
}

function showMessage(text, isError = false) {
  elements.message.textContent = text;
  elements.message.classList.toggle("is-error", isError);

  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => {
    elements.message.textContent = "";
    elements.message.classList.remove("is-error");
  }, 3000);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
