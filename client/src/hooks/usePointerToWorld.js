/**
 * Click-to-move.
 *
 * The canvas is scaled to fit the viewport, so a screen click must be mapped
 * back into world pixels before it can become a movement target.
 */
import { useCallback } from 'react';
import { computeView } from '../canvas/officeLayout.js';

export function usePointerToWorld({ canvasRef, inputRef, worldRef, enabled = true }) {
  return useCallback(
    (event) => {
      if (!enabled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const room = worldRef.current.room ?? { width: 1920, height: 1080 };
      const { scale, offsetX, offsetY } = computeView({ width: rect.width, height: rect.height }, room);

      const x = (event.clientX - rect.left - offsetX) / scale;
      const y = (event.clientY - rect.top - offsetY) / scale;

      if (x < 0 || y < 0 || x > room.width || y > room.height) {
        inputRef.current.moveTarget = null; // clicked outside the floor
        return;
      }
      inputRef.current.moveTarget = { x, y };
    },
    [canvasRef, inputRef, worldRef, enabled],
  );
}

export default usePointerToWorld;