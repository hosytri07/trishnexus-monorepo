/**
 * @trishteam/core/images — TrishImage domain layer.
 *
 * Phase 14.3.4: metadata-only (không decode pixels). Rust scan
 * EXIF + dimensions; TS classify aspect + group event + face bucket
 * heuristic. Khi Phase 14.3.4.b wire ONNX face detector, API giữ
 * nguyên — chỉ face_count field được fill.
 */

export type {
  AspectClass,
  ImageMeta,
  EventGroup,
  RawImageEntry,
  ScanImagesSummary,
} from './types.js';

export { classifyAspect, enrichImage, filterByAspect } from './classify.js';

export {
  DEFAULT_EVENT_GAP_MS,
  groupByEvent,
  groupByDay,
  groupByMonth,
  type GroupEventsOptions,
} from './group.js';

export {
  summarizeImages,
  topExtensions,
  aspectOrder,
  formatBytes,
} from './aggregate.js';

export {
  faceBucket,
  groupByFaceBucket,
  summarizeFaces,
  faceBucketLabel,
  type FaceBucket,
  type FaceSummary,
} from './faces.js';
