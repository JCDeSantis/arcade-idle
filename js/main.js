// js/main.js — entry point (wiring grows with each task)
import { initState } from './state.js';
import { loadSave }  from './save.js';
import { startLoop } from './loop.js';

function main() {
  initState();
  loadSave();
  startLoop();
  console.log('[ArcadeIdle] loop started');
}

main();
