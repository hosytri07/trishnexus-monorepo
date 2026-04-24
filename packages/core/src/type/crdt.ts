import {
  type ActorId,
  type CharId,
  type CharNode,
  type CrdtState,
  type DeleteOp,
  type InsertOp,
  type Op,
  keyOfAfter,
  serializeCharId,
} from './types.js';

/**
 * RGA-style text CRDT.
 *
 * Convergence: với cùng tập Op (không quan trọng thứ tự áp dụng),
 * mọi replica đều ra text giống nhau vì:
 *   - applyOp idempotent (check duplicate qua ID).
 *   - Vị trí render của mỗi char chỉ phụ thuộc `after` + tie-break
 *     deterministic (clock desc, actor asc).
 *   - Delete chỉ flip tombstone, không xoá khỏi Map.
 */

export function createState(): CrdtState {
  return { nodes: new Map(), nextClock: 0 };
}

/** Apply op vào state (mutates). Idempotent. */
export function applyOp(state: CrdtState, op: Op): void {
  if (op.kind === 'ins') {
    const key = serializeCharId(op.id);
    if (state.nodes.has(key)) return; // idempotent
    state.nodes.set(key, {
      id: op.id,
      ch: op.ch,
      after: op.after,
      deleted: false,
    });
    // Advance clock nếu thấy op từ tương lai (hybrid logical clock lite).
    if (op.id[1] >= state.nextClock) {
      state.nextClock = op.id[1] + 1;
    }
  } else {
    const key = serializeCharId(op.target);
    const node = state.nodes.get(key);
    if (node) node.deleted = true;
  }
}

export function applyOps(state: CrdtState, ops: readonly Op[]): void {
  for (const op of ops) applyOp(state, op);
}

/** Render text hiện tại. O(n log n). */
export function toText(state: CrdtState): string {
  const visible = visibleChars(state);
  return visible.map((n) => n.ch).join('');
}

/**
 * Trả về danh sách CharNode không bị delete, theo thứ tự hiển thị.
 * Dùng chung cho toText + caret lookup.
 */
export function visibleChars(state: CrdtState): CharNode[] {
  // Group theo after.
  const children = new Map<string, CharNode[]>();
  for (const n of state.nodes.values()) {
    const k = keyOfAfter(n.after);
    let arr = children.get(k);
    if (!arr) {
      arr = [];
      children.set(k, arr);
    }
    arr.push(n);
  }
  // Sort children: clock desc, actor asc (RGA rule → new insert
  // đẩy cũ sang phải).
  for (const arr of children.values()) {
    arr.sort((a, b) => {
      if (a.id[1] !== b.id[1]) return b.id[1] - a.id[1];
      return a.id[0] < b.id[0] ? -1 : 1;
    });
  }
  // DFS iterative từ $START.
  const out: CharNode[] = [];
  const stack: string[] = ['$START'];
  const popped: CharNode[][] = [];
  const iterate = (key: string): void => {
    const arr = children.get(key) ?? [];
    // Push children theo reverse để pop ra đúng thứ tự.
    for (let i = arr.length - 1; i >= 0; i--) {
      stack.push('__after:' + serializeCharId(arr[i]!.id));
      stack.push('__visit:' + serializeCharId(arr[i]!.id));
    }
  };
  iterate('$START');
  while (stack.length) {
    const top = stack.pop()!;
    if (top.startsWith('__visit:')) {
      const idKey = top.slice('__visit:'.length);
      const n = state.nodes.get(idKey)!;
      if (!n.deleted) out.push(n);
    } else if (top.startsWith('__after:')) {
      const idKey = top.slice('__after:'.length);
      iterate(idKey);
    }
  }
  void popped; // placeholder for future tree debug
  return out;
}

/**
 * Tạo InsertOp ở vị trí sau `after`. Tự bump clock.
 * Return tuple [op, newCharId] để caller cập nhật caret.
 */
export function makeInsert(
  state: CrdtState,
  actor: ActorId,
  after: CharId | null,
  ch: string,
): { op: InsertOp; id: CharId } {
  const id: CharId = [actor, state.nextClock++];
  return {
    id,
    op: { kind: 'ins', id, ch, after },
  };
}

export function makeDelete(target: CharId): DeleteOp {
  return { kind: 'del', target };
}

/** Convenience: type 1 string ở vị trí after; trả về ops + charId cuối. */
export function makeInsertString(
  state: CrdtState,
  actor: ActorId,
  after: CharId | null,
  text: string,
): { ops: InsertOp[]; lastId: CharId | null } {
  const ops: InsertOp[] = [];
  let cursor: CharId | null = after;
  for (const ch of Array.from(text)) {
    const { op, id } = makeInsert(state, actor, cursor, ch);
    applyOp(state, op);
    ops.push(op);
    cursor = id;
  }
  return { ops, lastId: cursor };
}

/**
 * Serialize state → bytes (JSON) cho save to file.
 * Unicode chars stored literal, không base64.
 */
export interface SerializedDoc {
  version: 1;
  nextClock: number;
  nodes: Array<{
    id: CharId;
    ch: string;
    after: CharId | null;
    deleted: boolean;
  }>;
}

export function serialize(state: CrdtState): SerializedDoc {
  return {
    version: 1,
    nextClock: state.nextClock,
    nodes: Array.from(state.nodes.values()).map((n) => ({
      id: n.id,
      ch: n.ch,
      after: n.after,
      deleted: n.deleted,
    })),
  };
}

export function deserialize(doc: SerializedDoc): CrdtState {
  const state = createState();
  state.nextClock = doc.nextClock;
  for (const n of doc.nodes) {
    state.nodes.set(serializeCharId(n.id), {
      id: n.id,
      ch: n.ch,
      after: n.after,
      deleted: n.deleted,
    });
  }
  return state;
}
