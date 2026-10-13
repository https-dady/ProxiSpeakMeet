/** Re-render a component a few times per second for readouts (FPS, meters). */
import { useEffect, useState } from 'react';

export function useUiTick(intervalMs = 250, active = true) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const handle = setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => clearInterval(handle);
  }, [intervalMs, active]);
  return tick;
}

export default useUiTick;