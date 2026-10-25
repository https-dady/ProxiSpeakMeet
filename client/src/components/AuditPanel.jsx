/**
 * ProxiSpeak — Spatial Audit Panel
 *
 * Supports both:
 * 1. Detailed reports returned by GET /api/spatial-audit.
 * 2. Summary payloads emitted through Socket.IO audit:completed.
 *
 * Audit history is loaded from GET /api/spatial-audit/history.
 */

import { useCallback, useEffect, useState } from 'react';

import config from '../config.js';
import { useProxi } from '../state/ProxiContext.jsx';

function getApiBaseUrl() {
  return String(config.serverUrl).replace(/\/+$/, '');
}

function formatTimestamp(value) {
  if (!value) return 'Unknown time';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatLatency(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(3)} ms`
    : 'N/A';
}

function getReportMetrics(report) {
  if (!report) return null;

  const nearP95 =
    report.queries?.near?.p95Ms ??
    report.p95Ms ??
    null;

  const withinP95 =
    report.queries?.within?.p95Ms ??
    null;

  const clusterP95 =
    report.queries?.cluster?.p95Ms ??
    null;

  const matchedPeers =
    report.accuracy?.matchedPeers ??
    report.matched ??
    null;

  const budgetMs =
    report.budgetMs ??
    config.audit.budgetMs;

  const passed =
    typeof report.ok === 'boolean'
      ? report.ok
      : typeof report.withinBudget === 'boolean'
        ? report.withinBudget
        : null;

  return {
    nearP95,
    withinP95,
    clusterP95,
    matchedPeers,
    budgetMs,
    passed,
    operatorsAgree: report.accuracy?.operatorsAgree,
    maxDistanceDriftPx: report.accuracy?.maxDistanceDriftPx,
    indexName: report.index?.indexName,
    stage: report.index?.stage,
  };
}

export function AuditPanel() {
  const { state, requestAudit, peersRef } = useProxi();

  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const report = state.stats.audit;
  const metrics = getReportMetrics(report);
  const mesh = peersRef.current?.snapshot?.() ?? [];
  const roomId = state.room?.roomId ?? config.defaultRoom;

  const loadHistory = useCallback(async (signal) => {
    setHistoryLoading(true);
    setHistoryError('');

    try {
      const params = new URLSearchParams({
        roomId,
        limit: '10',
      });

      const response = await fetch(
        `${getApiBaseUrl()}/api/spatial-audit/history?${params}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          signal,
        },
      );

      let payload;

      try {
        payload = await response.json();
      } catch {
        throw new Error('The server returned an invalid history response.');
      }

      if (!response.ok) {
        throw new Error(
          payload?.message ||
            payload?.error?.message ||
            `History request failed (${response.status}).`,
        );
      }

      if (!Array.isArray(payload?.history)) {
        throw new Error('The server returned an unexpected history format.');
      }

      setHistory(payload);
    } catch (error) {
      if (error.name === 'AbortError') return;

      setHistoryError(
        error.message || 'Unable to load spatial audit history.',
      );
    } finally {
      if (!signal?.aborted) {
        setHistoryLoading(false);
      }
    }
  }, [roomId]);

  // Load history initially and when the active room changes.
  useEffect(() => {
    const controller = new AbortController();

    void loadHistory(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadHistory]);

  // state.stats.audit can change from either an HTTP report or a
  // Socket.IO audit:completed event. Refresh persisted history for both.
  useEffect(() => {
    if (!report) return undefined;

    const timer = window.setTimeout(() => {
      void loadHistory();
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [report, loadHistory]);

  const handleRunAudit = async () => {
    if (running || !state.selfId) return;

    setRunning(true);

    try {
      await requestAudit();
      await loadHistory();
    } catch {
      // requestAudit reports errors through the application's notices.
    } finally {
      setRunning(false);
    }
  };

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
          onClick={handleRunAudit}
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

      {!metrics && (
        <div className="panel__empty audit__empty">
          <span className="audit__empty-icon" aria-hidden="true">
            ◈
          </span>

          <strong>No audit results yet</strong>

          <span>
            Run the audit to measure spatial query performance.
          </span>
        </div>
      )}

      {metrics && (
        <div className="audit__results">
          <div
            className={`verdict ${
              metrics.passed === true
                ? 'verdict--ok'
                : metrics.passed === false
                  ? 'verdict--bad'
                  : ''
            }`}
            role="status"
          >
            <span
              className="audit__verdict-indicator"
              aria-hidden="true"
            />

            <span>
              {metrics.passed === true
                ? `PASS · budget ${metrics.budgetMs}ms`
                : metrics.passed === false
                  ? 'FAIL · audit is outside its acceptance criteria'
                  : 'Audit result received · detailed report unavailable'}
            </span>
          </div>

          <div className="audit__section-label">
            Query performance
          </div>

          <dl className="audit__grid">
            <div className="audit__metric">
              <dt>$near p95</dt>
              <dd>{formatLatency(metrics.nearP95)}</dd>
            </div>

            <div className="audit__metric">
              <dt>$geoWithin p95</dt>
              <dd>{formatLatency(metrics.withinP95)}</dd>
            </div>

            <div className="audit__metric">
              <dt>$geoNear p95</dt>
              <dd>{formatLatency(metrics.clusterP95)}</dd>
            </div>

            <div className="audit__metric">
              <dt>Peers matched</dt>
              <dd>{metrics.matchedPeers ?? 'N/A'}</dd>
            </div>

            <div className="audit__metric">
              <dt>Operators agree</dt>
              <dd>
                {typeof metrics.operatorsAgree === 'boolean'
                  ? metrics.operatorsAgree ? 'Yes' : 'No'
                  : 'N/A'}
              </dd>
            </div>

            <div className="audit__metric">
              <dt>Distance drift</dt>
              <dd>
                {typeof metrics.maxDistanceDriftPx === 'number'
                  ? `${metrics.maxDistanceDriftPx}px`
                  : 'N/A'}
              </dd>
            </div>

            <div className="audit__metric">
              <dt>Index</dt>
              <dd className="audit__metric-detail">
                {metrics.indexName ?? 'N/A'}
              </dd>
            </div>

            <div className="audit__metric">
              <dt>Plan stage</dt>
              <dd>{metrics.stage ?? 'N/A'}</dd>
            </div>
          </dl>
        </div>
      )}

      <section
        className="audit__history"
        aria-labelledby="audit-history-title"
      >
        <header className="panel__header panel__header--sub">
          <div>
            <span className="audit__eyebrow">PERSISTED RESULTS</span>
            <h3 id="audit-history-title">Recent audit history</h3>
          </div>

          <span className="panel__meta">
            {history?.runs ?? 0} saved runs
          </span>
        </header>

        {historyLoading && !history && (
          <div className="panel__empty">
            <strong>Loading audit history…</strong>
          </div>
        )}

        {historyError && (
          <div className="panel__empty" role="alert">
            <strong>Audit history unavailable</strong>
            <span>{historyError}</span>

            <button
              type="button"
              className="button button--small"
              disabled={historyLoading}
              onClick={() => void loadHistory()}
            >
              {historyLoading ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        )}

        {!historyLoading &&
          !historyError &&
          history &&
          history.history.length === 0 && (
            <div className="panel__empty">
              <strong>No saved audit runs</strong>
              <span>
                Completed audits will appear here when persisted by the server.
              </span>
            </div>
          )}

        {history?.history?.length > 0 && (
          <>
            <dl className="audit__grid">
              <div className="audit__metric">
                <dt>Worst recorded p95</dt>
                <dd>{formatLatency(history.worstP95Ms)}</dd>
              </div>

              <div className="audit__metric">
                <dt>Performance budget</dt>
                <dd>{history.budgetMs} ms</dd>
              </div>

              <div className="audit__metric">
                <dt>Historical status</dt>
                <dd>
                  {history.ok ? 'Within budget' : 'Over budget'}
                </dd>
              </div>
            </dl>

            <ul className="mesh__list audit__mesh-list">
              {history.history.map((item, index) => (
                <li key={`${item.at ?? 'audit'}-${index}`}>
                  <span className="chip">
                    {item.withinBudget ? 'PASS' : 'OVER'}
                  </span>

                  <span>{formatTimestamp(item.at)}</span>

                  <span className="panel__meta">
                    p95 {formatLatency(item.p95Ms)}
                  </span>

                  <span className="panel__meta">
                    {item.matched ?? 0} peers
                  </span>

                  <span className="panel__meta">
                    {item.indexUsed || 'Index N/A'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

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
            <span>
              Walk near another person to establish a connection.
            </span>
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