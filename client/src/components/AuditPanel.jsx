/**
 * Mid-project review panel: run the Spatial Audit from the browser and read
 * the numbers that prove the spatial queries are accurate and index-backed.
 *
 * UI-only refinement:
 * - Preserves the existing audit request and report data.
 * - Preserves the WebRTC mesh snapshot and displayed metrics.
 * - Does not modify networking, spatial calculations or application state.
 */

import { useState } from 'react';
import { useProxi } from '../state/ProxiContext.jsx';

export function AuditPanel() {
  const { state, requestAudit, peersRef } = useProxi();
  const [running, setRunning] = useState(false);

  const report = state.stats.audit;
  const mesh = peersRef.current?.snapshot() ?? [];

  return (
    <section className="panel audit">
      <header className="panel__header audit__header">
        <div className="audit__heading">
          <span className="audit__eyebrow">DIAGNOSTICS</span>
          <h2>Spatial audit</h2>
          <p className="audit__description">
            Validate spatial query accuracy and database performance.
          </p>
        </div>

        <button
          type="button"
          className="button button--small"
          disabled={running || !state.selfId}
          onClick={async () => {
            setRunning(true);
            try {
              await requestAudit();
            } finally {
              setRunning(false);
            }
          }}
        >
          <span
            className={`audit__run-indicator${
              running ? ' audit__run-indicator--running' : ''
            }`}
            aria-hidden="true"
          />
          {running ? 'Running audit…' : 'Run $near audit'}
        </button>
      </header>

      {!report && (
        <div className="panel__empty audit__empty">
          <span className="audit__empty-icon" aria-hidden="true">
            ◈
          </span>
          <strong>No audit results yet</strong>
          <span>
            Run the audit to measure $near, $geoWithin and $geoNear latency.
          </span>
        </div>
      )}

      {report && (
        <div className="audit__results">
          <div
            className={`verdict ${
              report.ok ? 'verdict--ok' : 'verdict--bad'
            }`}
            role="status"
          >
            <span
              className="audit__verdict-indicator"
              aria-hidden="true"
            />
            <span>
              {report.ok
                ? `PASS · budget ${report.budgetMs}ms`
                : 'FAIL'}
            </span>
          </div>

          <div className="audit__section-label">
            Query performance
          </div>

          <dl className="audit__grid">
            <div className="audit__metric">
              <dt>$near p95</dt>
              <dd>{report.queries?.near?.p95Ms}ms</dd>
            </div>

            <div className="audit__metric">
              <dt>$geoWithin p95</dt>
              <dd>{report.queries?.within?.p95Ms}ms</dd>
            </div>

            <div className="audit__metric">
              <dt>$geoNear p95</dt>
              <dd>{report.queries?.cluster?.p95Ms}ms</dd>
            </div>

            <div className="audit__metric">
              <dt>Peers matched</dt>
              <dd>{report.accuracy?.matchedPeers}</dd>
            </div>

            <div className="audit__metric">
              <dt>Operators agree</dt>
              <dd>
                {report.accuracy?.operatorsAgree ? 'Yes' : 'No'}
              </dd>
            </div>

            <div className="audit__metric">
              <dt>Distance drift</dt>
              <dd>{report.accuracy?.maxDistanceDriftPx}px</dd>
            </div>

            <div className="audit__metric">
              <dt>Index</dt>
              <dd className="audit__metric-detail">
                {report.index?.indexName ?? 'n/a'}
              </dd>
            </div>

            <div className="audit__metric">
              <dt>Plan stage</dt>
              <dd>{report.index?.stage ?? 'n/a'}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="audit__mesh-section">
        <header className="panel__header panel__header--sub audit__mesh-header">
          <div>
            <span className="audit__eyebrow">REAL-TIME AUDIO</span>
            <h3>WebRTC mesh</h3>
          </div>

          <span className="panel__meta audit__mesh-count">
            <span className="audit__mesh-dot" aria-hidden="true" />
            {mesh.length} connection{mesh.length === 1 ? '' : 's'}
          </span>
        </header>

        {mesh.length === 0 && (
          <div className="panel__empty audit__mesh-empty">
            <strong>No peer connections</strong>
            <span>Walk near another person to establish a connection.</span>
          </div>
        )}

        {mesh.length > 0 && (
          <ul className="mesh__list audit__mesh-list">
            {mesh.slice(0, 8).map((peer) => (
              <li key={peer.id}>
                <span className="chip audit__peer-id">
                  {peer.id.slice(0, 6)}
                </span>

                <span className="audit__peer-state">
                  <span
                    className="audit__peer-state-dot"
                    aria-hidden="true"
                  />
                  {peer.state}
                </span>

                <span className="panel__meta">
                  gen {peer.generation}
                </span>

                <span className="panel__meta audit__rtt">
                  {peer.stats?.rtt
                    ? `${Math.round(peer.stats.rtt * 1000)}ms rtt`
                    : 'rtt n/a'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default AuditPanel;
