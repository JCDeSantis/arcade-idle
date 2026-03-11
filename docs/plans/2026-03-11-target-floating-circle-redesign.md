# Target Floating Circle Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the turret+projectile mechanic with a floating circle (the player) that chases the mouse with lag and registers hits on click when overlapping a target.

**Architecture:** A `player` object tracks the mouse via smooth dt-based lerp each frame. No projectiles — clicking checks circle-vs-circle overlap between the player and every target. Targets spawn/shrink as before. Two upgrades: tracking speed (already exists) and cursor size (new).

**Tech Stack:** Vanilla JS ES Modules, Canvas 2D API, no build step.

---

### Task 1: Add `target_cursor_size` upgrade

**Files:**
- Modify: `js/upgrades.js` — insert after `target_tracking_speed`

**Step 1: Locate the `target_tracking_speed` entry**

It should be around line 67–77. Find its closing `},`.

**Step 2: Insert new upgrade immediately after it (before `// ── Global upgrades`)**

```js
  {
    id: 'target_cursor_size',
    name: 'Wide Lens',
    desc: 'Cursor circle +5px radius per level',
    icon: '🔍',
    currency: 'bits',
    baseCost: 150,
    costScale: 2.0,
    maxLevel: 5,
    effect: lvl => lvl * 5,  // added px (not a multiplier)
  },
```

**Step 3: Verify**

Read the file back and confirm placement is correct — after `target_tracking_speed`, before the Global upgrades comment.

**Step 4: Commit**

```bash
cd C:/Users/Jacob/Projects/arcade-idle
git add js/upgrades.js
git commit -m "feat: add target_cursor_size upgrade"
```

---

### Task 2: Rewrite `js/games/target.js` — floating circle mechanic

**Files:**
- Replace: `js/games/target.js` entirely

**Replace the entire file with:**

```js
// js/games/target.js — floating circle target game

import { submitResult, showResults } from './base-game.js';
import { getUpgradeValue } from '../upgrades.js';

const CANVAS_W = 480;
const CANVAS_H = 420;
const SESSION_SECS = 30;

// Player circle
const BASE_PLAYER_R    = 20;   // px
const BASE_TRACK_SPEED = 4;    // lerp speed (higher = snappier)

// Targets
const MIN_SPAWN_INTERVAL = 0.6;
const MAX_SPAWN_INTERVAL = 1.4;
const TARGET_LIFETIME    = 2.5;
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
  let animId = null;
  let lastTs = null;

  let mouseX = CANVAS_W / 2;
  let mouseY = CANVAS_H / 2;

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });

  canvas.addEventListener('click', () => {
    tryHit(game);
  });

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

    update(game, dt, mouseX, mouseY);
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
    // Player circle position (starts at canvas center)
    px: CANVAS_W / 2,
    py: CANVAS_H / 2,
  };
}

function update(g, dt, mx, my) {
  // Smooth lerp toward mouse
  const trackSpeed = BASE_TRACK_SPEED + getUpgradeValue('target_tracking_speed');
  const factor = Math.min(trackSpeed * dt, 1);
  g.px += (mx - g.px) * factor;
  g.py += (my - g.py) * factor;

  // Chain timeout
  if (g.chain > 0) {
    g.chainTime += dt;
    if (g.chainTime > 1.5) { g.chain = 0; g.chainTime = 0; }
  }

  // Spawn targets
  g.nextSpawn -= dt;
  if (g.nextSpawn <= 0) {
    g.targets.push(spawnTarget());
    g.nextSpawn = randBetween(MIN_SPAWN_INTERVAL, MAX_SPAWN_INTERVAL);
  }

  // Age + shrink targets
  for (const t of g.targets) {
    t.age += dt;
    t.r = TARGET_MAX_R * Math.max(0, 1 - t.age / TARGET_LIFETIME);
  }

  // Remove expired targets (chain breaks)
  const before = g.targets.length;
  g.targets = g.targets.filter(t => t.r > TARGET_MIN_R);
  if (g.targets.length < before) { g.chain = 0; g.chainTime = 0; }
}

function tryHit(g) {
  const pr = BASE_PLAYER_R + getUpgradeValue('target_cursor_size');
  for (let i = g.targets.length - 1; i >= 0; i--) {
    const t = g.targets[i];
    const dx = g.px - t.x, dy = g.py - t.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < pr + t.r) {
      const sizeFrac = t.r / TARGET_MAX_R;
      g.chain++;
      g.chainTime = 0;
      g.score += Math.floor(100 * sizeFrac * Math.ceil(g.chain / 3));
      g.targets.splice(i, 1);
      return; // one hit per click
    }
  }
}

function render(ctx, g) {
  const pr = BASE_PLAYER_R + getUpgradeValue('target_cursor_size');

  // Background
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

  // Targets
  for (const t of g.targets) {
    const alpha = t.r / TARGET_MAX_R;
    const color = `rgba(255, 0, 255, ${alpha.toFixed(2)})`;

    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    const cs = t.r * 0.5;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(t.x - cs, t.y); ctx.lineTo(t.x + cs, t.y);
    ctx.moveTo(t.x, t.y - cs); ctx.lineTo(t.x, t.y + cs);
    ctx.stroke();
  }

  // Player circle
  ctx.beginPath();
  ctx.arc(g.px, g.py, pr, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 255, 255, 0.10)';
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 16;
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Crosshair inside player circle
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(g.px - pr * 0.6, g.py); ctx.lineTo(g.px + pr * 0.6, g.py);
  ctx.moveTo(g.px, g.py - pr * 0.6); ctx.lineTo(g.px, g.py + pr * 0.6);
  ctx.stroke();
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

**Step 3: Verify**

Read the file back and confirm:
- `launchTarget(onExit)` is the only export
- `tryHit` uses circle-overlap detection (`dist < pr + t.r`)
- `update` uses `factor = Math.min(trackSpeed * dt, 1)` for lerp
- `getUpgradeValue('target_cursor_size')` used in both `tryHit` and `render`
- `projectiles` array is gone entirely
- No `fireProjectile` or barrel rendering

**Step 4: Commit**

```bash
cd C:/Users/Jacob/Projects/arcade-idle
git add js/games/target.js
git commit -m "feat(target): floating circle mechanic, click-to-hit on overlap"
```

---

### Task 3: Push to GitHub

```bash
cd C:/Users/Jacob/Projects/arcade-idle
git push
```
