"""Install worker — copy font vào target dir + đăng ký registry (Windows).

Phase 3 — chạy trong QThread để không block UI.

Hai loại font:
    1. Windows fonts (.ttf, .otf, .ttc, .otc):
       - Copy vào C:\\Windows\\Fonts (system-wide, cần admin)
       - Đăng ký registry HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts
       - Broadcast WM_FONTCHANGE để app đang mở thấy font mới ngay

    2. AutoCAD shape fonts (.shx):
       - Auto-detect AutoCAD install (registry hoặc Program Files)
       - Copy đè vào folder Fonts của từng version (multi-version support)

Worker emit progress + per-file result để LogPanel hiển thị realtime.
Failed nhỏ lẻ không cancel batch — fail-soft.

Caller cần check `is_admin()` trước khi gọi — nếu false thì hoặc elevate
(relaunch_as_admin) hoặc cảnh báo user phải chạy TrishFont as admin.
"""

from __future__ import annotations

import ctypes
import os
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path

from PyQt6.QtCore import QObject, QThread, pyqtSignal


# ---------- Admin detection / elevation ----------

def is_admin() -> bool:
    """True nếu process có quyền admin (Windows) hoặc uid=0 (nix).

    Dùng trước khi install system-wide để hiện warning thay vì fail giữa chừng.
    """
    if sys.platform == "win32":
        try:
            return bool(ctypes.windll.shell32.IsUserAnAdmin())
        except Exception:
            return False
    # POSIX
    try:
        return os.geteuid() == 0  # type: ignore[attr-defined]
    except Exception:
        return False


def relaunch_as_admin() -> bool:
    """Relaunch TrishFont với UAC elevation. Windows only.

    Returns True nếu đã spawn được process admin (caller nên exit app hiện tại).
    False = user từ chối UAC hoặc không phải Windows.
    """
    if sys.platform != "win32":
        return False
    try:
        # ShellExecuteW với verb "runas" → UAC prompt
        params = " ".join(f'"{a}"' for a in sys.argv[1:])
        ret = ctypes.windll.shell32.ShellExecuteW(
            None, "runas", sys.executable, f'"{sys.argv[0]}" {params}', None, 1
        )
        # ShellExecuteW trả > 32 nếu OK
        return int(ret) > 32
    except Exception:
        return False


# ---------- Path resolvers ----------

def resolve_user_fonts_dir() -> Path:
    """Per-user fonts dir trên Windows — không cần admin.

    Path: %LOCALAPPDATA%\\Microsoft\\Windows\\Fonts
    """
    base = os.environ.get("LOCALAPPDATA")
    if not base:
        # Fallback: %USERPROFILE%\AppData\Local
        base = str(Path.home() / "AppData" / "Local")
    p = Path(base) / "Microsoft" / "Windows" / "Fonts"
    p.mkdir(parents=True, exist_ok=True)
    return p


def resolve_system_fonts_dir() -> Path:
    """System-wide fonts dir — cần admin."""
    win_dir = os.environ.get("WINDIR", r"C:\Windows")
    return Path(win_dir) / "Fonts"


def discover_autocad_dirs() -> list[Path]:
    """Tìm tất cả folder Fonts của AutoCAD đang cài.

    Strategy:
    1. Đọc registry HKEY_LOCAL_MACHINE\\SOFTWARE\\Autodesk\\AutoCAD\\<Rxx.x>\\<lang>\\AcadLocation
    2. Fallback: scan C:\\Program Files\\Autodesk\\AutoCAD <year>\\Fonts

    Trả về list, có thể rỗng nếu không cài AutoCAD.
    """
    found: set[Path] = set()

    # --- Registry approach (Windows only) ---
    if sys.platform == "win32":
        try:
            import winreg

            for hive in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
                try:
                    base = winreg.OpenKey(hive, r"SOFTWARE\Autodesk\AutoCAD")
                except OSError:
                    continue

                # Enumerate version sub-keys (R24.0, R23.1, ...)
                i = 0
                while True:
                    try:
                        ver_name = winreg.EnumKey(base, i)
                    except OSError:
                        break
                    i += 1
                    try:
                        ver_key = winreg.OpenKey(base, ver_name)
                        # Mỗi version có sub-key theo language code (409, 411, ...)
                        j = 0
                        while True:
                            try:
                                lang_name = winreg.EnumKey(ver_key, j)
                            except OSError:
                                break
                            j += 1
                            try:
                                lang_key = winreg.OpenKey(ver_key, lang_name)
                                acad_loc, _ = winreg.QueryValueEx(
                                    lang_key, "AcadLocation"
                                )
                                fonts_dir = Path(acad_loc) / "Fonts"
                                if fonts_dir.is_dir():
                                    found.add(fonts_dir)
                            except OSError:
                                continue
                    except OSError:
                        continue
        except ImportError:
            pass  # Not on Windows

    # --- Program Files fallback ---
    for pf_env in ("ProgramFiles", "ProgramFiles(x86)"):
        pf = os.environ.get(pf_env)
        if not pf:
            continue
        autodesk_root = Path(pf) / "Autodesk"
        if not autodesk_root.is_dir():
            continue
        for sub in autodesk_root.iterdir():
            if sub.is_dir() and sub.name.lower().startswith("autocad"):
                fonts_dir = sub / "Fonts"
                if fonts_dir.is_dir():
                    found.add(fonts_dir)

    return sorted(found)


# ---------- Worker ----------

@dataclass
class InstallTask:
    """1 unit cài đặt: source file + loại font."""
    source: Path
    family: str
    kind: str             # 'windows' | 'autocad'


@dataclass
class InstallResult:
    task: InstallTask
    ok: bool
    target: Path | None
    message: str          # mô tả ngắn (success log hoặc error)


class InstallWorker(QObject):
    """Worker chạy trong QThread, emit signal khi xong từng file."""

    started        = pyqtSignal(int)              # total
    progress       = pyqtSignal(int, int)         # done, total
    fileInstalled  = pyqtSignal(object)           # InstallResult
    finished       = pyqtSignal(int, int)         # n_ok, n_fail

    def __init__(
        self,
        tasks: list[InstallTask],
        *,
        all_users: bool = True,       # DEFAULT: system-wide (C:\Windows\Fonts)
        autocad_dirs: list[Path] | None = None,
    ) -> None:
        super().__init__()
        self.tasks = tasks
        self.all_users = all_users
        self.autocad_dirs = autocad_dirs if autocad_dirs is not None else discover_autocad_dirs()
        self._cancel = False

    def cancel(self) -> None:
        self._cancel = True

    def run(self) -> None:
        total = len(self.tasks)
        self.started.emit(total)

        n_ok = 0
        n_fail = 0
        for i, task in enumerate(self.tasks, start=1):
            if self._cancel:
                break
            result = self._install_one(task)
            self.fileInstalled.emit(result)
            if result.ok:
                n_ok += 1
            else:
                n_fail += 1
            self.progress.emit(i, total)

        # Broadcast WM_FONTCHANGE 1 lần cuối batch (đỡ noise)
        if any(t.kind == "windows" for t in self.tasks):
            _broadcast_font_change()

        self.finished.emit(n_ok, n_fail)

    # ----- Internal -----

    def _install_one(self, task: InstallTask) -> InstallResult:
        if task.kind == "autocad":
            return self._install_autocad(task)
        return self._install_windows(task)

    def _install_windows(self, task: InstallTask) -> InstallResult:
        try:
            dest_dir = (
                resolve_system_fonts_dir() if self.all_users
                else resolve_user_fonts_dir()
            )
            dest = dest_dir / task.source.name
            if not _needs_copy(task.source, dest):
                return InstallResult(task, True, dest, "đã có (skip)")

            _force_copy(task.source, dest)

            # Registry — Windows only
            if sys.platform == "win32":
                _register_font_registry(
                    family=task.family,
                    file_name=dest.name,
                    full_path=str(dest),
                    all_users=self.all_users,
                )

            return InstallResult(task, True, dest, "OK")
        except Exception as e:  # fail-soft
            return InstallResult(task, False, None, f"{type(e).__name__}: {e}")

    def _install_autocad(self, task: InstallTask) -> InstallResult:
        if not self.autocad_dirs:
            return InstallResult(
                task, False, None,
                "Không tìm thấy AutoCAD install — bỏ qua .shx."
            )
        last_dest: Path | None = None
        copied_to: list[str] = []
        skipped_to: list[str] = []
        errors: list[str] = []

        for acad_dir in self.autocad_dirs:
            dest = acad_dir / task.source.name
            last_dest = dest

            # Skip nếu identical (size + mtime gần nhau)
            if not _needs_copy(task.source, dest):
                skipped_to.append(acad_dir.name)
                continue

            # Copy với retry: nếu dest có attribute read-only thì clear + retry 1 lần
            try:
                _force_copy(task.source, dest)
                copied_to.append(acad_dir.name)
            except PermissionError as e:
                # File có thể bị AutoCAD đang chạy lock — log rõ để user biết đóng AutoCAD
                errors.append(f"{acad_dir.name}: bị lock (đóng AutoCAD rồi thử lại)")
            except Exception as e:
                errors.append(f"{acad_dir.name}: {type(e).__name__}")

        total_ok = len(copied_to) + len(skipped_to)
        if errors and total_ok == 0:
            return InstallResult(task, False, last_dest, "; ".join(errors))

        # Có ít nhất 1 dir OK — coi như success (fail-soft)
        msg_parts = []
        if copied_to:
            msg_parts.append(f"OK {len(copied_to)} dir")
        if skipped_to:
            msg_parts.append(f"skip {len(skipped_to)} (đã có)")
        if errors:
            msg_parts.append(f"lỗi {len(errors)} — " + "; ".join(errors))
        return InstallResult(task, True, last_dest, ", ".join(msg_parts))


# ---------- Helpers ----------

def _force_copy(src: Path, dest: Path) -> None:
    """Copy src→dest, clear read-only attribute nếu cần + retry 1 lần.

    Windows: file trong Program Files có thể là read-only hoặc của previous
    install bị đánh dấu R. shutil.copy2 sẽ ném PermissionError → clear attr
    rồi retry.
    """
    try:
        shutil.copy2(src, dest)
        return
    except PermissionError:
        # Clear read-only + retry
        if dest.exists():
            try:
                import stat as _stat

                dest.chmod(_stat.S_IWRITE | _stat.S_IREAD)
            except Exception:
                pass
            try:
                dest.unlink()
            except Exception:
                pass
        shutil.copy2(src, dest)


def _needs_copy(src: Path, dest: Path) -> bool:
    """True nếu cần copy: dest chưa tồn tại HOẶC kích thước/mtime khác."""
    if not dest.exists():
        return True
    try:
        s_stat = src.stat()
        d_stat = dest.stat()
        if s_stat.st_size != d_stat.st_size:
            return True
        # mtime khác > 2s → coi như khác
        if abs(s_stat.st_mtime - d_stat.st_mtime) > 2:
            return True
        return False
    except OSError:
        return True


def _register_font_registry(
    *,
    family: str,
    file_name: str,
    full_path: str,
    all_users: bool,
) -> None:
    """Đăng ký font vào Windows registry để app khác thấy.

    Per-user:  HKEY_CURRENT_USER\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts
    All-user:  HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts
    """
    if sys.platform != "win32":
        return
    import winreg

    hive = winreg.HKEY_LOCAL_MACHINE if all_users else winreg.HKEY_CURRENT_USER
    sub = r"Software\Microsoft\Windows NT\CurrentVersion\Fonts"
    value_name = f"{family} (TrueType)"
    # All-users registry yêu cầu đường dẫn TUYỆT ĐỐI; per-user thì chỉ cần
    # filename (vì Windows tự resolve trong %LOCALAPPDATA%\Microsoft\Windows\Fonts).
    value_data = full_path if all_users else file_name

    with winreg.CreateKeyEx(hive, sub, 0, winreg.KEY_SET_VALUE) as key:
        winreg.SetValueEx(key, value_name, 0, winreg.REG_SZ, value_data)


def _broadcast_font_change() -> None:
    """Gửi WM_FONTCHANGE để các app đang mở re-enumerate fonts."""
    if sys.platform != "win32":
        return
    try:
        import ctypes
        HWND_BROADCAST  = 0xFFFF
        WM_FONTCHANGE   = 0x001D
        SMTO_ABORTIFHUNG = 0x0002
        ctypes.windll.user32.SendMessageTimeoutW(
            HWND_BROADCAST, WM_FONTCHANGE, 0, 0,
            SMTO_ABORTIFHUNG, 1000, None,
        )
    except Exception:
        pass


# ---------- Convenience: spawn worker thread ----------

def run_install_async(
    tasks: list[InstallTask],
    *,
    all_users: bool = True,       # DEFAULT: system-wide (C:\Windows\Fonts)
    on_progress=None,
    on_file=None,
    on_finished=None,
) -> tuple[QThread, InstallWorker]:
    """Tạo worker + QThread, wire signal, start. Caller giữ ref để không bị GC.

    Returns: (thread, worker) — caller phải giữ tham chiếu cả 2.
    """
    thread = QThread()
    worker = InstallWorker(tasks, all_users=all_users)
    worker.moveToThread(thread)

    if on_progress is not None:
        worker.progress.connect(on_progress)
    if on_file is not None:
        worker.fileInstalled.connect(on_file)
    if on_finished is not None:
        worker.finished.connect(on_finished)

    thread.started.connect(worker.run)
    worker.finished.connect(thread.quit)
    worker.finished.connect(worker.deleteLater)
    thread.finished.connect(thread.deleteLater)

    thread.start()
    return thread, worker
