// Keyboard and pointer input. Held keys give a steering direction; one-shot
// presses (interact, pause, mute) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost and never counted
// twice. A click on the floor sets a walk target; a click on a station walks
// the chef there and uses it on arrival.

import { STATIONS } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const INTERACT = new Set(['Space', 'KeyE', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);

export function createInput(canvas, toLogical) {
  let left = false;
  let right = false;
  let up = false;
  let down = false;
  let interactHeld = false;
  let actions = 0;
  let click = null;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (INTERACT.has(event.code)) {
      interactHeld = true;
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (INTERACT.has(event.code)) interactHeld = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
    up = false;
    down = false;
    interactHeld = false;
  });

  canvas.addEventListener('pointerdown', (event) => {
    const point = toLogical(event.clientX, event.clientY);
    // A click near a station walks to its stand spot and uses it on arrival.
    let station = null;
    let bestDist = 90;
    for (const candidate of STATIONS) {
      const dx = point.x - candidate.rect.x - candidate.rect.w / 2;
      const dy = point.y - candidate.rect.y - candidate.rect.h / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        station = candidate;
      }
    }
    if (station !== null) {
      click = { x: station.stand.x, y: station.stand.y, stationId: station.id };
    } else {
      click = { x: point.x, y: point.y, stationId: null };
    }
  });

  return {
    /** -1, 0 or 1 on each axis, from the keys held down. */
    direction() {
      return {
        x: (right ? 1 : 0) - (left ? 1 : 0),
        y: (down ? 1 : 0) - (up ? 1 : 0),
      };
    },
    interactHeld() {
      return interactHeld;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The click target since the last call, or null. */
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
    /** True when the pointer is over the named station's counter. */
    stationAt(clientX, clientY) {
      const point = toLogical(clientX, clientY);
      for (const candidate of STATIONS) {
        if (point.x >= candidate.rect.x && point.x <= candidate.rect.x + candidate.rect.w
          && point.y >= candidate.rect.y && point.y <= candidate.rect.y + candidate.rect.h) {
          return candidate.id;
        }
      }
      return null;
    },
  };
}
