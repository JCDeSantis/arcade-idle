# Design: Paddle Upgrades, Power-ups & Collision Fixes

**Date:** 2026-03-08
**Scope:** arcade-idle — paddle mini-game enhancements
**Approach:** Approach B — extract `js/games/powerups.js` for power-up definitions/effects; upgrade hooks inline via `getUpgradeValue()`

---

## Section 1 — Permanent Upgrades

Three new upgrades added to `upgrades.js` under the existing UPGRADES array. These apply their effects at game-start by reading `getUpgradeValue(id)` inside `initGame()`.

| ID | Name | Effect | Currency | Base Cost | Scale | Max |
|---|---|---|---|---|---|---|
| `paddle_ball_speed` | Velocity Core | +15% base ball speed/level | bits | 300 | 2.8× | 5 |
| `paddle_size` | Paddle Expander | +15% paddle width/level | bits | 200 | 2.5× | 5 |
| `paddle_powerup_chance` | Loot Matrix | +8% power-up drop chance/level (cap 40%) | trainingData | 30 | 2.2× | 5 |

- `paddle_ball_speed` multiplies the base speed constant (220 px/s) by `getUpgradeValue('paddle_ball_speed')` at `initGame()` time.
- `paddle_size` multiplies the base paddle width (80px) by `getUpgradeValue('paddle_size')`.
- `paddle_powerup_chance` contributes `(level * 0.08)` to drop roll, capped at 0.40.

---

## Section 2 — In-Session Power-up Drops

### Architecture

New file: `js/games/powerups.js`

Exports:
- `POWERUP_DEFS` — array of power-up type definitions
- `spawnPowerup(block)` — creates a falling capsule object from a block's position
- `updatePowerups(game, dt)` — ticks all active capsules (falling) and active effects (timed)
- `catchPowerup(game, capsule)` — activates a power-up effect on the game state
- `renderPowerups(ctx, game)` — draws capsules in-flight and active-effect HUD strip

### Game State Extensions (added to `initGame()` return object)

```js
{
  balls: [ /* array replaces single ball */ ],
  drops: [],          // in-flight capsule objects
  activeEffects: {},  // { effectId: timeLeft } for timed effects
  shieldActive: false,
  stickyBall: null,   // { ball, offsetX } when sticky is active
  dropChance: 0,      // computed from upgrade at init
}
```

### Power-up Type Definitions

| ID | Label | Icon | Color | Duration | Effect |
|---|---|---|---|---|---|
| `multi_ball` | MULTI-BALL | ⚡ | amber | instant | Clone active ball with mirrored vx, push to `game.balls[]` |
| `slow_mo` | SLOW-MO | 🌀 | cyan | 8s | `activeEffects.slow_mo` halves SPEED_SCALE |
| `fireball` | FIREBALL | 🔥 | red | 5s | Ball passes through blocks (destroys without bounce) |
| `wide_paddle` | WIDE PADDLE | ▶◀ | green | 10s | Effective paddle width × 1.5 |
| `sticky` | STICKY | 🔒 | magenta | until release | Ball attaches to paddle top on contact; click/Space releases |
| `shield` | SHIELD | 🛡 | blue | 1 use | Auto-catches one ball that passes paddle bottom |
| `score_mult` | 2× SCORE | ★ | amber | 10s | Block hit points × 2 |
| `row_clear` | ROW CLEAR | 💥 | red | instant | Remove all blocks in the lowest surviving row |

### Drop Flow

1. Block breaks → roll `Math.random() < game.dropChance`.
2. If hit, pick a random type from `POWERUP_DEFS` (weighted equally).
3. Capsule spawns at block center, falls at 120 px/s.
4. Each frame: move capsule down, check circle-rect vs paddle → if caught, call `catchPowerup`.
5. Capsule disappears if it falls below `CANVAS_H`.

### Multi-ball Notes

`game.balls` is the canonical array of active balls. `initGame()` starts with one ball in it. The existing `update()` and `render()` loops are refactored to iterate `game.balls`. When multi-ball activates, a clone with `vx = -ball.vx` is pushed. Each ball is independently checked for paddle/block/wall collision. Ball loss (bottom) removes that ball from `game.balls`; if all balls lost, score penalty + respawn single ball (same as current behavior, just extended to multi-ball).

---

## Section 3 — Collision Fixes

### Paddle Side Collision

Paddle occupies rect `(paddleX, paddleY, effectivePaddleW, 12)`.

Current code only handles top-surface contact. Add:

```
Left side:  prevX + r > paddleX     (was outside left)
            b.x  - r < paddleX      (is now overlapping left)
            b.y  + r > paddleY && b.y - r < paddleY + 12  (vertical overlap)
            → reflect vx (set to -Math.abs(vx))

Right side: symmetric → reflect vx (set to +Math.abs(vx))
```

Use swept `prevX = b.x - b.vx * dt * SPEED_SCALE` for the previous position check, same pattern as current top-surface code.

### Block Tunneling (Sub-step Physics)

When the ball's speed magnitude × dt exceeds `BLOCK_H / 2` (9px), split the physics update into 2 sub-steps of `dt/2` each. Collision checks run inside each sub-step. This prevents tunneling at high ball speeds (max-level `paddle_ball_speed` upgrade reaches ~520 px/s, so at 60fps dt≈0.017 → 8.8px/frame, right at the limit — sub-stepping ensures safe detection).

Condition check: `const mag = Math.sqrt(vx*vx + vy*vy); if (mag * dt > BLOCK_H / 2) → 2 sub-steps`.

---

## Section 4 — Visual Feedback

### In-Flight Capsules

Drawn in `renderPowerups()` as a 28×14px rounded rect at the capsule's current position. Filled with type color at 20% opacity, outlined at full opacity. A 2-char label (e.g. `⚡`, `🔥`) centered inside. Glow shadow matching type color.

### Active Effect HUD Strip

Drawn inside the canvas at `y = paddleY - 22`. Each active timed effect renders as a small colored pill (icon + countdown in seconds) spaced 36px apart, left-aligned from x=10. Shield indicator: thin horizontal line drawn at `y = CANVAS_H - 2` with blue glow while active.

### Ball Visual Changes

- **Fireball active:** `fillStyle = '#ff6600'`, `shadowColor = '#ff4400'`, shadowBlur = 20
- **Sticky active:** ball drawn at paddle surface; magenta line from ball center to paddle top
- **Normal/multi-ball:** unchanged white fill, cyan glow

---

## Files Changed

| File | Change |
|---|---|
| `js/upgrades.js` | Add 3 new upgrade definitions |
| `js/games/powerups.js` | **New** — all power-up type defs, update, render, catch logic |
| `js/games/paddle.js` | Refactor ball→balls array, import powerups, apply upgrade values at init, fix collision, add sub-step physics |
