# Arcade Idle — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a polished neon arcade idle browser game with 2 mini-games (Paddle + Target), automation, prestige, and save/load — all in vanilla HTML/JS/CSS ES Modules.

**Architecture:** ES Modules for clean module boundaries. `state.js` holds all game state and an event bus. `loop.js` drives idle automation via setInterval. Mini-games are canvas-based and report results through `base-game.js`. UI panels are independent modules that read/write state via the event bus.

**Tech Stack:** HTML5, CSS3, Canvas API, JavaScript ES Modules, LocalStorage, Google Fonts (Space Mono)

---

## Task 1: Project Scaffold

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `js/main.js`

**Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ARCADE IDLE</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">
    <header id="hud"><!-- populated by ui/hud.js --></header>
    <main id="hub"><!-- populated by ui/hub.js --></main>
    <div id="panel-overlay" class="hidden"><!-- panels slide in over hub --></div>
    <canvas id="particle-canvas"></canvas>
  </div>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

**Step 2: Create `style.css`**

```css
/* ── Variables ─────────────────────────────────────────── */
:root {
  --bg:         #0a0a0f;
  --bg2:        #111118;
  --bg3:        #1a1a24;
  --cyan:       #00ffff;
  --magenta:    #ff00ff;
  --green:      #00ff88;
  --amber:      #ffaa00;
  --red:        #ff4444;
  --text:       #e0e0f0;
  --text-dim:   #55556a;
  --font:       'Space Mono', monospace;

  --glow-cyan:    0 0 6px #00ffff99, 0 0 18px #00ffff44;
  --glow-magenta: 0 0 6px #ff00ff99, 0 0 18px #ff00ff44;
  --glow-green:   0 0 6px #00ff8899, 0 0 18px #00ff8844;
  --glow-amber:   0 0 6px #ffaa0099, 0 0 18px #ffaa0044;

  --border-cyan: 1px solid #00ffff44;
  --radius: 4px;
  --transition: 0.2s ease;
}

/* ── Reset & Base ───────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font);
  background-color: var(--bg);
  background-image:
    linear-gradient(rgba(0, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 255, 255, 0.025) 1px, transparent 1px);
  background-size: 40px 40px;
  color: var(--text);
  min-height: 100vh;
  overflow: hidden;
  user-select: none;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: relative;
}

.hidden { display: none !important; }

/* ── HUD ────────────────────────────────────────────────── */
#hud {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  background: var(--bg2);
  border-bottom: 1px solid #00ffff22;
  flex-shrink: 0;
  z-index: 10;
}

#hud .game-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--cyan);
  text-shadow: var(--glow-cyan);
  letter-spacing: 4px;
}

.hud-currencies {
  display: flex;
  gap: 28px;
}

.hud-currency {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
}

.hud-currency .label { color: var(--text-dim); }

.hud-currency .value {
  font-weight: 700;
  transition: color 0.2s;
}

.hud-currency.bits    .value { color: var(--cyan); }
.hud-currency.td      .value { color: var(--magenta); }
.hud-currency.nc      .value { color: var(--green); }

.hud-currency .value.bump {
  animation: bump 0.3s ease;
}

@keyframes bump {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.3); }
  100% { transform: scale(1); }
}

/* ── Hub ────────────────────────────────────────────────── */
#hub {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 24px 20px;
  gap: 28px;
  overflow-y: auto;
}

.hub-games {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  justify-content: center;
}

.game-card {
  width: 200px;
  height: 160px;
  background: var(--bg2);
  border: var(--border-cyan);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  cursor: pointer;
  transition: border-color var(--transition), box-shadow var(--transition), transform var(--transition);
  position: relative;
  overflow: hidden;
}

.game-card:hover:not(.locked) {
  border-color: var(--cyan);
  box-shadow: var(--glow-cyan);
  transform: translateY(-2px);
}

.game-card.locked {
  opacity: 0.4;
  cursor: not-allowed;
  border-color: #333340;
}

.game-card .card-icon {
  font-size: 2.5rem;
  line-height: 1;
}

.game-card .card-title {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--cyan);
  text-transform: uppercase;
}

.game-card .card-mastery {
  font-size: 0.65rem;
  color: var(--text-dim);
}

.game-card .card-lock-msg {
  font-size: 0.6rem;
  color: var(--text-dim);
  text-align: center;
  padding: 0 10px;
}

/* ── Hub Nav Tabs ───────────────────────────────────────── */
.hub-tabs {
  display: flex;
  gap: 4px;
}

.hub-tab {
  padding: 8px 20px;
  background: var(--bg2);
  border: 1px solid #333340;
  border-radius: var(--radius);
  color: var(--text-dim);
  font-family: var(--font);
  font-size: 0.72rem;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all var(--transition);
}

.hub-tab:hover {
  border-color: var(--cyan);
  color: var(--cyan);
}

.hub-tab.active {
  background: #00ffff15;
  border-color: var(--cyan);
  color: var(--cyan);
  box-shadow: var(--glow-cyan);
}

/* ── Panels (Upgrades / Automation / Prestige) ──────────── */
#panel-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  z-index: 20;
  display: flex;
  align-items: stretch;
  justify-content: flex-end;
}

.side-panel {
  width: min(480px, 100%);
  background: var(--bg2);
  border-left: var(--border-cyan);
  display: flex;
  flex-direction: column;
  animation: slideIn 0.22s ease;
}

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #00ffff22;
}

.panel-title {
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 3px;
  color: var(--cyan);
  text-shadow: var(--glow-cyan);
}

.panel-close {
  background: none;
  border: 1px solid #333340;
  color: var(--text-dim);
  font-family: var(--font);
  font-size: 0.75rem;
  padding: 4px 10px;
  cursor: pointer;
  border-radius: var(--radius);
  transition: all var(--transition);
}

.panel-close:hover {
  border-color: var(--red);
  color: var(--red);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Upgrade Cards ──────────────────────────────────────── */
.upgrade-card {
  background: var(--bg3);
  border: 1px solid #333340;
  border-radius: var(--radius);
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  transition: all var(--transition);
}

.upgrade-card:hover:not(.maxed):not(.unaffordable) {
  border-color: var(--cyan);
  box-shadow: var(--glow-cyan);
}

.upgrade-card.unaffordable { opacity: 0.5; cursor: not-allowed; }
.upgrade-card.maxed { opacity: 0.35; cursor: not-allowed; }

.upgrade-icon { font-size: 1.4rem; }

.upgrade-info { flex: 1; }
.upgrade-name {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 2px;
}
.upgrade-desc { font-size: 0.62rem; color: var(--text-dim); }

.upgrade-cost {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--cyan);
  text-align: right;
  white-space: nowrap;
}

.upgrade-level {
  font-size: 0.6rem;
  color: var(--text-dim);
  text-align: right;
}

/* ── Automation Panel ───────────────────────────────────── */
.auto-game-section { margin-bottom: 20px; }

.auto-game-title {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--magenta);
  text-shadow: var(--glow-magenta);
  letter-spacing: 2px;
  margin-bottom: 10px;
}

.mastery-bar-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.mastery-bar-bg {
  flex: 1;
  height: 6px;
  background: #ffffff0f;
  border-radius: 3px;
  overflow: hidden;
}

.mastery-bar-fill {
  height: 100%;
  background: var(--magenta);
  box-shadow: var(--glow-magenta);
  border-radius: 3px;
  transition: width 0.5s ease;
}

.mastery-pct {
  font-size: 0.68rem;
  color: var(--magenta);
  min-width: 36px;
  text-align: right;
}

.auto-stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.65rem;
  color: var(--text-dim);
  margin-bottom: 3px;
}

.auto-stat-row span:last-child { color: var(--text); }

/* ── Prestige Panel ─────────────────────────────────────── */
.prestige-info {
  background: var(--bg3);
  border: 1px solid #00ff8822;
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 16px;
  text-align: center;
}

.prestige-nc-preview {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--green);
  text-shadow: var(--glow-green);
  margin-bottom: 4px;
}

.prestige-nc-label { font-size: 0.65rem; color: var(--text-dim); }

.prestige-btn {
  width: 100%;
  padding: 14px;
  background: none;
  border: 1px solid var(--green);
  color: var(--green);
  font-family: var(--font);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 2px;
  cursor: pointer;
  border-radius: var(--radius);
  transition: all var(--transition);
  margin-bottom: 20px;
}

.prestige-btn:hover:not(:disabled) {
  background: #00ff8818;
  box-shadow: var(--glow-green);
}

.prestige-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.prestige-upgrade-card {
  background: var(--bg3);
  border: 1px solid #00ff8822;
  border-radius: var(--radius);
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  transition: all var(--transition);
}

.prestige-upgrade-card:hover:not(.owned):not(.unaffordable) {
  border-color: var(--green);
  box-shadow: var(--glow-green);
}

.prestige-upgrade-card .upgrade-cost { color: var(--green); }

.prestige-upgrade-card.owned {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Mini-Game Overlay ──────────────────────────────────── */
#game-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: var(--bg);
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; } to { opacity: 1; }
}

#game-overlay canvas {
  border: var(--border-cyan);
  box-shadow: var(--glow-cyan);
  position: relative;
}

.game-hud {
  display: flex;
  gap: 40px;
  font-size: 0.78rem;
}

.game-stat { color: var(--text-dim); }
.game-stat span { color: var(--cyan); font-weight: 700; }

.game-title-label {
  font-size: 0.7rem;
  letter-spacing: 4px;
  color: var(--text-dim);
  text-transform: uppercase;
}

/* CRT Scanlines on game canvas area */
#game-overlay::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0,0,0,0.07) 2px,
    rgba(0,0,0,0.07) 4px
  );
  pointer-events: none;
  z-index: 1;
}

/* ── Result Screen ──────────────────────────────────────── */
.result-screen {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.88);
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  animation: fadeIn 0.3s ease;
}

.result-title {
  font-size: 0.75rem;
  letter-spacing: 6px;
  color: var(--text-dim);
}

.result-score {
  font-size: 3rem;
  font-weight: 700;
  color: var(--cyan);
  text-shadow: var(--glow-cyan);
}

.result-rewards {
  display: flex;
  gap: 28px;
}

.result-reward {
  text-align: center;
  font-size: 0.72rem;
}

.result-reward .amount {
  font-size: 1.2rem;
  font-weight: 700;
  display: block;
  margin-top: 2px;
}

.result-reward.bits .amount { color: var(--cyan); }
.result-reward.td   .amount { color: var(--magenta); }

.result-reward .label { color: var(--text-dim); font-size: 0.6rem; }

.result-mastery-change {
  font-size: 0.65rem;
  color: var(--text-dim);
}

.result-mastery-change span { color: var(--magenta); }

.result-btn {
  padding: 12px 40px;
  background: none;
  border: var(--border-cyan);
  color: var(--cyan);
  font-family: var(--font);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 3px;
  cursor: pointer;
  border-radius: var(--radius);
  transition: all var(--transition);
  margin-top: 4px;
}

.result-btn:hover {
  background: #00ffff18;
  box-shadow: var(--glow-cyan);
}

/* ── Scrollbar ──────────────────────────────────────────── */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #00ffff33; border-radius: 2px; }

/* ── Utility ────────────────────────────────────────────── */
.section-label {
  font-size: 0.62rem;
  letter-spacing: 3px;
  color: var(--text-dim);
  text-transform: uppercase;
  margin-bottom: 6px;
}

.neon-text-cyan    { color: var(--cyan);    text-shadow: var(--glow-cyan); }
.neon-text-green   { color: var(--green);   text-shadow: var(--glow-green); }
.neon-text-magenta { color: var(--magenta); text-shadow: var(--glow-magenta); }
```

**Step 3: Create `js/main.js`**

```js
// js/main.js — entry point
import { initState } from './state.js';
import { loadSave }  from './save.js';
import { startLoop } from './loop.js';
import { initHUD }   from './ui/hud.js';
import { initHub }   from './ui/hub.js';

async function main() {
  initState();
  loadSave();
  initHUD();
  initHub();
  startLoop();
  console.log('[ArcadeIdle] initialized');
}

main();
```

**Step 4: Start dev server and verify**

```bash
cd /c/Users/Jacob/Projects/arcade-idle
python -m http.server 8080
```

Open `http://localhost:8080` in browser. Expected: blank dark neon-grid page with no errors in console.

**Step 5: Commit**

```bash
git add index.html style.css js/main.js
git commit -m "feat: project scaffold with neon CSS and entry point"
```

---

## Task 2: State Module

**Files:**
- Create: `js/state.js`

**Step 1: Create `js/state.js`**

```js
// js/state.js — global game state + event bus

export let state = null;

export function initState() {
  state = createDefaultState();
}

export function createDefaultState() {
  return {
    currencies: {
      bits: 0,
      trainingData: 0,
      neuralCredits: 0,
      lifetimeBits: 0,
    },
    stage: 1,
    games: {
      paddle: {
        unlocked: true,
        bestScore: 0,
        recentScores: [],   // last 5 run scores
        mastery: 0,         // 0–100
        totalRuns: 0,
      },
      target: {
        unlocked: false,
        bestScore: 0,
        recentScores: [],
        mastery: 0,
        totalRuns: 0,
      },
    },
    upgrades: {},         // upgradeId -> level (number)
    prestigeUpgrades: {}, // upgradeId -> true/false
    prestige: {
      count: 0,
      lifetimeBits: 0,
    },
    settings: {
      lastSaveTime: Date.now(),
      lastTickTime: Date.now(),
    },
  };
}

// ── Event Bus ────────────────────────────────────────────
const listeners = {};

export function on(event, cb) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(cb);
}

export function off(event, cb) {
  if (!listeners[event]) return;
  listeners[event] = listeners[event].filter(fn => fn !== cb);
}

export function emit(event, data) {
  (listeners[event] || []).forEach(cb => cb(data));
}

// ── Mutations ────────────────────────────────────────────
export function addCurrency(type, amount) {
  if (amount <= 0) return;
  state.currencies[type] += amount;
  if (type === 'bits') state.currencies.lifetimeBits += amount;
  emit('currency:change', { type, amount, total: state.currencies[type] });
}

export function spendCurrency(type, amount) {
  if (state.currencies[type] < amount) return false;
  state.currencies[type] -= amount;
  emit('currency:change', { type, amount: -amount, total: state.currencies[type] });
  return true;
}

export function setUpgradeLevel(id, level) {
  state.upgrades[id] = level;
  emit('upgrade:change', { id, level });
}

export function setPrestigeUpgrade(id, owned) {
  state.prestigeUpgrades[id] = owned;
  emit('prestige-upgrade:change', { id, owned });
}

export function recordGameResult(gameId, score) {
  const g = state.games[gameId];
  if (!g) return;
  if (score > g.bestScore) g.bestScore = score;
  g.recentScores.push(score);
  if (g.recentScores.length > 5) g.recentScores.shift();
  g.totalRuns++;

  // Mastery gain: diminishing returns
  const gain = Math.max(0.5, 5 * (1 - g.mastery / 100));
  g.mastery = Math.min(100, g.mastery + gain);

  emit('game:result', { gameId, score, mastery: g.mastery });
}

export function unlockStage2() {
  if (state.stage >= 2) return;
  state.stage = 2;
  state.games.target.unlocked = true;
  emit('stage:unlock', { stage: 2 });
}
```

**Step 2: Verify state in browser console**

Add temporarily to `main.js` after `initState()`:
```js
console.log('[State]', state);
```
Reload. Expected: state object logged with all defaults.

Remove the temp log line when verified.

**Step 3: Commit**

```bash
git add js/state.js js/main.js
git commit -m "feat: global state module with event bus and mutations"
```

---

## Task 3: Save System

**Files:**
- Create: `js/save.js`

**Step 1: Create `js/save.js`**

```js
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
    // TODO: show offline earnings notification (Task 6)
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
```

**Step 2: Add `getTotalAutoRate` stub to `js/automation.js`** (needed by save.js import — full implementation in Task 9)

Create `js/automation.js`:
```js
// js/automation.js — stub (full implementation in Task 9)
export function getTotalAutoRate() { return 0; }
export function getAutoRate(_gameId) { return 0; }
```

**Step 3: Verify save/load**

In browser console after playing around:
```js
import('./js/save.js').then(m => { m.saveGame(); console.log('saved'); });
```
Reload page. Check console for no errors.

**Step 4: Commit**

```bash
git add js/save.js js/automation.js
git commit -m "feat: save/load system with offline progress and export/import"
```

---

## Task 4: Game Loop

**Files:**
- Create: `js/loop.js`

**Step 1: Create `js/loop.js`**

```js
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
```

**Step 2: Verify loop is ticking**

Temporarily add in `main.js`:
```js
import { on } from './state.js';
on('tick', ({ rate }) => console.log('[Tick] rate:', rate));
```
Reload. Expected: `[Tick] rate: 0` logged every second. Remove log when done.

**Step 3: Commit**

```bash
git add js/loop.js
git commit -m "feat: game loop with automation tick and stage unlock check"
```

---

## Task 5: HUD

**Files:**
- Create: `js/ui/hud.js`

**Step 1: Create `js/ui/hud.js`**

```js
// js/ui/hud.js — always-visible currency bar

import { state, on } from '../state.js';
import { formatNumber } from '../utils.js';

export function initHUD() {
  document.getElementById('hud').innerHTML = `
    <span class="game-title">ARCADE IDLE</span>
    <div class="hud-currencies">
      <div class="hud-currency bits">
        <span class="label">BITS</span>
        <span class="value" id="hud-bits">0</span>
      </div>
      <div class="hud-currency td">
        <span class="label">TD</span>
        <span class="value" id="hud-td">0</span>
      </div>
      <div class="hud-currency nc">
        <span class="label">NC</span>
        <span class="value" id="hud-nc">0</span>
      </div>
    </div>
    <div style="font-size:0.6rem;color:var(--text-dim)" id="hud-rate"></div>
  `;

  on('currency:change', () => updateHUD());
  on('tick', ({ rate }) => updateRate(rate));
  updateHUD();
}

function updateHUD() {
  setText('hud-bits', formatNumber(state.currencies.bits));
  setText('hud-td',   formatNumber(state.currencies.trainingData));
  setText('hud-nc',   formatNumber(state.currencies.neuralCredits));
}

function updateRate(rate) {
  const el = document.getElementById('hud-rate');
  if (el && rate > 0) el.textContent = `+${formatNumber(rate)}/s`;
  else if (el) el.textContent = '';
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.textContent !== text) {
    el.textContent = text;
    el.classList.remove('bump');
    void el.offsetWidth; // reflow to restart animation
    el.classList.add('bump');
  }
}
```

**Step 2: Create `js/utils.js`**

```js
// js/utils.js — shared helpers

export function formatNumber(n) {
  n = Math.floor(n);
  if (n >= 1e9)  return (n / 1e9).toFixed(2)  + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(2)  + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(1)  + 'K';
  return String(n);
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Returns the rolling average of an array, or 0 if empty */
export function rollingAvg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
```

**Step 3: Verify HUD renders**

Reload. Expected: top bar shows `ARCADE IDLE`, `BITS 0`, `TD 0`, `NC 0` in neon styling.

**Step 4: Commit**

```bash
git add js/ui/hud.js js/utils.js
git commit -m "feat: HUD with animated currency display"
```

---

## Task 6: Hub Screen

**Files:**
- Create: `js/ui/hub.js`
- Create: `js/ui/upgrades-panel.js` (stub)
- Create: `js/ui/automation-panel.js` (stub)
- Create: `js/ui/prestige-panel.js` (stub)

**Step 1: Create `js/ui/hub.js`**

```js
// js/ui/hub.js — main hub screen

import { state, on } from '../state.js';
import { openPanel }  from './panel.js';
import { launchGame } from '../games/launcher.js';

export function initHub() {
  renderHub();
  on('stage:unlock', () => renderHub());
  on('game:result',  () => renderHub());
}

function renderHub() {
  const hub = document.getElementById('hub');
  hub.innerHTML = `
    <div class="hub-games">
      ${gameCard('paddle', '🎮', 'PADDLE')}
      ${gameCard('target', '🎯', 'TARGET')}
    </div>
    <div class="hub-tabs">
      <button class="hub-tab" data-panel="upgrades">UPGRADES</button>
      <button class="hub-tab" data-panel="automation">AUTOMATION</button>
      <button class="hub-tab" data-panel="prestige" id="prestige-tab"
        ${state.stage < 2 ? 'style="display:none"' : ''}>PRESTIGE</button>
    </div>
  `;

  hub.querySelectorAll('.game-card:not(.locked)').forEach(card => {
    card.addEventListener('click', () => launchGame(card.dataset.game));
  });

  hub.querySelectorAll('.hub-tab').forEach(tab => {
    tab.addEventListener('click', () => openPanel(tab.dataset.panel));
  });
}

function gameCard(id, icon, label) {
  const g = state.games[id];
  const locked = !g.unlocked;
  const mastery = g.mastery.toFixed(1);
  const lockMsg = id === 'target' ? 'REACH 50K BITS' : '';

  return `
    <div class="game-card ${locked ? 'locked' : ''}" data-game="${id}">
      <div class="card-icon">${icon}</div>
      <div class="card-title">${label}</div>
      ${locked
        ? `<div class="card-lock-msg">🔒 ${lockMsg}</div>`
        : `<div class="card-mastery">MASTERY ${mastery}%</div>`
      }
    </div>
  `;
}
```

**Step 2: Create `js/ui/panel.js`** (shared panel open/close logic)

```js
// js/ui/panel.js

import { initUpgradesPanel }   from './upgrades-panel.js';
import { initAutomationPanel } from './automation-panel.js';
import { initPrestigePanel }   from './prestige-panel.js';

const panelInits = {
  upgrades:   initUpgradesPanel,
  automation: initAutomationPanel,
  prestige:   initPrestigePanel,
};

export function openPanel(name) {
  const overlay = document.getElementById('panel-overlay');
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="side-panel" id="active-panel">
      <div class="panel-header">
        <span class="panel-title">${name.toUpperCase()}</span>
        <button class="panel-close" id="panel-close-btn">✕ CLOSE</button>
      </div>
      <div class="panel-body" id="panel-body"></div>
    </div>
  `;
  document.getElementById('panel-close-btn').addEventListener('click', closePanel);
  overlay.addEventListener('click', e => { if (e.target === overlay) closePanel(); });

  panelInits[name]?.();
}

export function closePanel() {
  document.getElementById('panel-overlay').classList.add('hidden');
}

export function refreshPanel() {
  // called by panel contents to re-render themselves
}
```

**Step 3: Create stub panel files**

`js/ui/upgrades-panel.js`:
```js
export function initUpgradesPanel() {
  document.getElementById('panel-body').innerHTML =
    '<p style="color:var(--text-dim);font-size:0.7rem">Upgrades coming soon...</p>';
}
```

`js/ui/automation-panel.js`:
```js
export function initAutomationPanel() {
  document.getElementById('panel-body').innerHTML =
    '<p style="color:var(--text-dim);font-size:0.7rem">Automation coming soon...</p>';
}
```

`js/ui/prestige-panel.js`:
```js
export function initPrestigePanel() {
  document.getElementById('panel-body').innerHTML =
    '<p style="color:var(--text-dim);font-size:0.7rem">Prestige coming soon...</p>';
}
```

**Step 4: Create `js/games/launcher.js`** (stub)

```js
// js/games/launcher.js — stub
export function launchGame(id) {
  console.log('[Launcher] launching:', id);
  alert(`Game: ${id} — coming soon!`);
}
```

**Step 5: Verify hub renders**

Reload. Expected: two game cards (PADDLE unlocked, TARGET locked), three tab buttons. Clicking tabs opens a side panel. Clicking the PADDLE card shows the stub alert.

**Step 6: Commit**

```bash
git add js/ui/hub.js js/ui/panel.js js/ui/upgrades-panel.js \
        js/ui/automation-panel.js js/ui/prestige-panel.js js/games/launcher.js
git commit -m "feat: hub screen with game cards and panel navigation"
```

---

## Task 7: Base Game (Session Lifecycle)

**Files:**
- Create: `js/games/base-game.js`

**Step 1: Create `js/games/base-game.js`**

```js
// js/games/base-game.js — shared session lifecycle and reward calculation

import { state, addCurrency, recordGameResult, emit } from '../state.js';
import { rollingAvg } from '../utils.js';
import { getUpgradeValue } from '../upgrades.js';

/**
 * Call at the end of a mini-game session.
 * Returns { bits, trainingData, masteryGain }
 */
export function submitResult(gameId, score) {
  const g = state.games[gameId];
  const prevAvg = rollingAvg(g.recentScores);
  const prevMastery = g.mastery;

  // Base Bits: score × upgrade multiplier
  const bitMult = getUpgradeValue(`${gameId}_bit_mult`);
  const bits = Math.floor(score * bitMult);

  // Training Data: only when score beats rolling average
  let td = 0;
  if (score > prevAvg && prevAvg > 0) {
    const tdMult = getUpgradeValue(`${gameId}_td_mult`);
    td = Math.floor((score - prevAvg) * 0.1 * tdMult);
  } else if (prevAvg === 0 && score > 0) {
    // First run always awards some TD
    td = Math.floor(score * 0.05);
  }

  addCurrency('bits', bits);
  if (td > 0) addCurrency('trainingData', td);

  // Update mastery + recent scores
  recordGameResult(gameId, score);
  const masteryGain = state.games[gameId].mastery - prevMastery;

  emit('session:end', { gameId, score, bits, td, masteryGain });

  return { bits, td, masteryGain };
}

/**
 * Show the result overlay after a session.
 * `onDismiss` is called when the player continues.
 */
export function showResults(gameId, score, rewards, onDismiss) {
  const overlay = document.createElement('div');
  overlay.className = 'result-screen';
  overlay.innerHTML = `
    <div class="result-title">SESSION COMPLETE</div>
    <div class="result-score">${score}</div>
    <div class="result-rewards">
      <div class="result-reward bits">
        <span class="label">BITS</span>
        <span class="amount">+${rewards.bits}</span>
      </div>
      <div class="result-reward td">
        <span class="label">TRAINING DATA</span>
        <span class="amount">+${rewards.td}</span>
      </div>
    </div>
    <div class="result-mastery-change">
      MASTERY <span>+${rewards.masteryGain.toFixed(2)}%</span>
    </div>
    <button class="result-btn">CONTINUE</button>
  `;

  document.getElementById('game-overlay').appendChild(overlay);
  overlay.querySelector('.result-btn').addEventListener('click', () => {
    overlay.remove();
    onDismiss();
  });
}
```

**Step 2: Create `js/upgrades.js`** (stub for now, returns 1× multiplier)

```js
// js/upgrades.js — upgrade definitions and value lookups

import { state } from './state.js';

/** Returns the effective numeric value of an upgrade effect */
export function getUpgradeValue(key) {
  // Default all multipliers to 1 until upgrades system is built (Task 10)
  const DEFAULTS = {
    paddle_bit_mult: 1,
    paddle_td_mult:  1,
    target_bit_mult: 1,
    target_td_mult:  1,
    auto_mult:       1,
    prestige_bonus:  1,
  };
  return DEFAULTS[key] ?? 1;
}
```

**Step 3: Commit**

```bash
git add js/games/base-game.js js/upgrades.js
git commit -m "feat: base game session lifecycle with reward calculation"
```

---

## Task 8: Paddle Mini-Game

**Files:**
- Create: `js/games/paddle.js`
- Modify: `js/games/launcher.js`

**Step 1: Create `js/games/paddle.js`**

```js
// js/games/paddle.js — Breakout-style canvas mini-game

import { submitResult, showResults } from './base-game.js';

const CANVAS_W = 480;
const CANVAS_H = 420;
const SESSION_SECS = 45;
const COLS = 8;
const ROWS = 5;
const BLOCK_W = 52;
const BLOCK_H = 18;
const BLOCK_PAD = 4;
const BLOCK_OFFSET_X = 20;
const BLOCK_OFFSET_Y = 40;

const BLOCK_COLORS = ['#ff00ff', '#ff00aa', '#aa00ff', '#ff4488', '#cc00ff'];

export function launchPaddle(onExit) {
  // Build overlay
  const overlay = createOverlay('PADDLE.EXE');
  const canvas = overlay.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = overlay.querySelector('#g-score');
  const timerEl = overlay.querySelector('#g-timer');

  const game = initGame();
  let animId = null;
  let lastTime = null;

  function loop(ts) {
    if (!lastTime) lastTime = ts;
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    game.elapsed += dt;
    if (game.elapsed >= SESSION_SECS || game.blocks.length === 0) {
      cancelAnimationFrame(animId);
      endSession();
      return;
    }

    update(game, dt);
    render(ctx, game);

    scoreEl.textContent = game.score;
    timerEl.textContent = Math.ceil(SESSION_SECS - game.elapsed);

    animId = requestAnimationFrame(loop);
  }

  function endSession() {
    const rewards = submitResult('paddle', game.score);
    showResults('paddle', game.score, rewards, () => {
      overlay.remove();
      onExit();
    });
  }

  // Mouse/touch control
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    game.paddleX = clamp(
      e.clientX - rect.left - game.paddleW / 2,
      0, CANVAS_W - game.paddleW
    );
  });

  // Keyboard control
  const keys = {};
  window.addEventListener('keydown', e => { keys[e.key] = true; });
  window.addEventListener('keyup',   e => { keys[e.key] = false; });
  game._keys = keys;

  animId = requestAnimationFrame(loop);
  document.getElementById('app').appendChild(overlay);
}

function initGame() {
  const blocks = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      blocks.push({
        x: BLOCK_OFFSET_X + col * (BLOCK_W + BLOCK_PAD),
        y: BLOCK_OFFSET_Y + row * (BLOCK_H + BLOCK_PAD),
        w: BLOCK_W,
        h: BLOCK_H,
        color: BLOCK_COLORS[row % BLOCK_COLORS.length],
        points: (ROWS - row) * 10,
        alive: true,
      });
    }
  }

  return {
    score:    0,
    elapsed:  0,
    combo:    0,
    blocks:   blocks.filter(b => b.alive),
    paddle: { w: 80 },
    paddleW:  80,
    paddleX:  CANVAS_W / 2 - 40,
    paddleY:  CANVAS_H - 28,
    ball: {
      x: CANVAS_W / 2,
      y: CANVAS_H / 2,
      r: 7,
      vx: 220 * (Math.random() > 0.5 ? 1 : -1),
      vy: -220,
    },
    _keys: {},
  };
}

function update(g, dt) {
  const b = g.ball;
  const SPEED_SCALE = 1 + g.elapsed / SESSION_SECS * 0.6; // speeds up over time

  // Keyboard paddle movement
  const spd = 400 * dt;
  if (g._keys['ArrowLeft']  || g._keys['a']) g.paddleX = clamp(g.paddleX - spd, 0, CANVAS_W - g.paddleW);
  if (g._keys['ArrowRight'] || g._keys['d']) g.paddleX = clamp(g.paddleX + spd, 0, CANVAS_W - g.paddleW);

  b.x += b.vx * dt * SPEED_SCALE;
  b.y += b.vy * dt * SPEED_SCALE;

  // Wall bounce
  if (b.x - b.r < 0)           { b.x = b.r;           b.vx = Math.abs(b.vx); }
  if (b.x + b.r > CANVAS_W)    { b.x = CANVAS_W - b.r; b.vx = -Math.abs(b.vx); }
  if (b.y - b.r < 0)           { b.y = b.r;            b.vy = Math.abs(b.vy); }

  // Ball lost bottom — small score penalty, reset ball
  if (b.y - b.r > CANVAS_H) {
    g.score = Math.max(0, g.score - 50);
    g.combo = 0;
    b.x = CANVAS_W / 2;
    b.y = CANVAS_H / 2;
    b.vx = 220 * (Math.random() > 0.5 ? 1 : -1);
    b.vy = -220;
  }

  // Paddle collision
  const px = g.paddleX, pw = g.paddleW, py = g.paddleY, ph = 12;
  if (
    b.vy > 0 &&
    b.y + b.r >= py && b.y + b.r <= py + ph &&
    b.x >= px && b.x <= px + pw
  ) {
    b.vy = -Math.abs(b.vy);
    // Angle based on hit position
    const hitFrac = (b.x - px) / pw; // 0–1
    b.vx = (hitFrac - 0.5) * 500;
  }

  // Block collisions
  for (const block of g.blocks) {
    if (circleRect(b, block)) {
      g.combo++;
      const pts = block.points * Math.ceil(g.combo / 3);
      g.score += pts;
      g.blocks = g.blocks.filter(bl => bl !== block);
      // Simple reflection: reverse vy
      b.vy = -b.vy;
      break;
    }
  }
}

function render(ctx, g) {
  // Background
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Grid lines
  ctx.strokeStyle = 'rgba(0,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < CANVAS_W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
  }
  for (let y = 0; y < CANVAS_H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
  }

  // Blocks
  for (const block of g.blocks) {
    ctx.fillStyle = block.color + '33';
    ctx.fillRect(block.x, block.y, block.w, block.h);
    ctx.strokeStyle = block.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(block.x, block.y, block.w, block.h);
    // Glow
    ctx.shadowColor = block.color;
    ctx.shadowBlur = 6;
    ctx.strokeRect(block.x, block.y, block.w, block.h);
    ctx.shadowBlur = 0;
  }

  // Paddle
  const px = g.paddleX, py = g.paddleY, pw = g.paddleW;
  ctx.fillStyle = '#00ffff22';
  ctx.fillRect(px, py, pw, 12);
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 10;
  ctx.strokeRect(px, py, pw, 12);
  ctx.shadowBlur = 0;

  // Ball
  const b = g.ball;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Combo indicator
  if (g.combo > 1) {
    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 11px "Space Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`×${g.combo} COMBO`, CANVAS_W - 10, CANVAS_H - 10);
  }
}

function circleRect(b, r) {
  const nearX = clamp(b.x, r.x, r.x + r.w);
  const nearY = clamp(b.y, r.y, r.y + r.h);
  const dx = b.x - nearX, dy = b.y - nearY;
  return dx * dx + dy * dy < b.r * b.r;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function createOverlay(title) {
  const div = document.createElement('div');
  div.id = 'game-overlay';
  div.innerHTML = `
    <div class="game-title-label">${title}</div>
    <div class="game-hud">
      <div class="game-stat">SCORE <span id="g-score">0</span></div>
      <div class="game-stat">TIME <span id="g-timer">${SESSION_SECS}</span></div>
    </div>
    <canvas width="${CANVAS_W}" height="${CANVAS_H}"></canvas>
  `;
  return div;
}
```

**Step 2: Update `js/games/launcher.js`**

```js
// js/games/launcher.js

import { launchPaddle } from './paddle.js';
import { launchTarget } from './target.js';

const launchers = {
  paddle: launchPaddle,
  target: launchTarget,
};

export function launchGame(id) {
  const launch = launchers[id];
  if (!launch) return console.warn('[Launcher] unknown game:', id);
  launch(() => {
    // Called when player exits back to hub — nothing needed, hub is still rendered
    console.log('[Launcher] returned from:', id);
  });
}
```

**Step 3: Create `js/games/target.js`** (stub for now)

```js
// js/games/target.js — stub (full implementation in Task 11)
export function launchTarget(onExit) {
  alert('Target game coming soon!');
  onExit();
}
```

**Step 4: Verify paddle game**

Reload. Click PADDLE card. Expected:
- Game overlay appears with canvas
- Ball bounces, paddle moves with mouse and arrow keys
- Blocks break and score increases
- After 45s (or all blocks cleared), result screen shows

**Step 5: Commit**

```bash
git add js/games/paddle.js js/games/launcher.js js/games/target.js \
        js/games/base-game.js
git commit -m "feat: paddle/breakout mini-game with scoring and result screen"
```

---

## Task 9: Upgrades System

**Files:**
- Modify: `js/upgrades.js`
- Create: `js/ui/upgrades-panel.js` (replace stub)

**Step 1: Replace `js/upgrades.js` with full implementation**

```js
// js/upgrades.js — upgrade definitions and purchase logic

import { state, spendCurrency, setUpgradeLevel, emit } from './state.js';

/**
 * Upgrade definition shape:
 *   id, name, desc, icon, currency, baseCost, costScale, maxLevel, effect(level) -> number
 */
export const UPGRADES = [
  // ── Paddle upgrades ────────────────────────────────────
  {
    id: 'paddle_bit_mult',
    name: 'Data Extractor',
    desc: 'Paddle sessions earn +25% Bits per level',
    icon: '💾',
    currency: 'bits',
    baseCost: 100,
    costScale: 2.5,
    maxLevel: 10,
    effect: lvl => 1 + lvl * 0.25,
  },
  {
    id: 'paddle_td_mult',
    name: 'Training Boost',
    desc: 'Paddle sessions earn +30% Training Data per level',
    icon: '📊',
    currency: 'trainingData',
    baseCost: 20,
    costScale: 2.2,
    maxLevel: 8,
    effect: lvl => 1 + lvl * 0.30,
  },
  {
    id: 'paddle_mastery_rate',
    name: 'Rapid Conditioning',
    desc: 'Paddle mastery grows 20% faster per level',
    icon: '⚡',
    currency: 'bits',
    baseCost: 500,
    costScale: 3,
    maxLevel: 5,
    effect: lvl => 1 + lvl * 0.20,
  },
  // ── Target upgrades ────────────────────────────────────
  {
    id: 'target_bit_mult',
    name: 'Signal Amplifier',
    desc: 'Target sessions earn +25% Bits per level',
    icon: '📡',
    currency: 'bits',
    baseCost: 200,
    costScale: 2.5,
    maxLevel: 10,
    effect: lvl => 1 + lvl * 0.25,
  },
  {
    id: 'target_td_mult',
    name: 'Reflex Logger',
    desc: 'Target sessions earn +30% Training Data per level',
    icon: '🧠',
    currency: 'trainingData',
    baseCost: 40,
    costScale: 2.2,
    maxLevel: 8,
    effect: lvl => 1 + lvl * 0.30,
  },
  // ── Global upgrades ───────────────────────────────────
  {
    id: 'auto_mult',
    name: 'Overclock Core',
    desc: 'All automation earns +20% Bits/sec per level',
    icon: '🔧',
    currency: 'bits',
    baseCost: 1000,
    costScale: 3.5,
    maxLevel: 10,
    effect: lvl => 1 + lvl * 0.20,
  },
  {
    id: 'prestige_bonus',
    name: 'Neural Amplifier',
    desc: 'Prestige bonuses are 10% stronger per level',
    icon: '🌟',
    currency: 'neuralCredits',
    baseCost: 1,
    costScale: 2,
    maxLevel: 5,
    effect: lvl => 1 + lvl * 0.10,
  },
];

export function getUpgradeDef(id) {
  return UPGRADES.find(u => u.id === id);
}

export function getUpgradeLevel(id) {
  return state.upgrades[id] ?? 0;
}

export function getUpgradeValue(id) {
  const def = getUpgradeDef(id);
  if (!def) return 1;
  const level = getUpgradeLevel(id);
  return def.effect(level);
}

export function getUpgradeCost(id) {
  const def = getUpgradeDef(id);
  if (!def) return Infinity;
  const level = getUpgradeLevel(id);
  return Math.floor(def.baseCost * Math.pow(def.costScale, level));
}

export function canAfford(id) {
  const def = getUpgradeDef(id);
  if (!def) return false;
  const cost = getUpgradeCost(id);
  return state.currencies[def.currency] >= cost;
}

export function purchaseUpgrade(id) {
  const def = getUpgradeDef(id);
  if (!def) return false;
  const level = getUpgradeLevel(id);
  if (level >= def.maxLevel) return false;
  const cost = getUpgradeCost(id);
  if (!spendCurrency(def.currency, cost)) return false;
  setUpgradeLevel(id, level + 1);
  return true;
}

/** Filter upgrades visible to the player based on stage */
export function getVisibleUpgrades() {
  return UPGRADES.filter(u => {
    if (u.id.startsWith('target_') && !state.games.target.unlocked) return false;
    if (u.id === 'prestige_bonus' && state.stage < 2) return false;
    return true;
  });
}
```

**Step 2: Replace `js/ui/upgrades-panel.js`**

```js
// js/ui/upgrades-panel.js

import { state, on, off } from '../state.js';
import {
  getVisibleUpgrades, getUpgradeLevel, getUpgradeCost,
  canAfford, purchaseUpgrade
} from '../upgrades.js';
import { formatNumber } from '../utils.js';

export function initUpgradesPanel() {
  renderUpgradesPanel();
  const refresh = () => renderUpgradesPanel();
  on('currency:change', refresh);
  on('upgrade:change',  refresh);
  // Clean up listeners when panel is removed
  observePanelClose(() => {
    off('currency:change', refresh);
    off('upgrade:change',  refresh);
  });
}

function renderUpgradesPanel() {
  const body = document.getElementById('panel-body');
  if (!body) return;

  const upgrades = getVisibleUpgrades();
  body.innerHTML = upgrades.map(u => {
    const level    = getUpgradeLevel(u.id);
    const cost     = getUpgradeCost(u.id);
    const maxed    = level >= u.maxLevel;
    const afford   = canAfford(u.id);
    const classes  = ['upgrade-card', maxed ? 'maxed' : '', !afford && !maxed ? 'unaffordable' : '']
      .filter(Boolean).join(' ');

    const currSymbol = { bits: 'B', trainingData: 'TD', neuralCredits: 'NC' }[u.currency];

    return `
      <div class="${classes}" data-id="${u.id}">
        <div class="upgrade-icon">${u.icon}</div>
        <div class="upgrade-info">
          <div class="upgrade-name">${u.name}</div>
          <div class="upgrade-desc">${u.desc}</div>
        </div>
        <div>
          <div class="upgrade-cost">${maxed ? 'MAX' : formatNumber(cost) + ' ' + currSymbol}</div>
          <div class="upgrade-level">LVL ${level}/${u.maxLevel}</div>
        </div>
      </div>
    `;
  }).join('');

  body.querySelectorAll('.upgrade-card:not(.maxed):not(.unaffordable)').forEach(card => {
    card.addEventListener('click', () => {
      purchaseUpgrade(card.dataset.id);
    });
  });
}

function observePanelClose(cb) {
  const observer = new MutationObserver(() => {
    if (!document.getElementById('panel-body')) {
      cb();
      observer.disconnect();
    }
  });
  observer.observe(document.getElementById('panel-overlay'), { childList: true });
}
```

**Step 3: Verify upgrades panel**

Reload. Play paddle game to earn bits. Open UPGRADES tab. Expected:
- Upgrade cards render with icons, costs, levels
- Unaffordable ones are dimmed
- Clicking an affordable upgrade deducts currency and increments level

**Step 4: Commit**

```bash
git add js/upgrades.js js/ui/upgrades-panel.js
git commit -m "feat: upgrade system with purchase logic and upgrades panel"
```

---

## Task 10: Automation System

**Files:**
- Modify: `js/automation.js`
- Create: `js/ui/automation-panel.js` (replace stub)

**Step 1: Replace `js/automation.js` with full implementation**

```js
// js/automation.js — idle automation calculations

import { state } from './state.js';
import { getUpgradeValue } from './upgrades.js';
import { rollingAvg } from './utils.js';

const BASE_RATE = 10; // bits/sec at 100% mastery, no upgrades

/** Automation rate for a single game (bits/sec) */
export function getAutoRate(gameId) {
  const g = state.games[gameId];
  if (!g || !g.unlocked || g.mastery === 0) return 0;

  const masteryFactor      = g.mastery / 100;
  const consistencyFactor  = calcConsistency(g.recentScores);
  const upgradeMult        = getUpgradeValue('auto_mult');
  const prestigeBonus      = getPrestigeBonus();

  return masteryFactor * consistencyFactor * upgradeMult * prestigeBonus * BASE_RATE;
}

/** Sum of all game auto rates */
export function getTotalAutoRate() {
  return Object.keys(state.games).reduce((sum, id) => sum + getAutoRate(id), 0);
}

/**
 * Consistency factor: how stable are the recent scores?
 * Low variance = high consistency (up to 1.5×)
 * High variance = low consistency (down to 0.5×)
 */
function calcConsistency(scores) {
  if (scores.length < 2) return 1.0;
  const avg = rollingAvg(scores);
  if (avg === 0) return 1.0;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
  const cv = Math.sqrt(variance) / avg; // coefficient of variation (0 = perfect)
  return Math.max(0.5, Math.min(1.5, 1.5 - cv));
}

function getPrestigeBonus() {
  const baseBonus = getUpgradeValue('prestige_bonus');
  const overclock = state.prestigeUpgrades['overclock'] ? 1.15 : 1;
  return baseBonus * overclock;
}

/** Descriptive breakdown for the automation panel */
export function getAutoBreakdown(gameId) {
  const g = state.games[gameId];
  if (!g || !g.unlocked) return null;
  return {
    mastery:     g.mastery,
    consistency: calcConsistency(g.recentScores),
    rate:        getAutoRate(gameId),
    bestScore:   g.bestScore,
    avgScore:    Math.floor(rollingAvg(g.recentScores)),
  };
}
```

**Step 2: Replace `js/ui/automation-panel.js`**

```js
// js/ui/automation-panel.js

import { state, on, off } from '../state.js';
import { getAutoBreakdown, getTotalAutoRate } from '../automation.js';
import { formatNumber } from '../utils.js';

export function initAutomationPanel() {
  renderAutomationPanel();
  const refresh = () => renderAutomationPanel();
  on('tick',        refresh);
  on('game:result', refresh);
  observePanelClose(() => {
    off('tick',        refresh);
    off('game:result', refresh);
  });
}

function renderAutomationPanel() {
  const body = document.getElementById('panel-body');
  if (!body) return;

  const games = [
    { id: 'paddle', label: 'PADDLE.EXE' },
    { id: 'target', label: 'TARGET.EXE' },
  ];

  const totalRate = getTotalAutoRate();

  body.innerHTML = `
    <div class="auto-stat-row" style="margin-bottom:16px">
      <span>TOTAL INCOME</span>
      <span>${formatNumber(totalRate)}/sec</span>
    </div>
    ${games.map(g => renderGameSection(g.id, g.label)).join('')}
    <div style="font-size:0.62rem;color:var(--text-dim);margin-top:12px;line-height:1.6">
      Automation earns Bits while you're away.<br>
      Play sessions to increase mastery and consistency.
    </div>
  `;
}

function renderGameSection(gameId, label) {
  const g = state.games[gameId];
  if (!g) return '';

  if (!g.unlocked) {
    return `
      <div class="auto-game-section" style="opacity:0.4">
        <div class="auto-game-title">${label}</div>
        <div style="font-size:0.65rem;color:var(--text-dim)">LOCKED</div>
      </div>
    `;
  }

  const bd = getAutoBreakdown(gameId);
  const consistencyPct = (bd.consistency * 100 / 1.5).toFixed(0); // normalize to %

  return `
    <div class="auto-game-section">
      <div class="auto-game-title">${label}</div>
      <div class="mastery-bar-wrap">
        <div class="mastery-bar-bg">
          <div class="mastery-bar-fill" style="width:${bd.mastery}%"></div>
        </div>
        <div class="mastery-pct">${bd.mastery.toFixed(1)}%</div>
      </div>
      <div class="auto-stat-row"><span>RATE</span><span>${formatNumber(bd.rate)}/sec</span></div>
      <div class="auto-stat-row"><span>CONSISTENCY</span><span>${consistencyPct}%</span></div>
      <div class="auto-stat-row"><span>BEST SCORE</span><span>${formatNumber(bd.bestScore)}</span></div>
      <div class="auto-stat-row"><span>AVG SCORE</span><span>${formatNumber(bd.avgScore)}</span></div>
    </div>
  `;
}

function observePanelClose(cb) {
  const observer = new MutationObserver(() => {
    if (!document.getElementById('panel-body')) { cb(); observer.disconnect(); }
  });
  observer.observe(document.getElementById('panel-overlay'), { childList: true });
}
```

**Step 3: Verify automation panel**

Play a few paddle sessions. Open AUTOMATION panel. Expected:
- Mastery bar fills based on runs played
- Rate increases as mastery grows
- HUD `/sec` rate updates every tick

**Step 4: Commit**

```bash
git add js/automation.js js/ui/automation-panel.js
git commit -m "feat: automation system with mastery-based idle income and panel"
```

---

## Task 11: Target Mini-Game

**Files:**
- Modify: `js/games/target.js`

**Step 1: Replace `js/games/target.js` with full implementation**

```js
// js/games/target.js — click-to-hit target mini-game

import { submitResult, showResults } from './base-game.js';

const CANVAS_W = 480;
const CANVAS_H = 420;
const SESSION_SECS = 30;
const MIN_SPAWN_INTERVAL = 0.6;
const MAX_SPAWN_INTERVAL = 1.4;
const TARGET_LIFETIME = 2.5;  // seconds before shrinking away
const TARGET_MIN_R = 14;
const TARGET_MAX_R = 36;

export function launchTarget(onExit) {
  const overlay = createOverlay('TARGET.EXE');
  const canvas  = overlay.querySelector('canvas');
  const ctx     = canvas.getContext('2d');
  const scoreEl = overlay.querySelector('#g-score');
  const timerEl = overlay.querySelector('#g-timer');
  const chainEl = overlay.querySelector('#g-chain');

  const game = initGame();
  let animId  = null;
  let lastTs  = null;

  function loop(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    game.elapsed += dt;
    if (game.elapsed >= SESSION_SECS) {
      cancelAnimationFrame(animId);
      endSession();
      return;
    }

    update(game, dt);
    render(ctx, game);

    scoreEl.textContent = game.score;
    timerEl.textContent = Math.ceil(SESSION_SECS - game.elapsed);
    chainEl.textContent = game.chain > 1 ? `×${game.chain}` : '';

    animId = requestAnimationFrame(loop);
  }

  function endSession() {
    const rewards = submitResult('target', game.score);
    showResults('target', game.score, rewards, () => {
      overlay.remove();
      onExit();
    });
  }

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    handleClick(game, mx, my);
  });

  animId = requestAnimationFrame(loop);
  document.getElementById('app').appendChild(overlay);
}

function initGame() {
  return {
    score:     0,
    elapsed:   0,
    chain:     0,
    chainTime: 0,
    targets:   [],
    nextSpawn: randBetween(0.3, 0.8),
  };
}

function update(g, dt) {
  // Chain resets after 1.5s of no hit
  if (g.chain > 0) {
    g.chainTime += dt;
    if (g.chainTime > 1.5) { g.chain = 0; g.chainTime = 0; }
  }

  // Spawn new targets
  g.nextSpawn -= dt;
  if (g.nextSpawn <= 0) {
    g.targets.push(spawnTarget());
    g.nextSpawn = randBetween(MIN_SPAWN_INTERVAL, MAX_SPAWN_INTERVAL);
  }

  // Age targets
  for (const t of g.targets) {
    t.age += dt;
    t.r = TARGET_MAX_R * Math.max(0, 1 - t.age / TARGET_LIFETIME);
  }

  // Remove expired targets (chain breaks on miss)
  const before = g.targets.length;
  g.targets = g.targets.filter(t => t.r > TARGET_MIN_R);
  if (g.targets.length < before) {
    g.chain = 0;
    g.chainTime = 0;
  }
}

function render(ctx, g) {
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Grid
  ctx.strokeStyle = 'rgba(255,0,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < CANVAS_W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
  }
  for (let y = 0; y < CANVAS_H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
  }

  for (const t of g.targets) {
    const alpha = t.r / TARGET_MAX_R;
    const color = `rgba(255, 0, 255, ${alpha.toFixed(2)})`;

    // Outer ring
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner dot
    ctx.beginPath();
    ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Crosshair
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    const cs = t.r * 0.5;
    ctx.beginPath();
    ctx.moveTo(t.x - cs, t.y); ctx.lineTo(t.x + cs, t.y);
    ctx.moveTo(t.x, t.y - cs); ctx.lineTo(t.x, t.y + cs);
    ctx.stroke();
  }
}

function handleClick(g, mx, my) {
  for (let i = g.targets.length - 1; i >= 0; i--) {
    const t = g.targets[i];
    const dx = mx - t.x, dy = my - t.y;
    if (dx * dx + dy * dy <= t.r * t.r) {
      // Score: more points for larger (earlier) hits
      const sizeFrac = t.r / TARGET_MAX_R;
      g.chain++;
      g.chainTime = 0;
      const pts = Math.floor(100 * sizeFrac * Math.ceil(g.chain / 3));
      g.score += pts;
      g.targets.splice(i, 1);
      break;
    }
  }
}

function spawnTarget() {
  return {
    x:   randBetween(TARGET_MAX_R + 10, CANVAS_W - TARGET_MAX_R - 10),
    y:   randBetween(TARGET_MAX_R + 10, CANVAS_H - TARGET_MAX_R - 10),
    r:   TARGET_MAX_R,
    age: 0,
  };
}

function randBetween(a, b) {
  return a + Math.random() * (b - a);
}

function createOverlay(title) {
  const div = document.createElement('div');
  div.id = 'game-overlay';
  div.innerHTML = `
    <div class="game-title-label">${title}</div>
    <div class="game-hud">
      <div class="game-stat">SCORE <span id="g-score">0</span></div>
      <div class="game-stat">TIME <span id="g-timer">${SESSION_SECS}</span></div>
      <div class="game-stat">CHAIN <span id="g-chain"></span></div>
    </div>
    <canvas width="${CANVAS_W}" height="${CANVAS_H}"></canvas>
  `;
  return div;
}
```

**Step 2: Verify target game**

Earn 50k lifetime bits (or temporarily lower threshold for testing). Unlock Stage 2. Click TARGET card. Expected:
- Glowing magenta rings appear and shrink
- Clicking a ring destroys it and adds score
- Chain builds with rapid hits
- Result screen after 30s

To test without earning 50k bits, temporarily in state.js set:
```js
target: { unlocked: true, ... }
```
Then revert after testing.

**Step 3: Commit**

```bash
git add js/games/target.js
git commit -m "feat: target aim mini-game with chain multiplier"
```

---

## Task 12: Prestige System

**Files:**
- Create: `js/prestige.js`
- Modify: `js/ui/prestige-panel.js`

**Step 1: Create `js/prestige.js`**

```js
// js/prestige.js — prestige logic

import { state, addCurrency, spendCurrency, setPrestigeUpgrade, emit } from './state.js';
import { createDefaultState } from './state.js';

export const PRESTIGE_UPGRADES = [
  {
    id: 'better_bootup',
    name: 'Better Bootup',
    desc: 'Start each run with 10% mastery on all games',
    icon: '🚀',
    cost: 1,
  },
  {
    id: 'overclock',
    name: 'Overclock',
    desc: 'Automation rate +15% permanently',
    icon: '⚡',
    cost: 2,
  },
  {
    id: 'data_recovery',
    name: 'Data Recovery',
    desc: 'Keep 20% of Training Data when you prestige',
    icon: '💿',
    cost: 3,
  },
  {
    id: 'fast_learner',
    name: 'Fast Learner',
    desc: 'Mastery grows 25% faster',
    icon: '🧬',
    cost: 2,
  },
  {
    id: 'stage_skip',
    name: 'Stage Skip',
    desc: 'Stage 2 unlocks at 25K Bits instead of 50K',
    icon: '⏭️',
    cost: 4,
  },
];

export function calcPrestigeNC() {
  return Math.floor(Math.sqrt(state.currencies.lifetimeBits / 1000));
}

export function canPrestige() {
  return state.stage >= 2 && calcPrestigeNC() >= 1;
}

export function doPrestige() {
  if (!canPrestige()) return false;

  const nc = calcPrestigeNC();
  const savedTD = state.prestigeUpgrades['data_recovery']
    ? Math.floor(state.currencies.trainingData * 0.20)
    : 0;

  // Reset state to defaults
  const defaults = createDefaultState();
  Object.assign(state.currencies, defaults.currencies);
  state.stage   = defaults.stage;
  state.upgrades = defaults.upgrades;

  // Reset games, but apply Better Bootup if owned
  const startMastery = state.prestigeUpgrades['better_bootup'] ? 10 : 0;
  for (const id of Object.keys(state.games)) {
    Object.assign(state.games[id], defaults.games[id] || {});
    state.games[id].mastery = startMastery;
  }

  // Award NC and restore saved TD
  addCurrency('neuralCredits', nc);
  if (savedTD > 0) addCurrency('trainingData', savedTD);

  state.prestige.count++;
  state.prestige.lifetimeBits += state.currencies.lifetimeBits;

  emit('prestige', { nc, count: state.prestige.count });
  return true;
}

export function buyPrestigeUpgrade(id) {
  if (state.prestigeUpgrades[id]) return false;
  const def = PRESTIGE_UPGRADES.find(u => u.id === id);
  if (!def) return false;
  if (!spendCurrency('neuralCredits', def.cost)) return false;
  setPrestigeUpgrade(id, true);
  return true;
}
```

**Step 2: Replace `js/ui/prestige-panel.js`**

```js
// js/ui/prestige-panel.js

import { state, on, off } from '../state.js';
import { PRESTIGE_UPGRADES, calcPrestigeNC, canPrestige, doPrestige, buyPrestigeUpgrade } from '../prestige.js';
import { formatNumber } from '../utils.js';

export function initPrestigePanel() {
  renderPrestigePanel();
  const refresh = () => renderPrestigePanel();
  on('currency:change',        refresh);
  on('prestige-upgrade:change', refresh);
  observePanelClose(() => {
    off('currency:change',        refresh);
    off('prestige-upgrade:change', refresh);
  });
}

function renderPrestigePanel() {
  const body = document.getElementById('panel-body');
  if (!body) return;

  const nc       = calcPrestigeNC();
  const eligible = canPrestige();

  body.innerHTML = `
    <div class="prestige-info">
      <div class="prestige-nc-preview">+${nc} NC</div>
      <div class="prestige-nc-label">Neural Credits on prestige</div>
    </div>
    <button class="prestige-btn" id="prestige-go-btn" ${!eligible ? 'disabled' : ''}>
      ▶ PRESTIGE NOW
    </button>
    ${!eligible ? '<div style="font-size:0.62rem;color:var(--text-dim);text-align:center;margin-bottom:16px">Reach Stage 2 to unlock prestige</div>' : ''}
    <div class="section-label">PERMANENT UPGRADES</div>
    ${PRESTIGE_UPGRADES.map(u => renderPrestigeUpgrade(u)).join('')}
  `;

  document.getElementById('prestige-go-btn')?.addEventListener('click', () => {
    if (!canPrestige()) return;
    if (!confirm('Prestige? This resets your progress but awards Neural Credits.')) return;
    doPrestige();
    import('./panel.js').then(m => m.closePanel());
  });

  body.querySelectorAll('.prestige-upgrade-card:not(.owned):not(.unaffordable)').forEach(card => {
    card.addEventListener('click', () => buyPrestigeUpgrade(card.dataset.id));
  });
}

function renderPrestigeUpgrade(u) {
  const owned     = !!state.prestigeUpgrades[u.id];
  const afford    = state.currencies.neuralCredits >= u.cost;
  const classes   = ['prestige-upgrade-card',
    owned ? 'owned' : '',
    !owned && !afford ? 'unaffordable' : '',
  ].filter(Boolean).join(' ');

  return `
    <div class="${classes}" data-id="${u.id}">
      <div class="upgrade-icon">${u.icon}</div>
      <div class="upgrade-info">
        <div class="upgrade-name">${u.name}</div>
        <div class="upgrade-desc">${u.desc}</div>
      </div>
      <div>
        <div class="upgrade-cost">${owned ? '✓' : u.cost + ' NC'}</div>
      </div>
    </div>
  `;
}

function observePanelClose(cb) {
  const observer = new MutationObserver(() => {
    if (!document.getElementById('panel-body')) { cb(); observer.disconnect(); }
  });
  observer.observe(document.getElementById('panel-overlay'), { childList: true });
}
```

**Step 3: Wire prestige into main.js**

Add to `js/main.js`:
```js
import './prestige.js'; // ensures prestige module is loaded
```

**Step 4: Verify prestige**

Earn 50k lifetime bits, reach Stage 2. Open PRESTIGE panel. Expected:
- NC preview shows calculated amount
- PRESTIGE NOW button is active
- Clicking + confirming resets bits/upgrades/stage
- NC is added to currency
- Prestige upgrade tree is purchasable

**Step 5: Commit**

```bash
git add js/prestige.js js/ui/prestige-panel.js js/main.js
git commit -m "feat: prestige system with NC rewards and permanent upgrade tree"
```

---

## Task 13: Particle Effects

**Files:**
- Create: `js/ui/particles.js`
- Modify: `js/games/base-game.js` (fire particles on session end)

**Step 1: Create `js/ui/particles.js`**

```js
// js/ui/particles.js — canvas particle effects

const canvas  = document.getElementById('particle-canvas');
const ctx     = canvas.getContext('2d');
let particles = [];
let animId    = null;

export function initParticles() {
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.position = 'fixed';
  canvas.style.top  = '0';
  canvas.style.left = '0';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '100';
}

/** Fire score-pop particles at screen position (x, y) */
export function popParticles(x, y, color = '#00ffff', count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
    const speed = 80 + Math.random() * 120;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      r: 2 + Math.random() * 3,
      color,
      alpha: 1,
      life: 0.6 + Math.random() * 0.4,
      age: 0,
    });
  }
  if (!animId) loop();
}

/** Big prestige burst from center of screen */
export function prestigeBurst() {
  const cx = window.innerWidth  / 2;
  const cy = window.innerHeight / 2;
  for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 100 + Math.random() * 300;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 3 + Math.random() * 5,
      color: ['#00ff88', '#00ffff', '#ff00ff'][Math.floor(Math.random() * 3)],
      alpha: 1,
      life: 1.0 + Math.random() * 0.5,
      age: 0,
    });
  }
  if (!animId) loop();
}

function loop() {
  const dt = 1 / 60;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  particles = particles.filter(p => p.age < p.life);

  for (const p of particles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 200 * dt; // gravity
    p.alpha = 1 - p.age / p.life;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color + Math.floor(p.alpha * 255).toString(16).padStart(2, '0');
    ctx.fill();
  }

  if (particles.length > 0) {
    animId = requestAnimationFrame(loop);
  } else {
    animId = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
```

**Step 2: Add particle initialization to `js/main.js`**

```js
import { initParticles } from './ui/particles.js';
// In main():
initParticles();
```

**Step 3: Fire particles on session end — modify `js/games/base-game.js`**

Add to the `showResults` function, inside the overlay creation, after `document.getElementById('game-overlay').appendChild(overlay)`:

```js
// Fire score particles
import { popParticles } from '../ui/particles.js';
// At top of showResults:
popParticles(window.innerWidth / 2, window.innerHeight / 2, '#00ffff', 20);
```

Add the import at the top of `base-game.js`:
```js
import { popParticles } from '../ui/particles.js';
```

And in `showResults` after appending the overlay:
```js
popParticles(window.innerWidth / 2, window.innerHeight / 3, '#00ffff', 20);
```

**Step 4: Fire prestige burst — modify `js/prestige.js`**

Add to `doPrestige()` after `emit('prestige', ...)`:
```js
import { prestigeBurst } from './ui/particles.js';
// At top of prestige.js:
import { prestigeBurst } from './ui/particles.js';
// In doPrestige():
prestigeBurst();
```

**Step 5: Verify particles**

Complete a game session. Expected: cyan particles burst from center on result screen. Prestige triggers a colorful multi-particle burst.

**Step 6: Commit**

```bash
git add js/ui/particles.js js/main.js js/games/base-game.js js/prestige.js
git commit -m "feat: particle effects on session results and prestige"
```

---

## Task 14: Save System — Finalization

**Files:**
- Modify: `js/ui/hub.js` (add save/export/import controls)

**Step 1: Add save controls to hub — update `js/ui/hub.js`**

Add to the bottom of the `renderHub()` function's innerHTML:

```js
// Add after the .hub-tabs div:
`<div style="display:flex;gap:8px;margin-top:auto">
  <button class="hub-tab" id="save-btn">💾 SAVE</button>
  <button class="hub-tab" id="export-btn">📤 EXPORT</button>
  <button class="hub-tab" id="import-btn">📥 IMPORT</button>
</div>`
```

Add event listeners after the hub querySelectorAll calls:

```js
import { saveGame, exportSave, importSave } from '../save.js';

document.getElementById('save-btn').addEventListener('click', () => {
  saveGame();
  const btn = document.getElementById('save-btn');
  btn.textContent = '✓ SAVED';
  setTimeout(() => { btn.textContent = '💾 SAVE'; }, 1500);
});

document.getElementById('export-btn').addEventListener('click', () => {
  const data = exportSave();
  navigator.clipboard.writeText(data).then(() => alert('Save copied to clipboard!'));
});

document.getElementById('import-btn').addEventListener('click', () => {
  const data = prompt('Paste save data:');
  if (data) importSave(data.trim());
});
```

**Step 2: Verify save controls**

Reload. Expected:
- SAVE button flashes "✓ SAVED" for 1.5s
- EXPORT copies a base64 string to clipboard
- IMPORT accepts a paste and reloads with saved state
- Auto-save every 30s (check localStorage in DevTools)

**Step 3: Commit**

```bash
git add js/ui/hub.js js/save.js
git commit -m "feat: save controls in hub with export/import and autosave"
```

---

## Task 15: Visual Polish Pass

**Files:**
- Modify: `style.css` (animations, transitions)
- Modify: `js/ui/hub.js` (stage unlock notification)

**Step 1: Add stage unlock notification — update event handler in `js/ui/hub.js`**

```js
import { on } from '../state.js';

on('stage:unlock', ({ stage }) => {
  renderHub();
  showNotification(`STAGE ${stage} UNLOCKED — TARGET GAME NOW AVAILABLE`, 'var(--amber)');
});
```

**Step 2: Create `showNotification` utility in `js/ui/hub.js`**

```js
function showNotification(msg, color = 'var(--cyan)') {
  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: var(--bg2); border: 1px solid ${color};
    color: ${color}; font-family: var(--font); font-size: 0.72rem;
    letter-spacing: 2px; padding: 10px 24px; border-radius: 4px;
    z-index: 200; animation: fadeIn 0.3s ease;
    box-shadow: 0 0 12px ${color}44;
  `;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
```

**Step 3: Add prestige notification**

In `js/prestige.js`, after `emit('prestige', ...)`:
```js
// Import showNotification... or emit event and handle in hub
emit('prestige', { nc, count: state.prestige.count });
```

In `js/ui/hub.js`, listen:
```js
on('prestige', ({ nc, count }) => {
  renderHub();
  showNotification(`PRESTIGE #${count} — +${nc} NEURAL CREDITS`, 'var(--green)');
});
```

**Step 4: Add hover sound cue via CSS (optional — using clip-path animation instead)**

Add to `style.css` for game cards:
```css
.game-card:not(.locked)::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #00ffff08, transparent);
  opacity: 0;
  transition: opacity 0.2s;
}
.game-card:not(.locked):hover::before { opacity: 1; }
```

**Step 5: Final full-game test**

Run through the full loop:
1. Start server: `python -m http.server 8080`
2. Play 3+ paddle sessions — verify bits, TD, mastery accumulate
3. Open Upgrades — buy 2 upgrades, verify costs deduct
4. Open Automation — verify mastery bar and rate display
5. Earn 50k lifetime bits — verify Stage 2 + target unlock notification
6. Play target game — verify scoring + chain multiplier
7. Open Prestige — prestige and verify NC awarded, progress reset
8. Buy prestige upgrade — verify permanent effect
9. Save + reload — verify offline progress on next load
10. Export save, clear localStorage, import save — verify restore

**Step 6: Commit**

```bash
git add js/ui/hub.js js/prestige.js style.css
git commit -m "feat: stage unlock notifications, prestige notification, visual polish"
```

---

## Task 16: Update Memory File

After the game is playable, update Claude's memory with the new project details.

**Step 1: Update `C:\Users\Jacob\.claude\projects\C--Users-Jacob\memory\MEMORY.md`**

Add an entry under Projects:
```markdown
### arcade-idle
- **Path:** `C:\Users\Jacob\Projects\arcade-idle`
- **Stack:** Vanilla HTML5 + CSS3 + JavaScript ES Modules + Canvas API
- **Run:** `python -m http.server 8080` from project root
- **Status:** Phase 1+2 complete (Paddle + Target games, automation, prestige, save/load)
```

**Step 2: Final commit**

```bash
git add -A
git commit -m "chore: complete Phase 1+2 implementation"
```

---

## Quick Reference

| Command | Purpose |
|---|---|
| `python -m http.server 8080` | Start dev server |
| Open `http://localhost:8080` | View game |
| DevTools → Application → Local Storage | Inspect/clear save |

## File Count Summary

| Path | Purpose |
|---|---|
| `index.html` | Entry HTML |
| `style.css` | All styles (neon arcade theme) |
| `js/main.js` | Bootstrap |
| `js/state.js` | Global state + event bus |
| `js/save.js` | LocalStorage save/load |
| `js/loop.js` | Tick system |
| `js/automation.js` | Idle math |
| `js/upgrades.js` | Upgrade definitions |
| `js/prestige.js` | Prestige logic |
| `js/utils.js` | Helpers |
| `js/ui/hud.js` | Currency bar |
| `js/ui/hub.js` | Main screen |
| `js/ui/panel.js` | Panel open/close |
| `js/ui/upgrades-panel.js` | Upgrades UI |
| `js/ui/automation-panel.js` | Automation UI |
| `js/ui/prestige-panel.js` | Prestige UI |
| `js/ui/particles.js` | Particle FX |
| `js/games/launcher.js` | Game dispatcher |
| `js/games/base-game.js` | Session lifecycle |
| `js/games/paddle.js` | Paddle/Breakout |
| `js/games/target.js` | Aim/reflex game |
