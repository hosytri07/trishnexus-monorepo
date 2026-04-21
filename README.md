# TrishNexus Monorepo

Rebuild song song của hệ sinh thái TrishTeam theo blueprint v2 (companion với báo cáo Evaluation & Roadmap v1).

## Cấu trúc

```
trishnexus-monorepo/
├── design/            # Nguồn sự thật design tokens (JSON)
│   └── tokens.json
├── scripts/
│   └── gen-tokens.js  # Sinh tokens.css (web) + tokens.py (desktop)
├── website/           # TrishTeam Website
│   └── assets/
│       └── tokens.css (generated)
├── shared/
│   └── trishteam_core/ # Package Python dùng chung cho mọi desktop app
└── apps/
    └── trishdesign/    # App desktop đầu tiên được refactor
```

## Quick start

### 1. Gen tokens (chạy mỗi lần sửa `design/tokens.json`)

```bash
node scripts/gen-tokens.js
```

### 2. Cài shared core (editable, local dev)

```bash
cd shared/trishteam_core
pip install -e .
```

### 3. Cài + chạy TrishDesign

```bash
cd apps/trishdesign
pip install -e .
trishdesign
```

## Workflow hàng ngày

1. Mở terminal 1: `cd website && python -m http.server 8080` (live reload HTML)
2. Mở terminal 2: `cd apps/trishdesign && python -m trishdesign.app` (test desktop)
3. Sửa `design/tokens.json` → `node scripts/gen-tokens.js` → cả 2 đều cập nhật.

## Sprint roadmap

Xem `TrishNexus_Parallel_Build_Blueprint.docx` + `Sprint0_Kickoff_Guide.docx` trong workspace.
