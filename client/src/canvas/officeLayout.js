/**
 * ProxiSpeak office floor renderer.
 *
 * The static canvas is intentionally decorative only: all authoritative room
 * dimensions and collision/audio obstacles continue to come from the server.
 * No movement, collision, socket, or audio rules live in this module.
 */

export const PALETTE = {
  floor: '#252a38',
  floorAlt: '#171d2b',
  grid: 'rgba(224, 211, 190, 0.055)',
  gridMajor: 'rgba(224, 211, 190, 0.12)',
  border: '#26334a',
  borderGlow: 'rgba(100, 126, 255, 0.34)',
  text: '#d8deee',
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

export function renderStaticLayer(
  context,
  {
    room,
    viewport,
    view,
    dpr = 1,
  }
) {
  if (!context || !room || !viewport || !view) return;

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
  drawZones(context, width, height);
  drawTileGrid(context, width, height);
  drawAmbientLighting(context, width, height);

  for (const obstacle of room.obstacles ?? []) {
    drawObstacle(context, obstacle);
  }

  // Decorative fixtures do not affect collision geometry.
  drawWallDetails(context, width, height);
  drawRoomLabels(context, width, height);
  drawRoomBorder(context, width, height);

  context.restore();
}

function roundedRect(
  context,
  x,
  y,
  width,
  height,
  radius
) {
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

function drawFloor(context, width, height) {
  const gradient = context.createLinearGradient(
    0,
    0,
    width,
    height
  );

  gradient.addColorStop(0, '#303342');
  gradient.addColorStop(0.48, '#252b39');
  gradient.addColorStop(1, '#171e2b');

  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  // Subtle tile variation.
  const tile = Math.max(
    44,
    Math.min(width, height) / 17
  );

  for (
    let row = 0;
    row * tile < height;
    row += 1
  ) {
    for (
      let col = 0;
      col * tile < width;
      col += 1
    ) {
      const shade = (row * 7 + col * 11) % 5;

      context.fillStyle =
        `rgba(210, 204, 190, ${0.008 + shade * 0.003})`;

      context.fillRect(
        col * tile + 1,
        row * tile + 1,
        tile - 2,
        tile - 2
      );
    }
  }
}

function drawZones(context, width, height) {
  const zones = [
    {
      x: 0.025,
      y: 0.035,
      w: 0.255,
      h: 0.37,
      fill: 'rgba(190, 117, 75, .13)',
      edge: 'rgba(232, 169, 117, .23)',
    },
    {
      x: 0.34,
      y: 0.025,
      w: 0.31,
      h: 0.23,
      fill: 'rgba(196, 143, 86, .12)',
      edge: 'rgba(232, 183, 121, .25)',
    },
    {
      x: 0.70,
      y: 0.04,
      w: 0.265,
      h: 0.40,
      fill: 'rgba(153, 111, 85, .12)',
      edge: 'rgba(223, 171, 125, .22)',
    },
    {
      x: 0.025,
      y: 0.68,
      w: 0.27,
      h: 0.275,
      fill: 'rgba(117, 134, 153, .11)',
      edge: 'rgba(165, 184, 208, .18)',
    },
    {
      x: 0.70,
      y: 0.68,
      w: 0.265,
      h: 0.275,
      fill: 'rgba(116, 96, 157, .12)',
      edge: 'rgba(166, 137, 226, .22)',
    },
  ];

  zones.forEach((zone) => {
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
      18
    );

    context.fillStyle = zone.fill;
    context.fill();

    context.strokeStyle = zone.edge;
    context.lineWidth = 2;
    context.stroke();

    context.restore();
  });
}

function drawTileGrid(context, width, height) {
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

function drawAmbientLighting(context, width, height) {
  const lights = [
    [
      width * 0.12,
      height * 0.12,
      width * 0.17,
      'rgba(255, 174, 105, .17)',
    ],
    [
      width * 0.48,
      height * 0.08,
      width * 0.15,
      'rgba(255, 198, 130, .13)',
    ],
    [
      width * 0.86,
      height * 0.16,
      width * 0.18,
      'rgba(255, 164, 98, .16)',
    ],
    [
      width * 0.13,
      height * 0.87,
      width * 0.17,
      'rgba(255, 181, 111, .12)',
    ],
    [
      width * 0.86,
      height * 0.86,
      width * 0.16,
      'rgba(166, 128, 255, .12)',
    ],
  ];

  lights.forEach(([x, y, radius, color]) => {
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
  });
}

function drawObstacle(context, obstacle) {
  const style =
    TYPE_STYLE[obstacle.type] ?? TYPE_STYLE.wall;

  const { x, y, w, h } = obstacle;

  context.save();

  if (obstacle.type === 'plant') {
    drawPlant(
      context,
      x + w / 2,
      y + h / 2,
      Math.min(w, h) * 0.8
    );
  } else if (obstacle.type === 'pillar') {
    context.shadowColor = 'rgba(0, 0, 0, .28)';
    context.shadowBlur = 12;
    context.shadowOffsetY = 4;

    context.fillStyle = style.fill;
    context.strokeStyle = style.edge;
    context.lineWidth = 2;

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

    context.shadowColor = 'transparent';

    context.beginPath();

    context.arc(
      x + w / 2,
      y + h / 2,
      Math.min(w, h) * 0.28,
      0,
      Math.PI * 2
    );

    context.strokeStyle = 'rgba(255,255,255,.12)';
    context.stroke();
  } else {
    context.shadowColor = 'rgba(0, 0, 0, .28)';

    context.shadowBlur =
      obstacle.type === 'desk' ? 12 : 7;

    context.shadowOffsetY = 5;

    roundedRect(
      context,
      x,
      y,
      w,
      h,
      obstacle.type === 'wall' ? 5 : 8
    );

    context.fillStyle = style.fill;
    context.fill();

    context.shadowColor = 'transparent';
    context.strokeStyle = style.edge;

    context.lineWidth =
      obstacle.type === 'wall' ? 3 : 2;

    context.stroke();

    if (obstacle.type === 'desk') {
      drawDeskDetails(context, x, y, w, h);
    }

    if (obstacle.type === 'screen') {
      drawScreenDetails(context, x, y, w, h);
    }

    if (obstacle.type === 'wall') {
      drawWallHighlight(context, x, y, w, h);
    }
  }

  // Visual cue uses existing obstacle metadata.
  if (
    obstacle.blocksAudio !== false &&
    obstacle.attenuation <= 0.3
  ) {
    context.setLineDash([6, 6]);

    context.strokeStyle =
      'rgba(255, 120, 120, 0.22)';

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

function drawDeskDetails(context, x, y, w, h) {
  const inset = Math.max(
    5,
    Math.min(w, h) * 0.08
  );

  context.save();

  roundedRect(
    context,
    x + inset,
    y + inset,
    w - inset * 2,
    h - inset * 2,
    5
  );

  context.fillStyle = 'rgba(25, 18, 16, .18)';
  context.fill();

  context.strokeStyle = 'rgba(255, 220, 170, .16)';
  context.lineWidth = 1.5;
  context.stroke();

  // Decorative laptop; does not affect physics.
  const deviceW = Math.min(28, w * 0.22);
  const deviceH = Math.min(18, h * 0.38);

  context.fillStyle = '#182536';

  roundedRect(
    context,
    x + w / 2 - deviceW / 2,
    y + h / 2 - deviceH / 2,
    deviceW,
    deviceH,
    3
  );

  context.fill();

  context.strokeStyle = 'rgba(123, 184, 255, .7)';
  context.stroke();

  context.fillStyle = 'rgba(132, 196, 255, .23)';

  context.fillRect(
    x + w / 2 - deviceW / 2 + 3,
    y + h / 2 - deviceH / 2 + 3,
    deviceW - 6,
    deviceH - 6
  );

  context.restore();
}

function drawScreenDetails(context, x, y, w, h) {
  context.save();

  context.fillStyle = '#172c42';

  roundedRect(
    context,
    x + 2,
    y + 2,
    Math.max(1, w - 4),
    Math.max(1, h - 4),
    4
  );

  context.fill();

  context.strokeStyle = 'rgba(113, 189, 255, .55)';
  context.lineWidth = 1;
  context.stroke();

  context.restore();
}

function drawWallHighlight(context, x, y, w, h) {
  context.save();

  context.strokeStyle = 'rgba(180, 198, 230, .22)';
  context.lineWidth = 1;

  context.beginPath();

  if (w >= h) {
    context.moveTo(x + 5, y + 3);
    context.lineTo(x + w - 5, y + 3);
  } else {
    context.moveTo(x + 3, y + 5);
    context.lineTo(x + 3, y + h - 5);
  }

  context.stroke();
  context.restore();
}

function drawPlant(context, cx, cy, radius) {
  context.save();

  context.shadowColor = 'rgba(0,0,0,.32)';
  context.shadowBlur = radius * 0.4;
  context.shadowOffsetY = 3;

  context.fillStyle = '#3a2f2b';
  context.beginPath();

  context.arc(
    cx,
    cy,
    radius * 0.66,
    0,
    Math.PI * 2
  );

  context.fill();

  context.shadowColor = 'transparent';
  context.fillStyle = '#694c38';
  context.beginPath();

  context.arc(
    cx,
    cy,
    radius * 0.52,
    0,
    Math.PI * 2
  );

  context.fill();

  for (let i = 0; i < 9; i += 1) {
    const angle = (Math.PI * 2 * i) / 9;

    const leafX =
      cx + Math.cos(angle) * radius * 0.43;

    const leafY =
      cy + Math.sin(angle) * radius * 0.43;

    context.save();

    context.translate(leafX, leafY);
    context.rotate(angle);

    context.fillStyle =
      i % 2 ? '#2f8b61' : '#49a66f';

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

  context.fillStyle = '#1d6b4c';
  context.beginPath();

  context.arc(
    cx,
    cy,
    radius * 0.22,
    0,
    Math.PI * 2
  );

  context.fill();
  context.restore();
}

function drawWallDetails(context, width, height) {
  const margin = Math.max(
    12,
    Math.min(width, height) * 0.018
  );

  context.save();

  context.strokeStyle = 'rgba(213, 223, 246, .14)';
  context.lineWidth = 2;

  context.strokeRect(
    margin,
    margin,
    width - margin * 2,
    height - margin * 2
  );

  // Warm wall lights along the perimeter.
  const points = [
    [width * 0.08, margin],
    [width * 0.28, margin],
    [width * 0.51, margin],
    [width * 0.75, margin],
    [width * 0.92, margin],

    [width * 0.08, height - margin],
    [width * 0.28, height - margin],
    [width * 0.51, height - margin],
    [width * 0.75, height - margin],
    [width * 0.92, height - margin],
  ];

  points.forEach(([x, y]) => {
    const glow = context.createRadialGradient(
      x,
      y,
      1,
      x,
      y,
      24
    );

    glow.addColorStop(
      0,
      'rgba(255, 190, 117, .5)'
    );

    glow.addColorStop(
      1,
      'rgba(255, 190, 117, 0)'
    );

    context.fillStyle = glow;

    context.fillRect(
      x - 24,
      y - 24,
      48,
      48
    );

    context.fillStyle = '#e9b77c';
    context.fillRect(
      x - 5,
      y - 2,
      10,
      4
    );
  });

  context.restore();
}

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

  labels.forEach(({ text, x, y }) => {
    const px = width * x;
    const py = height * y;

    const measured =
      context.measureText(text).width;

    const boxW = measured + 28;

    const boxH = Math.max(
      28,
      Math.min(width, height) * 0.04
    );

    context.fillStyle = 'rgba(8, 13, 25, .72)';
    context.strokeStyle = 'rgba(171, 184, 220, .2)';
    context.lineWidth = 1;

    roundedRect(
      context,
      px - boxW / 2,
      py - boxH / 2,
      boxW,
      boxH,
      boxH / 2
    );

    context.fill();
    context.stroke();

    context.fillStyle = '#e6eaf6';
    context.fillText(text, px, py + 0.5);
  });

  context.restore();
}

function drawRoomBorder(context, width, height) {
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
}

export default renderStaticLayer;