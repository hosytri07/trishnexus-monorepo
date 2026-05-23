import { useState } from 'react';
import type { Language } from '../settings.js';
import { makeT } from '../i18n/index.js';

/**
 * Phase 15.0.g — Action buttons row.
 *
 * Refresh / Copy / Export JSON / Export MD / Save snapshot / Run benchmark.
 * Mỗi button trigger callback prop. Copy + Snapshot có "done" state hiện
 * 1.5s sau khi success (UX feedback).
 */

interface ActionsToolbarProps {
  language: Language;
  benchRunning: boolean;
  hasBench: boolean;
  onRefresh: () => void;
  onCopy: () => Promise<boolean>;
  onExportJson: () => void;
  onExportMd: () => void;
  onSnapshot: () => void;
  onBenchmark: () => void;
}

export function ActionsToolbar({
  language,
  benchRunning,
  hasBench,
  onRefresh,
  onCopy,
  onExportJson,
  onExportMd,
  onSnapshot,
  onBenchmark,
}: ActionsToolbarProps): JSX.Element {
  const tr = makeT(language);
  const [copyDone, setCopyDone] = useState(false);
  const [snapDone, setSnapDone] = useState(false);

  async function handleCopy(): Promise<void> {
    const ok = await onCopy();
    if (ok) {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 1500);
    }
  }

  function handleSnapshot(): void {
    onSnapshot();
    setSnapDone(true);
    setTimeout(() => setSnapDone(false), 1500);
  }

  return (
    <div className="actions-toolbar">
      <button className="btn btn-ghost" onClick={onRefresh} type="button">
        ⟳ {tr('action.refresh')}
      </button>
      <button
        className={`btn btn-ghost ${copyDone ? 'btn-done' : ''}`}
        onClick={() => void handleCopy()}
        type="button"
      >
        {copyDone ? `✓ ${tr('action.copy_done')}` : `📋 ${tr('action.copy')}`}
      </button>
      <button className="btn btn-ghost" onClick={onExportJson} type="button">
        ⬇ {tr('action.export_json')}
      </button>
      <button className="btn btn-ghost" onClick={onExportMd} type="button">
        ⬇ {tr('action.export_md')}
      </button>
      <button
        className={`btn btn-ghost ${snapDone ? 'btn-done' : ''}`}
        onClick={handleSnapshot}
        type="button"
      >
        {snapDone
          ? `✓ ${tr('action.snapshot_done')}`
          : `💾 ${tr('action.snapshot')}`}
      </button>
      <span className="actions-spacer" />
      <button
        className="btn btn-primary"
        onClick={onBenchmark}
        disabled={benchRunning}
        type="button"
      >
        {benchRunning
          ? tr('action.benchmark_running')
          : hasBench
            ? tr('action.benchmark_again')
            : tr('action.benchmark')}
      </button>
    </div>
  );
}
