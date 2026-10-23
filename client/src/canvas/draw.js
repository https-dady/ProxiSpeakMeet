/**
 * ProxiSpeak — Dynamic Canvas Renderer
 *
 * Responsibilities:
 * - Render real participants and the local avatar.
 * - Visualize proximity and spatial-audio connections.
 * - Render speaking indicators using live microphone analyser state.
 * - Render participant labels and movement direction.
 *
 * Networking, movement, audio gain calculations and world state remain
 * outside this module.
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

const COLORS = {
  self: '#8d9bff',
  speaking: '#43e6a6',
  text: '#f0f3ff',
  muted: '#a5adbf',
  labelBackground: 'rgba(8, 13, 25, 0.94)',
  labelBorder: 'rgba(168, 184, 222, 0.24)',
};

/**
 * Render one animation frame.
 *
 * All positions are expressed in world coordinates.
 * The view transform maps world coordinates to viewport coordinates.
 */
export function drawFrame(
  context,
  {
    world,
    dpr,
    view,
    viewport,
    showLabels = true,
    showLinks = true,
    showClusters = true,
  }
) {
  if (!context || !world?.self || !view || !viewport) {
    return;
  }

  const pixelRatio = Math.min(dpr || 1, 2);
  const scale = Math.max(view.scale || 1, 0.001);

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, viewport.width, viewport.height);

  context.save();

  context.translate(view.offsetX, view.offsetY);
  context.scale(scale, scale);

  const self = world.self;
  const earshot = Math.max(0, world.earshotRadiusPx || 0);

  if (showClusters) {
    drawClusters(context, world);
  }

  if (earshot > 0) {
    drawEarshot(context, self, earshot, scale);
  }

  if (showLinks && earshot > 0) {
    for (const peer of world.peers.values()) {
      const distance = Math.hypot(
        peer.x - self.x,
        peer.y - self.y
      );

      const gain = gainAtDistance(distance, {
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

  // Render the local participant last so the local avatar remains visible.
  drawAvatar(context, self, scale, showLabels, true);

  context.restore();
}

/**
 * Local spatial-audio range visualization.
 */
function drawEarshot(context, self, earshot, scale) {
  const gradient = context.createRadialGradient(
    self.x,
    self.y,
    earshot * 0.12,
    self.x,
    self.y,
    earshot
  );

  gradient.addColorStop(0, 'rgba(93, 117, 255, 0.055)');
  gradient.addColorStop(0.72, 'rgba(93, 117, 255, 0.025)');
  gradient.addColorStop(1, 'rgba(93, 117, 255, 0)');

  context.beginPath();
  context.arc(self.x, self.y, earshot, 0, Math.PI * 2);

  context.fillStyle = gradient;
  context.fill();

  context.strokeStyle = 'rgba(130, 148, 255, 0.42)';
  context.lineWidth = 1.5 / scale;

  context.setLineDash([8 / scale, 11 / scale]);
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

  context.strokeStyle = 'rgba(130, 148, 255, 0.15)';
  context.lineWidth = 1 / scale;
  context.stroke();
}

/**
 * Render participant clusters supplied by the existing world state.
 * This function does not generate or fabricate participants.
 */
function drawClusters(context, world) {
  for (const cluster of world.clusters ?? []) {
    if (
      cluster.size < 2 ||
      !cluster.centroid ||
      !Number.isFinite(cluster.centroid.x) ||
      !Number.isFinite(cluster.centroid.y)
    ) {
      continue;
    }

    const radius = cluster.size * 14 + 18;

    const gradient = context.createRadialGradient(
      cluster.centroid.x,
      cluster.centroid.y,
      0,
      cluster.centroid.x,
      cluster.centroid.y,
      radius
    );

    gradient.addColorStop(0, 'rgba(110, 100, 255, 0.12)');
    gradient.addColorStop(0.7, 'rgba(110, 100, 255, 0.045)');
    gradient.addColorStop(1, 'rgba(110, 100, 255, 0.005)');

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
    context.lineWidth = 1.3;
    context.stroke();
  }
}

/**
 * Draw the connection between the local participant and a nearby peer.
 *
 * This visualizes the existing gain calculation; it does not modify audio.
 */
function drawLink(context, from, peer, gain, scale) {
  const normalizedGain = Math.max(0, Math.min(1, gain));
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
      ? 'rgba(255, 140, 120, 0.12)'
      : `rgba(100, 151, 255, ${0.08 + normalizedGain * 0.22})`
  );

  gradient.addColorStop(
    1,
    muted
      ? `rgba(255, 140, 120, ${0.12 + normalizedGain * 0.22})`
      : `rgba(130, 117, 255, ${0.16 + normalizedGain * 0.34})`
  );

  context.save();

  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(peer.x, peer.y);

  context.strokeStyle = gradient;
  context.lineWidth = (1 + normalizedGain * 2.5) / scale;
  context.lineCap = 'round';

  if (muted) {
    context.setLineDash([4 / scale, 6 / scale]);
  }

  context.stroke();
  context.restore();
}

/**
 * Render a participant avatar.
 */
function drawAvatar(context, person, scale, showLabels, isSelf) {
  if (
    !person ||
    !Number.isFinite(person.x) ||
    !Number.isFinite(person.y)
  ) {
    return;
  }

  const radius = AVATAR_RADIUS;
  const speaking = person.speaking === true;

  const level = Math.max(
    0,
    Math.min(1, (person.level ?? 0) * 8)
  );

  const alpha =
    person.micEnabled === false && !isSelf
      ? 0.52
      : 1;

  const palette =
    AVATAR_FACES[person.avatar] ?? AVATAR_FACES.circle;

  context.save();
  context.globalAlpha = alpha;

  // Soft ground shadow.
  context.beginPath();

  context.ellipse(
    person.x,
    person.y + 5,
    radius + 2,
    radius * 0.78,
    0,
    0,
    Math.PI * 2
  );

  context.fillStyle = 'rgba(0, 0, 0, 0.34)';
  context.fill();

  // Speaking glow uses the existing microphone analyser state.
  if (speaking) {
    drawSpeakingHalo(context, person, radius, level);
  }

  // Outer participant ring.
  context.beginPath();

  context.arc(
    person.x,
    person.y,
    radius + (isSelf ? 7 : 5),
    0,
    Math.PI * 2
  );

  context.strokeStyle = isSelf
    ? 'rgba(141, 155, 255, 0.98)'
    : speaking
      ? 'rgba(67, 230, 166, 0.95)'
      : `${person.color ?? '#8b9aff'}cc`;

  context.lineWidth = (isSelf ? 2.5 : 1.8) / scale;
  context.stroke();

  // Avatar body.
  context.beginPath();
  avatarPath(context, person, radius);

  context.fillStyle = person.color ?? '#617cff';
  context.fill();

  // Face illustration clipped to the configured avatar shape.
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
  context.strokeStyle = 'rgba(111, 49, 43, 0.8)';
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
  context.beginPath();
  avatarPath(context, person, radius);

  context.strokeStyle = isSelf
    ? '#e6eaff'
    : 'rgba(232, 238, 255, 0.82)';

  context.lineWidth = 1.5 / scale;
  context.stroke();

  // Direction indicator follows the existing movement angle.
  drawDirectionIndicator(context, person, radius, scale);

  // Participant label.
  if (showLabels) {
    const label = isSelf
      ? `${person.name ?? 'You'} · You`
      : person.name ?? 'Guest';

    const variant = isSelf
      ? 'self'
      : person.micEnabled === false
        ? 'muted'
        : speaking
          ? 'speaking'
          : 'peer';

    drawLabel(
      context,
      label,
      person.x,
      person.y - radius - 13,
      variant,
      scale
    );
  }

  context.restore();
}

/**
 * Speaking indicator with a subtle live level response.
 */
function drawSpeakingHalo(context, person, radius, level) {
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
    `rgba(67, 230, 166, ${0.25 + level * 0.25})`
  );

  glow.addColorStop(
    0.65,
    `rgba(67, 230, 166, ${0.09 + level * 0.08})`
  );

  glow.addColorStop(1, 'rgba(67, 230, 166, 0)');

  context.beginPath();
  context.arc(person.x, person.y, halo, 0, Math.PI * 2);

  context.fillStyle = glow;
  context.fill();

  // Thin speaking ring.
  context.beginPath();
  context.arc(
    person.x,
    person.y,
    radius + 4 + level * 3,
    0,
    Math.PI * 2
  );

  context.strokeStyle = `rgba(67, 230, 166, ${0.35 + level * 0.5})`;
  context.lineWidth = 1.5;
  context.stroke();
}

/**
 * Draw the direction indicator without changing movement state.
 */
function drawDirectionIndicator(context, person, radius, scale) {
  const angle = person.angle ?? 0;

  context.beginPath();

  context.moveTo(
    person.x + Math.cos(angle) * (radius + 2),
    person.y + Math.sin(angle) * (radius + 2)
  );

  context.lineTo(
    person.x + Math.cos(angle) * (radius + 8),
    person.y + Math.sin(angle) * (radius + 8)
  );

  context.strokeStyle = 'rgba(235, 239, 255, 0.88)';
  context.lineWidth = 1.8 / scale;
  context.lineCap = 'round';
  context.stroke();
}

/**
 * Construct the configured avatar silhouette.
 */
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
    for (let index = 0; index < 6; index += 1) {
      const angle =
        (Math.PI / 3) * index - Math.PI / 2;

      const x = person.x + Math.cos(angle) * radius;
      const y = person.y + Math.sin(angle) * radius;

      if (index === 0) {
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

/**
 * Draw a compact participant name badge.
 */
function drawLabel(context, text, x, y, variant, scale) {
  context.save();

  const inverseScale = 1 / Math.max(scale, 0.65);

  context.font =
    `600 ${12 * inverseScale}px Inter, ui-sans-serif, system-ui, sans-serif`;

  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const width =
    context.measureText(text).width + 18 * inverseScale;

  const height = 25 * inverseScale;
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
      ? 'rgba(45, 57, 128, 0.96)'
      : variant === 'speaking'
        ? 'rgba(9, 37, 32, 0.96)'
        : COLORS.labelBackground;

  context.fill();

  context.strokeStyle =
    variant === 'self'
      ? 'rgba(141, 155, 255, 0.9)'
      : variant === 'speaking'
        ? 'rgba(67, 230, 166, 0.65)'
        : COLORS.labelBorder;

  context.lineWidth = 1 / scale;
  context.stroke();

  context.fillStyle =
    variant === 'muted'
      ? COLORS.muted
      : variant === 'speaking'
        ? '#a8f5d7'
        : COLORS.text;

  context.fillText(text, x, y + 0.5 * inverseScale);

  context.restore();
}