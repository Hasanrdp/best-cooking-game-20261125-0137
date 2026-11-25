// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between four screens: title,
// play, paused and game over.
//
// ?seed=N fixes the order pattern. ?shot=cover|rush|grill|serve (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_BAD, EVENT_BURN, EVENT_CHOP, EVENT_CHOP_DONE, EVENT_EXPIRE,
  EVENT_GRILL_DONE, EVENT_OVER, EVENT_PICKUP, EVENT_PLACE, EVENT_SERVE,
  EVENT_TRASH, createWorld,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import {
  SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, createRenderer,
} from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best total then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, renderer.toLogical);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // The title screen shows a kitchen mid-service, staged by the same driver
  // that stages the screenshots, so the first thing a player sees is the game.
  stageShot('cover', world);

  // Screen readers (and anyone watching the page's text) hear the screen changes and each serve.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Main. Ambil bahan, potong, panggang, rakit, sajikan.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.coins > best) {
      best = world.state.coins;
      saveBest(best);
    }
    audio.setSizzle(false);
    audio.over();
    announce(`Shift selesai. ${world.state.served} hidangan, ${world.state.coins} koin.`);
  }

  function handleEvents(events) {
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_PLACE) audio.place();
    if (events & EVENT_CHOP) audio.chop();
    if (events & EVENT_CHOP_DONE) audio.chopDone();
    if (events & EVENT_GRILL_DONE) audio.grillDone();
    if (events & EVENT_BURN) audio.burn();
    if (events & EVENT_TRASH) audio.place();
    if (events & EVENT_BAD) audio.bad();
    if (events & EVENT_EXPIRE) audio.expire();
    if (events & EVENT_SERVE) {
      audio.serve();
      announce(`Tersaji! ${world.state.served} hidangan, ${world.state.coins} koin.`);
    }
    if (events & EVENT_OVER) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const uiTime = now / 1000;

    // One-shot presses, taken once per frame: a press that changes the screen
    // is spent on the change and never also reaches the world.
    const actions = input.takeActions();
    let interactPress = false;
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Suara mati.' : 'Suara hidup.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      if (actions & (ACTION_CONFIRM | ACTION_RESTART)) startGame();
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Lanjut masak.');
      }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        audio.setSizzle(false);
        announce('Jeda.');
      } else if (actions & ACTION_CONFIRM) {
        interactPress = true;
      }
    }

    if (screen === SCREEN_TITLE) {
      renderer.draw(world.state, screen, best, uiTime);
      return;
    }
    if (screen === SCREEN_PLAY) {
      const direction = input.direction();
      const click = input.takeClick();
      let firstStep = true;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        const events = world.step(STEP, {
          dirX: direction.x,
          dirY: direction.y,
          interactPressed: firstStep && interactPress,
          interactHeld: input.interactHeld(),
          click: firstStep ? click : null,
        });
        firstStep = false;
        handleEvents(events);
        audio.setSizzle(world.state.sizzle);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, uiTime);
  }

  // Leaving the tab pauses a running game rather than letting orders expire unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.setSizzle(false);
      announce('Jeda.');
    }
  });

  announce('Warung Senja. Tekan Spasi atau klik untuk mulai.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
