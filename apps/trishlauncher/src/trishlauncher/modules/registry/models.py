"""Registry models — AppEntry dataclass + SQL migrations.

apps.json schema:
    {
      "schema_version": 1,
      "updated_at": "2026-04-22T10:00:00Z",
      "apps": [
        {
          "id": "trishfont",
          "name": "TrishFont",
          "tagline": "Quản lý font chuyên nghiệp",
          "logo_emoji": "✨",
          "version": "1.0.0",
          "size_bytes": 25000000,
          "screenshots": [...],
          "changelog_url": "...",
          "download": {
            "windows_x64": {
              "url": "...",
              "sha256": "...",
              "installer_args": ["/S"]
            }
          }
        }
      ]
    }
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class DownloadInfo:
    url: str
    sha256: str = ""
    installer_args: list[str] = field(default_factory=list)


@dataclass
class AppEntry:
    id: str
    name: str
    tagline: str = ""
    logo_emoji: str = "📦"
    logo_url: str = ""              # URL PNG 256×256 từ registry repo (mới)
    status: str = "released"        # "released" | "coming_soon"
    version: str = "0.0.0"
    size_bytes: int = 0
    login_required: str = "none"    # "none" | "user" | "admin" | "dev"
    platforms: list[str] = field(default_factory=lambda: ["windows_x64"])
    screenshots: list[str] = field(default_factory=list)
    changelog_url: str = ""
    downloads: dict[str, DownloadInfo] = field(default_factory=dict)
    # State local (không có trong apps.json)
    installed_version: str | None = None
    install_path: str | None = None

    @property
    def is_admin_only(self) -> bool:
        """True nếu app chỉ dành cho admin/dev — filter khỏi Launcher HubView."""
        return self.login_required in ("admin", "dev")


# DB migration cho launcher local state
MIGRATION_001_LAUNCHER = """
CREATE TABLE IF NOT EXISTS installed_apps (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id            TEXT    NOT NULL UNIQUE,
    installed_version TEXT    NOT NULL,
    install_path      TEXT    NOT NULL DEFAULT '',
    installed_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_check_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_installed_app_id ON installed_apps(app_id);

CREATE TABLE IF NOT EXISTS registry_cache (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    raw_json        TEXT    NOT NULL,
    fetched_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""
