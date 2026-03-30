import { RequestValidation, FILE_CONSTRAINTS, ALLOWED_FILE_TYPES, AllowedFileType } from "../types.ts";

/**
 * Validate project field from request body
 * @param project Project string from request body
 * @returns Validation result with error message if invalid
 */
export function validateProject(project: string | null): { valid: boolean; error?: string } {
  if (!project) {
    return { valid: false, error: "Project field is required" };
  }

  if (typeof project !== 'string') {
    return { valid: false, error: "Project must be a string" };
  }

  const trimmedProject = project.trim();

  if (trimmedProject.length < FILE_CONSTRAINTS.MIN_PROJECT_LENGTH) {
    return { valid: false, error: "Project name cannot be empty" };
  }

  if (trimmedProject.length > FILE_CONSTRAINTS.MAX_PROJECT_LENGTH) {
    return {
      valid: false,
      error: `Project name too long (max ${FILE_CONSTRAINTS.MAX_PROJECT_LENGTH} characters)`
    };
  }

  // Check for valid project name characters (alphanumeric, hyphens, underscores, spaces)
  if (!/^[a-zA-Z0-9\s_-]+$/.test(trimmedProject)) {
    return {
      valid: false,
      error: "Project name can only contain letters, numbers, spaces, hyphens, and underscores"
    };
  }

  return { valid: true };
}

/**
 * Validate filename
 * @param filename Original filename
 * @returns Validation result
 */
export function validateFilename(filename: string | null): { valid: boolean; error?: string } {
  if (!filename) {
    return { valid: false, error: "Filename is required" };
  }

  if (typeof filename !== 'string') {
    return { valid: false, error: "Filename must be a string" };
  }

  const trimmedFilename = filename.trim();

  if (trimmedFilename.length === 0) {
    return { valid: false, error: "Filename cannot be empty" };
  }

  if (trimmedFilename.length > FILE_CONSTRAINTS.MAX_FILENAME_LENGTH) {
    return {
      valid: false,
      error: `Filename too long (max ${FILE_CONSTRAINTS.MAX_FILENAME_LENGTH} characters)`
    };
  }

  // Check if filename has extension
  if (!trimmedFilename.includes('.')) {
    return { valid: false, error: "Filename must have an extension" };
  }

  return { valid: true };
}

/**
 * Validate content type against allowed types
 * @param contentType MIME type to validate
 * @returns Validation result
 */
export function validateContentType(contentType: string | null): { valid: boolean; error?: string } {
  if (!contentType) {
    return { valid: false, error: "Content type is required" };
  }

  if (typeof contentType !== 'string') {
    return { valid: false, error: "Content type must be a string" };
  }

  const trimmedType = contentType.trim().toLowerCase();

  if (!ALLOWED_FILE_TYPES.includes(trimmedType as AllowedFileType)) {
    return {
      valid: false,
      error: `File type '${contentType}' is not allowed. Please use supported formats.`
    };
  }

  return { valid: true };
}

/**
 * Validate file size (basic validation only - S3 policy handles actual limits)
 * @param fileSize File size in bytes
 * @returns Validation result
 */
export function validateFileSize(fileSize: number | null): { valid: boolean; error?: string } {
  if (fileSize === null || fileSize === undefined) {
    return { valid: false, error: "File size is required" };
  }

  if (typeof fileSize !== 'number' || isNaN(fileSize)) {
    return { valid: false, error: "File size must be a number" };
  }

  if (fileSize < FILE_CONSTRAINTS.MIN_SIZE) {
    return { valid: false, error: "File cannot be empty" };
  }

  // Remove size limit validation - S3 policy handles this via content-length-range
  // Edge Function should only generate presigned URL, not validate file content
  // if (fileSize > FILE_CONSTRAINTS.MAX_SIZE) {
  //   const maxSizeMB = Math.round(FILE_CONSTRAINTS.MAX_SIZE / (1024 * 1024));
  //   return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` };
  // }

  return { valid: true };
}

/**
 * Validate entire presigned upload request
 * @param body Request body object
 * @returns Validation result with parsed data and errors
 */
export function validatePresignedRequest(body: unknown): RequestValidation {
  const errors: string[] = [];

  // Extract fields from request body
  const project = body?.project;
  const filename = body?.filename;
  const contentType = body?.contentType;
  const fileSize = body?.fileSize;

  // Validate each field
  const projectValidation = validateProject(project);
  if (!projectValidation.valid) {
    errors.push(projectValidation.error!);
  }

  const filenameValidation = validateFilename(filename);
  if (!filenameValidation.valid) {
    errors.push(filenameValidation.error!);
  }

  const contentTypeValidation = validateContentType(contentType);
  if (!contentTypeValidation.valid) {
    errors.push(contentTypeValidation.error!);
  }

  const fileSizeValidation = validateFileSize(fileSize);
  if (!fileSizeValidation.valid) {
    errors.push(fileSizeValidation.error!);
  }

  return {
    project,
    filename,
    contentType,
    fileSize,
    errors
  };
}

/**
 * Validate request method
 * @param request HTTP request object
 * @returns Validation result
 */
export function validateRequestMethod(request: Request): { valid: boolean; error?: string } {
  if (request.method !== "POST") {
    return {
      valid: false,
      error: `Method ${request.method} not allowed. Use POST.`
    };
  }

  return { valid: true };
}

/**
 * Sanitize project name for use in S3 paths
 * @param project Raw project name
 * @returns Sanitized project name safe for S3 keys
 */
export function sanitizeProjectName(project: string): string {
  return project
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '') // Remove invalid characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[-_]+/g, '-') // Replace multiple separators with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generate S3 key path for presigned upload
 * @param project Project identifier
 * @param filename Original filename
 * @returns S3 key path
 */
export function generatePresignedS3Key(project: string, filename: string): string {
  const sanitizedProject = sanitizeProjectName(project);
  const timestamp = Date.now();
  const parts = filename.split('.');
  const extension = parts.length > 1 ? parts.pop() : '';
  const nameWithoutExt = parts.join('.');

  // Create unique filename with timestamp
  const uniqueFilename = extension
    ? `${nameWithoutExt}_${timestamp}.${extension}`
    : `${nameWithoutExt}_${timestamp}`;

  return `drai_files/${sanitizedProject}/${uniqueFilename}`;
}