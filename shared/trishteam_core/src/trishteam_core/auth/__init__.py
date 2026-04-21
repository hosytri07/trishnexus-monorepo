"""trishteam_core.auth — Firebase login + token refresh + keyring storage."""

from .manager import AuthManager, AuthError, UserSession

__all__ = ["AuthManager", "AuthError", "UserSession"]
