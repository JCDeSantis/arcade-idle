// js/loop.js — main tick system

import { state, addCurrency, unlockStage2, emit } from './state.js';
import { getTotalAutoRate } from './automation.js';
import { saveGame } from './save.js';

const TICK_MS      = 1000;   // automation tick every 1s
const AUTOSAVE_MS  = 30000;  // autosave every 30s

let tickInterval   = null;
let autosaveInterval = null;
let lastTick = Date.now();

export function startLoop() {
  tickInterval    = setInterval(tick, TICK_MS);
  autosaveInterval = setInterval(saveGame, AUTOSAVE_MS);
}

export function stopLoop() {
  clearInterval(tickInterval);
  clearInterval(autosaveInterval);
}

function tick() {
  const now = Date.now();
  const delta = (now - lastTick) / 1000;
  lastTick = now;
  state.settings.lastTickTime = now;

  // Automation income
  const rate = getTotalAutoRate();
  if (rate > 0) {
    const earned = rate * delta;
    addCurrency('bits', earned);
  }

  // Stage 2 unlock check
  if (state.stage < 2 && state.currencies.lifetimeBits >= 50000) {
    unlockStage2();
  }

  emit('tick', { delta, rate });
}
