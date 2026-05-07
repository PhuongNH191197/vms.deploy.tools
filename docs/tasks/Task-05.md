## Task-05: SSH connect module (russh)

STATUS: DONE
DATE: 2026-05-07

FILES_MODIFIED:
  - src-tauri/src/ssh/mod.rs — SshSession struct + connect_password + connect_key + execute + disconnect

FILES_CREATED:
  - src-tauri/src/ssh/server_info.rs — placeholder for T07

NOTES:
  - russh 0.44.1 API: PublicKey from russh::keys::key::PublicKey (not russh::key)
  - async_trait crate needed for Handler impl (added to Cargo.toml)
  - connect timeout: 10s via tokio::time::timeout
  - load_secret_key from russh::keys — accepts key path + optional passphrase
  - auth_ok bool check after authenticate_password/publickey
  - execute(): channel_open_session → exec → read ChannelMsg::Data loop
  - cargo check: PASS (warnings = unused, expected)

NEXT_TASK: T06 — SSH execute (done inline in T05), move to T07 — Server info fetch
