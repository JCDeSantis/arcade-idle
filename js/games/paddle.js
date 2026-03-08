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
      e.clientX - rect.left - game.paddleW / 2,
      0, CANVAS_W - game.paddleW
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
        alive: true,
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
    ball: {
      x: CANVAS_W / 2,
      y: CANVAS_H / 2,
      r: 7,
      vx: 220 * (Math.random() > 0.5 ? 1 : -1),
      vy: -220,
    },
    _keys: {},
  };
}

function update(g, dt) {
  const b = g.ball;
  const SPEED_SCALE = 1 + g.elapsed / SESSION_SECS * 0.6; // speeds up over time

  // Keyboard paddle movement
  const spd = 400 * dt;
  if (g._keys['ArrowLeft']  || g._keys['a']) g.paddleX = clamp(g.paddleX - spd, 0, CANVAS_W - g.paddleW);
  if (g._keys['ArrowRight'] || g._keys['d']) g.paddleX = clamp(g.paddleX + spd, 0, CANVAS_W - g.paddleW);

  b.x += b.vx * dt * SPEED_SCALE;
  b.y += b.vy * dt * SPEED_SCALE;

  // Wall bounce
  if (b.x - b.r < 0)           { b.x = b.r;            b.vx = Math.abs(b.vx); }
  if (b.x + b.r > CANVAS_W)    { b.x = CANVAS_W - b.r; b.vx = -Math.abs(b.vx); }
  if (b.y - b.r < 0)           { b.y = b.r;             b.vy = Math.abs(b.vy); }

  // Ball lost bottom — small score penalty, reset ball
  if (b.y - b.r > CANVAS_H) {
    g.score = Math.max(0, g.score - 50);
    g.combo = 0;
    b.x = CANVAS_W / 2;
    b.y = CANVAS_H / 2;
    b.vx = 220 * (Math.random() > 0.5 ? 1 : -1);
    b.vy = -220;
  }

  // Paddle collision
  const px = g.paddleX, pw = g.paddleW, py = g.paddleY, ph = 12;
  if (
    b.vy > 0 &&
    b.y + b.r >= py && b.y + b.r <= py + ph &&
    b.x >= px && b.x <= px + pw
  ) {
    b.vy = -Math.abs(b.vy);
    // Angle based on hit position
    const hitFrac = (b.x - px) / pw; // 0–1
    b.vx = (hitFrac - 0.5) * 500;
  }

  // Block collisions
  for (const block of g.blocks) {
    if (circleRect(b, block)) {
      g.combo++;
      const pts = block.points * Math.ceil(g.combo / 3);
      g.score += pts;
      g.blocks = g.blocks.filter(bl => bl !== block);
      // Simple reflection: reverse vy
      b.vy = -b.vy;
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
  const px = g.paddleX, py = g.paddleY, pw = g.paddleW;
  ctx.fillStyle = '#00ffff22';
  ctx.fillRect(px, py, pw, 12);
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 10;
  ctx.strokeRect(px, py, pw, 12);
  ctx.shadowBlur = 0;

  // Ball
  const b = g.ball;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.shadowBlur = 0;

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
