// Warung Senja's rules and state, with no drawing and no browser in it: the
// chef, the stations, the orders on the board, chopping and grilling, plating
// and serving, coins, combo and hearts. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react (sounds, the
// status line) without the world knowing about screens or sound.
//
// The chef carries at most one thing: a single ingredient, or a plate holding
// up to six items. A plate only ever sits on the assembly counter or in the
// chef's hands. Nothing here allocates after createWorld returns, except the
// small particle and popup lists, which are capped.

import {
  CHEF, CHOP_SECONDS, FIELD, GRILL_BURNT, GRILL_COOKED, HEARTS, INGREDIENTS,
  ORDER, SCORE, SHIFT_SECONDS, STATIONS, freshItem, pickRecipe, recipeById,
  solidRects, stationById,
} from './config.js';

export const EVENT_PICKUP = 1;
export const EVENT_PLACE = 2;
export const EVENT_CHOP = 4;
export const EVENT_CHOP_DONE = 8;
export const EVENT_GRILL_DONE = 16;
export const EVENT_SERVE = 32;
export const EVENT_BAD = 64;
export const EVENT_EXPIRE = 128;
export const EVENT_OVER = 256;
export const EVENT_TRASH = 512;
export const EVENT_BURN = 1024;

const INTERACT_RANGE = 78;
const MAX_PLATE_ITEMS = 6;
const MAX_PARTICLES = 120;
const MAX_POPUPS = 12;

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function circleHitsRect(x, y, radius, rect) {
  const nearX = clamp(x, rect.x, rect.x + rect.w);
  const nearY = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - nearX;
  const dy = y - nearY;
  return dx * dx + dy * dy < radius * radius;
}

export function createWorld(random) {
  const solids = solidRects();
  const state = {
    time: 0,
    shiftLeft: SHIFT_SECONDS,
    coins: 0,
    served: 0,
    missed: 0,
    hearts: HEARTS,
    combo: 0,
    bestCombo: 0,
    chef: { x: 640, y: 470, face: -1, moving: false, walkPhase: 0, carry: null },
    board: { item: null, progress: 0 },
    grill: [
      { item: null, t: 0 },
      { item: null, t: 0 },
    ],
    plate: { items: [] },
    orders: [],
    spawnTimer: ORDER.firstAfter,
    nextOrderId: 1,
    particles: [],
    popups: [],
    steamTimer: 0,
    clickTarget: null,
    path: [],
    over: false,
    overReason: '',
    sizzle: false,
  };

  // --- Pathfinding: a coarse grid search over the open floor --------------
  // The kitchen floor is one open region with a few solid counters in it, so
  // a breadth-first search on 40 px cells finds a walkable route between any
  // two stand spots. Cells are blocked where the chef's circle would touch a
  // solid; the start and goal snap to the nearest open cell, and the exact
  // destination is always the last point of the path.
  const GRID = 40;
  const GRID_COLS = Math.ceil(FIELD.width / GRID);
  const GRID_ROWS = Math.ceil(FIELD.height / GRID);

  function cellBlocked(cx, cy) {
    const x = cx * GRID + GRID / 2;
    const y = cy * GRID + GRID / 2;
    for (const rect of solids) {
      const nearX = clamp(x, rect.x, rect.x + rect.w);
      const nearY = clamp(y, rect.y, rect.y + rect.h);
      const dx = x - nearX;
      const dy = y - nearY;
      if (dx * dx + dy * dy < (CHEF.radius + 4) * (CHEF.radius + 4)) return true;
    }
    return false;
  }

  function nearestOpen(cx, cy) {
    for (let r = 0; r <= 10; r += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= GRID_COLS || ny >= GRID_ROWS) continue;
          if (!cellBlocked(nx, ny)) return { cx: nx, cy: ny };
        }
      }
    }
    return null;
  }

  function findPath(fromX, fromY, toX, toY) {
    const startCell = nearestOpen(
      clamp(Math.floor(fromX / GRID), 0, GRID_COLS - 1),
      clamp(Math.floor(fromY / GRID), 0, GRID_ROWS - 1),
    );
    const goalCell = nearestOpen(
      clamp(Math.floor(toX / GRID), 0, GRID_COLS - 1),
      clamp(Math.floor(toY / GRID), 0, GRID_ROWS - 1),
    );
    if (startCell === null || goalCell === null) return null;
    const key = (cx, cy) => cy * GRID_COLS + cx;
    const cameFrom = new Map();
    const seen = new Set([key(startCell.cx, startCell.cy)]);
    const queue = [startCell];
    let found = false;
    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur.cx === goalCell.cx && cur.cy === goalCell.cy) {
        found = true;
        break;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cur.cx + dx;
        const ny = cur.cy + dy;
        if (nx < 0 || ny < 0 || nx >= GRID_COLS || ny >= GRID_ROWS) continue;
        if (seen.has(key(nx, ny)) || cellBlocked(nx, ny)) continue;
        seen.add(key(nx, ny));
        cameFrom.set(key(nx, ny), cur);
        queue.push({ cx: nx, cy: ny });
      }
    }
    if (!found) return null;
    const points = [];
    let cur = goalCell;
    while (!(cur.cx === startCell.cx && cur.cy === startCell.cy)) {
      points.unshift({ x: cur.cx * GRID + GRID / 2, y: cur.cy * GRID + GRID / 2 });
      cur = cameFrom.get(key(cur.cx, cur.cy));
    }
    points.push({ x: toX, y: toY });
    return points;
  }

  /** Walk to a point; on arrival, use the named station if one was given. */
  function goTo(x, y, stationId) {
    const points = findPath(state.chef.x, state.chef.y, x, y);
    if (points === null) {
      state.path = [];
      state.clickTarget = null;
      return false;
    }
    state.path = points;
    state.clickTarget = { x, y, stationId: stationId ?? null };
    return true;
  }

  /** Walk to a station's stand spot and use it on arrival. */
  function goToStation(stationId) {
    const station = stationById(stationId);
    if (station === null) return false;
    return goTo(station.stand.x, station.stand.y, stationId);
  }

  function reset() {
    state.time = 0;
    state.shiftLeft = SHIFT_SECONDS;
    state.coins = 0;
    state.served = 0;
    state.missed = 0;
    state.hearts = HEARTS;
    state.combo = 0;
    state.bestCombo = 0;
    state.chef.x = 640;
    state.chef.y = 470;
    state.chef.face = -1;
    state.chef.moving = false;
    state.chef.walkPhase = 0;
    state.chef.carry = null;
    state.board.item = null;
    state.board.progress = 0;
    state.grill[0].item = null;
    state.grill[0].t = 0;
    state.grill[1].item = null;
    state.grill[1].t = 0;
    state.plate.items = [];
    state.orders = [];
    state.spawnTimer = ORDER.firstAfter;
    state.nextOrderId = 1;
    state.particles = [];
    state.popups = [];
    state.steamTimer = 0;
    state.clickTarget = null;
    state.path = [];
    state.over = false;
    state.overReason = '';
    state.sizzle = false;
  }

  function addParticle(kind, x, y, vx, vy, life) {
    if (state.particles.length >= MAX_PARTICLES) state.particles.shift();
    state.particles.push({ kind, x, y, vx, vy, life, max: life });
  }

  function addPopup(x, y, text, color) {
    if (state.popups.length >= MAX_POPUPS) state.popups.shift();
    state.popups.push({ x, y, text, color, life: 1.3 });
  }

  function burst(x, y, kind, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const power = speed * (0.4 + random() * 0.6);
      addParticle(kind, x, y, Math.cos(angle) * power, Math.sin(angle) * power - 20, 0.5 + random() * 0.4);
    }
  }

  function progress() {
    return clamp(state.time / SHIFT_SECONDS, 0, 1);
  }

  function spawnOrder() {
    const recipe = pickRecipe(random, progress());
    const patience = lerp(ORDER.patienceStart, ORDER.patienceEnd, progress());
    state.orders.push({
      uid: state.nextOrderId,
      recipe,
      patience,
      max: patience,
    });
    state.nextOrderId += 1;
  }

  function endShift(reason) {
    if (state.over) return EVENT_OVER;
    state.over = true;
    state.overReason = reason;
    return EVENT_OVER;
  }

  /** Does the plate on the counter (or in hand) hold exactly this recipe? */
  function plateMatches(recipe, items) {
    if (items.length !== recipe.needs.length) return false;
    const wanted = recipe.needs.map((need) => `${need.id}:${need.state}`).sort();
    const held = items.map((item) => `${item.id}:${item.state}`).sort();
    for (let i = 0; i < wanted.length; i += 1) if (wanted[i] !== held[i]) return false;
    return true;
  }

  /** The station the chef stands close enough to use, or null. */
  function nearestStation() {
    const chef = state.chef;
    let best = null;
    let bestDist = INTERACT_RANGE;
    for (const station of STATIONS) {
      const dx = chef.x - station.near.x;
      const dy = chef.y - station.near.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = station;
      }
    }
    return best;
  }

  function tryMove(dx, dy) {
    const chef = state.chef;
    const radius = CHEF.radius;
    const nextX = clamp(chef.x + dx, radius, FIELD.width - radius);
    if (!solids.some((rect) => circleHitsRect(nextX, chef.y, radius, rect))) chef.x = nextX;
    const nextY = clamp(chef.y + dy, 96 + radius, FIELD.height - radius);
    if (!solids.some((rect) => circleHitsRect(chef.x, nextY, radius, rect))) chef.y = nextY;
  }

  /**
   * One interaction with the nearest station. Carrying rules, in short:
   * crates give an ingredient to empty hands; the board takes a choppable item
   * and gives it back chopped; the grill takes a raw patty and gives it back
   * cooked (or burnt); the assembly counter collects items onto its plate and
   * hands the plate over; the hatch serves a carried plate; the trash eats
   * whatever is carried.
   */
  function interact() {
    const station = nearestStation();
    if (station === null) return 0;
    const chef = state.chef;
    let events = 0;

    if (station.kind === 'crate') {
      if (chef.carry === null) {
        chef.carry = { kind: 'item', ...freshItem(station.ingredient) };
        events |= EVENT_PICKUP;
      }
      return events;
    }

    if (station.kind === 'board') {
      if (state.board.item === null && chef.carry !== null && chef.carry.kind === 'item'
        && INGREDIENTS[chef.carry.id].chop && chef.carry.state === 'raw') {
        state.board.item = { id: chef.carry.id, state: 'raw' };
        state.board.progress = 0;
        chef.carry = null;
        events |= EVENT_PLACE;
      } else if (state.board.item !== null && chef.carry === null) {
        chef.carry = { kind: 'item', ...state.board.item };
        state.board.item = null;
        state.board.progress = 0;
        events |= EVENT_PICKUP;
      }
      return events;
    }

    if (station.kind === 'grill') {
      const slot = state.grill[0].item === null ? state.grill[0]
        : state.grill[1].item === null ? state.grill[1] : null;
      if (slot !== null && chef.carry !== null && chef.carry.kind === 'item'
        && chef.carry.id === 'patty' && chef.carry.state === 'raw') {
        slot.item = { id: 'patty', state: 'raw' };
        slot.t = 0;
        chef.carry = null;
        events |= EVENT_PLACE;
        return events;
      }
      if (chef.carry === null) {
        const done = state.grill.find((s) => s.item !== null && s.item.state !== 'raw');
        if (done !== undefined) {
          chef.carry = { kind: 'item', ...done.item };
          done.item = null;
          done.t = 0;
          events |= EVENT_PICKUP;
        }
      }
      return events;
    }

    if (station.kind === 'assembly') {
      if (chef.carry !== null && chef.carry.kind === 'item'
        && state.plate.items.length < MAX_PLATE_ITEMS) {
        state.plate.items.push({ id: chef.carry.id, state: chef.carry.state });
        chef.carry = null;
        events |= EVENT_PLACE;
      } else if (chef.carry === null && state.plate.items.length > 0) {
        chef.carry = { kind: 'plate', items: state.plate.items };
        state.plate.items = [];
        events |= EVENT_PICKUP;
      }
      return events;
    }

    if (station.kind === 'hatch') {
      if (chef.carry !== null && chef.carry.kind === 'plate') {
        const items = chef.carry.items;
        const match = state.orders.find((order) => plateMatches(recipeById(order.recipe), items));
        if (match !== undefined) {
          const recipe = recipeById(match.recipe);
          const tip = Math.round(SCORE.tipMax * (match.patience / match.max));
          const bonus = Math.min(state.combo * SCORE.comboPerLevel, SCORE.comboCap);
          const earned = recipe.base + tip + bonus;
          state.coins += earned;
          state.served += 1;
          state.combo += 1;
          if (state.combo > state.bestCombo) state.bestCombo = state.combo;
          state.orders = state.orders.filter((order) => order.uid !== match.uid);
          chef.carry = null;
          addPopup(station.near.x, station.near.y - 30, `+${earned}`, '#f2b705');
          burst(station.near.x, station.near.y - 10, 'spark', 10, 90);
          events |= EVENT_SERVE;
        } else {
          addPopup(chef.x, chef.y - 44, 'Bukan itu!', '#e5484d');
          events |= EVENT_BAD;
        }
      }
      return events;
    }

    if (station.kind === 'trash') {
      if (chef.carry !== null) {
        chef.carry = null;
        events |= EVENT_TRASH;
      }
      return events;
    }

    return events;
  }

  /**
   * One fixed step. `input` carries the keyboard direction, whether the
   * interact key was just pressed or is held, and a click target to walk to.
   * Returns the EVENT_* flags of what happened this step.
   */
  function step(dt, input) {
    let events = 0;
    if (state.over) return events;
    state.time += dt;
    state.shiftLeft = Math.max(0, SHIFT_SECONDS - state.time);
    if (state.shiftLeft <= 0) return endShift('time');

    // New orders arrive on a timer that quickens as the shift wears on.
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.orders.length < ORDER.maxActive) {
      spawnOrder();
      state.spawnTimer = lerp(ORDER.intervalStart, ORDER.intervalEnd, progress());
    }

    // Patience drains; an order that runs out walks away angry.
    for (let i = state.orders.length - 1; i >= 0; i -= 1) {
      const order = state.orders[i];
      order.patience -= dt;
      if (order.patience <= 0) {
        state.orders.splice(i, 1);
        state.missed += 1;
        state.combo = 0;
        state.hearts -= 1;
        addPopup(640, 120, 'Pelanggan pergi!', '#e5484d');
        events |= EVENT_EXPIRE;
        if (state.hearts <= 0) return events | endShift('missed');
      }
    }

    // The grill cooks on its own clock: raw, cooked, then burnt.
    state.sizzle = false;
    for (const slot of state.grill) {
      if (slot.item === null) continue;
      slot.t += dt;
      if (slot.item.state === 'raw') {
        state.sizzle = true;
        if (slot.t >= GRILL_COOKED) {
          slot.item.state = 'cooked';
          events |= EVENT_GRILL_DONE;
        }
      } else if (slot.item.state === 'cooked') {
        state.sizzle = true;
        if (slot.t >= GRILL_BURNT) {
          slot.item.state = 'burnt';
          addPopup(850, 160, 'Gosong!', '#e5484d');
          events |= EVENT_BURN;
        }
      }
    }

    // Steam rises off a cooking grill.
    state.steamTimer -= dt;
    if (state.sizzle && state.steamTimer <= 0) {
      state.steamTimer = 0.14;
      const slot = state.grill.find((s) => s.item !== null && s.item.state !== 'burnt');
      if (slot !== undefined) {
        const index = state.grill.indexOf(slot);
        addParticle('steam', 790 + index * 100 + random() * 40, 120, (random() - 0.5) * 12, -46 - random() * 20, 0.9);
      }
    }

    // Chopping: hold the interact key beside the board while it holds a raw item.
    const station = nearestStation();
    if (input.interactHeld && station !== null && station.kind === 'board'
      && state.board.item !== null && state.board.item.state === 'raw'
      && INGREDIENTS[state.board.item.id].chop) {
      state.board.progress += dt / CHOP_SECONDS;
      if (random() < 0.35) {
        addParticle('chop', 650 + (random() - 0.5) * 70, 130 + (random() - 0.5) * 20,
          (random() - 0.5) * 120, -40 - random() * 60, 0.45);
      }
      events |= EVENT_CHOP;
      if (state.board.progress >= 1) {
        state.board.item.state = 'chopped';
        state.board.progress = 0;
        burst(650, 140, 'chop', 8, 80);
        events |= EVENT_CHOP_DONE;
      }
    }

    // Movement: the keyboard steers directly; a click target (or a goTo from
    // the screenshot driver) steers along the found path instead. The keys
    // always win and cancel a walk in progress.
    const chef = state.chef;
    let dirX = input.dirX;
    let dirY = input.dirY;
    if (input.click !== null) goTo(input.click.x, input.click.y, input.click.stationId);
    if (dirX !== 0 || dirY !== 0) {
      state.path = [];
      state.clickTarget = null;
    } else if (state.path.length > 0) {
      const target = state.path[0];
      const dx = target.x - chef.x;
      const dy = target.y - chef.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 10) {
        state.path.shift();
      } else {
        dirX = dx / dist;
        dirY = dy / dist;
      }
    }
    if (state.path.length === 0 && state.clickTarget !== null) {
      // Arrived: use the station if one was named and the chef is in range.
      if (state.clickTarget.stationId !== null) {
        const target = stationById(state.clickTarget.stationId);
        if (target !== null) {
          const ndx = chef.x - target.near.x;
          const ndy = chef.y - target.near.y;
          if (Math.sqrt(ndx * ndx + ndy * ndy) < INTERACT_RANGE) events |= interact();
        }
      }
      state.clickTarget = null;
    }
    if (dirX !== 0 || dirY !== 0) {
      const len = Math.sqrt(dirX * dirX + dirY * dirY);
      const nx = dirX / len;
      const ny = dirY / len;
      tryMove(nx * CHEF.speed * dt, ny * CHEF.speed * dt);
      chef.moving = true;
      chef.walkPhase += dt * 10;
      if (Math.abs(nx) > 0.2) chef.face = nx > 0 ? 1 : -1;
    } else {
      chef.moving = false;
    }

    if (input.interactPressed) events |= interact();

    // Particles and popups age out.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'steam') p.vy -= 12 * dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.popups.length - 1; i >= 0; i -= 1) {
      const popup = state.popups[i];
      popup.life -= dt;
      popup.y -= 34 * dt;
      if (popup.life <= 0) state.popups.splice(i, 1);
    }

    return events;
  }

  reset();
  return { state, reset, step, interact, nearestStation, goTo, goToStation };
}
