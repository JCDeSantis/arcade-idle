// js/ui/upgrades-panel.js

import { state, on, off } from '../state.js';
import {
  getVisibleUpgrades, getUpgradeLevel, getUpgradeCost,
  canAfford, purchaseUpgrade
} from '../upgrades.js';
import { formatNumber } from '../utils.js';

export function initUpgradesPanel() {
  renderUpgradesPanel();
  const refresh = () => renderUpgradesPanel();
  on('currency:change', refresh);
  on('upgrade:change',  refresh);
  observePanelClose(() => {
    off('currency:change', refresh);
    off('upgrade:change',  refresh);
  });
}

function renderUpgradesPanel() {
  const body = document.getElementById('panel-body');
  if (!body) return;

  const upgrades = getVisibleUpgrades();
  body.innerHTML = upgrades.map(u => {
    const level    = getUpgradeLevel(u.id);
    const cost     = getUpgradeCost(u.id);
    const maxed    = level >= u.maxLevel;
    const afford   = canAfford(u.id);
    const classes  = ['upgrade-card', maxed ? 'maxed' : '', !afford && !maxed ? 'unaffordable' : '']
      .filter(Boolean).join(' ');

    const currSymbol = { bits: 'B', trainingData: 'TD', neuralCredits: 'NC' }[u.currency];

    return `
      <div class="${classes}" data-id="${u.id}">
        <div class="upgrade-icon">${u.icon}</div>
        <div class="upgrade-info">
          <div class="upgrade-name">${u.name}</div>
          <div class="upgrade-desc">${u.desc}</div>
        </div>
        <div>
          <div class="upgrade-cost">${maxed ? 'MAX' : formatNumber(cost) + ' ' + currSymbol}</div>
          <div class="upgrade-level">LVL ${level}/${u.maxLevel}</div>
        </div>
      </div>
    `;
  }).join('');

  body.querySelectorAll('.upgrade-card:not(.maxed):not(.unaffordable)').forEach(card => {
    card.addEventListener('click', () => {
      purchaseUpgrade(card.dataset.id);
    });
  });
}

function observePanelClose(cb) {
  const observer = new MutationObserver(() => {
    if (!document.getElementById('panel-body')) {
      cb();
      observer.disconnect();
    }
  });
  observer.observe(document.getElementById('panel-overlay'), { childList: true });
}
