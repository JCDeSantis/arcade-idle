# Design: CIRCUIT.EXE Redesign — Charge Graph with Edge-Routing

**Date:** 2026-03-09
**Scope:** arcade-idle — full rewrite of `js/games/circuit.js`
**Motivation:** Original design felt too similar to TARGET.EXE (react to things before they expire). New design shifts cognitive mode to strategic/planning + voltage tension.

---

## Section 1 — Core Mechanic

### Graph Generation
Each session generates a fresh network of ~14 nodes distributed across the 480×420 canvas. Nodes are placed using a loose grid with random jitter to avoid overlap. Each node connects to its 2–3 nearest neighbors via edges. The graph is fixed for the session — no random spawning of nodes.

### Charge System
Every node has a charge level (0–100%) that fills continuously at its own rate (8–14s to full, randomized per node, modified by `circuit_node_lifetime` upgrade). Node appearance shifts with charge:
- 0–50%: dim cyan glow
- 50–80%: bright amber glow
- 80–99%: pulsing red, warning state
- 100%: **OVERLOAD** — emits cascade pulse (+25% charge) to all directly connected neighbors, then is removed from the network

**Score from harvesting a node = `base_value × charge%`** — waiting longer earns more, but risks cascade.

### Neighbor-Hop Drag Mechanic
- `mousedown` on any node starts a chain with that node as the first hop
- `mousemove`: if cursor comes within snap radius (node.r + 12) of a node that is **directly connected by an edge** to the last captured node, it snaps into the chain
- Moving near a non-connected node does nothing
- `mouseup` or `mouseleave`: scores the chain, resets all captured nodes to 0% charge, ends drag
- A node can only appear once per chain (no revisiting)

### Chain Scoring
- `total = sum(base_value × charge%) × chainMultiplier`
- Chain multiplier: ×1 for 1–2 nodes, ×1.5 for 3–4, ×2 for 5–6, ×3 for 7+ (shifted by `circuit_chain_bonus` upgrade)
- Score popup floats up from the centroid of harvested nodes

### Overload Cascade
When a node overloads:
1. Flash white, emit "ARC!" popup
2. Add +25% charge to each directly connected neighbor
3. Remove node from network (delete node + all its edges)
4. Each neighbor that now exceeds 100% also overloads (recursive, same tick)
5. Score penalty: −30 pts per overloaded node

### Network Replenishment
A new node grafts onto the network every ~10s to replace harvested/overloaded nodes. It spawns near an existing node, connects to 1–2 nearby nodes, and starts at 0% charge. This keeps the graph alive without introducing random-spawn pressure.

### Session
- Duration: 45 seconds
- Starts with 14 nodes, ~6 edges average per node pair
- Gets harder naturally: cascade risk grows as charge accumulates across the network

---

## Section 2 — Power-ups

Power-up nodes spawn into the network connected by edges (same as regular nodes). Captured via neighbor-hop chain. 6 types:

| ID | Label | Color | Duration | Effect |
|---|---|---|---|---|
| `stabilize` | STABIL | cyan | instant | Reduces all node charge by 30% |
| `amplify` | AMP | amber | 8s | Next chain scores 2× charge value |
| `freeze` | FREEZE | cyan | 6s | Charge accumulation pauses for all nodes |
| `reinforce` | REINF | green | 8s | All nodes charge 50% slower |
| `surge_harvest` | SURGE | magenta | instant | Harvests all nodes at current charge (no chain needed, no multiplier) |
| `extend` | +TIME | green | instant | Adds 8s to session timer |

Power-up nodes have a shorter overload window (6s). They spawn ~every 15s (adjusted by `circuit_powerup_chance` upgrade). Active timed effects show in HUD strip inside canvas at bottom.

---

## Section 3 — Upgrades

Existing 6 circuit upgrades reused with updated semantics:

| ID | Name | New Meaning |
|---|---|---|
| `circuit_bit_mult` | Data Siphon | +25% Bits/session per level — unchanged |
| `circuit_td_mult` | Signal Mapper | +30% Training Data per level — unchanged |
| `circuit_mastery_rate` | Fast Routing | Mastery grows 20% faster per level — unchanged |
| `circuit_node_lifetime` | Extended Window | Nodes charge **15% slower** per level (was: nodes live longer) |
| `circuit_chain_bonus` | Overclock Chain | Chain multiplier thresholds −1 per level — unchanged |
| `circuit_powerup_chance` | Loot Splice | Power-up nodes spawn more frequently per level — unchanged |

Only description text changes in `upgrades.js` for `circuit_node_lifetime` ("nodes charge slower") and `circuit_powerup_chance` ("power-up nodes spawn more frequently").

---

## Files Changed

| File | Change |
|---|---|
| `js/games/circuit.js` | **Full rewrite** — graph generation, charge system, neighbor-hop drag, overload cascade, new power-up set |
| `js/upgrades.js` | Update description text for `circuit_node_lifetime` and `circuit_powerup_chance` |

All other files unchanged — state.js, loop.js, hub.js, launcher.js, base-game.js, automation-panel.js all stay as-is. The gameId `circuit` and upgrade naming conventions are fully preserved.

---

## Visual Style

Consistent with existing neon arcade palette (`#0a0a0f` background).

- **Edges:** thin neon lines (`#38d4d4` at 30% opacity) connecting nodes; brighten to full opacity during an active chain along that edge
- **Nodes:** circle with charge arc ring (fills clockwise as charge builds)
  - 0–50%: `#38d4d4` cyan
  - 50–80%: `#e89830` amber (interpolated)
  - 80–99%: `#e04ca0` magenta, pulsing glow
  - Overloading: white flash + arc pulse animation
- **Active chain:** captured nodes highlight white; traversed edges glow bright cyan
- **Overload cascade:** arc pulse travels along edges visually
- **HUD strip:** active timed effects at bottom of canvas (same style as paddle)
- **Score popup:** floats from chain centroid on release

---

## Graph Generation Algorithm

Simple approach (no external library):
1. Place 14 nodes using a 4×4 grid (480/4 = 120px columns, 420/4 = 105px rows) with ±30px random jitter per node, minimum 40px separation enforced
2. For each node, find its 3 nearest neighbors; add an edge if distance < 160px and neither node already has >4 edges
3. Ensure graph connectivity: if any node is isolated, force-connect it to its single nearest neighbor

This produces a natural-looking sparse graph without requiring Delaunay triangulation.
