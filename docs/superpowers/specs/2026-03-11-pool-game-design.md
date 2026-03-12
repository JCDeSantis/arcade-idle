# RACK.EXE — Pool Game Design Spec

## Goal

Add a fourth mini-game to arcade-idle: a top-down billiards/pool game with full physics, click-drag aiming, and chain scoring. Player clears racks of colored balls by shooting the cue ball with accurate angle and power.

## Architecture

A 600×380 canvas. All balls (cue + colored) are physics objects with `{x, y, vx, vy, r}`. Each frame: move balls by velocity, bounce off walls, resolve all ball-pair collisions (elastic), check all balls against pocket zones. Drag from the cue ball on `document` (not just canvas) sets aim direction and shot power; release fires the shot. Input is locked until all balls settle below a velocity threshold. No time limit — player ends the session manually.

## Canvas & Table

- **Canvas size:** 600×380
- **Table felt area:** inset ~30px from canvas edges (accounts for pocket overlap)
- **Pockets:** 6 total — 4 corners + 2 side middles. Each pocket is a circle with `r:18`. Ball is pocketed when its center is within pocket radius.
- **Palette:** neon on dark — table felt `rgba(0,80,0,0.18)`, border `rgba(0,200,0,0.35)`, pockets black with white ring

## Physics

- **Ball radius:** `r: 10` for all balls (cue and colored)
- **Wall bounce:** when `ball.x - r < tableLeft` or `ball.x + r > tableRight`, flip `vx`; same for y/vy
- **Ball-ball collision:** each frame, check every pair. If `dist < r1 + r2`, resolve overlap and exchange velocity components along the collision axis (elastic collision)
- **Friction:** multiply all velocities by `0.985` each frame (balls slow to a stop)
- **Settled threshold:** ball is considered stopped when `Math.abs(vx) < 0.2 && Math.abs(vy) < 0.2`
- **Shot lock:** after firing, disable input until all balls are settled

## Cue & Aiming

- **Drag source:** `mousedown` on or near cue ball starts a drag
- **Mouse tracking:** `mousemove` on `document`, coordinates translated relative to canvas rect — ensures drag works even when mouse leaves the canvas
- **Aim direction:** opposite of drag vector (drag left = shoot right)
- **Power:** `Math.min(dragDistance, MAX_POWER)` where `MAX_POWER = 18` (px/frame impulse)
- **Visual:** dashed cyan aim line from cue ball in shot direction; line length scales with power
- **Fire:** `mouseup` anywhere on document releases the shot

## Ball Layout

- **Starting rack size:** 6 colored balls (upgradeable to 10)
- **Rack formation:** classic triangle, apex ball pointing toward cue ball (left side), base at right. Balls packed touching (`spacing = r * 2 + 1`)
- **Rack position:** right-center of table (~65% from left)
- **Cue ball position:** head string (~28% from left), vertically centered

## Scoring

- **Per pocketed ball:** `100 × (1 + chain × 0.5)` — chain increments after each shot that pockets ≥1 ball; resets on a dry shot (no ball pocketed)
- **Multi-ball bonus:** each additional ball pocketed in the same shot adds +50
- **Rack clear bonus:** `500 × rackNumber` — racks keep coming, rackNumber increments each clear
- **Scratch:** cue ball pocketed — cue ball respawns at head string, chain resets, no points lost

## Session Flow

1. Session starts: fresh rack spawns, cue ball at head string, running `score = 0`, `rackNumber = 1`
2. Player drags from cue ball to aim, releases to shoot; score accumulates each shot
3. After balls settle: if colored balls remain → player shoots again; if rack cleared → rack clear bonus added to score, new rack spawns, `rackNumber++`
4. Player clicks **END SESSION** button to finish (no time limit); accumulated `score` is passed to `submitResult('pool', score)`
5. Results screen shows score + bit/TD rewards, then returns to hub
6. **Drag tolerance:** `mousedown` within `r + 8` pixels of cue ball center starts a drag

## Upgrades

Standard economy upgrades (consumed by `base-game.js` `submitResult`):

| ID | Name | Effect |
|----|------|--------|
| `pool_bit_mult` | Hustle Pay | Pool sessions earn +25% Bits per level (10 levels, costs bits) |
| `pool_td_mult` | Pocket Wisdom | Pool sessions earn +30% Training Data per level (8 levels, costs trainingData) |
| `pool_mastery_rate` | Cue Mastery | Pool mastery gain rate +20% per level — `effect: lvl => 1 + lvl * 0.20` (5 levels, costs bits) |

Pool-specific gameplay upgrades:

| ID | Name | Effect |
|----|------|--------|
| `pool_rack_size` | Full Rack | +1 ball per rack per level (base 6, max 10, 4 levels, costs bits) |
| `pool_power_cap` | Break Force | +3 max shot power per level (base 18, 3 levels, costs bits) |
| `pool_pocket_size` | Wide Pockets | +3px pocket radius per level (base 18, 3 levels, costs bits) |

## Automation

When global idle automation is active and all balls are settled (shot lock is off), the game auto-fires toward the nearest colored ball (by Euclidean distance from cue ball center) at 50% base power. Auto-shot is only triggered after the cue ball is in play (not in scratch-respawn state). The `pool_power_cap` upgrade improves auto-shot power proportionally.

## Integration Points

- **New file:** `js/games/pool.js` — exports `launchPool(onExit)`
- **Modify:** `js/games/launcher.js` — add `pool` case
- **Modify:** `js/state.js`:
  - Add `pool` entry to `state.games` (initially `unlocked: false`)
  - Add `unlockStage4()` function that sets `state.stage = 4` and `state.games.pool.unlocked = true`, emits `stage:unlock`
- **Modify:** `js/loop.js` — add Stage 4 unlock check in `tick()`: `if (state.stage < 4 && state.currencies.lifetimeBits >= 500000) { unlockStage4(); }` (500k lifetimeBits threshold, consistent with Stage 2 = 50k, Stage 3 = 200k progression)
- **Modify:** `js/upgrades.js` — add all `pool_*` upgrade entries; add `'pool'` to the `GAME_IDS` array (used by `getUpgradesForContext` to filter global upgrades)
- **Modify:** `js/ui/hub.js` — add pool game card

## Out of Scope

- Numbered ball rules (no 8-ball/9-ball rule enforcement — all balls are equivalent)
- Spin / English (no cue ball spin control)
- Sound effects
- Ball-in-hand after scratch (cue ball always respawns at fixed position)
