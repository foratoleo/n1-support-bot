/**
 * Manual Testing Script for Presigned Download URL Edge Function
 *
 * This script allows manual testing of the Edge Function locally
 * with real AWS credentials and S3 objects.
 *
 * Prerequisites:
 * 1. Set AWS environment variables in .env file
 * 2. Ensure S3 bucket has test files uploaded
 * 3. Install Supabase CLI: npm install -g supabase
 *
 * Usage:
 * 1. Start Supabase local functions:
 *    supabase functions serve
 *
 * 2. Run this script in another terminal:
 *    deno run --allow-all supabase/functions/generate-presigned-download-url/test-local.ts
 *
 * 3. Or use curl directly:
 *    curl -X POST http://localhost:54321/functions/v1/generate-presigned-download-url \
 *      -H "Content-Type: application/json" \
 *      -d '{"key":"drai_files/project-123/test.pdf"}'
 */

import 'https://deno.land/std@0.192.0/dotenv/load.ts';

// Configuration
const FUNCTION_URL = 'http://localhost:54321/functions/v1/generate-presigned-download-url';
const TEST_CASES = [
  {
    name: 'Valid S3 key - default expiration',
    body: {
      key: 'drai_files/test-project/sample-document.pdf',
    },
    expectedStatus: 200,
  },
  {
    name: 'Valid S3 key - custom expiration (2 hours)',
    body: {
      key: 'drai_files/test-project/sample-document.pdf',
      expirationSeconds: 7200,
    },
    expectedStatus: 200,
  },
  {
    name: 'Valid S3 key - maximum expiration (7 days)',
    body: {
      key: 'drai_files/test-project/sample-document.pdf',
      expirationSeconds: 604800,
    },
    expectedStatus: 200,
  },
  {
    name: 'Invalid S3 key - empty string',
    body: {
      key: '',
    },
    expectedStatus: 400,
  },
  {
    name: 'Invalid S3 key - missing parameter',
    body: {},
    expectedStatus: 400,
  },
  {
    name: 'Invalid S3 key - non-existent file',
    body: {
      key: 'drai_files/non-existent/file.pdf',
    },
    expectedStatus: 404,
  },
  {
    name: 'Invalid expiration - negative value',
    body: {
      key: 'drai_files/test-project/sample-document.pdf',
      expirationSeconds: -100,
    },
    expectedStatus: 200, // Should use default
  },
  {
    name: 'Invalid expiration - exceeds maximum',
    body: {
      key: 'drai_files/test-project/sample-document.pdf',
      expirationSeconds: 1000000,
    },
    expectedStatus: 200, // Should cap at maximum
  },
];

/**
 * Run a single test case
 */
async function runTest(testCase: typeof TEST_CASES[0]) {
  console.log(`\n🧪 Test: ${testCase.name}`);
  console.log('📤 Request body:', JSON.stringify(testCase.body, null, 2));

  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testCase.body),
    });

    const data = await response.json();

    console.log(`📥 Response status: ${response.status}`);
    console.log(`📥 Response data:`, JSON.stringify(data, null, 2));

    // Validate response
    if (response.status === testCase.expectedStatus) {
      console.log('✅ Status code matches expected');
    } else {
      console.log(
        `❌ Status code mismatch! Expected ${testCase.expectedStatus}, got ${response.status}`
      );
    }

    // Additional validation for successful responses
    if (response.status === 200) {
      if (data.success && data.downloadUrl) {
        console.log('✅ Download URL generated successfully');
        console.log(`🔗 URL: ${data.downloadUrl}`);
        console.log(`⏱️  Expires at: ${data.expiresAt}`);

        // Validate URL format
        if (data.downloadUrl.startsWith('https://')) {
          console.log('✅ URL has valid HTTPS protocol');
        } else {
          console.log('❌ URL does not use HTTPS');
        }

        // Try to fetch the URL (this will fail if file doesn't exist)
        console.log('🔍 Testing download URL...');
        try {
          const downloadResponse = await fetch(data.downloadUrl, { method: 'HEAD' });
          if (downloadResponse.ok) {
            console.log('✅ Download URL is accessible');
            console.log(`📄 Content-Type: ${downloadResponse.headers.get('content-type')}`);
            console.log(`📊 Content-Length: ${downloadResponse.headers.get('content-length')} bytes`);
          } else {
            console.log(`⚠️  Download URL returned status ${downloadResponse.status}`);
          }
        } catch (downloadError) {
          console.log('⚠️  Could not test download URL:', downloadError.message);
        }
      } else {
        console.log('❌ Response missing required fields (success, downloadUrl)');
      }
    }
  } catch (error) {
    console.log('❌ Test failed with error:', error.message);
  }
}

/**
 * Run all test cases
 */
async function runAllTests() {
  console.log('🚀 Starting Edge Function Local Tests');
  console.log(`📍 Function URL: ${FUNCTION_URL}`);
  console.log(`📋 Total test cases: ${TEST_CASES.length}`);

  // Check if local function is running
  console.log('\n🔍 Checking if Edge Function is running...');
  try {
    const healthCheck = await fetch(FUNCTION_URL, {
      method: 'OPTIONS',
    });
    console.log('✅ Edge Function is running');
  } catch (error) {
    console.log('❌ Edge Function is not running!');
    console.log('💡 Start it with: supabase functions serve');
    Deno.exit(1);
  }

  // Run all tests sequentially
  const passedTests = 0;
  const failedTests = 0;

  for (const testCase of TEST_CASES) {
    await runTest(testCase);

    // Wait between tests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`Total tests: ${TEST_CASES.length}`);
  console.log('\n💡 Manual Verification Required:');
  console.log('  - Check that download URLs work in browser');
  console.log('  - Verify file downloads correctly');
  console.log('  - Test URL expiration after timeout');
  console.log('  - Confirm CORS headers in browser DevTools');
}

/**
 * Interactive test mode
 */
async function interactiveTest() {
  console.log('\n🎯 Interactive Test Mode');
  console.log('Enter S3 key to generate download URL (or "exit" to quit):');

  const decoder = new TextDecoder();
  for await (const chunk of Deno.stdin.readable) {
    const input = decoder.decode(chunk).trim();

    if (input.toLowerCase() === 'exit') {
      console.log('👋 Exiting interactive mode');
      break;
    }

    if (input) {
      await runTest({
        name: 'Interactive test',
        body: { key: input },
        expectedStatus: 200,
      });

      console.log('\n🎯 Enter another S3 key (or "exit" to quit):');
    }
  }
}

// Main execution
if (import.meta.main) {
  const args = Deno.args;

  if (args.includes('--interactive') || args.includes('-i')) {
    await interactiveTest();
  } else {
    await runAllTests();
  }
}

/**
 * Additional utility functions for testing
 */

/**
 * Generate a test S3 key
 */
export function generateTestKey(projectId: string, filename: string): string {
  return `drai_files/${projectId}/${filename}`;
}

/**
 * Validate presigned URL format
 */
export function validatePresignedUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      urlObj.protocol === 'https:' &&
      urlObj.hostname.includes('amazonaws.com') &&
      urlObj.searchParams.has('X-Amz-Expires')
    );
  } catch {
    return false;
  }
}

/**
 * Extract expiration from presigned URL
 */
export function extractExpiration(url: string): number | null {
  try {
    const urlObj = new URL(url);
    const expires = urlObj.searchParams.get('X-Amz-Expires');
    return expires ? parseInt(expires, 10) : null;
  } catch {
    return null;
  }
}
