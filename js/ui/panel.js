// js/ui/panel.js

import { initUpgradesPanel }   from './upgrades-panel.js';
import { initAutomationPanel } from './automation-panel.js';
import { initPrestigePanel }   from './prestige-panel.js';

const panelInits = {
  upgrades:   initUpgradesPanel,
  automation: initAutomationPanel,
  prestige:   initPrestigePanel,
};

export function openPanel(name, context) {
  const overlay = document.getElementById('panel-overlay');
  overlay.classList.remove('hidden');

  let title = name.toUpperCase();
  if (name === 'upgrades' && context) {
    title = context === 'global'
      ? 'GLOBAL UPGRADES'
      : `${context.toUpperCase()} UPGRADES`;
  }

  overlay.innerHTML = `
    <div class="side-panel" id="active-panel">
      <div class="panel-header">
        <span class="panel-title">${title}</span>
        <button class="panel-close" id="panel-close-btn">✕ CLOSE</button>
      </div>
      <div class="panel-body" id="panel-body"></div>
    </div>
  `;
  document.getElementById('panel-close-btn').addEventListener('click', closePanel);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closePanel();
  }, { once: true });

  panelInits[name]?.(context);
}

export function closePanel() {
  document.getElementById('panel-overlay').classList.add('hidden');
}

export function refreshPanel() {
  // called by panel contents to re-render themselves
}
