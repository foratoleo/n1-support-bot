// file: supabase/functions/_shared/encryption.ts
// Runtime: Supabase Edge Function (Deno)
// Purpose: AES-256-GCM encryption for OAuth tokens using Deno Web Crypto API

// --- Environment Variables (lazy initialization) ---
let _encryptionKey: string | null = null;

/**
 * Get encryption key from environment (lazy initialization)
 * Validates on first use instead of module load time to prevent crashes
 */
function getEncryptionKey(): string {
  if (_encryptionKey !== null) {
    return _encryptionKey;
  }

  const key = Deno.env.get("ENCRYPTION_KEY");
  if (!key) {
    throw new Error("Missing env: ENCRYPTION_KEY");
  }

  _encryptionKey = key;
  return _encryptionKey;
}

// Convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Convert Uint8Array to hex string
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Get crypto key from environment variable
async function getCryptoKey(): Promise<CryptoKey> {
  const keyBytes = hexToBytes(getEncryptionKey());

  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt plaintext using AES-256-GCM
 * Returns format: iv:ciphertext (both hex-encoded)
 */
export async function encryptToken(plaintext: string): Promise<string> {
  try {
    const key = await getCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
    const encodedPlaintext = new TextEncoder().encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encodedPlaintext
    );

    const ivHex = bytesToHex(iv);
    const ciphertextHex = bytesToHex(new Uint8Array(ciphertext));

    return `${ivHex}:${ciphertextHex}`;
  } catch (error) {
    console.error("[Encryption] Error encrypting token:", error);
    throw new Error("Failed to encrypt token");
  }
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * Expects format: iv:ciphertext (both hex-encoded)
 */
export async function decryptToken(ciphertext: string): Promise<string> {
  try {
    const [ivHex, ciphertextHex] = ciphertext.split(":");

    if (!ivHex || !ciphertextHex) {
      throw new Error("Invalid ciphertext format");
    }

    const key = await getCryptoKey();
    const iv = hexToBytes(ivHex);
    const encryptedData = hexToBytes(ciphertextHex);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encryptedData
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("[Encryption] Error decrypting token:", error);
    throw new Error("Failed to decrypt token");
  }
}
