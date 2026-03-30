import { createStorageProvider } from "../_shared/storage/provider-factory.ts";
import { getActiveBucket } from "../_shared/storage/config.ts";

interface UploadResponse {
  success: boolean;
  filename?: string;
  project?: string;
  message: string;
  error?: string;
}

// Generate slug from filename
function generateSlug(filename: string): string {
  const nameWithoutExt = filename.split('.').slice(0, -1).join('.');
  const extension = filename.split('.').pop() || '';

  const slug = nameWithoutExt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim()
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  const timestamp = Date.now();
  return extension ? `${slug}_${timestamp}.${extension}` : `${slug}_${timestamp}`;
}

// Validate file type and size
function validateFile(file: File): { valid: boolean; error?: string } {
  // File size limit: 50MB
  const MAX_SIZE = 50 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return { valid: false, error: "File size exceeds 50MB limit" };
  }

  // File type whitelist (add more as needed)
  const ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/json', 'audio/mpeg', 'audio/wav', 'video/mp4'
  ];

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: `File type ${file.type} not allowed` };
  }

  return { valid: true };
}

// Main handler function
async function handleRequest(request: Request): Promise<Response> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only allow POST requests
  if (request.method !== "POST") {
    const response: UploadResponse = {
      success: false,
      message: "Method not allowed. Use POST.",
    };
    return new Response(JSON.stringify(response), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const project = formData.get("project") as string;

    // Validate required fields
    if (!file) {
      const response: UploadResponse = {
        success: false,
        message: "File is required",
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!project) {
      const response: UploadResponse = {
        success: false,
        message: "Project field is required",
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate file
    const fileValidation = validateFile(file);
    if (!fileValidation.valid) {
      const response: UploadResponse = {
        success: false,
        message: fileValidation.error!,
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize storage provider (reads STORAGE_PROVIDER env var, defaults to 's3')
    const provider = createStorageProvider();
    const bucket = getActiveBucket();

    // Build the object key with project prefix
    const filename = generateSlug(file.name);
    const key = `drai_files/${project}/${filename}`;

    // Upload file via the configured provider
    console.log(`Starting upload: ${file.name} (${file.size} bytes) to project: ${project}`);
    const uploadResult = await provider.upload({ file, key, contentType: file.type, bucket });

    // Success response
    const response: UploadResponse = {
      success: true,
      filename: uploadResult.filename,
      project,
      message: "File uploaded successfully",
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Upload error:", error);

    const response: UploadResponse = {
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : String(error),
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// Start the server
console.log("Supabase Edge Function: upload-to-s3 started");
Deno.serve(handleRequest);
