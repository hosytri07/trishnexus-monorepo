# TrishTEAM Phase-Ship Workflow

**Use this skill when:** finishing a phase/sub-phase task in the TrishTEAM monorepo
(`#73-#80`-style Phase 1.x tasks, Phase 2+ future tasks, B.x packaging tasks,
Phase 13.x design-refresh tasks, any ROADMAP.md phase checkbox). Triggers
include: "Phase X.Y complete", "task #NN finished", "ship the SSO handler",
"finalize the login dialog", or when the user says "tiếp tục công việc" /
"continue" after having written new code in `apps/`, `shared/trishteam_core/`,
`functions/`, or `website/`.

**Do not use for:** standalone bug fixes with no phase, exploratory spikes,
rename-refactors that don't ship new behavior, pure doc edits.

## Philosophy

TrishTEAM ships in phases. The user's principle is **"tốt, đầy đủ, ổn định mà
ko có lỗi"** — complete, stable, no errors — which means: every phase that
closes must be buildable, smoke-testable, documented, and the docs must match
what was actually shipped (not what was planned). This skill encodes the
rhythm that's worked for Phase 1.1–1.8 so future phases inherit it without
re-deriving.

The rhythm is additive, not destructive:
1. Build new modules alongside old ones.
2. Smoke-test headless before hand-off.
3. Update docs to describe what the code actually does (not aspirations).
4. Tick the ROADMAP / task list last.

This matches `huashu-article-edit`'s "read all → list changes → confirm →
report per chunk" discipline for high-risk doc edits, and `superpowers`'s
finishing-branch pattern adapted for a solo-dev + agent setup.

## Invariants (always true when a phase ships)

- `py_compile` passes on every modified `.py` file.
- `npm --prefix functions run build` passes if `functions/**/*.ts` changed.
- Smoke-test command in the app's README runs headlessly
  (`QT_QPA_PLATFORM=offscreen python -m <app>.app --smoke`) without traceback.
- `docs/AUTH.md` / `docs/ROADMAP.md` / `docs/DESIGN.md` (pick relevant ones)
  reflect the real shipped code, not spec-only language.
- No placeholder `TODO(phase-ship)` comments left in new code — either
  resolve or file a new Task.
- Task status updated via TaskUpdate (in_progress → completed).

## Workflow

### Step 1 — Inventory what changed

Before any doc update, list the concrete deltas. Don't skip this — it's the
difference between "updated AUTH.md" (vague) and "updated §2.3, §4.1, §9.5 +
v0.4 changelog entry".

```
git status            # or equivalent — what files exist that didn't before
```

For each new/modified file, write one line: `<path> — <what it does>`.
Keep this list in working memory; you'll cite it in the AUTH.md update.

### Step 2 — Smoke-test headless

Every phase that touches Python app code must smoke-test:

```bash
cd apps/<appname>
QT_QPA_PLATFORM=offscreen python -m <appname>.app --smoke   # if --smoke exists
python -c "import <appname>.app"                             # fallback
python -m py_compile $(git diff --name-only HEAD~1 | grep '\.py$')
```

For Cloud Functions:

```bash
cd functions
npm run lint && npm run build && npm test
```

For shared core:

```bash
cd shared/trishteam_core
python -m py_compile $(find src -name '*.py')
python -c "import trishteam_core.auth.session"   # or the new submodule
```

If any step fails — **stop**. Fix before documenting. The phase isn't
shippable if smoke is red.

### Step 3 — Integration test (if applicable)

Phases that add new auth flows / IPC / deep links need an E2E test, even if
it's just a Python script under `tests/integration/`. Model after the
`tests/integration/test_auth_sso.py` pattern (Phase 1.8, task #80): mock the
network boundary, assert the observable state.

### Step 4 — Update docs to match shipped reality

Use the **incremental edit safety pattern** (`huashu-article-edit`-inspired):

1. Read the full doc file being edited (`Read` with no offset).
2. List the sections that need changes — e.g. "§2.3 param table, §4.1
   oneshot flow diagram, §9.5 cloud functions detail".
3. Apply changes one section at a time; after every 3–5 edits, re-read the
   file to verify nothing drifted.
4. Add a changelog entry at the bottom: `- vX.Y (YYYY-MM-DD) — what
   changed, task #NN`.

**Doc update checklist by scope:**

| Phase scope | Update |
|-------------|--------|
| Auth / session / SSO | `docs/AUTH.md` + changelog bump |
| UI / theme / widget | `docs/design-spec.md` + `docs/DESIGN.md` if visual delta |
| Packaging / installer | `docs/PACKAGING.md` |
| Registry / install worker | `docs/WEB-DESKTOP-PARITY.md` if parity-affecting |
| Cloud Functions | `functions/README.md` + `docs/AUTH.md §9` |
| Any | `docs/ROADMAP.md` — tick the phase checkbox, update status line |

### Step 5 — Update TaskList

```
TaskUpdate(taskId="NN", status="completed")
TaskList          # scan for follow-ups that became unblocked
```

If the phase surfaced a new issue too small to complete now but too real to
drop, `TaskCreate` it. Don't inline TODO comments in code for future-work —
tasks belong in TaskList, not in source.

### Step 6 — SESSION-HANDOFF note

Append one paragraph to `docs/SESSION-HANDOFF.md` describing:
- What shipped (phase # + task #).
- What to pick up next (the next pending task by ID).
- Any gotcha the next session shouldn't rediscover.

## Common pitfalls

- **Don't update AUTH.md with aspirations.** If a function is scaffolded but
  not tested, it doesn't exist yet in the doc. The whole point of "docs match
  shipped reality" is that future-Claude can trust AUTH.md as truth.
- **Don't tick ROADMAP before smoke.** Ticking before smoke means a failing
  state gets marked green and future-Claude re-discovers the failure cold.
- **Don't delete old code same-day.** When you refactor (e.g. `manager.py` →
  `firebase_client.py` + `session.py`), keep the old file as a thin re-export
  shim for one more phase, then delete. This protects any code that imported
  the old path without you knowing.
- **Don't skip py_compile on "trivial" edits.** A typo in an import statement
  inside a dead branch will still blow up when `python -m <app>` starts and
  parses the module tree.
- **Don't edit AUTH.md without Reading the full file first.** It's 500+ lines
  and sections reference each other. Blind edits break cross-refs.

## Anti-patterns from the repo history (learned the hard way)

- Phase 1.1 refactor almost shipped with `session.py` importing a symbol
  from `manager.py` that had been renamed — caught only by
  `python -c "import trishteam_core.auth.session"` smoke. Lesson: smoke the
  `import` path, not just `py_compile`.
- Phase 5 font-pack UI shipped with the emulator port still hardcoded to
  `localhost:8080` in a dev constant — made it to a staging build. Lesson:
  any `localhost` or port-number string in shipped code must be config-read.
- Phase 13.1 tokens.v2.json landed before `tokens.py` could consume it;
  had to add v1/v2 compat shim. Lesson: if you ship a new source-of-truth
  file, ship a reader in the same phase or explicitly document the reader
  lag and compat strategy.

## Reference

- Superpowers finishing-branch pattern: https://github.com/obra/superpowers
  (adapted for solo+agent, not PR-based)
- Huashu article-edit safety: https://github.com/alchaincyf/huashu-skills
  (`huashu-article-edit` — "read all → list changes → 3–5 per chunk").
- AUTH.md §9.5 (Cloud Functions reality) is the reference example of what
  "docs match shipped reality" looks like in this repo.
