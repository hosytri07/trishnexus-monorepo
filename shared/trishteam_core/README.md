# trishteam_core

Shared core for TrishNexus desktop apps.

## Install (editable, local dev)

```bash
cd shared/trishteam_core
pip install -e .
```

## Install (từ GitHub — dùng sau khi push)

```bash
pip install "trishteam-core @ git+https://github.com/TrishTeam/trishnexus-monorepo.git#subdirectory=shared/trishteam_core"
```

## Submodules

| Submodule | Nội dung |
|---|---|
| `trishteam_core.auth` | Firebase login, token refresh, DPAPI/keyring storage, `session` singleton |
| `trishteam_core.ui` | Base window, sidebar, theme, QSS generator, tokens |
| `trishteam_core.sync` | SyncEngine, queue, conflict resolve |
| `trishteam_core.widgets` | Card, Empty, Skeleton, Loader, Toast |
| `trishteam_core.utils` | Path, Platform, Logger, Updater |
| `trishteam_core.workers` | QThread worker, QRunnable pool |
| `trishteam_core.store` | SQLite wrapper, migration helper |

## Usage

```python
from trishteam_core.ui import BaseWindow, apply_theme
from trishteam_core.auth import session
from trishteam_core.store import Database

session.init(api_key="AIza...")          # 1 lần ở main()
app_window = BaseWindow(title="TrishDesign")
apply_theme(app_window)

if session.has_role("admin"):
    app_window.enable_admin_menu()
```
