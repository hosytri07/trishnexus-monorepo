import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type } from '@trishteam/core';
import { pickAndReadFile, saveAs, saveTo } from './tauri-bridge.js';

const ACTOR = `u-${Math.random().toString(36).slice(2, 8)}`;

export function App(): JSX.Element {
  const [, setTick] = useState(0);
  // CRDT state sống trong ref (mutable), React chỉ re-render qua setTick.
  const stateRef = useRef(type.createState());
  const [carets, setCarets] = useState<type.Caret[]>([
    type.caretAtIndex(stateRef.current, ACTOR, 0, 'primary'),
  ]);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Sẵn sàng');
  const [dirty, setDirty] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const rerender = useCallback(() => setTick((x) => x + 1), []);

  const text = type.toText(stateRef.current);
  const visible = useMemo(
    () => type.visibleChars(stateRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text],
  );

  /** Insert 1 char ở tất cả carets. */
  const doType = useCallback(
    (ch: string) => {
      const res = type.typeAtCarets(stateRef.current, carets, ch, ACTOR);
      if (res.ops.length > 0) {
        setCarets(res.carets);
        setDirty(true);
        rerender();
      }
    },
    [carets, rerender],
  );

  /** Backspace tại tất cả carets. */
  const doBackspace = useCallback(() => {
    const res = type.backspaceAtCarets(stateRef.current, carets);
    if (res.ops.length > 0) {
      setCarets(res.carets);
      setDirty(true);
      rerender();
    }
  }, [carets, rerender]);

  /** Move all carets left/right theo visual index. */
  const moveCarets = useCallback(
    (delta: number) => {
      const state = stateRef.current;
      const next = carets.map((c) => {
        const idx = type.afterToIndex(state, c.anchorAfter);
        const newIdx = Math.max(
          0,
          Math.min(type.visibleChars(state).length, idx + delta),
        );
        const after = type.indexToAfter(state, newIdx);
        return { ...c, anchorAfter: after, headAfter: after };
      });
      setCarets(next);
    },
    [carets],
  );

  /** Add caret tại visual index. */
  const addCaretAt = useCallback(
    (idx: number) => {
      const id = `c-${Math.random().toString(36).slice(2, 6)}`;
      const caret = type.caretAtIndex(stateRef.current, ACTOR, idx, id);
      setCarets((prev) => dedupeCarets([...prev, caret]));
    },
    [],
  );

  const removeCaret = useCallback((id: string) => {
    setCarets((prev) => (prev.length <= 1 ? prev : prev.filter((c) => c.id !== id)));
  }, []);

  /** Key handler gắn vào editor div. */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          void handleSave();
          return;
        }
        if (e.key.toLowerCase() === 'o') {
          e.preventDefault();
          void handleOpen();
          return;
        }
        // Đừng nuốt các ctrl shortcut khác (copy, paste dùng default — chưa
        // implement paste CRDT nên mặc kệ).
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        doBackspace();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        doType('\n');
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        moveCarets(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        moveCarets(1);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        doType('  ');
        return;
      }
      if (e.key.length === 1 && !e.altKey) {
        // printable character
        e.preventDefault();
        doType(e.key);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doType, doBackspace, moveCarets],
  );

  const handleOpen = useCallback(async () => {
    setStatus('Đang mở file…');
    try {
      const res = await pickAndReadFile();
      if (!res) {
        setStatus('Huỷ mở file');
        return;
      }
      // Rebuild CRDT từ text — actor này "insert" toàn bộ doc.
      const fresh = type.createState();
      type.makeInsertString(fresh, ACTOR, null, res.content);
      stateRef.current = fresh;
      setCarets([type.caretAtIndex(fresh, ACTOR, 0, 'primary')]);
      setFilePath(res.path);
      setDirty(false);
      setStatus(
        `Đã mở: ${res.path.split(/[\\/]/).pop()}` +
          (res.truncated ? ' (bị cắt vì quá lớn)' : ''),
      );
      rerender();
    } catch (e) {
      setStatus('Lỗi mở file: ' + String(e));
    }
  }, [rerender]);

  const handleSave = useCallback(async () => {
    setStatus('Đang lưu…');
    try {
      const content = type.toText(stateRef.current);
      const res = filePath
        ? await saveTo(filePath, content)
        : await saveAs(content, 'untitled.md');
      if (!res) {
        setStatus('Huỷ lưu');
        return;
      }
      setFilePath(res.path);
      setDirty(false);
      setStatus(`Đã lưu ${res.size_bytes} bytes`);
    } catch (e) {
      setStatus('Lỗi lưu: ' + String(e));
    }
  }, [filePath]);

  const handleSaveAs = useCallback(async () => {
    setStatus('Đang lưu (Save As)…');
    try {
      const content = type.toText(stateRef.current);
      const res = await saveAs(content, 'untitled.md');
      if (!res) {
        setStatus('Huỷ lưu');
        return;
      }
      setFilePath(res.path);
      setDirty(false);
      setStatus(`Đã lưu ${res.size_bytes} bytes`);
    } catch (e) {
      setStatus('Lỗi lưu: ' + String(e));
    }
  }, []);

  /** Focus editor on mount để bắt key ngay. */
  useEffect(() => {
    editorRef.current?.focus();
  }, []);

  // Build visual render: danh sách cells + caret markers xen kẽ.
  const caretIndexSet = useMemo(() => {
    const s = new Set<number>();
    for (const c of carets) {
      s.add(type.afterToIndex(stateRef.current, c.anchorAfter));
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carets, text]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <strong>TrishType</strong>
          <span className="muted"> · multi-caret</span>
        </div>
        <div className="actions">
          <button onClick={() => void handleOpen()}>Mở…</button>
          <button onClick={() => void handleSave()}>Lưu</button>
          <button onClick={() => void handleSaveAs()}>Lưu dưới tên…</button>
        </div>
      </header>

      <div className="main">
        <aside className="sidebar">
          <section>
            <h3>Thông tin</h3>
            <div className="kv">
              <span>Actor</span>
              <code>{ACTOR}</code>
            </div>
            <div className="kv">
              <span>Ký tự</span>
              <code>{visible.length}</code>
            </div>
            <div className="kv">
              <span>File</span>
              <code className="path">
                {filePath ? filePath.split(/[\\/]/).pop() : '(chưa lưu)'}
              </code>
            </div>
            <div className="kv">
              <span>Trạng thái</span>
              <code>{dirty ? 'đã chỉnh' : 'sạch'}</code>
            </div>
          </section>
          <section>
            <h3>Carets ({carets.length})</h3>
            <ul className="carets">
              {carets.map((c) => {
                const idx = type.afterToIndex(stateRef.current, c.anchorAfter);
                return (
                  <li key={c.id}>
                    <span className="caret-id">{c.id}</span>
                    <span className="caret-idx">vị trí {idx}</span>
                    <button
                      className="mini"
                      disabled={carets.length <= 1}
                      onClick={() => removeCaret(c.id)}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
            <AddCaretForm
              max={visible.length}
              onAdd={(idx) => addCaretAt(idx)}
            />
          </section>
          <section>
            <h3>Phím tắt</h3>
            <ul className="help">
              <li>
                <kbd>Ctrl+O</kbd> mở · <kbd>Ctrl+S</kbd> lưu
              </li>
              <li>
                <kbd>←</kbd>/<kbd>→</kbd> di chuyển tất cả caret
              </li>
              <li>
                <kbd>Enter</kbd> xuống dòng · <kbd>Tab</kbd> 2 khoảng trắng
              </li>
              <li>Gõ sẽ chèn ở tất cả caret cùng lúc</li>
            </ul>
          </section>
        </aside>

        <main
          className="editor"
          tabIndex={0}
          ref={editorRef}
          onKeyDown={onKeyDown}
        >
          <pre className="doc">
            {renderLines(visible, caretIndexSet)}
          </pre>
        </main>
      </div>

      <footer className="statusbar">
        <span>{status}</span>
        {dirty && <span className="dot">●</span>}
      </footer>
    </div>
  );
}

function dedupeCarets(list: type.Caret[]): type.Caret[] {
  const seen = new Set<string>();
  const out: type.Caret[] = [];
  for (const c of list) {
    const key = c.anchorAfter ? c.anchorAfter.join(':') : 'null';
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/**
 * Render toàn bộ doc thành danh sách lines (mỗi line 1 <div>).
 * Caret markers chèn vào đúng vị trí theo visual index.
 */
function renderLines(
  visible: readonly type.CharNode[],
  caretIndexSet: Set<number>,
): JSX.Element[] {
  const lines: JSX.Element[][] = [[]];
  const pushNode = (el: JSX.Element) => {
    lines[lines.length - 1]!.push(el);
  };
  // Caret trước char[0] → tại index 0.
  if (caretIndexSet.has(0)) {
    pushNode(<span key="caret-0" className="caret" />);
  }
  for (let i = 0; i < visible.length; i++) {
    const node = visible[i]!;
    if (node.ch === '\n') {
      // line break → mở dòng mới.
      lines.push([]);
    } else {
      pushNode(
        <span key={`ch-${i}-${node.id[0]}-${node.id[1]}`} className="ch">
          {node.ch}
        </span>,
      );
    }
    if (caretIndexSet.has(i + 1)) {
      pushNode(<span key={`caret-${i + 1}`} className="caret" />);
    }
  }
  return lines.map((ln, idx) => (
    <div key={`line-${idx}`} className="line">
      {ln.length === 0 ? <span className="ch empty">&nbsp;</span> : ln}
    </div>
  ));
}

function AddCaretForm({
  max,
  onAdd,
}: {
  max: number;
  onAdd: (idx: number) => void;
}): JSX.Element {
  const [val, setVal] = useState<string>('0');
  return (
    <form
      className="add-caret"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Math.max(0, Math.min(max, Number.parseInt(val, 10) || 0));
        onAdd(n);
      }}
    >
      <input
        type="number"
        min={0}
        max={max}
        value={val}
        onChange={(e) => setVal(e.target.value)}
      />
      <button type="submit">+ Thêm caret</button>
    </form>
  );
}
