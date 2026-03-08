// js/ui/hub.js — main hub screen

import { state, on } from '../state.js';
import { openPanel }  from './panel.js';
import { launchGame } from '../games/launcher.js';

export function initHub() {
  renderHub();
  on('stage:unlock', () => renderHub());
  on('game:result',  () => renderHub());
}

function renderHub() {
  const hub = document.getElementById('hub');
  hub.innerHTML = `
    <div class="hub-games">
      ${gameCard('paddle', '🎮', 'PADDLE')}
      ${gameCard('target', '🎯', 'TARGET')}
    </div>
    <div class="hub-tabs">
      <button class="hub-tab" data-panel="upgrades">UPGRADES</button>
      <button class="hub-tab" data-panel="automation">AUTOMATION</button>
      <button class="hub-tab" data-panel="prestige" id="prestige-tab"
        ${state.stage < 2 ? 'style="display:none"' : ''}>PRESTIGE</button>
    </div>
  `;

  hub.querySelectorAll('.game-card:not(.locked)').forEach(card => {
    card.addEventListener('click', () => launchGame(card.dataset.game));
  });

  hub.querySelectorAll('.hub-tab').forEach(tab => {
    tab.addEventListener('click', () => openPanel(tab.dataset.panel));
  });
}

function gameCard(id, icon, label) {
  const g = state.games[id];
  const locked = !g.unlocked;
  const mastery = g.mastery.toFixed(1);
  const lockMsg = id === 'target' ? 'REACH 50K BITS' : '';

  return `
    <div class="game-card ${locked ? 'locked' : ''}" data-game="${id}">
      <div class="card-icon">${icon}</div>
      <div class="card-title">${label}</div>
      ${locked
        ? `<div class="card-lock-msg">🔒 ${lockMsg}</div>`
        : `<div class="card-mastery">MASTERY ${mastery}%</div>`
      }
    </div>
  `;
}
