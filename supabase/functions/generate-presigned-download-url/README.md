# Generate Presigned Download URL Edge Function

Supabase Edge Function that generates AWS S3 presigned download URLs for secure, temporary file downloads.

## Overview

This Edge Function accepts an S3 object key and generates a temporary presigned GET URL that allows downloading the file directly from S3 without exposing AWS credentials or requiring authentication.

## Architecture

```
Client Request → Edge Function → AWS SDK → Presigned URL → Response
```

## Request Format

**Endpoint**: `POST /functions/v1/generate-presigned-download-url`

**Headers**:
- `Content-Type: application/json`
- `Authorization: Bearer <supabase-anon-key>`

**Body**:
```json
{
  "key": "drai_files/project-name/document_1234567890.pdf",
  "expirationSeconds": 3600
}
```

**Parameters**:
- `key` (required): S3 object key (file path) in the format `drai_files/{project}/{filename}`
- `expirationSeconds` (optional): URL expiration time in seconds
  - Default: 3600 (1 hour)
  - Minimum: 60 (1 minute)
  - Maximum: 604800 (7 days per AWS limits)

## Response Format

### Success Response (200)
```json
{
  "success": true,
  "downloadUrl": "https://s3.us-east-1.amazonaws.com/bucket-name/key?...",
  "expiresAt": "2025-10-02T15:30:00.000Z",
  "key": "drai_files/project-name/document_1234567890.pdf",
  "message": "Presigned download URL generated successfully"
}
```

### Error Responses

**Bad Request (400)**:
```json
{
  "success": false,
  "message": "Invalid request parameters",
  "error": "S3 key must start with 'drai_files/' prefix"
}
```

**Not Found (404)**:
```json
{
  "success": false,
  "message": "File not found",
  "error": "The requested file does not exist in storage",
  "key": "drai_files/project-name/missing.pdf"
}
```

**Forbidden (403)**:
```json
{
  "success": false,
  "message": "Access denied",
  "error": "You do not have permission to download this file",
  "key": "drai_files/project-name/protected.pdf"
}
```

**Internal Server Error (500)**:
```json
{
  "success": false,
  "message": "Service configuration error",
  "error": "Missing required environment variables: AWS_ACCESS_KEY_ID"
}
```

## Environment Variables

Required environment variables (set in Supabase Edge Function secrets):

```bash
AWS_ACCESS_KEY_ID=<your-aws-access-key-id>
AWS_SECRET_ACCESS_KEY=<your-aws-secret-access-key>
AWS_REGION=us-east-1
AWS_S3_BUCKET=<your-bucket-name>
```

## Files Structure

```
generate-presigned-download-url/
├── index.ts                 # Main handler
├── types.ts                 # TypeScript interfaces
├── import_map.json         # Deno dependencies
├── README.md               # This file
└── utils/
    ├── aws-config.ts       # AWS S3 client configuration
    └── validation.ts       # Request validation
```

## Usage Example

### Client-side Request (JavaScript/TypeScript)
```typescript
import { supabase } from '@/lib/supabase';

const { data, error } = await supabase.functions.invoke(
  'generate-presigned-download-url',
  {
    body: {
      key: 'drai_files/my-project/document.pdf',
      expirationSeconds: 3600 // 1 hour
    }
  }
);

if (data?.success) {
  // Download file using presigned URL
  window.open(data.downloadUrl, '_blank');
}
```

### cURL Example
```bash
curl -X POST \
  https://<project-ref>.supabase.co/functions/v1/generate-presigned-download-url \
  -H 'Authorization: Bearer <supabase-anon-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "key": "drai_files/test-project/example.pdf",
    "expirationSeconds": 3600
  }'
```

## Security Considerations

1. **URL Expiration**: URLs automatically expire after the specified time (max 7 days per AWS limits)
2. **No Credentials Exposed**: Presigned URLs don't expose AWS credentials
3. **Temporary Access**: Each download requires a new URL generation
4. **CORS Enabled**: Allows frontend access with proper headers
5. **Input Validation**: All S3 keys are validated for format and security

## Performance Notes

- URL generation is fast (<100ms typical)
- Downloads happen directly from S3 (no Edge Function bandwidth)
- URLs can be cached client-side until expiration
- No file size limits (downloads handled by S3)

## Differences from Upload Function

| Aspect | Upload | Download |
|--------|--------|----------|
| HTTP Method | POST with FormData | GET |
| URL Type | createPresignedPost | getSignedUrl |
| Response | URL + fields object | Simple URL string |
| Complexity | Multiple fields | Single URL |
| AWS SDK | @aws-sdk/s3-presigned-post | @aws-sdk/s3-request-presigner |

## Error Handling

The function implements comprehensive error handling for:
- Invalid request body (400)
- Missing or invalid S3 key (400)
- File not found (404)
- Access denied (403)
- AWS configuration errors (500)
- AWS SDK errors (500)

All errors include detailed messages for debugging and user feedback.

## Testing

### Local Testing
```bash
# Test with Supabase CLI
supabase functions serve generate-presigned-download-url --env-file .env.local

# Send test request
curl -X POST http://localhost:54321/functions/v1/generate-presigned-download-url \
  -H 'Content-Type: application/json' \
  -d '{"key": "drai_files/test/file.pdf"}'
```

### Integration Testing
See `index.test.ts` for comprehensive test suite covering:
- Successful URL generation
- Error scenarios
- Expiration handling
- AWS SDK integration

## Monitoring

The function logs all operations:
- Request received with key and expiration
- AWS configuration loaded
- S3 client initialized
- Presigned URL generated
- Response prepared
- Any errors encountered

Check Edge Function logs in Supabase Dashboard for debugging.

## Related Documentation

- [AWS S3 Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
