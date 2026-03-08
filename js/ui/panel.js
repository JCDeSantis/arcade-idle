// js/ui/panel.js

import { initUpgradesPanel }   from './upgrades-panel.js';
import { initAutomationPanel } from './automation-panel.js';
import { initPrestigePanel }   from './prestige-panel.js';

const panelInits = {
  upgrades:   initUpgradesPanel,
  automation: initAutomationPanel,
  prestige:   initPrestigePanel,
};

export function openPanel(name) {
  const overlay = document.getElementById('panel-overlay');
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="side-panel" id="active-panel">
      <div class="panel-header">
        <span class="panel-title">${name.toUpperCase()}</span>
        <button class="panel-close" id="panel-close-btn">✕ CLOSE</button>
      </div>
      <div class="panel-body" id="panel-body"></div>
    </div>
  `;
  document.getElementById('panel-close-btn').addEventListener('click', closePanel);
  overlay.addEventListener('click', e => { if (e.target === overlay) closePanel(); });

  panelInits[name]?.();
}

export function closePanel() {
  document.getElementById('panel-overlay').classList.add('hidden');
}
