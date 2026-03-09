// js/ui/prestige-panel.js

import { state, on, off } from '../state.js';
import { PRESTIGE_UPGRADES, calcPrestigeNC, canPrestige, doPrestige, buyPrestigeUpgrade } from '../prestige.js';
import { formatNumber } from '../utils.js';

export function initPrestigePanel() {
  renderPrestigePanel();
  const refresh = () => renderPrestigePanel();
  on('currency:change',         refresh);
  on('prestige-upgrade:change', refresh);
  observePanelClose(() => {
    off('currency:change',         refresh);
    off('prestige-upgrade:change', refresh);
  });
}

function renderPrestigePanel() {
  const body = document.getElementById('panel-body');
  if (!body) return;

  const nc       = calcPrestigeNC();
  const eligible = canPrestige();

  body.innerHTML = `
    <div class="prestige-info">
      <div class="prestige-nc-preview">+${nc} NC</div>
      <div class="prestige-nc-label">Neural Credits on prestige</div>
    </div>
    <button class="prestige-btn" id="prestige-go-btn" ${!eligible ? 'disabled' : ''}>
      ▶ PRESTIGE NOW
    </button>
    ${!eligible ? '<div style="font-size:0.62rem;color:var(--text-dim);text-align:center;margin-bottom:16px">Reach Stage 2 to unlock prestige</div>' : ''}
    <div class="section-label">PERMANENT UPGRADES</div>
    ${PRESTIGE_UPGRADES.map(u => renderPrestigeUpgrade(u)).join('')}
  `;

  document.getElementById('prestige-go-btn')?.addEventListener('click', () => {
    if (!canPrestige()) return;
    if (!confirm('Prestige? This resets your progress but awards Neural Credits.')) return;
    doPrestige();
    import('../ui/panel.js').then(m => m.closePanel());
  });

  body.querySelectorAll('.prestige-upgrade-card:not(.owned):not(.unaffordable)').forEach(card => {
    card.addEventListener('click', () => buyPrestigeUpgrade(card.dataset.id));
  });
}

function renderPrestigeUpgrade(u) {
  const owned   = !!state.prestigeUpgrades[u.id];
  const afford  = state.currencies.neuralCredits >= u.cost;
  const classes = ['prestige-upgrade-card',
    owned ? 'owned' : '',
    !owned && !afford ? 'unaffordable' : '',
  ].filter(Boolean).join(' ');

  return `
    <div class="${classes}" data-id="${u.id}">
      <div class="upgrade-icon">${u.icon}</div>
      <div class="upgrade-info">
        <div class="upgrade-name">${u.name}</div>
        <div class="upgrade-desc">${u.desc}</div>
      </div>
      <div>
        <div class="upgrade-cost">${owned ? '✓' : u.cost + ' NC'}</div>
      </div>
    </div>
  `;
}

function observePanelClose(cb) {
  const observer = new MutationObserver(() => {
    if (!document.getElementById('panel-body')) { cb(); observer.disconnect(); }
  });
  observer.observe(document.getElementById('panel-overlay'), { childList: true });
}
