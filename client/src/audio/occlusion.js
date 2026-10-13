/**
 * Client-side mirror of the server's occlusion model.
 *
 * The server stays authoritative (`soundFactor` arrives with every mesh edge
 * and on `peer:audio-obstruction`), but running the same maths locally lets the
 * canvas draw an accurate "muffled" line between avatars without waiting for a
 * round trip.
 */
export function segmentIntersectsRect(ax, ay, bx, by, rect) {
  const x0 = Math.min(ax, bx);
  const x1 = Math.max(ax, bx);
  const y0 = Math.min(ay, by);
  const y1 = Math.max(ay, by);

  if (x1 < rect.x || x0 > rect.x + rect.w || y1 < rect.y || y0 > rect.y + rect.h) return false;

  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return ax >= rect.x && ax <= rect.x + rect.w && ay >= rect.y && ay <= rect.y + rect.h;

  let tMin = 0;
  let tMax = 1;
  const slabs = [
    [-dx, ax - rect.x, 0, rect.w],
    [-dy, ay - rect.y, 0, rect.h],
  ];
  for (const [p, q, lo, hi] of slabs) {
    if (p === 0) {
      if (q < lo || q > hi) return false;
    } else {
      const t1 = q / p;
      const t2 = (hi - q) / p;
      tMin = Math.max(tMin, Math.min(t1, t2));
      tMax = Math.min(tMax, Math.max(t1, t2));
      if (tMin > tMax) return false;
    }
  }
  return true;
}

/** @returns {{soundFactor:number, blocks:number}} */
export function soundFactorBetween(a, b, obstacles = []) {
  let soundFactor = 1;
  let blocks = 0;
  for (const obstacle of obstacles) {
    if (obstacle.blocksAudio === false) continue;
    if (segmentIntersectsRect(a.x, a.y, b.x, b.y, obstacle)) {
      blocks += 1;
      soundFactor *= Math.min(1, Math.max(0, obstacle.attenuation ?? 0.2));
    }
  }
  return { soundFactor: Math.max(0, soundFactor), blocks };
}