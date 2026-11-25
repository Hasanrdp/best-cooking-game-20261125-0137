// Warung Senja — every tuning number, colour and layout rect in one place.
// The kitchen is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** One shift lasts this long; the timer in the HUD counts down from it. */
export const SHIFT_SECONDS = 150;

export const CHEF = {
  radius: 20,
  speed: 270,
  carryBob: 6,
};

/** How many missed (expired) orders end the shift early. */
export const HEARTS = 3;

/** Chopping takes this long of holding the interact key at the board. */
export const CHOP_SECONDS = 1.8;

/** A patty is cooked after this long on the grill, and burnt after this long. */
export const GRILL_COOKED = 6;
export const GRILL_BURNT = 12;

/** Orders: first one arrives after this many seconds, then one every interval. */
export const ORDER = {
  firstAfter: 2,
  intervalStart: 11,
  intervalEnd: 7.5,
  patienceStart: 44,
  patienceEnd: 32,
  maxActive: 3,
};

/** Coins: recipe base, plus a tip by patience left, plus a combo bonus. */
export const SCORE = {
  tipMax: 15,
  comboPerLevel: 2,
  comboCap: 10,
};

export const PALETTE = {
  wall: '#8a4b2a',
  wallTile: '#a05c33',
  wallTrim: '#5e3018',
  floor: '#b07a4e',
  floorDark: '#9c6a42',
  rug: '#7e2f26',
  rugTrim: '#e8b64c',
  hud: '#2b1a12',
  hudEdge: '#4a2c1c',
  counterWood: '#6b4423',
  counterTop: '#d8cfc0',
  steel: '#b9bec4',
  steelDark: '#8f959c',
  paper: '#fdf3d8',
  paperEdge: '#d9c08a',
  ink: '#33241a',
  muted: '#a08a76',
  cream: '#f7ead2',
  tomato: '#e4572e',
  lettuce: '#5da24a',
  onion: '#e8e0f2',
  pattyRaw: '#c97b7b',
  pattyCooked: '#7a4a26',
  pattyBurnt: '#241a14',
  bun: '#e8a83e',
  cheese: '#f2c94c',
  gold: '#f2b705',
  danger: '#e5484d',
  ok: '#4caf6d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best coins total is kept between visits (this browser only). */
export const BEST_KEY = 'warung-senja.best-coins';

// ---------------------------------------------------------------------------
// Ingredients
// ---------------------------------------------------------------------------

export const INGREDIENTS = {
  tomato: { name: 'Tomat', chop: true, grill: false, ready: false },
  lettuce: { name: 'Selada', chop: true, grill: false, ready: false },
  onion: { name: 'Bawang', chop: true, grill: false, ready: false },
  patty: { name: 'Daging', chop: false, grill: true, ready: false },
  bun: { name: 'Roti', chop: false, grill: false, ready: true },
  cheese: { name: 'Keju', chop: false, grill: false, ready: true },
};

/** An item on a plate, in hand, or on a station: { id, state }. */
export function freshItem(id) {
  const def = INGREDIENTS[id];
  return { id, state: def.ready ? 'ready' : 'raw' };
}

/** The state an ingredient must be in before it may go on a plate. */
export function plateState(id) {
  const def = INGREDIENTS[id];
  if (def.chop) return 'chopped';
  if (def.grill) return 'cooked';
  return 'ready';
}

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

/** Each recipe lists the items a plate must hold, in any order, to match it. */
export const RECIPES = [
  {
    id: 'salad',
    name: 'Salad Segar',
    base: 20,
    needs: [
      { id: 'tomato', state: 'chopped' },
      { id: 'lettuce', state: 'chopped' },
      { id: 'onion', state: 'chopped' },
    ],
  },
  {
    id: 'burger',
    name: 'Burger Senja',
    base: 30,
    needs: [
      { id: 'bun', state: 'ready' },
      { id: 'patty', state: 'cooked' },
      { id: 'lettuce', state: 'chopped' },
      { id: 'tomato', state: 'chopped' },
    ],
  },
  {
    id: 'melt',
    name: 'Keju Melt',
    base: 35,
    needs: [
      { id: 'bun', state: 'ready' },
      { id: 'patty', state: 'cooked' },
      { id: 'cheese', state: 'ready' },
    ],
  },
  {
    id: 'komplit',
    name: 'Burger Komplit',
    base: 50,
    needs: [
      { id: 'bun', state: 'ready' },
      { id: 'patty', state: 'cooked' },
      { id: 'cheese', state: 'ready' },
      { id: 'lettuce', state: 'chopped' },
      { id: 'tomato', state: 'chopped' },
      { id: 'onion', state: 'chopped' },
    ],
  },
];

export function recipeById(id) {
  for (const recipe of RECIPES) if (recipe.id === id) return recipe;
  return null;
}

/** Early in a shift the easy recipes come up more often; later, anything goes. */
export function pickRecipe(random, progress) {
  const roll = random();
  if (progress < 0.25) return roll < 0.45 ? 'salad' : roll < 0.8 ? 'burger' : 'melt';
  if (progress < 0.6) return roll < 0.3 ? 'salad' : roll < 0.6 ? 'burger' : roll < 0.85 ? 'melt' : 'komplit';
  return roll < 0.2 ? 'salad' : roll < 0.45 ? 'burger' : roll < 0.7 ? 'melt' : 'komplit';
}

// ---------------------------------------------------------------------------
// Kitchen layout: stations, solids and stand spots
// ---------------------------------------------------------------------------

/**
 * Every station: its id, the rect the chef cannot walk through, the point the
 * chef stands at to use it, and the point the chef must be near for the
 * interaction to count. Crates also name the ingredient they hold.
 */
export const STATIONS = [
  { id: 'crate-tomato', kind: 'crate', ingredient: 'tomato', rect: { x: 16, y: 96, w: 84, h: 88 }, stand: { x: 58, y: 212 }, near: { x: 58, y: 184 } },
  { id: 'crate-lettuce', kind: 'crate', ingredient: 'lettuce', rect: { x: 106, y: 96, w: 84, h: 88 }, stand: { x: 148, y: 212 }, near: { x: 148, y: 184 } },
  { id: 'crate-onion', kind: 'crate', ingredient: 'onion', rect: { x: 196, y: 96, w: 84, h: 88 }, stand: { x: 238, y: 212 }, near: { x: 238, y: 184 } },
  { id: 'crate-patty', kind: 'crate', ingredient: 'patty', rect: { x: 286, y: 96, w: 84, h: 88 }, stand: { x: 328, y: 212 }, near: { x: 328, y: 184 } },
  { id: 'crate-bun', kind: 'crate', ingredient: 'bun', rect: { x: 376, y: 96, w: 84, h: 88 }, stand: { x: 418, y: 212 }, near: { x: 418, y: 184 } },
  { id: 'crate-cheese', kind: 'crate', ingredient: 'cheese', rect: { x: 466, y: 96, w: 84, h: 88 }, stand: { x: 508, y: 212 }, near: { x: 508, y: 184 } },
  { id: 'board', kind: 'board', rect: { x: 570, y: 96, w: 160, h: 88 }, stand: { x: 650, y: 212 }, near: { x: 650, y: 184 } },
  { id: 'grill', kind: 'grill', rect: { x: 750, y: 96, w: 200, h: 88 }, stand: { x: 850, y: 212 }, near: { x: 850, y: 184 } },
  { id: 'hatch', kind: 'hatch', rect: { x: 990, y: 96, w: 274, h: 88 }, stand: { x: 1127, y: 216 }, near: { x: 1127, y: 184 } },
  { id: 'assembly', kind: 'assembly', rect: { x: 1064, y: 250, w: 200, h: 120 }, stand: { x: 1032, y: 310 }, near: { x: 1064, y: 310 } },
  { id: 'trash', kind: 'trash', rect: { x: 1160, y: 400, w: 104, h: 90 }, stand: { x: 1124, y: 445 }, near: { x: 1160, y: 445 } },
];

/** Decor that blocks walking but is not a station: the menu board and a plant. */
export const SOLIDS = [
  { x: 16, y: 580, w: 264, h: 124 },
  { x: 1180, y: 580, w: 84, h: 124 },
];

export function stationById(id) {
  for (const station of STATIONS) if (station.id === id) return station;
  return null;
}

/** Every rect the chef cannot walk through: station counters plus decor. */
export function solidRects() {
  const rects = [];
  for (const station of STATIONS) rects.push(station.rect);
  for (const solid of SOLIDS) rects.push(solid);
  return rects;
}
