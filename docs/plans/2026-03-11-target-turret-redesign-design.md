# Target Turret Redesign — Design Document

## Overview

Replace the current click-on-shrinking-targets mechanic with a center-fixed turret that rotates toward the mouse with angular lag, fires projectiles on click, and hits the same shrinking targets.

## Architecture

A single `turret` object sits at the canvas center `(240, 210)` with a `currentAngle` that interpolates toward `targetAngle` (derived from mouse position each frame) at `trackSpeed` radians/second. Clicking fires a projectile along `currentAngle`. Projectiles travel in a straight line until off-canvas or until they intersect a target circle. Targets spawn and shrink identically to the current implementation.

## Components

### Turret
```js
{ x: CANVAS_W / 2, y: CANVAS_H / 2, currentAngle: 0 }
```
- `targetAngle` computed from `Math.atan2(my - turret.y, mx - turret.x)` each frame
- `currentAngle` moves toward `targetAngle` by `min(trackSpeed * dt, angularDiff)` per frame (shortest arc)
- Base `trackSpeed`: 1.5 rad/sec
- Rendered as a neon cyan circle with a magenta barrel line along `currentAngle`

### Projectiles
```js
{ x, y, vx, vy }
```
- Spawned at turret center with velocity `[cos(currentAngle), sin(currentAngle)] * PROJECTILE_SPEED`
- `PROJECTILE_SPEED`: 400 px/sec
- Removed when center exits canvas bounds
- Rendered as a small glowing dot with short trail

### Targets
- Unchanged: spawn at random positions, shrink from `TARGET_MAX_R` → `TARGET_MIN_R` over `TARGET_LIFETIME`
- Removed when radius < `TARGET_MIN_R` (chain breaks) or hit by projectile

### Scoring
- Same formula: `pts = floor(100 * sizeFrac * ceil(chain / 3))`
- Chain resets if any target expires (shrinks away without being hit)
- Chain increments on each projectile hit

## New Upgrade

| ID | Name | Effect |
|----|------|--------|
| `target_tracking_speed` | Targeting Core | +0.5 rad/sec tracking speed per level (max 5 levels) |

Base speed 1.5 rad/sec → max 4.0 rad/sec at level 5.

## Rendering

- **Turret body:** Neon cyan filled circle (r=18), glow
- **Barrel:** Magenta line from center along `currentAngle`, length = turret radius + 10px
- **Projectile:** Small white/cyan dot (r=4) with `shadowBlur` glow
- **Targets:** Unchanged — magenta ring + crosshair + inner dot

## Session Flow

- 30-second session (unchanged)
- Mouse position tracked via `mousemove` on canvas
- Click fires one projectile per click (no auto-fire, no cooldown)
- Results screen unchanged
