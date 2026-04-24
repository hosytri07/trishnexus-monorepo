import { describe, it, expect } from 'vitest';
import {
  createState,
  applyOp,
  applyOps,
  toText,
  makeInsert,
  makeDelete,
  makeInsertString,
  serialize,
  deserialize,
} from '../crdt.js';
import type { Op } from '../types.js';

describe('RGA CRDT — sequential insert', () => {
  it('insert "hello" tuần tự ra text "hello"', () => {
    const state = createState();
    const { ops } = makeInsertString(state, 'A', null, 'hello');
    expect(ops.length).toBe(5);
    expect(toText(state)).toBe('hello');
  });

  it('insert đơn lẻ sau null → char đầu tiên', () => {
    const state = createState();
    const { op } = makeInsert(state, 'A', null, 'X');
    applyOp(state, op);
    expect(toText(state)).toBe('X');
  });

  it('applyOp là idempotent — apply 2 lần không ra XX', () => {
    const state = createState();
    const { op } = makeInsert(state, 'A', null, 'X');
    applyOp(state, op);
    applyOp(state, op);
    applyOp(state, op);
    expect(toText(state)).toBe('X');
  });

  it('apply empty ops → text rỗng', () => {
    const state = createState();
    applyOps(state, []);
    expect(toText(state)).toBe('');
  });
});

describe('RGA CRDT — delete + tombstone', () => {
  it('makeDelete flip tombstone, toText không còn char đó', () => {
    const state = createState();
    const { ops } = makeInsertString(state, 'A', null, 'abc');
    const bId = (ops[1] as { id: [string, number] }).id;
    applyOp(state, makeDelete(bId));
    expect(toText(state)).toBe('ac');
  });

  it('delete + insert commute — apply theo 2 thứ tự → kết quả giống', () => {
    const s1 = createState();
    const { ops } = makeInsertString(s1, 'A', null, 'abc');
    const bId = (ops[1] as { id: [string, number] }).id;
    const delOp = makeDelete(bId);
    // thêm char 'X' sau 'a' ở replica s1
    const insState = createState();
    applyOps(insState, ops); // để tính op đúng after
    const { op: insX } = makeInsert(
      insState,
      'B',
      (ops[0] as { id: [string, number] }).id,
      'X',
    );

    // Thứ tự 1: insert first, delete second
    const r1 = createState();
    applyOps(r1, [...ops, insX, delOp]);

    // Thứ tự 2: delete first, insert second
    const r2 = createState();
    applyOps(r2, [...ops, delOp, insX]);

    expect(toText(r1)).toBe(toText(r2));
  });
});

describe('RGA CRDT — concurrent convergence', () => {
  it('2 actors insert cạnh tranh cùng vị trí → cả 2 replicas hội tụ', () => {
    // State ban đầu: "X" do actor A insert.
    const base = createState();
    const { op: xOp, id: xId } = makeInsert(base, 'A', null, 'X');
    applyOp(base, xOp);

    // Replica 1: A insert 'L' sau X
    const r1 = createState();
    applyOp(r1, xOp);
    const { op: lOp } = makeInsert(r1, 'A', xId, 'L');
    applyOp(r1, lOp);

    // Replica 2: B insert 'R' sau X (concurrent, không thấy lOp)
    const r2 = createState();
    applyOp(r2, xOp);
    const { op: rOp } = makeInsert(r2, 'B', xId, 'R');
    applyOp(r2, rOp);

    // Merge: r1 ← rOp, r2 ← lOp
    applyOp(r1, rOp);
    applyOp(r2, lOp);

    // Cả 2 replicas phải ra cùng 1 chuỗi (deterministic order).
    expect(toText(r1)).toBe(toText(r2));
    // Chuỗi hội tụ phải chứa cả L và R, độ dài 3.
    expect(toText(r1)).toHaveLength(3);
    expect(toText(r1).startsWith('X')).toBe(true);
  });

  it('tie-break clock desc → insert sau đẩy char cũ sang phải', () => {
    // A insert X, rồi A insert Y sau X. Y clock > X clock.
    // Nhưng nếu B cũng insert Z sau X với clock cao hơn Y
    // → Z phải đứng trước Y trong render (clock desc).
    const state = createState();
    const { op: xOp, id: xId } = makeInsert(state, 'A', null, 'X');
    applyOp(state, xOp);
    const { op: yOp } = makeInsert(state, 'A', xId, 'Y');
    applyOp(state, yOp);
    // Y hiện có clock 1. Tạo op Z với clock 5 (giả lập nhận từ
    // remote actor B đã gõ nhiều hơn).
    const zOp: Op = { kind: 'ins', id: ['B', 5], ch: 'Z', after: xId };
    applyOp(state, zOp);
    // Clock desc: Z (5) đứng trước Y (1).
    expect(toText(state)).toBe('XZY');
  });

  it('tie-break cùng clock → actor asc', () => {
    const state = createState();
    const { op: xOp, id: xId } = makeInsert(state, 'A', null, 'X');
    applyOp(state, xOp);
    // Hai op cùng clock 9, khác actor — actor 'A' asc đứng trước 'Z'.
    applyOp(state, { kind: 'ins', id: ['Z', 9], ch: 'z', after: xId });
    applyOp(state, { kind: 'ins', id: ['A', 9], ch: 'a', after: xId });
    expect(toText(state)).toBe('Xaz');
  });
});

describe('RGA CRDT — serialize/deserialize roundtrip', () => {
  it('serialize → deserialize ra state tương đương (toText giống)', () => {
    const s = createState();
    makeInsertString(s, 'A', null, 'Hello');
    const { ops } = makeInsertString(s, 'B', null, 'World');
    const firstId = (ops[0] as { id: [string, number] }).id;
    applyOp(s, makeDelete(firstId)); // xoá 'W' của 'World'
    const doc = serialize(s);
    const restored = deserialize(doc);
    expect(toText(restored)).toBe(toText(s));
    expect(restored.nextClock).toBe(s.nextClock);
  });

  it('serialize shape có version=1 và nodes array', () => {
    const s = createState();
    makeInsertString(s, 'A', null, 'Hi');
    const doc = serialize(s);
    expect(doc.version).toBe(1);
    expect(Array.isArray(doc.nodes)).toBe(true);
    expect(doc.nodes.length).toBe(2);
  });
});
