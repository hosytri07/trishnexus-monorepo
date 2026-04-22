# TrishFont

Font library manager & preview tool for designers and Vietnamese typographers.

## Cấu trúc module

- `preview/` — grid view, hiển thị sample text với mỗi font family
- `library/` — SQLite-backed list với search, favorite, VN-support filter
- `favorites/` — filtered view (favorite = 1)
- `install/` — install/uninstall font từ file .ttf/.otf (v0.2)

## Chạy

```bash
# Từ root monorepo, trong venv đã activate:
pip install -e ./apps/trishfont
trishfont
# hoặc
python -m trishfont.app
```

## Data

SQLite DB lưu tại `%LOCALAPPDATA%\TrishTeam\TrishFont\data.db` (Windows).

## Dependencies

- `trishteam-core` — BaseWindow, Card, EmptyState, Database, migrate
- PyQt6 (qua trishteam_core)
