/**
 * TrishDesign Phase 28.5 — GIS Map data types + GeoJSON/KML helpers.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export type GisFeatureKind = 'marker' | 'polyline' | 'polygon';

export interface GisMarker {
  id: string;
  kind: 'marker';
  position: LatLng;
  title: string;
  description?: string;
  color?: string;
  icon?: string;       // emoji
  source?: 'hhmd' | 'atgt' | 'manual' | 'imported';
  /** Phase 28.7c: marker đặc biệt cho hạ tầng GT */
  markerType?: 'normal' | 'km' | 'coch' | 'elevation';
  /** Lý trình (m) — áp dụng cho km/coch/elevation */
  station?: number;
  /** Cao độ (m) — áp dụng cho elevation marker */
  elevation?: number;
}

export interface GisPolyline {
  id: string;
  kind: 'polyline';
  points: LatLng[];
  title: string;
  color?: string;
  weight?: number;
  description?: string;
  source?: 'hhmd' | 'atgt' | 'manual' | 'imported';
  /** Computed distance trong meters (cache) */
  distanceM?: number;
}

export interface GisPolygon {
  id: string;
  kind: 'polygon';
  points: LatLng[];
  title: string;
  color?: string;
  fillOpacity?: number;
  description?: string;
  source?: 'hhmd' | 'atgt' | 'manual' | 'imported';
  areaM2?: number;
}

export type GisFeature = GisMarker | GisPolyline | GisPolygon;

export interface GisLayer {
  id: string;
  name: string;
  visible: boolean;
  features: GisFeature[];
}

export interface GisProject {
  id: string;
  name: string;
  center: LatLng;
  zoom: number;
  layers: GisLayer[];
  createdAt: number;
  updatedAt: number;
}

export interface GisDb {
  version: number;
  projects: GisProject[];
  activeProjectId: string | null;
  updatedAt: number;
}

export function emptyGisDb(): GisDb {
  return { version: 1, projects: [], activeProjectId: null, updatedAt: Date.now() };
}

export function newGisId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000).toString(36)}`;
}

/** Default map center: Đà Nẵng */
export function defaultGisProject(name: string): GisProject {
  return {
    id: newGisId('proj'),
    name,
    center: { lat: 16.0544, lng: 108.2022 },
    zoom: 13,
    layers: [{ id: newGisId('layer'), name: 'Lớp mặc định', visible: true, features: [] }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// =====================================================================
// Distance helpers (Haversine)
// =====================================================================

const R_EARTH = 6371000; // m

function toRad(deg: number): number { return (deg * Math.PI) / 180; }

export function haversineDistance(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R_EARTH * c;
}

export function polylineDistance(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(points[i - 1]!, points[i]!);
  }
  return total;
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${m.toFixed(0)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

/** Polygon area shoelace + spherical correction (đơn giản, chấp nhận sai số nhỏ) */
export function polygonArea(points: LatLng[]): number {
  if (points.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i]!;
    const p2 = points[(i + 1) % points.length]!;
    total += toRad(p2.lng - p1.lng) * (2 + Math.sin(toRad(p1.lat)) + Math.sin(toRad(p2.lat)));
  }
  return Math.abs((total * R_EARTH * R_EARTH) / 2);
}

export function formatArea(m2: number): string {
  if (m2 < 10000) return `${m2.toFixed(0)} m²`;
  return `${(m2 / 10000).toFixed(2)} ha`;
}

// =====================================================================
// GeoJSON import/export
// =====================================================================

/** Parse GeoJSON FeatureCollection → GisFeature[] */
export function parseGeoJson(text: string): GisFeature[] {
  const json = JSON.parse(text);
  const features: GisFeature[] = [];
  if (!json || (json.type !== 'FeatureCollection' && json.type !== 'Feature')) return [];
  const list = json.type === 'Feature' ? [json] : (json.features ?? []);
  for (const f of list) {
    const props = f.properties ?? {};
    const title = props.name ?? props.title ?? 'Imported';
    const geom = f.geometry;
    if (!geom) continue;
    switch (geom.type) {
      case 'Point':
        features.push({
          id: newGisId('m'),
          kind: 'marker',
          position: { lat: geom.coordinates[1], lng: geom.coordinates[0] },
          title,
          description: props.description,
          source: 'imported',
        });
        break;
      case 'LineString':
        features.push({
          id: newGisId('l'),
          kind: 'polyline',
          points: geom.coordinates.map((c: number[]) => ({ lat: c[1]!, lng: c[0]! })),
          title,
          color: props.color ?? '#2563eb',
          source: 'imported',
        });
        break;
      case 'Polygon': {
        const ring = geom.coordinates[0] ?? [];
        features.push({
          id: newGisId('p'),
          kind: 'polygon',
          points: ring.map((c: number[]) => ({ lat: c[1]!, lng: c[0]! })),
          title,
          color: props.color ?? '#10b981',
          source: 'imported',
        });
        break;
      }
    }
  }
  return features;
}

/** Export GisFeature[] → GeoJSON FeatureCollection */
export function toGeoJson(features: GisFeature[]): string {
  const fc = {
    type: 'FeatureCollection',
    features: features.map((f) => {
      const props: Record<string, unknown> = { name: f.title };
      if ('description' in f && f.description) props.description = f.description;
      if ('color' in f && f.color) props.color = f.color;
      if (f.kind === 'marker') {
        return {
          type: 'Feature', properties: props,
          geometry: { type: 'Point', coordinates: [f.position.lng, f.position.lat] },
        };
      }
      if (f.kind === 'polyline') {
        return {
          type: 'Feature', properties: props,
          geometry: { type: 'LineString', coordinates: f.points.map((p) => [p.lng, p.lat]) },
        };
      }
      // polygon
      const ring = [...f.points.map((p) => [p.lng, p.lat])];
      if (ring.length > 0 && (ring[0]![0] !== ring[ring.length - 1]![0] || ring[0]![1] !== ring[ring.length - 1]![1])) {
        ring.push(ring[0]!);
      }
      return {
        type: 'Feature', properties: props,
        geometry: { type: 'Polygon', coordinates: [ring] },
      };
    }),
  };
  return JSON.stringify(fc, null, 2);
}

// =====================================================================
// KML import/export (đơn giản — Placemark + Point/LineString/Polygon)
// =====================================================================

export function toKml(features: GisFeature[], docName: string = 'TrishDesign Map'): string {
  const placemarks = features.map((f) => {
    const desc = ('description' in f && f.description) ? f.description : '';
    if (f.kind === 'marker') {
      return `    <Placemark>
      <name>${escapeXml(f.title)}</name>
      <description>${escapeXml(desc)}</description>
      <Point><coordinates>${f.position.lng},${f.position.lat},0</coordinates></Point>
    </Placemark>`;
    }
    if (f.kind === 'polyline') {
      const coords = f.points.map((p) => `${p.lng},${p.lat},0`).join(' ');
      return `    <Placemark>
      <name>${escapeXml(f.title)}</name>
      <description>${escapeXml(desc)}</description>
      <LineString><coordinates>${coords}</coordinates></LineString>
    </Placemark>`;
    }
    // polygon
    const ring = [...f.points];
    if (ring.length > 0 && (ring[0]!.lat !== ring[ring.length - 1]!.lat || ring[0]!.lng !== ring[ring.length - 1]!.lng)) {
      ring.push(ring[0]!);
    }
    const coords = ring.map((p) => `${p.lng},${p.lat},0`).join(' ');
    return `    <Placemark>
      <name>${escapeXml(f.title)}</name>
      <description>${escapeXml(desc)}</description>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>
    </Placemark>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(docName)}</name>
${placemarks}
  </Document>
</kml>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!));
}

/** Parse KML rất basic — extract Placemark with Point/LineString/Polygon */
export function parseKml(text: string): GisFeature[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');
  const placemarks = Array.from(doc.getElementsByTagName('Placemark'));
  const features: GisFeature[] = [];
  for (const pm of placemarks) {
    const title = pm.getElementsByTagName('name')[0]?.textContent ?? 'Imported';
    const desc = pm.getElementsByTagName('description')[0]?.textContent ?? undefined;

    const point = pm.getElementsByTagName('Point')[0];
    if (point) {
      const c = point.getElementsByTagName('coordinates')[0]?.textContent?.trim();
      if (c) {
        const [lng, lat] = c.split(',').map(Number);
        if (lat != null && lng != null) {
          features.push({
            id: newGisId('m'), kind: 'marker',
            position: { lat, lng }, title, description: desc, source: 'imported',
          });
        }
      }
      continue;
    }
    const ls = pm.getElementsByTagName('LineString')[0];
    if (ls) {
      const c = ls.getElementsByTagName('coordinates')[0]?.textContent?.trim();
      if (c) {
        const points: LatLng[] = c.split(/\s+/).filter(Boolean).map((tup) => {
          const [lng, lat] = tup.split(',').map(Number);
          return { lat: lat ?? 0, lng: lng ?? 0 };
        });
        features.push({ id: newGisId('l'), kind: 'polyline', points, title, description: desc, source: 'imported' });
      }
      continue;
    }
    const poly = pm.getElementsByTagName('Polygon')[0];
    if (poly) {
      const c = poly.getElementsByTagName('coordinates')[0]?.textContent?.trim();
      if (c) {
        const points: LatLng[] = c.split(/\s+/).filter(Boolean).map((tup) => {
          const [lng, lat] = tup.split(',').map(Number);
          return { lat: lat ?? 0, lng: lng ?? 0 };
        });
        features.push({ id: newGisId('p'), kind: 'polygon', points, title, description: desc, source: 'imported' });
      }
    }
  }
  return features;
}
