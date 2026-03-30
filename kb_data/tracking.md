---
name: ai-tracking
description: AI interaction tracking, token usage, cost monitoring, ai_interactions table
area: 10
maintained_by: tracking-analyst
created: 2026-03-30
updated: 2026-03-30
---

# AI Interaction Tracking

## Overview

Every OpenAI API call made by document generation Edge Functions is automatically tracked in the `ai_interactions` table. Tracking is handled server-side by the `AIInteractionService` class, ensuring all token usage and cost data is captured without any frontend involvement. This provides a complete audit trail for cost monitoring, usage analysis, and conversation continuity across document generation sessions.

## ai_interactions Table

The `ai_interactions` table stores a record for each AI API call, capturing the full lifecycle from request to response.

### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key, auto-generated |
| `project_id` | `uuid` | Project association for isolation and cost attribution |
| `user_id` | `uuid` | User who initiated the request (optional) |
| `meeting_transcript_id` | `uuid` | Source transcript link (optional) |
| `previous_interaction_id` | `uuid` | Parent interaction for conversation chains (optional) |
| `interaction_type` | `text` | Type identifier, e.g. `document-generation`, `task-creation` |
| `status` | `text` | Lifecycle status: `pending`, `in_progress`, `completed`, `failed` |
| `sequence_order` | `integer` | Order within a multi-turn conversation sequence |
| `request_prompt` | `text` | Original prompt sent to the model |
| `request_model` | `text` | OpenAI model used for this request |
| `request_parameters` | `jsonb` | Parameters sent with the request (temperature, max_tokens, etc.) |
| `response_text` | `text` | AI-generated response content |
| `token_usage` | `jsonb` | Token breakdown: `{input_tokens, output_tokens, total_tokens}` |
| `openai_conversation_id` | `text` | OpenAI conversation/response ID for continuity |
| `response_metadata` | `jsonb` | Additional response metadata (model, created, object) |
| `duration_ms` | `integer` | Request duration in milliseconds |
| `error_message` | `text` | Error message if status is `failed` |
| `error_details` | `jsonb` | Full error stack and timestamp on failure |
| `started_at` | `timestamp with time zone` | When processing began |
| `completed_at` | `timestamp with time zone` | When processing finished |
| `created_at` | `timestamp with time zone` | Record creation timestamp |

### Key Relationships

- `project_id` -> `project_knowledge_base.id` (N:1, mandatory) -- ensures all interactions are isolated by project
- `meeting_transcript_id` -> `meeting_transcripts.id` (N:1, optional) -- links input source
- `previous_interaction_id` -> `ai_interactions.id` (self-reference) -- enables conversation chains
- Referenced by `generated_documents.ai_interaction_id`
- Referenced by `dev_tasks.generated_from_interaction_id`
- Referenced by `audit_trail.ai_interaction_id`

## How Server-Side Tracking Works

Edge Functions use the `AIInteractionService` class to manage the full lifecycle of each interaction. The service creates a record at the start of the request, updates it during processing, and finalizes it with token usage and cost data upon completion.

### Interaction Lifecycle

The lifecycle follows four states:

1. **pending** -- Record created with request metadata before the API call
2. **in_progress** -- Status updated and `started_at` set when the request begins
3. **completed** -- Finalized with response text, token usage, and duration after success
4. **failed** -- Error details recorded if the request fails

### Lifecycle Implementation

```typescript
import { AIInteractionService } from './_shared/document-generation/ai-interaction-service.ts';

const service = new AIInteractionService(supabase, 'create-prd');

// Step 1: Create pending record
const interactionId = await service.createInteraction({
  project_id: projectId,
  request_prompt: prompt,
  request_model: 'gpt-4o',
  request_parameters: { temperature: 0.7, max_output_tokens: 8000 },
  previous_interaction_id: previousId,   // Optional, for conversation chains
  meeting_transcript_id: transcriptId,    // Optional, for document generation
});

// Step 2: Mark as in progress
await service.updateInteractionInProgress(interactionId);

// Step 3: Call OpenAI
const response = await openai.responses.create({ ... });

// Step 4: Complete with token usage
await service.completeInteraction(interactionId, response, document, startTime);

// On error: await service.failInteraction(interactionId, error, startTime);
```

The `completeInteraction` method automatically extracts token usage and response metadata from the OpenAI response:

```typescript
const tokenUsage = extractTokenUsage(response);
// Returns: { input_tokens: number, output_tokens: number, total_tokens: number }

const metadata = extractResponseMetadata(response);
// Returns: { conversation_id, model, created, object }
```

### Extracted Token Usage

Token usage is extracted from the OpenAI response `usage` object:

```typescript
function extractTokenUsage(response: any): TokenUsage {
  const usage = response?.usage || {};
  return {
    input_tokens: usage.input_tokens || 0,
    output_tokens: usage.output_tokens || 0,
    total_tokens: usage.total_tokens || (usage.input_tokens || 0) + (usage.output_tokens || 0),
  };
}
```

## Token Usage Monitoring

### Per-Interaction Breakdown

Each record in `ai_interactions` contains a `token_usage` JSONB field with the full breakdown:

```json
{
  "input_tokens": 1250,
  "output_tokens": 3800,
  "total_tokens": 5050
}
```

### Querying Usage for a Project

Get total token consumption for a specific project over a time range:

```sql
SELECT
  COUNT(*) AS total_requests,
  SUM((token_usage->>'input_tokens')::int)  AS total_input_tokens,
  SUM((token_usage->>'output_tokens')::int) AS total_output_tokens,
  SUM((token_usage->>'total_tokens')::int)  AS total_tokens
FROM ai_interactions
WHERE project_id = 'your-project-uuid'
  AND status = 'completed'
  AND created_at >= NOW() - INTERVAL '30 days';
```

### Usage by Model

Break down token consumption by model to understand where costs are concentrated:

```sql
SELECT
  request_model,
  COUNT(*) AS request_count,
  SUM((token_usage->>'total_tokens')::int) AS total_tokens,
  ROUND(
    SUM((token_usage->>'total_tokens')::int)::numeric /
    NULLIF(COUNT(*), 0),
    0
  ) AS avg_tokens_per_request
FROM ai_interactions
WHERE project_id = 'your-project-uuid'
  AND status = 'completed'
GROUP BY request_model
ORDER BY total_tokens DESC;
```

### Daily Usage Trend

Track daily consumption to identify usage patterns:

```sql
SELECT
  DATE(created_at) AS usage_date,
  COUNT(*) AS requests,
  SUM((token_usage->>'total_tokens')::int) AS tokens,
  COUNT(DISTINCT user_id) AS active_users
FROM ai_interactions
WHERE project_id = 'your-project-uuid'
  AND status = 'completed'
GROUP BY DATE(created_at)
ORDER BY usage_date DESC
LIMIT 30;
```

### Failed Interactions

Identify failed requests to diagnose issues:

```sql
SELECT
  id,
  request_model,
  error_message,
  created_at,
  duration_ms
FROM ai_interactions
WHERE project_id = 'your-project-uuid'
  AND status = 'failed'
ORDER BY created_at DESC
LIMIT 20;
```

## Cost Calculation

### Per-Model Pricing

Costs are calculated using OpenAI's per-token pricing (per 1 million tokens):

| Model | Input Price ($/1M tokens) | Output Price ($/1M tokens) |
|-------|---------------------------|----------------------------|
| `gpt-4o` | $5.00 | $15.00 |
| `gpt-4o-mini` | $0.15 | $0.60 |
| `gpt-4-turbo` | $10.00 | $30.00 |
| `gpt-4` | $30.00 | $60.00 |
| `gpt-3.5-turbo` | $0.50 | $1.50 |

Pricing source: `_shared/external-service-utils.ts::calculateOpenAICost()`. Unknown models fall back to `gpt-4o-mini` pricing.

### Cost Formula

```
cost = (input_tokens / 1,000,000) * input_price
     + (output_tokens / 1,000,000) * output_price
```

Implementation from `_shared/external-service-utils.ts`:

```typescript
export function calculateOpenAICost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 5.0, output: 15.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4-turbo': { input: 10.0, output: 30.0 },
    'gpt-4': { input: 30.0, output: 60.0 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  };

  const modelPricing = pricing[model] || pricing['gpt-4o-mini'];
  const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
  const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

  return inputCost + outputCost;
}
```

### Example Cost Calculations

A document generation request using `gpt-4o-mini` with 1,500 input tokens and 4,000 output tokens:

```
input cost  = (1,500 / 1,000,000) * 0.15  = $0.000225
output cost = (4,000 / 1,000,000) * 0.60  = $0.002400
total cost  = $0.002625
```

The same request with `gpt-4o` instead:

```
input cost  = (1,500 / 1,000,000) * 5.00  = $0.007500
output cost = (4,000 / 1,000,000) * 15.00 = $0.060000
total cost  = $0.067500
```

Using `gpt-4o-mini` results in approximately **96% cost savings** for this request.

### Querying Total Cost for a Project

```sql
SELECT
  request_model,
  COUNT(*) AS request_count,
  SUM((token_usage->>'input_tokens')::int)  AS input_tokens,
  SUM((token_usage->>'output_tokens')::int) AS output_tokens,
  SUM((token_usage->>'total_tokens')::int)  AS total_tokens,
  ROUND(SUM(
    (token_usage->>'input_tokens')::int  / 1_000_000.0 * COALESCE(NULLIF((pricing->>request_model->>'input'), '')::numeric, 0.15)
    + (token_usage->>'output_tokens')::int / 1_000_000.0 * COALESCE(NULLIF((pricing->>request_model->>'output'), '')::numeric, 0.60)
  ), 6) AS estimated_cost_usd
FROM ai_interactions,
  jsonb_build_object(
    'gpt-4o',      jsonb_build_object('input', 5.0,  'output', 15.0),
    'gpt-4o-mini', jsonb_build_object('input', 0.15, 'output', 0.60)
  ) AS pricing
WHERE project_id = 'your-project-uuid'
  AND status = 'completed'
GROUP BY request_model
ORDER BY estimated_cost_usd DESC;
```

## Cost Optimization

### Model Selection Strategy

The system uses automatic model selection to balance cost and quality:

| Task Complexity | Default Model | Rationale |
|-----------------|---------------|-----------|
| Simple, well-defined documents (meeting notes, basic PRDs) | `gpt-4o-mini` | Faster and significantly cheaper |
| Complex generation (features, technical specs, unit tests) | `gpt-4o` | Better reasoning and output quality |
| User override | Custom model | User-specified via `model` parameter |

### Cost Optimization Techniques

1. **Server-side model selection** -- Edge Functions select the appropriate model based on document type complexity, eliminating unnecessary `gpt-4o` usage.

2. **Token limits enforced** -- The `token_limit` parameter caps output tokens per request, preventing runaway generation and unexpected costs.

3. **GPT-4o-mini as fallback** -- Unknown models default to `gpt-4o-mini` pricing to prevent budget overruns from experimental model versions.

4. **Conversation continuity** -- Multi-document sessions reuse conversation context via `previous_response_id`, reducing input token overhead on follow-up requests.

### Requesting a Specific Model

Override the default model in the API call:

```typescript
import { generateDocumentAPI } from '@/lib/services/document-generation-service';

const result = await generateDocumentAPI(
  'prd',
  transcriptContent,
  projectId,
  undefined,
  undefined,
  { model: 'gpt-4o' }  // Force gpt-4o for complex requirements
);
```

## response_id for Conversation Continuity

### What Is response_id

The `openai_conversation_id` field (populated from `response.id`) uniquely identifies each OpenAI API response. This value can be passed to subsequent requests as `previous_response_id` to maintain conversational context across multiple turns.

### Why Use Conversation Continuity

When generating multiple related documents or refining content across several steps, passing the previous `response_id` allows the model to maintain context from earlier interactions. This is particularly valuable for:

- Iterative document refinement (generate, review, regenerate)
- Multi-document sessions where each document builds on the previous one
- Complex features that require multiple generation passes

### Implementation

```typescript
// First generation call
const result1 = await generateDocumentAPI(
  'user-story',
  transcriptContent,
  projectId,
  transcriptId
);

console.log(result1.response_id);   // e.g., "resp_abc123xyz"

// Second call with continuity
const result2 = await generateDocumentAPI(
  'prd',
  refinedContent,
  projectId,
  undefined,
  undefined,
  { previous_response_id: result1.response_id }
);

// The AI now has context from the user-story generation
```

In the Edge Function, `previous_response_id` is forwarded to the OpenAI API:

```typescript
const response = await this.client.responses.create({
  model: config.model!,
  input: messages,
  previous_response_id: previousResponseId || undefined,  // Enables continuity
  max_output_tokens: config.max_output_tokens!,
  temperature: config.temperature!,
  store: config.store!,
});
```

### Chaining Interactions in the Database

The `previous_interaction_id` column in `ai_interactions` mirrors this continuity at the database level:

```sql
-- Find all interactions in a conversation chain
WITH RECURSIVE conversation_chain AS (
  SELECT id, project_id, request_model, status,
         token_usage, created_at, previous_interaction_id, 1 AS depth
  FROM ai_interactions
  WHERE id = 'interaction-uuid'

  UNION ALL

  SELECT i.id, i.project_id, i.request_model, i.status,
         i.token_usage, i.created_at, i.previous_interaction_id, cc.depth + 1
  FROM ai_interactions i
  INNER JOIN conversation_chain cc ON i.previous_interaction_id = cc.id
)
SELECT * FROM conversation_chain ORDER BY depth;
```

## Tracking Status Reference

| Status | Meaning |
|--------|---------|
| `pending` | Interaction record created, request not yet sent to OpenAI |
| `in_progress` | OpenAI API request is underway |
| `completed` | Request finished successfully, response stored |
| `failed` | Request failed, error details recorded |

Failed records are not deleted. They remain in the table with `status = 'failed'` and `error_message` populated, ensuring complete audit coverage including unsuccessful attempts.

## Related Documentation

- [Document Generation - Edge Functions](../08-document-generation/edge-functions.md) -- Complete Edge Function reference including AIInteractionService integration
- [Generated Documents](../24-generated-documents/gen-docs.md) -- Document storage linked to AI interactions
- [Database Schema](../04-database-schema/schema.md) -- Full ai_interactions table definition and relationships
- [Prompt Templates](../09-prompt-templates/templates.md) -- Templates that drive AI interactions
