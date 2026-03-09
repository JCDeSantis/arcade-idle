# Design: CIRCUIT.EXE — Node-Chain Mini-Game

**Date:** 2026-03-09
**Scope:** arcade-idle — third mini-game (Stage 3)
**Approach:** Free-form circuit drag — mouse-only, drag-chain through fading nodes

---

## Section 1 — Core Mechanic

**Game ID:** `circuit`
**Session length:** 40 seconds
**Input:** Mouse only (hold + drag)

Nodes spawn continuously at random canvas positions (480×420), each with an independent lifetime of 12–18s. Each node displays a shrinking arc ring around its perimeter showing remaining life. The player holds the mouse button and drags — any node within capture radius of the cursor path is captured mid-drag. Releasing the mouse ends the chain and scores it.

### Node Properties
- Radius: 14–20px (random per node)
- Lifetime: 12–18s (random per node), modified by `circuit_node_lifetime` upgrade
- Base value: 10–30 pts (random, displayed as label inside node)
- Spawn rate: 1 node every ~1.8s at session start, scaling to ~1 every 0.9s at session end

### Scoring
- **Chain multiplier:** ×1 for 1–2 nodes, ×1.5 for 3–4, ×2 for 5–6, ×3 for 7+
  - `circuit_chain_bonus` upgrade reduces each threshold by 1 per level (max 2 levels)
- **Quick-capture bonus:** +50% per node caught with >60% lifetime remaining
- **Score multiplier effect:** all chain scores ×2 when `score_mult` is active

### Penalty
Any node whose lifetime ring hits zero: brief red flash, -20 pts from score.

### Pacing
Spawn rate ramps linearly from 1/1.8s → 1/0.9s over the session (matching paddle's speed-scaling pattern). Frantic by the final 10 seconds.

---

## Section 2 — Power-ups

Power-up nodes are special glowing nodes (pulsing outline, icon label) mixed into the canvas alongside regular nodes. Captured identically — by dragging through them. Shorter lifetime: 8s.

Base spawn rate: ~1 power-up node every 15s, modified by `circuit_powerup_chance` upgrade (raw probability, not a multiplier).

| ID | Label | Color | Duration | Effect |
|---|---|---|---|---|
| `freeze` | FREEZE | cyan | 6s | All node lifetime timers pause |
| `magnet` | MAGNET | green | 8s | Capture radius doubles |
| `score_mult` | 2× SCORE | amber | 8s | All chain scores ×2 |
| `surge` | SURGE | magenta | instant | Captures every node currently on canvas |
| `slow_spawn` | SLOW | blue | 8s | Spawn rate halves |
| `bonus_nodes` | BONUS | amber | instant | Spawns 5 high-value (60pt) golden nodes |
| `no_penalty` | SHIELD | blue | 1 use | Next 3 expired nodes deal no penalty |
| `extend` | +TIME | green | instant | Adds 8s to session timer |

Active timed effects render as a HUD pill strip inside the canvas at `y = CANVAS_H - 30`, same style as paddle's effect strip.

---

## Section 3 — Permanent Upgrades

Six upgrades added to `upgrades.js`. All follow existing naming convention `${gameId}_${effect}`.

| ID | Name | Effect | Currency | Base Cost | Scale | Max |
|---|---|---|---|---|---|---|
| `circuit_bit_mult` | Data Siphon | +25% Bits/session per level | bits | 150 | 2.5× | 10 |
| `circuit_td_mult` | Signal Mapper | +30% Training Data per level | trainingData | 30 | 2.2× | 8 |
| `circuit_mastery_rate` | Fast Routing | Mastery grows 20% faster per level | bits | 500 | 3× | 5 |
| `circuit_node_lifetime` | Extended Window | Nodes live +15% longer per level | bits | 250 | 2.6× | 5 |
| `circuit_chain_bonus` | Overclock Chain | Chain multiplier thresholds −1 per level | bits | 400 | 3× | 2 |
| `circuit_powerup_chance` | Loot Splice | +10% power-up node spawn rate per level | trainingData | 25 | 2.2× | 5 |

`circuit_chain_bonus`: capped at 2 levels (max −2 from each threshold). At level 2, 3× multiplier kicks in at 5 nodes instead of 7.
`circuit_powerup_chance`: raw probability modifier (0.0 at level 0), same semantic as `paddle_powerup_chance`.

---

## Section 4 — Integration

### State (`js/state.js`)
Add `circuit` to `state.games`:
```js
circuit: {
  unlocked: false,
  bestScore: 0,
  recentScores: [],
  mastery: 0,
  totalRuns: 0,
}
```
Add `unlockStage3()` mutation:
```js
export function unlockStage3() {
  if (state.stage >= 3) return;
  state.stage = 3;
  state.games.circuit.unlocked = true;
  emit('stage:unlock', { stage: 3 });
}
```

### Unlock Threshold (`js/loop.js`)
Check `state.currencies.lifetimeBits >= 200_000` on each tick → call `unlockStage3()`.
Progression: Paddle (start) → Target (50k) → Circuit (200k).

### Hub (`js/ui/hub.js`)
Add circuit game card to hub grid. Card locked until Stage 3. Listen for `stage:unlock` event to reveal.

### Automation (`js/automation.js`)
Circuit feeds the existing automation formula unchanged:
`auto_rate = mastery_factor × consistency_factor × upgrade_multiplier × prestige_bonus`
No new automation mechanics needed.

### Rewards (`js/games/base-game.js`)
No changes needed. `submitResult('circuit', score)` auto-resolves `circuit_bit_mult` and `circuit_td_mult` by naming convention.

---

## Files Changed

| File | Change |
|---|---|
| `js/state.js` | Add `circuit` to `state.games`; add `unlockStage3()` |
| `js/loop.js` | Add 200k lifetime bits threshold check |
| `js/upgrades.js` | Add 6 circuit upgrade definitions |
| `js/ui/hub.js` | Add circuit game card; handle Stage 3 unlock event |
| `js/games/circuit.js` | **New** — full game implementation (~350 lines) |

---

## Visual Style

Consistent with existing neon arcade palette (`#0a0a0f` background, `#38d4d4` cyan, `#e04ca0` magenta, `#3ecb7c` green, `#e89830` amber). Space Mono font.

- **Nodes:** Filled circle (color-coded by value tier) + arc ring lifetime indicator
- **Power-up nodes:** Same circle with pulsing glow + 2-char icon label
- **Drag line:** Live neon line drawn from drag start through captured nodes; fades on release with a brief flash
- **Capture burst:** Small particle pop when a node is captured mid-drag
- **Expired node:** Red flash + shrink-out animation
- **Chain score popup:** Floats up from chain centroid on release showing total pts + multiplier
