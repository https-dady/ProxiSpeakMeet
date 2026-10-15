/**
 * Transient toast messages (joins, leaves, audit results, warnings).
 *
 * UI-only refinement:
 * - Preserves the existing six-second auto-dismiss behavior.
 * - Preserves manual dismissal and notice reducer actions.
 * - Preserves notice IDs, messages and severity levels.
 */

import { useEffect } from 'react';
import { useProxi } from '../state/ProxiContext.jsx';

const NOTICE_LABELS = {
  success: 'Success',
  info: 'Information',
  warning: 'Warning',
  error: 'Error',
};

export function Notices() {
  const { state, dispatch } = useProxi();

  useEffect(() => {
    if (state.notices.length === 0) return undefined;

    const timers = state.notices.slice(0, 1).map((notice) =>
      setTimeout(
        () => dispatch({ type: 'dismissNotice', id: notice.id }),
        6000
      )
    );

    return () => timers.forEach(clearTimeout);
  }, [state.notices, dispatch]);

  if (state.notices.length === 0) return null;

  return (
    <ul className="notices" aria-label="Notifications">
      {state.notices.map((notice) => {
        const level = String(notice.level || 'info').toLowerCase();
        const label = NOTICE_LABELS[level] || 'Notification';

        return (
          <li
            key={notice.id}
            className={`notice notice--${notice.level}`}
            role={level === 'error' ? 'alert' : 'status'}
            aria-live={level === 'error' ? 'assertive' : 'polite'}
          >
            <span
              className="notice__indicator"
              aria-hidden="true"
            />

            <div className="notice__content">
              <span className="notice__label">{label}</span>

              <span className="notice__message">
                {notice.message}
              </span>
            </div>

            <button
              type="button"
              className="notice__close"
              onClick={() =>
                dispatch({
                  type: 'dismissNotice',
                  id: notice.id,
                })
              }
              aria-label={`Dismiss ${label.toLowerCase()} notification`}
              title="Dismiss notification"
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default Notices;