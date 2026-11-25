// Everything drawn on the canvas: the warung kitchen, its stations and food,
// the chef, the order board and the shift timer, and the title, pause and
// end-of-shift screens. All art is drawn with canvas paths — no image files,
// no fonts to load, nothing over the network.
//
// The playfield is a fixed 1280x720 logical area; draw() scales it to fit the
// canvas and letterboxes the rest, so the game looks the same at any window.

import {
  FIELD, GRILL_BURNT, GRILL_COOKED, HEARTS, PALETTE, RECIPES, STATIONS,
  recipeById, stationById,
} from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function heart(ctx, x, y, s, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y - s * 0.3, x - s * 0.5, y + s * 0.1);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.4, x, y + s * 0.6, x, y + s * 0.9);
  ctx.bezierCurveTo(x, y + s * 0.6, x + s * 0.5, y + s * 0.4, x + s * 0.5, y + s * 0.1);
  ctx.bezierCurveTo(x + s * 0.5, y - s * 0.3, x, y, x, y + s * 0.3);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/**
 * One ingredient, drawn at (x, y) with diameter `s`. `state` is raw, chopped,
 * cooked, burnt or ready; raw and chopped differ for the choppables (a chopped
 * tomato shows as slices), cooked and burnt differ for the patty.
 */
export function drawIngredient(ctx, id, state, x, y, s) {
  const r = s / 2;
  ctx.save();
  ctx.translate(x, y);
  if (id === 'tomato') {
    ctx.fillStyle = '#e4572e';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(-r * 0.35, -r * 0.35, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    if (state === 'chopped') {
      ctx.strokeStyle = '#b23a17';
      ctx.lineWidth = Math.max(1.5, s * 0.06);
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, 0);
      ctx.lineTo(r * 0.7, 0);
      ctx.moveTo(0, -r * 0.7);
      ctx.lineTo(0, r * 0.7);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#3f7d32';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.9);
      ctx.lineTo(-r * 0.35, -r * 0.35);
      ctx.lineTo(r * 0.35, -r * 0.35);
      ctx.closePath();
      ctx.fill();
    }
  } else if (id === 'lettuce') {
    ctx.fillStyle = '#5da24a';
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = (i / 10) * Math.PI * 2;
      const rr = r * (i % 2 === 0 ? 1 : 0.78);
      const px = Math.cos(angle) * rr;
      const py = Math.sin(angle) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7ec96a';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    if (state === 'chopped') {
      ctx.strokeStyle = '#3f7d32';
      ctx.lineWidth = Math.max(1.5, s * 0.06);
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.4);
      ctx.lineTo(r * 0.5, r * 0.4);
      ctx.moveTo(r * 0.5, -r * 0.4);
      ctx.lineTo(-r * 0.5, r * 0.4);
      ctx.stroke();
    }
  } else if (id === 'onion') {
    ctx.fillStyle = '#efe7f5';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b9a3d6';
    ctx.lineWidth = Math.max(1.5, s * 0.07);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    if (state === 'chopped') {
      ctx.strokeStyle = '#b9a3d6';
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, 0);
      ctx.lineTo(r * 0.8, 0);
      ctx.stroke();
    }
  } else if (id === 'patty') {
    if (state === 'burnt') ctx.fillStyle = '#241a14';
    else if (state === 'cooked') ctx.fillStyle = '#7a4a26';
    else ctx.fillStyle = '#c97b7b';
    roundRect(ctx, -r, -r * 0.55, s, s * 1.1, r * 0.3);
    ctx.fill();
    if (state === 'cooked') {
      ctx.strokeStyle = '#4a2c14';
      ctx.lineWidth = Math.max(1.5, s * 0.07);
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.55 - r * 0.2, -r * 0.45);
        ctx.lineTo(i * r * 0.55 + r * 0.2, r * 0.45);
        ctx.stroke();
      }
    } else if (state === 'burnt') {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.2, r * 0.12, 0, Math.PI * 2);
      ctx.arc(r * 0.35, r * 0.25, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'bun') {
    ctx.fillStyle = '#e8a83e';
    ctx.beginPath();
    ctx.arc(0, r * 0.15, r * 0.9, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c98a2a';
    roundRect(ctx, -r * 0.9, r * 0.15, s * 0.9, r * 0.35, r * 0.15);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.35, r * 0.14, r * 0.08, 0.4, 0, Math.PI * 2);
    ctx.ellipse(r * 0.2, -r * 0.5, r * 0.14, r * 0.08, -0.3, 0, Math.PI * 2);
    ctx.ellipse(r * 0.45, -r * 0.15, r * 0.14, r * 0.08, 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'cheese') {
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.85);
    ctx.lineTo(r * 0.9, r * 0.6);
    ctx.lineTo(-r * 0.9, r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d9a91f';
    ctx.beginPath();
    ctx.arc(-r * 0.25, r * 0.15, r * 0.16, 0, Math.PI * 2);
    ctx.arc(r * 0.3, r * 0.3, r * 0.12, 0, Math.PI * 2);
    ctx.arc(r * 0.05, -r * 0.35, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlate(ctx, x, y, rx, items) {
  ellipse(ctx, x, y, rx, rx * 0.32);
  ctx.fillStyle = '#f4f1ea';
  ctx.fill();
  ctx.strokeStyle = '#c9c2b2';
  ctx.lineWidth = 2;
  ctx.stroke();
  ellipse(ctx, x, y, rx * 0.62, rx * 0.2);
  ctx.strokeStyle = '#ddd6c6';
  ctx.stroke();
  if (items.length === 0) return;
  const cols = items.length <= 3 ? items.length : 3;
  items.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ix = x + (col - (cols - 1) / 2) * rx * 0.55;
    const iy = y - 6 + row * 12;
    drawIngredient(ctx, item.id, item.state, ix, iy, 26);
  });
}

function drawChef(ctx, chef, time) {
  const bob = chef.moving ? Math.sin(chef.walkPhase) * 2.5 : Math.sin(time * 2) * 0.8;
  const x = chef.x;
  const y = chef.y + bob * 0.4;
  // Shadow.
  ellipse(ctx, x, chef.y + 26, 24, 7);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fill();
  // Legs.
  const stepSwing = chef.moving ? Math.sin(chef.walkPhase) * 5 : 0;
  ctx.fillStyle = '#3a2a1c';
  roundRect(ctx, x - 12 + stepSwing, y + 8, 9, 18, 4);
  ctx.fill();
  roundRect(ctx, x + 3 - stepSwing, y + 8, 9, 18, 4);
  ctx.fill();
  // Body: shirt and apron.
  ctx.fillStyle = '#2f6f6a';
  roundRect(ctx, x - 16, y - 12, 32, 26, 9);
  ctx.fill();
  ctx.fillStyle = '#f7ead2';
  roundRect(ctx, x - 12, y - 8, 24, 22, 6);
  ctx.fill();
  ctx.strokeStyle = '#d9c08a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 2);
  ctx.lineTo(x + 12, y - 2);
  ctx.stroke();
  // Arms.
  const armSwing = chef.moving ? Math.sin(chef.walkPhase) * 4 : 0;
  ctx.fillStyle = '#2f6f6a';
  ctx.beginPath();
  ctx.arc(x - 18, y + 2 + armSwing, 6, 0, Math.PI * 2);
  ctx.arc(x + 18, y + 2 - armSwing, 6, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = '#f2c69b';
  ctx.beginPath();
  ctx.arc(x, y - 24, 13, 0, Math.PI * 2);
  ctx.fill();
  // Chef hat: band and puff.
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x - 13, y - 36, 26, 7, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - 7, y - 38, 8, 0, Math.PI * 2);
  ctx.arc(x + 2, y - 42, 9, 0, Math.PI * 2);
  ctx.arc(x + 9, y - 37, 7, 0, Math.PI * 2);
  ctx.fill();
  // Face: eyes look the way the chef faces, smile below.
  const look = chef.face * 2.5;
  ctx.fillStyle = '#33241a';
  ctx.beginPath();
  ctx.arc(x - 5 + look, y - 25, 1.8, 0, Math.PI * 2);
  ctx.arc(x + 5 + look, y - 25, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#33241a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + look * 0.5, y - 21, 4, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  // What the chef carries rides above the hat.
  if (chef.carry !== null) {
    const lift = Math.sin(time * 3) * 2;
    if (chef.carry.kind === 'plate') {
      drawPlate(ctx, x, y - 56 + lift, 26, chef.carry.items);
    } else {
      drawIngredient(ctx, chef.carry.id, chef.carry.state, x, y - 56 + lift, 30);
    }
  }
}

function drawTicket(ctx, order, x, y, w, h, time) {
  const recipe = recipeById(order.recipe);
  const frac = Math.max(0, order.patience / order.max);
  const urgent = frac < 0.3;
  ctx.save();
  if (urgent && Math.floor(time * 3) % 2 === 0) {
    ctx.shadowColor = '#e5484d';
    ctx.shadowBlur = 12;
  }
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = PALETTE.paper;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = urgent ? '#e5484d' : PALETTE.paperEdge;
  ctx.lineWidth = urgent ? 2.5 : 1.5;
  ctx.stroke();
  ctx.restore();
  // Recipe name.
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `700 15px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(recipe.name, x + 10, y + 15);
  // Coins for the dish.
  ctx.fillStyle = '#8a6d1f';
  ctx.font = `700 13px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(`🪙 ${recipe.base}`, x + w - 10, y + 15);
  // The ingredients it needs, as little pictures.
  const iconSize = 20;
  const gap = 26;
  const totalW = recipe.needs.length * gap - 6;
  let ix = x + (w - totalW) / 2 + iconSize / 2;
  for (const need of recipe.needs) {
    drawIngredient(ctx, need.id, need.state, ix, y + 34, iconSize);
    ix += gap;
  }
  // Patience bar.
  const barW = w - 20;
  const barX = x + 10;
  const barY = y + h - 9;
  roundRect(ctx, barX, barY, barW, 6, 3);
  ctx.fillStyle = '#e5dcc4';
  ctx.fill();
  roundRect(ctx, barX, barY, barW * frac, 6, 3);
  ctx.fillStyle = frac > 0.55 ? '#4caf6d' : frac > 0.3 ? '#f2b705' : '#e5484d';
  ctx.fill();
}

function drawHud(ctx, state, best, uiTime) {
  // Bar.
  ctx.fillStyle = PALETTE.hud;
  ctx.fillRect(0, 0, FIELD.width, 76);
  ctx.fillStyle = PALETTE.hudEdge;
  ctx.fillRect(0, 74, FIELD.width, 2);
  // Title, left.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.cream;
  ctx.font = `800 24px ${FONT}`;
  ctx.fillText('WARUNG SENJA', 16, 26);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('Masak cepat, sajikan hangat — WASD / klik', 16, 52);
  // Order tickets, centre-left.
  for (let i = 0; i < 3; i += 1) {
    const order = state.orders[i];
    if (order !== undefined) drawTicket(ctx, order, 290 + i * 210, 8, 200, 60, uiTime);
  }
  // Shift timer.
  const left = Math.max(0, Math.ceil(state.shiftLeft));
  const minutes = Math.floor(left / 60);
  const seconds = left % 60;
  const label = `${minutes}:${String(seconds).padStart(2, '0')}`;
  const low = state.shiftLeft <= 30 && !state.over;
  ctx.textAlign = 'center';
  ctx.fillStyle = low && Math.floor(uiTime * 2) % 2 === 0 ? '#ff6b5e' : PALETTE.cream;
  ctx.font = `800 32px ${FONT}`;
  ctx.fillText(label, 985, 30);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 11px ${FONT}`;
  ctx.fillText('SISA WAKTU', 985, 56);
  // Coins.
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(1085, 30, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#7a5c00';
  ctx.font = `800 13px ${FONT}`;
  ctx.fillText('Rp', 1085, 30);
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.cream;
  ctx.font = `800 26px ${FONT}`;
  ctx.fillText(String(state.coins), 1106, 30);
  if (state.combo >= 2) {
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 13px ${FONT}`;
    ctx.fillText(`COMBO x${state.combo}`, 1106, 54);
  } else {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 11px ${FONT}`;
    ctx.fillText(`TERBAIK ${best}`, 1106, 54);
  }
  // Hearts, top right.
  for (let i = 0; i < HEARTS; i += 1) {
    heart(ctx, 1215 + i * 24, 22, 15, i < state.hearts ? '#e5484d' : '#4a2c1c');
  }
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 11px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('PELANGGAN', 1239, 56);
}

function drawKitchen(ctx, state) {
  // Wall band with tiles and bunting.
  ctx.fillStyle = PALETTE.wall;
  ctx.fillRect(0, 76, FIELD.width, 20);
  ctx.fillStyle = PALETTE.wallTile;
  for (let x = 0; x < FIELD.width; x += 48) ctx.fillRect(x, 76, 44, 20);
  ctx.fillStyle = PALETTE.wallTrim;
  ctx.fillRect(0, 94, FIELD.width, 2);
  const flags = ['#e4572e', '#f2b705', '#5da24a', '#4fc3f7', '#e88bb1'];
  for (let x = 0; x < FIELD.width; x += 32) {
    ctx.fillStyle = flags[(x / 32) % flags.length];
    ctx.beginPath();
    ctx.moveTo(x, 76);
    ctx.lineTo(x + 16, 76);
    ctx.lineTo(x + 8, 90);
    ctx.closePath();
    ctx.fill();
  }
  // Floor: planks.
  for (let y = 184; y < FIELD.height; y += 46) {
    ctx.fillStyle = (Math.floor(y / 46) % 2 === 0) ? PALETTE.floor : PALETTE.floorDark;
    ctx.fillRect(0, y, FIELD.width, 46);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, y, FIELD.width, 2);
  }
  for (let x = 60; x < FIELD.width; x += 120) {
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(x, 184, 2, FIELD.height - 184);
  }
  // Rug in the middle of the floor.
  ellipse(ctx, 640, 480, 210, 90);
  ctx.fillStyle = PALETTE.rug;
  ctx.fill();
  ellipse(ctx, 640, 480, 185, 74);
  ctx.strokeStyle = PALETTE.rugTrim;
  ctx.lineWidth = 3;
  ctx.stroke();
  ellipse(ctx, 640, 480, 120, 46);
  ctx.strokeStyle = 'rgba(232,182,76,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Menu board: the recipes, standing bottom-left.
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  roundRect(ctx, 20, 584, 264, 124, 8);
  ctx.fill();
  ctx.fillStyle = '#4a3220';
  roundRect(ctx, 16, 580, 264, 124, 8);
  ctx.fill();
  ctx.fillStyle = '#2e2118';
  roundRect(ctx, 24, 588, 248, 108, 4);
  ctx.fill();
  ctx.fillStyle = PALETTE.cream;
  ctx.font = `800 15px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('MENU HARI INI', 36, 604);
  RECIPES.forEach((recipe, i) => {
    const y = 626 + i * 18;
    ctx.fillStyle = '#e8d9b0';
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(recipe.name, 36, y);
    ctx.fillStyle = PALETTE.gold;
    ctx.textAlign = 'right';
    ctx.fillText(`Rp${recipe.base}`, 262, y);
    ctx.textAlign = 'left';
  });

  // Potted plant, bottom-right.
  ctx.fillStyle = '#a34a24';
  roundRect(ctx, 1196, 640, 56, 56, 8);
  ctx.fill();
  ctx.fillStyle = '#7a3416';
  ctx.fillRect(1196, 640, 56, 10);
  ctx.fillStyle = '#3f7d32';
  for (const [dx, dy, r] of [[-14, -30, 14], [0, -44, 17], [14, -30, 14], [-6, -18, 12], [8, -16, 11]]) {
    ctx.beginPath();
    ctx.arc(1224 + dx, 640 + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStations(ctx, state) {
  for (const station of STATIONS) {
    const rect = station.rect;
    // Counter body and top.
    ctx.fillStyle = PALETTE.counterWood;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
    ctx.fill();
    ctx.fillStyle = PALETTE.counterTop;
    roundRect(ctx, rect.x, rect.y, rect.w, 26, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(rect.x, rect.y + 24, rect.w, 2);
  }

  // Crates: slats, a pile of the ingredient, and its name on the front.
  for (const station of STATIONS) {
    if (station.kind !== 'crate') continue;
    const rect = station.rect;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y + 52);
    ctx.lineTo(rect.x + rect.w, rect.y + 52);
    ctx.stroke();
    const cx = rect.x + rect.w / 2;
    drawIngredient(ctx, station.ingredient, 'raw', cx - 14, rect.y + 12, 22);
    drawIngredient(ctx, station.ingredient, 'raw', cx + 14, rect.y + 12, 22);
    drawIngredient(ctx, station.ingredient, 'raw', cx, rect.y + 2, 20);
    ctx.fillStyle = PALETTE.cream;
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const names = { tomato: 'TOMAT', lettuce: 'SELADA', onion: 'BAWANG', patty: 'DAGING', bun: 'ROTI', cheese: 'KEJU' };
    ctx.fillText(names[station.ingredient], cx, rect.y + 68);
  }

  // Chopping board: board, knife, the item being chopped and its progress ring.
  const board = stationById('board').rect;
  ctx.fillStyle = '#d9b380';
  roundRect(ctx, board.x + 14, board.y + 4, 132, 46, 8);
  ctx.fill();
  ctx.strokeStyle = '#a97e4e';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  ctx.translate(board.x + 128, board.y + 12);
  ctx.rotate(0.5);
  ctx.fillStyle = '#c8ccd2';
  roundRect(ctx, 0, -3, 26, 6, 3);
  ctx.fill();
  ctx.fillStyle = '#5a3a22';
  roundRect(ctx, -12, -3, 12, 6, 3);
  ctx.fill();
  ctx.restore();
  if (state.board.item !== null) {
    drawIngredient(ctx, state.board.item.id, state.board.item.state, board.x + 80, board.y + 27, 34);
    if (state.board.progress > 0) {
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(board.x + 80, board.y + 27, 26, -Math.PI / 2, -Math.PI / 2 + state.board.progress * Math.PI * 2);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.font = `600 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('TALENAN — tahan Spasi', board.x + 80, board.y + 30);
  }
  ctx.fillStyle = PALETTE.cream;
  ctx.font = `700 12px ${FONT}`;
  ctx.fillText('POTONG', board.x + 80, board.y + 68);

  // Grill: dark box, two grate slots, patties with cook progress, glow when hot.
  const grill = stationById('grill').rect;
  ctx.fillStyle = '#3a3f45';
  roundRect(ctx, grill.x + 8, grill.y + 4, 184, 50, 8);
  ctx.fill();
  state.grill.forEach((slot, i) => {
    const sx = grill.x + 22 + i * 92;
    const sy = grill.y + 8;
    ctx.fillStyle = '#1d2024';
    roundRect(ctx, sx, sy, 76, 42, 6);
    ctx.fill();
    ctx.strokeStyle = '#565b62';
    ctx.lineWidth = 2;
    for (let b = 0; b < 4; b += 1) {
      ctx.beginPath();
      ctx.moveTo(sx + 8, sy + 8 + b * 10);
      ctx.lineTo(sx + 68, sy + 8 + b * 10);
      ctx.stroke();
    }
    if (slot.item !== null) {
      drawIngredient(ctx, 'patty', slot.item.state, sx + 38, sy + 21, 40);
      if (slot.item.state === 'raw' || slot.item.state === 'cooked') {
        const frac = slot.item.state === 'raw'
          ? slot.t / GRILL_COOKED
          : 1 - (slot.t - GRILL_COOKED) / (GRILL_BURNT - GRILL_COOKED);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        roundRect(ctx, sx + 8, sy + 44, 60, 5, 2);
        ctx.fill();
        ctx.fillStyle = slot.item.state === 'raw' ? '#f2b705' : '#e5484d';
        roundRect(ctx, sx + 8, sy + 44, 60 * Math.max(0, Math.min(1, frac)), 5, 2);
        ctx.fill();
      }
    }
  });
  ctx.fillStyle = PALETTE.cream;
  ctx.font = `700 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('PANGGANGAN', grill.x + 100, grill.y + 68);

  // Serving hatch: warm window, heat lamp glow, service bell.
  const hatch = stationById('hatch').rect;
  ctx.fillStyle = '#ffdf9e';
  roundRect(ctx, hatch.x + 10, hatch.y + 4, 254, 34, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,180,60,0.35)';
  roundRect(ctx, hatch.x + 10, hatch.y + 4, 254, 34, 6);
  ctx.fill();
  ctx.fillStyle = '#8a5a20';
  ctx.font = `800 13px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('— JENDELA SAJI —', hatch.x + 137, hatch.y + 21);
  ctx.fillStyle = '#f2c94c';
  ctx.beginPath();
  ctx.arc(hatch.x + 210, hatch.y + 56, 12, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b8860b';
  ctx.fillRect(hatch.x + 196, hatch.y + 56, 28, 4);
  ctx.fillStyle = PALETTE.cream;
  ctx.font = `700 12px ${FONT}`;
  ctx.fillText('SAJIKAN DI SINI', hatch.x + 110, hatch.y + 68);

  // Assembly counter: steel top and the plate with its items.
  const assembly = stationById('assembly').rect;
  ctx.fillStyle = PALETTE.steel;
  roundRect(ctx, assembly.x, assembly.y, assembly.w, 26, 6);
  ctx.fill();
  ctx.fillStyle = PALETTE.steelDark;
  ctx.fillRect(assembly.x, assembly.y + 24, assembly.w, 2);
  drawPlate(ctx, assembly.x + 100, assembly.y + 62, 62, state.plate.items);
  ctx.fillStyle = PALETTE.cream;
  ctx.font = `700 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('RAKIT DI PIRING', assembly.x + 100, assembly.y + 104);

  // Trash bin.
  const trash = stationById('trash').rect;
  ctx.fillStyle = '#5a6068';
  roundRect(ctx, trash.x + 20, trash.y + 8, 64, 66, 8);
  ctx.fill();
  ctx.fillStyle = '#43484e';
  roundRect(ctx, trash.x + 14, trash.y + 2, 76, 12, 6);
  ctx.fill();
  ctx.fillStyle = PALETTE.cream;
  ctx.font = `700 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('SAMPAH', trash.x + 52, trash.y + 46);
}

function drawParticles(ctx, state) {
  for (const p of state.particles) {
    const alpha = Math.max(0, p.life / p.max);
    if (p.kind === 'steam') {
      ctx.fillStyle = `rgba(255,255,255,${0.55 * alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5 + (1 - alpha) * 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'chop') {
      ctx.fillStyle = `rgba(125,200,90,${alpha})`;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    } else if (p.kind === 'spark') {
      ctx.fillStyle = `rgba(242,183,5,${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const popup of state.popups) {
    const alpha = Math.max(0, Math.min(1, popup.life / 0.6));
    ctx.font = `800 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = `rgba(43,26,18,${alpha})`;
    ctx.strokeText(popup.text, popup.x, popup.y);
    ctx.fillStyle = popup.color;
    ctx.globalAlpha = alpha;
    ctx.fillText(popup.text, popup.x, popup.y);
    ctx.globalAlpha = 1;
  }
}

function drawTitle(ctx, state, best, uiTime) {
  ctx.fillStyle = 'rgba(20,10,6,0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText('WARUNG SENJA', 640, 210);
  ctx.fillStyle = PALETTE.cream;
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText('Warung kecil di ujung senja. Pesanan datang, wajan panas — masak cepat, sajikan hangat.', 640, 262);
  // How to play, on a paper card.
  roundRect(ctx, 340, 300, 600, 210, 14);
  ctx.fillStyle = PALETTE.paper;
  ctx.fill();
  ctx.strokeStyle = PALETTE.paperEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `800 18px ${FONT}`;
  ctx.fillText('CARA MAIN', 640, 326);
  ctx.font = `600 15px ${FONT}`;
  const lines = [
    'WASD / panah — jalan   •   Klik — jalan ke stasiun',
    'Spasi / E — ambil, taruh, sajikan   •   Tahan Spasi — potong',
    'Ambil bahan → potong di talenan → panggang daging → rakit di piring',
    'Sajikan piring yang cocok dengan pesanan sebelum pelanggan pergi.',
    'P — jeda      M — suara      R — ulangi setelah shift selesai',
  ];
  lines.forEach((line, i) => ctx.fillText(line, 640, 356 + i * 26));
  if (best > 0) {
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 16px ${FONT}`;
    ctx.fillText(`Koin terbaik sejauh ini: ${best}`, 640, 500);
  }
  const pulse = 0.65 + Math.sin(uiTime * 3) * 0.35;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = PALETTE.cream;
  ctx.font = `800 22px ${FONT}`;
  ctx.fillText('Tekan Spasi atau klik untuk mulai', 640, 560);
  ctx.globalAlpha = 1;
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(20,10,6,0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.cream;
  ctx.font = `800 48px ${FONT}`;
  ctx.fillText('JEDA', 640, 330);
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText('Tekan P untuk lanjut masak', 640, 380);
}

function gradeFor(served) {
  if (served >= 12) return 'S';
  if (served >= 9) return 'A';
  if (served >= 6) return 'B';
  if (served >= 3) return 'C';
  return 'D';
}

function drawOver(ctx, state, best, uiTime) {
  ctx.fillStyle = 'rgba(20,10,6,0.65)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  roundRect(ctx, 390, 130, 500, 440, 16);
  ctx.fillStyle = PALETTE.paper;
  ctx.fill();
  ctx.strokeStyle = PALETTE.paperEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `800 36px ${FONT}`;
  ctx.fillText(state.overReason === 'missed' ? 'WARUNG TUTUP!' : 'SHIFT SELESAI!', 640, 180);
  ctx.font = `600 16px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(state.overReason === 'missed'
    ? 'Terlalu banyak pelanggan pergi kecewa.'
    : 'Waktu habis — dapur padam, senja pun reda.', 640, 214);
  // Grade letter.
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `800 84px ${FONT}`;
  ctx.fillText(gradeFor(state.served), 640, 300);
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText('NILAI DAPUR', 640, 352);
  const rows = [
    ['Hidangan disajikan', String(state.served)],
    ['Koin didapat', String(state.coins)],
    ['Kombo terbaik', `x${state.bestCombo}`],
    ['Pelanggan pergi', String(state.missed)],
    ['Koin terbaik', String(Math.max(best, state.coins))],
  ];
  rows.forEach(([label, value], i) => {
    const y = 392 + i * 28;
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText(label, 440, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.ink;
    ctx.font = `800 15px ${FONT}`;
    ctx.fillText(value, 840, y);
  });
  const pulse = 0.65 + Math.sin(uiTime * 3) * 0.35;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `800 18px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('Tekan Spasi untuk masak lagi', 640, 540);
  ctx.globalAlpha = 1;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = canvas.clientWidth || FIELD.width;
    const height = canvas.clientHeight || FIELD.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    scale = Math.min(width / FIELD.width, height / FIELD.height) * dpr;
    offsetX = (canvas.width - FIELD.width * scale) / 2;
    offsetY = (canvas.height - FIELD.height * scale) / 2;
  }

  window.addEventListener('resize', resize);
  resize();

  /** Map a client (mouse) point to logical kitchen coordinates. */
  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: ((clientX - rect.left) * scaleX - offsetX) / scale,
      y: ((clientY - rect.top) * scaleY - offsetY) / scale,
    };
  }

  function draw(state, screen, best, uiTime = state.time) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1a0f08';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    drawKitchen(ctx, state);
    drawStations(ctx, state);
    drawChef(ctx, state.chef, uiTime);
    drawParticles(ctx, state);
    drawHud(ctx, state, best, uiTime);
    if (screen === SCREEN_TITLE) drawTitle(ctx, state, best, uiTime);
    else if (screen === SCREEN_PAUSED) drawPaused(ctx);
    else if (screen === SCREEN_OVER) drawOver(ctx, state, best, uiTime);
  }

  return { draw, resize, toLogical };
}
