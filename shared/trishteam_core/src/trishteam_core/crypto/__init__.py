"""trishteam_core.crypto — AES-GCM data encryption cho tier 3 .tpack.

Exports:
    encrypt_bytes, decrypt_bytes: raw encrypt/decrypt với key sẵn.
    derive_app_key:               HKDF key từ app_id + build_salt (+ optional pepper).
    encrypt_file, decrypt_file:   file-level helper (đọc/ghi .enc).
    load_encrypted_json, load_encrypted_text:
        runtime helper cho app đọc data/*.enc trong .tpack đã install.

Format `.enc` (v1):
    MAGIC  4 bytes "TAEV"       (TrishTEAM AES/GCM v)
    VER    1 byte  0x01
    NLEN   1 byte  = 12         (nonce length)
    NONCE  12 bytes
    BODY   n bytes              (ciphertext || 16-byte GCM tag)

Xem docs/PACKAGING.md §4.3 để biết threat model.
"""

from .aes import (
    DEFAULT_CONTEXT,
    MAGIC,
    AESFormatError,
    decrypt_bytes,
    decrypt_file,
    derive_app_key,
    encrypt_bytes,
    encrypt_file,
    load_encrypted_json,
    load_encrypted_text,
)

__all__ = [
    "DEFAULT_CONTEXT",
    "MAGIC",
    "AESFormatError",
    "decrypt_bytes",
    "decrypt_file",
    "derive_app_key",
    "encrypt_bytes",
    "encrypt_file",
    "load_encrypted_json",
    "load_encrypted_text",
]
