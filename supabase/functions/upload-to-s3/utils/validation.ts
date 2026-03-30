import { RequestValidation, FILE_CONSTRAINTS } from "../types.ts";

/**
 * Validate project field from form data
 * @param project Project string from form data
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
 * Validate entire request data from form
 * @param formData FormData object from request
 * @returns Validation result with parsed data and errors
 */
export function validateRequest(formData: FormData): RequestValidation {
  const file = formData.get("file") as File | null;
  const project = formData.get("project") as string | null;
  const errors: string[] = [];

  // Validate file presence
  if (!file) {
    errors.push("File is required");
  }

  // Validate project field
  const projectValidation = validateProject(project);
  if (!projectValidation.valid) {
    errors.push(projectValidation.error!);
  }

  return {
    file: file || undefined,
    project: project || undefined,
    errors
  };
}

/**
 * Validate request method and content type
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

  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.includes("multipart/form-data")) {
    return {
      valid: false,
      error: "Content-Type must be multipart/form-data"
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
 * Validate Content-Length header for early size checking
 * @param request HTTP request object
 * @returns Validation result
 */
export function validateContentLength(request: Request): { valid: boolean; error?: string } {
  const contentLength = request.headers.get("content-length");

  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > FILE_CONSTRAINTS.MAX_SIZE) {
      const maxSizeMB = Math.round(FILE_CONSTRAINTS.MAX_SIZE / (1024 * 1024));
      return {
        valid: false,
        error: `Request too large (max ${maxSizeMB}MB)`
      };
    }
  }

  return { valid: true };
}

/**
 * Extract and validate query parameters if any
 * @param url Request URL
 * @returns Extracted query parameters
 */
export function extractQueryParams(url: string): Record<string, string> {
  const urlObj = new URL(url);
  const params: Record<string, string> = {};

  for (const [key, value] of urlObj.searchParams) {
    params[key] = value;
  }

  return params;
}

/**
 * Validate and parse JSON body (if applicable)
 * @param body Request body as string
 * @returns Parsed JSON or error
 */
export function validateJsonBody(body: string): { valid: boolean; data?: any; error?: string } {
  try {
    const data = JSON.parse(body);
    return { valid: true, data };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid JSON: ${error.message}`
    };
  }
}

/**
 * Comprehensive request validation
 * @param request HTTP request object
 * @returns Promise resolving to validation result
 */
export async function validateCompleteRequest(request: Request): Promise<{
  valid: boolean;
  formData?: FormData;
  file?: File;
  project?: string;
  errors: string[];
}> {
  const errors: string[] = [];

  // Validate method and content type
  const methodValidation = validateRequestMethod(request);
  if (!methodValidation.valid) {
    errors.push(methodValidation.error!);
    return { valid: false, errors };
  }

  // Validate content length
  const lengthValidation = validateContentLength(request);
  if (!lengthValidation.valid) {
    errors.push(lengthValidation.error!);
    return { valid: false, errors };
  }

  try {
    // Parse form data
    const formData = await request.formData();

    // Validate form data
    const requestValidation = validateRequest(formData);
    errors.push(...requestValidation.errors);

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return {
      valid: true,
      formData,
      file: requestValidation.file,
      project: requestValidation.project,
      errors: []
    };

  } catch (error) {
    errors.push(`Failed to parse form data: ${error.message}`);
    return { valid: false, errors };
  }
}