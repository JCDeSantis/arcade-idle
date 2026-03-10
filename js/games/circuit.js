// js/games/circuit.js — charge-graph edge-routing mini-game (v2)

import { submitResult, showResults } from './base-game.js';
import { getUpgradeValue } from '../upgrades.js';

const CANVAS_W = 480;
const CANVAS_H = 420;
const SESSION_SECS = 45;

const NODE_COUNT     = 14;
const NODE_R         = 18;       // visual radius
const SNAP_R         = NODE_R + 12; // neighbor-hop snap radius
const MIN_NODE_DIST  = 50;       // minimum distance between nodes
const MAX_EDGE_DIST  = 165;      // max distance to form an edge
const MAX_EDGES_PER_NODE = 4;

const CHARGE_RATE_MIN  = 1 / 14; // full charge in 14s
const CHARGE_RATE_MAX  = 1 / 8;  // full charge in 8s
const CASCADE_BONUS    = 0.25;   // charge added to neighbors on overload
const OVERLOAD_PENALTY = 30;

const REPLENISH_INTERVAL = 10;   // seconds between new node grafts
const POWERUP_INTERVAL   = 15;   // seconds between power-up node spawns

export function launchCircuit(onExit) {
  const overlay = createOverlay('CIRCUIT.EXE');
  const canvas  = overlay.querySelector('canvas');
  const ctx     = canvas.getContext('2d');
  const scoreEl = overlay.querySelector('#g-score');
  const timerEl = overlay.querySelector('#g-timer');

  const game   = initGame();
  let animId   = null;
  let lastTime = null;

  function loop(ts) {
    if (!lastTime) lastTime = ts;
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    game.elapsed += dt;
    const timeLimit = SESSION_SECS + game.bonusTime;
    if (game.elapsed >= timeLimit) {
      cancelAnimationFrame(animId);
      endSession();
      return;
    }

    update(game, dt);
    render(ctx, game);

    scoreEl.textContent = game.score;
    timerEl.textContent = Math.ceil(timeLimit - game.elapsed);

    animId = requestAnimationFrame(loop);
  }

  function endSession() {
    const rewards = submitResult('circuit', game.score);
    showResults('circuit', game.score, rewards, () => {
      overlay.remove();
      onExit();
    });
  }

  canvas.addEventListener('mousedown', e => {
    const { x, y } = canvasPos(canvas, e);
    const hit = nodeAt(game, x, y);
    if (!hit) return;
    game.drag.active   = true;
    game.drag.chain    = [hit];
    game.drag.lastPos  = { x, y };
    hit.inChain        = true;
  });

  canvas.addEventListener('mousemove', e => {
    if (!game.drag.active) return;
    const { x, y } = canvasPos(canvas, e);
    game.drag.lastPos = { x, y };
    extendChain(game, x, y);
  });

  const endDrag = () => {
    if (!game.drag.active) return;
    scoreChain(game);
    clearDrag(game);
  };
  canvas.addEventListener('mouseup',    endDrag);
  canvas.addEventListener('mouseleave', endDrag);

  animId = requestAnimationFrame(loop);
  document.getElementById('app').appendChild(overlay);
}

// ── Game initialisation ────────────────────────────────────

let _nodeId = 0;

function initGame() {
  _nodeId = 0;
  const nodeLifetimeMult = getUpgradeValue('circuit_node_lifetime'); // 1.0 at lvl 0 → charges slower
  const chainBonus       = getUpgradeValue('circuit_chain_bonus');   // 0 at lvl 0 (raw level)
  const powerupRate      = getUpgradeValue('circuit_powerup_chance');// 0.0 at lvl 0

  return {
    score:          0,
    elapsed:        0,
    bonusTime:      0,
    nodes:          generateGraph(nodeLifetimeMult),
    drag: {
      active:   false,
      chain:    [],       // node refs in current chain
      lastPos:  null,
    },
    activeEffects:  {},   // { effectId: timeRemaining }
    popups:         [],   // { x, y, text, color, life, maxLife }
    replenishTimer: REPLENISH_INTERVAL,
    powerupTimer:   POWERUP_INTERVAL * Math.max(0.4, 1 - powerupRate),
    nodeLifetimeMult,
    chainBonus,
    powerupRate,
  };
}

// ── Graph generation ──────────────────────────────────────

function generateGraph(nodeLifetimeMult) {
  // Place 14 nodes on a loose 4×4 grid with jitter
  const cols = 4, rows = 4;
  const cellW = CANVAS_W / cols;
  const cellH = CANVAS_H / rows;
  const positions = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = cellW * c + cellW / 2;
      const cy = cellH * r + cellH / 2;
      let x, y, attempts = 0;
      do {
        x = clamp(cx + rand(-cellW * 0.35, cellW * 0.35), NODE_R + 10, CANVAS_W - NODE_R - 10);
        y = clamp(cy + rand(-cellH * 0.35, cellH * 0.35), NODE_R + 10, CANVAS_H - NODE_R - 10);
        attempts++;
      } while (attempts < 10 && positions.some(p => nodeDist(p, { x, y }) < MIN_NODE_DIST));
      positions.push({ x, y });
    }
  }

  const nodes = positions.slice(0, NODE_COUNT).map(p => makeNode(p.x, p.y, nodeLifetimeMult));

  // Connect edges: each node → nearest neighbors within MAX_EDGE_DIST, capped at MAX_EDGES_PER_NODE
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    const candidates = nodes
      .filter((_, j) => j !== i)
      .map(b => ({ node: b, d: nodeDist(a, b) }))
      .filter(({ d }) => d < MAX_EDGE_DIST)
      .sort((x, y) => x.d - y.d);

    for (const { node: b } of candidates) {
      if (a.edges.length >= MAX_EDGES_PER_NODE) break;
      if (b.edges.length >= MAX_EDGES_PER_NODE) continue;
      if (!a.edges.includes(b)) {
        a.edges.push(b);
        b.edges.push(a);
      }
    }
  }

  // Ensure connectivity: isolated nodes connect to nearest
  for (const node of nodes) {
    if (node.edges.length === 0) {
      const nearest = nodes
        .filter(b => b !== node)
        .sort((a, b) => nodeDist(node, a) - nodeDist(node, b))[0];
      node.edges.push(nearest);
      nearest.edges.push(node);
    }
  }

  return nodes;
}

function makeNode(x, y, nodeLifetimeMult, isPowerup = false, powerupDef = null) {
  // Higher nodeLifetimeMult = slower charge rate
  const baseRate = rand(CHARGE_RATE_MIN, CHARGE_RATE_MAX);
  const rate     = isPowerup
    ? CHARGE_RATE_MAX * 1.5            // power-ups charge faster (more urgent)
    : baseRate / Math.max(1, nodeLifetimeMult);
  return {
    id:         _nodeId++,
    x, y,
    charge:     0,          // 0.0 – 1.0
    chargeRate: rate,
    value:      isPowerup ? 0 : randInt(10, 30),
    edges:      [],
    isPowerup,
    powerupDef,
    inChain:    false,
  };
}

// ── Power-up definitions ──────────────────────────────────

const POWERUP_DEFS = [
  { id: 'stabilize',     label: '📉', color: '#38d4d4', duration: 0 }, // instant
  { id: 'amplify',       label: '★',  color: '#e89830', duration: 8 },
  { id: 'freeze',        label: '❄',  color: '#38d4d4', duration: 6 },
  { id: 'reinforce',     label: '🔒', color: '#3ecb7c', duration: 8 },
  { id: 'surge_harvest', label: '⚡', color: '#e04ca0', duration: 0 }, // instant
  { id: 'extend',        label: '+T', color: '#3ecb7c', duration: 0 }, // instant
];

// ── Update ────────────────────────────────────────────────

function update(game, dt) {
  // Tick active effects
  for (const id of Object.keys(game.activeEffects)) {
    if (game.activeEffects[id] > 0) {
      game.activeEffects[id] -= dt;
      if (game.activeEffects[id] < 0) game.activeEffects[id] = 0;
    }
  }

  const frozen     = game.activeEffects.freeze    > 0;
  const reinforced = game.activeEffects.reinforce  > 0;

  // Charge nodes
  if (!frozen) {
    const chargeScale = reinforced ? 0.5 : 1;
    for (const node of game.nodes) {
      if (node.inChain) continue;
      node.charge = Math.min(1, node.charge + node.chargeRate * dt * chargeScale);
    }
  }

  // Check overloads (snapshot first to avoid mutation during iteration)
  // !n.inChain guard is a safety invariant: prevents removeNode() from being called on in-chain nodes,
  // which would corrupt the drag state. Do not remove this guard.
  const overloaded = game.nodes.filter(n => n.charge >= 1 && !n.inChain);
  for (const node of overloaded) {
    triggerOverload(game, node);
  }

  // Replenish network
  game.replenishTimer -= dt;
  if (game.replenishTimer <= 0 && game.nodes.length < NODE_COUNT + 2) {
    graftNode(game, false);
    game.replenishTimer = REPLENISH_INTERVAL;
  }

  // Spawn power-up node
  game.powerupTimer -= dt;
  if (game.powerupTimer <= 0) {
    graftPowerupNode(game);
    game.powerupTimer = POWERUP_INTERVAL * Math.max(0.4, 1 - game.powerupRate);
  }

  // Age popups
  game.popups = game.popups.filter(p => {
    p.life -= dt;
    return p.life > 0;
  });
}

function triggerOverload(game, node) {
  // Cascade charge to neighbors
  for (const neighbor of node.edges) {
    if (!neighbor.inChain) {
      neighbor.charge = Math.min(1, neighbor.charge + CASCADE_BONUS);
    }
  }
  // Penalty + popup
  game.score = Math.max(0, game.score - OVERLOAD_PENALTY);
  addPopup(game, node.x, node.y - NODE_R - 10, `ARC! -${OVERLOAD_PENALTY}`, '#e04ca0');
  removeNode(game, node);
}

function removeNode(game, node) {
  // Disconnect from all neighbors
  for (const neighbor of node.edges) {
    neighbor.edges = neighbor.edges.filter(e => e !== node);
  }
  game.nodes = game.nodes.filter(n => n !== node);
  // If this node is being dragged, score and clear the chain now.
  // scoreChain is safe to call here because JS is single-threaded —
  // the endDrag handler cannot fire while update() is running.
  if (game.drag.chain.includes(node)) {
    scoreChain(game);
    clearDrag(game);
  }
}

function graftNode(game, isPowerup, powerupDef = null) {
  if (game.nodes.length === 0) return;
  const anchor = game.nodes[randInt(0, game.nodes.length - 1)];
  const angle  = rand(0, Math.PI * 2);
  const d      = rand(80, 130);
  const x = clamp(anchor.x + Math.cos(angle) * d, NODE_R + 10, CANVAS_W - NODE_R - 10);
  const y = clamp(anchor.y + Math.sin(angle) * d, NODE_R + 10, CANVAS_H - NODE_R - 10);

  const newNode = makeNode(x, y, game.nodeLifetimeMult, isPowerup, powerupDef);
  newNode.edges.push(anchor);
  anchor.edges.push(newNode);

  // Optionally connect to one more nearby node
  const nearby = game.nodes
    .filter(n => n !== anchor && nodeDist(n, newNode) < MAX_EDGE_DIST)
    .sort((a, b) => nodeDist(a, newNode) - nodeDist(b, newNode));
  if (nearby.length > 0 && newNode.edges.length < MAX_EDGES_PER_NODE && nearby[0].edges.length < MAX_EDGES_PER_NODE) {
    newNode.edges.push(nearby[0]);
    nearby[0].edges.push(newNode);
  }

  game.nodes.push(newNode);
}

function graftPowerupNode(game) {
  const def = POWERUP_DEFS[randInt(0, POWERUP_DEFS.length - 1)];
  graftNode(game, true, def);
}

// ── Drag / chain logic ────────────────────────────────────

function nodeAt(game, x, y) {
  for (const node of game.nodes) {
    const dx = x - node.x, dy = y - node.y;
    if (dx * dx + dy * dy <= NODE_R * NODE_R) return node;
  }
  return null;
}

function extendChain(game, x, y) {
  const last = game.drag.chain[game.drag.chain.length - 1];
  if (!last) return;
  for (const neighbor of last.edges) {
    if (neighbor.inChain) continue;
    const dx = x - neighbor.x, dy = y - neighbor.y;
    if (dx * dx + dy * dy <= SNAP_R * SNAP_R) {
      neighbor.inChain = true;
      game.drag.chain.push(neighbor);
      if (neighbor.isPowerup) {
        activatePowerup(game, neighbor.powerupDef);
        removeNode(game, neighbor);
        return; // chain ends after power-up capture
      }
      break; // only one snap per mousemove event
    }
  }
}

function scoreChain(game) {
  const chain = game.drag.chain.filter(n => !n.isPowerup);
  if (chain.length === 0) return;

  const count    = chain.length;
  const mult     = chainMultiplier(count, game.chainBonus);
  const ampMult  = game.activeEffects.amplify > 0 ? 2 : 1;

  let total = 0;
  for (const node of chain) {
    total += node.value * node.charge * mult * ampMult;
    node.charge = 0; // reset after harvest
  }
  total = Math.floor(total);

  if (total > 0) {
    game.score += total;
    const cx    = chain.reduce((s, n) => s + n.x, 0) / chain.length;
    const cy    = chain.reduce((s, n) => s + n.y, 0) / chain.length;
    const label = mult > 1 ? `+${total} ×${mult}` : `+${total}`;
    addPopup(game, cx, cy, label, '#e89830');
  }
}

function clearDrag(game) {
  for (const node of game.drag.chain) {
    node.inChain = false;
  }
  game.drag.active  = false;
  game.drag.chain   = [];
  game.drag.lastPos = null;
}

function chainMultiplier(count, bonus) {
  // bonus = 0, 1, or 2 from circuit_chain_bonus upgrade
  if (count >= 7 - bonus) return 3;
  if (count >= 5 - bonus) return 2;
  if (count >= 3 - bonus) return 1.5;
  return 1;
}

// ── Power-up activation ───────────────────────────────────

function activatePowerup(game, def) {
  switch (def.id) {
    case 'amplify':
    case 'freeze':
    case 'reinforce':
      game.activeEffects[def.id] = def.duration;
      break;

    case 'stabilize':
      for (const node of game.nodes) {
        if (!node.inChain) node.charge = Math.max(0, node.charge - 0.3);
      }
      addPopup(game, CANVAS_W / 2, CANVAS_H / 2 - 20, 'STABILIZED', '#38d4d4');
      break;

    case 'surge_harvest': {
      let surgeTotal = 0;
      for (const node of game.nodes) {
        if (!node.isPowerup && !node.inChain) {
          surgeTotal += Math.floor(node.value * node.charge);
          node.charge = 0;
        }
      }
      game.score += surgeTotal;
      addPopup(game, CANVAS_W / 2, CANVAS_H / 2 - 20, `SURGE +${surgeTotal}`, '#e04ca0');
      break;
    }

    case 'extend':
      game.bonusTime += 8;
      addPopup(game, CANVAS_W / 2, 30, '+8s', '#3ecb7c');
      break;
  }
}

// ── Render ────────────────────────────────────────────────

function render(ctx, game) {
  // Background
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Grid
  ctx.strokeStyle = 'rgba(0,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < CANVAS_W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
  }
  for (let y = 0; y < CANVAS_H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
  }

  // Edges — draw before nodes so nodes render on top
  const drawnEdges = new Set();
  for (const node of game.nodes) {
    for (const neighbor of node.edges) {
      const key = Math.min(node.id, neighbor.id) * 10000 + Math.max(node.id, neighbor.id);
      if (drawnEdges.has(key)) continue;
      drawnEdges.add(key);

      const active = isChainEdge(game, node, neighbor);
      ctx.beginPath();
      ctx.moveTo(node.x, node.y);
      ctx.lineTo(neighbor.x, neighbor.y);
      ctx.strokeStyle = active ? '#38d4d4' : 'rgba(56,212,212,0.22)';
      ctx.lineWidth   = active ? 2 : 1;
      ctx.shadowColor = active ? '#38d4d4' : 'transparent';
      ctx.shadowBlur  = active ? 8 : 0;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // Nodes
  for (const node of game.nodes) {
    renderNode(ctx, node, node.inChain);
  }

  // Score popups
  for (const popup of game.popups) {
    const alpha = popup.life / popup.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = popup.color;
    ctx.font        = 'bold 12px "Space Mono", monospace';
    ctx.textAlign   = 'center';
    ctx.fillText(popup.text, popup.x, popup.y - (1 - alpha) * 20);
  }
  ctx.globalAlpha = 1;

  renderEffectsHUD(ctx, game);
}

function renderNode(ctx, node, highlighted) {
  const color = nodeColor(node);

  // Charge arc track (background)
  ctx.beginPath();
  ctx.arc(node.x, node.y, NODE_R + 5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(56,212,212,0.10)';
  ctx.lineWidth   = 3;
  ctx.stroke();

  // Charge arc fill (clockwise from top)
  if (node.charge > 0.01) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, NODE_R + 5, -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * node.charge);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 3;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Node fill
  ctx.beginPath();
  ctx.arc(node.x, node.y, NODE_R, 0, Math.PI * 2);
  ctx.fillStyle = color + '22';
  ctx.fill();

  // Node outline
  ctx.strokeStyle = highlighted ? '#ffffff' : color;
  ctx.lineWidth   = highlighted ? 2.5 : 1.5;
  ctx.shadowColor = color;
  ctx.shadowBlur  = highlighted ? 18 : (node.charge > 0.8 ? 14 : 6);
  ctx.stroke();
  ctx.shadowBlur  = 0;

  // Label
  ctx.fillStyle    = node.isPowerup ? color : '#ffffff';
  ctx.font         = `bold ${node.isPowerup ? 13 : 10}px "Space Mono", monospace`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.isPowerup ? node.powerupDef.label : node.value, node.x, node.y);
  ctx.textBaseline = 'alphabetic';

  // Pulsing outer ring for power-ups or near-overload nodes
  if (node.isPowerup || node.charge > 0.8) {
    const pulse = 0.4 + 0.4 * Math.sin(Date.now() / 250);
    ctx.beginPath();
    ctx.arc(node.x, node.y, NODE_R + 9, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1;
    ctx.globalAlpha = pulse * 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function nodeColor(node) {
  if (node.isPowerup) return node.powerupDef.color;
  const c = node.charge;
  if (c >= 0.8) return '#e04ca0'; // magenta — danger
  if (c >= 0.5) return '#e89830'; // amber — warning
  return '#38d4d4';                // cyan — safe
}

function isChainEdge(game, a, b) {
  if (!game.drag.active) return false;
  const chain = game.drag.chain;
  for (let i = 0; i < chain.length - 1; i++) {
    if ((chain[i] === a && chain[i + 1] === b) ||
        (chain[i] === b && chain[i + 1] === a)) return true;
  }
  return false;
}

function renderEffectsHUD(ctx, game) {
  const timed = Object.entries(game.activeEffects).filter(([, t]) => t > 0);
  let x = 10;
  const y = CANVAS_H - 30;

  for (const [id, timeLeft] of timed) {
    const def = POWERUP_DEFS.find(d => d.id === id);
    if (!def) continue;
    ctx.fillStyle   = def.color + '33';
    roundRect(ctx, x, y - 10, 54, 18, 4);
    ctx.fill();
    ctx.strokeStyle = def.color;
    ctx.lineWidth   = 1;
    roundRect(ctx, x, y - 10, 54, 18, 4);
    ctx.stroke();
    ctx.fillStyle = def.color;
    ctx.font      = '9px "Space Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${def.label} ${timeLeft.toFixed(1)}s`, x + 4, y + 3);
    x += 60;
  }
}

// ── Utilities ─────────────────────────────────────────────

function addPopup(game, x, y, text, color) {
  game.popups.push({ x, y, text, color, life: 1.4, maxLife: 1.4 });
}

function canvasPos(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function nodeDist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(v, lo, hi)  { return Math.max(lo, Math.min(hi, v)); }
function rand(lo, hi)       { return lo + Math.random() * (hi - lo); }
function randInt(lo, hi)    { return Math.floor(rand(lo, hi + 1)); }

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function createOverlay(title) {
  const div = document.createElement('div');
  div.id = 'game-overlay';
  div.innerHTML = `
    <div class="game-title-label">${title}</div>
    <div class="game-hud">
      <div class="game-stat">SCORE <span id="g-score">0</span></div>
      <div class="game-stat">TIME <span id="g-timer">${SESSION_SECS}</span></div>
    </div>
    <canvas width="${CANVAS_W}" height="${CANVAS_H}"></canvas>
  `;
  return div;
}
