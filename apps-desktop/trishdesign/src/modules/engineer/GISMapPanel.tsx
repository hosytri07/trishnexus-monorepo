/**
 * TrishDesign Phase 28.5 — GIS Map Panel.
 *
 * Leaflet + OpenStreetMap (loaded từ unpkg CDN), không cần npm package.
 * Features:
 *   - Map view interactive
 *   - Marker + Polyline + Polygon CRUD
 *   - Đo khoảng cách (vẽ polyline)
 *   - Import marker từ HHMĐ project (lý trình → demo position)
 *   - Import/Export GeoJSON + KML
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { save, open } from '@tauri-apps/plugin-dialog';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import {
  type LatLng,
  type GisDb,
  type GisProject,
  type GisLayer,
  type GisFeature,
  type GisMarker,
  type GisPolyline,
  type GisPolygon,
  emptyGisDb,
  newGisId,
  defaultGisProject,
  haversineDistance,
  polylineDistance,
  formatDistance,
  polygonArea,
  formatArea,
  parseGeoJson,
  toGeoJson,
  parseKml,
  toKml,
} from '../../lib/gis-types.js';
import {
  VN2000_PROVINCES,
  DEFAULT_PROVINCE_CODE,
  findProvince,
  wgs84ToVn2000,
} from '../../lib/vn2000.js';
import * as XLSX from 'xlsx';

// Leaflet types — minimal (loaded từ CDN)
declare global {
  interface Window {
    L?: any;
  }
}

const LS_KEY = 'trishdesign:gis-db';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

// Phase 28.7: JSZip cho KMZ (zipped KML)
let jszipLoadingPromise: Promise<any> | null = null;
function loadJsZip(): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).JSZip) return Promise.resolve((window as any).JSZip);
  if (jszipLoadingPromise) return jszipLoadingPromise;
  jszipLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js';
    script.onload = () => resolve((window as any).JSZip);
    script.onerror = () => reject(new Error('Không tải được JSZip'));
    document.head.appendChild(script);
  });
  return jszipLoadingPromise;
}

let leafletLoadingPromise: Promise<void> | null = null;
function loadLeaflet(): Promise<void> {
  if (typeof window !== 'undefined' && window.L) return Promise.resolve();
  if (leafletLoadingPromise) return leafletLoadingPromise;
  leafletLoadingPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không tải được Leaflet từ CDN'));
    document.head.appendChild(script);
  });
  return leafletLoadingPromise;
}

function loadDb(): GisDb {
  if (typeof window === 'undefined') return emptyGisDb();
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) as GisDb : emptyGisDb();
  } catch { return emptyGisDb(); }
}
function saveDb(db: GisDb): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch { /* ignore */ }
}

type DialogState =
  | { kind: 'prompt'; title: string; value: string; onSubmit: (v: string) => void }
  | { kind: 'confirm'; title: string; message: string; danger?: boolean; onConfirm: () => void }
  | null;

type Mode = 'view' | 'add-marker' | 'measure' | 'draw-polygon';

export function GISMapPanel(): JSX.Element {
  const [db, setDbState] = useState<GisDb>(() => loadDb());
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [draftPoints, setDraftPoints] = useState<LatLng[]>([]);
  // Phase 28.7: marker config trước khi click map
  const [pendingMarker, setPendingMarker] = useState<{
    name: string; color: string; icon: string;
    markerType: 'normal' | 'km' | 'coch' | 'elevation';
    station: number; elevation: number;
  }>(
    () => ({ name: 'Marker mới', color: '#dc2626', icon: '📍', markerType: 'normal', station: 0, elevation: 0 }),
  );
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const featureLayer = useRef<any>(null);
  const draftLayer = useRef<any>(null);
  // Phase 28.13 — Toolbar consolidate + VN2000 table
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCoordTable, setShowCoordTable] = useState(false);
  const [provinceCode, setProvinceCode] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_PROVINCE_CODE;
    return window.localStorage.getItem('trishdesign:vn2000-province') ?? DEFAULT_PROVINCE_CODE;
  });
  const activeProvince = findProvince(provinceCode) ?? findProvince(DEFAULT_PROVINCE_CODE)!;
  function changeProvince(code: string): void {
    setProvinceCode(code);
    try { window.localStorage.setItem('trishdesign:vn2000-province', code); } catch { /* ignore */ }
  }

  useEffect(() => { saveDb(db); }, [db]);
  function setDb(updater: (prev: GisDb) => GisDb): void {
    setDbState((prev) => ({ ...updater(prev), updatedAt: Date.now() }));
  }
  function flash(msg: string): void {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 2200);
  }

  const activeProject = useMemo(
    () => db.projects.find((p) => p.id === db.activeProjectId) ?? null,
    [db.projects, db.activeProjectId],
  );

  function updateActiveProject(updater: (p: GisProject) => GisProject): void {
    if (!activeProject) return;
    setDb((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === activeProject.id ? updater(p) : p)),
    }));
  }

  const activeLayer = useMemo(
    () => activeProject?.layers[0] ?? null,
    [activeProject],
  );

  function updateActiveLayer(updater: (l: GisLayer) => GisLayer): void {
    if (!activeProject || !activeLayer) return;
    updateActiveProject((p) => ({
      ...p,
      layers: p.layers.map((l) => (l.id === activeLayer.id ? updater(l) : l)),
    }));
  }

  // -------------------------------------------------------------------
  // Init Leaflet map
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!activeProject || !mapRef.current) return;
    let cancelled = false;
    loadLeaflet().then(() => {
      if (cancelled || !mapRef.current || !window.L) return;
      const L = window.L;

      if (!leafletMap.current) {
        leafletMap.current = L.map(mapRef.current).setView(
          [activeProject.center.lat, activeProject.center.lng],
          activeProject.zoom,
        );
        // Multi tile layer: OSM + Esri Satellite + Hybrid (labels)
        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap', maxZoom: 19,
        });
        const satLayer = L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { attribution: '© Esri World Imagery', maxZoom: 19 },
        );
        const labelsLayer = L.tileLayer(
          'https://stamen-tiles-{s}.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png',
          { attribution: '© Stamen Toner Labels', maxZoom: 18, opacity: 0.7 },
        );
        osmLayer.addTo(leafletMap.current);
        // Layer control — switcher giữa OSM / Satellite / Satellite + labels
        L.control.layers(
          {
            '🗺 Bản đồ (OSM)': osmLayer,
            '🛰 Vệ tinh (Esri)': satLayer,
          },
          {
            'Nhãn địa danh': labelsLayer,
          },
          { position: 'topright', collapsed: false },
        ).addTo(leafletMap.current);
        featureLayer.current = L.layerGroup().addTo(leafletMap.current);
        draftLayer.current = L.layerGroup().addTo(leafletMap.current);
      }
    }).catch((err) => flash(`✗ ${err}`));
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id]);

  // -------------------------------------------------------------------
  // Render features
  // -------------------------------------------------------------------
  useEffect(() => {
    const L = window.L;
    if (!L || !featureLayer.current || !activeLayer) return;
    featureLayer.current.clearLayers();
    if (!activeLayer.visible) return;
    for (const f of activeLayer.features) {
      if (f.kind === 'marker') {
        L.marker([f.position.lat, f.position.lng])
          .bindPopup(`<b>${f.title}</b>${f.description ? `<br/>${f.description}` : ''}`)
          .addTo(featureLayer.current);
      } else if (f.kind === 'polyline') {
        L.polyline(f.points.map((p) => [p.lat, p.lng]), {
          color: f.color ?? '#2563eb', weight: f.weight ?? 3,
        }).bindPopup(`<b>${f.title}</b><br/>Khoảng cách: ${formatDistance(f.distanceM ?? polylineDistance(f.points))}`)
          .addTo(featureLayer.current);
      } else if (f.kind === 'polygon') {
        L.polygon(f.points.map((p) => [p.lat, p.lng]), {
          color: f.color ?? '#10b981', fillOpacity: f.fillOpacity ?? 0.18,
        }).bindPopup(`<b>${f.title}</b><br/>Diện tích: ${formatArea(f.areaM2 ?? polygonArea(f.points))}`)
          .addTo(featureLayer.current);
      }
    }
  }, [activeLayer]);

  // -------------------------------------------------------------------
  // Render draft (đang vẽ polyline/polygon)
  // -------------------------------------------------------------------
  useEffect(() => {
    const L = window.L;
    if (!L || !draftLayer.current) return;
    draftLayer.current.clearLayers();
    if (draftPoints.length === 0) return;
    if (mode === 'measure' || mode === 'draw-polygon') {
      const path = mode === 'measure'
        ? L.polyline(draftPoints.map((p) => [p.lat, p.lng]), { color: '#f59e0b', weight: 3, dashArray: '6,6' })
        : L.polygon(draftPoints.map((p) => [p.lat, p.lng]), { color: '#10b981', fillOpacity: 0.10, dashArray: '6,6' });
      path.addTo(draftLayer.current);
      // Marker ở mỗi điểm
      for (const p of draftPoints) {
        L.circleMarker([p.lat, p.lng], { radius: 4, color: '#f59e0b', weight: 2, fillOpacity: 1, fillColor: '#fff' })
          .addTo(draftLayer.current);
      }
    }
  }, [draftPoints, mode]);

  // -------------------------------------------------------------------
  // Map click handler
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!leafletMap.current) return;
    const map = leafletMap.current;
    const handler = (e: any): void => {
      const ll: LatLng = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (mode === 'add-marker') {
        // Tạo marker ngay với pendingMarker config
        const t = pendingMarker.markerType;
        const autoTitle = t === 'km' ? `Km${(pendingMarker.station / 1000).toFixed(0)}`
          : t === 'coch' ? `H${pendingMarker.station}`
          : t === 'elevation' ? `Cao độ +${pendingMarker.elevation.toFixed(2)}m @ Km${(pendingMarker.station / 1000).toFixed(2)}`
          : pendingMarker.name || 'Marker';
        const m: GisMarker = {
          id: newGisId('m'), kind: 'marker', position: ll,
          title: autoTitle,
          color: pendingMarker.color, icon: pendingMarker.icon,
          source: 'manual',
          markerType: t,
          station: t !== 'normal' ? pendingMarker.station : undefined,
          elevation: t === 'elevation' ? pendingMarker.elevation : undefined,
        };
        updateActiveLayer((l) => ({ ...l, features: [...l.features, m] }));
        flash(`✓ Đã đặt ${autoTitle}`);
        // Auto-increment station cho km/coch/elevation
        if (t === 'km') setPendingMarker({ ...pendingMarker, station: pendingMarker.station + 1000 });
        else if (t === 'coch') setPendingMarker({ ...pendingMarker, station: pendingMarker.station + 100 });
      } else if (mode === 'measure' || mode === 'draw-polygon') {
        setDraftPoints((prev) => [...prev, ll]);
      }
    };
    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [mode]);

  // -------------------------------------------------------------------
  // Project actions
  // -------------------------------------------------------------------
  function handleNewProject(): void {
    setDialog({
      kind: 'prompt', title: 'Tạo dự án bản đồ mới', value: 'Bản đồ mới',
      onSubmit: (name) => {
        const proj = defaultGisProject(name);
        setDb((prev) => ({ ...prev, projects: [...prev.projects, proj], activeProjectId: proj.id }));
        flash(`✓ Đã tạo "${name}"`);
      },
    });
  }
  function handleDeleteProject(id: string): void {
    const t = db.projects.find((p) => p.id === id);
    if (!t) return;
    setDialog({
      kind: 'confirm', title: 'Xóa bản đồ', danger: true,
      message: `Xóa "${t.name}" và tất cả marker/polyline/polygon?`,
      onConfirm: () => {
        // Reset map ref vì project unmount
        leafletMap.current?.remove(); leafletMap.current = null;
        setDb((prev) => ({
          ...prev,
          projects: prev.projects.filter((p) => p.id !== id),
          activeProjectId: prev.activeProjectId === id ? null : prev.activeProjectId,
        }));
      },
    });
  }

  // -------------------------------------------------------------------
  // Feature actions
  // -------------------------------------------------------------------
  function handleStartMeasure(): void {
    setMode('measure');
    setDraftPoints([]);
    flash('Click các điểm trên map để đo. Bấm "✓ Hoàn thành" khi xong.');
  }
  function handleStartPolygon(): void {
    setMode('draw-polygon');
    setDraftPoints([]);
    flash('Click các điểm để tạo đa giác. Bấm "✓ Hoàn thành".');
  }
  function handleStartMarker(): void {
    setMode('add-marker');
    flash('Nhập tên + chọn icon, sau đó click trên map để đặt. Click nhiều lần để thêm nhiều marker.');
  }
  function handleCancelDraft(): void {
    setMode('view');
    setDraftPoints([]);
  }
  function handleFinishDraft(): void {
    if (draftPoints.length < 2) {
      flash('✗ Cần ít nhất 2 điểm.');
      return;
    }
    if (mode === 'measure') {
      const dist = polylineDistance(draftPoints);
      setDialog({
        kind: 'prompt', title: `Lưu polyline? (${formatDistance(dist)})`, value: 'Tuyến đo',
        onSubmit: (name) => {
          const f: GisPolyline = {
            id: newGisId('l'), kind: 'polyline', points: draftPoints, title: name,
            color: '#2563eb', distanceM: dist, source: 'manual',
          };
          updateActiveLayer((l) => ({ ...l, features: [...l.features, f] }));
          flash(`✓ Đã lưu polyline (${formatDistance(dist)})`);
          setMode('view'); setDraftPoints([]);
        },
      });
    } else if (mode === 'draw-polygon') {
      if (draftPoints.length < 3) { flash('✗ Polygon cần ≥ 3 điểm.'); return; }
      const area = polygonArea(draftPoints);
      setDialog({
        kind: 'prompt', title: `Lưu polygon? (${formatArea(area)})`, value: 'Vùng',
        onSubmit: (name) => {
          const f: GisPolygon = {
            id: newGisId('p'), kind: 'polygon', points: draftPoints, title: name,
            color: '#10b981', fillOpacity: 0.18, areaM2: area, source: 'manual',
          };
          updateActiveLayer((l) => ({ ...l, features: [...l.features, f] }));
          flash(`✓ Đã lưu polygon (${formatArea(area)})`);
          setMode('view'); setDraftPoints([]);
        },
      });
    }
  }

  function handleDeleteFeature(id: string): void {
    updateActiveLayer((l) => ({ ...l, features: l.features.filter((f) => f.id !== id) }));
  }

  function handleZoomTo(f: GisFeature): void {
    const map = leafletMap.current; if (!map || !window.L) return;
    if (f.kind === 'marker') map.setView([f.position.lat, f.position.lng], 17);
    else {
      const bounds = window.L.latLngBounds(f.points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  // -------------------------------------------------------------------
  // Import HHMĐ markers (đọc localStorage 'trishdesign:db')
  // -------------------------------------------------------------------
  function handleImportHhmd(): void {
    try {
      const raw = localStorage.getItem('trishdesign:db');
      if (!raw) { flash('Không có data HHMĐ.'); return; }
      const dbHhmd = JSON.parse(raw);
      const projects = dbHhmd?.projects ?? [];
      const center = activeProject?.center ?? { lat: 16.0544, lng: 108.2022 };
      // Mỗi segment + miếng → 1 marker fake position quanh center (vì HHMĐ không có lat/lng)
      const markers: GisMarker[] = [];
      let offset = 0;
      for (const proj of projects) {
        for (const seg of proj.segments ?? []) {
          for (const piece of seg.damagePieces ?? []) {
            const lat = center.lat + (offset * 0.0001);
            const lng = center.lng + ((piece.startStation - seg.startStation) * 0.00001);
            markers.push({
              id: newGisId('m'), kind: 'marker',
              position: { lat, lng },
              title: `HH ${piece.pieceNumber} · ${seg.name}`,
              description: `Lý trình ${piece.startStation}m · ${piece.length}×${piece.width}m`,
              color: '#dc2626', source: 'hhmd',
            });
            offset++;
          }
        }
      }
      if (markers.length === 0) { flash('HHMĐ chưa có miếng hư hỏng nào.'); return; }
      updateActiveLayer((l) => ({ ...l, features: [...l.features, ...markers] }));
      flash(`✓ Đã import ${markers.length} marker từ HHMĐ`);
    } catch (e) { flash(`✗ Lỗi: ${String(e)}`); }
  }

  function handleImportAtgt(): void {
    try {
      const raw = localStorage.getItem('trishdesign:atgt-db');
      if (!raw) { flash('Không có data ATGT.'); return; }
      const dbAtgt = JSON.parse(raw);
      const projects = dbAtgt?.projects ?? [];
      const center = activeProject?.center ?? { lat: 16.0544, lng: 108.2022 };
      const markers: GisMarker[] = [];
      let offset = 0;
      for (const proj of projects) {
        for (const seg of proj.segments ?? []) {
          for (const item of seg.items ?? []) {
            const lat = center.lat - (offset * 0.0001);
            const lng = center.lng + ((item.station - seg.startStation) * 0.00001);
            markers.push({
              id: newGisId('m'), kind: 'marker',
              position: { lat, lng },
              title: `ATGT ${item.category} · ${seg.name}`,
              description: `Lý trình ${item.station}m`,
              color: '#f59e0b', source: 'atgt',
            });
            offset++;
          }
        }
      }
      if (markers.length === 0) { flash('ATGT chưa có đối tượng nào.'); return; }
      updateActiveLayer((l) => ({ ...l, features: [...l.features, ...markers] }));
      flash(`✓ Đã import ${markers.length} marker từ ATGT`);
    } catch (e) { flash(`✗ Lỗi: ${String(e)}`); }
  }

  // -------------------------------------------------------------------
  // Import / Export GeoJSON / KML
  // -------------------------------------------------------------------
  async function handleImport(format: 'geojson' | 'kml' | 'kmz'): Promise<void> {
    try {
      const exts = format === 'geojson' ? ['geojson', 'json'] : format === 'kml' ? ['kml'] : ['kmz'];
      const path = await open({
        title: `Chọn file ${format.toUpperCase()}`,
        filters: [{ name: format.toUpperCase(), extensions: exts }],
      });
      if (typeof path !== 'string') return;
      const fetchUrl = convertFileSrc(path);
      const res = await fetch(fetchUrl);
      let text: string;
      if (format === 'kmz') {
        // KMZ = zipped KML — dùng JSZip từ CDN
        const buf = await res.arrayBuffer();
        const JSZip = await loadJsZip();
        const zip = await JSZip.loadAsync(buf);
        // Tìm doc.kml hoặc bất kỳ .kml nào
        const kmlFile = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith('.kml'));
        if (!kmlFile) { flash('✗ KMZ không chứa file .kml'); return; }
        text = await zip.files[kmlFile]!.async('string');
      } else {
        text = await res.text();
      }
      const features = format === 'geojson' ? parseGeoJson(text) : parseKml(text);
      if (features.length === 0) { flash('Không có feature nào trong file.'); return; }
      updateActiveLayer((l) => ({ ...l, features: [...l.features, ...features] }));
      flash(`✓ Đã import ${features.length} feature (${format.toUpperCase()})`);
    } catch (e) { flash(`✗ Lỗi: ${String(e)}`); }
  }

  async function handleExport(format: 'geojson' | 'kml' | 'kmz'): Promise<void> {
    if (!activeLayer || activeLayer.features.length === 0) {
      flash('Chưa có feature để xuất.');
      return;
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeName = (activeProject?.name ?? 'Map').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40);
    const path = await save({
      title: `Lưu ${format.toUpperCase()}`,
      defaultPath: `${safeName}_${dateStr}.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });
    if (!path) return;
    let bytes: number[];
    if (format === 'kmz') {
      // Zip KML thành KMZ
      const kml = toKml(activeLayer.features, activeProject?.name ?? 'Map');
      const JSZip = await loadJsZip();
      const zip = new JSZip();
      zip.file('doc.kml', kml);
      const buf = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
      bytes = Array.from(new Uint8Array(buf));
    } else {
      const text = format === 'geojson' ? toGeoJson(activeLayer.features) : toKml(activeLayer.features, activeProject?.name ?? 'Map');
      bytes = Array.from(new TextEncoder().encode(text));
    }
    await invoke<number>('save_file_bytes', { path, bytes });
    flash(`✓ Đã xuất ${format.toUpperCase()}`);
  }

  // -------------------------------------------------------------------
  // Render — empty state với panel structure visible
  // -------------------------------------------------------------------
  if (!activeProject) {
    return (
      <>
        <div className="td-panel">
          <header className="td-panel-head">
            <h1>🌐 GIS – MAP</h1>
            <p className="td-lead">Bản đồ tương tác (Leaflet + OpenStreetMap), import marker từ HHMĐ/ATGT, xuất GeoJSON/KML.</p>
          </header>
          <div className="dos-toolbar">
            <button type="button" className="btn btn-primary" onClick={handleNewProject}>➕ Tạo bản đồ mới</button>
            <span className="muted small">Marker · Polyline · Polygon · Đo khoảng cách · Import/Export.</span>
            <div style={{ flex: 1 }} />
            {statusMsg && <span className="td-saved-flash">{statusMsg}</span>}
          </div>
          <div className="empty-banner">
            <h3 className="empty-banner-title">🗺 Chưa có bản đồ — hãy tạo bản đồ mới</h3>
            <p className="empty-banner-msg">
              Tạo bản đồ mới để hiển thị marker từ HHMĐ/ATGT, đo khoảng cách trên map, vẽ polyline + polygon và import/export GeoJSON / KML.
            </p>
            <button type="button" className="btn btn-primary" onClick={handleNewProject}>➕ Tạo bản đồ mới</button>
            {db.projects.length > 0 && (
              <div className="empty-banner-recent">
                <div className="atgt-recent-label">Bản đồ gần đây:</div>
                {db.projects.map((p) => (
                  <button key={p.id} type="button" className="atgt-recent-item"
                    onClick={() => setDb((prev) => ({ ...prev, activeProjectId: p.id }))}>
                    🗺 {p.name} <span className="muted small">({p.layers[0]?.features.length ?? 0} feature)</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogModal state={dialog} onClose={() => setDialog(null)} />
      </>
    );
  }

  // -------------------------------------------------------------------
  // Active project — full UI
  // -------------------------------------------------------------------
  return (
    <>
      <div className="gis-shell">
        <div className="gis-toolbar">
          <select className="td-select" style={{ minWidth: 220 }}
            value={activeProject.id}
            onChange={(e) => setDb((prev) => ({ ...prev, activeProjectId: e.target.value }))}>
            {db.projects.map((p) => <option key={p.id} value={p.id}>🗺 {p.name}</option>)}
          </select>
          <button type="button" className="btn btn-ghost" onClick={handleNewProject}>➕</button>
          <button type="button" className="btn btn-ghost" onClick={() => handleDeleteProject(activeProject.id)}>🗑</button>
          <span className="atgt-selector-sep">|</span>

          {mode === 'view' ? (
            <>
              <button type="button" className="btn btn-primary" onClick={handleStartMarker}>📍 Thêm marker</button>
              <button type="button" className="btn btn-ghost" onClick={handleStartMeasure}>📏 Đo k.cách</button>
              <button type="button" className="btn btn-ghost" onClick={handleStartPolygon}>⬡ Polygon</button>
            </>
          ) : mode === 'add-marker' ? (
            <>
              <select className="td-select" style={{ width: 130 }}
                value={pendingMarker.markerType}
                onChange={(e) => {
                  const t = e.target.value as any;
                  const presets: Record<string, { icon: string; color: string }> = {
                    normal: { icon: '📍', color: '#dc2626' },
                    km: { icon: '🟦', color: '#2563eb' },
                    coch: { icon: '⬛', color: '#0f172a' },
                    elevation: { icon: '🔺', color: '#059669' },
                  };
                  const preset = presets[t] ?? presets.normal!;
                  setPendingMarker({ ...pendingMarker, markerType: t, ...preset });
                }}>
                <option value="normal">📍 Marker thường</option>
                <option value="km">🟦 Cột Km</option>
                <option value="coch">⬛ Cọc H</option>
                <option value="elevation">🔺 Mốc cao độ</option>
              </select>
              {pendingMarker.markerType === 'normal' ? (
                <>
                  <input type="text" className="td-input" placeholder="Tên marker"
                    style={{ width: 140, padding: '6px 10px' }}
                    value={pendingMarker.name}
                    onChange={(e) => setPendingMarker({ ...pendingMarker, name: e.target.value })} />
                  <select className="td-select" style={{ width: 70 }}
                    value={pendingMarker.icon}
                    onChange={(e) => setPendingMarker({ ...pendingMarker, icon: e.target.value })}>
                    <option value="📍">📍</option>
                    <option value="🚸">🚸</option>
                    <option value="🛣">🛣</option>
                    <option value="⚠">⚠</option>
                    <option value="🚧">🚧</option>
                  </select>
                </>
              ) : (
                <>
                  <input type="number" className="td-input" placeholder="Lý trình (m)"
                    style={{ width: 120, padding: '6px 10px' }}
                    value={pendingMarker.station}
                    onChange={(e) => setPendingMarker({ ...pendingMarker, station: Number(e.target.value) || 0 })} />
                  {pendingMarker.markerType === 'elevation' && (
                    <input type="number" step={0.01} className="td-input" placeholder="Cao độ (m)"
                      style={{ width: 110, padding: '6px 10px' }}
                      value={pendingMarker.elevation}
                      onChange={(e) => setPendingMarker({ ...pendingMarker, elevation: Number(e.target.value) || 0 })} />
                  )}
                </>
              )}
              <input type="color" value={pendingMarker.color}
                onChange={(e) => setPendingMarker({ ...pendingMarker, color: e.target.value })}
                style={{ width: 36, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer' }} />
              <button type="button" className="btn btn-primary" onClick={handleCancelDraft}>✓ Xong</button>
              <span className="muted small">Click trên map để đặt</span>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-primary" onClick={handleFinishDraft}>✓ Hoàn thành</button>
              <button type="button" className="btn btn-ghost" onClick={handleCancelDraft}>✗ Hủy</button>
              <span className="muted small">Mode: <b>{mode}</b> · Điểm: {draftPoints.length}</span>
            </>
          )}

          <span className="atgt-selector-sep">|</span>

          {/* Phase 28.13 — Import dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setShowImportMenu((v) => !v); setShowExportMenu(false); }}
            >
              📥 Import ▾
            </button>
            {showImportMenu && (
              <div
                style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 10,
                  background: 'var(--color-surface, #1a1a1a)', border: '1px solid var(--color-border-soft, #2a2a2a)',
                  borderRadius: 6, padding: 4, minWidth: 180, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                onMouseLeave={() => setShowImportMenu(false)}
              >
                <button type="button" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => { handleImportHhmd(); setShowImportMenu(false); }}>🛣 Từ HHMĐ project</button>
                <button type="button" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => { handleImportAtgt(); setShowImportMenu(false); }}>🚸 Từ ATGT project</button>
                <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-soft, #2a2a2a)', margin: '4px 0' }} />
                <button type="button" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => { void handleImport('geojson'); setShowImportMenu(false); }}>📄 GeoJSON</button>
                <button type="button" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => { void handleImport('kml'); setShowImportMenu(false); }}>📄 KML</button>
                <button type="button" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => { void handleImport('kmz'); setShowImportMenu(false); }}>📦 KMZ</button>
              </div>
            )}
          </div>

          {/* Phase 28.13 — Export dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setShowExportMenu((v) => !v); setShowImportMenu(false); }}
            >
              📤 Export ▾
            </button>
            {showExportMenu && (
              <div
                style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 10,
                  background: 'var(--color-surface, #1a1a1a)', border: '1px solid var(--color-border-soft, #2a2a2a)',
                  borderRadius: 6, padding: 4, minWidth: 160, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                onMouseLeave={() => setShowExportMenu(false)}
              >
                <button type="button" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => { void handleExport('geojson'); setShowExportMenu(false); }}>📄 GeoJSON</button>
                <button type="button" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => { void handleExport('kml'); setShowExportMenu(false); }}>📄 KML</button>
                <button type="button" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => { void handleExport('kmz'); setShowExportMenu(false); }}>📦 KMZ</button>
              </div>
            )}
          </div>

          <button type="button" className="btn btn-ghost" onClick={() => setShowCoordTable((v) => !v)} title="Bảng tọa độ VN-2000 trụ Km / cọc H">
            📐 VN-2000 {showCoordTable ? '▴' : '▾'}
          </button>

          <div style={{ flex: 1 }} />
          {statusMsg && <span className="td-saved-flash">{statusMsg}</span>}
        </div>

        {/* Phase 28.13 — VN-2000 coordinate table */}
        {showCoordTable && activeLayer && (
          <Vn2000Table
            features={activeLayer.features}
            provinceCode={provinceCode}
            onChangeProvince={changeProvince}
            flash={flash}
          />
        )}

        <div className="gis-body">
          <div className="gis-sidebar">
            <div className="gis-sidebar-title">📋 Danh sách feature ({activeLayer?.features.length ?? 0})</div>
            <div className="gis-feature-list">
              {!activeLayer || activeLayer.features.length === 0 ? (
                <p className="muted small" style={{ padding: 16 }}>Chưa có feature. Click "📍 Thêm marker" để bắt đầu.</p>
              ) : activeLayer.features.map((f) => (
                <div key={f.id} className="gis-feature-item">
                  <span className="gis-feature-icon">
                    {f.kind === 'marker' ? (f.icon ?? '📍') : f.kind === 'polyline' ? '〰' : '⬡'}
                  </span>
                  <div className="gis-feature-info">
                    <div className="gis-feature-title">{f.title}</div>
                    <div className="gis-feature-meta muted small">
                      {f.kind === 'marker' && `${f.position.lat.toFixed(5)}, ${f.position.lng.toFixed(5)}`}
                      {f.kind === 'polyline' && `${f.points.length} điểm · ${formatDistance(f.distanceM ?? polylineDistance(f.points))}`}
                      {f.kind === 'polygon' && `${f.points.length} điểm · ${formatArea(f.areaM2 ?? polygonArea(f.points))}`}
                      {f.source && f.source !== 'manual' && ` · ${f.source}`}
                    </div>
                  </div>
                  <div className="gis-feature-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => handleZoomTo(f)} title="Zoom đến">🔍</button>
                    <button type="button" className="btn btn-ghost" onClick={() => handleDeleteFeature(f.id)} title="Xóa">🗑</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div ref={mapRef} className="gis-map"></div>
        </div>
      </div>
      <DialogModal state={dialog} onClose={() => setDialog(null)} />
    </>
  );
}

function DialogModal({ state, onClose }: { state: DialogState; onClose: () => void }): JSX.Element {
  const [input, setInput] = useState('');
  useEffect(() => { if (state?.kind === 'prompt') setInput(state.value); }, [state]);
  if (!state) return <></>;
  function submit(): void {
    if (state?.kind === 'prompt') {
      const v = input.trim();
      if (!v) return;
      state.onSubmit(v);
    } else if (state?.kind === 'confirm') {
      state.onConfirm();
    }
    onClose();
  }
  return (
    <div className="atgt-dialog-backdrop" onClick={onClose}>
      <div className="atgt-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="atgt-dialog-title">{state.title}</div>
        {state.kind === 'prompt' ? (
          <input type="text" className="td-input" autoFocus value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }} />
        ) : <p className="atgt-dialog-msg">{state.message}</p>}
        <div className="atgt-dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button type="button" className={state.kind === 'confirm' && state.danger ? 'btn atgt-dialog-danger' : 'btn btn-primary'} onClick={submit}>
            {state.kind === 'prompt' ? '✓ Lưu' : state.danger ? '🗑 Xóa' : '✓ OK'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Phase 28.13 — Vn2000Table — bảng tọa độ trụ Km / cọc H theo VN-2000
// =====================================================================

function Vn2000Table({ features, provinceCode, onChangeProvince, flash }: {
  features: GisFeature[];
  provinceCode: string;
  onChangeProvince: (code: string) => void;
  flash: (m: string) => void;
}): JSX.Element {
  const province = findProvince(provinceCode) ?? findProvince(DEFAULT_PROVINCE_CODE)!;
  // Filter only Km + Cọc H markers
  const kmMarkers = features.filter(
    (f): f is GisMarker => f.kind === 'marker' && (f as GisMarker).markerType === 'km',
  );
  const cocMarkers = features.filter(
    (f): f is GisMarker => f.kind === 'marker' && (f as GisMarker).markerType === 'coch',
  );
  const elevMarkers = features.filter(
    (f): f is GisMarker => f.kind === 'marker' && (f as GisMarker).markerType === 'elevation',
  );

  function rowsFor(arr: GisMarker[], type: string): Array<{ stt: number; type: string; name: string; station: string; lat: number; lon: number; x: number; y: number; elevation?: number }> {
    return arr.map((m, i) => {
      const { x, y } = wgs84ToVn2000(m.position.lat, m.position.lng, province);
      return {
        stt: i + 1,
        type,
        name: m.title || '—',
        station: m.station != null ? `Km${Math.floor(m.station / 1000)}+${(m.station % 1000).toString().padStart(3, '0')}` : '—',
        lat: m.position.lat,
        lon: m.position.lng,
        x,
        y,
        elevation: m.elevation,
      };
    });
  }

  const rowsKm = rowsFor(kmMarkers, 'Trụ Km');
  const rowsCoc = rowsFor(cocMarkers, 'Cọc H');
  const rowsElev = rowsFor(elevMarkers, 'Mốc cao độ');
  const allRows = [...rowsKm, ...rowsCoc, ...rowsElev];

  async function handleExportExcel(): Promise<void> {
    if (allRows.length === 0) { flash('Chưa có trụ Km / cọc H / mốc cao độ.'); return; }
    const wb = XLSX.utils.book_new();
    const header = ['STT', 'Loại', 'Tên', 'Lý trình', 'Lat (WGS84)', 'Lon (WGS84)', 'X VN-2000 (m)', 'Y VN-2000 (m)', 'Cao độ (m)'];
    const aoa: (string | number)[][] = [
      [`Bảng tọa độ VN-2000 — Tỉnh ${province.name} (KT trục: ${province.meridian}° · Múi ${province.zoneWidth}°)`],
      [],
      header,
      ...allRows.map((r) => [r.stt, r.type, r.name, r.station, r.lat.toFixed(7), r.lon.toFixed(7), r.x.toFixed(2), r.y.toFixed(2), r.elevation ?? '']),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, 'VN-2000');
    const dateStr = new Date().toISOString().slice(0, 10);
    const path = await save({
      title: 'Lưu bảng tọa độ VN-2000',
      defaultPath: `VN2000_${province.code}_${dateStr}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (!path) return;
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const bytes = Array.from(new Uint8Array(buf));
    await invoke<number>('save_file_bytes', { path, bytes });
    flash(`✓ Đã xuất ${allRows.length} điểm tọa độ VN-2000 (${province.name})`);
  }

  return (
    <div style={{
      padding: '10px 14px',
      background: 'var(--color-surface, #1a1a1a)',
      borderTop: '1px solid var(--color-border-soft, #2a2a2a)',
      borderBottom: '1px solid var(--color-border-soft, #2a2a2a)',
      maxHeight: 360,
      overflow: 'auto',
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13 }}>📐 Bảng tọa độ VN-2000</strong>
        <label style={{ fontSize: 12 }}>Tỉnh:</label>
        <select
          className="td-select"
          value={provinceCode}
          onChange={(e) => onChangeProvince(e.target.value)}
          style={{ width: 200, fontSize: 12 }}
        >
          {VN2000_PROVINCES.map((p) => (
            <option key={p.code} value={p.code}>{p.name} (KT {p.meridian}° · {p.zoneWidth}°)</option>
          ))}
        </select>
        <span className="muted small">
          {kmMarkers.length} trụ Km · {cocMarkers.length} cọc H · {elevMarkers.length} mốc cao độ
        </span>
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleExportExcel()} disabled={allRows.length === 0}>
          📤 Xuất Excel
        </button>
      </div>

      {allRows.length === 0 ? (
        <p className="muted small" style={{ padding: 12, textAlign: 'center', margin: 0 }}>
          Chưa có trụ Km / cọc H / mốc cao độ trên bản đồ. Bấm "📍 Thêm marker" → chọn loại "🟦 Cột Km" / "⬛ Cọc H" / "🔺 Mốc cao độ".
        </p>
      ) : (
        <table className="atgt-table" style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ width: 40 }}>STT</th>
              <th>Loại</th>
              <th>Tên</th>
              <th>Lý trình</th>
              <th>Lat WGS84</th>
              <th>Lon WGS84</th>
              <th>X VN-2000</th>
              <th>Y VN-2000</th>
              <th>Cao độ</th>
            </tr>
          </thead>
          <tbody>
            {allRows.map((r, i) => (
              <tr key={i}>
                <td>{r.stt}</td>
                <td>{r.type}</td>
                <td>{r.name}</td>
                <td>{r.station}</td>
                <td style={{ fontFamily: 'monospace' }}>{r.lat.toFixed(6)}</td>
                <td style={{ fontFamily: 'monospace' }}>{r.lon.toFixed(6)}</td>
                <td style={{ fontFamily: 'monospace' }}>{r.x.toFixed(2)}</td>
                <td style={{ fontFamily: 'monospace' }}>{r.y.toFixed(2)}</td>
                <td>{r.elevation != null ? r.elevation.toFixed(2) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
