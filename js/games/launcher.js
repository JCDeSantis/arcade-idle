// js/games/launcher.js

import { launchPaddle }   from './paddle.js';
import { launchTarget }   from './target.js';
import { launchCircuit }  from './circuit.js';

const launchers = {
  paddle:  launchPaddle,
  target:  launchTarget,
  circuit: launchCircuit,
};

export function launchGame(id) {
  const launch = launchers[id];
  if (!launch) return console.warn('[Launcher] unknown game:', id);
  launch(() => {
    console.log('[Launcher] returned from:', id);
  });
}
