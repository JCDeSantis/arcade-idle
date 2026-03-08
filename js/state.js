// js/state.js — global game state + event bus

export let state = null;

export function initState() {
  // Clear any stale listeners from a previous session
  for (const key of Object.keys(listeners)) {
    delete listeners[key];
  }
  state = createDefaultState();
}

export function createDefaultState() {
  return {
    currencies: {
      bits: 0,
      trainingData: 0,
      neuralCredits: 0,
      lifetimeBits: 0,
    },
    stage: 1,
    games: {
      paddle: {
        unlocked: true,
        bestScore: 0,
        recentScores: [],   // last 5 run scores
        mastery: 0,         // 0–100
        totalRuns: 0,
      },
      target: {
        unlocked: false,
        bestScore: 0,
        recentScores: [],
        mastery: 0,
        totalRuns: 0,
      },
    },
    upgrades: {},         // upgradeId -> level (number)
    prestigeUpgrades: {}, // upgradeId -> true/false
    prestige: {
      count: 0,
      lifetimeBits: 0,
    },
    settings: {
      lastSaveTime: Date.now(),
      lastTickTime: Date.now(),
    },
  };
}

// ── Event Bus ────────────────────────────────────────────
const listeners = {};

export function on(event, cb) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(cb);
}

export function off(event, cb) {
  if (!listeners[event]) return;
  listeners[event] = listeners[event].filter(fn => fn !== cb);
}

export function emit(event, data) {
  (listeners[event] || []).forEach(cb => cb(data));
}

// ── Mutations ────────────────────────────────────────────
export function addCurrency(type, amount) {
  if (amount <= 0) return;
  if (!(type in state.currencies)) {
    console.warn('[State] addCurrency: unknown type:', type);
    return;
  }
  state.currencies[type] += amount;
  if (type === 'bits') state.currencies.lifetimeBits += amount;
  emit('currency:change', { type, amount, total: state.currencies[type] });
}

export function spendCurrency(type, amount) {
  if (state.currencies[type] < amount) return false;
  state.currencies[type] -= amount;
  emit('currency:change', { type, amount: -amount, total: state.currencies[type] });
  return true;
}

export function setUpgradeLevel(id, level) {
  state.upgrades[id] = level;
  emit('upgrade:change', { id, level });
}

export function setPrestigeUpgrade(id, owned) {
  state.prestigeUpgrades[id] = owned;
  emit('prestige-upgrade:change', { id, owned });
}

export function recordGameResult(gameId, score) {
  const g = state.games[gameId];
  if (!g) return;
  if (score > g.bestScore) g.bestScore = score;
  g.recentScores.push(score);
  if (g.recentScores.length > 5) g.recentScores.shift();
  g.totalRuns++;

  // Mastery gain: diminishing returns
  const gain = Math.max(0.5, 5 * (1 - g.mastery / 100));
  g.mastery = Math.min(100, g.mastery + gain);

  emit('game:result', { gameId, score, mastery: g.mastery });
}

export function unlockStage2() {
  if (state.stage >= 2) return;
  state.stage = 2;
  state.games.target.unlocked = true;
  emit('stage:unlock', { stage: 2 });
}
