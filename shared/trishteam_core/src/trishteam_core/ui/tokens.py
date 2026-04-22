"""AUTO-GENERATED from design/tokens.json — DO NOT EDIT BY HAND.

v1.1 — Dark palette chỉnh theo reference apps (TrishFont v1.0, Trish Library 1.0):
tone **warm dark** (nâu đen ấm) thay cho cool gray.

Dùng module này trong PyQt6 để dựng QSS:
    from trishteam_core.ui.tokens import COLOR, FONT, SPACE, DARK
"""

from types import SimpleNamespace

COLOR = SimpleNamespace(
    accent=SimpleNamespace(
        primary="#667EEA",
        secondary="#764BA2",
        gradient="linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
    ),
    semantic=SimpleNamespace(
        success="#10B981",
        warning="#F59E0B",
        danger="#EF4444",
        info="#3B82F6",
    ),
    # Group colors dùng trong các app (font category, project type, …)
    group=SimpleNamespace(
        primary="#667EEA",   # Unicode / default
        green="#10B981",     # VNI / success-like
        amber="#F59E0B",     # TCVN3 / warning-like
        cyan="#06B6D4",      # VietwareX / info-like
        blue="#3B82F6",      # AutoCAD / info
    ),
    neutral=SimpleNamespace(
        n0="#FFFFFF",
        n50="#F9FAFB",
        n100="#F3F4F6",
        n200="#E5E7EB",
        n300="#D1D5DB",
        n400="#9CA3AF",
        n500="#6B7280",
        n600="#4B5563",
        n700="#374151",
        n800="#1F2937",
        n900="#111827",
        n1000="#000000",
    ),
    surface=SimpleNamespace(
        bg="#F9FAFB",
        card="#FFFFFF",
        muted="#F3F4F6",
        overlay="rgba(17, 24, 39, 0.48)",
    ),
    text=SimpleNamespace(
        primary="#111827",
        secondary="#4B5563",
        muted="#6B7280",
        inverse="#FFFFFF",
        link="#667EEA",
    ),
    border=SimpleNamespace(
        subtle="#E5E7EB",
        default="#D1D5DB",
        strong="#9CA3AF",
        focus="#667EEA",
    ),
)

FONT = SimpleNamespace(
    family=SimpleNamespace(
        display="Be Vietnam Pro",
        body="Be Vietnam Pro",
        mono="Consolas",
    ),
    size=SimpleNamespace(
        xs="11px",
        sm="12px",
        base="13px",
        lg="14px",
        xl="16px",
        n2xl="20px",
        n3xl="24px",
        n4xl="32px",
        n5xl="40px",
    ),
    weight=SimpleNamespace(
        regular=400,
        medium=500,
        semibold=600,
        bold=700,
    ),
    lineHeight=SimpleNamespace(
        tight=1.25,
        snug=1.375,
        normal=1.5,
        relaxed=1.625,
    ),
)

SPACE = SimpleNamespace(
    n0="0px",
    n1="4px",
    n2="6px",
    n3="8px",
    n4="10px",
    n5="14px",
    n6="18px",
    n8="24px",
    n10="32px",
    n12="40px",
    n16="56px",
    n20="72px",
)

RADIUS = SimpleNamespace(
    none="0px",
    sm="6px",
    md="8px",
    lg="12px",
    xl="16px",
    n2xl="20px",
    full="9999px",
)

SHADOW = SimpleNamespace(
    xs="0 1px 2px 0 rgba(0, 0, 0, 0.2)",
    sm="0 1px 3px 0 rgba(0, 0, 0, 0.3)",
    md="0 4px 8px 0 rgba(0, 0, 0, 0.35)",
    lg="0 8px 20px 0 rgba(0, 0, 0, 0.45)",
    xl="0 20px 40px 0 rgba(0, 0, 0, 0.55)",
)

MOTION = SimpleNamespace(
    duration=SimpleNamespace(
        instant="0ms",
        fast="150ms",
        normal="240ms",
        slow="360ms",
    ),
    easing=SimpleNamespace(
        standard="cubic-bezier(0.2, 0, 0, 1)",
        emphasize="cubic-bezier(0.3, 0, 0, 1)",
        bounce="cubic-bezier(0.68, -0.55, 0.27, 1.55)",
    ),
)


# ---------- DARK MODE (default cho 6 app desktop) ----------
# Palette warm-dark, copy 1:1 từ reference TrishFont v1.0 (Hồ Sỹ Trí 2026):
#   BG_DARK   #0f0e0c   — nền app
#   BG_CARD   #1a1814   — card + topbar + footer
#   BG_ROW    #1e1c18   — input/button secondary bg
#   TEXT_MAIN #f5f2ed   — text chính (off-white ấm)
#   TEXT_MUTED #a09890  — text phụ
#
# Border tokens dùng rgba dựng trên nền card để viền mềm, không cứng như
# hex solid. QSS của Qt hỗ trợ rgba nên cứ để nguyên.
DARK = SimpleNamespace(
    surface=SimpleNamespace(
        bg="#0f0e0c",            # body
        bg_elevated="#1a1814",   # topbar / footer / card
        card="#1a1814",
        row="#1e1c18",           # toolbar row bg
        muted="rgba(255,255,255,0.05)",   # input bg
        hover="rgba(102,126,234,0.10)",   # accent tint hover
        overlay="rgba(0, 0, 0, 0.6)",
    ),
    text=SimpleNamespace(
        primary="#f5f2ed",
        secondary="#d4cec4",
        muted="#a09890",
        inverse="#ffffff",
        link="#8FA5FF",
    ),
    border=SimpleNamespace(
        subtle="rgba(255,255,255,0.06)",
        default="rgba(255,255,255,0.08)",
        strong="rgba(255,255,255,0.12)",
        focus="#667EEA",
    ),
)
