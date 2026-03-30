/**
 * Google Cloud Storage provider implementation.
 *
 * Implements StorageProvider using the GCS JSON REST API and OAuth2 Service
 * Account authentication — no external SDK required (Deno-compatible).
 *
 * NOTE: This file is created as a stub by T2 to satisfy the static import in
 * provider-factory.ts. The full implementation is completed by T4.
 *
 * Authentication flow:
 * 1. Generate an OAuth2 access token via JWT (RS256) — see gcs-auth.ts
 * 2. Use the token in Authorization headers for GCS REST API calls
 * 3. Generate Signed URLs via IAM signBlob for presigned operations
 */

import type {
  StorageProvider,
  UploadParams,
  UploadResult,
  PresignedUploadParams,
  PresignedUploadResult,
  PresignedDownloadParams,
  PresignedDownloadResult,
  GCSConfig,
} from './types.ts';
import {
  generateGCSAccessToken,
  generateGCSSignedUrl,
} from './gcs-auth.ts';

// OAuth2 scope for GCS read/write operations
const GCS_SCOPE = 'https://www.googleapis.com/auth/devstorage.read_write';

export class GCSProvider implements StorageProvider {
  private readonly config: GCSConfig;
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(config: GCSConfig) {
    this.config = config;
  }

  // ── Private helpers ─────────────────────────

  /** Obtain an OAuth2 access token, returning a cached one when still valid. */
  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60) {
      return this.cachedToken.value;
    }
    const token = await generateGCSAccessToken(
      this.config.GCS_CLIENT_EMAIL,
      this.config.GCS_PRIVATE_KEY,
      [GCS_SCOPE],
    );
    this.cachedToken = { value: token, expiresAt: now + 3600 };
    return token;
  }

  // ── StorageProvider implementation ──────────

  /**
   * Upload a file directly to GCS using the JSON API simple upload.
   * Uses `uploadType=media` (single-request, no multipart metadata).
   */
  async upload(params: UploadParams): Promise<UploadResult> {
    const { file, key, contentType, bucket } = params;

    const accessToken = await this.getAccessToken();
    const encodedKey = encodeURIComponent(key);

    const uploadUrl =
      `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o` +
      `?uploadType=media&name=${encodedKey}`;

    const body = await file.arrayBuffer();

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': contentType,
        'Content-Length': file.size.toString(),
      },
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `[GCS] Upload failed (HTTP ${response.status}): ${errorBody}`,
      );
    }

    const data = await response.json();
    const filename = key.split('/').pop() ?? key;

    console.log('[GCSProvider] Upload completed', { key, etag: data.etag });

    return {
      filename,
      location: `https://storage.googleapis.com/${bucket}/${key}`,
      key,
      etag: data.etag,
    };
  }

  /**
   * Generate a presigned PUT URL so the browser can upload directly to GCS.
   * GCS Signed URLs use HTTP PUT with binary body (not multipart/form-data).
   */
  async generatePresignedUploadUrl(
    params: PresignedUploadParams,
  ): Promise<PresignedUploadResult> {
    const { key, contentType, bucket, expiresIn } = params;

    const accessToken = await this.getAccessToken();

    const signedUrl = await generateGCSSignedUrl({
      bucket,
      key,
      method: 'PUT',
      contentType,
      expiresIn,
      accessToken,
      clientEmail: this.config.GCS_CLIENT_EMAIL,
    });

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return {
      url: signedUrl,
      fields: {}, // GCS PUT does not use form fields
      key,
      method: 'PUT',
      expiresAt,
    };
  }

  /**
   * Generate a presigned GET URL so the browser can download a file directly
   * from GCS without going through the Edge Function.
   */
  async generatePresignedDownloadUrl(
    params: PresignedDownloadParams,
  ): Promise<PresignedDownloadResult> {
    const { key, bucket, expiresIn } = params;

    const accessToken = await this.getAccessToken();

    const downloadUrl = await generateGCSSignedUrl({
      bucket,
      key,
      method: 'GET',
      expiresIn,
      accessToken,
      clientEmail: this.config.GCS_CLIENT_EMAIL,
    });

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return { downloadUrl, expiresAt, key };
  }

  /**
   * Delete an object from the GCS bucket.
   * Treats 404 as success (object already absent).
   */
  async deleteObject(key: string): Promise<void> {
    const { bucket } = this.config;

    const accessToken = await this.getAccessToken();
    const encodedKey = encodeURIComponent(key);

    const response = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodedKey}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    // 404 means the object is already gone — treat as success
    if (!response.ok && response.status !== 404) {
      const errorBody = await response.text();

      if (response.status === 403) {
        throw new Error(
          `[GCS] ACCESS_DENIED deleting "${key}" (HTTP 403): ${errorBody}`,
        );
      }

      throw new Error(
        `[GCS] Delete failed for "${key}" (HTTP ${response.status}): ${errorBody}`,
      );
    }

    console.log('[GCSProvider] Object deleted', { key });
  }
}
