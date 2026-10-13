/**
 * Static office renderer.
 *
 * The floor, grid, walls and furniture are expensive to draw and never change
 * while you are in the room, so they are painted once into an offscreen canvas
 * and blitted each frame. That is the "no unnecessary redraws" half of the 60 FPS
 * requirement — the dynamic layer only pays for avatars.
 */

export const PALETTE = {
  floor: '#0f141c',
  floorAlt: '#131a24',
  grid: 'rgba(120, 160, 220, 0.07)',
  gridMajor: 'rgba(120, 160, 220, 0.14)',
  border: '#2a3646',
  borderGlow: 'rgba(79, 140, 255, 0.35)',
  text: '#7f93ad',
  wall: '#3a4759',
  wallEdge: '#4b5a70',
  desk: '#2f3d4f',
  deskEdge: '#3d5068',
  plant: '#2b5140',
  plantEdge: '#3d7159',
  pillar: '#3d4453',
  pillarEdge: '#525b6e',
  screen: '#243449',
  screenEdge: '#3b5a86',
  cluster: 'rgba(79, 140, 255, 0.18)',
};

const TYPE_STYLE = {
  wall: { fill: PALETTE.wall, edge: PALETTE.wallEdge },
  desk: { fill: PALETTE.desk, edge: PALETTE.deskEdge },
  plant: { fill: PALETTE.plant, edge: PALETTE.plantEdge },
  pillar: { fill: PALETTE.pillar, edge: PALETTE.pillarEdge },
  screen: { fill: PALETTE.screen, edge: PALETTE.screenEdge },
};

/**
 * Letterbox the world into a viewport: one transform shared by both canvas
 * layers so the painted floor and the moving avatars line up exactly.
 */
export function computeView(viewport, room) {
  const scale = Math.min(viewport.width / room.width, viewport.height / room.height);
  return {
    scale,
    offsetX: (viewport.width - room.width * scale) / 2,
    offsetY: (viewport.height - room.height * scale) / 2,
  };
}

/**
 * Paint the static layer in VIEWPORT pixels using the shared view transform.
 * It only runs on resize or when the room layout changes.
 */
export function renderStaticLayer(context, { room, viewport, view, dpr = 1 }) {
  const { width, height } = room;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, viewport.width, viewport.height);
  context.translate(view.offsetX, view.offsetY);
  context.scale(view.scale, view.scale);

  // Floor
  context.fillStyle = PALETTE.floor;
  context.fillRect(0, 0, width, height);

  // 40px grid + a brighter 200px grid
  context.lineWidth = 1;
  for (let x = 0; x <= width; x += 40) {
    context.strokeStyle = x % 200 === 0 ? PALETTE.gridMajor : PALETTE.grid;
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, height);
    context.stroke();
  }
  for (let y = 0; y <= height; y += 40) {
    context.strokeStyle = y % 200 === 0 ? PALETTE.gridMajor : PALETTE.grid;
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(width, y + 0.5);
    context.stroke();
  }

  // Furniture / walls
  for (const obstacle of room.obstacles ?? []) {
    drawObstacle(context, obstacle);
  }

  // Room border with a soft inner glow
  context.strokeStyle = PALETTE.border;
  context.lineWidth = 6;
  context.strokeRect(3, 3, width - 6, height - 6);
  context.strokeStyle = PALETTE.borderGlow;
  context.lineWidth = 2;
  context.strokeRect(10, 10, width - 20, height - 20);
}

function drawObstacle(context, obstacle) {
  const style = TYPE_STYLE[obstacle.type] ?? TYPE_STYLE.wall;
  const { x, y, w, h } = obstacle;

  context.save();
  context.fillStyle = style.fill;
  context.strokeStyle = style.edge;
  context.lineWidth = 2;

  if (obstacle.type === 'plant') {
    context.beginPath();
    context.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else if (obstacle.type === 'pillar') {
    context.beginPath();
    context.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else {
    context.fillRect(x, y, w, h);
    context.strokeRect(x + 1, y + 1, w - 2, h - 2);
    if (obstacle.type === 'desk') {
      context.strokeStyle = 'rgba(255,255,255,0.05)';
      context.beginPath();
      context.moveTo(x + 8, y + h / 2);
      context.lineTo(x + w - 8, y + h / 2);
      context.stroke();
    }
    if (obstacle.type === 'screen') {
      context.fillStyle = 'rgba(79,140,255,0.25)';
      context.fillRect(x + 4, y + 4, w - 8, h - 8);
    }
  }

  // Sound-blocking hint: a dashed halo on anything that mutes a voice.
  if (obstacle.blocksAudio !== false && obstacle.attenuation <= 0.3) {
    context.setLineDash([6, 6]);
    context.strokeStyle = 'rgba(255, 120, 120, 0.25)';
    context.lineWidth = 1.5;
    context.strokeRect(x - 4, y - 4, w + 8, h + 8);
    context.setLineDash([]);
  }
  context.restore();
}

export default renderStaticLayer;