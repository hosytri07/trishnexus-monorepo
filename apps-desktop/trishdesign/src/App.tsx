/**
 * TrishDesign — color palette + design token UI.
 *
 * Layout 3 cột:
 *   - sidebar trái: picker (hex input + mode), stats palette, list scale.
 *   - giữa: palette grid (scale × 11 swatch), click swatch để select.
 *   - phải: detail (contrast matrix + harmony wheel + export dropdown).
 */

import {
  type ChangeEvent,
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type ColorScale,
  type ColorSwatch,
  type DesignTokenSet,
  type PaletteMode,
  bestForegroundOn,
  buildContrastMatrix,
  buildScale,
  mergeTokenSets,
  normalizeHex,
  ratingFor,
  scaleToPlainJson,
  suggestPalette,
  toCssVars,
  toFigmaTokensJson,
  toScssMap,
  toTailwindConfigJs,
} from '@trishteam/core/design';
import {
  copyToClipboard,
  getDefaultStoreLocation,
  pickAndLoadDesignFile,
  saveDesignFile,
  type EnvLocation,
} from './tauri-bridge.js';

type ExportFormat = 'css' | 'tailwind' | 'figma' | 'scss' | 'json';

const EXPORT_LABEL: Record<ExportFormat, string> = {
  css: 'CSS variables (.css)',
  tailwind: 'Tailwind config (.js)',
  figma: 'Figma Tokens (.json)',
  scss: 'SCSS map (.scss)',
  json: 'JSON flat (scale)',
};

const MODE_LABEL: Record<PaletteMode, string> = {
  light: 'Sáng',
  dark: 'Tối',
  brand: 'Brand',
};

export function App(): JSX.Element {
  const [baseHex, setBaseHex] = useState<string>('#7C3AED');
  const [mode, setMode] = useState<PaletteMode>('light');
  const [setName, setSetName] = useState<string>('Palette mẫu');
  const [tokenSet, setTokenSet] = useState<DesignTokenSet>(() => {
    return suggestPalette('#7C3AED', 'light', 'Palette mẫu').set;
  });
  const [notes, setNotes] = useState<string[]>([]);
  const [activeScaleName, setActiveScaleName] = useState<string>('primary');
  const [activeSwatchKey, setActiveSwatchKey] = useState<string>('500');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('css');
  const [exportPreview, setExportPreview] = useState<string>('');
  const [flash, setFlash] = useState<string>('');
  const [env, setEnv] = useState<EnvLocation | null>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  /** Regen palette từ base + mode. */
  const regenerate = useCallback(
    (hexIn: string, modeIn: PaletteMode, nameIn: string) => {
      try {
        const hex = normalizeHex(hexIn);
        const { set, notes: ns } = suggestPalette(hex, modeIn, nameIn);
        setTokenSet(set);
        setNotes(ns);
        setActiveScaleName('primary');
        setActiveSwatchKey('500');
        flashMsg(`Đã sinh palette ${modeIn} từ ${hex}.`);
      } catch (err) {
        flashMsg(`⚠️ ${(err as Error).message}`);
      }
    },
    [],
  );

  useEffect(() => {
    // Load env once.
    getDefaultStoreLocation().then(setEnv).catch(() => setEnv(null));
  }, []);

  const flashMsg = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(''), 3000);
  };

  // Compute derived export preview.
  useEffect(() => {
    const scale = tokenSet.scales.find((s) => s.name === activeScaleName);
    let text: string;
    switch (exportFormat) {
      case 'css':
        text = toCssVars(tokenSet);
        break;
      case 'tailwind':
        text = toTailwindConfigJs(tokenSet);
        break;
      case 'figma':
        text = toFigmaTokensJson(tokenSet);
        break;
      case 'scss':
        text = toScssMap(tokenSet);
        break;
      case 'json':
        text = scale ? scaleToPlainJson(scale) : '{}';
        break;
      default:
        text = '';
    }
    setExportPreview(text);
  }, [exportFormat, tokenSet, activeScaleName]);

  const onHexChange = (e: ChangeEvent<HTMLInputElement>) => {
    setBaseHex(e.target.value);
  };

  const onHexBlur = () => {
    try {
      const hex = normalizeHex(baseHex);
      setBaseHex(hex);
      regenerate(hex, mode, setName);
    } catch (err) {
      flashMsg(`⚠️ Hex không hợp lệ: ${(err as Error).message}`);
    }
  };

  const onModeChange = (m: PaletteMode) => {
    setMode(m);
    regenerate(baseHex, m, setName);
  };

  const onCustomScaleBuild = (scaleName: string, swatchKey: string) => {
    const scale = tokenSet.scales.find((s) => s.name === scaleName);
    const sw = scale?.swatches.find((s) => s.key === swatchKey);
    if (!sw) return;
    setBaseHex(sw.hex);
    regenerate(sw.hex, mode, setName);
  };

  const onLoad = async () => {
    try {
      const loaded = await pickAndLoadDesignFile();
      if (!loaded) return;
      setTokenSet(loaded);
      setSetName(loaded.name);
      const firstScale = loaded.scales[0];
      if (firstScale) {
        setBaseHex(firstScale.base);
        setActiveScaleName(firstScale.name);
      }
      flashMsg(`Đã load "${loaded.name}" — ${loaded.scales.length} scale.`);
    } catch (err) {
      flashMsg(`⚠️ Load lỗi: ${(err as Error).message}`);
    }
  };

  const onSave = async () => {
    try {
      const updated = mergeTokenSets(tokenSet, { name: setName });
      const result = await saveDesignFile(updated, `${setName}.json`);
      if (!result) {
        flashMsg('Hủy save.');
        return;
      }
      flashMsg(`Saved: ${result.path} (${result.bytes} bytes).`);
    } catch (err) {
      flashMsg(`⚠️ Save lỗi: ${(err as Error).message}`);
    }
  };

  const onCopy = async () => {
    try {
      await copyToClipboard(exportPreview);
      flashMsg(`Copied ${EXPORT_LABEL[exportFormat]}.`);
    } catch (err) {
      flashMsg(`⚠️ Copy lỗi: ${(err as Error).message}`);
    }
  };

  const activeScale = useMemo<ColorScale | undefined>(
    () => tokenSet.scales.find((s) => s.name === activeScaleName),
    [tokenSet, activeScaleName],
  );

  const activeSwatch = useMemo<ColorSwatch | undefined>(
    () => activeScale?.swatches.find((s) => s.key === activeSwatchKey),
    [activeScale, activeSwatchKey],
  );

  const stats = useMemo(() => {
    let totalAA = 0;
    let totalSwatches = 0;
    for (const scale of tokenSet.scales) {
      for (const sw of scale.swatches) {
        totalSwatches++;
        if (ratingFor(sw.contrastWhite) !== 'fail') totalAA++;
      }
    }
    return { totalAA, totalSwatches };
  }, [tokenSet]);

  // Harmony colors for visual band (base + complementary + triadic).
  const harmonyPreview = useMemo(() => {
    try {
      const scale = buildScale('preview', baseHex);
      return scale.swatches.map((s) => s.hex);
    } catch {
      return [];
    }
  }, [baseHex]);

  return (
    <div className="app">
      {/* Topbar */}
      <div className="topbar">
        <div className="brand">
          <span className="brand-badge">TrishDesign</span>
          <span className="brand-tag">
            Color palette &amp; design token · v2.0.0-alpha.1
          </span>
        </div>
        <div className="actions">
          <button onClick={onLoad}>📂 Nạp JSON</button>
          <button onClick={onSave}>💾 Lưu JSON</button>
          <button className="ghost" onClick={() => colorInputRef.current?.click()}>
            🎨 Picker
          </button>
        </div>
      </div>

      {/* Control bar */}
      <div className="controlbar">
        <label className="field">
          <span>Hex base</span>
          <div className="hex-row">
            <input
              type="text"
              value={baseHex}
              onChange={onHexChange}
              onBlur={onHexBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              placeholder="#7C3AED"
              spellCheck={false}
            />
            <input
              ref={colorInputRef}
              type="color"
              value={baseHex.length === 7 ? baseHex : '#7C3AED'}
              onChange={(e) => {
                setBaseHex(e.target.value.toUpperCase());
                regenerate(e.target.value, mode, setName);
              }}
              aria-label="Color picker"
            />
          </div>
        </label>
        <label className="field">
          <span>Tên palette</span>
          <input
            type="text"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            onBlur={() => regenerate(baseHex, mode, setName)}
            placeholder="Palette mẫu"
          />
        </label>
        <div className="field">
          <span>Mode</span>
          <div className="mode-row">
            {(['light', 'dark', 'brand'] as PaletteMode[]).map((m) => (
              <button
                key={m}
                className={m === mode ? 'pill active' : 'pill'}
                onClick={() => onModeChange(m)}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Harmony preview</span>
          <div className="harmony-strip">
            {harmonyPreview.map((hex, i) => (
              <span
                key={i}
                className="harmony-chip"
                style={{ background: hex }}
                title={hex}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="statusbar">
        <span>
          📁 <code>{env?.data_dir ?? '…'}</code>
        </span>
        <span className="chip warn">alpha</span>
        <span>
          Scale: <b>{tokenSet.scales.length}</b>
        </span>
        <span>
          Swatch: <b>{stats.totalSwatches}</b>
        </span>
        <span>
          AA+ (vs #FFF): <b>{stats.totalAA}</b>/{stats.totalSwatches}
        </span>
        {flash ? <span className="flash">{flash}</span> : null}
      </div>

      {/* Layout 3 cột */}
      <div className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <h3>Scale</h3>
          <ul className="scale-list">
            {tokenSet.scales.map((scale) => (
              <li
                key={scale.name}
                className={scale.name === activeScaleName ? 'active' : ''}
                onClick={() => setActiveScaleName(scale.name)}
              >
                <span
                  className="dot"
                  style={{ background: scale.base }}
                />
                <span className="name">{scale.name}</span>
                <code>{scale.swatches.length}</code>
              </li>
            ))}
          </ul>

          <h3>AI gợi ý</h3>
          <ul className="hint-list">
            {notes.length === 0 ? (
              <li className="muted">(chưa có ghi chú)</li>
            ) : (
              notes.map((n, i) => <li key={i}>{n}</li>)
            )}
          </ul>

          <h3>Semantic alias</h3>
          {tokenSet.semantic &&
          Object.keys(tokenSet.semantic).length > 0 ? (
            <ul className="term-list">
              {Object.entries(tokenSet.semantic).map(([k, v]) => (
                <li key={k}>
                  <code>{k}</code>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">(chưa có alias)</p>
          )}
        </aside>

        {/* Palette grid */}
        <main className="results">
          {tokenSet.scales.map((scale) => (
            <section
              key={scale.name}
              className={
                scale.name === activeScaleName
                  ? 'scale-section active'
                  : 'scale-section'
              }
            >
              <header>
                <h4>
                  <span
                    className="dot"
                    style={{ background: scale.base }}
                  />
                  {scale.name}
                </h4>
                <button
                  className="mini"
                  onClick={() => onCustomScaleBuild(scale.name, '500')}
                >
                  Set base từ {scale.name}.500
                </button>
              </header>
              <div className="swatch-row">
                {scale.swatches.map((sw) => (
                  <button
                    key={sw.key}
                    className={
                      scale.name === activeScaleName &&
                      sw.key === activeSwatchKey
                        ? 'swatch active'
                        : 'swatch'
                    }
                    style={
                      {
                        background: sw.hex,
                        color: bestForegroundOn(sw.hex),
                      } satisfies CSSProperties
                    }
                    onClick={() => {
                      setActiveScaleName(scale.name);
                      setActiveSwatchKey(sw.key);
                    }}
                    title={`${scale.name}.${sw.key} ${sw.hex} · white ${sw.contrastWhite.toFixed(
                      2,
                    )} · black ${sw.contrastBlack.toFixed(2)}`}
                  >
                    <span className="swatch-key">{sw.key}</span>
                    <span className="swatch-hex">{sw.hex}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </main>

        {/* Detail */}
        <aside className="detail">
          <div className="detail-inner">
            <div className="detail-head">
              <h2>
                {activeScaleName}.{activeSwatchKey}
              </h2>
              {activeSwatch ? (
                <div
                  className="detail-swatch"
                  style={{
                    background: activeSwatch.hex,
                    color: bestForegroundOn(activeSwatch.hex),
                  }}
                >
                  <code>{activeSwatch.hex}</code>
                  <div className="mini-rating">
                    <span>
                      vs #FFF{' '}
                      <b>{activeSwatch.contrastWhite.toFixed(2)}</b>{' '}
                      {ratingFor(activeSwatch.contrastWhite)}
                    </span>
                    <span>
                      vs #000{' '}
                      <b>{activeSwatch.contrastBlack.toFixed(2)}</b>{' '}
                      {ratingFor(activeSwatch.contrastBlack)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="muted">Không chọn swatch nào.</p>
              )}
            </div>

            <h3>Ma trận contrast (scale hiện tại)</h3>
            {activeScale ? (
              <div className="matrix-wrap">
                <ContrastMatrix scale={activeScale} />
              </div>
            ) : null}

            <h3>Export</h3>
            <div className="export-row">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              >
                {(Object.keys(EXPORT_LABEL) as ExportFormat[]).map((k) => (
                  <option key={k} value={k}>
                    {EXPORT_LABEL[k]}
                  </option>
                ))}
              </select>
              <button className="mini" onClick={onCopy}>
                📋 Copy
              </button>
            </div>
            <pre className="export-preview">{exportPreview}</pre>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Inline contrast matrix — nhỏ gọn, hover tooltip. */
function ContrastMatrix({ scale }: { scale: ColorScale }): JSX.Element {
  const hexes = scale.swatches.map((s) => s.hex);
  const matrix = useMemo(() => buildContrastMatrix(hexes), [hexes]);
  return (
    <table className="contrast-matrix">
      <thead>
        <tr>
          <th></th>
          {scale.swatches.map((s) => (
            <th key={s.key}>{s.key}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {scale.swatches.map((rowSw, i) => (
          <tr key={rowSw.key}>
            <th>{rowSw.key}</th>
            {scale.swatches.map((colSw, j) => {
              const cell = matrix[i]?.[j];
              if (!cell) return <td key={colSw.key}>–</td>;
              return (
                <td
                  key={colSw.key}
                  className={`cell cell-${cell.rating}`}
                  title={`${rowSw.key} fg on ${colSw.key} bg: ${cell.ratio.toFixed(
                    2,
                  )} (${cell.rating})`}
                  style={
                    {
                      background: colSw.hex,
                      color: rowSw.hex,
                    } satisfies CSSProperties
                  }
                >
                  {cell.ratio.toFixed(1)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

