// js/save.js — localStorage save/load + offline progress

import { state, createDefaultState, addCurrency } from './state.js';
import { getTotalAutoRate } from './automation.js';

const SAVE_KEY = 'arcadeidle_v1';

export function saveGame() {
  const payload = {
    ...state,
    settings: {
      ...state.settings,
      lastSaveTime: Date.now(),
    },
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('[Save] Failed to save:', e);
  }
}

export function loadSave() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    // Merge saved data into state (deep merge so new keys from default survive)
    const defaults = createDefaultState();
    mergeInto(state, saved, defaults);
    applyOfflineProgress();
  } catch (e) {
    console.warn('[Save] Failed to load:', e);
  }
}

export function exportSave() {
  return btoa(localStorage.getItem(SAVE_KEY) || '');
}

export function importSave(b64) {
  try {
    const raw = atob(b64);
    JSON.parse(raw); // validate
    localStorage.setItem(SAVE_KEY, raw);
    window.location.reload();
  } catch (e) {
    alert('Invalid save data.');
  }
}

export function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
  window.location.reload();
}

function applyOfflineProgress() {
  const lastTick = state.settings.lastTickTime || state.settings.lastSaveTime;
  const now = Date.now();
  const offlineSec = Math.min((now - lastTick) / 1000, 8 * 3600); // cap at 8 hours
  if (offlineSec < 5) return;

  const rate = getTotalAutoRate();
  if (rate <= 0) return;

  const earned = Math.floor(rate * offlineSec);
  if (earned > 0) {
    addCurrency('bits', earned);
    console.log(`[Save] Offline: ${offlineSec.toFixed(0)}s → +${earned} bits`);
  }
  state.settings.lastTickTime = now;
}

/**
 * Deep-merge `src` into `target`, using `defaults` as fallback shape.
 * New keys added to defaults will always be present even in old saves.
 */
function mergeInto(target, src, defaults) {
  for (const key of Object.keys(defaults)) {
    if (src[key] === undefined) continue;
    if (isPlainObject(defaults[key]) && isPlainObject(src[key])) {
      mergeInto(target[key], src[key], defaults[key]);
    } else {
      target[key] = src[key];
    }
  }
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
