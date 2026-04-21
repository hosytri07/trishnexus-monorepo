"""trishteam_core.workers — QThread worker + QRunnable pool để chạy việc nặng off main thread."""

from .thread_worker import Worker, run_in_thread

__all__ = ["Worker", "run_in_thread"]
