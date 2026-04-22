"""Font-pack sync module — Phase 5.

User bấm "Cập nhật" trong TrishFont → app fetch manifest.json từ GitHub repo
`trishnexus-fontpacks` → list pack có update → user chọn → download .zip →
verify SHA256 → extract vào %APPDATA%\\TrishFont\\packs\\ → trigger rescan.

Submodules:
- models:      FontPack dataclass + MIGRATION_004_FONTPACKS
- fetcher:     fetch manifest.json + parse
- downloader:  QThread async download + SHA256 + extract ZIP (zip-slip safe)
- repository:  local state — installed_packs table
- view:        PackView — UI tab "Cập nhật"
"""

from .models import (
    FontPack,
    MIGRATION_004_FONTPACKS,
    PackStatus,
)
from .fetcher import (
    MANIFEST_URL,
    fetch_manifest,
    parse_manifest,
)
from .repository import FontPackRepository
from .downloader import (
    DownloadPackJob,
    PackDownloadWorker,
    run_pack_download_async,
    packs_dir,
)
from .view import PackView

__all__ = [
    "FontPack",
    "PackStatus",
    "MIGRATION_004_FONTPACKS",
    "MANIFEST_URL",
    "fetch_manifest",
    "parse_manifest",
    "FontPackRepository",
    "DownloadPackJob",
    "PackDownloadWorker",
    "run_pack_download_async",
    "packs_dir",
    "PackView",
]
