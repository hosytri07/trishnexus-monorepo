"""trishteam_core.widgets — Design-system widgets dùng chung 6 app TrishNexus.

Xem docs/design-spec.md để biết API + visual spec từng widget.
"""

from .action_bar import ActionBar
from .app_header import AppHeader
from .card import Card
from .card_group import CardGroup, CardItem
from .dialogs import AboutDialog, UpdateDialog
from .empty import EmptyState
from .footer_bar import FooterBar
from .inline_toolbar import InlineToolbar, ToolbarField
from .log_panel import LogPanel
from .split_sidebar import SidebarItem, SplitSidebar
from .toast import Toast, show_toast

__all__ = [
    # Originals
    "Card",
    "EmptyState",
    "Toast",
    "show_toast",
    # Design-system core
    "AppHeader",
    "InlineToolbar",
    "ToolbarField",
    "ActionBar",
    "CardGroup",
    "CardItem",
    "LogPanel",
    "FooterBar",
    "SplitSidebar",
    "SidebarItem",
    # Dialogs
    "AboutDialog",
    "UpdateDialog",
]
