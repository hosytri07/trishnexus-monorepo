/**
 * @trishteam/core/notes — QuickNotes domain + review + kanban.
 *
 * Re-export từ submodules:
 *   types.ts      Note, NoteDraft, NoteStatus, constants
 *   validate.ts   validateDraft, normalizeTag
 *   review.ts     notesDueForReview, markReviewed, computeReviewStreak
 *   kanban.ts     groupByKanban, moveNote, countByStatus
 *
 * Phase 14.0 scaffold, Phase 14.4.1 extend review + kanban.
 */

export * from './types.js';
export * from './validate.js';
export * from './review.js';
export * from './kanban.js';
