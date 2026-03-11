// js/upgrades.js — upgrade definitions and purchase logic

import { state, spendCurrency, setUpgradeLevel } from './state.js';

/**
 * Upgrade definition shape:
 *   id, name, desc, icon, currency, baseCost, costScale, maxLevel, effect(level) -> number
 */
export const UPGRADES = [
  // ── Paddle upgrades ────────────────────────────────────
  {
    id: 'paddle_bit_mult',
    name: 'Data Extractor',
    desc: 'Paddle sessions earn +25% Bits per level',
    icon: '💾',
    currency: 'bits',
    baseCost: 100,
    costScale: 2.5,
    maxLevel: 10,
    effect: lvl => 1 + lvl * 0.25,
  },
  {
    id: 'paddle_td_mult',
    name: 'Training Boost',
    desc: 'Paddle sessions earn +30% Training Data per level',
    icon: '📊',
    currency: 'trainingData',
    baseCost: 20,
    costScale: 2.2,
    maxLevel: 8,
    effect: lvl => 1 + lvl * 0.30,
  },
  {
    id: 'paddle_mastery_rate',
    name: 'Rapid Conditioning',
    desc: 'Paddle mastery grows 20% faster per level',
    icon: '⚡',
    currency: 'bits',
    baseCost: 500,
    costScale: 3,
    maxLevel: 5,
    effect: lvl => 1 + lvl * 0.20,
  },
  // ── Target upgrades ────────────────────────────────────
  {
    id: 'target_bit_mult',
    name: 'Signal Amplifier',
    desc: 'Target sessions earn +25% Bits per level',
    icon: '📡',
    currency: 'bits',
    baseCost: 200,
    costScale: 2.5,
    maxLevel: 10,
    effect: lvl => 1 + lvl * 0.25,
  },
  {
    id: 'target_td_mult',
    name: 'Reflex Logger',
    desc: 'Target sessions earn +30% Training Data per level',
    icon: '🧠',
    currency: 'trainingData',
    baseCost: 40,
    costScale: 2.2,
    maxLevel: 8,
    effect: lvl => 1 + lvl * 0.30,
  },
  // ── Global upgrades ───────────────────────────────────
  {
    id: 'auto_mult',
    name: 'Overclock Core',
    desc: 'All automation earns +20% Bits/sec per level',
    icon: '🔧',
    currency: 'bits',
    baseCost: 1000,
    costScale: 3.5,
    maxLevel: 10,
    effect: lvl => 1 + lvl * 0.20,
  },
  {
    id: 'prestige_bonus',
    name: 'Neural Amplifier',
    desc: 'Prestige bonuses are 10% stronger per level',
    icon: '🌟',
    currency: 'neuralCredits',
    baseCost: 1,
    costScale: 2,
    maxLevel: 5,
    effect: lvl => 1 + lvl * 0.10,
  },
  // ── Paddle gameplay upgrades ──────────────────────────
  {
    id: 'paddle_ball_speed',
    name: 'Velocity Core',
    desc: 'Paddle ball moves +15% faster per level',
    icon: '💨',
    currency: 'bits',
    baseCost: 300,
    costScale: 2.8,
    maxLevel: 5,
    effect: lvl => 1 + lvl * 0.15,
  },
  {
    id: 'paddle_size',
    name: 'Paddle Expander',
    desc: 'Paddle is +15% wider per level',
    icon: '📏',
    currency: 'bits',
    baseCost: 200,
    costScale: 2.5,
    maxLevel: 5,
    effect: lvl => 1 + lvl * 0.15,
  },
  {
    id: 'paddle_powerup_chance',
    name: 'Loot Matrix',
    desc: '+8% power-up drop chance per level (max 40%)',
    icon: '🎁',
    currency: 'trainingData',
    baseCost: 30,
    costScale: 2.2,
    maxLevel: 5,
    effect: lvl => Math.min(lvl * 0.08, 0.40), // raw drop probability (not a multiplier)
  },
  // ── Circuit gameplay upgrades ─────────────────────────
  {
    id: 'circuit_bit_mult',
    name: 'Data Siphon',
    desc: 'Circuit sessions earn +25% Bits per level',
    icon: '🔌',
    currency: 'bits',
    baseCost: 150,
    costScale: 2.5,
    maxLevel: 10,
    effect: lvl => 1 + lvl * 0.25,
  },
  {
    id: 'circuit_td_mult',
    name: 'Signal Mapper',
    desc: 'Circuit sessions earn +30% Training Data per level',
    icon: '📶',
    currency: 'trainingData',
    baseCost: 30,
    costScale: 2.2,
    maxLevel: 8,
    effect: lvl => 1 + lvl * 0.30,
  },
  {
    id: 'circuit_mastery_rate',
    name: 'Fast Routing',
    desc: 'Circuit mastery grows 20% faster per level',
    icon: '🔀',
    currency: 'bits',
    baseCost: 500,
    costScale: 3,
    maxLevel: 5,
    effect: lvl => 1 + lvl * 0.20,
  },
  {
    id: 'circuit_node_lifetime',
    name: 'Extended Window',
    desc: 'Circuit nodes charge 15% slower per level',
    icon: '⏳',
    currency: 'bits',
    baseCost: 250,
    costScale: 2.6,
    maxLevel: 5,
    effect: lvl => 1 + lvl * 0.15,
  },
  {
    id: 'circuit_chain_bonus',
    name: 'Overclock Chain',
    desc: 'Chain multiplier thresholds activate 1 node sooner per level',
    icon: '⛓',
    currency: 'bits',
    baseCost: 400,
    costScale: 3,
    maxLevel: 2,
    effect: lvl => lvl, // raw level (0, 1, or 2) — used directly as threshold offset
  },
  {
    id: 'circuit_powerup_chance',
    name: 'Loot Splice',
    desc: 'Power-up nodes graft into the circuit 10% more often per level',
    icon: '🎲',
    currency: 'trainingData',
    baseCost: 25,
    costScale: 2.2,
    maxLevel: 5,
    effect: lvl => lvl * 0.10, // raw rate modifier (not a multiplier)
  },
];

export function getUpgradeDef(id) {
  return UPGRADES.find(u => u.id === id);
}

export function getUpgradeLevel(id) {
  return state.upgrades[id] ?? 0;
}

export function getUpgradeValue(id) {
  const def = getUpgradeDef(id);
  if (!def) return 1;
  const level = getUpgradeLevel(id);
  return def.effect(level);
}

export function getUpgradeCost(id) {
  const def = getUpgradeDef(id);
  if (!def) return Infinity;
  const level = getUpgradeLevel(id);
  return Math.floor(def.baseCost * Math.pow(def.costScale, level));
}

export function canAfford(id) {
  const def = getUpgradeDef(id);
  if (!def) return false;
  const cost = getUpgradeCost(id);
  return state.currencies[def.currency] >= cost;
}

export function purchaseUpgrade(id) {
  const def = getUpgradeDef(id);
  if (!def) return false;
  const level = getUpgradeLevel(id);
  if (level >= def.maxLevel) return false;
  const cost = getUpgradeCost(id);
  if (!spendCurrency(def.currency, cost)) return false;
  setUpgradeLevel(id, level + 1);
  return true;
}

const GAME_IDS = ['paddle', 'target', 'circuit'];

/** Return upgrades relevant to a specific context.
 *  context: 'paddle' | 'target' | 'circuit' | 'global'
 */
export function getUpgradesForContext(context) {
  if (context === 'global') {
    return UPGRADES.filter(u => {
      if (GAME_IDS.some(id => u.id.startsWith(id + '_'))) return false;
      if (u.id === 'prestige_bonus' && state.stage < 2) return false;
      return true;
    });
  }
  return UPGRADES.filter(u => {
    if (!u.id.startsWith(context + '_')) return false;
    if (!state.games[context]?.unlocked) return false;
    return true;
  });
}
