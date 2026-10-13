/**
 * 2D Virtual World (Week 1 + 4).
 *
 * Two stacked canvases:
 *   static  — floor, grid and furniture, repainted only when the room changes
 *   dynamic — avatars, links, clusters, repainted every frame
 *
 * One rAF loop drives physics, networking and audio geometry. Nothing in this
 * file calls setState, so React never runs during animation.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useProxi } from '../state/ProxiContext.jsx';
import { useAnimationFrame } from '../hooks/useAnimationFrame.js';
import { useKeyboardMovement } from '../hooks/useKeyboardMovement.js';
import { usePointerToWorld } from '../hooks/usePointerToWorld.js';
import { renderStaticLayer, computeView } from './officeLayout.js';
import { drawFrame } from './draw.js';
import { desiredDirection, resolveCollision, approach } from './physics.js';
import config from '../config.js';

const WORLD_FALLBACK = { roomId: 'lobby', width: 1920, height: 1080, obstacles: [], spawnPoints: [] };

export function WorldCanvas() {
  const { worldRef, inputRef, sendPosition, audioRef, state } = useProxi();
  const containerRef = useRef(null);
  const staticRef = useRef(null);
  const dynamicRef = useRef(null);
  const velocityRef = useRef({ x: 0, y: 0 });
  const fpsRef = useRef({ frames: 0, last: performance.now(), fps: 0, frameMs: 0 });
  const [layers, setLayers] = useState({ showLabels: true, showLinks: true, showClusters: true });

  const room = state.room ?? WORLD_FALLBACK;
  const joined = Boolean(state.selfId);

  useKeyboardMovement(inputRef, { enabled: joined });
  const onPointerDown = usePointerToWorld({ canvasRef: dynamicRef, inputRef, worldRef, enabled: joined });

  // ---- sizing + static layer ---------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    const staticCanvas = staticRef.current;
    if (!container || !staticCanvas) return undefined;

    const repaint = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const width = Math.floor(rect.width * dpr);
      const height = Math.floor(rect.height * dpr);

      for (const canvas of [staticCanvas, dynamicRef.current]) {
        if (!canvas) continue;
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }

      const viewport = { width: rect.width, height: rect.height };
      const view = computeView(viewport, room);
      renderStaticLayer(staticCanvas.getContext('2d'), { room, viewport, view, dpr });
    };

    repaint();
    const observer = new ResizeObserver(repaint);
    observer.observe(container);
    return () => observer.disconnect();
  }, [room.width, room.height, room.obstacles]);

  // ---- the single animation loop -----------------------------------------
  const frame = useCallback(
    (delta, now) => {
      const canvas = dynamicRef.current;
      const context = canvas?.getContext('2d');
      if (!context) return;

      const world = worldRef.current;
      // Nothing to simulate or paint before the first successful join.
      if (!world.self.id) return;
      const world_ = { width: room.width, height: room.height };
      const { speed, clickSpeed, acceleration, friction, avatarRadius } = config.movement;

      // 1. Input -> target velocity
      const input = inputRef.current;
      const { dx, dy, arrived } = desiredDirection(input.keys, input.moveTarget, world.self);
      if (arrived && input.moveTarget) input.moveTarget = null;

      const targetSpeed = input.moveTarget ? clickSpeed : speed;
      const targetVx = dx * targetSpeed;
      const targetVy = dy * targetSpeed;
      const velocity = velocityRef.current;
      const rate = (dx === 0 && dy === 0 ? friction : acceleration) * delta;
      velocity.x = approach(velocity.x, targetVx, rate);
      velocity.y = approach(velocity.y, targetVy, rate);

      // 2. Integrate + collide
      let x = world.self.x + velocity.x * delta;
      let y = world.self.y + velocity.y * delta;
      const resolved = resolveCollision(x, y, avatarRadius, world.obstacles);
      x = Math.min(Math.max(resolved.x, avatarRadius), world_.width - avatarRadius);
      y = Math.min(Math.max(resolved.y, avatarRadius), world_.height - avatarRadius);
      world.self.x = x;
      world.self.y = y;

      // Facing follows the direction of travel.
      if (Math.hypot(velocity.x, velocity.y) > 12) {
        world.self.angle = Math.atan2(velocity.y, velocity.x);
      }

      // 3. Reconcile with the authoritative server position.
      if (world.self.authority) {
        const dxA = world.self.authority.x - x;
        const dyA = world.self.authority.y - y;
        const error = Math.hypot(dxA, dyA);
        if (error > 90) {
          world.self.x = world.self.authority.x;
          world.self.y = world.self.authority.y;
        } else if (error > 1.5) {
          world.self.x += dxA * Math.min(1, delta * 6);
          world.self.y += dyA * Math.min(1, delta * 6);
        }
      }

      // 4. Network (throttled inside sendPosition).
      sendPosition(world.self.x, world.self.y, world.self.angle);

      // 5. Audio geometry (throttled inside the engine).
      const audio = audioRef.current;
      if (audio) {
        audio.setListener(world.self);
        for (const peer of world.peers.values()) audio.setPeerGeometry(peer.id, peer);
        audio.update(now);
      }

      // 6. Paint
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const viewport = { width: rect.width, height: rect.height };
      drawFrame(context, {
        world,
        dpr,
        viewport,
        view: computeView(viewport, world_),
        showLabels: layers.showLabels,
        showLinks: layers.showLinks,
        showClusters: layers.showClusters,
      });

      // 7. FPS meter (kept in a ref; the HUD samples it).
      const meter = fpsRef.current;
      meter.frames += 1;
      const elapsed = now - meter.last;
      if (elapsed >= 500) {
        meter.fps = Math.round((meter.frames * 1000) / elapsed);
        meter.frameMs = Math.round((elapsed / meter.frames) * 100) / 100;
        meter.frames = 0;
        meter.last = now;
        world.fps = meter.fps;
        world.frameMs = meter.frameMs;
      }
    },
    [room.width, room.height, worldRef, inputRef, sendPosition, audioRef, layers],
  );

  useAnimationFrame(frame, true);

  return (
    <div className="world">
      <div className="world__stage" ref={containerRef}>
        <canvas ref={staticRef} className="world__layer world__layer--static" />
        <canvas
          ref={dynamicRef}
          className="world__layer world__layer--dynamic"
          onPointerDown={onPointerDown}
          style={{ cursor: joined ? 'crosshair' : 'default' }}
        />
        {!joined && <div className="world__veil">Join an office to start moving</div>}
      </div>

      <div className="world__controls">
        <label>
          <input type="checkbox" checked={layers.showLabels} onChange={(e) => setLayers((l) => ({ ...l, showLabels: e.target.checked }))} />
          labels
        </label>
        <label>
          <input type="checkbox" checked={layers.showLinks} onChange={(e) => setLayers((l) => ({ ...l, showLinks: e.target.checked }))} />
          audio links
        </label>
        <label>
          <input type="checkbox" checked={layers.showClusters} onChange={(e) => setLayers((l) => ({ ...l, showClusters: e.target.checked }))} />
          $geoNear clusters
        </label>
        <span className="world__hint">WASD / arrows to move · click the floor to walk there</span>
      </div>
    </div>
  );
}

export default WorldCanvas;