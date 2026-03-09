// js/main.js — entry point
import { initState } from './state.js';
import { loadSave }  from './save.js';
import { startLoop } from './loop.js';
import { initHUD }   from './ui/hud.js';
import { initHub }   from './ui/hub.js';
import { initParticles } from './ui/particles.js';
import './prestige.js'; // ensure prestige module is loaded

function main() {
  initState();
  loadSave();
  initParticles();
  initHUD();
  initHub();
  startLoop();
  console.log('[ArcadeIdle] initialized');
}

main();
