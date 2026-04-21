"""AUTO-GENERATED from design/tokens.json — DO NOT EDIT BY HAND.

Dùng module này trong PyQt6 để dựng QSS:
    from trishteam_core.ui.tokens import COLOR, FONT, SPACE
"""

from types import SimpleNamespace

COLOR = SimpleNamespace(
    accent=SimpleNamespace(
        primary="#667EEA",
        secondary="#764BA2",
        gradient="linear-gradient(135deg, #667EEA 0%, #764BA2 100%)"
    ),
    semantic=SimpleNamespace(
        success="#10B981",
        warning="#F59E0B",
        danger="#EF4444",
        info="#3B82F6"
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
        n1000="#000000"
    ),
    surface=SimpleNamespace(
        bg="#F9FAFB",
        card="#FFFFFF",
        muted="#F3F4F6",
        overlay="rgba(17, 24, 39, 0.48)"
    ),
    text=SimpleNamespace(
        primary="#111827",
        secondary="#4B5563",
        muted="#6B7280",
        inverse="#FFFFFF",
        link="#667EEA"
    ),
    border=SimpleNamespace(
        subtle="#E5E7EB",
        default="#D1D5DB",
        strong="#9CA3AF",
        focus="#667EEA"
    )
)

FONT = SimpleNamespace(
    family=SimpleNamespace(
        display="Be Vietnam Pro",
        body="DM Sans",
        mono="JetBrains Mono"
    ),
    size=SimpleNamespace(
        xs="12px",
        sm="14px",
        base="16px",
        lg="18px",
        xl="20px",
        n2xl="24px",
        n3xl="30px",
        n4xl="36px",
        n5xl="48px"
    ),
    weight=SimpleNamespace(
        regular=400,
        medium=500,
        semibold=600,
        bold=700
    ),
    lineHeight=SimpleNamespace(
        tight=1.25,
        snug=1.375,
        normal=1.5,
        relaxed=1.625
    )
)

SPACE = SimpleNamespace(
    n0="0px",
    n1="4px",
    n2="8px",
    n3="12px",
    n4="16px",
    n5="20px",
    n6="24px",
    n8="32px",
    n10="40px",
    n12="48px",
    n16="64px",
    n20="80px"
)

RADIUS = SimpleNamespace(
    none="0px",
    sm="6px",
    md="10px",
    lg="14px",
    xl="20px",
    n2xl="28px",
    full="9999px"
)

SHADOW = SimpleNamespace(
    xs="0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    sm="0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.04)",
    md="0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)",
    lg="0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)",
    xl="0 20px 25px -5px rgba(0, 0, 0, 0.10), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
)

MOTION = SimpleNamespace(
    duration=SimpleNamespace(
        instant="0ms",
        fast="150ms",
        normal="240ms",
        slow="360ms"
    ),
    easing=SimpleNamespace(
        standard="cubic-bezier(0.2, 0, 0, 1)",
        emphasize="cubic-bezier(0.3, 0, 0, 1)",
        bounce="cubic-bezier(0.68, -0.55, 0.27, 1.55)"
    )
)
