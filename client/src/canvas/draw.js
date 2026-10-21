/**
 * Dynamic canvas renderer for real peers, spatial audio links and live state.
 * Only visual drawing is handled here; geometry, audio gain and networking
 * continue to use the existing world state and gainAtDistance implementation.
 */

import { PALETTE } from './officeLayout.js';
import { gainAtDistance } from '../audio/spatialMath.js';

const AVATAR_RADIUS = 15;

const AVATAR_FACES = {
  circle: { skin: '#f4c5a2', hair: '#33252b' },
  square: { skin: '#d9a27e', hair: '#202b3d' },
  triangle: { skin: '#efbd91', hair: '#4a2e2a' },
  hex: { skin: '#c98f6c', hair: '#302633' },
};

export function drawFrame(
  context,
  {
    world,
    dpr,
    view,
    viewport,
    showLabels,
    showLinks,
    showClusters,
  }
) {
  if (!context || !world?.self || !view || !viewport) return;

  const scale = view.scale;

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, viewport.width, viewport.height);

  context.save();
  context.translate(view.offsetX, view.offsetY);
  context.scale(scale, scale);

  const self = world.self;
  const earshot = world.earshotRadiusPx;

  if (showClusters) {
    drawClusters(context, world);
  }

  drawEarshot(context, self, earshot, scale);

  if (showLinks) {
    for (const peer of world.peers.values()) {
      const distancePx = Math.hypot(
        peer.x - self.x,
        peer.y - self.y
      );

      const gain = gainAtDistance(distancePx, {
        earshotPx: earshot,
        soundFactor: peer.soundFactor ?? 1,
      });

      if (gain > 0.01) {
        drawLink(context, self, peer, gain, scale);
      }
    }
  }

  for (const peer of world.peers.values()) {
    drawAvatar(context, peer, scale, showLabels, false);
  }

  drawAvatar(context, self, scale, showLabels, true);

  context.restore();
}

function drawEarshot(context, self, earshot, scale) {
  const gradient = context.createRadialGradient(
    self.x,
    self.y,
    earshot * 0.12,
    self.x,
    self.y,
    earshot
  );

  gradient.addColorStop(0, 'rgba(93, 117, 255, .06)');
  gradient.addColorStop(1, 'rgba(93, 117, 255, 0)');

  context.beginPath();
  context.arc(self.x, self.y, earshot, 0, Math.PI * 2);

  context.fillStyle = gradient;
  context.fill();

  context.strokeStyle = 'rgba(116, 147, 255, .35)';
  context.lineWidth = 1.6 / scale;

  context.setLineDash([9 / scale, 12 / scale]);
  context.stroke();
  context.setLineDash([]);

  context.beginPath();
  context.arc(
    self.x,
    self.y,
    earshot * 0.35,
    0,
    Math.PI * 2
  );

  context.strokeStyle = 'rgba(116, 147, 255, .16)';
  context.lineWidth = 1 / scale;
  context.stroke();
}

function drawClusters(context, world) {
  for (const cluster of world.clusters ?? []) {
    if (cluster.size < 2) continue;

    const radius = cluster.size * 14 + 18;

    const gradient = context.createRadialGradient(
      cluster.centroid.x,
      cluster.centroid.y,
      0,
      cluster.centroid.x,
      cluster.centroid.y,
      radius
    );

    gradient.addColorStop(0, 'rgba(110, 100, 255, .12)');
    gradient.addColorStop(1, 'rgba(110, 100, 255, .015)');

    context.beginPath();

    context.arc(
      cluster.centroid.x,
      cluster.centroid.y,
      radius,
      0,
      Math.PI * 2
    );

    context.fillStyle = gradient;
    context.fill();

    context.strokeStyle = PALETTE.cluster;
    context.lineWidth = 1.4;
    context.stroke();
  }
}

function drawLink(context, from, peer, gain, scale) {
  const muted = (peer.soundFactor ?? 1) < 0.5;

  const gradient = context.createLinearGradient(
    from.x,
    from.y,
    peer.x,
    peer.y
  );

  gradient.addColorStop(
    0,
    muted
      ? 'rgba(255, 140, 120, .12)'
      : `rgba(100, 151, 255, ${0.08 + gain * 0.22})`
  );

  gradient.addColorStop(
    1,
    muted
      ? `rgba(255, 140, 120, ${0.12 + gain * 0.22})`
      : `rgba(130, 117, 255, ${0.16 + gain * 0.34})`
  );

  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(peer.x, peer.y);

  context.strokeStyle = gradient;
  context.lineWidth = (1 + gain * 3) / scale;

  if (muted) {
    context.setLineDash([4 / scale, 6 / scale]);
  }

  context.stroke();
  context.setLineDash([]);
}

function drawAvatar(context, person, scale, showLabels, isSelf) {
  const radius = AVATAR_RADIUS;
  const speaking = person.speaking === true;

  const level = Math.min(
    1,
    (person.level ?? 0) * 8
  );

  const alpha =
    person.micEnabled === false && !isSelf
      ? 0.52
      : 1;

  const palette =
    AVATAR_FACES[person.avatar] ?? AVATAR_FACES.circle;

  context.save();
  context.globalAlpha = alpha;

  // Avatar shadow.
  context.beginPath();

  context.arc(
    person.x,
    person.y + 4,
    radius + 2,
    0,
    Math.PI * 2
  );

  context.fillStyle = 'rgba(0, 0, 0, .34)';
  context.fill();

  // Speaking halo follows real microphone analyser state.
  if (speaking) {
    const halo = radius + 8 + level * 14;

    const glow = context.createRadialGradient(
      person.x,
      person.y,
      radius,
      person.x,
      person.y,
      halo
    );

    glow.addColorStop(
      0,
      `rgba(67, 230, 166, ${0.28 + level * 0.24})`
    );

    glow.addColorStop(
      1,
      'rgba(67, 230, 166, 0)'
    );

    context.beginPath();
    context.arc(person.x, person.y, halo, 0, Math.PI * 2);

    context.fillStyle = glow;
    context.fill();
  }

  // Outer proximity ring.
  context.beginPath();

  context.arc(
    person.x,
    person.y,
    radius + (isSelf ? 7 : 5),
    0,
    Math.PI * 2
  );

  context.strokeStyle = isSelf
    ? 'rgba(113, 132, 255, .95)'
    : speaking
      ? 'rgba(68, 225, 162, .92)'
      : `${person.color ?? '#8b9aff'}cc`;

  context.lineWidth = (isSelf ? 2.5 : 1.8) / scale;
  context.stroke();

  // Avatar silhouette.
  context.beginPath();
  avatarPath(context, person, radius);

  context.fillStyle = person.color ?? '#617cff';
  context.fill();

  // Face illustration clipped to the selected avatar shape.
  context.save();

  context.beginPath();
  avatarPath(context, person, radius - 1);
  context.clip();

  // Hair.
  context.fillStyle = palette.hair;
  context.beginPath();

  context.ellipse(
    person.x,
    person.y - 5,
    radius * 0.73,
    radius * 0.58,
    0,
    Math.PI,
    Math.PI * 2
  );

  context.fill();

  // Face.
  context.fillStyle = palette.skin;
  context.beginPath();

  context.ellipse(
    person.x,
    person.y + 1,
    radius * 0.57,
    radius * 0.63,
    0,
    0,
    Math.PI * 2
  );

  context.fill();

  // Eyes.
  context.fillStyle = '#263044';
  context.beginPath();

  context.arc(
    person.x - 4,
    person.y + 1,
    1.2,
    0,
    Math.PI * 2
  );

  context.arc(
    person.x + 4,
    person.y + 1,
    1.2,
    0,
    Math.PI * 2
  );

  context.fill();

  // Smile.
  context.strokeStyle = 'rgba(111, 49, 43, .8)';
  context.lineWidth = 1;
  context.beginPath();

  context.arc(
    person.x,
    person.y + 4,
    3,
    0.2,
    Math.PI - 0.2
  );

  context.stroke();

  context.restore();

  // Avatar outline.
  context.strokeStyle = isSelf
    ? '#e6eaff'
    : 'rgba(232, 238, 255, .8)';

  context.lineWidth = 1.5 / scale;
  context.beginPath();

  context.arc(
    person.x,
    person.y,
    radius,
    0,
    Math.PI * 2
  );

  context.stroke();

  // Direction marker follows the existing movement angle.
  context.beginPath();

  context.moveTo(
    person.x + Math.cos(person.angle ?? 0) * (radius + 2),
    person.y + Math.sin(person.angle ?? 0) * (radius + 2)
  );

  context.lineTo(
    person.x + Math.cos(person.angle ?? 0) * (radius + 8),
    person.y + Math.sin(person.angle ?? 0) * (radius + 8)
  );

  context.strokeStyle = 'rgba(235, 239, 255, .85)';
  context.lineWidth = 1.8 / scale;
  context.stroke();

  // Names.
  if (showLabels) {
    const label = isSelf
      ? `${person.name ?? 'You'} · You`
      : person.name ?? 'Guest';

    drawLabel(
      context,
      label,
      person.x,
      person.y - radius - 13,
      isSelf
        ? 'self'
        : person.micEnabled === false
          ? 'muted'
          : 'peer',
      scale
    );
  }

  context.restore();
}

function avatarPath(context, person, radius) {
  const shape = person.avatar ?? 'circle';

  context.beginPath();

  if (shape === 'square') {
    const size = radius * 1.8;

    context.roundRect(
      person.x - size / 2,
      person.y - size / 2,
      size,
      size,
      5
    );
  } else if (shape === 'triangle') {
    context.moveTo(
      person.x,
      person.y - radius * 1.08
    );

    context.lineTo(
      person.x + radius,
      person.y + radius * 0.82
    );

    context.lineTo(
      person.x - radius,
      person.y + radius * 0.82
    );

    context.closePath();
  } else if (shape === 'hex') {
    for (let i = 0; i < 6; i += 1) {
      const angle =
        (Math.PI / 3) * i - Math.PI / 2;

      const x =
        person.x + Math.cos(angle) * radius;

      const y =
        person.y + Math.sin(angle) * radius;

      if (i === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }

    context.closePath();
  } else {
    context.arc(
      person.x,
      person.y,
      radius,
      0,
      Math.PI * 2
    );
  }
}

function drawLabel(context, text, x, y, variant, scale) {
  context.save();

  context.font =
    `600 ${12 / Math.max(scale, 0.65)}px Inter, ui-sans-serif, system-ui, sans-serif`;

  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const width =
    context.measureText(text).width + 18;

  const height = 25;
  const left = x - width / 2;
  const top = y - height / 2;

  context.beginPath();

  context.roundRect(
    left,
    top,
    width,
    height,
    height / 2
  );

  context.fillStyle =
    variant === 'self'
      ? 'rgba(45, 57, 128, .96)'
      : 'rgba(8, 13, 25, .9)';

  context.fill();

  context.strokeStyle =
    variant === 'self'
      ? 'rgba(130, 145, 255, .85)'
      : 'rgba(168, 184, 222, .2)';

  context.lineWidth = 1 / scale;
  context.stroke();

  context.fillStyle =
    variant === 'muted'
      ? '#a5adbf'
      : '#f0f3ff';

  context.fillText(text, x, y + 0.5);

  context.restore();
}