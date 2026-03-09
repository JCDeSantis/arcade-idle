// js/games/circuit.js — node-chain drag mini-game

import { submitResult, showResults } from './base-game.js';
import { getUpgradeValue } from '../upgrades.js';

const CANVAS_W    = 480;
const CANVAS_H    = 420;
const SESSION_SECS = 40;

// Node spawn interval range (seconds) — ramps from BASE → MIN over session
const SPAWN_INTERVAL_BASE = 1.8;
const SPAWN_INTERVAL_MIN  = 0.9;

// Node properties
const NODE_R_MIN       = 14;
const NODE_R_MAX       = 20;
const NODE_LIFE_MIN    = 12;  // seconds, before upgrade
const NODE_LIFE_MAX    = 18;
const NODE_VAL_MIN     = 10;
const NODE_VAL_MAX     = 30;
const PENALTY_PTS      = 20;
const POWERUP_INTERVAL = 15; // seconds between power-up node spawns (base)

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

  // Drag handlers
  canvas.addEventListener('mousedown', e => {
    const { x, y } = canvasPos(canvas, e);
    game.drag.active   = true;
    game.drag.path     = [{ x, y }];
    game.drag.captured = [];
  });

  canvas.addEventListener('mousemove', e => {
    if (!game.drag.active) return;
    const { x, y } = canvasPos(canvas, e);
    game.drag.path.push({ x, y });
    captureDragNodes(game, x, y);
  });

  canvas.addEventListener('mouseup', () => {
    if (!game.drag.active) return;
    scoreChain(game);
    game.drag.active   = false;
    game.drag.path     = [];
    game.drag.captured = [];
  });

  // Cancel drag if mouse leaves canvas
  canvas.addEventListener('mouseleave', () => {
    if (!game.drag.active) return;
    scoreChain(game);
    game.drag.active   = false;
    game.drag.path     = [];
    game.drag.captured = [];
  });

  animId = requestAnimationFrame(loop);
  document.getElementById('app').appendChild(overlay);
}

// ── Game initialisation ───────────────────────────────────

function initGame() {
  _nodeId = 0;
  const nodeLifetimeMult = getUpgradeValue('circuit_node_lifetime'); // 1.0 at lvl 0
  const chainBonus       = getUpgradeValue('circuit_chain_bonus');   // 0 at lvl 0 (raw level)
  const powerupRate      = getUpgradeValue('circuit_powerup_chance');// 0.0 at lvl 0

  return {
    score:        0,
    elapsed:      0,
    bonusTime:    0,       // seconds added by +TIME power-up
    nodes:        [],      // live nodes (regular + power-up)
    drag: {
      active:    false,
      path:      [],       // [{x, y}] cursor positions this drag
      captured:  [],       // node objects captured this drag
    },
    activeEffects:  {},    // { effectId: timeRemaining (s) }; 0/absent = inactive
    shieldCharges:  0,     // remaining no_penalty charges
    popups:         [],    // { x, y, text, life, maxLife, color }
    spawnTimer:     0,     // seconds until next regular node spawn
    powerupTimer:   POWERUP_INTERVAL * (1 - powerupRate), // adjusted spawn interval
    nodeLifetimeMult,
    chainBonus,
    powerupRate,
  };
}

// ── Update ────────────────────────────────────────────────

function update(game, dt) {
  // Tick active effects
  for (const id of Object.keys(game.activeEffects)) {
    if (game.activeEffects[id] > 0) {
      game.activeEffects[id] -= dt;
      if (game.activeEffects[id] < 0) game.activeEffects[id] = 0;
    }
  }

  const frozen = game.activeEffects.freeze > 0;
  const slowSpawn = game.activeEffects.slow_spawn > 0;

  // Spawn regular nodes
  const spawnRate = spawnInterval(game.elapsed);
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    game.nodes.push(makeNode(game));
    game.spawnTimer = slowSpawn ? spawnRate * 2 : spawnRate;
  }

  // Spawn power-up node
  game.powerupTimer -= dt;
  if (game.powerupTimer <= 0) {
    game.nodes.push(makePowerupNode(game));
    game.powerupTimer = POWERUP_INTERVAL * (1 - game.powerupRate);
  }

  // Age nodes + check expiry
  const surviving = [];
  for (const node of game.nodes) {
    if (node.captured) { surviving.push(node); continue; }
    if (!frozen) node.lifetime -= dt;
    if (node.lifetime <= 0) {
      // Expired
      if (node.isPowerup) continue; // power-ups just disappear silently
      if (game.shieldCharges > 0) {
        game.shieldCharges--;
      } else {
        game.score = Math.max(0, game.score - PENALTY_PTS);
        addPopup(game, node.x, node.y, `-${PENALTY_PTS}`, '#e04ca0');
      }
    } else {
      surviving.push(node);
    }
  }
  game.nodes = surviving;

  // Age popups
  game.popups = game.popups.filter(p => {
    p.life -= dt;
    return p.life > 0;
  });
}

// ── Node factory ─────────────────────────────────────────

let _nodeId = 0;
function makeNode(game) {
  const r    = randInt(NODE_R_MIN, NODE_R_MAX);
  const life = rand(NODE_LIFE_MIN, NODE_LIFE_MAX) * game.nodeLifetimeMult;
  return {
    id:          _nodeId++,
    x:           rand(r + 10, CANVAS_W - r - 10),
    y:           rand(r + 10, CANVAS_H - r - 10),
    r,
    lifetime:    life,
    maxLifetime: life,
    value:       randInt(NODE_VAL_MIN, NODE_VAL_MAX),
    isPowerup:   false,
    powerupDef:  null,
    captured:    false,
    capturedFraction: 0, // lifetime fraction remaining when captured
  };
}

// ── Power-up definitions ──────────────────────────────────

const POWERUP_DEFS = [
  { id: 'freeze',      label: '❄',  color: '#38d4d4', duration:  6 },
  { id: 'magnet',      label: '🧲', color: '#3ecb7c', duration:  8 },
  { id: 'score_mult',  label: '★',  color: '#e89830', duration:  8 },
  { id: 'surge',       label: '⚡', color: '#e04ca0', duration:  0 }, // instant
  { id: 'slow_spawn',  label: '🐢', color: '#38d4d4', duration:  8 },
  { id: 'bonus_nodes', label: '💰', color: '#e89830', duration:  0 }, // instant
  { id: 'no_penalty',  label: '🛡', color: '#38d4d4', duration: -2 }, // -2 = charge-based
  { id: 'extend',      label: '+T', color: '#3ecb7c', duration:  0 }, // instant
];

function makePowerupNode(game) {
  const def  = POWERUP_DEFS[randInt(0, POWERUP_DEFS.length - 1)];
  const r    = 16;
  const life = 8 * game.nodeLifetimeMult;
  return {
    id:          _nodeId++,
    x:           rand(r + 10, CANVAS_W - r - 10),
    y:           rand(r + 10, CANVAS_H - r - 10),
    r,
    lifetime:    life,
    maxLifetime: life,
    value:       0,        // power-ups have no point value
    isPowerup:   true,
    powerupDef:  def,
    captured:    false,
    capturedFraction: 0,
  };
}

// ── Drag capture ──────────────────────────────────────────

function captureDragNodes(game, cx, cy) {
  const magnetActive = game.activeEffects.magnet > 0;
  for (const node of game.nodes) {
    if (node.captured) continue;
    const baseRadius = node.r + 8;
    const captureR   = magnetActive ? baseRadius * 2 : baseRadius;
    const dx = cx - node.x;
    const dy = cy - node.y;
    if (dx * dx + dy * dy <= captureR * captureR) {
      node.captured         = true;
      node.capturedFraction = node.lifetime / node.maxLifetime;
      game.drag.captured.push(node);
      if (node.isPowerup) {
        activatePowerup(game, node.powerupDef);
      }
    }
  }
}

// ── Chain scoring ─────────────────────────────────────────

function scoreChain(game) {
  const captured = game.drag.captured;
  if (captured.length === 0) return;

  const count      = captured.length;
  const mult       = chainMultiplier(count, game.chainBonus);
  const scoreMult  = game.activeEffects.score_mult > 0 ? 2 : 1;

  let total = 0;
  for (const node of captured) {
    if (node.isPowerup) continue; // power-ups contribute 0 pts
    let pts = node.value * mult * scoreMult;
    if (node.capturedFraction > 0.6) pts *= 1.5; // quick-capture bonus
    total += pts;
  }
  total = Math.floor(total);

  if (total > 0) {
    game.score += total;

    // Score popup at centroid of captured regular nodes
    const regNodes = captured.filter(n => !n.isPowerup);
    if (regNodes.length > 0) {
      const cx = regNodes.reduce((s, n) => s + n.x, 0) / regNodes.length;
      const cy = regNodes.reduce((s, n) => s + n.y, 0) / regNodes.length;
      const label = mult > 1 ? `+${total} ×${mult}` : `+${total}`;
      addPopup(game, cx, cy, label, '#e89830');
    }
  }

  // Remove captured nodes from canvas
  game.nodes = game.nodes.filter(n => !n.captured);
}

function chainMultiplier(count, bonus) {
  // bonus = 0, 1, or 2 (from circuit_chain_bonus upgrade)
  if (count >= 7 - bonus) return 3;
  if (count >= 5 - bonus) return 2;
  if (count >= 3 - bonus) return 1.5;
  return 1;
}

// ── Power-up activation ───────────────────────────────────

function activatePowerup(game, def) {
  switch (def.id) {
    case 'freeze':
    case 'magnet':
    case 'score_mult':
    case 'slow_spawn':
      game.activeEffects[def.id] = def.duration;
      break;

    case 'no_penalty':
      game.shieldCharges += 3;
      break;

    case 'surge':
      // Score all non-captured, non-powerup nodes instantly at ×1
      for (const node of game.nodes) {
        if (!node.captured && !node.isPowerup) {
          game.score += node.value;
        }
      }
      game.nodes = game.nodes.filter(n => n.isPowerup && !n.captured);
      addPopup(game, CANVAS_W / 2, CANVAS_H / 2, 'SURGE!', '#e04ca0');
      break;

    case 'bonus_nodes': {
      // Spawn 5 golden nodes worth 60 pts each
      for (let i = 0; i < 5; i++) {
        const r    = 16;
        const life = 10 * game.nodeLifetimeMult;
        game.nodes.push({
          id:               _nodeId++,
          x:                rand(r + 10, CANVAS_W - r - 10),
          y:                rand(r + 10, CANVAS_H - r - 10),
          r,
          lifetime:         life,
          maxLifetime:      life,
          value:            60,
          isPowerup:        false,
          powerupDef:       null,
          captured:         false,
          capturedFraction: 0,
          isGolden:         true,
        });
      }
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

  // Grid lines
  ctx.strokeStyle = 'rgba(0,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < CANVAS_W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
  }
  for (let y = 0; y < CANVAS_H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
  }

  // Nodes
  for (const node of game.nodes) {
    if (node.captured) continue;
    renderNode(ctx, node, game.drag.captured.includes(node));
  }

  // Live drag line
  if (game.drag.active && game.drag.path.length > 1) {
    ctx.beginPath();
    ctx.moveTo(game.drag.path[0].x, game.drag.path[0].y);
    for (let i = 1; i < game.drag.path.length; i++) {
      ctx.lineTo(game.drag.path[i].x, game.drag.path[i].y);
    }
    ctx.strokeStyle = '#38d4d4';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#38d4d4';
    ctx.shadowBlur  = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Score popups
  for (const popup of game.popups) {
    const alpha = popup.life / popup.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = popup.color;
    ctx.font        = 'bold 12px "Space Mono", monospace';
    ctx.textAlign   = 'center';
    ctx.fillText(popup.text, popup.x, popup.y - (1 - alpha) * 24);
  }
  ctx.globalAlpha = 1;

  // Active effects HUD strip (above bottom)
  renderEffectsHUD(ctx, game);
}

function renderNode(ctx, node, isHighlighted) {
  const fraction = node.lifetime / node.maxLifetime;
  const color    = nodeColor(node);

  // Fill
  ctx.beginPath();
  ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
  ctx.fillStyle = color + '22';
  ctx.fill();

  // Outline
  ctx.strokeStyle = isHighlighted ? '#ffffff' : color;
  ctx.lineWidth   = isHighlighted ? 2 : 1.5;
  ctx.shadowColor = color;
  ctx.shadowBlur  = isHighlighted ? 16 : 6;
  ctx.stroke();
  ctx.shadowBlur  = 0;

  // Lifetime arc (clockwise from top, depletes as lifetime shrinks)
  ctx.beginPath();
  ctx.arc(node.x, node.y, node.r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction);
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2;
  ctx.globalAlpha = 0.5;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Label
  ctx.fillStyle   = node.isPowerup ? color : '#ffffff';
  ctx.font        = `bold ${node.isPowerup ? 14 : 10}px "Space Mono", monospace`;
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.isPowerup ? node.powerupDef.label : node.value, node.x, node.y);
  ctx.textBaseline = 'alphabetic';

  // Power-up pulsing glow
  if (node.isPowerup) {
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 300);
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r + 6, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1;
    ctx.globalAlpha = pulse * 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function renderEffectsHUD(ctx, game) {
  const timedEffects = Object.entries(game.activeEffects)
    .filter(([, t]) => t > 0);

  let x = 10;
  const y = CANVAS_H - 30;

  for (const [id, timeLeft] of timedEffects) {
    const def = POWERUP_DEFS.find(d => d.id === id);
    if (!def) continue;

    ctx.fillStyle   = def.color + '33';
    roundRect(ctx, x, y - 10, 52, 18, 4);
    ctx.fill();
    ctx.strokeStyle = def.color;
    ctx.lineWidth   = 1;
    roundRect(ctx, x, y - 10, 52, 18, 4);
    ctx.stroke();

    ctx.fillStyle    = def.color;
    ctx.font         = '9px "Space Mono", monospace';
    ctx.textAlign    = 'left';
    ctx.fillText(`${def.label} ${timeLeft.toFixed(1)}s`, x + 4, y + 3);
    x += 58;
  }

  // Shield charges indicator
  if (game.shieldCharges > 0) {
    ctx.fillStyle  = '#38d4d4';
    ctx.font       = '9px "Space Mono", monospace';
    ctx.textAlign  = 'left';
    ctx.fillText(`🛡 ×${game.shieldCharges}`, x + 4, y + 3);
  }
}

function nodeColor(node) {
  if (node.isPowerup)  return node.powerupDef.color;
  if (node.isGolden)   return '#ffd700';
  if (node.value >= 23) return '#e89830'; // amber — high value
  if (node.value >= 16) return '#e04ca0'; // magenta — medium
  return '#38d4d4';                        // cyan — low
}

// ── Utilities ─────────────────────────────────────────────

function spawnInterval(elapsed) {
  // Lerp from BASE → MIN over the session
  const t = Math.min(elapsed / SESSION_SECS, 1);
  return SPAWN_INTERVAL_BASE + (SPAWN_INTERVAL_MIN - SPAWN_INTERVAL_BASE) * t;
}

function addPopup(game, x, y, text, color) {
  game.popups.push({ x, y, text, color, life: 1.2, maxLife: 1.2 });
}

function canvasPos(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function rand(lo, hi)    { return lo + Math.random() * (hi - lo); }
function randInt(lo, hi) { return Math.floor(rand(lo, hi + 1)); }

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
