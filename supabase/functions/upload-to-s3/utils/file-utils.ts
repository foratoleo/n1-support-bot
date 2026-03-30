import { FileValidationResult, ALLOWED_FILE_TYPES, FILE_CONSTRAINTS, AllowedFileType } from "../types.ts";

/**
 * Generate a URL-safe slug from filename with timestamp
 * @param filename Original filename
 * @returns Slugified filename with timestamp
 */
export function generateSlug(filename: string): string {
  if (!filename) {
    throw new Error("Filename is required");
  }

  const parts = filename.split('.');
  const extension = parts.length > 1 ? parts.pop() : '';
  const nameWithoutExt = parts.join('.');

  // Create slug from filename (without extension)
  const slug = nameWithoutExt
    .toLowerCase()
    .normalize('NFD') // Decompose combined characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .replace(/[^a-z0-9\s-_]/g, '') // Remove special characters, keep spaces, hyphens, underscores
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[-_]+/g, '-') // Replace multiple hyphens/underscores with single hyphen
    .trim()
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  // Ensure slug is not empty
  const finalSlug = slug || 'file';

  // Add timestamp for uniqueness
  const timestamp = Date.now();

  // Construct final filename
  return extension ? `${finalSlug}_${timestamp}.${extension}` : `${finalSlug}_${timestamp}`;
}

/**
 * Validate uploaded file against constraints
 * @param file File object to validate
 * @returns Validation result with success status and optional error
 */
export function validateFile(file: File): FileValidationResult {
  // Check if file exists
  if (!file) {
    return { valid: false, error: "No file provided" };
  }

  // Check file size constraints
  if (file.size < FILE_CONSTRAINTS.MIN_SIZE) {
    return { valid: false, error: "File cannot be empty" };
  }

  if (file.size > FILE_CONSTRAINTS.MAX_SIZE) {
    const maxSizeMB = Math.round(FILE_CONSTRAINTS.MAX_SIZE / (1024 * 1024));
    return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` };
  }

  // Check filename length
  if (file.name.length > FILE_CONSTRAINTS.MAX_FILENAME_LENGTH) {
    return {
      valid: false,
      error: `Filename too long (max ${FILE_CONSTRAINTS.MAX_FILENAME_LENGTH} characters)`
    };
  }

  // Check MIME type
  if (!isAllowedFileType(file.type)) {
    return {
      valid: false,
      error: `File type '${file.type}' is not allowed. Please use supported formats.`
    };
  }

  // Check file extension matches MIME type (basic validation)
  const extensionValidation = validateFileExtension(file.name, file.type);
  if (!extensionValidation.valid) {
    return extensionValidation;
  }

  return { valid: true };
}

/**
 * Check if file type is in allowed list
 * @param mimeType MIME type to check
 * @returns True if file type is allowed
 */
export function isAllowedFileType(mimeType: string): mimeType is AllowedFileType {
  return ALLOWED_FILE_TYPES.includes(mimeType as AllowedFileType);
}

/**
 * Validate file extension matches MIME type
 * @param filename Original filename
 * @param mimeType File MIME type
 * @returns Validation result
 */
export function validateFileExtension(filename: string, mimeType: string): FileValidationResult {
  const extension = filename.split('.').pop()?.toLowerCase();

  if (!extension) {
    return { valid: false, error: "File must have an extension" };
  }

  // Common MIME type to extension mappings
  const mimeToExtensions: Record<string, string[]> = {
    // Images
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/gif': ['gif'],
    'image/webp': ['webp'],
    'image/svg+xml': ['svg'],
    'image/bmp': ['bmp'],
    'image/tiff': ['tiff', 'tif'],
    'image/ico': ['ico'],

    // Documents
    'application/pdf': ['pdf'],
    'text/plain': ['txt'],
    'text/csv': ['csv'],
    'text/markdown': ['md', 'markdown'],
    'text/x-markdown': ['md', 'markdown'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
    'application/msword': ['doc'],
    'application/vnd.ms-excel': ['xls'],
    'application/vnd.ms-powerpoint': ['ppt'],

    // Data formats
    'application/json': ['json'],
    'application/xml': ['xml'],
    'text/xml': ['xml'],

    // Audio formats
    'audio/mpeg': ['mp3', 'mpeg'],
    'audio/mp3': ['mp3'],
    'audio/wav': ['wav'],
    'audio/wave': ['wav'],
    'audio/x-wav': ['wav'],
    'audio/ogg': ['ogg'],
    'audio/vorbis': ['ogg'],
    'audio/opus': ['opus'],
    'audio/mp4': ['m4a', 'mp4a'],
    'audio/m4a': ['m4a'],
    'audio/aac': ['aac'],
    'audio/x-aac': ['aac'],
    'audio/flac': ['flac'],
    'audio/x-flac': ['flac'],
    'audio/webm': ['webm'],
    'audio/amr': ['amr'],
    'audio/3gpp': ['3gp'],
    'audio/3gpp2': ['3g2'],
    'audio/x-ms-wma': ['wma'],
    'audio/wma': ['wma'],
    'audio/x-ms-wmv': ['wmv'],
    'audio/aiff': ['aiff', 'aif'],
    'audio/x-aiff': ['aiff', 'aif'],
    'audio/au': ['au'],
    'audio/basic': ['au', 'snd'],

    // Video formats
    'video/mp4': ['mp4'],
    'video/mpeg': ['mpeg', 'mpg'],
    'video/quicktime': ['mov'],
    'video/webm': ['webm'],
    'video/x-msvideo': ['avi'],
    'video/avi': ['avi'],
    'video/x-ms-wmv': ['wmv'],
    'video/wmv': ['wmv'],
    'video/x-flv': ['flv'],
    'video/3gpp': ['3gp'],
    'video/3gpp2': ['3g2'],
    'video/x-matroska': ['mkv'],
    'video/mkv': ['mkv'],
    'video/ogg': ['ogv'],
    'video/mp2t': ['ts'],
    'video/x-m4v': ['m4v'],
    'video/m4v': ['m4v'],

    // Archives
    'application/zip': ['zip'],
    'application/x-rar-compressed': ['rar'],
    'application/x-tar': ['tar'],
    'application/gzip': ['gz'],
  };

  const expectedExtensions = mimeToExtensions[mimeType];
  if (expectedExtensions && !expectedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `File extension '.${extension}' doesn't match MIME type '${mimeType}'`
    };
  }

  return { valid: true };
}

/**
 * Get human-readable file size
 * @param bytes File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Generate S3 key path for file
 * @param project Project identifier
 * @param filename Generated filename
 * @returns S3 key path
 */
export function generateS3Key(project: string, filename: string): string {
  // Sanitize project name for S3 key
  const sanitizedProject = project
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-+|-+$/g, '');

  return `drai_files/${sanitizedProject}/${filename}`;
}

/**
 * Extract file metadata for logging
 * @param file File object
 * @returns File metadata object
 */
export function extractFileMetadata(file: File) {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
    formattedSize: formatFileSize(file.size),
  };
}