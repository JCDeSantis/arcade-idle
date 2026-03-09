// js/games/powerups.js — power-up type definitions, drop system, effects, rendering

export const POWERUP_DEFS = [
  { id: 'multi_ball',  label: 'MULTI',   icon: '⚡', color: '#e89830', duration:  0  },
  { id: 'slow_mo',     label: 'SLOW',    icon: '🌀', color: '#38d4d4', duration:  8  },
  { id: 'fireball',    label: 'FIRE',    icon: '🔥', color: '#e04848', duration:  5  },
  { id: 'wide_paddle', label: 'WIDE',    icon: '↔',  color: '#3ecb7c', duration: 10  },
  { id: 'sticky',      label: 'STICKY',  icon: '🔒', color: '#e04ca0', duration: -1  }, // -1 = until released
  { id: 'shield',      label: 'SHIELD',  icon: '🛡', color: '#4488ff', duration: -2  }, // -2 = until used
  { id: 'score_mult',  label: '2×',      icon: '★',  color: '#e89830', duration: 10  },
  { id: 'row_clear',   label: 'CLEAR',   icon: '💥', color: '#e04848', duration:  0  },
];

const DROP_SPEED = 120; // px/s
const CAPSULE_W  = 32;
const CAPSULE_H  = 14;

/**
 * Create a falling capsule at the center of the broken block.
 * @param {object} block  — { x, y, w, h }
 * @returns capsule object to push into game.drops[]
 */
export function spawnPowerup(block) {
  const def = POWERUP_DEFS[Math.floor(Math.random() * POWERUP_DEFS.length)];
  return {
    def,
    x: block.x + block.w / 2,
    y: block.y + block.h / 2,
  };
}

/**
 * Tick all falling drops and all active timed effects.
 * Mutates game.drops, game.activeEffects in place.
 * @param {object} game  — full game state
 * @param {number} dt    — delta time in seconds
 * @param {number} CANVAS_H
 */
export function updatePowerups(game, dt, CANVAS_H) {
  // Move drops downward; collect caught or expired
  const caught = [];
  game.drops = game.drops.filter(drop => {
    drop.y += DROP_SPEED * dt;
    if (drop.y > CANVAS_H + CAPSULE_H) return false; // fell off screen

    // Check paddle catch — simple AABB of capsule vs paddle
    const px = game.paddleX, pw = game.effectivePaddleW ?? game.paddleW;
    const py = game.paddleY;
    if (
      drop.x + CAPSULE_W / 2 > px &&
      drop.x - CAPSULE_W / 2 < px + pw &&
      drop.y + CAPSULE_H / 2 > py &&
      drop.y - CAPSULE_H / 2 < py + 12 // 12 = paddle height (matches paddle.js)
    ) {
      caught.push(drop);
      return false;
    }
    return true;
  });

  caught.forEach(drop => catchPowerup(game, drop));

  // Tick timed active effects
  for (const id of Object.keys(game.activeEffects)) {
    const t = game.activeEffects[id];
    if (t > 0) {
      game.activeEffects[id] = t - dt;
      if (game.activeEffects[id] <= 0) delete game.activeEffects[id];
    }
    // Negative values (sticky=-1, shield=-2) are managed elsewhere
  }
}

/**
 * Apply the effect of a caught power-up capsule to game state.
 */
export function catchPowerup(game, drop) {
  const { id, duration } = drop.def;

  switch (id) {
    case 'multi_ball': {
      // Clone each existing ball with mirrored vx
      const newBalls = game.balls.map(b => ({
        ...b,
        vx: -b.vx + (Math.random() - 0.5) * 40,
      }));
      game.balls.push(...newBalls);
      break;
    }
    case 'slow_mo':
      game.activeEffects.slow_mo = duration;
      break;
    case 'fireball':
      game.activeEffects.fireball = duration;
      break;
    case 'wide_paddle':
      game.activeEffects.wide_paddle = duration;
      break;
    case 'sticky':
      // Attach first ball to paddle
      if (game.balls.length > 0) {
        const b = game.balls[0];
        game.stickyBall = { ball: b, offsetX: b.x - (game.paddleX + game.effectivePaddleW / 2) };
        b.vx = 0; b.vy = 0;
      }
      break;
    case 'shield':
      game.shieldActive = true;
      break;
    case 'score_mult':
      game.activeEffects.score_mult = duration;
      break;
    case 'row_clear': {
      if (game.blocks.length === 0) break;
      const maxY = Math.max(...game.blocks.map(bl => bl.y));
      game.blocks = game.blocks.filter(bl => bl.y < maxY);
      break;
    }
  }
}

/**
 * Draw falling capsules and the active-effects HUD strip.
 */
export function renderPowerups(ctx, game) {
  // Draw falling capsules
  for (const drop of game.drops) {
    const { color, icon } = drop.def;
    const x = drop.x - CAPSULE_W / 2;
    const y = drop.y - CAPSULE_H / 2;

    ctx.save();
    ctx.shadowColor  = color;
    ctx.shadowBlur   = 8;
    ctx.strokeStyle  = color;
    ctx.lineWidth    = 1.5;
    ctx.fillStyle    = color + '33';
    _roundRect(ctx, x, y, CAPSULE_W, CAPSULE_H, 4);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle  = '#ffffff';
    ctx.font       = '10px "Space Mono", monospace';
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, drop.x, drop.y);
    ctx.restore();
  }

  // Active effects HUD strip — just above the paddle
  const hudY = game.paddleY - 20;
  let hudX   = 8;
  const ae   = game.activeEffects;

  for (const def of POWERUP_DEFS) {
    const t = ae[def.id];
    if (!t || t <= 0) continue; // skip instant / inactive

    ctx.save();
    ctx.fillStyle    = def.color + '22';
    ctx.strokeStyle  = def.color;
    ctx.lineWidth    = 1;
    ctx.shadowColor  = def.color;
    ctx.shadowBlur   = 4;
    _roundRect(ctx, hudX, hudY - 10, 42, 14, 3);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle    = def.color;
    ctx.font         = '9px "Space Mono", monospace';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${def.icon} ${t.toFixed(0)}s`, hudX + 3, hudY - 3);
    ctx.restore();

    hudX += 48;
  }

  // Shield indicator: glowing line at bottom of canvas
  if (game.shieldActive) {
    ctx.save();
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#4488ff';
    ctx.shadowBlur  = 10;
    ctx.beginPath();
    ctx.moveTo(0, game.paddleY + 18);
    ctx.lineTo(480, game.paddleY + 18); // CANVAS_W
    ctx.stroke();
    ctx.restore();
  }
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
