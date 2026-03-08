# Arcade Idle — Game Design Document

**Date:** 2026-03-08
**Scope:** Phase 1 + Phase 2 (2 mini-games, automation, basic prestige)
**Tech:** Vanilla HTML/JS (ES Modules) + CSS — run via local dev server

---

## Concept

A browser-based arcade idle game where the player manually masters short skill-based mini-games, trains AI automation to mimic their performance during idle periods, and prestiges for permanent improvements.

**Core fantasy:** Your skill becomes automation.

---

## Tech Stack

- Vanilla HTML5 + CSS3 + JavaScript (ES Modules)
- Canvas API for mini-games and particle effects
- LocalStorage for save/load
- Google Fonts: `Space Mono` (monospace terminal feel)
- Dev server: `python -m http.server 8080` or VS Code Live Server

---

## File Structure

```
arcade-idle/
├── index.html
├── style.css
└── js/
    ├── main.js               ← entry point, wires everything together
    ├── state.js              ← global game state object + event emitter
    ├── save.js               ← localStorage save/load + offline progress
    ├── loop.js               ← tick system (automation, autosave, idle)
    ├── automation.js         ← idle calculation engine
    ├── prestige.js           ← prestige logic + permanent upgrade tree
    ├── upgrades.js           ← upgrade definitions + purchase logic
    ├── ui/
    │   ├── hub.js            ← main hub screen controller
    │   ├── hud.js            ← always-visible currency bar + header
    │   ├── upgrades-panel.js
    │   ├── automation-panel.js
    │   ├── prestige-panel.js
    │   └── particles.js      ← canvas particle effects
    └── games/
        ├── base-game.js      ← shared scoring/session lifecycle
        ├── paddle.js         ← Breakout-style canvas mini-game
        └── target.js         ← click-to-hit target mini-game
```

---

## Currencies

| Currency | Symbol | Earned By | Used For |
|---|---|---|---|
| Bits | `B` | All mini-game runs | Upgrades, stage unlocks |
| Training Data | `TD` | Runs that beat your personal average | Automation upgrades, mastery boosts |
| Neural Credits | `NC` | Prestige only | Permanent prestige upgrades |

**Earning formulas:**
- `Bits = base_reward × score_multiplier × upgrade_multiplier`
- `Training Data` = awarded only when run score > rolling average (last 5 runs)
- `Neural Credits = floor(sqrt(lifetime_bits / 1000))` on prestige

---

## Mini-Games

### Game 1: Paddle (Breakout-style)
- **Duration:** ~45 seconds
- **Mechanic:** Ball bounces; player moves paddle (mouse/keyboard) to keep it alive. Breaks "data blocks" in a grid for points. Ball speeds up over time.
- **Scoring:** Blocks broken × combo multiplier, survival time bonus
- **Automation metrics:** best score, rolling average (last 5 runs), mastery %

### Game 2: Target (Aim/Reflex)
- **Duration:** ~30 seconds
- **Mechanic:** Circular targets spawn at random canvas positions and shrink over time. Click/tap to destroy. Chained hits build a multiplier.
- **Scoring:** Targets hit × chain multiplier, speed bonus for early hits
- **Automation metrics:** best score, hit accuracy %, mastery %

Both games use separate canvases and run independently. Results screen shows earned Bits, Training Data, and mastery change after each session.

---

## Automation System

Per-game state tracked in `state.js`:
```js
{
  bestScore: 0,
  recentScores: [],       // rolling window, last 5 runs
  mastery: 0,             // 0–100, grows per run with diminishing returns
  consistencyBonus: 0,    // reward for low score variance
}
```

**Automation output (Bits/sec):**
```
auto_rate = mastery_factor × consistency_factor × upgrade_multiplier × prestige_bonus
```

- `mastery_factor = mastery / 100` (near 0 at start, scales with play)
- `consistency_factor` = 0.5–1.5× based on variance in recent scores
- Automation only earns **Bits** — Training Data requires active play
- Meaningful at ~30–40% mastery; powerful at 70–100%
- Ticks every 1 second via `loop.js`

---

## Stages

### Stage 1 (starts unlocked)
- Paddle game available
- Basic Bit and Training Data upgrades
- Automation panel visible but earnings are low

### Stage 2 (unlocks at 50,000 lifetime Bits)
- Target game unlocks
- Automation upgrade tier 2 available
- Prestige option appears in hub

---

## Prestige

**Requirements:** Stage 2 reached + at least 1 prestige threshold met

**On prestige:**
- Resets: Bits, Training Data, all upgrades, stage progress, mastery scores
- Keeps: Neural Credits, prestige upgrades
- Awards: `NC = floor(sqrt(lifetime_bits / 1000))`

**Prestige upgrade tree:**

| Upgrade | Cost | Effect |
|---|---|---|
| Better Bootup | 1 NC | Start with 10% mastery on all games |
| Overclock | 2 NC | Automation rate +15% |
| Data Recovery | 3 NC | Keep 20% of Training Data on prestige |
| Fast Learner | 2 NC | Mastery grows 25% faster |
| Stage Skip | 4 NC | Stage 2 unlocks at 25k Bits instead of 50k |

---

## Save System

- Auto-save to `localStorage` every 30 seconds
- Manual save button in hub
- On load: calculate offline time × automation rate and award idle Bits
- Export/import save as JSON string (copy-paste)

---

## Visual Design

**Aesthetic:** Neon arcade / AI training simulator

| Element | Value |
|---|---|
| Background | `#0a0a0f` with subtle CSS grid overlay |
| Accent — Cyan | `#00ffff` — main UI, selections |
| Accent — Magenta | `#ff00ff` — Training Data, automation |
| Accent — Green | `#00ff88` — Neural Credits, prestige |
| Accent — Amber | `#ffaa00` — warnings, stage progress |
| Font | `Space Mono` (Google Fonts) |
| Glow | CSS `box-shadow` + `text-shadow` on all interactive elements |
| Canvas FX | CRT scanline overlay via CSS gradient |
| Particles | Score pop on block break / target hit; prestige burst |
| Transitions | Slide-in panels, crossfade between hub and game |
| HUD | Always-visible top bar with animated number counters |

---

## Hub Layout

```
┌─────────────────────────────────────────┐
│  [ARCADE IDLE]     B: 0   TD: 0   NC: 0 │  ← HUD bar
├─────────────────────────────────────────┤
│                                         │
│   ┌──────────┐   ┌──────────┐           │
│   │  PADDLE  │   │  TARGET  │  (locked) │  ← Mini-game cards
│   │  GAME    │   │  GAME    │           │
│   └──────────┘   └──────────┘           │
│                                         │
│   [UPGRADES]  [AUTOMATION]  [PRESTIGE]  │  ← Nav tabs
│                                         │
└─────────────────────────────────────────┘
```

---

## Build Order

1. **Phase 1** — Scaffold (index.html, style.css, state.js, main.js, loop.js, save.js, hub.js, hud.js)
2. **Phase 2** — Paddle game (paddle.js, base-game.js, score/reward integration)
3. **Phase 3** — Upgrades panel (upgrades.js, upgrades-panel.js)
4. **Phase 4** — Automation system (automation.js, automation-panel.js)
5. **Phase 5** — Target game (target.js)
6. **Phase 6** — Stages + prestige (prestige.js, prestige-panel.js)
7. **Phase 7** — Visual polish (particles.js, animations, CRT effect, transitions)
8. **Phase 8** — Save/load (save.js offline progress, export/import)
