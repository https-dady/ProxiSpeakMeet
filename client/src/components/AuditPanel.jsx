/**
 * Mid-project review panel: run the Spatial Audit from the browser and read the
 * numbers that prove the $near / $geoWithin / $geoNear queries are accurate,
 * index-backed and inside the 20 ms budget.
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
      <header className="panel__header">
        <h2>Spatial audit</h2>
        <button
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
          {running ? 'running…' : 'Run $near audit'}
        </button>
      </header>

      {!report && <p className="panel__empty">Run the audit to measure $near / $geoWithin / $geoNear latency.</p>}

      {report && (
        <>
          <div className={`verdict ${report.ok ? 'verdict--ok' : 'verdict--bad'}`}>
            {report.ok ? `PASS · budget ${report.budgetMs}ms` : 'FAIL'}
          </div>
          <dl className="audit__grid">
            <div>
              <dt>$near p95</dt>
              <dd>{report.queries?.near?.p95Ms}ms</dd>
            </div>
            <div>
              <dt>$geoWithin p95</dt>
              <dd>{report.queries?.within?.p95Ms}ms</dd>
            </div>
            <div>
              <dt>$geoNear p95</dt>
              <dd>{report.queries?.cluster?.p95Ms}ms</dd>
            </div>
            <div>
              <dt>peers matched</dt>
              <dd>{report.accuracy?.matchedPeers}</dd>
            </div>
            <div>
              <dt>operators agree</dt>
              <dd>{report.accuracy?.operatorsAgree ? 'yes' : 'no'}</dd>
            </div>
            <div>
              <dt>distance drift</dt>
              <dd>{report.accuracy?.maxDistanceDriftPx}px</dd>
            </div>
            <div>
              <dt>index</dt>
              <dd>{report.index?.indexName ?? 'n/a'}</dd>
            </div>
            <div>
              <dt>plan stage</dt>
              <dd>{report.index?.stage ?? 'n/a'}</dd>
            </div>
          </dl>
        </>
      )}

      <header className="panel__header panel__header--sub">
        <h3>WebRTC mesh</h3>
        <span className="panel__meta">{mesh.length} connection{mesh.length === 1 ? '' : 's'}</span>
      </header>
      {mesh.length === 0 && <p className="panel__empty">No peer connections — walk next to somebody.</p>}
      <ul className="mesh__list">
        {mesh.slice(0, 8).map((peer) => (
          <li key={peer.id}>
            <span className="chip">{peer.id.slice(0, 6)}</span>
            <span>{peer.state}</span>
            <span className="panel__meta">gen {peer.generation}</span>
            <span className="panel__meta">
              {peer.stats?.rtt ? `${Math.round(peer.stats.rtt * 1000)}ms rtt` : 'rtt n/a'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default AuditPanel;