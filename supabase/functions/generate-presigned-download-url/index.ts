import {
  PresignedDownloadRequest,
  PresignedDownloadResponse,
} from "./types.ts";

import {
  validateRequest,
  validateExpiration
} from "./utils/validation.ts";

import { createStorageProvider } from "../_shared/storage/provider-factory.ts";
import { getActiveBucket } from "../_shared/storage/config.ts";

/**
 * CORS headers for frontend access
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Main handler for presigned download URL generation
 */
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Method not allowed',
        error: 'Only POST requests are supported'
      }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid request body',
          error: 'Request body must be valid JSON'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Presigned download URL request received:', {
      timestamp: new Date().toISOString(),
      key: (body as Record<string, unknown>)?.key,
      expirationSeconds: (body as Record<string, unknown>)?.expirationSeconds
    });

    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      console.error('Request validation failed:', validation.errors);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid request parameters',
          error: validation.errors.join(', ')
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const request = body as PresignedDownloadRequest;

    // Validate and normalize expiration time
    const expirationSeconds = validateExpiration(request.expirationSeconds);
    console.log(`Using expiration time: ${expirationSeconds} seconds (${Math.floor(expirationSeconds / 60)} minutes)`);

    // Initialize storage provider (S3 or GCS based on STORAGE_PROVIDER env var)
    let provider;
    try {
      provider = createStorageProvider();
      console.log('Storage provider initialized successfully');
    } catch (configError) {
      console.error('Failed to initialize storage provider:', configError);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Service configuration error',
          error: configError instanceof Error ? configError.message : 'Unknown configuration error'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Resolve bucket name based on active provider
    const bucket = getActiveBucket();

    console.log('Generating presigned download URL:', {
      bucket,
      key: request.key,
      expiresIn: expirationSeconds
    });

    // Generate presigned download URL via provider
    let downloadUrl: string;
    try {
      const result = await provider.generatePresignedDownloadUrl({
        key: request.key,
        bucket,
        expiresIn: expirationSeconds
      });
      downloadUrl = result.downloadUrl;
      console.log('Presigned download URL generated successfully');
    } catch (urlError) {
      console.error('Failed to generate presigned URL:', urlError);

      const errorMessage = urlError instanceof Error ? urlError.message : 'Unknown error';

      if (errorMessage.includes('NoSuchKey') || errorMessage.includes('404') || errorMessage.includes('FILE_NOT_FOUND')) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'File not found',
            error: 'The requested file does not exist in storage',
            key: request.key
          }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      if (errorMessage.includes('AccessDenied') || errorMessage.includes('403') || errorMessage.includes('ACCESS_DENIED')) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Access denied',
            error: 'You do not have permission to download this file',
            key: request.key
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Failed to generate download URL',
          error: errorMessage
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Calculate expiration timestamp
    const expiresAt = new Date(Date.now() + (expirationSeconds * 1000)).toISOString();

    // Prepare response — format identical to previous implementation
    const response: PresignedDownloadResponse = {
      success: true,
      downloadUrl,
      expiresAt,
      key: request.key,
      message: 'Presigned download URL generated successfully'
    };

    console.log('Response prepared:', {
      success: true,
      key: request.key,
      expiresAt,
      urlLength: downloadUrl.length
    });

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Unexpected error in presigned download URL generation:', error);

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
