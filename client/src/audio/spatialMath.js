/**
 * Spatial audio maths — the single source of truth for the mixing curve.
 *
 * Distance -> gain uses a smoothstep roll-off so there is no audible step at
 * the "full volume" radius:
 *
 *        1 +------------------ full volume (close enough to talk normally)
 *          |  smoothstep
 *        0 +--------------------------- 0 at the earshot radius (100 px)
 *
 * Lateral offset -> stereo pan uses the listener's facing direction, so a peer
 * standing behind you is centred and a peer to your left is in your left ear.
 * Everything here is pure and unit-testable.
 */

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Hermite smoothstep on [0, 1]. */
export const smoothstep = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/**
 * @param {number} distancePx  listener -> peer distance in pixels
 * @param {{earshotPx?:number, fullVolumePx?:number, soundFactor?:number}} options
 * @returns {number} 0..1 linear gain
 */
export function gainAtDistance(distancePx, { earshotPx = 100, fullVolumePx = 35, soundFactor = 1 } = {}) {
  if (!Number.isFinite(distancePx) || distancePx >= earshotPx) return 0;
  if (distancePx <= fullVolumePx) return clamp(soundFactor, 0, 1);
  const span = Math.max(1, earshotPx - fullVolumePx);
  const t = (distancePx - fullVolumePx) / span;
  return clamp(soundFactor, 0, 1) * (1 - smoothstep(t));
}

/**
 * Lateral offset of a peer relative to the listener's facing direction.
 * @returns {number} positive = to the listener's right ear
 */
export function lateralOffset({ dx, dy, listenerAngle = 0 }) {
  // Right-hand vector is the facing vector rotated by +90° on screen.
  return -dx * Math.sin(listenerAngle) + dy * Math.cos(listenerAngle);
}

/**
 * @returns {number} -1 (hard left) .. 1 (hard right)
 */
export function panAtDistance({ dx, dy, distancePx, listenerAngle = 0, earshotPx = 100 }) {
  if (distancePx >= earshotPx) return 0;
  const lateral = lateralOffset({ dx, dy, listenerAngle });
  const t = clamp(lateral / Math.max(1, earshotPx), -1, 1);
  // A mild expansion curve: subtle offsets stay audible, only a peer directly
  // beside you reaches the hard pan.
  return Math.sign(t) * Math.pow(Math.abs(t), 0.7) * 0.95;
}

/** Distance as a 0..1 "how far away is this voice" value. */
export const distanceRatio = (distancePx, earshotPx = 100) => clamp(distancePx / Math.max(1, earshotPx), 0, 1);

/**
 * Air absorption: distant voices lose their high end (a 20 kHz -> 1.6 kHz
 * sweep across the earshot circle) and walls take it away much faster.
 * @returns {number} lowpass cutoff in Hz
 */
export function lowpassFor({ distancePx, earshotPx = 100, soundFactor = 1 }) {
  const airCutoff = lerp(19000, 1600, smoothstep(distanceRatio(distancePx, earshotPx)));
  const wallCutoff = lerp(19000, 550, 1 - clamp(soundFactor, 0, 1));
  return clamp(Math.min(airCutoff, wallCutoff), 220, 20000);
}

/** RMS of an AnalyserNode's time-domain buffer. */
export function rms(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 1) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}