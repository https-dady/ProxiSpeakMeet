/**
 * Dynamic canvas renderer: avatars, conversation links and the earshot circle.
 * Everything here reads from `worldRef`, never from React state, so the frame
 * budget is spent on pixels instead of reconciliation.
 */
import { PALETTE } from './officeLayout.js';
import { gainAtDistance } from '../audio/spatialMath.js';

const AVATAR_RADIUS = 14;

export function drawFrame(context, { world, dpr, view, viewport, showLabels, showLinks, showClusters }) {
  const scale = view.scale;
  // One transform for both layers: viewport pixels -> letterboxed world pixels.
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, viewport.width, viewport.height);
  context.translate(view.offsetX, view.offsetY);
  context.scale(scale, scale);

  const self = world.self;
  const earshot = world.earshotRadiusPx;

  if (showClusters) drawClusters(context, world);

  // Earshot circle: what you can currently hear.
  context.beginPath();
  context.arc(self.x, self.y, earshot, 0, Math.PI * 2);
  context.strokeStyle = 'rgba(79, 140, 255, 0.28)';
  context.lineWidth = 2 / scale;
  context.setLineDash([10 / scale, 12 / scale]);
  context.stroke();
  context.setLineDash([]);
  context.beginPath();
  context.arc(self.x, self.y, earshot * 0.35, 0, Math.PI * 2);
  context.fillStyle = 'rgba(79, 140, 255, 0.045)';
  context.fill();

  if (showLinks) {
    for (const peer of world.peers.values()) {
      const distancePx = Math.hypot(peer.x - self.x, peer.y - self.y);
      const gain = gainAtDistance(distancePx, { earshotPx: earshot, soundFactor: peer.soundFactor ?? 1 });
      if (gain <= 0.01) continue;
      drawLink(context, self, peer, gain, scale);
    }
  }

  // Peers first, self last (self is always on top).
  for (const peer of world.peers.values()) drawPeer(context, peer, world, scale, showLabels);
  drawSelf(context, self, world, scale, showLabels);
}

function drawClusters(context, world) {
  for (const cluster of world.clusters ?? []) {
    if (cluster.size < 2) continue;
    context.beginPath();
    context.arc(cluster.centroid.x, cluster.centroid.y, cluster.size * 14 + 18, 0, Math.PI * 2);
    context.fillStyle = PALETTE.cluster;
    context.fill();
    context.strokeStyle = 'rgba(79, 140, 255, 0.25)';
    context.lineWidth = 1.5;
    context.stroke();
  }
}

/** The line between two people is literally the volume you hear. */
function drawLink(context, a, b, gain, scale) {
  const muted = (b.soundFactor ?? 1) < 0.5;
  context.beginPath();
  context.moveTo(a.x, a.y);
  context.lineTo(b.x, b.y);
  context.strokeStyle = muted ? `rgba(255, 140, 120, ${0.12 + gain * 0.25})` : `rgba(120, 200, 255, ${gain * 0.45})`;
  context.lineWidth = (1 + gain * 3.5) / scale;
  if (muted) context.setLineDash([4 / scale, 6 / scale]);
  context.stroke();
  context.setLineDash([]);
}

function drawPeer(context, peer, world, scale, showLabels) {
  const radius = AVATAR_RADIUS;
  const speaking = peer.speaking === true;
  const level = Math.min(1, (peer.level ?? 0) * 8);

  // Speaking halo grows with the live RMS level from the Web Audio analyser.
  if (speaking) {
    context.beginPath();
    context.arc(peer.x, peer.y, radius + 6 + level * 16, 0, Math.PI * 2);
    context.fillStyle = `rgba(90, 220, 160, ${0.12 + level * 0.2})`;
    context.fill();
  }

  // Muted peers are dimmed.
  const alpha = peer.micEnabled === false ? 0.4 : 1;
  context.globalAlpha = alpha;

  context.beginPath();
  context.arc(peer.x, peer.y + 3, radius, 0, Math.PI * 2);
  context.fillStyle = 'rgba(0,0,0,0.35)';
  context.fill();

  context.beginPath();
  avatarPath(context, peer, radius);
  context.fillStyle = peer.color ?? '#8899aa';
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,0.25)';
  context.lineWidth = 2 / scale;
  context.stroke();

  // Facing indicator
  context.beginPath();
  context.moveTo(peer.x + Math.cos(peer.angle ?? 0) * radius, peer.y + Math.sin(peer.angle ?? 0) * radius);
  context.lineTo(
    peer.x + Math.cos(peer.angle ?? 0) * (radius + 7),
    peer.y + Math.sin(peer.angle ?? 0) * (radius + 7),
  );
  context.strokeStyle = 'rgba(255,255,255,0.7)';
  context.lineWidth = 2 / scale;
  context.stroke();

  if (showLabels) {
    drawLabel(context, peer.name ?? 'Guest', peer.x, peer.y - radius - 10, peer.micEnabled === false ? 'muted' : '');
  }
  context.globalAlpha = 1;
}

function drawSelf(context, self, world, scale, showLabels) {
  const radius = AVATAR_RADIUS;
  context.beginPath();
  context.arc(self.x, self.y, radius + 5, 0, Math.PI * 2);
  context.strokeStyle = 'rgba(255,255,255,0.5)';
  context.lineWidth = 2 / scale;
  context.stroke();

  context.beginPath();
  avatarPath(context, self, radius);
  context.fillStyle = self.color ?? '#4f8cff';
  context.fill();
  context.strokeStyle = '#fff';
  context.lineWidth = 2.5 / scale;
  context.stroke();

  if (showLabels) drawLabel(context, `${self.name ?? 'You'} (you)`, self.x, self.y - radius - 12, 'self');
}

function avatarPath(context, peer, radius) {
  const shape = peer.avatar ?? 'circle';
  if (shape === 'square') {
    context.rect(peer.x - radius, peer.y - radius, radius * 2, radius * 2);
    return;
  }
  if (shape === 'triangle') {
    context.moveTo(peer.x, peer.y - radius * 1.15);
    context.lineTo(peer.x + radius, peer.y + radius * 0.8);
    context.lineTo(peer.x - radius, peer.y + radius * 0.8);
    context.closePath();
    return;
  }
  if (shape === 'hex') {
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const x = peer.x + Math.cos(angle) * radius;
      const y = peer.y + Math.sin(angle) * radius;
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    return;
  }
  context.arc(peer.x, peer.y, radius, 0, Math.PI * 2);
}

function drawLabel(context, text, x, y, variant) {
  context.font = '600 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const width = context.measureText(text).width + 12;
  context.fillStyle = 'rgba(8, 12, 18, 0.72)';
  roundRect(context, x - width / 2, y - 9, width, 18, 9);
  context.fill();
  context.fillStyle =
    variant === 'self' ? '#eaf2ff' : variant === 'muted' ? 'rgba(190, 200, 215, 0.6)' : '#cfd9e8';
  context.fillText(text, x, y);
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

export { AVATAR_RADIUS };
export default drawFrame;