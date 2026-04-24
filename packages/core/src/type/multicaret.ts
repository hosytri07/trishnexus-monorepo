import {
  applyOp,
  makeDelete,
  makeInsert,
  visibleChars,
} from './crdt.js';
import {
  type ActorId,
  type Caret,
  type CharId,
  type CrdtState,
  type InsertOp,
  type Op,
  serializeCharId,
} from './types.js';

/**
 * Multi-caret typing — feature signature của TrishType 2.0.
 *
 * Input: state + danh sách carets + 1 ký tự user vừa gõ.
 * Output: new ops + new carets (anchorAfter shift để caret "theo" ký
 * tự vừa gõ).
 *
 * Quan trọng: dùng CharId để anchor — caret không bị shift bởi insert
 * ở chỗ khác, kể cả khi remote ops tới muộn.
 */
export interface TypeResult {
  ops: InsertOp[];
  carets: Caret[];
}

export function typeAtCarets(
  state: CrdtState,
  carets: readonly Caret[],
  ch: string,
  actor: ActorId,
): TypeResult {
  const ops: InsertOp[] = [];
  const newCarets: Caret[] = [];
  // Sort carets theo visual position desc → insert sau không lũng
  // loạn caret trước. Vì CRDT dùng CharId, thực ra không cần sort,
  // nhưng giữ order deterministic cho test dễ.
  for (const caret of carets) {
    const { op, id } = makeInsert(state, actor, caret.anchorAfter, ch);
    applyOp(state, op);
    ops.push(op);
    newCarets.push({
      ...caret,
      anchorAfter: id,
      headAfter: id,
    });
  }
  return { ops, carets: newCarets };
}

/**
 * Backspace tại mỗi caret. Xoá char ngay trước caret (anchorAfter).
 * Nếu caret ở đầu doc → skip.
 *
 * Sau khi xoá, caret dịch lùi sang char trước đó.
 */
export interface DeleteResult {
  ops: Op[];
  carets: Caret[];
}

export function backspaceAtCarets(
  state: CrdtState,
  carets: readonly Caret[],
): DeleteResult {
  const visible = visibleChars(state);
  const posByKey = new Map<string, number>();
  for (let i = 0; i < visible.length; i++) {
    posByKey.set(serializeCharId(visible[i]!.id), i);
  }

  const ops: Op[] = [];
  const newCarets: Caret[] = [];

  for (const caret of carets) {
    if (caret.anchorAfter === null) {
      // Đầu doc, không xoá được.
      newCarets.push(caret);
      continue;
    }
    const target = caret.anchorAfter;
    ops.push(makeDelete(target));
    applyOp(state, ops[ops.length - 1]!);

    // Sau khi xoá, anchorAfter phải lùi sang char ngay trước `target`
    // (theo visual order). Nếu không còn char trước → null.
    const pos = posByKey.get(serializeCharId(target));
    let newAnchor: CharId | null = null;
    if (pos !== undefined && pos > 0) {
      newAnchor = visible[pos - 1]!.id;
    }
    newCarets.push({
      ...caret,
      anchorAfter: newAnchor,
      headAfter: newAnchor,
    });
  }

  return { ops, carets: newCarets };
}

/**
 * Tạo caret mới ở vị trí index (0-based, theo visible text).
 * index=0 → trước char đầu tiên (anchorAfter=null).
 * index=N → sau char thứ N-1.
 */
export function caretAtIndex(
  state: CrdtState,
  actor: ActorId,
  index: number,
  id = `caret-${Math.random().toString(36).slice(2, 8)}`,
): Caret {
  const visible = visibleChars(state);
  const clamped = Math.max(0, Math.min(visible.length, index));
  const anchorAfter: CharId | null =
    clamped === 0 ? null : visible[clamped - 1]!.id;
  return {
    id,
    actor,
    anchorAfter,
    headAfter: anchorAfter,
  };
}

/** Convert visible index → anchorAfter. Dùng khi click vào text. */
export function indexToAfter(
  state: CrdtState,
  index: number,
): CharId | null {
  const visible = visibleChars(state);
  const clamped = Math.max(0, Math.min(visible.length, index));
  return clamped === 0 ? null : visible[clamped - 1]!.id;
}

/** Convert anchorAfter → visible index. Dùng khi render caret. */
export function afterToIndex(
  state: CrdtState,
  after: CharId | null,
): number {
  if (after === null) return 0;
  const visible = visibleChars(state);
  const key = serializeCharId(after);
  for (let i = 0; i < visible.length; i++) {
    if (serializeCharId(visible[i]!.id) === key) {
      return i + 1;
    }
  }
  return 0; // không tìm thấy → coi như đầu doc
}
