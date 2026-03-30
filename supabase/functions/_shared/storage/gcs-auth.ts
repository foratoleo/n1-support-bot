/**
 * GCS authentication module for Supabase Edge Functions (Deno runtime).
 *
 * Implements Google Cloud Service Account authentication via JWT (RS256)
 * using the Web Crypto API (crypto.subtle) — no external SDK required.
 *
 * Two public functions:
 *
 * 1. `generateGCSAccessToken` — exchanges a self-signed JWT for an
 *    OAuth2 access token through Google's token endpoint.
 *
 * 2. `generateGCSSignedUrl` — creates a V2 Signed URL by delegating
 *    the blob signing to the IAM `signBlob` REST API.
 *
 * References:
 * - https://developers.google.com/identity/protocols/oauth2/service-account
 * - https://cloud.google.com/storage/docs/access-control/signed-urls
 * - https://cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/signBlob
 */

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Encode a string to URL-safe Base64 (RFC 4648 Section 5).
 * Replaces `+` with `-`, `/` with `_`, and strips trailing `=` padding.
 */
function base64UrlEncode(input: string): string {
  return btoa(input)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Convert a PEM-encoded PKCS#8 private key into a raw `Uint8Array`
 * suitable for `crypto.subtle.importKey`.
 */
function pemToUint8Array(pem: string): Uint8Array {
  const stripped = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryString = atob(stripped);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Import a PEM RSA private key as a `CryptoKey` for RS256 signing.
 */
async function importRSAPrivateKey(pem: string): Promise<CryptoKey> {
  const keyData = pemToUint8Array(pem);

  try {
    return await crypto.subtle.importKey(
      'pkcs8',
      keyData,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
  } catch (err) {
    throw new Error(
      `[GCS Auth] Failed to import RSA private key. Ensure GCS_PRIVATE_KEY is a valid PKCS#8 PEM: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

// ─────────────────────────────────────────────
// generateGCSAccessToken
// ─────────────────────────────────────────────

/**
 * Generate an OAuth2 access token for a Google Cloud Service Account.
 *
 * Flow:
 * 1. Build a JWT with `RS256` header and standard Service Account claims.
 * 2. Sign the JWT using the Service Account's RSA private key via Web Crypto API.
 * 3. Exchange the signed JWT for an access token at Google's OAuth2 token endpoint.
 *
 * @param clientEmail - Service Account email (e.g. `sa@project.iam.gserviceaccount.com`)
 * @param privateKey  - RSA private key in PEM format (PKCS#8, newlines already processed)
 * @param scopes      - OAuth2 scopes to request (e.g. `['https://www.googleapis.com/auth/devstorage.read_write']`)
 * @returns The access token string, valid for up to 1 hour.
 * @throws {Error} With `[GCS Auth]` prefix on any failure.
 */
export async function generateGCSAccessToken(
  clientEmail: string,
  privateKey: string,
  scopes: string[],
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  // JWT header
  const header = { alg: 'RS256', typ: 'JWT' };

  // JWT claims (as per Google Service Account spec)
  const claims = {
    iss: clientEmail,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: expiry,
    iat: now,
  };

  // Encode header and claims as Base64Url
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const claimsB64 = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${headerB64}.${claimsB64}`;

  // Import the RSA private key
  const cryptoKey = await importRSAPrivateKey(privateKey);

  // Sign the JWT
  const encoder = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signingInput),
  );

  // Encode signature as Base64Url
  const signatureBytes = new Uint8Array(signatureBuffer);
  const signatureB64 = base64UrlEncode(
    Array.from(signatureBytes, (b) => String.fromCharCode(b)).join(''),
  );

  const jwt = `${signingInput}.${signatureB64}`;

  // Exchange JWT for OAuth2 access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    throw new Error(
      `[GCS Auth] Failed to obtain access token (HTTP ${tokenResponse.status}): ${errorBody}`,
    );
  }

  const tokenData = await tokenResponse.json();

  if (!tokenData.access_token) {
    throw new Error(
      '[GCS Auth] Token response did not contain an access_token field.',
    );
  }

  return tokenData.access_token as string;
}

// ─────────────────────────────────────────────
// generateGCSSignedUrl
// ─────────────────────────────────────────────

/** Parameters for generating a GCS V2 Signed URL via IAM signBlob. */
export interface GCSSignedUrlParams {
  /** GCS bucket name */
  bucket: string;
  /** Object key (path) inside the bucket */
  key: string;
  /** HTTP method the signed URL will authorize */
  method: 'GET' | 'PUT';
  /** Content-Type header (required for PUT, optional for GET) */
  contentType?: string;
  /** URL validity duration in seconds */
  expiresIn: number;
  /** OAuth2 Bearer token (from `generateGCSAccessToken`) */
  accessToken: string;
  /** Service Account email (used as GoogleAccessId) */
  clientEmail: string;
}

/**
 * Generate a GCS V2 Signed URL using the IAM `signBlob` REST API.
 *
 * This avoids needing the raw private key on the client side for signing —
 * the IAM API signs the blob server-side using the Service Account's key.
 *
 * V2 Signing format:
 * ```
 * StringToSign = HTTP_METHOD\nContent-MD5\nContent-Type\nExpiry\n/bucket/key
 * ```
 *
 * @returns A fully-formed Signed URL that can be used directly by the client.
 * @throws {Error} With `[GCS Auth]` prefix on any failure.
 */
export async function generateGCSSignedUrl(
  params: GCSSignedUrlParams,
): Promise<string> {
  const {
    bucket,
    key,
    method,
    contentType,
    expiresIn,
    accessToken,
    clientEmail,
  } = params;

  const expiry = Math.floor(Date.now() / 1000) + expiresIn;

  // Build the V2 string-to-sign
  const resource = `/${bucket}/${key}`;
  const stringToSign = [
    method,
    '',                    // Content-MD5 (empty)
    contentType || '',     // Content-Type (empty for GET)
    expiry.toString(),
    resource,
  ].join('\n');

  // Delegate signing to the IAM signBlob API
  const signBlobUrl =
    `https://iam.googleapis.com/v1/projects/-/serviceAccounts/${clientEmail}:signBlob`;

  const signResponse = await fetch(signBlobUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      payload: (() => {
        const enc = new TextEncoder();
        const bytes = enc.encode(stringToSign);
        return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
      })(),
    }),
  });

  if (!signResponse.ok) {
    const errorBody = await signResponse.text();
    throw new Error(
      `[GCS Auth] Failed to sign URL via IAM signBlob (HTTP ${signResponse.status}): ${errorBody}`,
    );
  }

  const signData = await signResponse.json();

  if (!signData.signedBlob) {
    throw new Error(
      '[GCS Auth] signBlob response did not contain a signedBlob field.',
    );
  }

  // Build the final Signed URL
  const queryParams = new URLSearchParams({
    GoogleAccessId: clientEmail,
    Expires: expiry.toString(),
    Signature: signData.signedBlob,
  });

  return `https://storage.googleapis.com${resource}?${queryParams.toString()}`;
}
