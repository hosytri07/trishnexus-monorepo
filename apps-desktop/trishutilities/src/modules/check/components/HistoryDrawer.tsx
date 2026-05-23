import { useState } from 'react';
import type { Language } from '../settings.js';
import { makeT } from '../i18n/index.js';
import type { Snapshot } from '../lib/snapshots.js';
import { formatBytes } from '../scoring.js';
import { ConfirmDialog } from './ConfirmDialog.js';

/**
 * Phase 15.0.g — History drawer.
 *
 * List snapshot đã lưu (mới nhất trên cùng — reverse). Mỗi snapshot:
 * timestamp + summary (CPU, RAM, bench scores) + delete button.
 */

interface HistoryDrawerProps {
  language: Language;
  snapshots: Snapshot[];
  onDelete: (taken_at: string) => void;
  onClearAll: () => void;
}

export function HistoryDrawer({
  language,
  snapshots,
  onDelete,
  onClearAll,
}: HistoryDrawerProps): JSX.Element {
  const tr = makeT(language);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Reverse copy để mới nhất hiện trên cùng (push vào cuối, render reverse).
  const sorted = [...snapshots].reverse();

  return (
    <section className="history">
      <header className="section-head">
        <div className="section-head-row">
          <div>
            <h2>{tr('history.title')}</h2>
            <p className="muted small">{tr('history.subtitle')}</p>
          </div>
          {sorted.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-danger"
              onClick={() => setConfirmOpen(true)}
            >
              {tr('history.delete_all')}
            </button>
          )}
        </div>
      </header>

      <ConfirmDialog
        open={confirmOpen}
        title={tr('history.delete_all')}
        message={tr('history.confirm_delete_all')}
        okLabel={tr('history.delete_all')}
        cancelLabel="Hủy"
        destructive
        onConfirm={() => {
          onClearAll();
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      {sorted.length === 0 ? (
        <p className="empty">{tr('history.empty')}</p>
      ) : (
        <ul className="history-list">
          {sorted.map((snap) => (
            <SnapshotItem
              key={snap.taken_at}
              snapshot={snap}
              language={language}
              onDelete={() => onDelete(snap.taken_at)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface SnapshotItemProps {
  snapshot: Snapshot;
  language: Language;
  onDelete: () => void;
}

function SnapshotItem({
  snapshot,
  language,
  onDelete,
}: SnapshotItemProps): JSX.Element {
  const tr = makeT(language);
  const dt = new Date(snapshot.taken_at);
  const dtLabel =
    language === 'vi'
      ? dt.toLocaleString('vi-VN')
      : dt.toLocaleString('en-US');

  return (
    <li className="history-item">
      <div className="history-item-head">
        <strong>{dtLabel}</strong>
        <span className={`history-source history-source-${snapshot.source}`}>
          {snapshot.source}
        </span>
        <span className="actions-spacer" />
        <button
          type="button"
          className="btn btn-ghost btn-small btn-danger"
          onClick={onDelete}
          aria-label={tr('history.delete')}
        >
          {tr('history.delete')}
        </button>
      </div>
      <dl className="history-item-meta">
        <div>
          <dt>OS</dt>
          <dd>
            {snapshot.sys.os} {snapshot.sys.os_version}
          </dd>
        </div>
        <div>
          <dt>CPU</dt>
          <dd>
            {snapshot.sys.cpu_brand} ({snapshot.sys.cpu_cores}C)
          </dd>
        </div>
        <div>
          <dt>RAM</dt>
          <dd>{formatBytes(snapshot.sys.total_memory_bytes)}</dd>
        </div>
        {snapshot.cpu_bench && (
          <div>
            <dt>CPU Bench</dt>
            <dd>{snapshot.cpu_bench.throughput_mb_per_s.toFixed(0)} MB/s</dd>
          </div>
        )}
        {snapshot.mem_bench && (
          <div>
            <dt>Mem Bench</dt>
            <dd>{snapshot.mem_bench.throughput_mb_per_s.toFixed(0)} MB/s</dd>
          </div>
        )}
      </dl>
    </li>
  );
}
