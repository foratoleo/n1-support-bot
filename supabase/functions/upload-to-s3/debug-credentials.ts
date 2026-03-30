// Debug utility to help identify credential issues
// This file should be removed after debugging

export function debugCredentials() {
  const accessKey = Deno.env.get("AWS_ACCESS_KEY_ID");
  const secretKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
  const region = Deno.env.get("AWS_REGION");
  const bucket = Deno.env.get("AWS_S3_BUCKET");

  console.log("🔍 DEBUG: Credential Analysis");
  console.log("================================");

  // Access Key Analysis
  if (accessKey) {
    console.log(`✅ AWS_ACCESS_KEY_ID present: ${accessKey.length} chars`);
    console.log(`   Prefix: ${accessKey.substring(0, 4)}...`);
    console.log(`   Format check: ${accessKey.match(/^(AKIA|ASIA)[A-Z0-9]{16}$/) ? '✅ Valid' : '❌ Invalid'}`);

    // Check for common issues
    if (accessKey.includes(' ')) {
      console.log("⚠️  WARNING: Access key contains spaces");
    }
    if (accessKey.includes('\n') || accessKey.includes('\r')) {
      console.log("⚠️  WARNING: Access key contains line breaks");
    }
    if (accessKey.length !== 20) {
      console.log(`⚠️  WARNING: Access key length is ${accessKey.length}, expected 20`);
    }
  } else {
    console.log("❌ AWS_ACCESS_KEY_ID missing");
  }

  // Secret Key Analysis
  if (secretKey) {
    console.log(`✅ AWS_SECRET_ACCESS_KEY present: ${secretKey.length} chars`);
    console.log(`   Prefix: ${secretKey.substring(0, 4)}...`);
    console.log(`   Suffix: ...${secretKey.substring(secretKey.length - 4)}`);
    console.log(`   Base64 check: ${/^[A-Za-z0-9+/]+={0,2}$/.test(secretKey) ? '✅ Valid' : '❌ Invalid'}`);

    // Check for common issues
    if (secretKey.includes(' ')) {
      console.log("⚠️  WARNING: Secret key contains spaces");
    }
    if (secretKey.includes('\n') || secretKey.includes('\r')) {
      console.log("⚠️  WARNING: Secret key contains line breaks");
    }
    if (secretKey.length !== 40) {
      console.log(`⚠️  WARNING: Secret key length is ${secretKey.length}, expected 40`);
    }
  } else {
    console.log("❌ AWS_SECRET_ACCESS_KEY missing");
  }

  // Region Analysis
  if (region) {
    console.log(`✅ AWS_REGION: ${region}`);
    console.log(`   Format check: ${/^[a-z0-9-]+$/.test(region) ? '✅ Valid' : '❌ Invalid'}`);
  } else {
    console.log("⚠️  AWS_REGION not set, using default: us-east-1");
  }

  // Bucket Analysis
  if (bucket) {
    console.log(`✅ AWS_S3_BUCKET: ${bucket}`);
    console.log(`   Format check: ${/^[a-z0-9.-]+$/.test(bucket) && bucket.length >= 3 && bucket.length <= 63 ? '✅ Valid' : '❌ Invalid'}`);
  } else {
    console.log("❌ AWS_S3_BUCKET missing");
  }

  console.log("================================");

  return {
    accessKeyValid: accessKey && accessKey.match(/^(AKIA|ASIA)[A-Z0-9]{16}$/),
    secretKeyValid: secretKey && secretKey.length === 40 && /^[A-Za-z0-9+/]+={0,2}$/.test(secretKey),
    regionValid: !region || /^[a-z0-9-]+$/.test(region),
    bucketValid: bucket && /^[a-z0-9.-]+$/.test(bucket) && bucket.length >= 3 && bucket.length <= 63,
    allValid: function() {
      return this.accessKeyValid && this.secretKeyValid && this.regionValid && this.bucketValid;
    }
  };
}