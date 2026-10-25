/**
 * ProxiSpeak — Status Bar
 *
 * Responsibilities:
 * - Preserve live Socket.IO connection status.
 * - Display local peer, earshot, FPS and server instance information.
 * - Hydrate backend health and live statistics from the REST API.
 * - Refresh backend diagnostics every 15 seconds.
 * - Preserve volume, mute and leave actions.
 */

import { useEffect, useState } from 'react';

import config from '../config.js';
import { useProxi } from '../state/ProxiContext.jsx';
import { useUiTick } from '../hooks/useUiTick.js';

const LABELS = {
  idle: 'idle',
  connecting: 'connecting…',
  online: 'connected',
  reconnecting: 'reconnecting…',
  error: 'connection error',
};

const DIAGNOSTICS_REFRESH_MS = 15_000;

async function fetchJson(url, signal) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  let payload;

  try {
    payload = await response.json();
  } catch {
    throw new Error(`Invalid server response (${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(
      payload?.message ||
        payload?.error?.message ||
        `Request failed (${response.status}).`,
    );
  }

  return payload;
}

function useBackendDiagnostics() {
  const [diagnostics, setDiagnostics] = useState({
    health: null,
    stats: null,
    checkedAt: null,
    error: '',
  });

  useEffect(() => {
    let stopped = false;
    let timer = null;
    let controller = null;

    const baseUrl = String(config.serverUrl).replace(/\/+$/, '');

    async function refresh() {
      if (stopped) return;

      controller = new AbortController();

      const signal = controller.signal;

      const [healthResult, statsResult] = await Promise.allSettled([
        fetchJson(`${baseUrl}/api/health`, signal),
        fetchJson(`${baseUrl}/api/stats`, signal),
      ]);

      if (stopped || signal.aborted) return;

      const health =
        healthResult.status === 'fulfilled'
          ? healthResult.value
          : null;

      const stats =
        statsResult.status === 'fulfilled'
          ? statsResult.value
          : null;

      const errors = [];

      if (healthResult.status === 'rejected') {
        errors.push(`Health: ${healthResult.reason?.message || 'unavailable'}`);
      }

      if (statsResult.status === 'rejected') {
        errors.push(`Statistics: ${statsResult.reason?.message || 'unavailable'}`);
      }

      setDiagnostics({
        health,
        stats,
        checkedAt: Date.now(),
        error: errors.join(' · '),
      });

      timer = window.setTimeout(refresh, DIAGNOSTICS_REFRESH_MS);
    }

    void refresh();

    return () => {
      stopped = true;

      if (timer !== null) {
        window.clearTimeout(timer);
      }

      controller?.abort();
    };
  }, []);

  return diagnostics;
}

function getBackendStatus(health, error) {
  if (health?.ok === true && health?.status === 'healthy') {
    return 'healthy';
  }

  if (health) {
    return 'degraded';
  }

  if (error) {
    return 'unavailable';
  }

  return 'checking';
}

export function StatusBar() {
  const { state, worldRef, leave, toggleMute, setVolume } = useProxi();

  const diagnostics = useBackendDiagnostics();

  useUiTick(500);

  const world = worldRef.current;
  const peers = [...world.peers.values()];

  const inEarshot = peers.filter(
    (peer) =>
      Math.hypot(peer.x - world.self.x, peer.y - world.self.y) <=
      world.earshotRadiusPx,
  ).length;

  const connectionLabel = LABELS[state.status] ?? state.status;

  const backendStatus = getBackendStatus(
    diagnostics.health,
    diagnostics.error,
  );

  const backendUsers =
    typeof diagnostics.stats?.users === 'number'
      ? diagnostics.stats.users
      : diagnostics.health?.presence?.users;

  const backendEdges =
    typeof diagnostics.stats?.mesh?.edges === 'number'
      ? diagnostics.stats.mesh.edges
      : Array.isArray(diagnostics.stats?.edges)
        ? diagnostics.stats.edges.length
        : null;

  const databaseStatus = diagnostics.health?.database?.geoIndex
    ? 'Geospatial index ready'
    : diagnostics.health
      ? 'Geospatial index unavailable'
      : 'Database status unavailable';

  const lastChecked = diagnostics.checkedAt
    ? new Date(diagnostics.checkedAt).toLocaleTimeString()
    : 'Not checked yet';

  return (
    <header className="statusbar">
      <div className="statusbar__left">
        <span
          className={`dot dot--${state.status}`}
          aria-hidden="true"
        />

        <strong
          className="statusbar__connection"
          aria-live="polite"
        >
          {connectionLabel}
        </strong>

        {state.statusDetail && (
          <span className="statusbar__detail">
            {state.statusDetail}
          </span>
        )}
      </div>

      <div
        className="statusbar__stats"
        aria-label="Workspace and backend statistics"
      >
        <span
          className="statusbar__stat"
          title="Avatars in the current workspace"
        >
          {peers.length} peers
        </span>

        <span
          className="statusbar__stat"
          title="Peers inside the current earshot radius"
        >
          {inEarshot} in earshot
        </span>

        <span
          className="statusbar__stat"
          title="requestAnimationFrame rate"
        >
          {world.fps ?? 0} FPS
        </span>

        <span
          className="statusbar__stat"
          title="Live users reported by the backend"
        >
          {typeof backendUsers === 'number'
            ? `${backendUsers} server users`
            : 'Users —'}
        </span>

        <span
          className="statusbar__stat"
          title="Live peer edges reported by the backend"
        >
          {typeof backendEdges === 'number'
            ? `${backendEdges} server edges`
            : 'Edges —'}
        </span>

        <span
          className="statusbar__stat"
          title="Instance handling this socket"
        >
          {state.server.instanceId || 'n/a'}
        </span>

        <span
          className={`badge badge--${
            state.server.scaleMode || 'single'
          }`}
          title="Socket server deployment mode"
        >
          {state.server.scaleMode || 'single'}
        </span>

        <span
          className="badge"
          role="status"
          aria-label={`Backend status: ${backendStatus}`}
          title={[
            `Backend: ${backendStatus}`,
            databaseStatus,
            `Last checked: ${lastChecked}`,
            diagnostics.error,
          ]
            .filter(Boolean)
            .join('\n')}
        >
          API {backendStatus}
        </span>
      </div>

      <div className="statusbar__right">
        <label
          className="volume"
          title="Master output volume"
        >
          <span aria-hidden="true">🔊</span>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={state.masterVolume}
            onChange={(event) =>
              setVolume(Number(event.target.value))
            }
            aria-label="Master output volume"
          />
        </label>

        <button
          type="button"
          className={`button button--toggle${
            state.muted ? ' button--active' : ''
          }`}
          onClick={toggleMute}
          aria-pressed={state.muted}
        >
          {state.muted ? 'Unmute' : 'Mute'}
        </button>

        <button
          type="button"
          className="button"
          onClick={leave}
        >
          Leave
        </button>
      </div>
    </header>
  );
}

export default StatusBar;