/** Transient toast messages (joins, leaves, audit results, warnings). */
import { useEffect } from 'react';
import { useProxi } from '../state/ProxiContext.jsx';

export function Notices() {
  const { state, dispatch } = useProxi();

  useEffect(() => {
    if (state.notices.length === 0) return undefined;
    const timers = state.notices.slice(0, 1).map((notice) =>
      setTimeout(() => dispatch({ type: 'dismissNotice', id: notice.id }), 6000),
    );
    return () => timers.forEach(clearTimeout);
  }, [state.notices, dispatch]);

  if (state.notices.length === 0) return null;

  return (
    <ul className="notices">
      {state.notices.map((notice) => (
        <li key={notice.id} className={`notice notice--${notice.level}`}>
          <span>{notice.message}</span>
          <button
            className="notice__close"
            onClick={() => dispatch({ type: 'dismissNotice', id: notice.id })}
            aria-label="dismiss"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

export default Notices;