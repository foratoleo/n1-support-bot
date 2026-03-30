import { S3Client } from "npm:@aws-sdk/client-s3";
import { EnvironmentConfig } from "../types.ts";

/**
 * Alternative presigned POST implementation with better error handling
 * Use this as a fallback if the standard createPresignedPost fails
 */
export async function createSafePresignedPost(
  s3Client: S3Client,
  bucket: string,
  key: string,
  contentType: string,
  maxFileSize: number,
  expiresIn: number
): Promise<{ url: string; fields: Record<string, string> }> {

  // Simplified approach - remove problematic fields
  const fields: Record<string, string> = {
    'Content-Type': contentType,
  };

  const conditions = [
    ['content-length-range', 1, maxFileSize],
    // Use starts-with instead of exact match for Content-Type
    ['starts-with', '$Content-Type', contentType.split('/')[0] + '/'],
  ];

  try {
    // Import createPresignedPost dynamically to handle potential import issues
    const { createPresignedPost } = await import("npm:@aws-sdk/s3-presigned-post");

    return await createPresignedPost(s3Client, {
      Bucket: bucket,
      Key: key,
      Fields: fields,
      Conditions: conditions,
      Expires: expiresIn,
    });

  } catch (error) {
    console.error("Standard createPresignedPost failed:", error);

    // Fallback: Create minimal presigned POST manually
    throw new Error(`Presigned POST creation failed: ${error.message}.
    Common solutions:
    1. Check bucket permissions and policies
    2. Verify AWS credentials are correctly formatted
    3. Ensure bucket region matches AWS_REGION environment variable
    4. Check if bucket has ACLs disabled (recommended for security)`);
  }
}

/**
 * Test AWS connectivity and permissions
 */
export async function testAWSConnectivity(config: EnvironmentConfig): Promise<{
  success: boolean;
  error?: string;
  details?: any;
}> {
  try {
    // Test basic S3 connectivity without creating presigned URLs
    const { S3Client, ListBucketsCommand } = await import("npm:@aws-sdk/client-s3");

    const s3Client = new S3Client({
      region: config.AWS_REGION,
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID.trim(),
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY.trim(),
      },
    });

    // Simple connectivity test
    const result = await s3Client.send(new ListBucketsCommand({}));

    return {
      success: true,
      details: {
        bucketsCount: result.Buckets?.length || 0,
        region: config.AWS_REGION,
        hasTargetBucket: result.Buckets?.some(b => b.Name === config.AWS_S3_BUCKET) || false,
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: {
        errorCode: error.code || 'UNKNOWN',
        statusCode: error.$metadata?.httpStatusCode,
        region: config.AWS_REGION,
      }
    };
  }
}