// js/upgrades.js — upgrade definitions and value lookups (stub)

import { state } from './state.js';

/** Returns the effective numeric value of an upgrade effect */
export function getUpgradeValue(key) {
  // Default all multipliers to 1 until upgrades system is built (Task 9)
  const DEFAULTS = {
    paddle_bit_mult: 1,
    paddle_td_mult:  1,
    target_bit_mult: 1,
    target_td_mult:  1,
    auto_mult:       1,
    prestige_bonus:  1,
  };
  return DEFAULTS[key] ?? 1;
}
