"""Settings models — simple key-value store."""

from __future__ import annotations


MIGRATION_002_SETTINGS = """
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""
