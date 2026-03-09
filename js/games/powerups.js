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
