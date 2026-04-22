"""AES-GCM encrypt/decrypt + HKDF key derivation cho tier 3 data files.

Threat model (v1):
    - Attacker là end-user cài .tpack bình thường, mở file bằng Notepad / hex
      editor để coi template/formula. Mục tiêu: không đọc được plaintext.
    - Attacker KHÔNG phải reverse engineer — nếu mod runtime/dump memory thì
      đánh bại được tất cả client-side encryption (xem docs/PACKAGING.md).

Key derivation:
    key = HKDF_SHA256(
        ikm  = b"trishteam-v1-" || app_id.encode() || build_salt,
        info = b"aes-gcm-256-data-v1",
        salt = b"trishteam-kdf-salt-v1",
        length = 32,
    )

    `build_salt` là 16 byte random, sinh 1 lần / build, ghi vào
    manifest.protection.encryption.salt (hex). Runtime đọc manifest → derive
    key → decrypt. Salt + app_id cùng ship nên đây là "obfuscation at rest"
    chứ không phải protection thật sự — nhưng đủ chặn xem file bằng
    Notepad / grep / công cụ viết office tools.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

# ─────────────────────────── format constants ───────────────────────────

MAGIC = b"TAEV"  # TrishTEAM AES v
VERSION = 0x01
NONCE_LEN = 12   # 96-bit GCM nonce (recommended)
TAG_LEN = 16     # AES-GCM tag

_HEADER_LEN = len(MAGIC) + 1 + 1 + NONCE_LEN  # 4+1+1+12 = 18

DEFAULT_CONTEXT = b"aes-gcm-256-data-v1"
_KDF_SALT = b"trishteam-kdf-salt-v1"
_IKM_PREFIX = b"trishteam-v1-"


class AESFormatError(ValueError):
    """Raise khi file .enc không đúng magic/version/length."""


# ─────────────────────────── key derivation ───────────────────────────


def derive_app_key(
    app_id: str,
    build_salt: bytes,
    *,
    context: bytes = DEFAULT_CONTEXT,
) -> bytes:
    """Derive 32-byte AES-256 key cho một app tpack.

    Tham số:
        app_id:      `manifest.id` (ví dụ "trishlibrary").
        build_salt:  16 byte random sinh lúc build (đọc từ manifest).
        context:     HKDF info — thay đổi nếu muốn rotate schema.

    Return:
        32-byte key, dùng cho AES-GCM-256.
    """
    if not app_id:
        raise ValueError("app_id không được rỗng")
    if not isinstance(build_salt, (bytes, bytearray)) or len(build_salt) < 8:
        raise ValueError("build_salt phải là bytes ≥ 8 (nên 16)")

    ikm = _IKM_PREFIX + app_id.encode("utf-8") + bytes(build_salt)
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_KDF_SALT,
        info=context,
    )
    return hkdf.derive(ikm)


# ─────────────────────────── raw bytes API ───────────────────────────


def encrypt_bytes(plaintext: bytes, key: bytes, *, aad: bytes | None = None) -> bytes:
    """Encrypt bytes → header + ciphertext. Sinh nonce ngẫu nhiên.

    AAD (associated data) optional — nếu dùng, phải cung cấp lại y hệt khi
    decrypt. Hiện tại không expose qua file-level API.
    """
    if len(key) != 32:
        raise ValueError(f"key phải 32 byte (AES-256), got {len(key)}")
    nonce = os.urandom(NONCE_LEN)
    aesgcm = AESGCM(key)
    body = aesgcm.encrypt(nonce, plaintext, aad)
    return MAGIC + bytes([VERSION, NONCE_LEN]) + nonce + body


def decrypt_bytes(payload: bytes, key: bytes, *, aad: bytes | None = None) -> bytes:
    """Decrypt payload viết bởi `encrypt_bytes`. Raise AESFormatError nếu
    magic/version sai.
    """
    if len(payload) < _HEADER_LEN + TAG_LEN:
        raise AESFormatError(
            f"payload quá ngắn ({len(payload)} byte) — tối thiểu "
            f"{_HEADER_LEN + TAG_LEN}")
    if payload[:4] != MAGIC:
        raise AESFormatError(f"magic sai: {payload[:4]!r} (expect {MAGIC!r})")
    ver = payload[4]
    if ver != VERSION:
        raise AESFormatError(f"version sai: {ver} (expect {VERSION})")
    nlen = payload[5]
    if nlen != NONCE_LEN:
        raise AESFormatError(f"nonce length sai: {nlen} (expect {NONCE_LEN})")
    nonce = payload[6 : 6 + NONCE_LEN]
    body = payload[6 + NONCE_LEN:]
    if len(key) != 32:
        raise ValueError(f"key phải 32 byte, got {len(key)}")
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, body, aad)


# ─────────────────────────── file-level API ───────────────────────────


def encrypt_file(
    src: Path,
    dst: Path,
    key: bytes,
    *,
    aad: bytes | None = None,
) -> int:
    """Đọc plaintext từ `src`, ghi encrypted vào `dst` (.enc). Return size dst.

    `dst.parent` phải tồn tại.
    """
    plaintext = Path(src).read_bytes()
    payload = encrypt_bytes(plaintext, key, aad=aad)
    Path(dst).write_bytes(payload)
    return len(payload)


def decrypt_file(
    src: Path,
    key: bytes,
    *,
    aad: bytes | None = None,
) -> bytes:
    """Đọc `src` (file .enc), return plaintext bytes."""
    payload = Path(src).read_bytes()
    return decrypt_bytes(payload, key, aad=aad)


def load_encrypted_text(
    enc_path: Path,
    app_id: str,
    build_salt: bytes,
    *,
    encoding: str = "utf-8",
) -> str:
    """Convenience cho runtime: derive key + decrypt + decode UTF-8."""
    key = derive_app_key(app_id, build_salt)
    return decrypt_file(enc_path, key).decode(encoding)


def load_encrypted_json(
    enc_path: Path,
    app_id: str,
    build_salt: bytes,
) -> Any:
    """Convenience: decrypt + json.loads."""
    return json.loads(load_encrypted_text(enc_path, app_id, build_salt))


# ─────────────────────────── manifest helpers ───────────────────────────


def build_salt_from_manifest(manifest: dict) -> bytes:
    """Đọc `manifest.protection.encryption.salt` (hex) → bytes.

    Raise KeyError / ValueError nếu manifest thiếu/sai format.
    """
    try:
        salt_hex = (
            manifest["protection"]["encryption"]["salt"]
        )
    except KeyError as e:
        raise KeyError(
            "Manifest không có protection.encryption.salt — app này không "
            f"encrypt data (hoặc build với tier < 3)."
        ) from e
    return bytes.fromhex(salt_hex)
