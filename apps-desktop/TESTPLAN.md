# apps-desktop — Master TESTPLAN index

**Phase 14.5.3 · 2026-04-24**

Chỉ mục tổng các TESTPLAN.md cho 10 desktop app TrishTEAM — dùng khi Trí ngồi máy thật (Windows / macOS / Linux) chạy smoke test trước khi ship v2.0.0.

---

## Thứ tự chạy khuyến nghị

Chạy theo dev-port tăng dần, app **không cần login** trước (dễ test nhanh), app **cần login** sau:

| # | App | Port | Login | Test file |
|---|-----|------|-------|-----------|
| 1 | TrishLauncher | 1420 | không | [trishlauncher/TESTPLAN.md](./trishlauncher/TESTPLAN.md) |
| 2 | TrishCheck    | 1422 | không | [trishcheck/TESTPLAN.md](./trishcheck/TESTPLAN.md) |
| 3 | TrishClean    | 1424 | không | [trishclean/TESTPLAN.md](./trishclean/TESTPLAN.md) |
| 4 | TrishFont     | 1426 | không | [trishfont/TESTPLAN.md](./trishfont/TESTPLAN.md) |
| 5 | TrishType     | 1428 | không | [trishtype/TESTPLAN.md](./trishtype/TESTPLAN.md) |
| 6 | TrishImage    | 1430 | không | [trishimage/TESTPLAN.md](./trishimage/TESTPLAN.md) |
| 7 | TrishNote     | 1432 | **bắt buộc** (v2) / local-only (alpha) | [trishnote/TESTPLAN.md](./trishnote/TESTPLAN.md) |
| 8 | TrishLibrary  | 1434 | **bắt buộc** (v2) / local-only (alpha) | [trishlibrary/TESTPLAN.md](./trishlibrary/TESTPLAN.md) |
| 9 | TrishSearch   | 1436 | **bắt buộc** (v2) / local-only (alpha) | [trishsearch/TESTPLAN.md](./trishsearch/TESTPLAN.md) |
| 10 | TrishDesign   | 1438 | **bắt buộc** (v2) / local-only (alpha) | [trishdesign/TESTPLAN.md](./trishdesign/TESTPLAN.md) |

App alpha v2.0.0-alpha.1 toàn bộ **local-only** — Firebase sync đã wire sẵn ở website (Phase 11.6+) nhưng chưa pipe vào desktop — dời sub-phase `.b` tương ứng từng app.

---

## Quy trình smoke test tổng

### Bước 1 — Preflight

```bash
cd /path/to/trishnexus-monorepo
pnpm qa:all
```

Expected: `doctor 49 pass, 0 warn, 0 fail` + `rust-audit 24 pass, 0 warn, 0 fail`.
Nếu có fail → fix trước khi test — không chạy `cargo tauri dev`.

### Bước 2 — Build một lần (lần đầu)

Với mỗi app, lần đầu `cargo tauri dev` sẽ compile ~3-10 phút (tùy CPU). Rebuild sau đó ~10-30 s.

```bash
cd apps-desktop/trishlauncher
cargo tauri dev
# chờ compile → window bật → chạy smoke test theo TESTPLAN.md
# Ctrl+C để stop
cd ../trishcheck
cargo tauri dev
# ...
```

### Bước 3 — Chạy checklist

Mỗi file TESTPLAN.md có 6 section:
1. **Tiền đề** — kiểm chuẩn bị trước khi chạy
2. **Smoke test** — step-by-step, tick khi pass
3. **Kết quả mong đợi** — acceptance criteria
4. **Cleanup** — hướng dẫn dọn data dir sau test
5. **Platform-specific notes** — lưu ý riêng Windows/macOS/Linux
6. **Giới hạn v1** — tính năng CHƯA có (không test, không bug report)

### Bước 4 — Bug report

Khi phát hiện lỗi, tạo file `BUGS-14.5.3.md` ở `docs/` theo format:

```markdown
## BUG <yyyy-mm-dd> #<N>
- **App:** trishnote
- **Bước:** 7 (Kanban DnD)
- **OS:** Windows 11 23H2
- **Expected:** Kéo note từ inbox → active, status update + updatedAt refresh
- **Actual:** DnD ghost image lệch, note bị duplicate ở 2 lane sau thả
- **Log:** DevTools console có `TypeError: cannot read 'status' of undefined` tại handleDrop:42
- **Screenshot:** <link>
```

### Bước 5 — Fix + re-test

Mỗi bug fix → tạo sub-phase `.b` / `.c` tương ứng app đó → sync ROADMAP + CHANGELOG → re-run TESTPLAN ở bước bị lỗi.

Khi tất cả 10 app đều pass toàn bộ TESTPLAN → đánh dấu Phase 14.5.3 ✅ trong ROADMAP → chuyển sang Phase 14.6 (Release v2.0.0 bundle installer).

---

## Criteria chấp nhận ship v2.0.0-alpha

- [ ] 10/10 app chạy `cargo tauri dev` không lỗi compile
- [ ] 10/10 app render UI tree đầu tiên ≤ 5 s rebuild
- [ ] 10/10 app smoke test pass (mục 2 trong từng TESTPLAN)
- [ ] 0 DevTools console error đỏ ở trạng thái idle
- [ ] Memory resident < 500 MB (mỗi app độc lập)
- [ ] `pnpm qa:all` pass 100%
- [ ] `vitest run packages/core` pass 421/421
- [ ] Không app nào ghi ra ngoài data dir của chính nó (test bằng Process Monitor Windows / `opensnoop` macOS / `strace` Linux)
- [ ] Không app nào phát request HTTP ở trạng thái offline

---

## Tham khảo

- [`docs/ROADMAP.md`](../docs/ROADMAP.md) — Phase 14.5 section
- [`scripts/qa/README.md`](../scripts/qa/README.md) — QA tools (doctor + rust-audit + gen-icons)
- [`docs/CHANGELOG.md`](../docs/CHANGELOG.md) — section Phase 14.5.1 / 14.5.2 / 14.5.3
