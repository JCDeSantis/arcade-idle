# Target Turret Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the click-on-targets mechanic with a center-fixed turret that rotates toward the mouse with angular lag and fires projectiles on click.

**Architecture:** A `turret` object at canvas center lerps `currentAngle` toward the mouse angle at `trackSpeed` rad/sec each frame. Clicking fires a projectile along `currentAngle`. Projectiles travel in a straight line; hit detection against target circles removes targets and scores points. Targets spawn/shrink exactly as before.

**Tech Stack:** Vanilla JS ES Modules, Canvas 2D API, no build step. Run with `python -m http.server 8080` and open `http://localhost:8080`.

---

### Task 1: Add `target_tracking_speed` upgrade

**Files:**
- Modify: `js/upgrades.js` (after line ~66, in the Target upgrades section)

**Context:**
`js/upgrades.js` exports an `UPGRADES` array of upgrade definition objects. Each has `id`, `name`, `desc`, `icon`, `currency`, `baseCost`, `costScale`, `maxLevel`, and `effect(lvl) -> number`. The `target_*` prefix causes it to appear in the Target upgrades panel automatically via `getUpgradesForContext`.

**Step 1: Open `js/upgrades.js` and locate the Target upgrades block**

It starts around line 44 with the comment `// ── Target upgrades`. There are two entries: `target_bit_mult` and `target_td_mult`.

**Step 2: Add the new upgrade object after `target_td_mult`**

Insert this object between the last target upgrade and the `// ── Global upgrades` comment:

```js
  {
    id: 'target_tracking_speed',
    name: 'Targeting Core',
    desc: 'Turret tracks mouse +0.5 rad/sec faster per level',
    icon: '🎯',
    currency: 'bits',
    baseCost: 250,
    costScale: 2.5,
    maxLevel: 5,
    effect: lvl => lvl * 0.5,  // added rad/sec (not a multiplier)
  },
```

**Step 3: Verify in browser**

1. `python -m http.server 8080` (if not already running)
2. Open `http://localhost:8080`, hard-refresh (`Ctrl+Shift+R`)
3. Unlock and open the Target game's UPGRADES panel
4. Confirm "Targeting Core" appears with icon 🎯 and cost 250 B

**Step 4: Commit**

```bash
cd C:/Users/Jacob/Projects/arcade-idle
git add js/upgrades.js
git commit -m "feat: add target_tracking_speed upgrade"
```

---

### Task 2: Rewrite `js/games/target.js` — turret + projectile mechanic

**Files:**
- Replace: `js/games/target.js` entirely

**Context:**
The existing file exports one function `launchTarget(onExit)` which creates an overlay (`createOverlay`), runs a `requestAnimationFrame` loop, and calls `submitResult`/`showResults` from `base-game.js` at the end. This structure must be preserved. The upgrade system is accessed via `getUpgradeValue('target_tracking_speed')` from `js/upgrades.js`.

The `base-game.js` import path is `'./base-game.js'`. The upgrades import path is `'../upgrades.js'`.

**Step 1: Write the new `js/games/target.js`**

Replace the entire file with:

```js
// js/games/target.js — turret + projectile target game

import { submitResult, showResults } from './base-game.js';
import { getUpgradeValue } from '../upgrades.js';

const CANVAS_W = 480;
const CANVAS_H = 420;
const SESSION_SECS = 30;

// Turret
const TURRET_X = CANVAS_W / 2;
const TURRET_Y = CANVAS_H / 2;
const TURRET_R  = 18;
const BARREL_LEN = 28;
const BASE_TRACK_SPEED = 1.5;  // rad/sec

// Projectiles
const PROJECTILE_SPEED = 400;  // px/sec
const PROJECTILE_R = 4;

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

  // Track mouse relative to canvas
  let mouseX = TURRET_X;
  let mouseY = TURRET_Y - BARREL_LEN;
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });

  canvas.addEventListener('click', () => {
    firePr ojectile(game);
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
    projectiles: [],
    nextSpawn: randBetween(0.3, 0.8),
    turretAngle: -Math.PI / 2,  // start pointing up
  };
}

function update(g, dt, mx, my) {
  // Turret tracking
  const targetAngle = Math.atan2(my - TURRET_Y, mx - TURRET_X);
  const trackSpeed  = BASE_TRACK_SPEED + getUpgradeValue('target_tracking_speed');
  let diff = targetAngle - g.turretAngle;
  // Normalize to [-π, π]
  while (diff >  Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const step = trackSpeed * dt;
  g.turretAngle += Math.abs(diff) < step ? diff : Math.sign(diff) * step;

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

  // Age targets
  for (const t of g.targets) {
    t.age += dt;
    t.r = TARGET_MAX_R * Math.max(0, 1 - t.age / TARGET_LIFETIME);
  }

  // Move projectiles
  for (const p of g.projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  // Hit detection: projectile vs target
  for (let pi = g.projectiles.length - 1; pi >= 0; pi--) {
    const p = g.projectiles[pi];
    for (let ti = g.targets.length - 1; ti >= 0; ti--) {
      const t = g.targets[ti];
      const dx = p.x - t.x, dy = p.y - t.y;
      if (dx * dx + dy * dy <= t.r * t.r) {
        const sizeFrac = t.r / TARGET_MAX_R;
        g.chain++;
        g.chainTime = 0;
        g.score += Math.floor(100 * sizeFrac * Math.ceil(g.chain / 3));
        g.targets.splice(ti, 1);
        g.projectiles.splice(pi, 1);
        break;
      }
    }
  }

  // Remove expired targets (chain breaks)
  const before = g.targets.length;
  g.targets = g.targets.filter(t => t.r > TARGET_MIN_R);
  if (g.targets.length < before) { g.chain = 0; g.chainTime = 0; }

  // Remove off-canvas projectiles
  g.projectiles = g.projectiles.filter(p =>
    p.x >= 0 && p.x <= CANVAS_W && p.y >= 0 && p.y <= CANVAS_H
  );
}

function fireProjectile(g) {
  g.projectiles.push({
    x:  TURRET_X,
    y:  TURRET_Y,
    vx: Math.cos(g.turretAngle) * PROJECTILE_SPEED,
    vy: Math.sin(g.turretAngle) * PROJECTILE_SPEED,
  });
}

function render(ctx, g) {
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

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    const cs = t.r * 0.5;
    ctx.beginPath();
    ctx.moveTo(t.x - cs, t.y); ctx.lineTo(t.x + cs, t.y);
    ctx.moveTo(t.x, t.y - cs); ctx.lineTo(t.x, t.y + cs);
    ctx.stroke();
  }

  // Projectiles
  for (const p of g.projectiles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, PROJECTILE_R, 0, Math.PI * 2);
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Turret body
  ctx.beginPath();
  ctx.arc(TURRET_X, TURRET_Y, TURRET_R, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 255, 255, 0.15)';
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 16;
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Barrel
  const bx = TURRET_X + Math.cos(g.turretAngle) * (TURRET_R + BARREL_LEN);
  const by = TURRET_Y + Math.sin(g.turretAngle) * (TURRET_R + BARREL_LEN);
  ctx.beginPath();
  ctx.moveTo(TURRET_X, TURRET_Y);
  ctx.lineTo(bx, by);
  ctx.strokeStyle = '#ff00ff';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ff00ff';
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;
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

**NOTE:** There is a deliberate typo on the `firePr ojectile` call inside the `click` listener — fix it to `fireProjectile` when writing the file. It's in the plan as a reminder to catch it.

**Step 2: Verify in browser**

1. Hard-refresh (`Ctrl+Shift+R`)
2. Launch Target game
3. Confirm:
   - Turret renders as cyan circle with magenta barrel at canvas center
   - Barrel rotates toward mouse (with slight lag)
   - Clicking fires a cyan projectile that travels in the barrel's direction
   - Projectiles disappear off-screen
   - Hitting a target removes it and increments score
   - Expired targets reset the chain
   - Timer counts down 30s, results screen appears at end

**Step 3: Verify upgrade works**

1. Open Target UPGRADES panel, buy "Targeting Core" if affordable (or use browser console to set currency: `state.currencies.bits = 999999` in `js/state.js` is not accessible from console — instead temporarily lower `baseCost` to 1 in upgrades.js to test)
2. Confirm turret tracks noticeably faster after purchasing

**Step 4: Commit**

```bash
cd C:/Users/Jacob/Projects/arcade-idle
git add js/games/target.js
git commit -m "feat: turret + projectile mechanic for Target game"
```

---

### Task 3: Push to GitHub

**Step 1: Push**

```bash
cd C:/Users/Jacob/Projects/arcade-idle
git push
```

**Step 2: Verify at `https://github.com/JCDeSantis/arcade-idle`** that the two new commits appear.
