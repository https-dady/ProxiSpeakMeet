/**
 * Local avatar physics.
 *
 * The server is authoritative (it re-runs collision and the speed clamp), but
 * doing it here keeps movement frame-perfect instead of one network round trip
 * behind. Both implementations use the same axis-of-least-penetration rule, so
 * they agree on where an avatar ends up.
 */

export function desiredDirection(keys, moveTarget, position) {
  let dx = 0;
  let dy = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;

  if (dx === 0 && dy === 0 && moveTarget) {
    const tx = moveTarget.x - position.x;
    const ty = moveTarget.y - position.y;
    const distance = Math.hypot(tx, ty);
    if (distance < 4) return { dx: 0, dy: 0, arrived: true };
    return { dx: tx / distance, dy: ty / distance, arrived: false };
  }

  const length = Math.hypot(dx, dy);
  if (length === 0) return { dx: 0, dy: 0, arrived: false };
  return { dx: dx / length, dy: dy / length, arrived: false };
}

export function resolveCollision(x, y, radius, obstacles = []) {
  let cx = x;
  let cy = y;
  let hit = false;

  for (let pass = 0; pass < 2; pass += 1) {
    for (const obstacle of obstacles) {
      const insideX = cx >= obstacle.x - radius && cx <= obstacle.x + obstacle.w + radius;
      const insideY = cy >= obstacle.y - radius && cy <= obstacle.y + obstacle.h + radius;
      if (!insideX || !insideY) continue;

      const left = cx - (obstacle.x - radius);
      const right = obstacle.x + obstacle.w + radius - cx;
      const top = cy - (obstacle.y - radius);
      const bottom = obstacle.y + obstacle.h + radius - cy;
      const min = Math.min(left, right, top, bottom);

      if (min === left) cx = obstacle.x - radius;
      else if (min === right) cx = obstacle.x + obstacle.w + radius;
      else if (min === top) cy = obstacle.y - radius;
      else cy = obstacle.y + obstacle.h + radius;
      hit = true;
    }
  }
  return { x: cx, y: cy, hit };
}

/** Exponential approach towards a target velocity — frame-rate independent. */
export function approach(current, target, maxDelta) {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}