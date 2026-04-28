/**
 * Phase 18.7.a — Apps Registry editor.
 *
 * Đọc/sửa file local `website/public/apps-registry.json` và `min-specs.json`.
 * Save xong show git commands để Trí push lên GitHub → Vercel auto-deploy.
 *
 * Lưu path tới repo trong localStorage để lần sau auto-load.
 */

import { useEffect, useState } from 'react';
import {
  isInTauri,
  pickJsonFile,
  readTextFile,
  writeTextFile,
  checkPathExists,
} from '../tauri-bridge.js';

const STORAGE_REGISTRY_PATH = 'trishadmin.registry_path';
const STORAGE_MINSPECS_PATH = 'trishadmin.minspecs_path';

interface FileSlot {
  storageKey: string;
  label: string;
  hint: string;
  defaultName: string;
}

const SLOTS: FileSlot[] = [
  {
    storageKey: STORAGE_REGISTRY_PATH,
    label: '📦 apps-registry.json',
    hint: 'website/public/apps-registry.json — danh sách 8+ app + URL release + sha256.',
    defaultName: 'apps-registry.json',
  },
  {
    storageKey: STORAGE_MINSPECS_PATH,
    label: '🛠 min-specs.json',
    hint: 'website/public/min-specs.json — yêu cầu tối thiểu cho từng app (RAM, CPU, GPU).',
    defaultName: 'min-specs.json',
  },
];

export function RegistryPanel(): JSX.Element {
  return (
    <div className="panel">
      <header className="panel-head">
        <div>
          <h1>📦 Apps Registry</h1>
          <p className="muted small">
            Sửa file JSON local. Sau khi lưu, push lên GitHub để Vercel deploy.
            File đặt trong <code>website/public/</code> repo.
          </p>
        </div>
      </header>

      {!isInTauri() && (
        <div className="error-banner">
          ⚠ Chế độ dev browser — Tauri commands disabled. Build production để test
          read/write file.
        </div>
      )}

      {SLOTS.map((slot) => (
        <RegistrySlot key={slot.storageKey} slot={slot} />
      ))}

      <section className="git-hint-card">
        <h3>📤 Sau khi lưu — push lên GitHub</h3>
        <p className="muted small">
          Chạy ở terminal Windows trong thư mục repo:
        </p>
        <pre className="code-block">{`cd C:\\Users\\TRI\\Documents\\Claude\\Projects\\TrishTEAM\\trishnexus-monorepo
git add website/public/apps-registry.json website/public/min-specs.json
git commit -m "registry: update apps + specs"
git push`}</pre>
        <p className="muted small">
          Vercel sẽ tự deploy <code>trishteam.io.vn/apps-registry.json</code> sau ~1 phút.
        </p>
      </section>
    </div>
  );
}

function RegistrySlot({ slot }: { slot: FileSlot }): JSX.Element {
  const [path, setPath] = useState<string>(() => {
    try {
      return localStorage.getItem(slot.storageKey) ?? '';
    } catch {
      return '';
    }
  });
  const [content, setContent] = useState<string>('');
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState<boolean>(false);

  useEffect(() => {
    try {
      if (path) {
        localStorage.setItem(slot.storageKey, path);
        void checkPathExists(path).then(setExists);
      }
    } catch {
      /* ignore */
    }
  }, [path, slot.storageKey]);

  async function handlePick(): Promise<void> {
    const picked = await pickJsonFile(`Chọn file ${slot.defaultName}`);
    if (picked) {
      setPath(picked);
      setLoaded(false);
      setContent('');
      setDirty(false);
      setMsg(null);
      setError(null);
    }
  }

  async function handleLoad(): Promise<void> {
    if (!path) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const txt = await readTextFile(path);
      // Pretty-print nếu là JSON
      let pretty = txt;
      try {
        pretty = JSON.stringify(JSON.parse(txt), null, 2);
      } catch {
        /* không phải JSON valid — vẫn hiện raw */
      }
      setContent(pretty);
      setLoaded(true);
      setDirty(false);
      setMsg(`✓ Đã load ${pretty.length.toLocaleString()} ký tự`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(): Promise<void> {
    if (!path || !loaded) return;
    // Validate JSON
    try {
      JSON.parse(content);
    } catch (err) {
      setError(`JSON không hợp lệ: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await writeTextFile(path, content);
      setMsg(`✓ Đã lưu ${content.length.toLocaleString()} ký tự`);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function handleContentChange(v: string): void {
    setContent(v);
    setDirty(true);
  }

  return (
    <section className="registry-slot">
      <header>
        <div>
          <h3>{slot.label}</h3>
          <p className="muted small">{slot.hint}</p>
        </div>
      </header>

      <div className="path-row">
        <input
          type="text"
          className="input"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder={`C:\\...\\website\\public\\${slot.defaultName}`}
        />
        <button type="button" className="btn btn-ghost" onClick={() => void handlePick()}>
          📂 Chọn file
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handleLoad()}
          disabled={busy || !path}
        >
          {busy ? '⏳' : '📥'} Load
        </button>
      </div>

      {path && !exists && (
        <p className="muted small" style={{ color: '#f59e0b' }}>
          ⚠ Đường dẫn chưa tồn tại — chọn file khác hoặc tạo mới khi save.
        </p>
      )}

      {error && <div className="error-banner">⚠ {error}</div>}
      {msg && (
        <div className="info-banner" onClick={() => setMsg(null)}>
          {msg}
        </div>
      )}

      {loaded && (
        <>
          <textarea
            className="json-editor"
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            spellCheck={false}
            rows={20}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <span className="muted small" style={{ alignSelf: 'center' }}>
              {dirty ? '● Có thay đổi chưa lưu' : '✓ Đã lưu'}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void handleLoad()}
              disabled={busy}
            >
              ↺ Reload
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleSave()}
              disabled={busy || !dirty}
            >
              💾 Lưu
            </button>
          </div>
        </>
      )}
    </section>
  );
}
