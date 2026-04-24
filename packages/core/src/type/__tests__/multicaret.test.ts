import { describe, it, expect } from 'vitest';
import { createState, makeInsertString, toText } from '../crdt.js';
import {
  typeAtCarets,
  backspaceAtCarets,
  caretAtIndex,
  indexToAfter,
  afterToIndex,
} from '../multicaret.js';

describe('typeAtCarets — multi-caret insert', () => {
  it('gõ "x" tại 3 caret sau "ABC" ra "xAxBxC"', () => {
    const state = createState();
    const { ops } = makeInsertString(state, 'A', null, 'ABC');
    // Carets đứng ngay TRƯỚC mỗi char → anchorAfter = prev char
    // (hoặc null cho caret đầu).
    const caretBeforeA = caretAtIndex(state, 'U', 0, 'c1');
    const caretBeforeB = caretAtIndex(state, 'U', 1, 'c2');
    const caretBeforeC = caretAtIndex(state, 'U', 2, 'c3');

    const result = typeAtCarets(
      state,
      [caretBeforeA, caretBeforeB, caretBeforeC],
      'x',
      'U',
    );
    expect(ops.length).toBe(3);
    expect(result.ops.length).toBe(3);
    expect(toText(state)).toBe('xAxBxC');
  });

  it('caret sau khi gõ advance sang char vừa gõ', () => {
    const state = createState();
    makeInsertString(state, 'A', null, 'AB');
    const caret = caretAtIndex(state, 'U', 1, 'c1'); // giữa A và B
    const before = caret.anchorAfter;
    const result = typeAtCarets(state, [caret], 'x', 'U');
    expect(toText(state)).toBe('AxB');
    const newAnchor = result.carets[0]!.anchorAfter;
    expect(newAnchor).not.toBeNull();
    expect(newAnchor).not.toEqual(before);
  });

  it('gõ chuỗi ký tự liên tục tại 1 caret → caret bám theo', () => {
    const state = createState();
    let caret = caretAtIndex(state, 'U', 0);
    for (const ch of 'hello') {
      const r = typeAtCarets(state, [caret], ch, 'U');
      caret = r.carets[0]!;
    }
    expect(toText(state)).toBe('hello');
  });
});

describe('backspaceAtCarets', () => {
  it('xoá char ngay trước caret, caret lùi về char trước đó', () => {
    const state = createState();
    makeInsertString(state, 'A', null, 'abc');
    const caret = caretAtIndex(state, 'U', 3); // cuối text
    const r = backspaceAtCarets(state, [caret]);
    expect(toText(state)).toBe('ab');
    expect(r.carets[0]!.anchorAfter).not.toBeNull();
    // anchor giờ là 'b' (char cuối còn lại)
    expect(afterToIndex(state, r.carets[0]!.anchorAfter)).toBe(2);
  });

  it('caret ở đầu doc (anchorAfter=null) → skip, không xoá gì', () => {
    const state = createState();
    makeInsertString(state, 'A', null, 'abc');
    const caret = caretAtIndex(state, 'U', 0);
    expect(caret.anchorAfter).toBeNull();
    const r = backspaceAtCarets(state, [caret]);
    expect(r.ops.length).toBe(0);
    expect(toText(state)).toBe('abc');
    expect(r.carets[0]!.anchorAfter).toBeNull();
  });

  it('xoá char đầu tiên → anchorAfter về null (đầu doc)', () => {
    const state = createState();
    makeInsertString(state, 'A', null, 'abc');
    const caret = caretAtIndex(state, 'U', 1); // sau 'a'
    const r = backspaceAtCarets(state, [caret]);
    expect(toText(state)).toBe('bc');
    expect(r.carets[0]!.anchorAfter).toBeNull();
  });

  it('multi-caret backspace — 3 carets cuối mỗi word xoá 3 char', () => {
    const state = createState();
    makeInsertString(state, 'A', null, 'abcdef');
    const c1 = caretAtIndex(state, 'U', 2, 'c1'); // sau 'b'
    const c2 = caretAtIndex(state, 'U', 4, 'c2'); // sau 'd'
    const c3 = caretAtIndex(state, 'U', 6, 'c3'); // sau 'f'
    const r = backspaceAtCarets(state, [c1, c2, c3]);
    expect(r.ops.length).toBe(3);
    expect(toText(state)).toBe('ace');
  });
});

describe('caretAtIndex / indexToAfter / afterToIndex', () => {
  it('caretAtIndex(0) → anchorAfter=null', () => {
    const state = createState();
    makeInsertString(state, 'A', null, 'abc');
    const c = caretAtIndex(state, 'U', 0);
    expect(c.anchorAfter).toBeNull();
  });

  it('caretAtIndex(N) clamp về length', () => {
    const state = createState();
    makeInsertString(state, 'A', null, 'abc');
    const c = caretAtIndex(state, 'U', 999);
    // Vẫn phải ra caret hợp lệ, anchor vào char cuối.
    expect(c.anchorAfter).not.toBeNull();
    expect(afterToIndex(state, c.anchorAfter)).toBe(3);
  });

  it('caretAtIndex(negative) clamp về 0', () => {
    const state = createState();
    makeInsertString(state, 'A', null, 'abc');
    const c = caretAtIndex(state, 'U', -5);
    expect(c.anchorAfter).toBeNull();
  });

  it('indexToAfter + afterToIndex roundtrip', () => {
    const state = createState();
    makeInsertString(state, 'A', null, 'hello');
    for (let i = 0; i <= 5; i++) {
      const after = indexToAfter(state, i);
      expect(afterToIndex(state, after)).toBe(i);
    }
  });

  it('afterToIndex với anchor không tồn tại → 0 (fallback)', () => {
    const state = createState();
    makeInsertString(state, 'A', null, 'abc');
    // CharId bịa không có trong state
    const fake: readonly [string, number] = ['Z', 999];
    expect(afterToIndex(state, fake)).toBe(0);
  });
});
