"use strict";

importScripts("font-registry.js");

chrome.runtime.onInstalled.addListener(() => {
  void ensureSettings();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureSettings();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes[FONTBRIDGE_STORAGE_KEY]) {
    return;
  }

  void ensureSettings();
});

async function ensureSettings() {
  try {
    const result = await chrome.storage.sync.get({
      [FONTBRIDGE_STORAGE_KEY]: FONTBRIDGE_DEFAULT_SETTINGS
    });
    const normalized = normalizeFontBridgeSettings(result[FONTBRIDGE_STORAGE_KEY]);

    if (JSON.stringify(result[FONTBRIDGE_STORAGE_KEY]) !== JSON.stringify(normalized)) {
      await chrome.storage.sync.set({ [FONTBRIDGE_STORAGE_KEY]: normalized });
    }
  } catch (error) {
    console.error("[FontBridge] Failed to initialize storage.", error);
  }
}
