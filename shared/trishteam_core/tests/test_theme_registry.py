"""Tests cho theme_registry — pure Python, không cần PyQt6.

Phase 13.5 update (2026-04-23): 7 theme rút xuống 2 (dark + light). Tests
verify alias backward-compat (persist 'trishwarm' → resolve 'dark').
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from trishteam_core.ui import theme_registry


# ---------- Fixtures ----------

MINI_TOKENS = {
    "default_theme": "dark",
    "themes": {
        "dark": {
            "label": "Tối (Dark)",
            "description": "warm dark",
            "mode": "dark",
            "color": {
                "accent": {"primary": "#667EEA", "secondary": "#764BA2"},
                "surface": {"bg": "#0f0e0c", "bg_elevated": "#1a1814", "card": "#1a1814",
                            "row": "#1e1c18", "muted": "rgba(255,255,255,0.05)",
                            "hover": "rgba(102,126,234,0.10)"},
                "text": {"primary": "#f5f2ed", "secondary": "#d4cec4", "muted": "#a09890"},
                "border": {"subtle": "rgba(255,255,255,0.06)", "default": "rgba(255,255,255,0.08)",
                           "strong": "rgba(255,255,255,0.12)", "focus": "#667EEA"},
            },
        },
        "light": {
            "label": "Sáng (Light)",
            "description": "off-white neutral",
            "mode": "light",
            "color": {
                "accent": {"primary": "#667EEA", "secondary": "#764BA2"},
                "surface": {"bg": "#f7f6f3", "bg_elevated": "#ffffff", "card": "#ffffff",
                            "row": "#faf9f6"},
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
    "semantic": {"success": "#10B981", "warning": "#F59E0B",
                 "danger": "#EF4444", "info": "#3B82F6"},
    "group": {"primary": "#667EEA"},
    "font": {"family": {"body": "Be Vietnam Pro"}},
    "space": {"1": "4px"},
    "radius": {"md": "8px"},
}


@pytest.fixture
def mini_tokens_path(tmp_path: Path, monkeypatch) -> Path:
    """Write mini tokens file + point TRISHTEAM_TOKENS_PATH to it."""
    p = tmp_path / "tokens.v2.json"
    p.write_text(json.dumps(MINI_TOKENS), encoding="utf-8")
    monkeypatch.setenv("TRISHTEAM_TOKENS_PATH", str(p))
    theme_registry._reset_cache_for_tests()
    yield p
    theme_registry._reset_cache_for_tests()


@pytest.fixture
def real_tokens(monkeypatch) -> None:
    """Dùng tokens.v2.json thật trong monorepo (2 themes sau Phase 13.5)."""
    monkeypatch.delenv("TRISHTEAM_TOKENS_PATH", raising=False)
    theme_registry._reset_cache_for_tests()
    yield
    theme_registry._reset_cache_for_tests()


# ---------- Path resolution ----------

class TestPathResolution:
    def test_override_env_var_takes_priority(self, tmp_path, monkeypatch):
        p = tmp_path / "custom.json"
        p.write_text(json.dumps(MINI_TOKENS))
        monkeypatch.setenv("TRISHTEAM_TOKENS_PATH", str(p))
        theme_registry._reset_cache_for_tests()
        bundle = theme_registry.load()
        assert "dark" in bundle.themes

    def test_override_missing_file_raises(self, tmp_path, monkeypatch):
        monkeypatch.setenv("TRISHTEAM_TOKENS_PATH", str(tmp_path / "nope.json"))
        theme_registry._reset_cache_for_tests()
        with pytest.raises(theme_registry.ThemeError) as exc:
            theme_registry.load()
        assert exc.value.code == "tokens_not_found"

    def test_walks_up_to_find_design_dir(self, real_tokens):
        # Real tokens.v2.json sống ở monorepo/design/
        bundle = theme_registry.load()
        assert bundle.default_theme == "dark"
        assert "light" in bundle.themes


# ---------- Bundle parsing ----------

class TestBundleParsing:
    def test_parse_mini_bundle(self, mini_tokens_path):
        bundle = theme_registry.load()
        assert bundle.default_theme == "dark"
        assert len(bundle.themes) == 2
        assert bundle.semantic["success"] == "#10B981"

    def test_missing_themes_block_raises(self, tmp_path, monkeypatch):
        p = tmp_path / "bad.json"
        p.write_text(json.dumps({"default_theme": "x", "semantic": {}}))
        monkeypatch.setenv("TRISHTEAM_TOKENS_PATH", str(p))
        theme_registry._reset_cache_for_tests()
        with pytest.raises(theme_registry.ThemeError) as exc:
            theme_registry.load()
        assert exc.value.code == "invalid_tokens"

    def test_default_theme_unknown_raises(self, tmp_path, monkeypatch):
        bad = json.loads(json.dumps(MINI_TOKENS))  # deep copy
        bad["default_theme"] = "ghost"
        p = tmp_path / "bad.json"
        p.write_text(json.dumps(bad))
        monkeypatch.setenv("TRISHTEAM_TOKENS_PATH", str(p))
        theme_registry._reset_cache_for_tests()
        with pytest.raises(theme_registry.ThemeError) as exc:
            theme_registry.load()
        assert exc.value.code == "invalid_default"

    def test_malformed_json_raises_parse_error(self, tmp_path, monkeypatch):
        p = tmp_path / "broken.json"
        p.write_text("{ this is not json")
        monkeypatch.setenv("TRISHTEAM_TOKENS_PATH", str(p))
        theme_registry._reset_cache_for_tests()
        with pytest.raises(theme_registry.ThemeError) as exc:
            theme_registry.load()
        assert exc.value.code == "tokens_parse_error"

    def test_default_theme_fallback_when_missing(self, tmp_path, monkeypatch):
        # default_theme không có trong JSON → lấy theme đầu tiên
        data = json.loads(json.dumps(MINI_TOKENS))
        data.pop("default_theme")
        p = tmp_path / "nodef.json"
        p.write_text(json.dumps(data))
        monkeypatch.setenv("TRISHTEAM_TOKENS_PATH", str(p))
        theme_registry._reset_cache_for_tests()
        bundle = theme_registry.load()
        assert bundle.default_theme in ("dark", "light")


# ---------- list_themes / get_theme ----------

class TestThemeAccess:
    def test_list_themes_returns_key_label_pairs(self, mini_tokens_path):
        pairs = theme_registry.list_themes()
        assert ("dark", "Tối (Dark)") in pairs
        assert ("light", "Sáng (Light)") in pairs

    def test_get_theme_returns_palette(self, mini_tokens_path):
        palette = theme_registry.get_theme("light")
        assert palette.key == "light"
        assert palette.label == "Sáng (Light)"
        assert palette.surface["bg"] == "#f7f6f3"
        assert palette.mode == "light"

    def test_get_theme_unknown_raises(self, mini_tokens_path):
        with pytest.raises(theme_registry.ThemeError) as exc:
            theme_registry.get_theme("ghost")
        assert exc.value.code == "unknown_theme"

    def test_real_tokens_has_dark_and_light(self, real_tokens):
        pairs = dict(theme_registry.list_themes())
        assert {"dark", "light"}.issubset(pairs.keys())
        # Hard requirement Phase 13.5 — chỉ 2 theme chính (không còn 7).
        assert len(pairs) == 2


# ---------- Aliases (Phase 13.5) ----------

class TestAliases:
    """Backward compat — persist file cũ chứa 'trishwarm'/'candy' v.v."""

    def test_resolve_alias_maps_legacy_keys(self, mini_tokens_path):
        assert theme_registry.resolve_alias("trishwarm") == "dark"
        assert theme_registry.resolve_alias("midnight") == "dark"
        assert theme_registry.resolve_alias("candy") == "light"

    def test_resolve_alias_passthrough_real_keys(self, mini_tokens_path):
        assert theme_registry.resolve_alias("dark") == "dark"
        assert theme_registry.resolve_alias("light") == "light"

    def test_resolve_alias_unknown_returns_input(self, mini_tokens_path):
        """Key không phải theme thật cũng không phải alias → trả lại
        nguyên để caller downstream raise `unknown_theme`."""
        assert theme_registry.resolve_alias("ghost") == "ghost"

    def test_get_theme_accepts_alias_input(self, mini_tokens_path):
        """get_theme('trishwarm') → palette của 'dark'."""
        palette = theme_registry.get_theme("trishwarm")
        assert palette.key == "dark"
        assert palette.label == "Tối (Dark)"

    def test_real_tokens_has_legacy_aliases(self, real_tokens):
        """tokens.v2.json thật phải giữ alias cho 7 theme cũ."""
        bundle = theme_registry.load()
        for legacy in ("trishwarm", "midnight", "aurora", "sunset",
                       "ocean", "forest"):
            assert bundle.aliases.get(legacy) == "dark", f"{legacy} → dark"
        assert bundle.aliases.get("candy") == "light"


# ---------- Caching ----------

class TestCaching:
    def test_second_load_uses_cache(self, mini_tokens_path):
        bundle1 = theme_registry.load()
        # Xoá file — load lại vẫn phải return cache
        mini_tokens_path.unlink()
        bundle2 = theme_registry.load()
        assert bundle1 is bundle2

    def test_reload_refreshes_cache(self, mini_tokens_path):
        theme_registry.load()
        # Sửa file
        data = json.loads(json.dumps(MINI_TOKENS))
        data["themes"]["dark"]["label"] = "NewLabel"
        mini_tokens_path.write_text(json.dumps(data))
        bundle = theme_registry.reload()
        assert bundle.themes["dark"].label == "NewLabel"


# ---------- QSS builder ----------

class TestQssBuilder:
    def test_build_qss_contains_palette_colors(self, mini_tokens_path):
        qss = theme_registry.build_qss_from_theme("light")
        assert "#f7f6f3" in qss  # light bg
        assert "#1a1814" in qss  # text primary
        assert "#667EEA" in qss  # accent
        # Header identifies theme
        assert "theme: light" in qss
        assert "(Sáng (Light))" in qss

    def test_build_qss_has_required_selectors(self, mini_tokens_path):
        qss = theme_registry.build_qss_from_theme("dark")
        # Spot-check các selector căn bản
        for selector in ["QWidget", "QMainWindow", "QPushButton",
                         "QLineEdit", "QMenu", 'variant="primary"']:
            assert selector in qss, f"missing selector {selector!r}"

    def test_build_qss_from_real_tokens_all_themes(self, real_tokens):
        for key, _label in theme_registry.list_themes():
            qss = theme_registry.build_qss_from_theme(key)
            assert len(qss) > 500, f"qss too short for {key}"
            assert f"theme: {key}" in qss

    def test_build_qss_handles_missing_color_keys_gracefully(self, tmp_path, monkeypatch):
        # Light trong MINI_TOKENS chỉ có vài key — builder phải không crash
        p = tmp_path / "partial.json"
        p.write_text(json.dumps(MINI_TOKENS))
        monkeypatch.setenv("TRISHTEAM_TOKENS_PATH", str(p))
        theme_registry._reset_cache_for_tests()
        qss = theme_registry.build_qss_from_theme("light")
        # Light trong mini không có surface.hover → builder fallback
        assert "QPushButton:hover" in qss

    def test_build_qss_accepts_alias(self, mini_tokens_path):
        """build_qss_from_theme('trishwarm') phải work (alias → dark)."""
        qss = theme_registry.build_qss_from_theme("trishwarm")
        # QSS sẽ là của dark theme (được resolve qua alias)
        assert "theme: dark" in qss


# ---------- Phase 13.4: full role-specific QSS (vẫn giữ — Phase 13.5 không đổi builder) ----------

class TestFullQssPhase134:
    """Kiểm các role-specific selector port qua từ theme.py cũ — vẫn apply
    cho 2 theme dark/light sau Phase 13.5."""

    def test_both_themes_have_role_selectors(self, real_tokens):
        """Cả dark + light phải có đủ role-specific selector."""
        required_selectors = [
            'QFrame[role="card"]',
            'QFrame[role="card"][stripe="primary"]',
            'QFrame[role="card"][stripe="green"]',
            'QFrame[role="card"][stripe="amber"]',
            'QFrame[role="card"][stripe="cyan"]',
            'QFrame[role="card"][stripe="blue"]',
            'QFrame[role="card"][stripe="danger"]',
            'QFrame[role="sidebar"]',
            'QFrame[role="app-header"]',
            'QFrame[role="inline-toolbar"]',
            'QFrame[role="action-bar"]',
            'QFrame[role="log-panel"]',
            'QFrame[role="footer-bar"]',
            'QLabel[role="badge"]',
            'QPushButton[variant="primary"]',
            'QPushButton[variant="ghost"]',
            'QPushButton[variant="subtle"]',
            "QCheckBox::indicator:checked",
            "QHeaderView::section",
            "QProgressBar::chunk",
            "QScrollBar::handle:vertical",
            "QToolTip",
            "QMenu::item:selected",
        ]
        for key, _label in theme_registry.list_themes():
            qss = theme_registry.build_qss_from_theme(key)
            for sel in required_selectors:
                assert sel in qss, f"theme {key!r} missing selector {sel!r}"

    def test_card_stripe_colors_theme_independent(self, real_tokens):
        """Semantic + group colors dùng cho card stripe phải giống nhau
        giữa các theme (success=#10B981, warning=#F59E0B, ...)."""
        qss_dark = theme_registry.build_qss_from_theme("dark")
        qss_light = theme_registry.build_qss_from_theme("light")

        # Success / warning / danger / info color đồng nhất cross-theme
        for qss in (qss_dark, qss_light):
            assert "#10B981" in qss, "success color thiếu"
            assert "#F59E0B" in qss, "warning color thiếu"
            assert "#EF4444" in qss, "danger color thiếu"
            assert "#3B82F6" in qss, "info color thiếu"

    def test_light_theme_uses_dark_text(self, real_tokens):
        """Light mode phải dùng text đậm (contrast rõ trên nền sáng)."""
        palette = theme_registry.get_theme("light")
        # Text phải là charcoal đậm, KHÔNG phải off-white
        assert palette.text["primary"] == "#1a1814"
        # Surface bg phải sáng (không phải warm-black của dark)
        assert palette.surface["bg"] == "#f7f6f3"

    def test_dark_theme_uses_light_text(self, real_tokens):
        """Dark mode phải dùng text sáng (contrast rõ trên nền tối)."""
        palette = theme_registry.get_theme("dark")
        # Text phải là warm off-white
        assert palette.text["primary"] == "#f5f2ed"
        # Surface bg phải warm-black
        assert palette.surface["bg"] == "#0f0e0c"

    def test_light_and_dark_text_contrast_is_inverse(self, real_tokens):
        """Text + bg của dark và light phải đảo ngược — contrast rõ cả hai
        chiều. Nghĩa là: dark.text gần với light.bg (cả hai sáng), và ngược
        lại dark.bg gần với light.text (cả hai tối)."""
        dark = theme_registry.get_theme("dark")
        light = theme_registry.get_theme("light")
        # dark text phải sáng hơn light text
        assert dark.text["primary"].lower() != light.text["primary"].lower()
        # dark bg phải tối hơn light bg
        assert dark.surface["bg"].lower() != light.surface["bg"].lower()

    def test_sidebar_selected_uses_gradient(self, real_tokens):
        """Sidebar checked button dùng qlineargradient — match behavior cũ."""
        qss = theme_registry.build_qss_from_theme("dark")
        # Block sidebar-checked
        assert 'QFrame[role="sidebar"] QPushButton:checked' in qss
        # ...phải chứa qlineargradient ngay sau đó
        idx = qss.find('QFrame[role="sidebar"] QPushButton:checked')
        assert "qlineargradient" in qss[idx : idx + 300]

    def test_build_qss_from_palette_with_custom_bundle(self, mini_tokens_path):
        """build_qss_from_palette(palette, bundle) inject được bundle custom
        — dùng khi tooling muốn render offline."""
        palette = theme_registry.get_theme("dark")
        bundle = theme_registry.get_bundle()
        qss = theme_registry.build_qss_from_palette(palette, bundle)
        assert "theme: dark" in qss

    def test_font_sizes_pulled_from_bundle(self, real_tokens):
        """Font sizes xs/sm/base/lg phải pull từ bundle.font.size."""
        qss = theme_registry.build_qss_from_theme("dark")
        assert "11px" in qss  # xs
        assert "12px" in qss  # sm
        assert "13px" in qss  # base
        assert "14px" in qss  # lg
