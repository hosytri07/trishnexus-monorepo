"""Install worker — download .tpack → verify → extract → shortcuts → DB.

Xem docs/PACKAGING.md §3.3 cho flow tổng.

Khác với `download/worker.py` cũ (tải .exe NSIS + chạy installer):
    - `install/worker.py` chuyên cho format .tpack (zip nhẹ)
    - Không spawn installer external, tự extract + create shortcut + register
    - Tất cả app TrishTEAM dùng worker này; .exe NSIS chỉ dành cho Runtime
      installer lần đầu (task #59)

Flow:

    1. Download .tpack stream → downloads_cache_dir()
    2. Verify SHA256 (bắt buộc — abort nếu mismatch)
    3. Mở zip, đọc manifest.json — verify id/version match với AppEntry
       và python_bytecode match runtime hiện tại
    4. Check app đã installed chưa → upgrade hay fresh install
    5. Extract vào <TRISHTEAM_ROOT>/apps/<id>/ (zip-slip safe)
    6. Tạo Desktop + Start Menu shortcut qua COM
    7. Ghi installed_apps DB (app_id, version, install_path, timestamp)
    8. Emit signal finished
"""

from __future__ import annotations

import hashlib
import json
import shutil
import sys
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import requests
from PyQt6.QtCore import QObject, QThread, pyqtSignal

from trishteam_core.store import Database

from ..registry.repository import RegistryRepository
from .control_panel import register_uninstall_entry, unregister_uninstall_entry
from .locations import app_install_path, downloads_cache_dir
from .shortcuts import ShortcutError, create_shortcuts_for_app, remove_shortcuts_for_app


CHUNK_SIZE = 1024 * 64


# ─────────────────────────── helpers ───────────────────────────

def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(CHUNK_SIZE), b""):
            h.update(chunk)
    return h.hexdigest()


def _current_bytecode_version() -> str:
    return f"{sys.version_info.major}.{sys.version_info.minor}"


def _safe_extract_tpack(tpack_path: Path, target_dir: Path) -> None:
    """Extract .tpack vào target_dir với zip-slip protection.

    Raises ValueError nếu có entry trỏ ra ngoài target_dir.
    """
    target_resolved = target_dir.resolve()
    with zipfile.ZipFile(tpack_path, "r") as zf:
        for name in zf.namelist():
            # Reject absolute path + path traversal
            if name.startswith("/") or name.startswith("\\"):
                raise ValueError(f"Zip-slip: absolute path '{name}'")
            if ".." in Path(name).parts:
                raise ValueError(f"Zip-slip: parent traversal '{name}'")
            dest = (target_dir / name).resolve()
            try:
                dest.relative_to(target_resolved)
            except ValueError as e:
                raise ValueError(f"Zip-slip: '{name}' escapes {target_dir}") from e
        zf.extractall(target_dir)


def _read_manifest_from_tpack(tpack_path: Path) -> dict[str, Any]:
    """Đọc manifest.json bên trong .tpack (không extract toàn bộ)."""
    with zipfile.ZipFile(tpack_path, "r") as zf:
        try:
            with zf.open("manifest.json") as f:
                return json.loads(f.read().decode("utf-8"))
        except KeyError as e:
            raise ValueError("Tpack thiếu manifest.json — file hỏng hoặc sai format") from e


def _verify_compat(
    manifest: dict[str, Any],
    expected_id: str,
    expected_version: str,
) -> None:
    """Verify manifest.json khớp kỳ vọng + tương thích runtime hiện tại.

    Raises ValueError nếu incompatible.
    """
    # ID match
    if manifest.get("id") != expected_id:
        raise ValueError(
            f"Manifest id '{manifest.get('id')}' khác với expected '{expected_id}'"
        )
    # Version match
    if manifest.get("version") != expected_version:
        raise ValueError(
            f"Manifest version '{manifest.get('version')}' khác với expected "
            f"'{expected_version}'"
        )
    # Python bytecode compat
    runtime = manifest.get("runtime", {}) or {}
    bytecode = runtime.get("python_bytecode")
    current = _current_bytecode_version()
    if bytecode and bytecode != current:
        raise ValueError(
            f".tpack này compile bởi Python {bytecode}, Runtime hiện tại "
            f"Python {current} — không tương thích bytecode. Cần build lại "
            f"bằng Python {current} hoặc upgrade Runtime."
        )


# ─────────────────────────── job + worker ───────────────────────────

@dataclass
class InstallJob:
    """1 lần install/upgrade 1 app."""
    app_id: str
    version: str
    tpack_url: str
    expected_sha256: str
    app_name: str = ""           # Tên hiển thị (dùng cho log/toast)
    force_reinstall: bool = False  # Reinstall dù cùng version


@dataclass
class InstallResult:
    job: InstallJob
    success: bool
    install_path: Path | None = None
    shortcuts_created: list[Path] = field(default_factory=list)
    message: str = ""


class InstallWorker(QObject):
    """Worker chạy trong QThread — download + install 1 .tpack."""

    # bytes_done, bytes_total (total=0 nếu server không trả Content-Length)
    progress       = pyqtSignal(int, int)
    statusChanged  = pyqtSignal(str)
    sha256Verified = pyqtSignal(bool)
    extractStarted = pyqtSignal(str)     # install_path
    # success, message (khi fail: message chứa lý do)
    finished       = pyqtSignal(bool, str)

    def __init__(self, job: InstallJob, db: Database) -> None:
        super().__init__()
        self.job = job
        self.db = db
        self.repo = RegistryRepository(db)
        self._cancel = False
        self.result: InstallResult | None = None

    def cancel(self) -> None:
        self._cancel = True

    # ----- steps -----

    def _download_tpack(self) -> Path:
        dest = downloads_cache_dir() / f"{self.job.app_id}-{self.job.version}.tpack"
        self.statusChanged.emit(f"Đang tải {self.job.app_id} v{self.job.version}…")
        with requests.get(self.job.tpack_url, stream=True, timeout=60) as resp:
            resp.raise_for_status()
            total = int(resp.headers.get("Content-Length", 0))
            done = 0
            with open(dest, "wb") as f:
                for chunk in resp.iter_content(chunk_size=CHUNK_SIZE):
                    if self._cancel:
                        raise InterruptedError("Người dùng huỷ tải")
                    if not chunk:
                        continue
                    f.write(chunk)
                    done += len(chunk)
                    self.progress.emit(done, total)
        return dest

    def _verify_and_read_manifest(self, tpack: Path) -> dict[str, Any]:
        self.statusChanged.emit("Đang xác thực SHA256…")
        actual = _sha256_file(tpack)
        expected = self.job.expected_sha256.lower()
        ok = actual.lower() == expected
        self.sha256Verified.emit(ok)
        if not ok:
            raise ValueError(
                f"SHA256 không khớp — file có thể bị hỏng hoặc bị chỉnh sửa. "
                f"Expected {expected[:12]}…, got {actual[:12]}…"
            )

        self.statusChanged.emit("Đang kiểm tra manifest.json…")
        manifest = _read_manifest_from_tpack(tpack)
        _verify_compat(manifest, self.job.app_id, self.job.version)
        return manifest

    def _extract(self, tpack: Path, manifest: dict[str, Any]) -> Path:
        install_path = app_install_path(self.job.app_id)

        # Nếu đã installed version này + không force → skip
        current_installed = self.repo.get_installed(self.job.app_id)
        if (
            current_installed
            and current_installed[0] == self.job.version
            and install_path.exists()
            and not self.job.force_reinstall
        ):
            raise FileExistsError(
                f"{self.job.app_id} v{self.job.version} đã cài. "
                f"Tick 'Cài lại' nếu muốn cài đè."
            )

        # Nếu đã có folder → xoá code/ + resources/ + manifest.json cũ
        # (giữ data/ vì có thể chứa bundled pack cũ, user data trong AppData
        # không động tới).
        if install_path.exists():
            self.statusChanged.emit("Đang dọn bản cũ…")
            for sub in ("code", "resources"):
                p = install_path / sub
                if p.exists():
                    shutil.rmtree(p, ignore_errors=True)
            old_manifest = install_path / "manifest.json"
            if old_manifest.exists():
                old_manifest.unlink()

        install_path.mkdir(parents=True, exist_ok=True)
        self.extractStarted.emit(str(install_path))
        self.statusChanged.emit(f"Đang giải nén vào {install_path}…")
        _safe_extract_tpack(tpack, install_path)
        return install_path

    def _make_shortcuts(self, manifest: dict[str, Any]) -> list[Path]:
        shortcuts_spec = manifest.get("provides_shortcuts", [])
        if not shortcuts_spec:
            return []
        self.statusChanged.emit("Đang tạo shortcut Desktop + Start Menu…")
        try:
            return create_shortcuts_for_app(self.job.app_id, shortcuts_spec)
        except ShortcutError as e:
            # Shortcut fail không abort install — app vẫn cài được, chỉ không có icon
            self.statusChanged.emit(f"⚠ Không tạo shortcut: {e}")
            return []

    def _register_in_db(self, install_path: Path) -> None:
        self.statusChanged.emit("Đang ghi installed_apps DB…")
        self.repo.mark_installed(
            app_id=self.job.app_id,
            version=self.job.version,
            install_path=str(install_path),
        )

    def _register_in_control_panel(
        self, manifest: dict[str, Any], install_path: Path
    ) -> None:
        """Ghi entry Apps & Features (Windows only). Fail-soft — không abort."""
        self.statusChanged.emit("Đang đăng ký Apps & Features…")
        try:
            register_uninstall_entry(self.job.app_id, manifest, install_path)
        except Exception as e:
            self.statusChanged.emit(f"⚠ Không ghi Control Panel entry: {e}")

    # ----- main run -----

    def run(self) -> None:
        try:
            tpack = self._download_tpack()
            manifest = self._verify_and_read_manifest(tpack)
            install_path = self._extract(tpack, manifest)
            shortcuts = self._make_shortcuts(manifest)
            self._register_in_db(install_path)
            self._register_in_control_panel(manifest, install_path)

            self.result = InstallResult(
                job=self.job,
                success=True,
                install_path=install_path,
                shortcuts_created=shortcuts,
                message=(
                    f"Đã cài {self.job.app_name or self.job.app_id} "
                    f"v{self.job.version} vào {install_path}. "
                    f"Đã tạo {len(shortcuts)} shortcut."
                ),
            )
            self.finished.emit(True, self.result.message)

        except InterruptedError as e:
            self.finished.emit(False, str(e))
        except FileExistsError as e:
            self.finished.emit(False, str(e))
        except ValueError as e:
            # Integrity / compat errors — actionable
            self.finished.emit(False, str(e))
        except requests.RequestException as e:
            self.finished.emit(False, f"Lỗi mạng: {e}")
        except PermissionError as e:
            self.finished.emit(
                False,
                f"Không đủ quyền ghi — cần chạy Launcher as Administrator "
                f"nếu Runtime cài ở Program Files. ({e})",
            )
        except Exception as e:
            self.finished.emit(False, f"{type(e).__name__}: {e}")


# ─────────────────────────── uninstall ───────────────────────────

def uninstall_app(db: Database, app_id: str) -> tuple[bool, str]:
    """Gỡ 1 app: xoá folder install, xoá shortcut, xoá row installed_apps.

    Trả về (success, message). User data trong %APPDATA%\\TrishTEAM\\<id> giữ
    nguyên — chỉ xoá trong uninstall tổng Runtime (task #63).
    """
    repo = RegistryRepository(db)
    install_path = app_install_path(app_id)

    # Đọc manifest để biết shortcuts đã tạo
    shortcuts_spec: list[dict] = []
    manifest_path = install_path / "manifest.json"
    if manifest_path.is_file():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            shortcuts_spec = manifest.get("provides_shortcuts", [])
        except (json.JSONDecodeError, OSError):
            pass  # Manifest hỏng → dùng convention name = app_id

    # Remove shortcuts first (nhanh, fail-soft)
    removed_shortcuts = remove_shortcuts_for_app(app_id, shortcuts_spec)

    # Remove Control Panel (Apps & Features) entry — fail-soft
    try:
        unregister_uninstall_entry(app_id)
    except Exception:
        pass

    # Remove install folder
    errors: list[str] = []
    if install_path.exists():
        try:
            shutil.rmtree(install_path)
        except OSError as e:
            errors.append(f"Không xoá được {install_path}: {e}")

    # Remove DB row
    repo.mark_uninstalled(app_id)

    if errors:
        return False, "; ".join(errors)
    return True, (
        f"Đã gỡ {app_id}, xoá {len(removed_shortcuts)} shortcut. "
        f"User data giữ lại ở %APPDATA%\\TrishTEAM\\{app_id}."
    )


# ─────────────────────────── thread helper ───────────────────────────

def run_install_async(
    job: InstallJob,
    db: Database,
    *,
    on_progress=None,
    on_status=None,
    on_sha=None,
    on_extract_started=None,
    on_finished=None,
) -> tuple[QThread, InstallWorker]:
    """Chạy 1 InstallJob trong thread riêng, wire callback UI."""
    thread = QThread()
    worker = InstallWorker(job, db)
    worker.moveToThread(thread)

    if on_progress is not None:
        worker.progress.connect(on_progress)
    if on_status is not None:
        worker.statusChanged.connect(on_status)
    if on_sha is not None:
        worker.sha256Verified.connect(on_sha)
    if on_extract_started is not None:
        worker.extractStarted.connect(on_extract_started)
    if on_finished is not None:
        worker.finished.connect(on_finished)

    thread.started.connect(worker.run)
    worker.finished.connect(thread.quit)
    worker.finished.connect(worker.deleteLater)
    thread.finished.connect(thread.deleteLater)

    thread.start()
    return thread, worker
