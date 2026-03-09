// js/ui/automation-panel.js

import { state, on, off } from '../state.js';
import { getAutoBreakdown, getTotalAutoRate } from '../automation.js';
import { formatNumber } from '../utils.js';

export function initAutomationPanel() {
  renderAutomationPanel();
  const refresh = () => renderAutomationPanel();
  on('tick',        refresh);
  on('game:result', refresh);
  observePanelClose(() => {
    off('tick',        refresh);
    off('game:result', refresh);
  });
}

function renderAutomationPanel() {
  const body = document.getElementById('panel-body');
  if (!body) return;

  const games = [
    { id: 'paddle', label: 'PADDLE.EXE' },
    { id: 'target', label: 'TARGET.EXE' },
    { id: 'circuit', label: 'CIRCUIT.EXE' },
  ];

  const totalRate = getTotalAutoRate();

  body.innerHTML = `
    <div class="auto-stat-row" style="margin-bottom:16px">
      <span>TOTAL INCOME</span>
      <span>${formatNumber(totalRate)}/sec</span>
    </div>
    ${games.map(g => renderGameSection(g.id, g.label)).join('')}
    <div style="font-size:0.62rem;color:var(--text-dim);margin-top:12px;line-height:1.6">
      Automation earns Bits while you're away.<br>
      Play sessions to increase mastery and consistency.
    </div>
  `;
}

function renderGameSection(gameId, label) {
  const g = state.games[gameId];
  if (!g) return '';

  if (!g.unlocked) {
    return `
      <div class="auto-game-section" style="opacity:0.4">
        <div class="auto-game-title">${label}</div>
        <div style="font-size:0.65rem;color:var(--text-dim)">LOCKED</div>
      </div>
    `;
  }

  const bd = getAutoBreakdown(gameId);
  const consistencyPct = (bd.consistency * 100 / 1.5).toFixed(0); // normalize to %

  return `
    <div class="auto-game-section">
      <div class="auto-game-title">${label}</div>
      <div class="mastery-bar-wrap">
        <div class="mastery-bar-bg">
          <div class="mastery-bar-fill" style="width:${bd.mastery}%"></div>
        </div>
        <div class="mastery-pct">${bd.mastery.toFixed(1)}%</div>
      </div>
      <div class="auto-stat-row"><span>RATE</span><span>${formatNumber(bd.rate)}/sec</span></div>
      <div class="auto-stat-row"><span>CONSISTENCY</span><span>${consistencyPct}%</span></div>
      <div class="auto-stat-row"><span>BEST SCORE</span><span>${formatNumber(bd.bestScore)}</span></div>
      <div class="auto-stat-row"><span>AVG SCORE</span><span>${formatNumber(bd.avgScore)}</span></div>
    </div>
  `;
}

function observePanelClose(cb) {
  const panelBody = document.getElementById('panel-body');
  if (!panelBody) return;
  const observer = new MutationObserver(() => {
    if (!panelBody.isConnected) { cb(); observer.disconnect(); }
  });
  observer.observe(document.getElementById('panel-overlay'), { childList: true, subtree: true });
}
