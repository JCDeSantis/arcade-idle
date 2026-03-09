# Paddle Upgrades, Power-ups & Collision Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 3 permanent stat upgrades, 8 in-session power-up drops, and fix paddle side + block tunneling collisions in the breakout mini-game.

**Architecture:** Extract power-up type definitions, drop/fall/catch/effect logic, and rendering into `js/games/powerups.js`. `paddle.js` imports it and drives it from the game loop. Ball state is refactored from a single object to a `game.balls[]` array to support Multi-ball. The 3 new permanent upgrades are wired at `initGame()` via `getUpgradeValue()`.

**Tech Stack:** Vanilla JS ES Modules, Canvas 2D API, no build step. Run with `python -m http.server 8080`. Open `http://localhost:8080` to verify.

---

## Reference

Design doc: `docs/plans/2026-03-08-paddle-upgrades-powerups-design.md`

Key files:
- `js/upgrades.js` — upgrade definitions array
- `js/games/paddle.js` — full game loop, ~270 lines currently
- `js/games/powerups.js` — **create new**
- `js/games/base-game.js` — submitResult / showResults (don't touch)

Constants in paddle.js to know:
- `CANVAS_W = 480`, `CANVAS_H = 420`, `SESSION_SECS = 45`
- `BLOCK_H = 18`, `BLOCK_PAD = 4`
- Ball base speed: `vx: 220`, `vy: -220`
- Paddle: `paddleW: 80`, `paddleY: CANVAS_H - 28` (= 392), paddle height = 12px

---

## Task 1: Add 3 Permanent Upgrades to upgrades.js

**Files:**
- Modify: `js/upgrades.js`

**Step 1: Open upgrades.js and locate the end of the UPGRADES array**

The array ends just before `export function getUpgradeDef`. Add 3 entries after `prestige_bonus`:

```js
  // ── Paddle gameplay upgrades ──────────────────────────
  {
    id: 'paddle_ball_speed',
    name: 'Velocity Core',
    desc: 'Paddle ball moves +15% faster per level',
    icon: '💨',
    currency: 'bits',
    baseCost: 300,
    costScale: 2.8,
    maxLevel: 5,
    effect: lvl => 1 + lvl * 0.15,
  },
  {
    id: 'paddle_size',
    name: 'Paddle Expander',
    desc: 'Paddle is +15% wider per level',
    icon: '↔',
    currency: 'bits',
    baseCost: 200,
    costScale: 2.5,
    maxLevel: 5,
    effect: lvl => 1 + lvl * 0.15,
  },
  {
    id: 'paddle_powerup_chance',
    name: 'Loot Matrix',
    desc: '+8% power-up drop chance per level (max 40%)',
    icon: '🎁',
    currency: 'trainingData',
    baseCost: 30,
    costScale: 2.2,
    maxLevel: 5,
    effect: lvl => Math.min(lvl * 0.08, 0.40),
  },
```

**Step 2: Verify in browser**

Open `http://localhost:8080`, click UPGRADES panel. Scroll down — you should see "Velocity Core", "Paddle Expander", and "Loot Matrix" cards appear. They will be greyed out if you can't afford them. The Prestige tab visibility and existing upgrades should be unaffected.

**Step 3: Commit**

```bash
cd C:/Users/Jacob/Projects/arcade-idle
git add js/upgrades.js
git commit -m "feat: add paddle_ball_speed, paddle_size, paddle_powerup_chance upgrades"
```

---

## Task 2: Create js/games/powerups.js — Type Definitions & Spawn

**Files:**
- Create: `js/games/powerups.js`

**Step 1: Create the file with POWERUP_DEFS and spawnPowerup**

```js
// js/games/powerups.js — power-up type definitions, drop system, effects, rendering

export const POWERUP_DEFS = [
  { id: 'multi_ball',  label: 'MULTI',   icon: '⚡', color: '#e89830', duration:  0  },
  { id: 'slow_mo',     label: 'SLOW',    icon: '🌀', color: '#38d4d4', duration:  8  },
  { id: 'fireball',    label: 'FIRE',    icon: '🔥', color: '#e04848', duration:  5  },
  { id: 'wide_paddle', label: 'WIDE',    icon: '↔',  color: '#3ecb7c', duration: 10  },
  { id: 'sticky',      label: 'STICKY',  icon: '🔒', color: '#e04ca0', duration: -1  }, // -1 = until released
  { id: 'shield',      label: 'SHIELD',  icon: '🛡', color: '#4488ff', duration: -2  }, // -2 = until used
  { id: 'score_mult',  label: '2×',      icon: '★',  color: '#e89830', duration: 10  },
  { id: 'row_clear',   label: 'CLEAR',   icon: '💥', color: '#e04848', duration:  0  },
];

const DROP_SPEED = 120; // px/s
const CAPSULE_W  = 32;
const CAPSULE_H  = 14;

/**
 * Create a falling capsule at the center of the broken block.
 * @param {object} block  — { x, y, w, h }
 * @returns capsule object to push into game.drops[]
 */
export function spawnPowerup(block) {
  const def = POWERUP_DEFS[Math.floor(Math.random() * POWERUP_DEFS.length)];
  return {
    def,
    x: block.x + block.w / 2,
    y: block.y + block.h / 2,
  };
}
```

**Step 2: Verify file loads**

In `paddle.js` (temporarily) add at the very top:
```js
import { POWERUP_DEFS } from './powerups.js';
console.log('[powerups] loaded', POWERUP_DEFS.length, 'types');
```
Open browser console — you should see `[powerups] loaded 8 types`. Remove the `console.log` after confirming.

**Step 3: Commit**

```bash
git add js/games/powerups.js
git commit -m "feat(powerups): add POWERUP_DEFS and spawnPowerup"
```

---

## Task 3: powerups.js — updatePowerups & catchPowerup

**Files:**
- Modify: `js/games/powerups.js`

**Step 1: Add updatePowerups function**

Append to `powerups.js`:

```js
/**
 * Tick all falling drops and all active timed effects.
 * Mutates game.drops, game.activeEffects in place.
 * @param {object} game  — full game state
 * @param {number} dt    — delta time in seconds
 * @param {number} CANVAS_H
 */
export function updatePowerups(game, dt, CANVAS_H) {
  // Move drops downward; collect caught or expired
  const caught = [];
  game.drops = game.drops.filter(drop => {
    drop.y += DROP_SPEED * dt;
    if (drop.y > CANVAS_H + CAPSULE_H) return false; // fell off screen

    // Check paddle catch — simple AABB of capsule vs paddle
    const px = game.paddleX, pw = game.effectivePaddleW ?? game.paddleW;
    const py = game.paddleY;
    if (
      drop.x + CAPSULE_W / 2 > px &&
      drop.x - CAPSULE_W / 2 < px + pw &&
      drop.y + CAPSULE_H / 2 > py &&
      drop.y - CAPSULE_H / 2 < py + 12
    ) {
      caught.push(drop);
      return false;
    }
    return true;
  });

  caught.forEach(drop => catchPowerup(game, drop));

  // Tick timed active effects
  for (const id of Object.keys(game.activeEffects)) {
    const t = game.activeEffects[id];
    if (t > 0) {
      game.activeEffects[id] = t - dt;
      if (game.activeEffects[id] <= 0) delete game.activeEffects[id];
    }
    // Negative values (sticky=-1, shield=-2) are managed elsewhere
  }
}
```

**Step 2: Add catchPowerup function**

Append to `powerups.js`:

```js
/**
 * Apply the effect of a caught power-up capsule to game state.
 */
export function catchPowerup(game, drop) {
  const { id, duration } = drop.def;

  switch (id) {
    case 'multi_ball': {
      // Clone each existing ball with mirrored vx
      const newBalls = game.balls.map(b => ({
        ...b,
        vx: -b.vx + (Math.random() - 0.5) * 40,
      }));
      game.balls.push(...newBalls);
      break;
    }
    case 'slow_mo':
      game.activeEffects.slow_mo = duration;
      break;
    case 'fireball':
      game.activeEffects.fireball = duration;
      break;
    case 'wide_paddle':
      game.activeEffects.wide_paddle = duration;
      break;
    case 'sticky':
      // Attach first ball to paddle
      if (game.balls.length > 0) {
        const b = game.balls[0];
        game.stickyBall = { ball: b, offsetX: b.x - (game.paddleX + game.effectivePaddleW / 2) };
        b.vx = 0; b.vy = 0;
      }
      break;
    case 'shield':
      game.shieldActive = true;
      break;
    case 'score_mult':
      game.activeEffects.score_mult = duration;
      break;
    case 'row_clear': {
      if (game.blocks.length === 0) break;
      const maxY = Math.max(...game.blocks.map(bl => bl.y));
      game.blocks = game.blocks.filter(bl => bl.y < maxY);
      break;
    }
  }
}
```

**Step 3: Commit**

```bash
git add js/games/powerups.js
git commit -m "feat(powerups): add updatePowerups and catchPowerup"
```

---

## Task 4: powerups.js — renderPowerups

**Files:**
- Modify: `js/games/powerups.js`

**Step 1: Add renderPowerups function**

Append to `powerups.js`:

```js
/**
 * Draw falling capsules and the active-effects HUD strip.
 */
export function renderPowerups(ctx, game) {
  // Draw falling capsules
  for (const drop of game.drops) {
    const { color, icon } = drop.def;
    const x = drop.x - CAPSULE_W / 2;
    const y = drop.y - CAPSULE_H / 2;

    ctx.save();
    ctx.shadowColor  = color;
    ctx.shadowBlur   = 8;
    ctx.strokeStyle  = color;
    ctx.lineWidth    = 1.5;
    ctx.fillStyle    = color + '33';
    _roundRect(ctx, x, y, CAPSULE_W, CAPSULE_H, 4);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle  = '#ffffff';
    ctx.font       = '10px "Space Mono", monospace';
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, drop.x, drop.y);
    ctx.restore();
  }

  // Active effects HUD strip — just above the paddle
  const hudY = game.paddleY - 20;
  let hudX   = 8;
  const ae   = game.activeEffects;

  for (const def of POWERUP_DEFS) {
    const t = ae[def.id];
    if (!t || t <= 0) continue; // skip instant / inactive

    ctx.save();
    ctx.fillStyle    = def.color + '22';
    ctx.strokeStyle  = def.color;
    ctx.lineWidth    = 1;
    ctx.shadowColor  = def.color;
    ctx.shadowBlur   = 4;
    _roundRect(ctx, hudX, hudY - 10, 42, 14, 3);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle    = def.color;
    ctx.font         = '9px "Space Mono", monospace';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${def.icon} ${t.toFixed(0)}s`, hudX + 3, hudY - 3);
    ctx.restore();

    hudX += 48;
  }

  // Shield indicator: glowing line at bottom of canvas
  if (game.shieldActive) {
    ctx.save();
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#4488ff';
    ctx.shadowBlur  = 10;
    ctx.beginPath();
    ctx.moveTo(0, game.paddleY + 18);
    ctx.lineTo(480, game.paddleY + 18); // CANVAS_W
    ctx.stroke();
    ctx.restore();
  }
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
```

**Step 2: Commit**

```bash
git add js/games/powerups.js
git commit -m "feat(powerups): add renderPowerups with capsule and HUD strip drawing"
```

---

## Task 5: paddle.js — Refactor ball → balls array

**Files:**
- Modify: `js/games/paddle.js`

This is the structural refactor. Do it carefully — the rest of the tasks build on top of it.

**Step 1: Update initGame() to return balls array**

In `initGame()`, replace:
```js
    ball: {
      x: CANVAS_W / 2,
      y: CANVAS_H / 2,
      r: 7,
      vx: 220 * (Math.random() > 0.5 ? 1 : -1),
      vy: -220,
    },
```
With:
```js
    balls: [{
      x: CANVAS_W / 2,
      y: CANVAS_H / 2,
      r: 7,
      vx: 220 * (Math.random() > 0.5 ? 1 : -1),
      vy: -220,
    }],
    drops: [],
    activeEffects: {},
    shieldActive: false,
    stickyBall: null,
    dropChance: 0,      // set in Task 6
    effectivePaddleW: 80, // set in Task 6
```

**Step 2: Refactor update() to iterate game.balls**

Replace the entire physics section. The new `update(g, dt)` iterates each ball independently. Replace the block starting at `function update(g, dt)` with:

```js
function update(g, dt) {
  const SPEED_SCALE = (1 + g.elapsed / SESSION_SECS * 0.6)
    * (g.activeEffects.slow_mo > 0 ? 0.5 : 1);

  // Compute effective paddle width (wide_paddle effect applied here)
  g.effectivePaddleW = g.paddleW * (g.activeEffects.wide_paddle > 0 ? 1.5 : 1);

  // Keyboard paddle movement
  const spd = 400 * dt;
  const pw  = g.effectivePaddleW;
  if (g._keys['ArrowLeft']  || g._keys['a'] || g._keys['A'])
    g.paddleX = clamp(g.paddleX - spd, 0, CANVAS_W - pw);
  if (g._keys['ArrowRight'] || g._keys['d'] || g._keys['D'])
    g.paddleX = clamp(g.paddleX + spd, 0, CANVAS_W - pw);

  // Sticky: lock attached ball to paddle
  if (g.stickyBall) {
    const { ball, offsetX } = g.stickyBall;
    ball.x = g.paddleX + pw / 2 + offsetX;
    ball.y = g.paddleY - ball.r;
  }

  // Update each ball
  const survivingBalls = [];
  for (const b of g.balls) {
    updateBall(g, b, dt, SPEED_SCALE);
    const lost = b.y - b.r > CANVAS_H;
    if (lost) {
      // Shield catches it
      if (g.shieldActive) {
        g.shieldActive = false;
        b.y = g.paddleY - b.r;
        b.vy = -Math.abs(b.vy);
        survivingBalls.push(b);
      } else {
        // Release sticky if this was the sticky ball
        if (g.stickyBall?.ball === b) g.stickyBall = null;
        // Don't push — ball is lost
      }
    } else {
      survivingBalls.push(b);
    }
  }

  // If all balls lost: penalty + respawn
  if (survivingBalls.length === 0) {
    g.score = Math.max(0, g.score - 50);
    g.combo = 0;
    survivingBalls.push({
      x: CANVAS_W / 2, y: CANVAS_H / 2, r: 7,
      vx: 220 * (Math.random() > 0.5 ? 1 : -1),
      vy: -220,
    });
  }
  g.balls = survivingBalls;
}
```

**Step 3: Add updateBall() helper**

Add this function after `update()`:

```js
function updateBall(g, b, dt, SPEED_SCALE) {
  // Sub-step if fast enough to tunnel through a block
  const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  const steps = (speed * dt * SPEED_SCALE > BLOCK_H / 2) ? 2 : 1;
  const subDt  = dt / steps;

  for (let s = 0; s < steps; s++) {
    const prevX = b.x;
    const prevY = b.y;

    b.x += b.vx * subDt * SPEED_SCALE;
    b.y += b.vy * subDt * SPEED_SCALE;

    // Wall bounce
    if (b.x - b.r < 0)        { b.x = b.r;            b.vx =  Math.abs(b.vx); }
    if (b.x + b.r > CANVAS_W) { b.x = CANVAS_W - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y - b.r < 0)        { b.y = b.r;             b.vy =  Math.abs(b.vy); }

    // Paddle collision
    const px  = g.paddleX;
    const pw  = g.effectivePaddleW;
    const py  = g.paddleY;
    const pH  = 12; // paddle height

    // Top surface
    if (
      b.vy > 0 &&
      prevY + b.r < py && b.y + b.r >= py &&
      b.x >= px && b.x <= px + pw
    ) {
      b.y  = py - b.r;
      b.vy = -Math.abs(b.vy);
      const hitFrac = (b.x - px) / pw;
      b.vx = (hitFrac - 0.5) * 400 + (Math.random() - 0.5) * 40;

      // Sticky
      if (g.stickyBall === null && g.activeEffects.sticky !== undefined) {
        // sticky is managed via stickyBall object, not activeEffects timer
      }
    }

    // Left side of paddle
    if (
      b.vx > 0 &&
      prevX + b.r <= px && b.x + b.r > px &&
      b.y + b.r > py && b.y - b.r < py + pH
    ) {
      b.x  = px - b.r;
      b.vx = -Math.abs(b.vx);
    }

    // Right side of paddle
    if (
      b.vx < 0 &&
      prevX - b.r >= px + pw && b.x - b.r < px + pw &&
      b.y + b.r > py && b.y - b.r < py + pH
    ) {
      b.x  = px + pw + b.r;
      b.vx = Math.abs(b.vx);
    }

    // Block collisions
    for (const block of g.blocks) {
      if (!circleRect(b, block)) continue;

      g.combo++;
      const multiplier = g.activeEffects.score_mult > 0 ? 2 : 1;
      const pts = block.points * Math.ceil(g.combo / 3) * multiplier;
      g.score += pts;
      g.blocks = g.blocks.filter(bl => bl !== block);

      // Spawn power-up drop
      if (Math.random() < g.dropChance) {
        g.drops.push(spawnPowerup(block));
      }

      // Fireball: pass through without bouncing
      if (!(g.activeEffects.fireball > 0)) {
        const overlapX = Math.min(b.x - block.x, (block.x + block.w) - b.x);
        const overlapY = Math.min(b.y - block.y, (block.y + block.h) - b.y);
        if (overlapX < overlapY) b.vx = -b.vx;
        else                     b.vy = -b.vy;
      }
      break; // one block per sub-step
    }
  }
}
```

**Note:** `spawnPowerup` is imported from powerups.js — add the import at the top of paddle.js (Task 9).

**Step 4: Update render() to draw each ball in game.balls**

In `render(ctx, g)`, replace the single ball drawing section:
```js
  // Ball
  const b = g.ball;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.shadowBlur = 0;
```
With:
```js
  // Balls
  for (const b of g.balls) {
    const isFireball = g.activeEffects.fireball > 0;
    const isSticky   = g.stickyBall?.ball === b;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle   = isFireball ? '#ff6600' : '#ffffff';
    ctx.shadowColor = isFireball ? '#ff4400' : '#38d4d4';
    ctx.shadowBlur  = isFireball ? 20 : 14;
    ctx.fill();
    ctx.shadowBlur  = 0;

    // Sticky tether line
    if (isSticky) {
      ctx.strokeStyle = '#e04ca0';
      ctx.lineWidth   = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + b.r);
      ctx.lineTo(b.x, g.paddleY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
```

**Step 5: Verify in browser**

Open the game. Play a session — the paddle game should work exactly as before (single ball, no power-ups yet). Confirm no console errors.

**Step 6: Commit**

```bash
git add js/games/paddle.js
git commit -m "refactor(paddle): ball → balls array, add sub-step collision, paddle side collision"
```

---

## Task 6: paddle.js — Integrate Upgrade Values at initGame

**Files:**
- Modify: `js/games/paddle.js`

**Step 1: Add import at top of paddle.js**

```js
import { getUpgradeValue } from '../upgrades.js';
```

**Step 2: Update initGame() to read upgrade values**

At the top of `initGame()`, before building the return object, add:

```js
function initGame() {
  const ballSpeedMult  = getUpgradeValue('paddle_ball_speed');   // 1.0 at lvl 0
  const paddleSizeMult = getUpgradeValue('paddle_size');         // 1.0 at lvl 0
  const dropChance     = getUpgradeValue('paddle_powerup_chance'); // 0.0 at lvl 0

  const baseSpeed = 220 * ballSpeedMult;
  const basePaddleW = Math.round(80 * paddleSizeMult);
  // ... rest of initGame
```

Then update the balls and paddleW fields to use these:
```js
    balls: [{
      x: CANVAS_W / 2,
      y: CANVAS_H / 2,
      r: 7,
      vx: baseSpeed * (Math.random() > 0.5 ? 1 : -1),
      vy: -baseSpeed,
    }],
    paddleW: basePaddleW,
    effectivePaddleW: basePaddleW,
    dropChance,
```

**Step 3: Verify in browser**

Buy "Paddle Expander" once. Start a paddle session — paddle should visibly be wider. Buy "Velocity Core" once — ball should feel noticeably faster at the start.

**Step 4: Commit**

```bash
git add js/games/paddle.js
git commit -m "feat(paddle): apply paddle_ball_speed, paddle_size, paddle_powerup_chance at game start"
```

---

## Task 7: paddle.js — Wire Powerups Module

**Files:**
- Modify: `js/games/paddle.js`

**Step 1: Add imports at the top of paddle.js**

```js
import { spawnPowerup, updatePowerups, renderPowerups } from './powerups.js';
```

(`spawnPowerup` was referenced in Task 5's `updateBall` — this resolves that import.)

**Step 2: Add updatePowerups call in update()**

At the end of `update(g, dt)`, after `g.balls = survivingBalls;`, add:

```js
  updatePowerups(g, dt, CANVAS_H);
```

**Step 3: Add renderPowerups call in render()**

At the very end of `render(ctx, g)`, after the combo indicator block, add:

```js
  renderPowerups(ctx, g);
```

**Step 4: Add sticky release — click and keyboard**

In `launchPaddle`, after the `mousemove` listener, add:

```js
  canvas.addEventListener('click', () => {
    if (game.stickyBall) releaseStickyBall(game);
  });
```

Add a `Space` key check in the keydown handler section (inside the `onKeyDown` handler or alongside the existing keyboard logic in update). The cleanest approach: in `update()`, at the top of the keyboard movement block, add:

```js
  if (g._keys[' '] && g.stickyBall) {
    releaseStickyBall(g);
    g._keys[' '] = false; // prevent repeat
  }
```

**Step 5: Add releaseStickyBall helper function** (add near the bottom of paddle.js, before `clamp`):

```js
function releaseStickyBall(g) {
  if (!g.stickyBall) return;
  const b = g.stickyBall.ball;
  const speed = Math.sqrt(
    (220 * (1 + g.elapsed / SESSION_SECS * 0.6)) ** 2
  ) || 280;
  b.vx = (Math.random() - 0.5) * 200;
  b.vy = -speed * 0.9;
  g.stickyBall = null;
}
```

**Step 6: Verify in browser — all power-ups**

Buy "Loot Matrix" to level 5 (40% drop chance). Play a session — power-up capsules should start falling from broken blocks. Verify each type works:

- **MULTI-BALL ⚡** — catches capsule, second ball appears
- **SLOW-MO 🌀** — ball(s) visibly slow down, HUD timer shows
- **FIREBALL 🔥** — ball turns orange, passes through blocks, HUD timer shows
- **WIDE ↔** — paddle visibly grows, HUD timer shows
- **STICKY 🔒** — ball sticks to paddle, magenta tether line, click or Space releases
- **SHIELD 🛡** — blue glow line at bottom; ball that falls past paddle bounces back once
- **2× SCORE ★** — block scores visibly doubled (check combo text is higher), HUD timer shows
- **ROW CLEAR 💥** — lowest row of blocks instantly removed

**Step 7: Commit**

```bash
git add js/games/paddle.js
git commit -m "feat(paddle): integrate powerups module — drops, effects, sticky release"
```

---

## Task 8: Verify Collision Fixes

No code changes in this task — just manual verification of the two collision fixes already implemented in Task 5.

**Paddle side collision test:**
1. Start a paddle session
2. Position paddle near left wall
3. Let ball approach the left edge of the paddle at a shallow angle
4. Ball should bounce off the side (vx reverses) rather than clipping through
5. Same test on the right edge

**Block tunneling test:**
1. Buy "Velocity Core" to max level 5 (ball starts at 220 × 1.75 = 385 px/s, reaches ~616 px/s late-session)
2. Play session for 30+ seconds when speed scale is high
3. Ball should not pass through any blocks without registering a hit
4. If tunneling is observed: check that `BLOCK_H / 2 = 9` threshold triggers 2 sub-steps at those speeds

**Step 1: Final integration commit**

```bash
git add -A
git commit -m "feat: paddle upgrades, power-ups, and collision fixes complete"
```

---

## Summary of Files Changed

| File | Change |
|---|---|
| `js/upgrades.js` | +3 upgrade definitions |
| `js/games/powerups.js` | **New** — POWERUP_DEFS, spawnPowerup, updatePowerups, catchPowerup, renderPowerups |
| `js/games/paddle.js` | ball→balls array, upgrade integration, powerups integration, side collision, sub-step physics |
