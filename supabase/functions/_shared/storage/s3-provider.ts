/**
 * AWS S3 storage provider implementation.
 *
 * Consolidates the logic that was previously duplicated across three separate
 * utils/aws-config.ts files in the upload-to-s3, upload-to-presigned-s3 and
 * generate-presigned-download-url Edge Functions.
 */

import { S3Client } from 'npm:@aws-sdk/client-s3@^3.0.0';
import { Upload } from 'npm:@aws-sdk/lib-storage@^3.0.0';
import { createPresignedPost } from 'npm:@aws-sdk/s3-presigned-post@^3.0.0';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@^3.0.0';
import { GetObjectCommand, DeleteObjectCommand } from 'npm:@aws-sdk/client-s3@^3.0.0';

import type {
  StorageProvider,
  UploadParams,
  UploadResult,
  PresignedUploadParams,
  PresignedUploadResult,
  PresignedDownloadParams,
  PresignedDownloadResult,
  S3Config,
} from './types.ts';

// ─────────────────────────────────────────────
// Internal constants
// ─────────────────────────────────────────────

/** Multipart threshold: files larger than this use parallel upload. */
const MULTIPART_THRESHOLD = 5 * 1024 * 1024; // 5 MB

/** Part size for multipart upload (S3 minimum is 5 MB). */
const PART_SIZE = 5 * 1024 * 1024; // 5 MB

/** Parallel queue size for large files. */
const QUEUE_SIZE_LARGE = 4;

/** Parallel queue size for very large files (> 100 MB). */
const QUEUE_SIZE_XLARGE = 8;

/** Threshold above which we use the larger queue size. */
const XLARGE_THRESHOLD = 100 * 1024 * 1024; // 100 MB

// ─────────────────────────────────────────────
// S3Provider class
// ─────────────────────────────────────────────

export class S3Provider implements StorageProvider {
  private readonly config: S3Config;
  private readonly client: S3Client;

  constructor(config: S3Config) {
    this.config = config;
    this.client = this.buildClient(config);
  }

  // ── Private helpers ─────────────────────────

  private buildClient(config: S3Config): S3Client {
    return new S3Client({
      region: config.AWS_REGION,
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID.trim(),
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY.trim(),
      },
      // Use SigV4 (default for SDK v3, explicit for clarity)
      signatureVersion: 'v4',
      // Let the SDK resolve endpoints automatically — do NOT set a hardcoded
      // endpoint because it causes 400 errors when the bucket region differs.
      forcePathStyle: false,
      logger: Deno.env.get('DENO_ENV') === 'development' ? console : undefined,
    });
  }

  /**
   * Determine the optimal queue size based on file size.
   */
  private resolveQueueSize(fileSize: number): number {
    if (fileSize > XLARGE_THRESHOLD) return QUEUE_SIZE_XLARGE;
    if (fileSize > MULTIPART_THRESHOLD) return QUEUE_SIZE_LARGE;
    return 1;
  }

  // ── StorageProvider implementation ──────────

  /**
   * Upload a file directly from the Edge Function to S3 using the multipart
   * Upload utility for large files and single-part for small ones.
   */
  async upload(params: UploadParams): Promise<UploadResult> {
    const { file, key, contentType, bucket } = params;

    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: file.stream(),
        ContentType: contentType,
        ContentLength: file.size,
      },
      queueSize: this.resolveQueueSize(file.size),
      partSize: PART_SIZE,
      leavePartsOnError: false,
    });

    upload.on('httpUploadProgress', (progress) => {
      if (progress.loaded && progress.total) {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        if (percent % 25 === 0 || percent === 100) {
          console.log(`[S3Provider] Upload progress: ${percent}% (${progress.loaded}/${progress.total} bytes)`);
        }
      }
    });

    const result = await upload.done();
    console.log('[S3Provider] Upload completed', { key, etag: result.ETag });

    // Extract just the filename from the key path
    const filename = key.split('/').pop() ?? key;

    return {
      filename,
      location: result.Location ?? `https://${bucket}.s3.amazonaws.com/${key}`,
      key,
      etag: result.ETag,
    };
  }

  /**
   * Generate a presigned POST URL so the browser can upload directly to S3
   * via multipart/form-data.
   */
  async generatePresignedUploadUrl(params: PresignedUploadParams): Promise<PresignedUploadResult> {
    const { key, contentType, fileSize, bucket, expiresIn } = params;

    const presignedPost = await createPresignedPost(this.client, {
      Bucket: bucket,
      Key: key,
      Fields: {
        'Content-Type': contentType,
      },
      Conditions: [
        // Enforce file size limits
        ['content-length-range', 1, fileSize > 0 ? fileSize : 500 * 1024 * 1024],
        // Allow the exact MIME type group (e.g. 'image/' matches 'image/jpeg')
        ['starts-with', '$Content-Type', contentType.split('/')[0] + '/'],
      ],
      Expires: expiresIn,
    });

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return {
      url: presignedPost.url,
      fields: presignedPost.fields as Record<string, string>,
      key,
      method: 'POST',
      expiresAt,
    };
  }

  /**
   * Generate a presigned GET URL so the browser can download a file directly
   * from S3 without going through the Edge Function.
   */
  async generatePresignedDownloadUrl(params: PresignedDownloadParams): Promise<PresignedDownloadResult> {
    const { key, bucket, expiresIn } = params;

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const downloadUrl = await getSignedUrl(this.client, command, { expiresIn });

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return { downloadUrl, expiresAt, key };
  }

  /**
   * Delete an object from the S3 bucket.
   * Uses the bucket configured in this.config.
   */
  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    await this.client.send(command);
    console.log('[S3Provider] Object deleted', { key });
  }
}
