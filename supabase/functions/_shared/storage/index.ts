/**
 * Public API of the _shared/storage module.
 *
 * Edge Functions should import exclusively from this barrel file:
 *
 *   import { createStorageProvider } from '../_shared/storage/index.ts';
 *   import type { StorageProvider, UploadResult } from '../_shared/storage/index.ts';
 */

// Types and interfaces
export type {
  StorageProviderName,
  UploadParams,
  UploadResult,
  PresignedUploadParams,
  PresignedUploadMethod,
  PresignedUploadResult,
  PresignedDownloadParams,
  PresignedDownloadResult,
  StorageConfigValidationResult,
  StorageProvider,
  S3Config,
  GCSConfig,
} from './types.ts';

// Configuration validators and helpers
export { validateS3Config, validateGCSConfig, getActiveBucket } from './config.ts';

// Provider factory (re-exported once provider-factory.ts is created in T2)
export { createStorageProvider } from './provider-factory.ts';
