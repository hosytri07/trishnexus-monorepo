/**
 * @trishteam/core/type — CRDT text editor domain layer.
 *
 * Phase 14.3.3: position-based text CRDT (RGA-style) cho multi-caret
 * editing. Offline-safe merge giữa 2 actor edit song song; caret
 * anchor vào CharId nên không bị shift khi char khác insert/delete
 * ở chỗ khác.
 */

export type {
  ActorId,
  Clock,
  CharId,
  CharNode,
  InsertOp,
  DeleteOp,
  Op,
  CrdtState,
  Caret,
} from './types.js';
export { serializeCharId, keyOfAfter } from './types.js';

export {
  createState,
  applyOp,
  applyOps,
  toText,
  visibleChars,
  makeInsert,
  makeDelete,
  makeInsertString,
  serialize,
  deserialize,
  type SerializedDoc,
} from './crdt.js';

export {
  typeAtCarets,
  backspaceAtCarets,
  caretAtIndex,
  indexToAfter,
  afterToIndex,
  type TypeResult,
  type DeleteResult,
} from './multicaret.js';
