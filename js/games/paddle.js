// js/games/paddle.js — Breakout-style canvas mini-game

import { submitResult, showResults } from './base-game.js';

const CANVAS_W = 480;
const CANVAS_H = 420;
const SESSION_SECS = 45;
const COLS = 8;
const ROWS = 5;
const BLOCK_W = 52;
const BLOCK_H = 18;
const BLOCK_PAD = 4;
const BLOCK_OFFSET_X = 20;
const BLOCK_OFFSET_Y = 40;

const BLOCK_COLORS = ['#ff00ff', '#ff00aa', '#aa00ff', '#ff4488', '#cc00ff'];

export function launchPaddle(onExit) {
  // Build overlay
  const overlay = createOverlay('PADDLE.EXE');
  const canvas = overlay.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = overlay.querySelector('#g-score');
  const timerEl = overlay.querySelector('#g-timer');

  const game = initGame();
  let animId = null;
  let lastTime = null;

  function loop(ts) {
    if (!lastTime) lastTime = ts;
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    game.elapsed += dt;
    if (game.elapsed >= SESSION_SECS || game.blocks.length === 0) {
      cancelAnimationFrame(animId);
      endSession();
      return;
    }

    update(game, dt);
    render(ctx, game);

    scoreEl.textContent = game.score;
    timerEl.textContent = Math.ceil(SESSION_SECS - game.elapsed);

    animId = requestAnimationFrame(loop);
  }

  function endSession() {
    const rewards = submitResult('paddle', game.score);
    showResults('paddle', game.score, rewards, () => {
      overlay.remove();
      onExit();
    });
  }

  // Mouse/touch control
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    game.paddleX = clamp(
      e.clientX - rect.left - (game.effectivePaddleW ?? game.paddleW) / 2,
      0, CANVAS_W - (game.effectivePaddleW ?? game.paddleW)
    );
  });

  // Keyboard control
  const keys = {};
  const onKeyDown = e => { keys[e.key] = true; };
  const onKeyUp   = e => { keys[e.key] = false; };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup',   onKeyUp);
  game._keys = keys;

  // Clean up keyboard listeners when overlay is removed
  const observer = new MutationObserver(() => {
    if (!document.contains(overlay)) {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  animId = requestAnimationFrame(loop);
  document.getElementById('app').appendChild(overlay);
}

function initGame() {
  const blocks = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      blocks.push({
        x: BLOCK_OFFSET_X + col * (BLOCK_W + BLOCK_PAD),
        y: BLOCK_OFFSET_Y + row * (BLOCK_H + BLOCK_PAD),
        w: BLOCK_W,
        h: BLOCK_H,
        color: BLOCK_COLORS[row % BLOCK_COLORS.length],
        points: (ROWS - row) * 10,
      });
    }
  }

  return {
    score:    0,
    elapsed:  0,
    combo:    0,
    blocks:   blocks,
    paddleW:  80,
    paddleX:  CANVAS_W / 2 - 40,
    paddleY:  CANVAS_H - 28,
    balls: [{
      x: CANVAS_W / 2,
      y: CANVAS_H / 2,
      r: 7,
      vx: 220 * (Math.random() > 0.5 ? 1 : -1),
      vy: -220,
    }],
    drops: [],
    activeEffects: {},
    shieldActive: false,
    stickyBall: null,
    dropChance: 0,
    effectivePaddleW: 80,
    _keys: {},
  };
}

function update(g, dt) {
  // activeEffects values are positive durations (seconds); 0 or absent = inactive
  const SPEED_SCALE = (1 + g.elapsed / SESSION_SECS * 0.6)
    * (g.activeEffects.slow_mo > 0 ? 0.5 : 1);

  // Compute effective paddle width (wide_paddle effect applied here)
  g.effectivePaddleW = g.paddleW * (g.activeEffects.wide_paddle > 0 ? 1.5 : 1);

  // Keyboard paddle movement
  const spd = 400 * dt;
  const pw  = g.effectivePaddleW;
  if (g._keys['ArrowLeft']  || g._keys['a'] || g._keys['A'])
    g.paddleX = clamp(g.paddleX - spd, 0, CANVAS_W - pw);
  if (g._keys['ArrowRight'] || g._keys['d'] || g._keys['D'])
    g.paddleX = clamp(g.paddleX + spd, 0, CANVAS_W - pw);

  // Sticky: lock attached ball to paddle
  if (g.stickyBall) {
    const { ball, offsetX } = g.stickyBall;
    ball.x = g.paddleX + pw / 2 + offsetX;
    ball.y = g.paddleY - ball.r;
  }

  // Space to release sticky ball
  if (g._keys[' '] && g.stickyBall) {
    releaseStickyBall(g);
    g._keys[' '] = false;
  }

  // Update each ball
  const survivingBalls = [];
  for (const b of g.balls) {
    updateBall(g, b, dt, SPEED_SCALE);
    const lost = b.y - b.r > CANVAS_H;
    if (lost) {
      if (g.shieldActive) {
        g.shieldActive = false;
        b.y = g.paddleY - b.r;
        b.vy = -Math.abs(b.vy);
        survivingBalls.push(b);
      } else {
        if (g.stickyBall?.ball === b) g.stickyBall = null;
      }
    } else {
      survivingBalls.push(b);
    }
  }

  // If all balls lost: penalty + respawn
  if (survivingBalls.length === 0) {
    g.score = Math.max(0, g.score - 50);
    g.combo = 0;
    survivingBalls.push({
      x: CANVAS_W / 2, y: CANVAS_H / 2, r: 7,
      vx: 220 * (Math.random() > 0.5 ? 1 : -1),
      vy: -220,
    });
  }
  g.balls = survivingBalls;
}

function updateBall(g, b, dt, SPEED_SCALE) {
  // Sub-step if fast enough to tunnel through a block
  const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  const steps = (speed * dt * SPEED_SCALE > BLOCK_H / 2) ? 2 : 1;
  const subDt  = dt / steps;

  for (let s = 0; s < steps; s++) {
    const prevX = b.x;
    const prevY = b.y;

    b.x += b.vx * subDt * SPEED_SCALE;
    b.y += b.vy * subDt * SPEED_SCALE;

    // Wall bounce
    if (b.x - b.r < 0)        { b.x = b.r;            b.vx =  Math.abs(b.vx); }
    if (b.x + b.r > CANVAS_W) { b.x = CANVAS_W - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y - b.r < 0)        { b.y = b.r;             b.vy =  Math.abs(b.vy); }

    // Paddle collision
    const px = g.paddleX;
    const pw = g.effectivePaddleW;
    const py = g.paddleY;
    const pH = 12; // paddle height

    // Top surface
    if (
      b.vy > 0 &&
      prevY + b.r < py && b.y + b.r >= py &&
      b.x >= px && b.x <= px + pw
    ) {
      b.y  = py - b.r;
      b.vy = -Math.abs(b.vy);
      const hitFrac = (b.x - px) / pw;
      b.vx = (hitFrac - 0.5) * 400 + (Math.random() - 0.5) * 40;
    }

    // Left side of paddle
    if (
      b.vx > 0 &&
      prevX + b.r <= px && b.x + b.r > px &&
      b.y + b.r > py && b.y - b.r < py + pH
    ) {
      b.x  = px - b.r;
      b.vx = -Math.abs(b.vx);
    }

    // Right side of paddle
    if (
      b.vx < 0 &&
      prevX - b.r >= px + pw && b.x - b.r < px + pw &&
      b.y + b.r > py && b.y - b.r < py + pH
    ) {
      b.x  = px + pw + b.r;
      b.vx = Math.abs(b.vx);
    }

    // Block collisions
    for (const block of g.blocks) {
      if (!circleRect(b, block)) continue;

      g.combo++;
      const multiplier = g.activeEffects.score_mult > 0 ? 2 : 1;
      const pts = block.points * Math.ceil(g.combo / 3) * multiplier;
      g.score += pts;
      g.blocks = g.blocks.filter(bl => bl !== block);

      // Spawn power-up drop (spawnPowerup imported in Task 7)
      if (Math.random() < g.dropChance) {
        const drop = spawnPowerup(block);
        if (drop) g.drops.push(drop);
      }

      // Fireball: pass through without bouncing
      if (!(g.activeEffects.fireball > 0)) {
        const overlapX = Math.min(b.x - block.x, (block.x + block.w) - b.x);
        const overlapY = Math.min(b.y - block.y, (block.y + block.h) - b.y);
        if (overlapX < overlapY) b.vx = -b.vx;
        else                     b.vy = -b.vy;
      }
      break;
    }
  }
}

function render(ctx, g) {
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

  // Blocks
  for (const block of g.blocks) {
    ctx.fillStyle = block.color + '33';
    ctx.fillRect(block.x, block.y, block.w, block.h);
    ctx.strokeStyle = block.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(block.x, block.y, block.w, block.h);
    // Glow
    ctx.shadowColor = block.color;
    ctx.shadowBlur = 6;
    ctx.strokeRect(block.x, block.y, block.w, block.h);
    ctx.shadowBlur = 0;
  }

  // Paddle
  const px = g.paddleX, py = g.paddleY, pw = g.effectivePaddleW;
  ctx.fillStyle = '#00ffff22';
  ctx.fillRect(px, py, pw, 12);
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 10;
  ctx.strokeRect(px, py, pw, 12);
  ctx.shadowBlur = 0;

  // Balls
  for (const b of g.balls) {
    const isFireball = g.activeEffects.fireball > 0;
    const isSticky   = g.stickyBall?.ball === b;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle   = isFireball ? '#ff6600' : '#ffffff';
    ctx.shadowColor = isFireball ? '#ff4400' : '#38d4d4';
    ctx.shadowBlur  = isFireball ? 20 : 14;
    ctx.fill();
    ctx.shadowBlur  = 0;

    // Sticky tether line
    if (isSticky) {
      ctx.strokeStyle = '#e04ca0';
      ctx.lineWidth   = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + b.r);
      ctx.lineTo(b.x, g.paddleY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Combo indicator
  if (g.combo > 1) {
    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 11px "Space Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`×${g.combo} COMBO`, CANVAS_W - 10, CANVAS_H - 10);
  }
}

function circleRect(b, r) {
  const nearX = clamp(b.x, r.x, r.x + r.w);
  const nearY = clamp(b.y, r.y, r.y + r.h);
  const dx = b.x - nearX, dy = b.y - nearY;
  return dx * dx + dy * dy < b.r * b.r;
}

// stickyBall.ball must be a member of g.balls — ensured by catchPowerup in powerups.js
function releaseStickyBall(g) {
  if (!g.stickyBall) return;
  const b = g.stickyBall.ball;
  const speed = 220 * (1 + g.elapsed / SESSION_SECS * 0.6);
  b.vx = (Math.random() - 0.5) * 200;
  b.vy = -speed * 0.9;
  g.stickyBall = null;
}

// Placeholder — replaced by real import in Task 7
function spawnPowerup(block) { return null; }

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
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
