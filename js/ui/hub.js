// js/ui/hub.js — main hub screen

import { state, on } from '../state.js';
import { openPanel }  from './panel.js';
import { launchGame } from '../games/launcher.js';
import { saveGame, exportSave, importSave } from '../save.js';

export function initHub() {
  renderHub();
  on('stage:unlock', () => {
    renderHub();
    showNotification('STAGE 2 UNLOCKED — TARGET GAME NOW AVAILABLE', 'var(--amber)');
  });
  on('game:result',  () => renderHub());
  on('prestige', ({ nc, count }) => {
    renderHub();
    showNotification(`PRESTIGE #${count} — +${nc} NEURAL CREDITS`, 'var(--green)');
  });
}

function renderHub() {
  const hub = document.getElementById('hub');
  hub.innerHTML = `
    <div class="hub-games">
      ${gameCard('paddle', '🎮', 'PADDLE')}
      ${gameCard('target', '🎯', 'TARGET')}
    </div>
    <div class="hub-title">AI TRAINING ARCADE</div>
    ${state.prestige.count > 0 ? `<div class="hub-prestige-badge">PRESTIGE ${state.prestige.count}</div>` : ''}
    <div class="hub-tabs">
      <button class="hub-tab" data-panel="upgrades">UPGRADES</button>
      <button class="hub-tab" data-panel="automation">AUTOMATION</button>
      <button class="hub-tab" data-panel="prestige" id="prestige-tab"
        ${state.stage < 2 ? 'style="display:none"' : ''}>PRESTIGE</button>
    </div>
    <div style="display:flex;gap:8px;margin-top:auto">
      <button class="hub-tab" id="save-btn">💾 SAVE</button>
      <button class="hub-tab" id="export-btn">📤 EXPORT</button>
      <button class="hub-tab" id="import-btn">📥 IMPORT</button>
    </div>
  `;

  hub.querySelectorAll('.game-card:not(.locked)').forEach(card => {
    card.addEventListener('click', () => launchGame(card.dataset.game));
  });

  hub.querySelectorAll('.hub-tab').forEach(tab => {
    tab.addEventListener('click', () => openPanel(tab.dataset.panel));
  });

  document.getElementById('save-btn').addEventListener('click', () => {
    saveGame();
    const btn = document.getElementById('save-btn');
    btn.textContent = '✓ SAVED';
    setTimeout(() => { if (btn.isConnected) btn.textContent = '💾 SAVE'; }, 1500);
  });

  document.getElementById('export-btn').addEventListener('click', () => {
    const data = exportSave();
    navigator.clipboard.writeText(data)
      .then(() => showNotification('SAVE COPIED TO CLIPBOARD', 'var(--cyan)'))
      .catch(() => prompt('Copy this save data:', data));
  });

  document.getElementById('import-btn').addEventListener('click', () => {
    const data = prompt('Paste save data:');
    if (data?.trim()) importSave(data.trim());
  });
}

function showNotification(msg, color = 'var(--cyan)') {
  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: var(--bg2); border: 1px solid ${color};
    color: ${color}; font-family: var(--font); font-size: 0.72rem;
    letter-spacing: 2px; padding: 10px 24px; border-radius: 4px;
    z-index: 200; animation: fadeIn 0.3s ease;
    box-shadow: 0 0 12px ${color}44;
    white-space: nowrap;
  `;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
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
