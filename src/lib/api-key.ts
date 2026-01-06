/**
 * API Key utilities for Phone Integration
 * Handles generation, hashing, and display of API keys
 */

/**
 * Generate a secure API key with the sgp_live_ prefix
 * Returns a 72-character key
 */
export function generateApiKey(): string {
  const prefix = "sgp_live_";
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const hexString = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return prefix + hexString;
}

/**
 * Extract display prefix from full key for UI display
 * Returns something like "sgp_live_abc12345..."
 */
export function getKeyPrefix(fullKey: string): string {
  if (fullKey.length <= 20) return fullKey;
  return fullKey.substring(0, 20) + "...";
}

/**
 * Hash an API key for secure storage using SHA-256
 * Uses Web Crypto API (SubtleCrypto)
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
