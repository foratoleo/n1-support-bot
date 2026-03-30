// TypeScript interfaces for the upload-to-s3 Edge Function

export interface UploadResponse {
  success: boolean;
  filename?: string;
  project?: string;
  message: string;
  error?: string;
  location?: string;
}

export interface EnvironmentConfig {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION: string;
  AWS_S3_BUCKET: string;
}

export interface UploadResult {
  filename: string;
  location: string;
  etag?: string;
  key: string;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export interface UploadProgress {
  loaded: number;
  total?: number;
  percentage: number;
}

export interface RequestValidation {
  file?: File;
  project?: string;
  errors: string[];
}

// Supported MIME types for file upload
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
  MAX_SIZE: 50 * 1024 * 1024, // 50MB
  MIN_SIZE: 1, // 1 byte minimum
  MAX_FILENAME_LENGTH: 255,
  MIN_PROJECT_LENGTH: 1,
  MAX_PROJECT_LENGTH: 100,
} as const;

// S3 upload configuration
export const S3_CONFIG = {
  QUEUE_SIZE: 4,
  PART_SIZE: 5 * 1024 * 1024, // 5MB
  LEAVE_PARTS_ON_ERROR: false,
  TIMEOUT_MS: 30 * 1000, // 30 seconds
} as const;