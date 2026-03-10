# ARCADE IDLE

A browser-based arcade idle game. Train your AI by playing three mini-games, earn Bits and Training Data, buy upgrades, automate your sessions, and prestige for permanent bonuses.

## How to Run

Download the latest release zip, unzip it, then serve it with any local HTTP server:

```bash
# Python (built-in)
python -m http.server 8080

# Node
npx serve .
```

Open `http://localhost:8080` in your browser. *(ES modules require a server — opening `index.html` directly will not work.)*

## Games

| Game | Unlock | Mechanic |
|------|--------|----------|
| **PADDLE** | Start | Keep the ball in play — longer rallies = higher score |
| **TARGET** | 50k lifetime Bits | Click targets before they expire — accuracy and speed matter |
| **CIRCUIT.EXE** | 200k lifetime Bits | Drag along edges of a charge graph to harvest chains before nodes overload |

### CIRCUIT.EXE — Quick Guide

- Nodes slowly fill with charge (cyan → amber → magenta)
- **Click a node** to start a chain, then **drag toward connected neighbors** to snap them in
- **Release** to score — points = node value × charge % × chain multiplier
- Chain multiplier: ×1.5 at 3+ nodes, ×2 at 5+, ×3 at 7+
- **Overloaded nodes** (full charge) arc: -30 pts penalty, charge cascades to neighbors
- The board reshuffles after every scored chain
- Power-up nodes (colored, labeled) trigger effects when captured mid-chain

## Currencies

| Currency | Earned By | Used For |
|----------|-----------|----------|
| **Bits** | Playing games | Upgrades |
| **Training Data** | Beating your rolling average | Upgrades |
| **Neural Credits** | Prestige | Prestige upgrades |

## Features

- **Upgrades** — per-game score multipliers, Training Data rates, mastery speed, and game-specific mechanics
- **Automation** — idle bots that play games for you between sessions
- **Prestige** — reset progress for Neural Credits, spent on permanent cross-run bonuses
- **Save / Export / Import** — manual save + clipboard-based export for backup

## Tech Stack

Vanilla HTML5 · CSS3 · JavaScript ES Modules · Canvas 2D API — no build step, no dependencies.
