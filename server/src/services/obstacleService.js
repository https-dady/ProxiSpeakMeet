/**
 * Obstacle / occlusion engine.
 *
 * Sound does not travel in straight lines through a wall. For every candidate
 * peer we test the segment between the two avatars against the room's audio
 * blocking rectangles and multiply the surviving energy.
 *
 *   soundFactor = product(attenuation of every blocking obstacle)
 *
 * A soft screen (0.45) barely changes the mix; two concrete walls (0.12 x
 * 0.12) mute the peer completely.
 */

/** Slab-method segment/AABB test. Returns true when segment a->b crosses rect. */
export function segmentIntersectsRect(ax, ay, bx, by, rect) {
  const x0 = Math.min(ax, bx);
  const x1 = Math.max(ax, bx);
  const y0 = Math.min(ay, by);
  const y1 = Math.max(ay, by);

  // Fast reject on the bounding box.
  if (x1 < rect.x || x0 > rect.x + rect.w || y1 < rect.y || y0 > rect.y + rect.h) return false;

  const dx = bx - ax;
  const dy = by - ay;

  // Segment fully inside the rect horizontally/vertically (or degenerate).
  if (dx === 0 && dy === 0) return ax >= rect.x && ax <= rect.x + rect.w && ay >= rect.y && ay <= rect.y + rect.h;

  let tMin = 0;
  let tMax = 1;

  for (const [p, q, lo, hi] of [
    [-dx, ax - rect.x, 0, rect.w],
    [-dy, ay - rect.y, 0, rect.h],
  ]) {
    if (p === 0) {
      // Parallel to this slab: only a hit when the origin is inside it.
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

/** Number of audio-blocking obstacles between two pixel points. */
export function countBlockingObstacles(a, b, obstacles = []) {
  let count = 0;
  for (const obstacle of obstacles) {
    if (obstacle.blocksAudio === false) continue;
    if (segmentIntersectsRect(a.x, a.y, b.x, b.y, obstacle)) count += 1;
  }
  return count;
}

/**
 * @returns {{soundFactor:number, blocks:number, obstacles:string[]}}
 * soundFactor is the fraction of voice energy that survives the furniture.
 */
export function occlusionBetween(a, b, obstacles = []) {
  const blockers = [];
  for (const obstacle of obstacles) {
    if (obstacle.blocksAudio === false) continue;
    if (segmentIntersectsRect(a.x, a.y, b.x, b.y, obstacle)) blockers.push(obstacle);
  }
  if (blockers.length === 0) return { soundFactor: 1, blocks: 0, obstacles: [] };

  let soundFactor = 1;
  for (const obstacle of blockers) {
    soundFactor *= clamp01(obstacle.attenuation ?? 0.2);
  }
  return { soundFactor, blocks: blockers.length, obstacles: blockers.map((o) => o.id) };
}

/**
 * Axis-separated movement resolution: slide along walls instead of sticking.
 * @returns {{x:number,y:number,hit:boolean}}
 */
export function resolveCollision(x, y, radius, obstacles = []) {
  const solids = obstacles.filter((o) => o.solid !== false);
  let cx = x;
  let cy = y;
  let hit = false;

  for (let pass = 0; pass < 2; pass += 1) {
    for (const o of solids) {
      if (pointInRectWithRadius(cx, cy, radius, o)) {
        // Push out along the axis of least penetration.
        const left = cx - (o.x - radius);
        const right = o.x + o.w + radius - cx;
        const top = cy - (o.y - radius);
        const bottom = o.y + o.h + radius - cy;
        const min = Math.min(left, right, top, bottom);
        if (min === left) cx = o.x - radius;
        else if (min === right) cx = o.x + o.w + radius;
        else if (min === top) cy = o.y - radius;
        else cy = o.y + o.h + radius;
        hit = true;
      }
    }
  }
  return { x: cx, y: cy, hit };
}

const pointInRectWithRadius = (x, y, radius, rect) =>
  x >= rect.x - radius && x <= rect.x + rect.w + radius && y >= rect.y - radius && y <= rect.y + rect.h + radius;

const clamp01 = (v) => Math.min(1, Math.max(0, v));