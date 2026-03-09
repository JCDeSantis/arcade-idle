// js/automation.js — idle automation calculations

import { state } from './state.js';
import { getUpgradeValue } from './upgrades.js';
import { rollingAvg } from './utils.js';

const BASE_RATE = 10; // bits/sec at 100% mastery, no upgrades

/** Automation rate for a single game (bits/sec) */
export function getAutoRate(gameId) {
  const g = state.games[gameId];
  if (!g || !g.unlocked || g.mastery === 0) return 0;

  const masteryFactor      = g.mastery / 100;
  const consistencyFactor  = calcConsistency(g.recentScores);
  const upgradeMult        = getUpgradeValue('auto_mult');
  const prestigeBonus      = getPrestigeBonus();

  return masteryFactor * consistencyFactor * upgradeMult * prestigeBonus * BASE_RATE;
}

/** Sum of all game auto rates */
export function getTotalAutoRate() {
  return Object.keys(state.games).reduce((sum, id) => sum + getAutoRate(id), 0);
}

/**
 * Consistency factor: how stable are the recent scores?
 * Low variance = high consistency (up to 1.5×)
 * High variance = low consistency (down to 0.5×)
 */
function calcConsistency(scores) {
  if (scores.length < 2) return 1.0;
  const avg = rollingAvg(scores);
  if (avg === 0) return 1.0;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
  const cv = Math.sqrt(variance) / avg; // coefficient of variation (0 = perfect)
  return Math.max(0.5, Math.min(1.5, 1.5 - cv));
}

function getPrestigeBonus() {
  const baseBonus = getUpgradeValue('prestige_bonus');
  const overclock = state.prestigeUpgrades['overclock'] ? 1.15 : 1;
  return baseBonus * overclock;
}

/** Descriptive breakdown for the automation panel */
export function getAutoBreakdown(gameId) {
  const g = state.games[gameId];
  if (!g || !g.unlocked) return null;
  return {
    mastery:     g.mastery,
    consistency: calcConsistency(g.recentScores),
    rate:        getAutoRate(gameId),
    bestScore:   g.bestScore,
    avgScore:    Math.floor(rollingAvg(g.recentScores)),
  };
}
