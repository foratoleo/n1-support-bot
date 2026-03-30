import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Documentation file mappings
const DOC_FILES: Record<string, string> = {
  // Index files
  'llms.txt': '../llms.txt',
  'llms-full.txt': '../llms-full.txt',

  // Shared docs
  'docs/response-format.md': '../docs/response-format.md',
  'docs/common-patterns.md': '../docs/common-patterns.md',
  'docs/authentication.md': '../docs/authentication.md',
  'docs/_shared.md': '../docs/_shared.md',

  // API READMEs
  'api-projects.md': '../api-projects/README.md',
  'api-tasks.md': '../api-tasks/README.md',
  'api-sprints.md': '../api-sprints/README.md',
  'api-meetings.md': '../api-meetings/README.md',
  'api-backlog-items.md': '../api-backlog-items/README.md',
  'api-features.md': '../api-features/README.md',

  // AI Document Generation
  'create-prd.md': '../create-prd/README.md',
  'create-user-story.md': '../create-user-story/README.md',
  'create-meeting-notes.md': '../create-meeting-notes/README.md',
  'create-technical-specs.md': '../create-technical-specs/README.md',
  'create-test-cases.md': '../create-test-cases/README.md',
  'create-unit-tests.md': '../create-unit-tests/README.md',

  // Integrations
  'sync-github-prs.md': '../sync-github-prs/README.md',
  'upload-to-s3.md': '../upload-to-s3/README.md',
  'upload-to-presigned-s3.md': '../upload-to-presigned-s3/README.md',
  'generate-presigned-download-url.md': '../generate-presigned-download-url/README.md',

  // Utilities
  'accessibility-test.md': '../accessibility-test/README.md',
  'service-call-to-markdown.md': '../service-call-to-markdown/README.md',
};

// Generate index page listing all available docs
function generateIndexHtml(): string {
  const endpoints = Object.keys(DOC_FILES)
    .filter(k => k.endsWith('.md'))
    .sort();

  return `# DR-AI-Workforce API Documentation

## Available Documentation

### Index Files
- [llms.txt](/functions/v1/api-docs?file=llms.txt) - LLM-optimized index
- [llms-full.txt](/functions/v1/api-docs?file=llms-full.txt) - Complete documentation

### Shared Documentation
- [Response Format](/functions/v1/api-docs?file=docs/response-format.md)
- [Common Patterns](/functions/v1/api-docs?file=docs/common-patterns.md)
- [Authentication](/functions/v1/api-docs?file=docs/authentication.md)
- [Shared Utilities](/functions/v1/api-docs?file=docs/_shared.md)

### CRUD APIs
- [api-projects](/functions/v1/api-docs?file=api-projects.md)
- [api-tasks](/functions/v1/api-docs?file=api-tasks.md)
- [api-sprints](/functions/v1/api-docs?file=api-sprints.md)
- [api-meetings](/functions/v1/api-docs?file=api-meetings.md)
- [api-backlog-items](/functions/v1/api-docs?file=api-backlog-items.md)
- [api-features](/functions/v1/api-docs?file=api-features.md)

### AI Document Generation
- [create-prd](/functions/v1/api-docs?file=create-prd.md)
- [create-user-story](/functions/v1/api-docs?file=create-user-story.md)
- [create-meeting-notes](/functions/v1/api-docs?file=create-meeting-notes.md)
- [create-technical-specs](/functions/v1/api-docs?file=create-technical-specs.md)
- [create-test-cases](/functions/v1/api-docs?file=create-test-cases.md)
- [create-unit-tests](/functions/v1/api-docs?file=create-unit-tests.md)

### Integrations
- [sync-github-prs](/functions/v1/api-docs?file=sync-github-prs.md)
- [upload-to-s3](/functions/v1/api-docs?file=upload-to-s3.md)
- [upload-to-presigned-s3](/functions/v1/api-docs?file=upload-to-presigned-s3.md)
- [generate-presigned-download-url](/functions/v1/api-docs?file=generate-presigned-download-url.md)

### Utilities
- [accessibility-test](/functions/v1/api-docs?file=accessibility-test.md)
- [service-call-to-markdown](/functions/v1/api-docs?file=service-call-to-markdown.md)

---

## Usage

Access any documentation file by adding \`?file=<filename>\` to the URL:

\`\`\`
GET /functions/v1/api-docs?file=api-features.md
GET /functions/v1/api-docs?file=llms.txt
GET /functions/v1/api-docs?file=docs/response-format.md
\`\`\`

All files are served as \`text/markdown\` for easy LLM consumption.
`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use GET.' }),
      {
        status: 405,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      }
    );
  }

  const url = new URL(req.url);
  const fileParam = url.searchParams.get('file');

  // If no file specified, return index
  if (!fileParam) {
    return new Response(generateIndexHtml(), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/markdown; charset=utf-8',
      },
    });
  }

  // Check if file exists in our mappings
  const filePath = DOC_FILES[fileParam];
  if (!filePath) {
    const availableFiles = Object.keys(DOC_FILES).join(', ');
    return new Response(
      JSON.stringify({
        error: 'File not found',
        message: `Available files: ${availableFiles}`,
        requested: fileParam
      }),
      {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    // Read the file content
    // Note: In Deno Deploy, we need to use the correct path resolution
    const baseDir = new URL('.', import.meta.url).pathname;
    const fullPath = `${baseDir}${filePath}`;

    const content = await Deno.readTextFile(fullPath);

    // Determine content type
    const contentType = fileParam.endsWith('.txt')
      ? 'text/plain; charset=utf-8'
      : 'text/markdown; charset=utf-8';

    return new Response(content, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error(`[api-docs] Error reading file ${fileParam}:`, error);

    return new Response(
      JSON.stringify({
        error: 'Failed to read file',
        message: error instanceof Error ? error.message : 'Unknown error',
        file: fileParam
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      }
    );
  }
});
