"""Pack downloader — QThread async + SHA256 + extract ZIP (zip-slip safe).

Flow:
    1. HTTP GET pack.download_url (stream=True) → ghi file tạm
       %APPDATA%\\TrishFont\\packs\\.tmp\\<pack_id>-<version>.zip
       Emit progress(done, total) mỗi chunk.
    2. Verify SHA256: nếu mismatch → xoá file + emit shaVerified(False) + fail.
    3. Extract vào %APPDATA%\\TrishFont\\packs\\<pack_id>\\ (xoá folder cũ trước).
       CHECK zip-slip: tất cả entry phải resolve vào extract_dir, không được
       escape bằng ".." hoặc absolute path.
    4. Emit finished(ok, n_files, total_bytes, msg).

Không cancel giữa chừng — user bấm download 1 pack thường < 50MB, chờ xong.
Nếu cần cancel → add flag + check mỗi chunk.
"""

from __future__ import annotations

import hashlib
import os
import shutil
import zipfile
from dataclasses import dataclass
from pathlib import Path

import requests
from PyQt6.QtCore import QObject, QThread, pyqtSignal

from trishteam_core.utils import user_data_dir_for


# Chunk size — 64KB để progress cập nhật mượt nhưng không quá nhiều signal.
_CHUNK = 64 * 1024


def packs_dir() -> Path:
    """Root folder chứa tất cả pack đã cài.

    Windows: %APPDATA%\\TrishFont\\packs\\
    """
    p = user_data_dir_for("TrishFont") / "packs"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _tmp_dir() -> Path:
    p = packs_dir() / ".tmp"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _verify_sha256(path: Path, expected: str) -> bool:
    """Tính SHA256 file và so sánh (case-insensitive)."""
    if not expected:
        return True   # empty → skip verify (dev mode)
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(_CHUNK), b""):
            h.update(chunk)
    return h.hexdigest().lower() == expected.strip().lower()


def _safe_extract(zf: zipfile.ZipFile, dest: Path) -> tuple[int, int]:
    """Extract ZIP vào dest với check zip-slip.

    Returns: (n_files, total_bytes).
    Raise: ValueError nếu có entry escape ra ngoài dest.
    """
    dest = dest.resolve()
    n_files = 0
    total_bytes = 0
    for info in zf.infolist():
        # Normalize path separator + strip leading slash
        target = (dest / info.filename).resolve()
        # zip-slip check: target phải nằm trong dest
        try:
            target.relative_to(dest)
        except ValueError:
            raise ValueError(
                f"Unsafe entry trong ZIP (zip-slip): {info.filename!r}"
            )
        if info.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        with zf.open(info) as src, target.open("wb") as dst:
            shutil.copyfileobj(src, dst, _CHUNK)
        n_files += 1
        total_bytes += info.file_size
    return n_files, total_bytes


# ---------- Worker ----------

@dataclass
class DownloadPackJob:
    """1 unit download pack."""
    pack_id: str
    version: str
    url: str
    expected_sha256: str = ""


class PackDownloadWorker(QObject):
    """QThread worker — download + verify + extract."""

    started       = pyqtSignal(int)            # total_bytes hint
    progress      = pyqtSignal(int, int)       # done_bytes, total_bytes
    shaVerified   = pyqtSignal(bool)           # ok/fail
    extracted     = pyqtSignal(int, int)       # n_files, total_bytes
    # finished(ok, n_files, total_bytes, msg, extract_path_or_empty)
    finished      = pyqtSignal(bool, int, int, str, str)

    def __init__(self, job: DownloadPackJob) -> None:
        super().__init__()
        self.job = job

    def run(self) -> None:
        tmp_zip: Path | None = None
        try:
            tmp_zip = self._download()
            if not _verify_sha256(tmp_zip, self.job.expected_sha256):
                self.shaVerified.emit(False)
                tmp_zip.unlink(missing_ok=True)
                self.finished.emit(False, 0, 0, "SHA256 mismatch", "")
                return
            self.shaVerified.emit(True)

            extract_path = packs_dir() / self.job.pack_id
            # Xoá folder cũ để update sạch
            if extract_path.exists():
                shutil.rmtree(extract_path)
            extract_path.mkdir(parents=True, exist_ok=True)

            with zipfile.ZipFile(tmp_zip, "r") as zf:
                n_files, total_bytes = _safe_extract(zf, extract_path)
            self.extracted.emit(n_files, total_bytes)

            # Xoá .zip tạm sau khi extract xong
            tmp_zip.unlink(missing_ok=True)

            self.finished.emit(
                True, n_files, total_bytes,
                f"Extracted {n_files} file ({_human(total_bytes)})",
                str(extract_path),
            )
        except Exception as e:
            # Cleanup tmp zip nếu còn
            if tmp_zip is not None:
                tmp_zip.unlink(missing_ok=True)
            self.finished.emit(
                False, 0, 0, f"{type(e).__name__}: {e}", "",
            )

    def _download(self) -> Path:
        """Stream download vào tmp file. Trả về Path."""
        tmp = _tmp_dir() / f"{self.job.pack_id}-{self.job.version}.zip"
        # Xoá tmp cũ nếu có
        tmp.unlink(missing_ok=True)

        with requests.get(self.job.url, stream=True, timeout=30) as resp:
            resp.raise_for_status()
            total = int(resp.headers.get("Content-Length", 0) or 0)
            self.started.emit(total)

            done = 0
            with tmp.open("wb") as f:
                for chunk in resp.iter_content(chunk_size=_CHUNK):
                    if not chunk:
                        continue
                    f.write(chunk)
                    done += len(chunk)
                    if total:
                        self.progress.emit(done, total)
                    else:
                        # unknown total → emit done/done để progress bar busy
                        self.progress.emit(done, 0)
        return tmp


def _human(n: int) -> str:
    if n <= 0:
        return "?"
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}" if unit != "B" else f"{n} B"
        n /= 1024
    return f"{n:.1f} TB"


# ---------- Spawn helper ----------

def run_pack_download_async(
    job: DownloadPackJob,
    *,
    on_progress=None,
    on_sha=None,
    on_extracted=None,
    on_finished=None,
) -> tuple[QThread, PackDownloadWorker]:
    """Wire worker + QThread. Caller giữ ref để không bị GC.

    Callbacks:
        on_progress(done, total)       — per chunk
        on_sha(bool)                    — 1 lần sau khi verify
        on_extracted(n_files, bytes)    — 1 lần sau khi extract xong
        on_finished(ok, n, bytes, msg, extract_path)

    Returns: (thread, worker).
    """
    thread = QThread()
    worker = PackDownloadWorker(job)
    worker.moveToThread(thread)

    if on_progress is not None:
        worker.progress.connect(on_progress)
    if on_sha is not None:
        worker.shaVerified.connect(on_sha)
    if on_extracted is not None:
        worker.extracted.connect(on_extracted)
    if on_finished is not None:
        worker.finished.connect(on_finished)

    thread.started.connect(worker.run)
    worker.finished.connect(thread.quit)
    worker.finished.connect(worker.deleteLater)
    thread.finished.connect(thread.deleteLater)

    thread.start()
    return thread, worker
