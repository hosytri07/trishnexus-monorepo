"""Download worker — pull installer .exe từ GitHub Release, verify, run silent.

Flow:
    1. Stream download URL → file `%LOCALAPPDATA%\\TrishLauncher\\downloads\\<name>.exe`
    2. Verify SHA256 (nếu manifest có cung cấp).
    3. Spawn process với installer_args (vd ["/S"] cho NSIS, ["/quiet"] cho MSI).
    4. Emit signal khi xong.

Không bao giờ mở browser — luôn auto-install. User trải nghiệm 1-click.
"""

from __future__ import annotations

import hashlib
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path

import requests
from PyQt6.QtCore import QObject, QThread, pyqtSignal


CHUNK_SIZE = 1024 * 64    # 64KB


def downloads_dir() -> Path:
    base = os.environ.get("LOCALAPPDATA")
    if not base:
        base = str(Path.home() / "AppData" / "Local")
    p = Path(base) / "TrishLauncher" / "downloads"
    p.mkdir(parents=True, exist_ok=True)
    return p


def sha256_of_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(CHUNK_SIZE), b""):
            h.update(chunk)
    return h.hexdigest()


@dataclass
class DownloadJob:
    app_id: str
    url: str
    file_name: str          # tên file đích
    expected_sha256: str = ""
    installer_args: list[str] | None = None


class DownloadWorker(QObject):
    """Worker download + auto-install — chạy trong QThread."""

    progress       = pyqtSignal(int, int)        # bytes_done, bytes_total
    statusChanged  = pyqtSignal(str)             # human-readable status
    sha256Verified = pyqtSignal(bool)            # True/False (False nếu mismatch)
    installStarted = pyqtSignal(str)             # path to exe
    finished       = pyqtSignal(bool, str)       # (success, message)

    def __init__(self, job: DownloadJob) -> None:
        super().__init__()
        self.job = job
        self._cancel = False

    def cancel(self) -> None:
        self._cancel = True

    def run(self) -> None:
        try:
            self.statusChanged.emit(f"Đang tải {self.job.file_name}…")
            dest = downloads_dir() / self.job.file_name

            # --- Download stream ---
            with requests.get(self.job.url, stream=True, timeout=30) as resp:
                resp.raise_for_status()
                total = int(resp.headers.get("Content-Length", 0))
                done = 0
                with open(dest, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=CHUNK_SIZE):
                        if self._cancel:
                            self.finished.emit(False, "Đã huỷ tải.")
                            return
                        if not chunk:
                            continue
                        f.write(chunk)
                        done += len(chunk)
                        self.progress.emit(done, total)

            # --- SHA256 verify ---
            if self.job.expected_sha256:
                self.statusChanged.emit("Đang xác thực SHA256…")
                actual = sha256_of_file(dest)
                ok = actual.lower() == self.job.expected_sha256.lower()
                self.sha256Verified.emit(ok)
                if not ok:
                    self.finished.emit(
                        False,
                        f"SHA256 không khớp — file có thể bị hỏng. "
                        f"Expected {self.job.expected_sha256[:8]}, got {actual[:8]}.",
                    )
                    return
            else:
                # Không có expected → coi như verify OK
                self.sha256Verified.emit(True)

            # --- Auto-install (silent) ---
            self.statusChanged.emit("Đang chạy installer…")
            self.installStarted.emit(str(dest))

            args = [str(dest), *(self.job.installer_args or [])]
            try:
                # Popen + wait → block worker thread (không block UI vì worker ở thread riêng)
                proc = subprocess.Popen(args)
                returncode = proc.wait()
            except FileNotFoundError as e:
                self.finished.emit(False, f"Không chạy được installer: {e}")
                return

            if returncode != 0:
                self.finished.emit(
                    False,
                    f"Installer exit code {returncode} — có thể user huỷ hoặc lỗi.",
                )
                return

            self.finished.emit(True, "Cài đặt thành công.")

        except requests.RequestException as e:
            self.finished.emit(False, f"Lỗi mạng: {e}")
        except Exception as e:
            self.finished.emit(False, f"{type(e).__name__}: {e}")


def run_download_async(
    job: DownloadJob,
    *,
    on_progress=None,
    on_status=None,
    on_sha=None,
    on_install_started=None,
    on_finished=None,
) -> tuple[QThread, DownloadWorker]:
    thread = QThread()
    worker = DownloadWorker(job)
    worker.moveToThread(thread)

    if on_progress is not None:
        worker.progress.connect(on_progress)
    if on_status is not None:
        worker.statusChanged.connect(on_status)
    if on_sha is not None:
        worker.sha256Verified.connect(on_sha)
    if on_install_started is not None:
        worker.installStarted.connect(on_install_started)
    if on_finished is not None:
        worker.finished.connect(on_finished)

    thread.started.connect(worker.run)
    worker.finished.connect(thread.quit)
    worker.finished.connect(worker.deleteLater)
    thread.finished.connect(thread.deleteLater)

    thread.start()
    return thread, worker
