/**
 * Static office renderer.
 *
 * Draws the office floor, room zones, furniture, plants, desks,
 * chairs, decorative lighting, and existing server-provided obstacles.
 *
 * Important:
 * - Existing room dimensions are preserved.
 * - Existing obstacle geometry is preserved.
 * - This file does not change networking, movement, collision,
 *   or spatial-audio calculations.
 */

export const PALETTE = {
  floor: '#171b2a',
  floorAlt: '#101522',
  grid: 'rgba(148, 163, 184, 0.045)',
  gridMajor: 'rgba(129, 140, 248, 0.11)',
  border: '#252d43',
  borderGlow: 'rgba(129, 140, 248, 0.38)',
  text: '#e2e8f0',
  wall: '#1a2233',
  wallEdge: '#3b455b',
  desk: '#704a32',
  deskEdge: '#b17a4a',
  plant: '#1b5947',
  plantEdge: '#45a57a',
  pillar: '#39445b',
  pillarEdge: '#77819a',
  screen: '#1b344c',
  screenEdge: '#4f8dc4',
  cluster: 'rgba(108, 92, 231, 0.12)',
};

const TYPE_STYLE = {
  wall: {
    fill: PALETTE.wall,
    edge: PALETTE.wallEdge,
  },
  desk: {
    fill: PALETTE.desk,
    edge: PALETTE.deskEdge,
  },
  plant: {
    fill: PALETTE.plant,
    edge: PALETTE.plantEdge,
  },
  pillar: {
    fill: PALETTE.pillar,
    edge: PALETTE.pillarEdge,
  },
  screen: {
    fill: PALETTE.screen,
    edge: PALETTE.screenEdge,
  },
};

/**
 * Fits the room into the available viewport.
 * The same transform must be used by the moving-avatar canvas.
 */
export function computeView(viewport, room) {
  const scale = Math.min(
    viewport.width / room.width,
    viewport.height / room.height
  );

  return {
    scale,
    offsetX:
      (viewport.width - room.width * scale) / 2,
    offsetY:
      (viewport.height - room.height * scale) / 2,
  };
}

/**
 * Draws the static office layer.
 * Called when the canvas resizes or the room layout changes.
 */
export function renderStaticLayer(
  context,
  {
    room,
    viewport,
    view,
    dpr = 1,
  }
) {
  if (!context || !room || !viewport || !view) {
    return;
  }

  const { width, height } = room;

  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  context.clearRect(
    0,
    0,
    viewport.width,
    viewport.height
  );

  context.save();

  context.translate(
    view.offsetX,
    view.offsetY
  );

  context.scale(
    view.scale,
    view.scale
  );

  drawFloor(context, width, height);
  drawOfficeZones(context, width, height);
  drawFloorGrid(context, width, height);
  drawAmbientLighting(context, width, height);

  /*
   * Render authoritative server obstacles before detailed furniture.
   * This prevents plain obstacle rectangles from painting over the
   * furniture details. Obstacle geometry remains unchanged.
   */
  for (const obstacle of room.obstacles ?? []) {
    drawObstacle(context, obstacle);
  }

  drawLounge(context, width, height);
  drawMeetingRoom(context, width, height);
  drawWorkZone(context, width, height);
  drawBreakArea(context, width, height);
  drawFocusZone(context, width, height);

  drawPerimeterPlants(context, width, height);
  drawPerimeterLighting(context, width, height);
  drawRoomLabels(context, width, height);
  drawRoomBorder(context, width, height);

  context.restore();
}

/* -------------------------------------------------------------------------- */
/* Shared drawing helpers                                                      */
/* -------------------------------------------------------------------------- */

function roundedRect(
  context,
  x,
  y,
  width,
  height,
  radius = 10
) {
  if (width <= 0 || height <= 0) {
    return;
  }

  const r = Math.min(
    radius,
    width / 2,
    height / 2
  );

  context.beginPath();

  context.moveTo(x + r, y);

  context.arcTo(
    x + width,
    y,
    x + width,
    y + height,
    r
  );

  context.arcTo(
    x + width,
    y + height,
    x,
    y + height,
    r
  );

  context.arcTo(
    x,
    y + height,
    x,
    y,
    r
  );

  context.arcTo(
    x,
    y,
    x + width,
    y,
    r
  );

  context.closePath();
}

/* -------------------------------------------------------------------------- */
/* Floor                                                                       */
/* -------------------------------------------------------------------------- */

function drawFloor(context, width, height) {
  const gradient = context.createLinearGradient(
    0,
    0,
    width,
    height
  );

  gradient.addColorStop(0, '#20263a');
  gradient.addColorStop(0.48, '#171d2c');
  gradient.addColorStop(1, '#101522');

  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const tileSize = Math.max(
    35,
    Math.min(width, height) / 20
  );

  for (
    let row = 0;
    row * tileSize < height;
    row += 1
  ) {
    for (
      let column = 0;
      column * tileSize < width;
      column += 1
    ) {
      const shade =
        (row * 7 + column * 11) % 5;

      context.fillStyle =
        `rgba(148, 163, 184, ${0.006 + shade * 0.0025})`;

      context.fillRect(
        column * tileSize + 1,
        row * tileSize + 1,
        tileSize - 2,
        tileSize - 2
      );
    }
  }
}

function drawFloorGrid(context, width, height) {
  const step = Math.max(
    32,
    Math.round(Math.min(width, height) / 24)
  );

  context.lineWidth = 1;

  for (
    let x = 0;
    x <= width;
    x += step
  ) {
    context.strokeStyle =
      x % (step * 5) === 0
        ? PALETTE.gridMajor
        : PALETTE.grid;

    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, height);
    context.stroke();
  }

  for (
    let y = 0;
    y <= height;
    y += step
  ) {
    context.strokeStyle =
      y % (step * 5) === 0
        ? PALETTE.gridMajor
        : PALETTE.grid;

    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(width, y + 0.5);
    context.stroke();
  }
}

/* -------------------------------------------------------------------------- */
/* Room zones                                                                  */
/* -------------------------------------------------------------------------- */

function drawOfficeZones(context, width, height) {
  const zones = [
    {
      name: 'lounge',
      x: 0.025,
      y: 0.035,
      w: 0.245,
      h: 0.37,
      fill: 'rgba(139, 92, 246, .12)',
      edge: 'rgba(167, 139, 250, .24)',
    },
    {
      name: 'meeting',
      x: 0.335,
      y: 0.035,
      w: 0.315,
      h: 0.225,
      fill: 'rgba(56, 189, 248, .09)',
      edge: 'rgba(125, 211, 252, .22)',
    },
    {
      name: 'work',
      x: 0.705,
      y: 0.035,
      w: 0.265,
      h: 0.405,
      fill: 'rgba(59, 130, 246, .09)',
      edge: 'rgba(96, 165, 250, .22)',
    },
    {
      name: 'break',
      x: 0.025,
      y: 0.68,
      w: 0.265,
      h: 0.275,
      fill: 'rgba(45, 212, 191, .075)',
      edge: 'rgba(94, 234, 212, .18)',
    },
    {
      name: 'focus',
      x: 0.705,
      y: 0.68,
      w: 0.265,
      h: 0.275,
      fill: 'rgba(167, 139, 250, .09)',
      edge: 'rgba(196, 181, 253, .22)',
    },
  ];

  for (const zone of zones) {
    const x = width * zone.x;
    const y = height * zone.y;
    const w = width * zone.w;
    const h = height * zone.h;

    context.save();

    roundedRect(
      context,
      x,
      y,
      w,
      h,
      20
    );

    context.fillStyle = zone.fill;
    context.fill();

    context.strokeStyle = zone.edge;
    context.lineWidth = 1.5;
    context.stroke();

    context.restore();
  }
}

/* -------------------------------------------------------------------------- */
/* Ambient lighting                                                            */
/* -------------------------------------------------------------------------- */

function drawAmbientLighting(context, width, height) {
  const lights = [
    [
      width * 0.12,
      height * 0.12,
      width * 0.17,
      'rgba(139, 92, 246, .13)',
    ],
    [
      width * 0.48,
      height * 0.08,
      width * 0.15,
      'rgba(56, 189, 248, .10)',
    ],
    [
      width * 0.86,
      height * 0.16,
      width * 0.18,
      'rgba(59, 130, 246, .12)',
    ],
    [
      width * 0.13,
      height * 0.87,
      width * 0.17,
      'rgba(45, 212, 191, .09)',
    ],
    [
      width * 0.86,
      height * 0.86,
      width * 0.16,
      'rgba(167, 139, 250, .12)',
    ],
  ];

  for (const [x, y, radius, color] of lights) {
    const gradient = context.createRadialGradient(
      x,
      y,
      0,
      x,
      y,
      radius
    );

    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    context.fillStyle = gradient;

    context.fillRect(
      x - radius,
      y - radius,
      radius * 2,
      radius * 2
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Lounge                                                                      */
/* -------------------------------------------------------------------------- */

function drawLounge(context, width, height) {
  const unit = Math.min(width, height);

  context.save();

  roundedRect(
    context,
    width * 0.045,
    height * 0.075,
    width * 0.20,
    height * 0.285,
    18
  );

  context.fillStyle = 'rgba(181, 116, 76, .12)';
  context.fill();

  context.strokeStyle = 'rgba(230, 177, 128, .18)';
  context.lineWidth = 1.5;
  context.stroke();

  context.restore();

  drawSofa(
    context,
    width * 0.065,
    height * 0.095,
    width * 0.145,
    height * 0.075,
    '#d28a58'
  );

  drawSofa(
    context,
    width * 0.065,
    height * 0.265,
    width * 0.145,
    height * 0.075,
    '#bc7449'
  );

  drawCoffeeTable(
    context,
    width * 0.105,
    height * 0.185,
    width * 0.075,
    height * 0.047
  );

  drawSideTable(
    context,
    width * 0.225,
    height * 0.17,
    unit * 0.025
  );

  drawFloorLamp(
    context,
    width * 0.045,
    height * 0.08,
    unit * 0.025
  );

  drawPlantPot(
    context,
    width * 0.245,
    height * 0.34,
    unit * 0.035
  );
}

function drawSofa(
  context,
  x,
  y,
  width,
  height,
  upholstery = '#bd7950'
) {
  context.save();

  context.shadowColor = 'rgba(0, 0, 0, .28)';
  context.shadowBlur = 12;
  context.shadowOffsetY = 5;

  roundedRect(
    context,
    x,
    y,
    width,
    height,
    Math.min(14, height * 0.22)
  );

  context.fillStyle = '#4b342d';
  context.fill();

  context.shadowColor = 'transparent';

  roundedRect(
    context,
    x + width * 0.045,
    y + height * 0.12,
    width * 0.91,
    height * 0.76,
    Math.min(10, height * 0.18)
  );

  context.fillStyle = upholstery;
  context.fill();

  context.strokeStyle = 'rgba(255, 235, 208, .35)';
  context.lineWidth = 1.5;
  context.stroke();

  context.fillStyle = 'rgba(255, 235, 208, .2)';

  context.fillRect(
    x + width * 0.49,
    y + height * 0.18,
    1.5,
    height * 0.62
  );

  roundedRect(
    context,
    x + width * 0.08,
    y + height * 0.22,
    width * 0.32,
    height * 0.48,
    5
  );

  context.fillStyle = 'rgba(255, 224, 190, .16)';
  context.fill();

  roundedRect(
    context,
    x + width * 0.59,
    y + height * 0.22,
    width * 0.32,
    height * 0.48,
    5
  );

  context.fill();

  context.restore();
}

function drawCoffeeTable(
  context,
  x,
  y,
  width,
  height,
  color = '#8b5f3d'
) {
  context.save();

  context.shadowColor = 'rgba(0, 0, 0, .3)';
  context.shadowBlur = 8;
  context.shadowOffsetY = 4;

  roundedRect(
    context,
    x,
    y,
    width,
    height,
    Math.min(height / 2, 12)
  );

  context.fillStyle = color;
  context.fill();

  context.shadowColor = 'transparent';

  context.strokeStyle = 'rgba(255, 218, 174, .5)';
  context.lineWidth = 1.5;
  context.stroke();

  context.beginPath();

  context.ellipse(
    x + width * 0.32,
    y + height * 0.5,
    width * 0.1,
    height * 0.17,
    -0.3,
    0,
    Math.PI * 2
  );

  context.fillStyle = '#477e60';
  context.fill();

  context.beginPath();

  context.arc(
    x + width * 0.72,
    y + height * 0.5,
    Math.min(width, height) * 0.09,
    0,
    Math.PI * 2
  );

  context.fillStyle = '#e2c08a';
  context.fill();

  context.restore();
}

function drawSideTable(context, x, y, size) {
  context.save();

  context.beginPath();
  context.arc(x, y, size, 0, Math.PI * 2);

  context.fillStyle = '#75513d';
  context.fill();

  context.strokeStyle = '#c18b5c';
  context.lineWidth = 2;
  context.stroke();

  context.beginPath();

  context.arc(
    x,
    y,
    size * 0.65,
    0,
    Math.PI * 2
  );

  context.fillStyle = '#b07a4e';
  context.fill();

  context.restore();
}

function drawFloorLamp(context, x, y, size) {
  context.save();

  const glow = context.createRadialGradient(
    x,
    y + size * 0.35,
    1,
    x,
    y + size * 0.35,
    size * 2.2
  );

  glow.addColorStop(
    0,
    'rgba(255, 195, 116, .2)'
  );

  glow.addColorStop(
    1,
    'rgba(255, 195, 116, 0)'
  );

  context.fillStyle = glow;

  context.fillRect(
    x - size * 2,
    y - size,
    size * 4,
    size * 4
  );

  context.strokeStyle = '#c7a77d';
  context.lineWidth = 3;

  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x, y + size);
  context.stroke();

  context.beginPath();

  context.ellipse(
    x,
    y,
    size * 0.42,
    size * 0.28,
    0,
    0,
    Math.PI * 2
  );

  context.fillStyle = '#f0c77f';
  context.fill();

  context.restore();
}

/* -------------------------------------------------------------------------- */
/* Meeting room                                                                */
/* -------------------------------------------------------------------------- */

function drawMeetingRoom(context, width, height) {
  const unit = Math.min(width, height);

  drawConferenceTable(
    context,
    width * 0.385,
    height * 0.095,
    width * 0.205,
    height * 0.09
  );

  for (let index = 0; index < 4; index += 1) {
    const chairX = width * (0.395 + index * 0.052);

    drawOfficeChair(
      context,
      chairX,
      height * 0.075,
      unit * 0.018,
      '#7d91a8'
    );

    drawOfficeChair(
      context,
      chairX,
      height * 0.205,
      unit * 0.018,
      '#7d91a8'
    );
  }

  drawScreenGlow(
    context,
    width * 0.465,
    height * 0.055,
    width * 0.08,
    height * 0.009
  );

  drawPlantPot(
    context,
    width * 0.625,
    height * 0.22,
    unit * 0.025
  );
}

function drawConferenceTable(
  context,
  x,
  y,
  width,
  height
) {
  context.save();

  context.shadowColor = 'rgba(0, 0, 0, .3)';
  context.shadowBlur = 10;
  context.shadowOffsetY = 4;

  roundedRect(
    context,
    x,
    y,
    width,
    height,
    12
  );

  context.fillStyle = '#493d43';
  context.fill();

  context.shadowColor = 'transparent';

  const gradient = context.createLinearGradient(
    x,
    y,
    x + width,
    y + height
  );

  gradient.addColorStop(0, '#a17b61');
  gradient.addColorStop(1, '#65483d');

  roundedRect(
    context,
    x,
    y,
    width,
    height,
    12
  );

  context.fillStyle = gradient;
  context.fill();

  context.strokeStyle = '#c09268';
  context.lineWidth = 2;
  context.stroke();

  roundedRect(
    context,
    x + width * 0.06,
    y + height * 0.1,
    width * 0.88,
    height * 0.8,
    7
  );

  context.fillStyle = 'rgba(232, 187, 133, .15)';
  context.fill();

  context.beginPath();

  context.arc(
    x + width / 2,
    y + height / 2,
    Math.min(width, height) * 0.11,
    0,
    Math.PI * 2
  );

  context.fillStyle = '#263c51';
  context.fill();

  context.strokeStyle = '#6e9bc1';
  context.stroke();

  context.restore();
}

function drawScreenGlow(context, x, y, width, height) {
  context.save();

  const glow = context.createRadialGradient(
    x + width / 2,
    y,
    1,
    x + width / 2,
    y,
    width * 0.7
  );

  glow.addColorStop(
    0,
    'rgba(105, 185, 255, .17)'
  );

  glow.addColorStop(
    1,
    'rgba(105, 185, 255, 0)'
  );

  context.fillStyle = glow;

  context.fillRect(
    x - width * 0.4,
    y - width * 0.5,
    width * 1.8,
    width
  );

  roundedRect(
    context,
    x,
    y,
    width,
    height,
    height / 2
  );

  context.fillStyle = '#243b50';
  context.fill();

  context.strokeStyle = '#6aa7d1';
  context.stroke();

  context.restore();
}

/* -------------------------------------------------------------------------- */
/* Work zone                                                                   */
/* -------------------------------------------------------------------------- */

function drawWorkZone(context, width, height) {
  const unit = Math.min(width, height);

  drawWorkstation(
    context,
    width * 0.735,
    height * 0.10,
    width * 0.095,
    height * 0.085
  );

  drawWorkstation(
    context,
    width * 0.845,
    height * 0.10,
    width * 0.095,
    height * 0.085
  );

  drawWorkstation(
    context,
    width * 0.735,
    height * 0.265,
    width * 0.095,
    height * 0.085
  );

  drawWorkstation(
    context,
    width * 0.845,
    height * 0.265,
    width * 0.095,
    height * 0.085
  );

  drawPlantPot(
    context,
    width * 0.815,
    height * 0.225,
    unit * 0.018
  );
}

function drawWorkstation(
  context,
  x,
  y,
  width,
  height
) {
  context.save();

  context.shadowColor = 'rgba(0, 0, 0, .25)';
  context.shadowBlur = 9;
  context.shadowOffsetY = 4;

  roundedRect(
    context,
    x,
    y,
    width,
    height,
    7
  );

  context.fillStyle = '#3b4659';
  context.fill();

  context.shadowColor = 'transparent';

  const deskGradient = context.createLinearGradient(
    x,
    y,
    x + width,
    y + height
  );

  deskGradient.addColorStop(0, '#8b694f');
  deskGradient.addColorStop(1, '#604633');

  roundedRect(
    context,
    x,
    y,
    width,
    height,
    7
  );

  context.fillStyle = deskGradient;
  context.fill();

  context.strokeStyle = '#c09268';
  context.lineWidth = 1.5;
  context.stroke();

  roundedRect(
    context,
    x + width * 0.32,
    y + height * 0.12,
    width * 0.36,
    height * 0.36,
    4
  );

  context.fillStyle = '#172b3c';
  context.fill();

  context.strokeStyle = '#5da5cf';
  context.stroke();

  const screenGradient = context.createLinearGradient(
    x + width * 0.32,
    y + height * 0.12,
    x + width * 0.68,
    y + height * 0.48
  );

  screenGradient.addColorStop(0, '#204a68');
  screenGradient.addColorStop(1, '#14253c');

  roundedRect(
    context,
    x + width * 0.35,
    y + height * 0.16,
    width * 0.30,
    height * 0.26,
    3
  );

  context.fillStyle = screenGradient;
  context.fill();

  context.strokeStyle = 'rgba(125, 211, 252, .6)';
  context.lineWidth = 1;

  context.beginPath();

  context.moveTo(
    x + width * 0.39,
    y + height * 0.23
  );

  context.lineTo(
    x + width * 0.60,
    y + height * 0.23
  );

  context.moveTo(
    x + width * 0.39,
    y + height * 0.30
  );

  context.lineTo(
    x + width * 0.55,
    y + height * 0.30
  );

  context.stroke();

  roundedRect(
    context,
    x + width * 0.39,
    y + height * 0.58,
    width * 0.22,
    height * 0.1,
    3
  );

  context.fillStyle = '#c9d1d9';
  context.fill();

  drawOfficeChair(
    context,
    x + width / 2,
    y + height + Math.min(width, height) * 0.24,
    Math.min(width, height) * 0.18,
    '#71889d'
  );

  context.restore();
}

function drawOfficeChair(
  context,
  centerX,
  centerY,
  radius,
  color
) {
  context.save();

  context.shadowColor = 'rgba(0, 0, 0, .25)';
  context.shadowBlur = 5;
  context.shadowOffsetY = 2;

  context.beginPath();

  context.arc(
    centerX,
    centerY,
    radius,
    0,
    Math.PI * 2
  );

  context.fillStyle = '#263344';
  context.fill();

  context.shadowColor = 'transparent';

  context.beginPath();

  context.arc(
    centerX,
    centerY,
    radius * 0.73,
    0,
    Math.PI * 2
  );

  context.fillStyle = color;
  context.fill();

  context.strokeStyle = 'rgba(225, 235, 250, .45)';
  context.lineWidth = 1.5;
  context.stroke();

  context.beginPath();

  context.moveTo(
    centerX - radius * 0.45,
    centerY
  );

  context.lineTo(
    centerX + radius * 0.45,
    centerY
  );

  context.strokeStyle = 'rgba(255, 255, 255, .22)';
  context.stroke();

  context.restore();
}

/* -------------------------------------------------------------------------- */
/* Break area                                                                  */
/* -------------------------------------------------------------------------- */

function drawBreakArea(context, width, height) {
  const unit = Math.min(width, height);

  context.save();

  roundedRect(
    context,
    width * 0.045,
    height * 0.735,
    width * 0.225,
    height * 0.175,
    18
  );

  context.fillStyle = 'rgba(174, 184, 194, .10)';
  context.fill();

  context.strokeStyle = 'rgba(210, 219, 231, .17)';
  context.stroke();

  context.restore();

  drawSofa(
    context,
    width * 0.065,
    height * 0.755,
    width * 0.14,
    height * 0.055,
    '#718a9c'
  );

  drawSofa(
    context,
    width * 0.065,
    height * 0.835,
    width * 0.14,
    height * 0.055,
    '#607b8e'
  );

  drawCoffeeTable(
    context,
    width * 0.205,
    height * 0.79,
    width * 0.045,
    height * 0.04,
    '#987451'
  );

  drawPlantPot(
    context,
    width * 0.245,
    height * 0.865,
    unit * 0.022
  );
}

/* -------------------------------------------------------------------------- */
/* Focus zone                                                                  */
/* -------------------------------------------------------------------------- */

function drawFocusZone(context, width, height) {
  const unit = Math.min(width, height);

  drawWorkstation(
    context,
    width * 0.765,
    height * 0.755,
    width * 0.14,
    height * 0.075
  );

  drawOfficeChair(
    context,
    width * 0.835,
    height * 0.85,
    unit * 0.025,
    '#7d70a7'
  );

  drawAcousticScreen(
    context,
    width * 0.745,
    height * 0.87,
    width * 0.18,
    height * 0.012
  );

  drawPlantPot(
    context,
    width * 0.935,
    height * 0.89,
    unit * 0.026
  );
}

function drawAcousticScreen(
  context,
  x,
  y,
  width,
  height
) {
  context.save();

  roundedRect(
    context,
    x,
    y,
    width,
    height,
    height / 2
  );

  context.fillStyle = '#343b5c';
  context.fill();

  context.strokeStyle = '#8b83c7';
  context.lineWidth = 1.5;
  context.stroke();

  for (
    let index = 1;
    index < 12;
    index += 1
  ) {
    context.beginPath();

    context.moveTo(
      x + width * index / 12,
      y + 2
    );

    context.lineTo(
      x + width * index / 12,
      y + height - 2
    );

    context.strokeStyle = 'rgba(225, 220, 255, .16)';
    context.stroke();
  }

  context.restore();
}

/* -------------------------------------------------------------------------- */
/* Plants                                                                      */
/* -------------------------------------------------------------------------- */

function drawPlantPot(
  context,
  centerX,
  centerY,
  radius
) {
  context.save();

  context.shadowColor = 'rgba(0, 0, 0, .32)';
  context.shadowBlur = radius * 0.4;
  context.shadowOffsetY = 3;

  context.beginPath();

  context.arc(
    centerX,
    centerY,
    radius * 0.66,
    0,
    Math.PI * 2
  );

  context.fillStyle = '#292c43';
  context.fill();

  context.shadowColor = 'transparent';

  context.beginPath();

  context.arc(
    centerX,
    centerY,
    radius * 0.52,
    0,
    Math.PI * 2
  );

  context.fillStyle = '#493d47';
  context.fill();

  for (
    let index = 0;
    index < 9;
    index += 1
  ) {
    const angle =
      (Math.PI * 2 * index) / 9;

    const leafX =
      centerX +
      Math.cos(angle) * radius * 0.43;

    const leafY =
      centerY +
      Math.sin(angle) * radius * 0.43;

    context.save();

    context.translate(leafX, leafY);
    context.rotate(angle);

    context.fillStyle =
      index % 2 === 0
        ? '#49a66f'
        : '#2f8b61';

    context.beginPath();

    context.ellipse(
      0,
      0,
      radius * 0.25,
      radius * 0.12,
      0,
      0,
      Math.PI * 2
    );

    context.fill();

    context.restore();
  }

  context.beginPath();

  context.arc(
    centerX,
    centerY,
    radius * 0.22,
    0,
    Math.PI * 2
  );

  context.fillStyle = '#1d6b4c';
  context.fill();

  context.restore();
}

function drawPerimeterPlants(context, width, height) {
  const size =
    Math.min(width, height) * 0.025;

  const points = [
    [width * 0.035, height * 0.055],
    [width * 0.285, height * 0.055],
    [width * 0.67, height * 0.055],
    [width * 0.965, height * 0.055],

    [width * 0.035, height * 0.63],
    [width * 0.31, height * 0.94],
    [width * 0.67, height * 0.94],
    [width * 0.965, height * 0.62],
  ];

  for (const [x, y] of points) {
    drawPlantPot(
      context,
      x,
      y,
      size
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Perimeter lights                                                            */
/* -------------------------------------------------------------------------- */

function drawPerimeterLighting(context, width, height) {
  const radius =
    Math.min(width, height) * 0.018;

  for (
    let index = 1;
    index < 10;
    index += 1
  ) {
    const x = width * index / 10;

    drawFloorLight(
      context,
      x,
      height * 0.018,
      radius
    );

    drawFloorLight(
      context,
      x,
      height * 0.982,
      radius
    );
  }
}

function drawFloorLight(
  context,
  x,
  y,
  radius
) {
  context.save();

  const gradient = context.createRadialGradient(
    x,
    y,
    0,
    x,
    y,
    radius * 2.5
  );

  gradient.addColorStop(
    0,
    'rgba(129, 140, 248, .3)'
  );

  gradient.addColorStop(
    1,
    'rgba(129, 140, 248, 0)'
  );

  context.fillStyle = gradient;

  context.fillRect(
    x - radius * 2.5,
    y - radius * 2.5,
    radius * 5,
    radius * 5
  );

  context.beginPath();

  context.arc(
    x,
    y,
    radius * 0.25,
    0,
    Math.PI * 2
  );

  context.fillStyle = '#a5b4fc';
  context.fill();

  context.restore();
}

/* -------------------------------------------------------------------------- */
/* Existing obstacles                                                          */
/* -------------------------------------------------------------------------- */

function drawObstacle(context, obstacle) {
  const style =
    TYPE_STYLE[obstacle.type] ?? TYPE_STYLE.wall;

  const { x, y, w, h } = obstacle;

  context.save();

  context.fillStyle = style.fill;
  context.strokeStyle = style.edge;
  context.lineWidth = 2;

  if (obstacle.type === 'plant') {
    drawPlantPot(
      context,
      x + w / 2,
      y + h / 2,
      Math.min(w, h) / 2
    );
  } else if (obstacle.type === 'pillar') {
    context.beginPath();

    context.arc(
      x + w / 2,
      y + h / 2,
      Math.min(w, h) / 2,
      0,
      Math.PI * 2
    );

    context.fill();
    context.stroke();
  } else {
    context.fillRect(
      x,
      y,
      w,
      h
    );

    context.strokeRect(
      x + 1,
      y + 1,
      w - 2,
      h - 2
    );

    if (obstacle.type === 'desk') {
      context.strokeStyle =
        'rgba(255, 255, 255, 0.055)';

      context.beginPath();

      context.moveTo(
        x + 8,
        y + h / 2
      );

      context.lineTo(
        x + w - 8,
        y + h / 2
      );

      context.stroke();
    }

    if (obstacle.type === 'screen') {
      context.fillStyle =
        'rgba(79, 140, 255, 0.22)';

      context.fillRect(
        x + 4,
        y + 4,
        w - 8,
        h - 8
      );
    }
  }

  if (
    obstacle.blocksAudio !== false &&
    obstacle.attenuation <= 0.3
  ) {
    context.setLineDash([6, 6]);

    context.strokeStyle =
      'rgba(255, 120, 120, 0.25)';

    context.lineWidth = 1.5;

    context.strokeRect(
      x - 4,
      y - 4,
      w + 8,
      h + 8
    );

    context.setLineDash([]);
  }

  context.restore();
}

/* -------------------------------------------------------------------------- */
/* Room labels and border                                                      */
/* -------------------------------------------------------------------------- */

function drawRoomLabels(context, width, height) {
  const labels = [
    {
      text: 'LOUNGE',
      x: 0.14,
      y: 0.40,
    },
    {
      text: 'MEETING ROOM',
      x: 0.49,
      y: 0.28,
    },
    {
      text: 'WORK ZONE',
      x: 0.84,
      y: 0.46,
    },
    {
      text: 'BREAK AREA',
      x: 0.15,
      y: 0.93,
    },
    {
      text: 'FOCUS ZONE',
      x: 0.84,
      y: 0.93,
    },
  ];

  context.save();

  context.textAlign = 'center';
  context.textBaseline = 'middle';

  context.font =
    `600 ${Math.max(14, Math.min(width, height) * 0.018)}px Inter, system-ui, sans-serif`;

  for (const label of labels) {
    const x = width * label.x;
    const y = height * label.y;

    const measuredWidth =
      context.measureText(label.text).width;

    const boxWidth = measuredWidth + 28;

    const boxHeight = Math.max(
      28,
      Math.min(width, height) * 0.04
    );

    roundedRect(
      context,
      x - boxWidth / 2,
      y - boxHeight / 2,
      boxWidth,
      boxHeight,
      boxHeight / 2
    );

    const badgeGradient = context.createLinearGradient(
      x - boxWidth / 2,
      y - boxHeight / 2,
      x + boxWidth / 2,
      y + boxHeight / 2
    );

    badgeGradient.addColorStop(
      0,
      'rgba(22, 28, 48, .96)'
    );

    badgeGradient.addColorStop(
      1,
      'rgba(12, 18, 33, .96)'
    );

    context.fillStyle = badgeGradient;
    context.fill();

    context.strokeStyle =
      'rgba(129, 140, 248, .32)';

    context.lineWidth = 1;
    context.stroke();

    context.fillStyle = '#e6eaf6';

    context.fillText(
      label.text,
      x,
      y + 0.5
    );
  }

  context.restore();
}

function drawRoomBorder(context, width, height) {
  context.save();

  context.strokeStyle = PALETTE.border;
  context.lineWidth = 8;

  context.strokeRect(
    4,
    4,
    width - 8,
    height - 8
  );

  context.strokeStyle = PALETTE.borderGlow;
  context.lineWidth = 2;

  context.strokeRect(
    12,
    12,
    width - 24,
    height - 24
  );

  context.restore();
}

export default renderStaticLayer;