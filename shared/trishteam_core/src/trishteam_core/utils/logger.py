"""Logger chuẩn: file rotate + console, format giống nhau mọi app."""

from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path


def get_logger(name: str, *, log_dir: Path | None = None, level: int = logging.INFO) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger  # đã setup

    logger.setLevel(level)
    fmt = logging.Formatter("%(asctime)s  %(levelname)-8s %(name)s  %(message)s")

    # Console
    ch = logging.StreamHandler()
    ch.setFormatter(fmt)
    logger.addHandler(ch)

    # File (nếu có log_dir)
    if log_dir is not None:
        log_dir.mkdir(parents=True, exist_ok=True)
        fh = RotatingFileHandler(log_dir / f"{name}.log", maxBytes=2_000_000, backupCount=3, encoding="utf-8")
        fh.setFormatter(fmt)
        logger.addHandler(fh)

    return logger
