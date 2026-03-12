// js/games/pool.js — top-down billiards mini-game

import { submitResult, showResults } from './base-game.js';
import { getUpgradeValue } from '../upgrades.js';

// ── Constants ─────────────────────────────────────────────
const CANVAS_W = 600;
const CANVAS_H = 380;
const TABLE_L = 30, TABLE_R = 570, TABLE_T = 30, TABLE_B = 350;
const TABLE_CX = (TABLE_L + TABLE_R) / 2;
const TABLE_CY = (TABLE_T + TABLE_B) / 2;

const BALL_R          = 10;
const BASE_POCKET_R   = 18;
const BASE_MAX_POWER  = 18;
const FRICTION        = 0.985;
const SETTLE_THRESH   = 0.2;
const DRAG_TOLERANCE  = BALL_R + 8;  // px from cue center to start drag
const SUBSTEPS        = 4;           // physics sub-steps per frame (prevents tunneling)

const HEAD_X     = TABLE_L + (TABLE_R - TABLE_L) * 0.28;
const RACK_X     = TABLE_L + (TABLE_R - TABLE_L) * 0.65;
const BALL_SPACING = BALL_R * 2 + 1;  // 21px

// Triangle rack: [col, rowOffset] — apex (col 0) faces cue ball (left), base (col 3) at right
const RACK_TEMPLATE = [
  [0,    0],
  [1,  -0.5], [1,   0.5],
  [2,   -1],  [2,    0],  [2,   1],
  [3, -1.5],  [3, -0.5],  [3, 0.5], [3, 1.5],
];

const POCKET_POSITIONS = [
  { x: TABLE_L,  y: TABLE_T  },  // top-left
  { x: TABLE_CX, y: TABLE_T  },  // top-mid
  { x: TABLE_R,  y: TABLE_T  },  // top-right
  { x: TABLE_L,  y: TABLE_B  },  // bot-left
  { x: TABLE_CX, y: TABLE_B  },  // bot-mid
  { x: TABLE_R,  y: TABLE_B  },  // bot-right
];

const BALL_COLORS = [
  '#ff4444', '#4488ff', '#ffaa00', '#44ff88',
  '#ff44cc', '#44ffff', '#ff8833', '#aa44ff',
  '#ffff44', '#ff4488',
];

// ── Entry point ───────────────────────────────────────────
export function launchPool(onExit) {
  const overlay = createOverlay('RACK.EXE');
  const canvas  = overlay.querySelector('canvas');
  const ctx     = canvas.getContext('2d');
  const scoreEl = overlay.querySelector('#g-score');
  const ballsEl = overlay.querySelector('#g-balls');
  const chainEl = overlay.querySelector('#g-chain');

  const game = initGame();
  let animId  = null;
  let lastTs  = null;

  // Drag state — tracks mousedown-to-mouseup for cue aiming
  let drag = { active: false, startX: 0, startY: 0, curX: 0, curY: 0 };

  function toCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function onMouseDown(e) {
    if (game.shotLocked || game.scratch) return;
    const { x, y } = toCanvas(e.clientX, e.clientY);
    if (Math.hypot(x - game.cueBall.x, y - game.cueBall.y) <= DRAG_TOLERANCE) {
      drag = { active: true, startX: x, startY: y, curX: x, curY: y };
    }
  }

  function onMouseMove(e) {
    if (drag.active) {
      const { x, y } = toCanvas(e.clientX, e.clientY);
      drag.curX = x;
      drag.curY = y;
    }
  }

  function onMouseUp(e) {
    if (!drag.active) return;
    const { x, y } = toCanvas(e.clientX, e.clientY);
    drag.curX = x;
    drag.curY = y;
    fireShot(game, drag);
    drag = { active: false, startX: 0, startY: 0, curX: 0, curY: 0 };
  }

  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup',   onMouseUp);

  function loop(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    update(game, dt);
    render(ctx, game, drag);

    scoreEl.textContent = game.score;
    ballsEl.textContent = game.balls.length;
    chainEl.textContent = game.chain > 1 ? `×${game.chain}` : '';

    animId = requestAnimationFrame(loop);
  }

  overlay.querySelector('#end-btn').addEventListener('click', () => {
    cancelAnimationFrame(animId);
    cleanup();
    endSession();
  });

  function cleanup() {
    document.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup',   onMouseUp);
  }

  function endSession() {
    const rewards = submitResult('pool', game.score);
    showResults('pool', game.score, rewards, () => {
      overlay.remove();
      onExit();
    });
  }

  animId = requestAnimationFrame(loop);
  document.getElementById('app').appendChild(overlay);
}

// ── Game init ─────────────────────────────────────────────
function initGame() {
  return {
    score:            0,
    chain:            0,
    rackNumber:       1,
    shotLocked:       false,
    scratch:          false,
    scratchTimer:     0,
    pocketedThisShot: 0,
    cueBall: { x: HEAD_X, y: TABLE_CY, vx: 0, vy: 0, r: BALL_R },
    balls:   buildRack(6 + getUpgradeValue('pool_rack_size')),
  };
}

function buildRack(count) {
  return RACK_TEMPLATE.slice(0, count).map(([col, rowOff], i) => ({
    x:     RACK_X + col * BALL_SPACING,
    y:     TABLE_CY + rowOff * BALL_SPACING,
    vx:    0,
    vy:    0,
    r:     BALL_R,
    color: BALL_COLORS[i % BALL_COLORS.length],
  }));
}

// ── Physics update ────────────────────────────────────────
function update(g, dt) {
  const pocketR = BASE_POCKET_R + getUpgradeValue('pool_pocket_size');

  // Scratch countdown: colored balls keep rolling, cue ball is hidden
  if (g.scratch) {
    g.scratchTimer -= dt;
    for (let s = 0; s < SUBSTEPS; s++) {
      for (const b of g.balls) advanceBall(b);
      for (let i = 0; i < g.balls.length; i++) {
        for (let j = i + 1; j < g.balls.length; j++) {
          resolveCollision(g.balls[i], g.balls[j]);
        }
      }
    }
    for (const b of g.balls) applyFriction(b);
    if (g.scratchTimer <= 0) {
      g.scratch          = false;
      g.shotLocked       = false;
      g.pocketedThisShot = 0;
      g.cueBall.x        = HEAD_X;
      g.cueBall.y        = TABLE_CY;
      g.cueBall.vx       = 0;
      g.cueBall.vy       = 0;
    }
    return;
  }

  if (!g.shotLocked) return;

  // Sub-stepped movement + collision (prevents fast-ball tunneling)
  for (let s = 0; s < SUBSTEPS; s++) {
    advanceBall(g.cueBall);
    for (const b of g.balls) advanceBall(b);

    // Cue vs each colored ball
    for (const b of g.balls) resolveCollision(g.cueBall, b);

    // Colored vs colored
    for (let i = 0; i < g.balls.length; i++) {
      for (let j = i + 1; j < g.balls.length; j++) {
        resolveCollision(g.balls[i], g.balls[j]);
      }
    }
  }

  // Apply friction once per frame (after all sub-steps)
  applyFriction(g.cueBall);
  for (const b of g.balls) applyFriction(b);

  // Cue ball pocket check (scratch)
  for (const p of POCKET_POSITIONS) {
    if (Math.hypot(g.cueBall.x - p.x, g.cueBall.y - p.y) < pocketR) {
      g.scratch      = true;
      g.scratchTimer = 1.0;
      g.chain        = 0;
      g.cueBall.vx   = 0;
      g.cueBall.vy   = 0;
      g.cueBall.x    = -9999;  // hide off-canvas during scratch
      g.cueBall.y    = -9999;
      return;
    }
  }

  // Colored ball pocket checks
  for (let i = g.balls.length - 1; i >= 0; i--) {
    const b = g.balls[i];
    for (const p of POCKET_POSITIONS) {
      if (Math.hypot(b.x - p.x, b.y - p.y) < pocketR) {
        const pts   = Math.floor(100 * (1 + g.chain * 0.5));
        const bonus = g.pocketedThisShot > 0 ? 50 : 0;
        g.score += pts + bonus;
        g.pocketedThisShot++;
        g.balls.splice(i, 1);
        break;
      }
    }
  }

  // Settle check
  if (isAllSettled(g)) {
    g.shotLocked = false;
    if (g.pocketedThisShot > 0) {
      g.chain++;
    } else {
      g.chain = 0;
    }
    g.pocketedThisShot = 0;

    if (g.balls.length === 0) {
      g.score += 500 * g.rackNumber;
      g.rackNumber++;
      g.balls = buildRack(6 + getUpgradeValue('pool_rack_size'));
    }
  }
}

// Move ball by 1/SUBSTEPS of its velocity, bounce off walls
function advanceBall(b) {
  b.x += b.vx / SUBSTEPS;
  b.y += b.vy / SUBSTEPS;
  if (b.x - b.r < TABLE_L) { b.x = TABLE_L + b.r; b.vx =  Math.abs(b.vx); }
  if (b.x + b.r > TABLE_R) { b.x = TABLE_R - b.r; b.vx = -Math.abs(b.vx); }
  if (b.y - b.r < TABLE_T) { b.y = TABLE_T + b.r; b.vy =  Math.abs(b.vy); }
  if (b.y + b.r > TABLE_B) { b.y = TABLE_B - b.r; b.vy = -Math.abs(b.vy); }
}

// Apply friction + zero out tiny velocities (called once per frame)
function applyFriction(b) {
  b.vx *= FRICTION;
  b.vy *= FRICTION;
  if (Math.abs(b.vx) < SETTLE_THRESH) b.vx = 0;
  if (Math.abs(b.vy) < SETTLE_THRESH) b.vy = 0;
}

function resolveCollision(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const distSq = dx * dx + dy * dy;
  const minDist = a.r + b.r;
  if (distSq >= minDist * minDist) return;

  const dist = Math.sqrt(distSq);
  if (dist === 0) return;
  const nx = dx / dist, ny = dy / dist;

  // Push apart so they no longer overlap
  const overlap = minDist - dist;
  a.x -= nx * overlap * 0.5;
  a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.y += ny * overlap * 0.5;

  // Exchange velocity component along collision normal (equal-mass elastic)
  const dvx = a.vx - b.vx, dvy = a.vy - b.vy;
  const dot = dvx * nx + dvy * ny;
  if (dot <= 0) return;  // already separating
  a.vx -= dot * nx;
  a.vy -= dot * ny;
  b.vx += dot * nx;
  b.vy += dot * ny;
}

function isAllSettled(g) {
  if (!isSettled(g.cueBall)) return false;
  return g.balls.every(isSettled);
}

function isSettled(b) {
  return b.vx === 0 && b.vy === 0;
}

// ── Shot firing ───────────────────────────────────────────
function fireShot(g, drag) {
  if (g.shotLocked || g.scratch) return;
  const dx = drag.curX - drag.startX;
  const dy = drag.curY - drag.startY;
  const dragDist = Math.hypot(dx, dy);
  if (dragDist < 2) return;

  const maxPower = BASE_MAX_POWER + getUpgradeValue('pool_power_cap');
  const power    = Math.min(dragDist / 8, maxPower);
  g.cueBall.vx = (-dx / dragDist) * power;
  g.cueBall.vy = (-dy / dragDist) * power;
  g.shotLocked = true;
  g.pocketedThisShot = 0;
}

// ── Guide line prediction ─────────────────────────────────
// Returns { t, ball } for the first colored ball the cue ball ray would hit,
// or null if no ball is in the path. Uses the ghost-ball intersection method.
function findFirstHit(cue, balls, nx, ny) {
  let minT    = Infinity;
  let hitBall = null;
  const twoR  = BALL_R * 2;

  for (const b of balls) {
    const fx = cue.x - b.x;
    const fy = cue.y - b.y;
    const bCoef = fx * nx + fy * ny;
    const cCoef = fx * fx + fy * fy - twoR * twoR;
    const disc  = bCoef * bCoef - cCoef;
    if (disc < 0) continue;
    const t = -bCoef - Math.sqrt(disc);
    if (t > 1 && t < minT) {  // t > 1 avoids self-hit at origin
      minT    = t;
      hitBall = b;
    }
  }

  return hitBall ? { t: minT, ball: hitBall } : null;
}

// ── Rendering ─────────────────────────────────────────────
function render(ctx, g, drag) {
  const pocketR  = BASE_POCKET_R + getUpgradeValue('pool_pocket_size');
  const maxPower = BASE_MAX_POWER + getUpgradeValue('pool_power_cap');

  // Background
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Table felt
  ctx.fillStyle = 'rgba(0,80,0,0.18)';
  ctx.strokeStyle = 'rgba(0,200,0,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.rect(TABLE_L, TABLE_T, TABLE_R - TABLE_L, TABLE_B - TABLE_T);
  ctx.fill();
  ctx.stroke();

  // Pockets
  for (const p of POCKET_POSITIONS) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, pocketR, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Head string (faint dashed line)
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(HEAD_X, TABLE_T);
  ctx.lineTo(HEAD_X, TABLE_B);
  ctx.stroke();
  ctx.setLineDash([]);

  // Colored balls
  for (const b of g.balls) drawBall(ctx, b, b.color);

  // Aim line + prediction + cue stick (only while actively dragging)
  if (drag.active && !g.shotLocked && !g.scratch) {
    const cue = g.cueBall;
    const dx  = drag.curX - drag.startX;
    const dy  = drag.curY - drag.startY;
    const dragDist = Math.hypot(dx, dy);

    if (dragDist > 1) {
      const nx    = -dx / dragDist;
      const ny    = -dy / dragDist;
      const power = Math.min(dragDist / 8, maxPower);

      const guideLevel = getUpgradeValue('pool_guide');
      const maxLen  = 100 + guideLevel * 80;
      const aimLen  = (power / maxPower) * maxLen;

      // Find first ball the cue would hit (for line truncation + prediction)
      const hit = findFirstHit(cue, g.balls, nx, ny);
      const lineEnd = (hit && hit.t < aimLen) ? hit.t : aimLen;

      // Aim line (dashed cyan), stops at first ball contact
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = 'rgba(0,255,255,0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cue.x, cue.y);
      ctx.lineTo(cue.x + nx * lineEnd, cue.y + ny * lineEnd);
      ctx.stroke();
      ctx.setLineDash([]);

      // Collision prediction: ghost ball + deflection arrow (guide level 3+)
      if (guideLevel >= 3 && hit && hit.t <= maxLen) {
        const ghostX = cue.x + nx * hit.t;
        const ghostY = cue.y + ny * hit.t;

        // Ghost ball outline showing where cue ball will be at impact
        ctx.beginPath();
        ctx.arc(ghostX, ghostY, BALL_R, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Deflection direction the hit ball will travel
        const cnx = (hit.ball.x - ghostX) / (BALL_R * 2);
        const cny = (hit.ball.y - ghostY) / (BALL_R * 2);
        const deflLen = 40 + (guideLevel - 3) * 20;  // 40 / 60 / 80 at lvl 3/4/5

        ctx.beginPath();
        ctx.moveTo(hit.ball.x, hit.ball.y);
        ctx.lineTo(hit.ball.x + cnx * deflLen, hit.ball.y + cny * deflLen);
        ctx.strokeStyle = 'rgba(255,200,0,0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Cue stick (from drag start toward drag current)
      ctx.strokeStyle = 'rgba(180,140,60,0.6)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(drag.startX + dx * 0.2, drag.startY + dy * 0.2);
      ctx.lineTo(drag.curX, drag.curY);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  // Cue ball (drawn on top, hidden during scratch)
  if (!g.scratch) drawBall(ctx, g.cueBall, '#ffffff');

  // Shot-locked indicator
  if (g.shotLocked) {
    ctx.font = '600 10px monospace';
    ctx.fillStyle = 'rgba(255,255,100,0.35)';
    ctx.textAlign = 'center';
    ctx.fillText('ROLLING...', CANVAS_W / 2, TABLE_T - 10);
    ctx.textAlign = 'left';
  }
}

function drawBall(ctx, b, color) {
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(
    b.x - b.r * 0.3, b.y - b.r * 0.3, 1,
    b.x, b.y, b.r
  );
  grad.addColorStop(0, lighten(color));
  grad.addColorStop(1, darken(color));
  ctx.fillStyle = grad;
  ctx.fill();
}

function lighten(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.min(255, r + 80)},${Math.min(255, g + 80)},${Math.min(255, b + 80)})`;
}

function darken(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.floor(r * 0.5)},${Math.floor(g * 0.5)},${Math.floor(b * 0.5)})`;
}

// ── Overlay ───────────────────────────────────────────────
function createOverlay(title) {
  const div = document.createElement('div');
  div.id = 'game-overlay';
  div.innerHTML = `
    <div class="game-title-label">${title}</div>
    <div class="game-hud">
      <div class="game-stat">SCORE <span id="g-score">0</span></div>
      <div class="game-stat">BALLS <span id="g-balls">—</span></div>
      <div class="game-stat">CHAIN <span id="g-chain"></span></div>
    </div>
    <canvas width="${CANVAS_W}" height="${CANVAS_H}"></canvas>
    <div style="margin-top:10px;text-align:center;">
      <button id="end-btn" style="
        background:none;border:1px solid rgba(255,0,0,0.4);color:rgba(255,80,80,0.8);
        font-family:var(--font);font-size:0.65rem;letter-spacing:2px;padding:6px 20px;
        cursor:pointer;border-radius:3px;transition:border-color 0.2s,color 0.2s;
      ">END SESSION</button>
    </div>
  `;
  return div;
}
