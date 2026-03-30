// Deno serve handler for presigned upload (S3 or GCS)
import { createStorageProvider } from "../_shared/storage/provider-factory.ts";
import { getActiveBucket } from "../_shared/storage/config.ts";
import {
  PresignedUploadRequest,
  PresignedUploadResponse,
  PRESIGNED_CONFIG
} from "./types.ts";
import {
  validateRequestMethod,
  validatePresignedRequest,
  generatePresignedS3Key
} from "./utils/validation.ts";

/**
 * CORS headers for cross-origin requests
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
};

/**
 * Handle preflight OPTIONS requests
 */
function handlePreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Create error response with proper formatting
 */
function createErrorResponse(message: string, status: number = 400, error?: string): Response {
  const body: PresignedUploadResponse = {
    success: false,
    message,
    error
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

/**
 * Create success response with presigned URL data.
 * The `method` field tells the client which HTTP verb to use:
 *   - 'POST' for S3 (multipart/form-data with signed fields)
 *   - 'PUT'  for GCS (binary body, no form fields)
 */
function createSuccessResponse(
  url: string,
  fields: Record<string, string>,
  key: string,
  method: 'POST' | 'PUT'
): Response {
  const expiresAt = new Date(Date.now() + PRESIGNED_CONFIG.EXPIRES_IN * 1000).toISOString();

  const body: PresignedUploadResponse = {
    success: true,
    url,
    fields,
    key,
    expires: expiresAt,
    method,
    message: "Presigned URL generated successfully"
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

/**
 * Generate presigned upload URL using the configured storage provider
 * (S3 → POST with form fields, GCS → PUT with binary body)
 */
async function generatePresignedUpload(
  request: PresignedUploadRequest
): Promise<{ url: string; fields: Record<string, string>; key: string; method: 'POST' | 'PUT' }> {
  const provider = createStorageProvider();

  const bucket = getActiveBucket();

  const key = generatePresignedS3Key(request.project, request.filename);

  console.log(`Generating presigned URL for key: ${key} in bucket: ${bucket}`);

  const result = await provider.generatePresignedUploadUrl({
    key,
    contentType: request.contentType,
    fileSize: request.fileSize,
    bucket,
    expiresIn: PRESIGNED_CONFIG.EXPIRES_IN,
  });

  return {
    url: result.url,
    fields: result.fields,
    key: result.key,
    method: result.method,
  };
}

/**
 * Main request handler
 */
async function handleRequest(request: Request): Promise<Response> {
  try {
    // Handle preflight OPTIONS request
    if (request.method === 'OPTIONS') {
      return handlePreflight();
    }

    // Validate request method
    const methodValidation = validateRequestMethod(request);
    if (!methodValidation.valid) {
      return createErrorResponse(methodValidation.error!);
    }

    // Parse request body
    let body;
    try {
      const bodyText = await request.text();
      body = JSON.parse(bodyText);
    } catch (error) {
      return createErrorResponse("Invalid JSON in request body", 400, error instanceof Error ? error.message : String(error));
    }

    // Validate request data
    const validation = validatePresignedRequest(body);
    if (validation.errors.length > 0) {
      return createErrorResponse(
        "Validation failed",
        400,
        validation.errors.join("; ")
      );
    }

    // Create presigned upload request
    const uploadRequest: PresignedUploadRequest = {
      project: validation.project!,
      filename: validation.filename!,
      contentType: validation.contentType!,
      fileSize: validation.fileSize!
    };

    console.log("Processing presigned upload request:", {
      project: uploadRequest.project,
      filename: uploadRequest.filename,
      contentType: uploadRequest.contentType,
      fileSize: uploadRequest.fileSize
    });

    // Generate presigned URL via storage provider
    const result = await generatePresignedUpload(uploadRequest);

    console.log("Presigned URL generated successfully:", {
      url: result.url,
      key: result.key,
      method: result.method,
      fieldsCount: Object.keys(result.fields).length
    });

    return createSuccessResponse(result.url, result.fields, result.key, result.method);

  } catch (error) {
    console.error("Unexpected error in handleRequest:", error);
    return createErrorResponse(
      "Internal server error",
      500,
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Deno serve handler
 */
Deno.serve(handleRequest);
