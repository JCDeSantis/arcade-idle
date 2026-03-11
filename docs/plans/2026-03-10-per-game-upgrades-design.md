# Per-Game Upgrades Design

**Date:** 2026-03-10

## Goal

Replace the single flat UPGRADES panel with per-game upgrade buttons embedded in each game card, plus a separate GLOBAL UPGRADES button for cross-game upgrades.

## Layout

Each unlocked game card gains an UPGRADES button at its bottom. Locked cards show nothing. The existing UPGRADES tab in the hub-tabs row is renamed to GLOBAL UPGRADES.

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│  🎮       │  │  🎯       │  │  🔗       │
│  PADDLE  │  │  TARGET  │  │  CIRCUIT │
│ MST 4.2% │  │  🔒       │  │  🔒       │
│[UPGRADES]│  │          │  │          │
└──────────┘  └──────────┘  └──────────┘
[GLOBAL UPGRADES]  [AUTOMATION]  [PRESTIGE]
```

Clicking a card body still launches the game. Clicking the UPGRADES button (stopPropagation) opens the panel filtered to that game.

## Data Flow

`openPanel(name, context)` — context is optional, passed through to the panel init function.

Panel title derived from context:
- `'paddle'` → "PADDLE UPGRADES"
- `'target'` → "TARGET UPGRADES"
- `'circuit'` → "CIRCUIT UPGRADES"
- `'global'` → "GLOBAL UPGRADES"

`getUpgradesForContext(context)` in upgrades.js:
- Game contexts → filter UPGRADES by `id.startsWith(context + '_')`
- `'global'` → upgrades without any known game prefix (`auto_mult`, `prestige_bonus`)

`initUpgradesPanel(context)` uses this helper instead of `getVisibleUpgrades()`.

## Files Changed

| File | Change |
|------|--------|
| `js/upgrades.js` | Add `getUpgradesForContext(context)` export |
| `js/ui/panel.js` | `openPanel(name, context)` — pass context to init fn; derive panel title from context |
| `js/ui/upgrades-panel.js` | `initUpgradesPanel(context)` — filter via `getUpgradesForContext` |
| `js/ui/hub.js` | `gameCard()` — add UPGRADES button for unlocked games; UPGRADES tab → GLOBAL UPGRADES |

## Out of Scope

- No new upgrade definitions
- No changes to purchase logic, currency display, or styling of upgrade cards
- Locked game cards intentionally show no upgrade button (nothing to upgrade yet)
