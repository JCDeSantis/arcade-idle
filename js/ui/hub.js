// js/ui/hub.js — main hub screen

import { state, on } from '../state.js';
import { openPanel }  from './panel.js';
import { launchGame } from '../games/launcher.js';
import { saveGame, exportSave, importSave, deleteSave } from '../save.js';

export function initHub() {
  renderHub();
  on('stage:unlock', ({ stage }) => {
    renderHub();
    if (stage === 2) showNotification('STAGE 2 UNLOCKED — TARGET GAME NOW AVAILABLE', 'var(--amber)');
    if (stage === 3) showNotification('STAGE 3 UNLOCKED — CIRCUIT GAME NOW AVAILABLE', 'var(--cyan)');
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
      ${gameCard('circuit', '🔗', 'CIRCUIT')}
    </div>
    <div class="hub-title">AI TRAINING ARCADE</div>
    ${state.prestige.count > 0 ? `<div class="hub-prestige-badge">PRESTIGE ${state.prestige.count}</div>` : ''}
    <div class="hub-tabs">
      <button class="hub-tab" data-panel="upgrades">UPGRADES</button>
      <button class="hub-tab" data-panel="automation">AUTOMATION</button>
      <button class="hub-tab" data-panel="prestige" id="prestige-tab"
        ${state.stage < 2 ? 'style="display:none"' : ''}>PRESTIGE</button>
    </div>
    <div style="display:flex;gap:8px;margin-top:auto;flex-wrap:wrap;justify-content:center">
      <button class="hub-tab" id="save-btn">SAVE</button>
      <button class="hub-tab" id="export-btn">EXPORT</button>
      <button class="hub-tab" id="import-btn">IMPORT</button>
      <button class="hub-tab hub-tab-danger" id="clear-btn">CLEAR DATA</button>
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

  document.getElementById('clear-btn').addEventListener('click', () => {
    showClearConfirm();
  });
}

function showClearConfirm() {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:300;
    display:flex;align-items:center;justify-content:center;
    animation:fadeIn 0.18s ease;
  `;
  overlay.innerHTML = `
    <div style="
      background:var(--bg2);border:1px solid var(--red);border-radius:4px;
      padding:32px 28px;max-width:320px;width:90%;text-align:center;
      font-family:var(--font);
      box-shadow:0 0 24px #e0484840;
    ">
      <div style="font-size:0.85rem;font-weight:700;letter-spacing:3px;color:var(--red);margin-bottom:12px">
        CLEAR ALL DATA?
      </div>
      <div style="font-size:0.65rem;color:var(--text-dim);line-height:1.7;margin-bottom:24px">
        This will permanently delete all progress,<br>
        upgrades, currency, and mastery.<br>
        <span style="color:var(--text)">This cannot be undone.</span>
      </div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="clear-cancel" style="
          flex:1;padding:10px;background:none;border:1px solid #333340;
          color:var(--text-dim);font-family:var(--font);font-size:0.72rem;
          letter-spacing:1px;cursor:pointer;border-radius:4px;
          transition:all 0.2s ease;
        ">CANCEL</button>
        <button id="clear-confirm" style="
          flex:1;padding:10px;background:none;border:1px solid var(--red);
          color:var(--red);font-family:var(--font);font-size:0.72rem;
          letter-spacing:1px;cursor:pointer;border-radius:4px;
          transition:all 0.2s ease;
        ">DELETE</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#clear-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#clear-confirm').addEventListener('click', () => deleteSave());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
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
  const lockMessages = {
    target:  'REACH 50K BITS',
    circuit: 'REACH 200K BITS',
  };
  const lockMsg = lockMessages[id] ?? '';

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
