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

/** Filter upgrades visible to the player based on stage */
export function getVisibleUpgrades() {
  return UPGRADES.filter(u => {
    if (u.id.startsWith('target_') && !state.games.target.unlocked) return false;
    if (u.id === 'prestige_bonus' && state.stage < 2) return false;
    return true;
  });
}
