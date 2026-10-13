/**
 * Keyboard input (WASD + arrow keys) for avatar movement.
 *
 * Keys are written into a shared ref, not React state: the render loop reads
 * them 60 times a second and a state update per keypress would re-render the
 * whole tree for nothing.
 */
import { useEffect } from 'react';

const MOVEMENT_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
  'Space',
]);

export function useKeyboardMovement(inputRef, { enabled = true } = {}) {
  useEffect(() => {
    if (!enabled) return undefined;

    const isTypingTarget = (target) =>
      target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

    const onKeyDown = (event) => {
      if (!MOVEMENT_KEYS.has(event.code) || isTypingTarget(event.target)) return;
      event.preventDefault();
      inputRef.current.keys.add(event.code);
      // Any manual key cancels an in-flight click-to-move.
      inputRef.current.moveTarget = null;
    };

    const onKeyUp = (event) => {
      if (!MOVEMENT_KEYS.has(event.code)) return;
      inputRef.current.keys.delete(event.code);
    };

    // Releasing focus must not leave the avatar sprinting into a wall.
    const onBlur = () => inputRef.current.keys.clear();

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      inputRef.current.keys.clear();
    };
  }, [inputRef, enabled]);
}

export default useKeyboardMovement;