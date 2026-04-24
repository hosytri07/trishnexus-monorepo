/**
 * TrishType CRDT — position-based text CRDT đơn giản, pure TS.
 *
 * Mục tiêu: multi-caret edit + offline-safe merge khi 2 actor edit
 * song song (local + remote tablet). Không dùng Y.js hay Automerge
 * để giảm bundle — chúng ta tự implement RGA-style đủ xài cho text.
 */

/** ID actor (stable, thường gen 1 lần per device/tab). */
export type ActorId = string;

/** Lamport clock — monotonic per actor. */
export type Clock = number;

/** Char ID duy nhất toàn hệ thống = (actor, clock). */
export type CharId = readonly [ActorId, Clock];

export interface CharNode {
  id: CharId;
  ch: string;
  /** ID char mà node này được insert **sau** (null = đầu doc). */
  after: CharId | null;
  /** Tombstone flag — không xoá thật để merge commutative. */
  deleted: boolean;
}

export interface InsertOp {
  kind: 'ins';
  id: CharId;
  ch: string;
  after: CharId | null;
}

export interface DeleteOp {
  kind: 'del';
  target: CharId;
}

export type Op = InsertOp | DeleteOp;

export interface CrdtState {
  nodes: Map<string, CharNode>;
  /** Clock tiếp theo cho actor này. */
  nextClock: number;
}

/**
 * Caret = vị trí con trỏ. Gắn với CharId để không bị shift khi
 * char khác insert/delete ở chỗ khác.
 *
 * `anchorAfter` = null nghĩa là caret ở đầu document.
 * Selection range: anchorAfter và headAfter khác nhau.
 */
export interface Caret {
  id: string;
  actor: ActorId;
  anchorAfter: CharId | null;
  headAfter: CharId | null;
}

export function serializeCharId(id: CharId): string {
  return `${id[0]}:${id[1]}`;
}

export function keyOfAfter(after: CharId | null): string {
  return after === null ? '$START' : serializeCharId(after);
}
