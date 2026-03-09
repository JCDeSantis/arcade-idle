// js/games/base-game.js — shared session lifecycle and reward calculation

import { state, addCurrency, recordGameResult, emit } from '../state.js';
import { rollingAvg } from '../utils.js';
import { getUpgradeValue } from '../upgrades.js';
import { popParticles } from '../ui/particles.js';

/**
 * Call at the end of a mini-game session.
 * Returns { bits, trainingData, masteryGain }
 */
export function submitResult(gameId, score) {
  const g = state.games[gameId];
  const prevAvg = rollingAvg(g.recentScores);
  const prevMastery = g.mastery;

  // Base Bits: score × upgrade multiplier
  const bitMult = getUpgradeValue(`${gameId}_bit_mult`);
  const bits = Math.floor(score * bitMult);

  // Training Data: only when score beats rolling average
  let td = 0;
  if (score > prevAvg && prevAvg > 0) {
    const tdMult = getUpgradeValue(`${gameId}_td_mult`);
    td = Math.floor((score - prevAvg) * 0.1 * tdMult);
  } else if (prevAvg === 0 && score > 0) {
    // First run always awards some TD
    td = Math.floor(score * 0.05);
  }

  addCurrency('bits', bits);
  if (td > 0) addCurrency('trainingData', td);

  // Update mastery + recent scores
  const masteryRateMult = getUpgradeValue(`${gameId}_mastery_rate`);
  recordGameResult(gameId, score, masteryRateMult);
  const masteryGain = state.games[gameId].mastery - prevMastery;

  emit('session:end', { gameId, score, bits, td, masteryGain });

  return { bits, td, masteryGain };
}

/**
 * Show the result overlay after a session.
 * `onDismiss` is called when the player continues.
 */
export function showResults(gameId, score, rewards, onDismiss) {
  const overlay = document.createElement('div');
  overlay.className = 'result-screen';
  overlay.innerHTML = `
    <div class="result-title">SESSION COMPLETE</div>
    <div class="result-score">${score}</div>
    <div class="result-rewards">
      <div class="result-reward bits">
        <span class="label">BITS</span>
        <span class="amount">+${rewards.bits}</span>
      </div>
      <div class="result-reward td">
        <span class="label">TRAINING DATA</span>
        <span class="amount">+${rewards.td}</span>
      </div>
    </div>
    <div class="result-mastery-change">
      MASTERY <span>+${rewards.masteryGain.toFixed(2)}%</span>
    </div>
    <button class="result-btn">CONTINUE</button>
  `;

  document.getElementById('game-overlay').appendChild(overlay);
  popParticles(window.innerWidth / 2, window.innerHeight / 3, '#00ffff', 20);
  overlay.querySelector('.result-btn').addEventListener('click', () => {
    overlay.remove();
    onDismiss();
  });
}
