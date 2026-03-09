// js/games/target.js — click-to-hit target mini-game

import { submitResult, showResults } from './base-game.js';

const CANVAS_W = 480;
const CANVAS_H = 420;
const SESSION_SECS = 30;
const MIN_SPAWN_INTERVAL = 0.6;
const MAX_SPAWN_INTERVAL = 1.4;
const TARGET_LIFETIME = 2.5;  // seconds before shrinking away
const TARGET_MIN_R = 14;
const TARGET_MAX_R = 36;

export function launchTarget(onExit) {
  const overlay = createOverlay('TARGET.EXE');
  const canvas  = overlay.querySelector('canvas');
  const ctx     = canvas.getContext('2d');
  const scoreEl = overlay.querySelector('#g-score');
  const timerEl = overlay.querySelector('#g-timer');
  const chainEl = overlay.querySelector('#g-chain');

  const game = initGame();
  let animId  = null;
  let lastTs  = null;

  function loop(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    game.elapsed += dt;
    if (game.elapsed >= SESSION_SECS) {
      cancelAnimationFrame(animId);
      endSession();
      return;
    }

    update(game, dt);
    render(ctx, game);

    scoreEl.textContent = game.score;
    timerEl.textContent = Math.ceil(SESSION_SECS - game.elapsed);
    chainEl.textContent = game.chain > 1 ? `×${game.chain}` : '';

    animId = requestAnimationFrame(loop);
  }

  function endSession() {
    const rewards = submitResult('target', game.score);
    showResults('target', game.score, rewards, () => {
      overlay.remove();
      onExit();
    });
  }

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    handleClick(game, mx, my);
  });

  animId = requestAnimationFrame(loop);
  document.getElementById('app').appendChild(overlay);
}

function initGame() {
  return {
    score:     0,
    elapsed:   0,
    chain:     0,
    chainTime: 0,
    targets:   [],
    nextSpawn: randBetween(0.3, 0.8),
  };
}

function update(g, dt) {
  // Chain resets after 1.5s of no hit
  if (g.chain > 0) {
    g.chainTime += dt;
    if (g.chainTime > 1.5) { g.chain = 0; g.chainTime = 0; }
  }

  // Spawn new targets
  g.nextSpawn -= dt;
  if (g.nextSpawn <= 0) {
    g.targets.push(spawnTarget());
    g.nextSpawn = randBetween(MIN_SPAWN_INTERVAL, MAX_SPAWN_INTERVAL);
  }

  // Age targets and shrink radius
  for (const t of g.targets) {
    t.age += dt;
    t.r = TARGET_MAX_R * Math.max(0, 1 - t.age / TARGET_LIFETIME);
  }

  // Remove expired targets (chain breaks on miss)
  const before = g.targets.length;
  g.targets = g.targets.filter(t => t.r > TARGET_MIN_R);
  if (g.targets.length < before) {
    g.chain = 0;
    g.chainTime = 0;
  }
}

function render(ctx, g) {
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Grid
  ctx.strokeStyle = 'rgba(255,0,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < CANVAS_W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
  }
  for (let y = 0; y < CANVAS_H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
  }

  for (const t of g.targets) {
    const alpha = t.r / TARGET_MAX_R;
    const color = `rgba(255, 0, 255, ${alpha.toFixed(2)})`;

    // Outer ring
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner dot
    ctx.beginPath();
    ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Crosshair lines
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    const cs = t.r * 0.5;
    ctx.beginPath();
    ctx.moveTo(t.x - cs, t.y); ctx.lineTo(t.x + cs, t.y);
    ctx.moveTo(t.x, t.y - cs); ctx.lineTo(t.x, t.y + cs);
    ctx.stroke();
  }
}

function handleClick(g, mx, my) {
  for (let i = g.targets.length - 1; i >= 0; i--) {
    const t = g.targets[i];
    const dx = mx - t.x, dy = my - t.y;
    if (dx * dx + dy * dy <= t.r * t.r) {
      // Score: more points for larger (earlier) hits
      const sizeFrac = t.r / TARGET_MAX_R;
      g.chain++;
      g.chainTime = 0;
      const pts = Math.floor(100 * sizeFrac * Math.ceil(g.chain / 3));
      g.score += pts;
      g.targets.splice(i, 1);
      break;
    }
  }
}

function spawnTarget() {
  return {
    x:   randBetween(TARGET_MAX_R + 10, CANVAS_W - TARGET_MAX_R - 10),
    y:   randBetween(TARGET_MAX_R + 10, CANVAS_H - TARGET_MAX_R - 10),
    r:   TARGET_MAX_R,
    age: 0,
  };
}

function randBetween(a, b) {
  return a + Math.random() * (b - a);
}

function createOverlay(title) {
  const div = document.createElement('div');
  div.id = 'game-overlay';
  div.innerHTML = `
    <div class="game-title-label">${title}</div>
    <div class="game-hud">
      <div class="game-stat">SCORE <span id="g-score">0</span></div>
      <div class="game-stat">TIME <span id="g-timer">${SESSION_SECS}</span></div>
      <div class="game-stat">CHAIN <span id="g-chain"></span></div>
    </div>
    <canvas width="${CANVAS_W}" height="${CANVAS_H}"></canvas>
  `;
  return div;
}
