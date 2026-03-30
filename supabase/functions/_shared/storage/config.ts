/**
 * Storage provider configuration helpers.
 *
 * Reads and validates the environment variables required by each provider.
 * Throws clear errors listing every missing variable so operators can fix
 * Supabase Secrets in a single step.
 */

import type { S3Config, GCSConfig } from './types.ts';

// ─────────────────────────────────────────────
// Bucket resolution
// ─────────────────────────────────────────────

/**
 * Return the bucket name for the currently active storage provider.
 *
 * Reads `STORAGE_PROVIDER` (default `'s3'`) and returns the corresponding
 * bucket environment variable (`GCS_BUCKET` or `AWS_S3_BUCKET`).
 */
export function getActiveBucket(): string {
  const provider = (Deno.env.get('STORAGE_PROVIDER') || 's3').toLowerCase();
  if (provider === 'gcs') {
    return Deno.env.get('GCS_BUCKET') || '';
  }
  return Deno.env.get('AWS_S3_BUCKET') || '';
}

// ─────────────────────────────────────────────
// S3 configuration
// ─────────────────────────────────────────────

/**
 * Read and validate all AWS S3 environment variables.
 *
 * Required vars: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET
 * Optional vars: AWS_REGION (default: 'us-east-1'), AWS_S3_ACCESS_POINT, AWS_S3_ACCESS_POINT_ARN
 *
 * @throws {Error} when any required variable is absent, listing all missing names.
 */
export function validateS3Config(): S3Config {
  const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
  const s3Bucket = Deno.env.get('AWS_S3_BUCKET');
  const region = Deno.env.get('AWS_REGION') || 'us-east-1';
  const accessPoint = Deno.env.get('AWS_S3_ACCESS_POINT');
  const accessPointArn = Deno.env.get('AWS_S3_ACCESS_POINT_ARN');

  const missingVars: string[] = [];
  if (!accessKeyId) missingVars.push('AWS_ACCESS_KEY_ID');
  if (!secretAccessKey) missingVars.push('AWS_SECRET_ACCESS_KEY');
  if (!s3Bucket) missingVars.push('AWS_S3_BUCKET');

  if (missingVars.length > 0) {
    throw new Error(
      `[S3 Config] Missing required environment variables: ${missingVars.join(', ')}. ` +
        'Set them via `supabase secrets set <VAR>=<VALUE>`.'
    );
  }

  const config: S3Config = {
    AWS_ACCESS_KEY_ID: accessKeyId!,
    AWS_SECRET_ACCESS_KEY: secretAccessKey!,
    AWS_REGION: region,
    bucket: s3Bucket!,
  };

  if (accessPoint) config.AWS_S3_ACCESS_POINT = accessPoint;
  if (accessPointArn) config.AWS_S3_ACCESS_POINT_ARN = accessPointArn;

  return config;
}

// ─────────────────────────────────────────────
// GCS configuration
// ─────────────────────────────────────────────

/**
 * Read and validate all Google Cloud Storage environment variables.
 *
 * Required vars: GCS_PROJECT_ID, GCS_BUCKET, GCS_CLIENT_EMAIL, GCS_PRIVATE_KEY
 *
 * The private key is stored in Supabase Secrets with literal `\n` sequences
 * instead of real newlines. This function converts them back so the PEM key
 * is valid for the Web Crypto API.
 *
 * @throws {Error} when any required variable is absent, listing all missing names.
 */
export function validateGCSConfig(): GCSConfig {
  const projectId = Deno.env.get('GCS_PROJECT_ID');
  const gcsBucket = Deno.env.get('GCS_BUCKET');
  const clientEmail = Deno.env.get('GCS_CLIENT_EMAIL');
  const privateKeyRaw = Deno.env.get('GCS_PRIVATE_KEY');

  const missingVars: string[] = [];
  if (!projectId) missingVars.push('GCS_PROJECT_ID');
  if (!gcsBucket) missingVars.push('GCS_BUCKET');
  if (!clientEmail) missingVars.push('GCS_CLIENT_EMAIL');
  if (!privateKeyRaw) missingVars.push('GCS_PRIVATE_KEY');

  if (missingVars.length > 0) {
    throw new Error(
      `[GCS Config] Missing required environment variables: ${missingVars.join(', ')}. ` +
        'Set them via `supabase secrets set <VAR>=<VALUE>`.'
    );
  }

  // Convert literal \n sequences (from Supabase Secrets storage) back to real newlines
  const privateKey = privateKeyRaw!.replace(/\\n/g, '\n');

  return {
    GCS_PROJECT_ID: projectId!,
    bucket: gcsBucket!,
    GCS_CLIENT_EMAIL: clientEmail!,
    GCS_PRIVATE_KEY: privateKey,
  };
}
