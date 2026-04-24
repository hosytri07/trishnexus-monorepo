"""Tests cho theme_manager — persist + switch + signal.

Phase 13.5 (2026-04-23): rút 7 theme xuống 2 (dark + light). Tests thêm
alias resolver (persist file cũ 'trishwarm' → 'dark').
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from trishteam_core.ui import theme_registry
from trishteam_core.ui.theme_manager import ThemeManager


MINI_TOKENS = {
    "default_theme": "dark",
    "themes": {
        "dark": {
            "label": "Tối (Dark)", "description": "", "mode": "dark",
            "color": {
                "accent": {"primary": "#667EEA", "secondary": "#764BA2"},
                "surface": {"bg": "#0f0e0c", "bg_elevated": "#1a1814"},
                "text": {"primary": "#f5f2ed"},
                "border": {"focus": "#667EEA"},
            },
        },
        "light": {
            "label": "Sáng (Light)", "description": "", "mode": "light",
            "color": {
                "accent": {"primary": "#667EEA", "secondary": "#764BA2"},
                "surface": {"bg": "#f7f6f3", "bg_elevated": "#ffffff"},
                "text": {"primary": "#1a1814"},
                "border": {"focus": "#667EEA"},
            },
        },
    },
    "theme_aliases": {
        "trishwarm": "dark",
        "midnight":  "dark",
        "candy":     "light",
    },
}


@pytest.fixture(autouse=True)
def mini_setup(tmp_path: Path, monkeypatch):
    """Every test: mini tokens + isolated persist dir + fresh singleton."""
    tokens = tmp_path / "tokens.v2.json"
    tokens.write_text(json.dumps(MINI_TOKENS), encoding="utf-8")
    monkeypatch.setenv("TRISHTEAM_TOKENS_PATH", str(tokens))

    config_dir = tmp_path / "config"
    monkeypatch.setenv("TRISHTEAM_THEME_CONFIG_DIR", str(config_dir))

    theme_registry._reset_cache_for_tests()
    yield
    theme_registry._reset_cache_for_tests()


@pytest.fixture
def mgr() -> ThemeManager:
    """Fresh ThemeManager — không dùng singleton module để mỗi test độc lập."""
    return ThemeManager()


# ---------- init ----------

class TestInit:
    def test_init_without_persist_returns_default(self, mgr):
        applied = mgr.init()
        assert applied == "dark"
        assert mgr.current == "dark"

    def test_init_with_valid_persist_uses_persisted(self, mgr, tmp_path):
        persist = tmp_path / "config" / "theme.json"
        persist.parent.mkdir(parents=True)
        persist.write_text(json.dumps({"theme": "light"}))
        applied = mgr.init()
        assert applied == "light"

    def test_init_with_corrupt_persist_falls_back_default(self, mgr, tmp_path):
        persist = tmp_path / "config" / "theme.json"
        persist.parent.mkdir(parents=True)
        persist.write_text("not-json{{{")
        applied = mgr.init()
        assert applied == "dark"

    def test_init_with_unknown_persisted_theme_falls_back(self, mgr, tmp_path):
        persist = tmp_path / "config" / "theme.json"
        persist.parent.mkdir(parents=True)
        persist.write_text(json.dumps({"theme": "nonexistent"}))
        applied = mgr.init()
        assert applied == "dark"

    def test_init_with_fallback_param_overrides_default(self, mgr):
        # Không có persist → fallback được honor
        applied = mgr.init(fallback="light")
        assert applied == "light"

    def test_init_fallback_ignored_when_persist_exists(self, mgr, tmp_path):
        persist = tmp_path / "config" / "theme.json"
        persist.parent.mkdir(parents=True)
        persist.write_text(json.dumps({"theme": "light"}))
        applied = mgr.init(fallback="dark")
        assert applied == "light"


# ---------- Alias (Phase 13.5 backward compat) ----------

class TestInitWithLegacyAlias:
    """Persist file cũ (trước Phase 13.5) có thể chứa 'trishwarm'/'candy'
    — init phải auto-resolve sang 'dark'/'light', không fallback về default."""

    def test_legacy_trishwarm_maps_to_dark(self, mgr, tmp_path):
        persist = tmp_path / "config" / "theme.json"
        persist.parent.mkdir(parents=True)
        persist.write_text(json.dumps({"theme": "trishwarm"}))
        applied = mgr.init()
        assert applied == "dark"

    def test_legacy_candy_maps_to_light(self, mgr, tmp_path):
        persist = tmp_path / "config" / "theme.json"
        persist.parent.mkdir(parents=True)
        persist.write_text(json.dumps({"theme": "candy"}))
        applied = mgr.init()
        assert applied == "light"

    def test_legacy_midnight_maps_to_dark(self, mgr, tmp_path):
        persist = tmp_path / "config" / "theme.json"
        persist.parent.mkdir(parents=True)
        persist.write_text(json.dumps({"theme": "midnight"}))
        applied = mgr.init()
        assert applied == "dark"

    def test_set_theme_with_alias_persists_canonical(self, mgr, tmp_path):
        """set_theme('trishwarm') → persist 'dark' (canonical), không phải 'trishwarm'.

        Init sang 'light' trước để set_theme('trishwarm'→'dark') thực sự đổi
        và trigger persist (nếu init default đã là 'dark' thì set_theme
        trùng value sẽ early-return không ghi file).
        """
        mgr.init(fallback="light")
        assert mgr.current == "light"
        mgr.set_theme("trishwarm")
        assert mgr.current == "dark"
        persist = tmp_path / "config" / "theme.json"
        data = json.loads(persist.read_text())
        assert data["theme"] == "dark"


# ---------- set_theme ----------

class TestSetTheme:
    def test_set_theme_updates_current(self, mgr):
        mgr.init()
        changed = mgr.set_theme("light")
        assert changed is True
        assert mgr.current == "light"

    def test_set_theme_same_value_returns_false(self, mgr):
        mgr.init()
        assert mgr.set_theme("dark") is False
        assert mgr.current == "dark"

    def test_set_theme_unknown_raises(self, mgr):
        mgr.init()
        with pytest.raises(theme_registry.ThemeError) as exc:
            mgr.set_theme("ghost")
        assert exc.value.code == "unknown_theme"

    def test_set_theme_persists_to_file(self, mgr, tmp_path):
        mgr.init()
        mgr.set_theme("light")
        persist = tmp_path / "config" / "theme.json"
        assert persist.is_file()
        data = json.loads(persist.read_text())
        assert data["theme"] == "light"

    def test_set_theme_persist_false_skips_write(self, mgr, tmp_path):
        mgr.init()
        mgr.set_theme("light", persist=False)
        persist = tmp_path / "config" / "theme.json"
        assert not persist.exists()


# ---------- Signal ----------

class TestSignal:
    def test_theme_changed_signal_fires_on_switch(self, mgr):
        received: list[str] = []
        mgr.init()
        mgr.theme_changed.connect(received.append)
        mgr.set_theme("light")
        assert received == ["light"]

    def test_theme_changed_silent_on_same_value(self, mgr):
        received: list[str] = []
        mgr.init()
        mgr.theme_changed.connect(received.append)
        mgr.set_theme("dark")  # same as default
        assert received == []

    def test_multiple_switches_emit_sequence(self, mgr):
        received: list[str] = []
        mgr.init()
        mgr.theme_changed.connect(received.append)
        mgr.set_theme("light")
        mgr.set_theme("dark")
        mgr.set_theme("light")
        assert received == ["light", "dark", "light"]


# ---------- Apply to target ----------

class TestApplyToTarget:
    def test_apply_sets_stylesheet_on_stub(self, mgr):
        class StubApp:
            def __init__(self):
                self.qss = ""

            def setStyleSheet(self, qss: str) -> None:
                self.qss = qss

        mgr.init()
        target = StubApp()
        mgr.apply(target)
        assert "theme: dark" in target.qss

    def test_set_theme_with_target_applies_immediately(self, mgr):
        class StubApp:
            def __init__(self):
                self.qss = ""

            def setStyleSheet(self, qss: str) -> None:
                self.qss = qss

        mgr.init()
        target = StubApp()
        mgr.set_theme("light", target=target)
        assert "theme: light" in target.qss

    def test_set_theme_same_value_with_target_still_applies(self, mgr):
        """Reapply stylesheet dù key không đổi — dùng cho reload-after-init."""
        class StubApp:
            def __init__(self):
                self.qss = ""

            def setStyleSheet(self, qss: str) -> None:
                self.qss = qss

        mgr.init()
        target = StubApp()
        assert mgr.set_theme("dark", target=target) is False
        assert "theme: dark" in target.qss


# ---------- list_themes pass-through ----------

class TestListThemes:
    def test_lists_exactly_two_themes(self, mgr):
        pairs = mgr.list_themes()
        keys = [k for k, _ in pairs]
        assert set(keys) == {"dark", "light"}


# ---------- Persist failure tolerance ----------

class TestPersistFailure:
    def test_unwritable_dir_does_not_crash(self, mgr, monkeypatch, tmp_path):
        """Giả lập OSError khi save → vẫn đổi theme in-memory, không raise."""
        from trishteam_core.ui import theme_manager as tm

        def fake_save(_k):
            return False

        monkeypatch.setattr(tm, "_save_persisted", fake_save)
        mgr.init()
        mgr.set_theme("light")  # không raise
        assert mgr.current == "light"
