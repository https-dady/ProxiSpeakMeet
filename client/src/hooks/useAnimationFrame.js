/**
 * A single requestAnimationFrame loop with delta-time integration.
 *
 * The whole client renders from ONE loop: movement physics, network throttling,
 * audio geometry and the canvas paint. Multiple loops would race on the same
 * state and make frame pacing unpredictable.
 */
import { useEffect, useRef } from 'react';

/**
 * @param {(deltaSeconds:number, nowMs:number) => void} frame
 * @param {boolean} active
 */
export function useAnimationFrame(frame, active = true) {
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => {
    if (!active) return undefined;
    let handle = 0;
    let last = performance.now();

    const tick = (now) => {
      // Clamp the delta so a backgrounded tab does not teleport the avatar on
      // return (the server clamps it too, but the client should not rely on it).
      const delta = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      frameRef.current(delta, now);
      handle = requestAnimationFrame(tick);
    };

    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [active]);
}

export default useAnimationFrame;