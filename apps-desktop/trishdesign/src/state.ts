/**
 * TrishDesign — Phase 28.1 — State management hook.
 *
 * Pattern y hệt TrishFinance/TrishISO:
 *   - localStorage persist key 'trishdesign:db'
 *   - Firestore sync /design_database/{uid}  (manual up/down)
 *   - useDesignDb() hook trả về db + setDb + helper actions
 */

import { useEffect, useState, useCallback } from 'react';
import {
  type DesignDb,
  type Project,
  type RoadSegment,
  type DamagePiece,
  type DamageCode,
  type RoadTemplate,
  type DrawingPrefs,
  type DrawingSettings,
  type RoadStake,
  emptyDb,
  newId,
  defaultDamageCodes,
  defaultDrawingPrefs,
  defaultRoadTemplates,
  autoSegmentName,
} from './types.js';

const LS_KEY = 'trishdesign:db';

function loadDb(): DesignDb {
  if (typeof window === 'undefined') return emptyDb();
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return emptyDb();
    const parsed = JSON.parse(raw) as Partial<DesignDb>;
    return migrate(parsed);
  } catch {
    return emptyDb();
  }
}

function saveDb(db: DesignDb): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(db));
  } catch {
    /* ignore quota */
  }
}

/** Migrate hoặc fill default cho field thiếu */
function migrate(raw: Partial<DesignDb>): DesignDb {
  const base = emptyDb();
  // Force re-default damage codes nếu count khác 11 (TCCS/TCVN 2026 update)
  // v2: damage codes default color = 8 (gray) — re-default nếu user không có
  const damageCodesValid = Array.isArray(raw.damageCodes) && raw.damageCodes.length === 11
    && raw.damageCodes.every((c) => 'maVe' in (c as object) && (c as { colorIndex: number }).colorIndex === 8);
  // Merge drawingPrefs với base, đảm bảo layers field tồn tại (cho dữ liệu cũ)
  const rawPrefs = (raw.drawingPrefs ?? {}) as Record<string, unknown>;
  const mergedPrefs = {
    ...base.drawingPrefs,
    ...rawPrefs,
    // Layers: merge field by field (raw có thể thiếu 1 số layer key)
    layers: {
      ...base.drawingPrefs.layers,
      ...(rawPrefs.layers ?? {}),
    } as typeof base.drawingPrefs.layers,
  };
  return {
    version: raw.version ?? 1,
    projects: Array.isArray(raw.projects) ? raw.projects : [],
    activeProjectId: raw.activeProjectId ?? null,
    damageCodes: damageCodesValid ? raw.damageCodes! : defaultDamageCodes(),
    roadTemplates: Array.isArray(raw.roadTemplates) && raw.roadTemplates.length > 0
      ? raw.roadTemplates
      : defaultRoadTemplates(),
    drawingPrefs: mergedPrefs,
    updatedAt: raw.updatedAt ?? Date.now(),
  };
}

// ============================================================
// Hook
// ============================================================
export function useDesignDb() {
  const [db, setDb] = useState<DesignDb>(() => loadDb());

  useEffect(() => {
    saveDb(db);
  }, [db]);

  // --------------------------------------------------------
  // Projects
  // --------------------------------------------------------
  const createProject = useCallback((input: Partial<Project> & { name: string }): string => {
    const id = newId('prj');
    const now = Date.now();
    const project: Project = {
      id,
      name: input.name,
      code: input.code,
      client: input.client,
      designUnit: input.designUnit,
      surveyDate: input.surveyDate,
      surveyor: input.surveyor,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
      segments: [],
    };
    setDb((d) => ({
      ...d,
      projects: [...d.projects, project],
      activeProjectId: id,
      updatedAt: now,
    }));
    return id;
  }, []);

  const updateProject = useCallback((id: string, patch: Partial<Project>): void => {
    setDb((d) => ({
      ...d,
      projects: d.projects.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
      ),
      updatedAt: Date.now(),
    }));
  }, []);

  const deleteProject = useCallback((id: string): void => {
    setDb((d) => ({
      ...d,
      projects: d.projects.filter((p) => p.id !== id),
      activeProjectId: d.activeProjectId === id
        ? (d.projects.find((p) => p.id !== id)?.id ?? null)
        : d.activeProjectId,
      updatedAt: Date.now(),
    }));
  }, []);

  const setActiveProject = useCallback((id: string | null): void => {
    setDb((d) => ({ ...d, activeProjectId: id, updatedAt: Date.now() }));
  }, []);

  /**
   * Phase 28.4.G — Import 1 project đã serialize sẵn (từ file JSON xuất).
   * Project được tạo ID mới + segment ID mới (tránh trùng với project đã có).
   * Damage pieces giữ nguyên (chỉ regen ID nếu trùng).
   */
  const importProject = useCallback((project: Project): string => {
    const now = Date.now();
    const newProjectId = newId('prj');
    const cloned: Project = {
      ...project,
      id: newProjectId,
      createdAt: now,
      updatedAt: now,
      segments: project.segments.map((s) => ({
        ...s,
        id: newId('seg'),
        projectId: newProjectId,
        damagePieces: s.damagePieces.map((p) => ({ ...p, id: newId('dp') })),
        stakes: s.stakes.map((stk) => ({ ...stk, id: stk.id || newId('stk') })),
      })),
    };
    setDb((d) => ({
      ...d,
      projects: [...d.projects, cloned],
      activeProjectId: newProjectId,
      updatedAt: now,
    }));
    return newProjectId;
  }, []);

  // --------------------------------------------------------
  // Segments
  // --------------------------------------------------------
  /**
   * Phase 28.4.G — Tạo segment mới với inherit từ segment CUỐI trong project:
   * Khổ đường (roadType, roadWidth, laneCount, medianWidth) + drawing settings
   * (frameType, scaleX, scaleY, baoLutMode) tự kế thừa từ đoạn cuối nếu input
   * không override. Lý do: user thường vẽ nhiều đoạn cùng cấu hình (cùng khung
   * A3/A4, cùng tỷ lệ, cùng width đường) — không phải chỉnh lại sau mỗi đoạn.
   */
  const createSegment = useCallback((projectId: string, input: Partial<RoadSegment> & {
    startStation: number;
    endStation: number;
    roadType?: 'single' | 'dual';
    roadWidth?: number;
    laneCount?: number;
  }): string => {
    const id = newId('seg');
    const now = Date.now();
    setDb((d) => {
      const project = d.projects.find((p) => p.id === projectId);
      if (!project) return d;
      const lastSeg = project.segments[project.segments.length - 1];
      const segment: RoadSegment = {
        id,
        projectId,
        name: input.name ?? autoSegmentName(input.startStation, input.endStation),
        startStation: input.startStation,
        endStation: input.endStation,
        roadType: input.roadType ?? lastSeg?.roadType ?? 'single',
        roadWidth: input.roadWidth ?? lastSeg?.roadWidth ?? 7,
        laneCount: input.laneCount ?? lastSeg?.laneCount ?? 2,
        medianWidth: input.medianWidth ?? lastSeg?.medianWidth,
        stakes: input.stakes ?? [],
        damagePieces: [],
        drawing: input.drawing
          ?? (lastSeg?.drawing ? { ...lastSeg.drawing } : defaultDrawingSettings()),
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      };
      return {
        ...d,
        projects: d.projects.map((p) =>
          p.id === projectId
            ? { ...p, segments: [...p.segments, segment], updatedAt: now }
            : p,
        ),
        updatedAt: now,
      };
    });
    return id;
  }, []);

  const updateSegment = useCallback((projectId: string, segmentId: string, patch: Partial<RoadSegment>): void => {
    const now = Date.now();
    setDb((d) => ({
      ...d,
      projects: d.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              segments: p.segments.map((s) =>
                s.id === segmentId ? { ...s, ...patch, updatedAt: now } : s,
              ),
              updatedAt: now,
            }
          : p,
      ),
      updatedAt: now,
    }));
  }, []);

  const deleteSegment = useCallback((projectId: string, segmentId: string): void => {
    const now = Date.now();
    setDb((d) => ({
      ...d,
      projects: d.projects.map((p) =>
        p.id === projectId
          ? { ...p, segments: p.segments.filter((s) => s.id !== segmentId), updatedAt: now }
          : p,
      ),
      updatedAt: now,
    }));
  }, []);

  // --------------------------------------------------------
  // DamagePieces
  // --------------------------------------------------------
  const addDamagePiece = useCallback((projectId: string, segmentId: string, piece: Omit<DamagePiece, 'id' | 'segmentId'>): string => {
    const id = newId('dmg');
    const newPiece: DamagePiece = { ...piece, id, segmentId };
    const now = Date.now();
    setDb((d) => ({
      ...d,
      projects: d.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              segments: p.segments.map((s) =>
                s.id === segmentId
                  ? { ...s, damagePieces: [...s.damagePieces, newPiece], updatedAt: now }
                  : s,
              ),
              updatedAt: now,
            }
          : p,
      ),
      updatedAt: now,
    }));
    return id;
  }, []);

  const updateDamagePiece = useCallback((projectId: string, segmentId: string, pieceId: string, patch: Partial<DamagePiece>): void => {
    const now = Date.now();
    setDb((d) => ({
      ...d,
      projects: d.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              segments: p.segments.map((s) =>
                s.id === segmentId
                  ? {
                      ...s,
                      damagePieces: s.damagePieces.map((m) =>
                        m.id === pieceId ? { ...m, ...patch } : m,
                      ),
                      updatedAt: now,
                    }
                  : s,
              ),
              updatedAt: now,
            }
          : p,
      ),
      updatedAt: now,
    }));
  }, []);

  const deleteDamagePiece = useCallback((projectId: string, segmentId: string, pieceId: string): void => {
    const now = Date.now();
    setDb((d) => ({
      ...d,
      projects: d.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              segments: p.segments.map((s) =>
                s.id === segmentId
                  ? { ...s, damagePieces: s.damagePieces.filter((m) => m.id !== pieceId), updatedAt: now }
                  : s,
              ),
              updatedAt: now,
            }
          : p,
      ),
      updatedAt: now,
    }));
  }, []);

  // --------------------------------------------------------
  // Stakes (cọc H)
  // --------------------------------------------------------
  const addStake = useCallback((projectId: string, segmentId: string, label: string, station: number): void => {
    const stake: RoadStake = { id: newId('stk'), label, station };
    const now = Date.now();
    setDb((d) => ({
      ...d,
      projects: d.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              segments: p.segments.map((s) =>
                s.id === segmentId
                  ? { ...s, stakes: [...s.stakes, stake].sort((a, b) => a.station - b.station), updatedAt: now }
                  : s,
              ),
              updatedAt: now,
            }
          : p,
      ),
      updatedAt: now,
    }));
  }, []);

  const deleteStake = useCallback((projectId: string, segmentId: string, stakeId: string): void => {
    const now = Date.now();
    setDb((d) => ({
      ...d,
      projects: d.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              segments: p.segments.map((s) =>
                s.id === segmentId
                  ? { ...s, stakes: s.stakes.filter((k) => k.id !== stakeId), updatedAt: now }
                  : s,
              ),
              updatedAt: now,
            }
          : p,
      ),
      updatedAt: now,
    }));
  }, []);

  // --------------------------------------------------------
  // DamageCodes (global config)
  // --------------------------------------------------------
  const upsertDamageCode = useCallback((dc: DamageCode): void => {
    setDb((d) => {
      const exists = d.damageCodes.some((x) => x.code === dc.code);
      const newList = exists
        ? d.damageCodes.map((x) => (x.code === dc.code ? dc : x))
        : [...d.damageCodes, dc].sort((a, b) => a.code - b.code);
      return { ...d, damageCodes: newList, updatedAt: Date.now() };
    });
  }, []);

  const deleteDamageCode = useCallback((code: number): void => {
    setDb((d) => ({
      ...d,
      damageCodes: d.damageCodes.filter((x) => x.code !== code),
      updatedAt: Date.now(),
    }));
  }, []);

  // --------------------------------------------------------
  // RoadTemplates
  // --------------------------------------------------------
  const upsertRoadTemplate = useCallback((tpl: RoadTemplate): void => {
    setDb((d) => {
      const exists = d.roadTemplates.some((x) => x.id === tpl.id);
      return {
        ...d,
        roadTemplates: exists
          ? d.roadTemplates.map((x) => (x.id === tpl.id ? tpl : x))
          : [...d.roadTemplates, tpl],
        updatedAt: Date.now(),
      };
    });
  }, []);

  const deleteRoadTemplate = useCallback((id: string): void => {
    setDb((d) => ({
      ...d,
      roadTemplates: d.roadTemplates.filter((x) => x.id !== id),
      updatedAt: Date.now(),
    }));
  }, []);

  // --------------------------------------------------------
  // DrawingPrefs (global)
  // --------------------------------------------------------
  const updateDrawingPrefs = useCallback((patch: Partial<DrawingPrefs>): void => {
    setDb((d) => ({
      ...d,
      drawingPrefs: { ...d.drawingPrefs, ...patch },
      updatedAt: Date.now(),
    }));
  }, []);

  // --------------------------------------------------------
  // Sync replace (Firestore down)
  // --------------------------------------------------------
  const replaceDb = useCallback((next: DesignDb): void => {
    setDb(next);
  }, []);

  return {
    db,
    setDb,
    replaceDb,
    // projects
    createProject,
    updateProject,
    deleteProject,
    setActiveProject,
    importProject,
    // segments
    createSegment,
    updateSegment,
    deleteSegment,
    // damage pieces
    addDamagePiece,
    updateDamagePiece,
    deleteDamagePiece,
    // stakes
    addStake,
    deleteStake,
    // damage codes
    upsertDamageCode,
    deleteDamageCode,
    // templates
    upsertRoadTemplate,
    deleteRoadTemplate,
    // prefs
    updateDrawingPrefs,
  };
}

// ============================================================
// Default DrawingSettings
// ============================================================
function defaultDrawingSettings(): DrawingSettings {
  return {
    frameType: 'A3_390x280',
    scaleX: 0.2,    // Tỉ lệ 1:5 cho A3 (default)
    scaleY: 1,
    baoLutMode: false,
  };
}
