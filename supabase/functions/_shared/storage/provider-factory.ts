/**
 * Storage provider factory.
 *
 * Reads the STORAGE_PROVIDER environment variable and returns the correct
 * StorageProvider implementation. Validates credentials eagerly so that
 * misconfiguration fails at startup rather than at the first upload attempt.
 *
 * Usage inside an Edge Function:
 *
 *   import { createStorageProvider } from '../_shared/storage/provider-factory.ts';
 *
 *   const provider = createStorageProvider();
 *   const bucket = Deno.env.get('STORAGE_PROVIDER') === 'gcs'
 *     ? Deno.env.get('GCS_BUCKET')!
 *     : Deno.env.get('AWS_S3_BUCKET')!;
 *   const result = await provider.upload({ file, key, contentType, bucket });
 */

import type { StorageProvider, StorageProviderName } from './types.ts';
import { validateS3Config, validateGCSConfig } from './config.ts';
import { S3Provider } from './s3-provider.ts';
import { GCSProvider } from './gcs-provider.ts';

/**
 * Create and return the configured StorageProvider instance.
 *
 * The factory validates required credentials for the selected provider and
 * throws a descriptive error listing every missing environment variable so
 * operators can fix Supabase Secrets in a single step.
 *
 * @returns A ready-to-use StorageProvider (S3Provider or GCSProvider).
 * @throws {Error} When STORAGE_PROVIDER is unknown or required secrets are missing.
 */
export function createStorageProvider(): StorageProvider {
  const providerName = (
    Deno.env.get('STORAGE_PROVIDER') || 's3'
  ).toLowerCase().trim() as StorageProviderName;

  console.log(`[StorageFactory] Provider selected: ${providerName}`);

  switch (providerName) {
    case 's3': {
      const config = validateS3Config();
      return new S3Provider(config);
    }
    case 'gcs': {
      const config = validateGCSConfig();
      return new GCSProvider(config);
    }
    default:
      throw new Error(
        `[StorageFactory] Unknown provider: "${providerName}". ` +
          'Accepted values: "s3", "gcs".'
      );
  }
}
