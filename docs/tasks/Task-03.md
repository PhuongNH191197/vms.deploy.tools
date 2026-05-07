## Task-03: Credential encryption (AES-256-GCM)

STATUS: DONE
DATE: 2026-05-07

FILES_MODIFIED:
  - src-tauri/src/crypto.rs — encrypt(plaintext) → Vec<u8>, decrypt(bytes) → String

NOTES:
  - Algorithm: AES-256-GCM, key=32-byte app seed
  - Nonce: random 12-byte OsRng per encrypt call
  - Format: base64(nonce[12] || ciphertext)
  - ⚠️ TODO production: derive key from Windows DPAPI + machine ID (không hardcode seed)
  - cargo check: PASS (14 unused warnings — expected)

NEXT_TASK: T04 — Server CRUD hoàn chỉnh (đã xong server_repo.rs ở T02)
            → T05 — SSH connect module
