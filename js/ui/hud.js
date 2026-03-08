// js/ui/hud.js — always-visible currency bar

import { state, on } from '../state.js';
import { formatNumber } from '../utils.js';

export function initHUD() {
  document.getElementById('hud').innerHTML = `
    <span class="game-title">ARCADE IDLE</span>
    <div class="hud-currencies">
      <div class="hud-currency bits">
        <span class="label">BITS</span>
        <span class="value" id="hud-bits">0</span>
      </div>
      <div class="hud-currency td">
        <span class="label">TD</span>
        <span class="value" id="hud-td">0</span>
      </div>
      <div class="hud-currency nc">
        <span class="label">NC</span>
        <span class="value" id="hud-nc">0</span>
      </div>
    </div>
    <div style="font-size:0.6rem;color:var(--text-dim)" id="hud-rate"></div>
  `;

  on('currency:change', () => updateHUD());
  on('tick', ({ rate }) => updateRate(rate));
  updateHUD();
}

function updateHUD() {
  setText('hud-bits', formatNumber(state.currencies.bits));
  setText('hud-td',   formatNumber(state.currencies.trainingData));
  setText('hud-nc',   formatNumber(state.currencies.neuralCredits));
}

function updateRate(rate) {
  const el = document.getElementById('hud-rate');
  if (el && rate > 0) el.textContent = `+${formatNumber(rate)}/s`;
  else if (el) el.textContent = '';
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.textContent !== text) {
    el.textContent = text;
    el.classList.remove('bump');
    void el.offsetWidth; // reflow to restart animation
    el.classList.add('bump');
  }
}
