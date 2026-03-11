# Per-Game Upgrades Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single flat UPGRADES panel with per-game upgrade buttons on each game card and a GLOBAL UPGRADES tab for cross-game upgrades.

**Architecture:** Add `getUpgradesForContext(context)` to upgrades.js; thread a context argument through `openPanel` and `initUpgradesPanel`; add an UPGRADES button inside each unlocked game card in hub.js.

**Tech Stack:** Vanilla JS ES Modules, no build step. Run via `python -m http.server 8080`.

---

## Reference Files

Skim before starting:
- `js/upgrades.js` — upgrade definitions, `getVisibleUpgrades()`
- `js/ui/panel.js` — `openPanel(name)`, title derivation
- `js/ui/upgrades-panel.js` — `initUpgradesPanel()`, renders upgrade cards
- `js/ui/hub.js` — `renderHub()`, `gameCard()`, hub-tabs wiring

---

## Task 1: Add `getUpgradesForContext` to upgrades.js

**Files:**
- Modify: `js/upgrades.js`

### Step 1: Add the helper after `getVisibleUpgrades`

Add this export immediately after the closing brace of `getVisibleUpgrades()` (after line 241):

```js
const GAME_IDS = ['paddle', 'target', 'circuit'];

/** Return upgrades relevant to a specific context.
 *  context: 'paddle' | 'target' | 'circuit' | 'global'
 */
export function getUpgradesForContext(context) {
  if (context === 'global') {
    return UPGRADES.filter(u => {
      if (GAME_IDS.some(id => u.id.startsWith(id + '_'))) return false;
      if (u.id === 'prestige_bonus' && state.stage < 2) return false;
      return true;
    });
  }
  return UPGRADES.filter(u => {
    if (!u.id.startsWith(context + '_')) return false;
    if (!state.games[context]?.unlocked) return false;
    return true;
  });
}
```

### Step 2: Manual verification

Open browser console and run:
```js
import('/js/upgrades.js').then(m => {
  console.log(m.getUpgradesForContext('paddle').map(u => u.id));
  console.log(m.getUpgradesForContext('global').map(u => u.id));
});
```
Expected: paddle array has `paddle_bit_mult`, `paddle_td_mult`, etc. Global has `auto_mult` and `prestige_bonus` (or just `auto_mult` if stage < 2).

### Step 3: Commit

```bash
git add js/upgrades.js
git commit -m "feat(upgrades): add getUpgradesForContext helper"
```

---

## Task 2: Thread context through panel.js and upgrades-panel.js

**Files:**
- Modify: `js/ui/panel.js`
- Modify: `js/ui/upgrades-panel.js`

### Step 1: Update panel.js — `openPanel(name, context)`

Replace the entire `openPanel` function with:

```js
export function openPanel(name, context) {
  const overlay = document.getElementById('panel-overlay');
  overlay.classList.remove('hidden');

  let title = name.toUpperCase();
  if (name === 'upgrades' && context) {
    title = context === 'global'
      ? 'GLOBAL UPGRADES'
      : `${context.toUpperCase()} UPGRADES`;
  }

  overlay.innerHTML = `
    <div class="side-panel" id="active-panel">
      <div class="panel-header">
        <span class="panel-title">${title}</span>
        <button class="panel-close" id="panel-close-btn">✕ CLOSE</button>
      </div>
      <div class="panel-body" id="panel-body"></div>
    </div>
  `;
  document.getElementById('panel-close-btn').addEventListener('click', closePanel);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closePanel();
  }, { once: true });

  panelInits[name]?.(context);
}
```

### Step 2: Update upgrades-panel.js — accept context

Replace the `initUpgradesPanel` function and its import line:

Change the import at the top from:
```js
import {
  getVisibleUpgrades, getUpgradeLevel, getUpgradeCost,
  canAfford, purchaseUpgrade
} from '../upgrades.js';
```
To:
```js
import {
  getUpgradesForContext, getUpgradeLevel, getUpgradeCost,
  canAfford, purchaseUpgrade
} from '../upgrades.js';
```

Replace `initUpgradesPanel` and `renderUpgradesPanel`:

```js
export function initUpgradesPanel(context = 'global') {
  renderUpgradesPanel(context);
  const refresh = () => renderUpgradesPanel(context);
  on('currency:change', refresh);
  on('upgrade:change',  refresh);
  observePanelClose(() => {
    off('currency:change', refresh);
    off('upgrade:change',  refresh);
  });
}

function renderUpgradesPanel(context) {
  const body = document.getElementById('panel-body');
  if (!body) return;

  const upgrades = getUpgradesForContext(context);
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
```

### Step 3: Manual verification

Open the game. Click UPGRADES tab — should still open (falls back to `'global'` context if context is undefined). Panel title should say "GLOBAL UPGRADES". Confirm `auto_mult` and `prestige_bonus` appear (prestige_bonus only if stage ≥ 2).

### Step 4: Commit

```bash
git add js/ui/panel.js js/ui/upgrades-panel.js
git commit -m "feat(upgrades): thread context through panel and upgrades-panel"
```

---

## Task 3: Add per-game upgrade buttons to hub.js

**Files:**
- Modify: `js/ui/hub.js`

### Step 1: Add UPGRADES button to `gameCard()`

Replace the `gameCard` function with:

```js
function gameCard(id, icon, label) {
  const g = state.games[id];
  const locked = !g.unlocked;
  const mastery = g.mastery.toFixed(1);
  const lockMessages = {
    target:  'REACH 50K BITS',
    circuit: 'REACH 200K BITS',
  };
  const lockMsg = lockMessages[id] ?? '';

  return `
    <div class="game-card ${locked ? 'locked' : ''}" data-game="${id}">
      <div class="card-icon">${icon}</div>
      <div class="card-title">${label}</div>
      ${locked
        ? `<div class="card-lock-msg">🔒 ${lockMsg}</div>`
        : `<div class="card-mastery">MASTERY ${mastery}%</div>
           <button class="card-upgrades-btn" data-game="${id}">UPGRADES</button>`
      }
    </div>
  `;
}
```

### Step 2: Update hub-tabs — rename UPGRADES to GLOBAL UPGRADES, add context attribute

In `renderHub()`, find the hub-tabs div and change the upgrades button:

From:
```js
<button class="hub-tab" data-panel="upgrades">UPGRADES</button>
```
To:
```js
<button class="hub-tab" data-panel="upgrades" data-panel-context="global">GLOBAL UPGRADES</button>
```

### Step 3: Wire up both button types in `renderHub()`

Find the existing hub-tab event listener:
```js
hub.querySelectorAll('.hub-tab').forEach(tab => {
  tab.addEventListener('click', () => openPanel(tab.dataset.panel));
});
```

Replace it with:
```js
hub.querySelectorAll('.hub-tab[data-panel]').forEach(tab => {
  tab.addEventListener('click', () => openPanel(tab.dataset.panel, tab.dataset.panelContext));
});
```

Then add the card upgrade button wiring immediately after (before the save/export/import/clear button wiring):
```js
hub.querySelectorAll('.card-upgrades-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation(); // prevent card click from also launching the game
    openPanel('upgrades', btn.dataset.game);
  });
});
```

### Step 4: Add CSS for `card-upgrades-btn`

Open `style.css`. Find the `.game-card` rules and add after them:

```css
.card-upgrades-btn {
  margin-top: 8px;
  padding: 4px 10px;
  font-family: var(--font);
  font-size: 0.6rem;
  letter-spacing: 1.5px;
  color: var(--cyan);
  background: none;
  border: 1px solid var(--cyan);
  border-radius: 3px;
  cursor: pointer;
  opacity: 0.75;
  transition: opacity 0.15s ease, box-shadow 0.15s ease;
}
.card-upgrades-btn:hover {
  opacity: 1;
  box-shadow: 0 0 6px var(--cyan)44;
}
```

### Step 5: Manual verification

- Reload the game
- PADDLE card should show an UPGRADES button (unlocked from start)
- Clicking the UPGRADES button opens panel titled "PADDLE UPGRADES" showing only paddle upgrades
- Clicking the PADDLE card body still launches the paddle game (not the upgrades panel)
- TARGET and CIRCUIT cards show no UPGRADES button while locked
- After unlocking TARGET (50k bits) or testing via DevTools: `state.games.target.unlocked = true; renderHub?.()`, the TARGET card should show an UPGRADES button
- Hub tabs row shows "GLOBAL UPGRADES" — clicking it opens panel with `auto_mult` and `prestige_bonus`

### Step 6: Commit

```bash
git add js/ui/hub.js style.css
git commit -m "feat(hub): per-game upgrade buttons on game cards, global upgrades tab"
```

---

## Final Verification Checklist

- [ ] Unlocked game cards show UPGRADES button; locked cards do not
- [ ] Clicking a card body launches the game; clicking UPGRADES button opens the filtered panel
- [ ] PADDLE UPGRADES panel shows only `paddle_*` upgrades (6 total)
- [ ] TARGET UPGRADES panel shows only `target_*` upgrades (2 total, visible only when unlocked)
- [ ] CIRCUIT UPGRADES panel shows only `circuit_*` upgrades (6 total, visible only when unlocked)
- [ ] GLOBAL UPGRADES panel shows `auto_mult` and `prestige_bonus` (prestige_bonus gated by stage ≥ 2)
- [ ] Currency/upgrade reactivity still works — purchasing updates the panel in real-time
- [ ] Panel title matches the context (e.g. "PADDLE UPGRADES", "GLOBAL UPGRADES")
