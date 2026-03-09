// js/prestige.js — prestige logic

import { state, addCurrency, spendCurrency, setPrestigeUpgrade, createDefaultState, emit } from './state.js';
import { prestigeBurst } from './ui/particles.js';

export const PRESTIGE_UPGRADES = [
  {
    id: 'better_bootup',
    name: 'Better Bootup',
    desc: 'Start each run with 10% mastery on all games',
    icon: '🚀',
    cost: 1,
  },
  {
    id: 'overclock',
    name: 'Overclock',
    desc: 'Automation rate +15% permanently',
    icon: '⚡',
    cost: 2,
  },
  {
    id: 'data_recovery',
    name: 'Data Recovery',
    desc: 'Keep 20% of Training Data when you prestige',
    icon: '💿',
    cost: 3,
  },
  {
    id: 'fast_learner',
    name: 'Fast Learner',
    desc: 'Mastery grows 25% faster',
    icon: '🧬',
    cost: 2,
  },
  {
    id: 'stage_skip',
    name: 'Stage Skip',
    desc: 'Stage 2 unlocks at 25K Bits instead of 50K',
    icon: '⏭️',
    cost: 4,
  },
];

export function calcPrestigeNC() {
  return Math.floor(Math.sqrt(state.currencies.lifetimeBits / 1000));
}

export function canPrestige() {
  return state.stage >= 2 && calcPrestigeNC() >= 1;
}

export function doPrestige() {
  if (!canPrestige()) return false;

  const nc = calcPrestigeNC();
  const savedTD = state.prestigeUpgrades['data_recovery']
    ? Math.floor(state.currencies.trainingData * 0.20)
    : 0;

  // Reset state to defaults
  const defaults = createDefaultState();
  Object.assign(state.currencies, defaults.currencies);
  state.stage   = defaults.stage;
  state.upgrades = defaults.upgrades;

  // Reset games, but apply Better Bootup if owned
  const startMastery = state.prestigeUpgrades['better_bootup'] ? 10 : 0;
  for (const id of Object.keys(state.games)) {
    const defaultGame = defaults.games[id] || {};
    Object.assign(state.games[id], defaultGame);
    state.games[id].mastery = startMastery;
  }

  // Award NC and restore saved TD
  addCurrency('neuralCredits', nc);
  if (savedTD > 0) addCurrency('trainingData', savedTD);

  // Track prestige history
  state.prestige.count++;
  state.prestige.lifetimeBits += nc; // accumulate lifetime NC context

  emit('prestige', { nc, count: state.prestige.count });
  prestigeBurst();
  return true;
}

export function buyPrestigeUpgrade(id) {
  if (state.prestigeUpgrades[id]) return false;
  const def = PRESTIGE_UPGRADES.find(u => u.id === id);
  if (!def) return false;
  if (!spendCurrency('neuralCredits', def.cost)) return false;
  setPrestigeUpgrade(id, true);
  return true;
}
