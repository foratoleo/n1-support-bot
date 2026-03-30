// TypeScript interfaces for the upload-to-presigned-s3 Edge Function

export interface PresignedUploadRequest {
  project: string;
  filename: string;
  contentType: string;
  fileSize: number;
}

export interface PresignedUploadResponse {
  success: boolean;
  url?: string;
  fields?: Record<string, string>;
  key?: string;
  expires?: string;
  /** HTTP method the client must use when uploading to the presigned URL.
   *  'POST' for S3 (multipart/form-data), 'PUT' for GCS (binary body).
   *  Optional for backwards compatibility — clients should default to 'POST'. */
  method?: 'POST' | 'PUT';
  message: string;
  error?: string;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export interface RequestValidation {
  project?: string;
  filename?: string;
  contentType?: string;
  fileSize?: number;
  errors: string[];
}

// Reuse the same ALLOWED_FILE_TYPES from the original function
export const ALLOWED_FILE_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  'image/ico',

  // Documents
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'text/x-markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/msword', // .doc
  'application/vnd.ms-excel', // .xls
  'application/vnd.ms-powerpoint', // .ppt

  // Data formats
  'application/json',
  'application/xml',
  'text/xml',

  // Audio - All major formats
  'audio/mpeg',        // MP3
  'audio/mp3',         // MP3 alternative
  'audio/wav',         // WAV
  'audio/wave',        // WAV alternative
  'audio/x-wav',       // WAV alternative
  'audio/ogg',         // OGG
  'audio/vorbis',      // OGG Vorbis
  'audio/opus',        // Opus
  'audio/mp4',         // M4A
  'audio/m4a',         // M4A alternative
  'audio/aac',         // AAC
  'audio/x-aac',       // AAC alternative
  'audio/flac',        // FLAC
  'audio/x-flac',      // FLAC alternative
  'audio/webm',        // WebM Audio
  'audio/amr',         // AMR
  'audio/3gpp',        // 3GP Audio
  'audio/3gpp2',       // 3GP2 Audio
  'audio/x-ms-wma',    // WMA
  'audio/wma',         // WMA alternative
  'audio/x-ms-wmv',    // WMV Audio
  'audio/aiff',        // AIFF
  'audio/x-aiff',      // AIFF alternative
  'audio/au',          // AU
  'audio/basic',       // AU alternative

  // Video - All major formats
  'video/mp4',         // MP4
  'video/mpeg',        // MPEG
  'video/quicktime',   // MOV
  'video/webm',        // WebM
  'video/x-msvideo',   // AVI
  'video/avi',         // AVI alternative
  'video/x-ms-wmv',    // WMV
  'video/wmv',         // WMV alternative
  'video/x-flv',       // FLV
  'video/3gpp',        // 3GP
  'video/3gpp2',       // 3GP2
  'video/x-matroska',  // MKV
  'video/mkv',         // MKV alternative
  'video/ogg',         // OGV
  'video/mp2t',        // TS
  'video/x-m4v',       // M4V
  'video/m4v',         // M4V alternative

  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-tar',
  'application/gzip',
] as const;

export type AllowedFileType = typeof ALLOWED_FILE_TYPES[number];

// Constants for validation
export const FILE_CONSTRAINTS = {
  MAX_SIZE: 500 * 1024 * 1024, // 500MB - support for large video files
  MIN_SIZE: 1, // 1 byte minimum
  MAX_FILENAME_LENGTH: 255,
  MIN_PROJECT_LENGTH: 1,
  MAX_PROJECT_LENGTH: 100,
} as const;

// Presigned URL configuration
export const PRESIGNED_CONFIG = {
  EXPIRES_IN: 15 * 60, // 15 minutes in seconds
  MAX_FILE_SIZE: 500 * 1024 * 1024, // 500MB - support for large video files
  // Remove ACL to prevent 400 errors - modern S3 buckets often have ACLs disabled
  // Use bucket policies instead for access control
  // ACL: 'bucket-owner-full-control', // REMOVED - causes 400 errors
} as const;