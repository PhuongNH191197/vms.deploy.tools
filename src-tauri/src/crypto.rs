use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use crate::error::AppError;

const APP_KEY_SEED: &[u8] = b"VMS-Deploy-Tool-2026-Secret-Key!"; // 32 bytes

fn get_cipher() -> Result<Aes256Gcm, AppError> {
    let key = Key::<Aes256Gcm>::from_slice(APP_KEY_SEED);
    Ok(Aes256Gcm::new(key))
}

/// Encrypt plaintext → base64(nonce || ciphertext)
pub fn encrypt(plaintext: &str) -> Result<Vec<u8>, AppError> {
    let cipher = get_cipher()?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| AppError::Crypto(e.to_string()))?;

    let mut combined = nonce.to_vec();
    combined.extend_from_slice(&ciphertext);

    Ok(STANDARD.encode(&combined).into_bytes())
}

/// Decrypt base64(nonce || ciphertext) → plaintext
pub fn decrypt(encrypted: &[u8]) -> Result<String, AppError> {
    let combined = STANDARD
        .decode(encrypted)
        .map_err(|e| AppError::Crypto(e.to_string()))?;

    if combined.len() < 12 {
        return Err(AppError::Crypto("Invalid encrypted data".into()));
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);
    let cipher = get_cipher()?;

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| AppError::Crypto(format!("Decrypt failed: {e}")))?;

    String::from_utf8(plaintext).map_err(|e| AppError::Crypto(e.to_string()))
}
