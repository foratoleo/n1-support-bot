# Create Meeting Notes API Documentation

## Endpoint

```
POST /create-meeting-notes
```

Generate structured meeting notes (atas de reunião) using OpenAI's GPT-4o model with conversation context support.

## Authentication

**Required**: `OPENAI_API_KEY` environment variable must be configured on the Supabase Edge Function.

## Request

### Headers

```
Content-Type: application/json
```

### Request Body Schema

```typescript
{
  content: string;              // Required - Meeting transcription or notes for processing
  project_id: string;           // Required - Project identifier for metadata tracking
  system_prompt?: string;       // Optional - Custom system instructions (defaults to built-in meeting notes template)
  user_prompt?: string;         // Optional - Custom user prompt (defaults to standard prompt)
  previous_response_id?: string; // Optional - OpenAI Response ID for conversation continuity
  model?: string;               // Optional - OpenAI model override (e.g., "gpt-4o-mini")
  temperature?: number;         // Optional - Temperature override (0.0 to 2.0)
  token_limit?: number;         // Optional - Token limit override
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | Meeting transcription or notes to transform into structured meeting notes. Must not be empty. |
| `project_id` | string | Yes | Project identifier for tracking and metadata. Must not be empty. |
| `system_prompt` | string | No | Override default meeting notes generation instructions. Uses predefined template if omitted. |
| `user_prompt` | string | No | Override default user prompt. Uses standard prompt if omitted. |
| `previous_response_id` | string | No | OpenAI Response ID to maintain conversation context across multiple meeting notes generations. |
| `model` | string | No | Override the OpenAI model. Defaults to database configuration or `gpt-4o`. |
| `temperature` | number | No | Override the temperature parameter. Defaults to database configuration or `0.6`. |
| `token_limit` | number | No | Override the token limit. Defaults to database configuration or `8000`. |

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "document": "# Ata de Reunião\n\n## Informações da Reunião\n...",
  "response_id": "resp_abc123xyz"
}
```

**Fields:**
- `success`: Always `true` for successful requests
- `document`: Generated meeting notes content in Markdown format
- `response_id`: OpenAI Response ID for conversation continuity

### Error Responses

#### 400 Bad Request - Missing Required Fields

```json
{
  "success": false,
  "error": "Content is required"
}
```

```json
{
  "success": false,
  "error": "Project ID is required"
}
```

#### 405 Method Not Allowed

```json
{
  "success": false,
  "error": "Method not allowed"
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Failed to generate document"
}
```

**Note**: OpenAI API errors preserve their original status codes when available.

## Default Meeting Notes Structure

When using the default `system_prompt`, generated meeting notes follow this structure:

1. **Informações da Reunião** (Meeting Information)
   - Título da reunião
   - Data e horário
   - Participantes

2. **Pauta da Reunião** (Meeting Agenda)

3. **Resumo Executivo** (Executive Summary)

4. **Tópicos Discutidos** (Topics Discussed)
   - Detailed breakdown of each agenda item

5. **Decisões Tomadas** (Decisions Made)

6. **Itens de Ação** (Action Items)
   - Responsible parties
   - Deadlines

7. **Próximos Passos** (Next Steps)

8. **Observações e Notas Adicionais** (Additional Notes and Observations)

Output is always in **Brazilian Portuguese** unless explicitly specified otherwise in custom prompts.

## OpenAI Configuration

- **Model**: `gpt-4o`
- **Max Output Tokens**: 8000
- **Temperature**: 0.6
- **Store**: `false`

## CORS Support

The endpoint supports CORS preflight requests:

```
OPTIONS /create-meeting-notes
```

Returns 200 with appropriate CORS headers.

## Usage Examples

### Basic Meeting Notes Generation

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-meeting-notes \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Reunião de planejamento do Sprint 23. Participantes: João, Maria, Pedro. Discussão sobre features do próximo sprint...",
    "project_id": "proj_123"
  }'
```

### Meeting Notes with Custom Prompts

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-meeting-notes \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Reunião de retrospectiva do time de desenvolvimento...",
    "project_id": "proj_456",
    "system_prompt": "Gere uma ata de reunião focada em retrospectiva ágil",
    "user_prompt": "Crie ata detalhada para:"
  }'
```

### Continuing Previous Conversation

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-meeting-notes \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Adicione os impedimentos levantados no final da reunião",
    "project_id": "proj_456",
    "previous_response_id": "resp_abc123xyz"
  }'
```

### With Configuration Override

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-meeting-notes \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Daily standup meeting transcript...",
    "project_id": "proj_789",
    "model": "gpt-4o-mini",
    "temperature": 0.5,
    "token_limit": 4000
  }'
```

## Platform Settings Integration

The function integrates with the `platform_settings` table to load AI configurations.

### Configuration Key

```
ai-create-meeting-notes
```

### Sample Database Configuration

```sql
INSERT INTO platform_settings (key, value, description)
VALUES (
  'ai-create-meeting-notes',
  '{
    "model": "gpt-4o",
    "temperature": 0.6,
    "token_limit": 8000,
    "system_prompt": "Você é um especialista em gerar atas de reunião (meeting notes) profissionais e bem estruturadas.",
    "user_prompt": "Gere uma ata de reunião detalhada baseada no seguinte conteúdo:\n\n{{content}}"
  }'::jsonb,
  'AI configuration for meeting notes generation'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();
```

### Configuration Precedence

1. **Request body parameters** (highest priority)
2. **Database configuration** (`platform_settings` table)
3. **Default values** (defined in `config.ts`)

### Updating Configuration

```sql
-- Update model
UPDATE platform_settings
SET value = jsonb_set(value, '{model}', '"gpt-4o-mini"')
WHERE key = 'ai-create-meeting-notes';

-- Update temperature
UPDATE platform_settings
SET value = jsonb_set(value, '{temperature}', '0.7')
WHERE key = 'ai-create-meeting-notes';

-- Update system prompt
UPDATE platform_settings
SET value = jsonb_set(value, '{system_prompt}', '"Your new prompt here"')
WHERE key = 'ai-create-meeting-notes';
```

## Error Handling

The function implements comprehensive error handling:

1. **Method Validation**: Only POST requests accepted
2. **Body Validation**: Required fields checked before processing
3. **OpenAI Error Propagation**: Original error status codes preserved
4. **Structured Error Responses**: Consistent JSON error format

## Implementation Notes

- Uses OpenAI Responses API for conversation continuity
- Supports multi-document generation sessions via `previous_response_id`
- Metadata includes `project_id` and `operation: 'create-meeting-notes'` for tracking
- All responses include CORS headers for web client compatibility
- Built on Deno runtime with TypeScript
- Reuses shared utilities from `_shared/` directory for consistency

## Response Examples

### Successful Generation

```json
{
  "success": true,
  "document": "# Ata de Reunião\n\n## Informações da Reunião\n\n**Título:** Planejamento Sprint 23\n**Data:** 2024-01-15\n**Horário:** 10:00 - 11:30\n**Participantes:** João Silva, Maria Santos, Pedro Costa\n\n## Pauta da Reunião\n\n1. Review do Sprint anterior\n2. Definição de metas do próximo Sprint\n3. Estimativas de Story Points\n\n## Resumo Executivo\n\nReunião de planejamento onde foram definidas as features prioritárias para o Sprint 23...\n\n## Tópicos Discutidos\n\n### 1. Review do Sprint Anterior\n- Sprint 22 completado com 85% das histórias entregues\n- Dois bugs críticos identificados e corrigidos\n\n### 2. Definição de Metas\n- Implementar sistema de notificações\n- Melhorar performance do dashboard\n\n## Decisões Tomadas\n\n1. Priorizar sistema de notificações como feature principal\n2. Alocar 2 desenvolvedores full-time no refactoring de performance\n3. Realizar code review diário às 16h\n\n## Itens de Ação\n\n| Item | Responsável | Prazo |\n|------|-------------|-------|\n| Criar design do sistema de notificações | Maria | 2024-01-18 |\n| Setup ambiente de testes de performance | Pedro | 2024-01-17 |\n| Documentar APIs do sistema de notificações | João | 2024-01-19 |\n\n## Próximos Passos\n\n- Daily standup às 9h durante o sprint\n- Review de mid-sprint dia 22/01\n- Demo e retrospectiva dia 29/01\n\n## Observações e Notas Adicionais\n\n- Time demonstrou preocupação com prazos apertados\n- Sugestão de adicionar mais tempo para testes de qualidade\n- Considerar treinamento em práticas de performance",
  "response_id": "resp_xyz789abc"
}
```

### Error Response - Missing Content

```json
{
  "success": false,
  "error": "Content is required"
}
```

### Error Response - OpenAI API Issue

```json
{
  "success": false,
  "error": "OpenAI API error: Rate limit exceeded"
}
```

## Best Practices

1. **Provide Complete Transcriptions**: The more detailed the input content, the better the generated meeting notes
2. **Use Conversation Continuity**: Leverage `previous_response_id` for iterative refinement
3. **Configure Database Settings**: Set up platform_settings for consistent behavior across requests
4. **Monitor Token Usage**: Be aware of token limits for long meetings
5. **Include Context**: Mention meeting type, participants, and date in the transcription for better results
6. **Test Configurations**: Use request overrides to test different prompts before updating database settings
