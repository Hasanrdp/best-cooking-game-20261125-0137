// The screenshot scenes behind ?shot=cover|rush|grill|serve. Each one plays
// the real rules forward from a fresh world, steered by a small driver that
// walks the chef between stations and uses them, so every frame is what a
// short game really looks like and the same seed always gives the same frame.
//
// The driver works from a queue of actions:
//   use <station>   walk there, press interact, retry until its expect() holds
//   hold <until>    hold the interact key until until() holds (chopping)
//   wait <seconds>  stand still for a while
//   waitUntil <fn>  stand still until fn() holds
//   goto <station>  walk to a station's stand spot without using it
// If an action stalls (the chef stops moving for 1.5 s) or its expect() never
// holds after three tries, the driver drops it and carries on: a scene always
// ends with a real frame, even when the plan went wrong.

import { GRILL_COOKED, STEP, recipeById } from './config.js';
import { EVENT_OVER, EVENT_SERVE } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY } from './render.js';

const MAX_SCENE_SECONDS = 140;
const STALL_SECONDS = 1.5;
const MAX_USE_SECONDS = 8;

function grillHasPatty(state, freshOnly) {
  for (const slot of state.grill) {
    if (slot.item === null) continue;
    if (freshOnly && slot.item.state === 'burnt') continue;
    if (freshOnly && slot.t > GRILL_COOKED + 4) continue;
    return true;
  }
  return false;
}

function plateHas(state, id, itemState) {
  return state.plate.items.some((item) => item.id === id && item.state === itemState);
}

function createDriver(world) {
  const queue = [];
  let current = null;
  let actionTime = 0;
  let attempts = 0;
  let lastX = null;
  let lastY = null;
  let stallTime = 0;

  function push(action) {
    queue.push(action);
  }

  function startAction(action) {
    current = action;
    actionTime = 0;
    attempts = 0;
    stallTime = 0;
    lastX = world.state.chef.x;
    lastY = world.state.chef.y;
    if (action.op === 'use' || action.op === 'goto') world.goToStation(action.station);
  }

  function abandon() {
    current = null;
  }

  /**
   * One driver tick: build the input for this tick, step the world, and
   * advance the action queue. Returns the world's EVENT_* flags.
   */
  function tick() {
    const input = { dirX: 0, dirY: 0, interactPressed: false, interactHeld: false, click: null };
    if (current === null) {
      const next = queue.shift();
      if (next === undefined) return { events: 0, done: true };
      startAction(next);
    }
    if (current.op === 'hold') input.interactHeld = true;
    const events = world.step(STEP, input);
    const state = world.state;
    actionTime += STEP;

    // Stall detection: a walking chef that stops moving is stuck, so drop the action.
    if (current.op === 'use' || current.op === 'goto') {
      const moved = Math.abs(state.chef.x - lastX) + Math.abs(state.chef.y - lastY);
      if (moved < 2) {
        stallTime += STEP;
        if (stallTime > STALL_SECONDS && state.path.length > 0) {
          abandon();
          return { events, done: false };
        }
      } else {
        stallTime = 0;
      }
      lastX = state.chef.x;
      lastY = state.chef.y;
    }

    if (current.op === 'use') {
      const arrived = state.clickTarget === null && state.path.length === 0;
      if (arrived) {
        if (current.expect(state)) {
          current = null;
        } else if (attempts >= 3 || actionTime > MAX_USE_SECONDS) {
          current = null;
        } else {
          attempts += 1;
          actionTime = 0;
          world.goToStation(current.station);
        }
      }
    } else if (current.op === 'goto') {
      if (state.clickTarget === null && state.path.length === 0) current = null;
      else if (actionTime > MAX_USE_SECONDS) current = null;
    } else if (current.op === 'hold') {
      if (current.until(state)) current = null;
      else if (actionTime > current.timeout) current = null;
    } else if (current.op === 'wait') {
      if (actionTime >= current.seconds) current = null;
    } else if (current.op === 'waitUntil') {
      if (current.fn(state)) current = null;
      else if (actionTime > current.timeout) current = null;
    }
    return { events, done: false };
  }

  return { push, tick, get done() { return current === null && queue.length === 0; } };
}

// --- Plan pieces: the same moves a player makes, in the same order --------

function useStation(driver, station, expect) {
  driver.push({ op: 'use', station, expect });
}

function chopIntoPlate(driver, ingredient) {
  useStation(driver, `crate-${ingredient}`, (state) => state.chef.carry !== null && state.chef.carry.id === ingredient);
  useStation(driver, 'board', (state) => state.board.item !== null && state.board.item.id === ingredient);
  driver.push({ op: 'hold', until: (state) => state.board.item !== null && state.board.item.state === 'chopped', timeout: 5 });
  useStation(driver, 'board', (state) => state.chef.carry !== null && state.chef.carry.id === ingredient);
  useStation(driver, 'assembly', (state) => plateHas(state, ingredient, 'chopped'));
}

function grillPatty(driver) {
  useStation(driver, 'crate-patty', (state) => state.chef.carry !== null && state.chef.carry.id === 'patty');
  useStation(driver, 'grill', (state) => state.grill.some((slot) => slot.item !== null && slot.item.id === 'patty'));
}

function takePattyToPlate(driver) {
  useStation(driver, 'grill', (state) => state.chef.carry !== null && state.chef.carry.id === 'patty' && state.chef.carry.state === 'cooked');
  useStation(driver, 'assembly', (state) => plateHas(state, 'patty', 'cooked'));
}

function readyIntoPlate(driver, ingredient) {
  useStation(driver, `crate-${ingredient}`, (state) => state.chef.carry !== null && state.chef.carry.id === ingredient);
  useStation(driver, 'assembly', (state) => plateHas(state, ingredient, 'ready'));
}

/** The full build-and-serve plan for one ticket's recipe. The patty goes on
 * the grill first so it cooks while the rest is chopped, and it is taken off
 * after the first chop so it never burns; the plate is picked up from the
 * assembly counter before the hatch will take it. */
function planServeDish(driver, recipe) {
  const needsPatty = recipe.needs.some((need) => need.id === 'patty');
  const choppables = recipe.needs.filter((need) => need.state === 'chopped').map((need) => need.id);
  const readies = recipe.needs.filter((need) => need.state === 'ready').map((need) => need.id);
  if (needsPatty) grillPatty(driver);
  if (choppables.length > 0) chopIntoPlate(driver, choppables[0]);
  if (needsPatty) takePattyToPlate(driver);
  for (let i = 1; i < choppables.length; i += 1) chopIntoPlate(driver, choppables[i]);
  for (const ingredient of readies) readyIntoPlate(driver, ingredient);
  useStation(driver, 'assembly', (state) => state.chef.carry !== null && state.chef.carry.kind === 'plate');
  useStation(driver, 'hatch', (state) => state.chef.carry === null);
}

/** The cover's mid-assembly plan: two items plated, a patty sizzling, and the
 * chef caught mid-chop (or mid-carry) on the next ingredient. */
function planCover(driver, recipe) {
  const needsPatty = recipe.needs.some((need) => need.id === 'patty');
  const choppables = recipe.needs.filter((need) => need.state === 'chopped').map((need) => need.id);
  const readies = recipe.needs.filter((need) => need.state === 'ready').map((need) => need.id);
  const platedReadies = [];
  let plated = 0;
  for (const ingredient of choppables.slice(0, 2)) {
    chopIntoPlate(driver, ingredient);
    plated += 1;
  }
  for (const ingredient of readies) {
    if (plated >= 2) break;
    readyIntoPlate(driver, ingredient);
    platedReadies.push(ingredient);
    plated += 1;
  }
  if (needsPatty) grillPatty(driver);
  if (choppables.length > 2) {
    const third = choppables[2];
    useStation(driver, `crate-${third}`, (state) => state.chef.carry !== null && state.chef.carry.id === third);
    useStation(driver, 'board', (state) => state.board.item !== null && state.board.item.id === third);
    driver.push({ op: 'hold', until: (state) => state.board.progress >= 0.5, timeout: 4 });
  } else {
    const spare = readies.find((ingredient) => !platedReadies.includes(ingredient));
    if (spare !== undefined) {
      useStation(driver, `crate-${spare}`, (state) => state.chef.carry !== null && state.chef.carry.id === spare);
      driver.push({ op: 'goto', station: 'assembly' });
    } else {
      driver.push({ op: 'goto', station: 'board' });
    }
  }
}

function firstTicketWithPatty(state) {
  for (const order of state.orders) {
    const recipe = recipeById(order.recipe);
    if (recipe.needs.some((need) => need.id === 'patty')) return recipe;
  }
  return state.orders.length > 0 ? recipeById(state.orders[0].recipe) : null;
}

function coverReady(state, recipe) {
  const needsPatty = recipe.needs.some((need) => need.id === 'patty');
  const grillOk = !needsPatty || grillHasPatty(state, true);
  const chopping = state.board.item !== null && state.board.progress >= 0.4;
  // Carrying counts only when the item is ready to plate (a bun, cheese, or
  // a plate): a raw ingredient in hand is just a trip to the board, and
  // walking past the board does not count either.
  const carrying = state.chef.carry !== null
    && (state.chef.carry.kind === 'plate' || state.chef.carry.state === 'ready');
  return state.orders.length >= 2 && state.plate.items.length >= 2 && grillOk
    && (chopping || carrying) && state.time >= 20;
}

/**
 * Set `world` to the named scene (cover, rush, grill or serve) and return the
 * screen to draw over it and the coins to show as the best.
 */
export function stageShot(name, world) {
  world.reset();
  const driver = createDriver(world);
  const maxSteps = Math.floor(MAX_SCENE_SECONDS / STEP);
  let steps = 0;
  let serveStep = -1;
  let recipe = null;

  if (name === 'cover' || name === 'rush' || name === 'serve' || name === 'grill') {
    driver.push({ op: 'waitUntil', fn: (state) => state.orders.length >= (name === 'cover' ? 2 : 1), timeout: 30 });
  }

  let planned = false;
  while (steps < maxSteps) {
    // Build the scene's plan as soon as the tickets it reads are there.
    if (!planned && (name === 'cover' || name === 'rush' || name === 'serve' || name === 'grill')) {
      const ready = name === 'cover' ? world.state.orders.length >= 2 : world.state.orders.length >= 1;
      if (ready) {
        recipe = firstTicketWithPatty(world.state);
        if (recipe !== null) {
          planned = true;
          if (name === 'cover') {
            planCover(driver, recipe);
          } else if (name === 'serve') {
            planServeDish(driver, recipe);
          } else if (name === 'grill') {
            grillPatty(driver);
            driver.push({ op: 'waitUntil', fn: (state) => state.grill.some((slot) => slot.item !== null && slot.t >= 4.3), timeout: 12 });
            driver.push({ op: 'goto', station: 'grill' });
          } else if (name === 'rush') {
            planServeDish(driver, recipe);
            driver.push({ op: 'waitUntil', fn: (state) => state.time >= 40, timeout: 100 });
            // A second dish, mid-assembly, for the rush frame.
            const second = world.state.orders.length > 0 ? recipeById(world.state.orders[0].recipe) : recipe;
            planCover(driver, second);
          }
        }
      }
    }
    const { events, done } = driver.tick();
    steps += 1;
    if (events & EVENT_OVER) break;
    if (events & EVENT_SERVE) serveStep = steps;
    if (name === 'serve' && serveStep >= 0 && steps - serveStep >= 24) break;
    if (name === 'cover' && recipe !== null && coverReady(world.state, recipe)) break;
    if (name === 'grill' && world.state.grill.some((slot) => slot.item !== null && slot.t >= 4.3 && slot.t <= 5.6)
      && world.state.chef.x > 780 && world.state.chef.x < 920 && world.state.chef.y < 260) break;
    if (name === 'rush' && world.state.time >= 50 && world.state.plate.items.length >= 2 && world.state.orders.length >= 2) break;
    if (done) break;
  }
  const over = world.state.over;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.coins };
}
