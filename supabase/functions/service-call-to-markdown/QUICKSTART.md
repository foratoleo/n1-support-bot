# Quick Start Guide - Service Call to Markdown

Get started with the Service Call to Markdown Edge Function in 5 minutes.

## Prerequisites

- Supabase CLI installed: `npm install -g supabase`
- Project linked to Supabase: `supabase link --project-ref YOUR_PROJECT_REF`
- Existing accessibility test results in `external_service_calls` table

## 1. Deploy (30 seconds)

```bash
cd /path/to/dr-ai-workforce
supabase functions deploy service-call-to-markdown
```

Expected output:
```
✓ Deployed function service-call-to-markdown
Function URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/service-call-to-markdown
```

## 2. Test with cURL (1 minute)

Replace placeholders with your actual values:

```bash
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/service-call-to-markdown' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "YOUR_SERVICE_CALL_ID"
  }'
```

Expected response:
```json
{
  "success": true,
  "markdown": "# Accessibility Test Report\n\n...",
  "metadata": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "serviceName": "pagespeed",
    "serviceCategory": "quality",
    "generatedAt": "2025-11-09T23:00:00.000Z"
  },
  "executionTime": 245
}
```

## 3. Integrate into Your App (2 minutes)

### React Component

```tsx
import { useSupabaseClient } from '@supabase/auth-helpers-react';

function ReportViewer({ serviceCallId }) {
  const supabase = useSupabaseClient();
  const [markdown, setMarkdown] = useState('');

  useEffect(() => {
    async function loadReport() {
      const { data } = await supabase.functions.invoke(
        'service-call-to-markdown',
        { body: { id: serviceCallId } }
      );
      setMarkdown(data.markdown);
    }
    loadReport();
  }, [serviceCallId]);

  return <ReactMarkdown>{markdown}</ReactMarkdown>;
}
```

### Vanilla JavaScript

```javascript
async function getMarkdownReport(serviceCallId) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/service-call-to-markdown`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: serviceCallId })
    }
  );

  const data = await response.json();
  return data.markdown;
}
```

## 4. View Logs (30 seconds)

```bash
supabase functions logs service-call-to-markdown --tail
```

## Common Use Cases

### Get Report for Latest Test

```typescript
// 1. Run accessibility test
const { data: testResult } = await supabase.functions.invoke(
  'accessibility-test',
  {
    body: {
      projectId: 'YOUR_PROJECT_ID',
      targetUrl: 'https://example.com',
      strategy: 'DESKTOP'
    }
  }
);

// 2. Convert to markdown immediately
const { data: report } = await supabase.functions.invoke(
  'service-call-to-markdown',
  {
    body: { id: testResult.documentId }
  }
);

// 3. Display or save markdown
console.log(report.markdown);
```

### Download Report as File

```typescript
async function downloadReport(serviceCallId) {
  const { data } = await supabase.functions.invoke(
    'service-call-to-markdown',
    { body: { id: serviceCallId } }
  );

  // Create blob and download
  const blob = new Blob([data.markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `accessibility-report-${serviceCallId}.md`;
  a.click();
}
```

### Email Report to User

```typescript
async function emailReport(serviceCallId, userEmail) {
  // Get markdown
  const { data } = await supabase.functions.invoke(
    'service-call-to-markdown',
    { body: { id: serviceCallId } }
  );

  // Send email (using your email service)
  await sendEmail({
    to: userEmail,
    subject: 'Your Accessibility Test Report',
    body: data.markdown,
    attachments: [{
      filename: 'report.md',
      content: data.markdown
    }]
  });
}
```

## Troubleshooting

### "Service call not found"
- Check if the ID exists in `external_service_calls` table
- Verify RLS policies allow access to the record
- Ensure you're authenticated

### "No formatter available"
- Currently only supports `quality:pagespeed`
- Check the service_name and service_category in your record
- See [README.md](./README.md) for adding new formatters

### Function timeout
- Usually indicates a large response body
- Check the size of response_body in your record
- Contact support if persists

## Next Steps

- Read [README.md](./README.md) for complete API documentation
- Review [DEPLOYMENT.md](./DEPLOYMENT.md) for production setup
- Check [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for architecture details

## Support

- **Documentation**: See README.md for detailed usage
- **Logs**: `supabase functions logs service-call-to-markdown`
- **Issues**: Check the troubleshooting section in README.md

---

**Total Setup Time**: ~5 minutes
**Status**: Production Ready ✅
