# api-tasks-status-update

Edge Function para atualizar o status de multiplas tasks em uma unica requisicao.

Data de criacao: 2026-03-25
Ultima atualizacao: 2026-03-25

## Endpoint

```
POST /functions/v1/api-tasks-status-update
```

## Headers

| Header | Valor | Obrigatorio |
|--------|-------|-------------|
| Authorization | Bearer {WORKFORCE_API_KEY} | Sim |
| apikey | {WORKFORCE_API_KEY} | Sim |
| Content-Type | application/json | Sim |

## Request

```json
{
  "project_id": "uuid",
  "updates": [
    { "task_id": "uuid", "status": "done" },
    { "task_id": "uuid", "status": "blocked" },
    { "task_id": "uuid", "status": "cancelled" }
  ]
}
```

### Campos

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| project_id | string (UUID) | Sim | ID do projeto |
| updates | array | Sim | Lista de atualizacoes (min: 1, max: 100) |
| updates[].task_id | string (UUID) | Sim | ID da task |
| updates[].status | string | Sim | Novo status da task |

### Status validos

`todo`, `in_progress`, `testing`, `in_review`, `done`, `blocked`, `cancelled`

## Response

### Sucesso (200)

```json
{
  "success": true,
  "data": {
    "results": [
      { "task_id": "uuid", "status": "done", "success": true },
      { "task_id": "uuid", "status": "blocked", "success": true },
      { "task_id": "uuid", "status": "cancelled", "success": false, "error": "Task not found" }
    ],
    "summary": {
      "total": 3,
      "succeeded": 2,
      "failed": 1
    }
  },
  "requestId": "string"
}
```

### Erro de validacao (400)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "descricao dos erros",
    "retryable": false
  },
  "requestId": "string"
}
```

### Projeto nao encontrado (404)

```json
{
  "success": false,
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project {id} not found",
    "retryable": false
  },
  "requestId": "string"
}
```

## Comportamento

- Todas as atualizacoes sao executadas em paralelo.
- Falhas individuais nao bloqueiam as demais (partial success).
- Cada task atualizada recebe automaticamente `updated_at` com o timestamp atual.
- Tasks com soft delete (`deleted_at` preenchido) nao sao atualizadas.
- O campo `summary` no response permite verificar rapidamente o resultado geral.

## Codigos de erro

| Codigo | HTTP | Descricao |
|--------|------|-----------|
| METHOD_NOT_ALLOWED | 405 | Metodo HTTP diferente de POST |
| INVALID_JSON | 400 | Body nao e JSON valido |
| VALIDATION_ERROR | 400 | Campos invalidos ou ausentes |
| PROJECT_NOT_FOUND | 404 | Projeto nao existe |
| INTERNAL_ERROR | 500 | Erro interno (retryable) |

## Estrutura de arquivos

```
api-tasks-status-update/
  index.ts              # Entry point e roteamento
  types.ts              # Interfaces de request/response
  validation.ts         # Validacao de payload
  database-service.ts   # Operacoes no banco
  README.md             # Documentacao
```

## Dependencias compartilhadas

- `_shared/supabase/client.ts` - Cliente Supabase singleton
- `_shared/database-utils.ts` - Timeout e tratamento de erros de banco
- `_shared/validation.ts` - Validadores reutilizaveis (UUID, status)
- `_shared/api-response-builder.ts` - Formatacao padrao de responses
- `_shared/response-formatter.ts` - Gerador de requestId

## Exemplo de uso (curl)

```bash
curl -s -X POST \
  -H "Authorization: Bearer ${WORKFORCE_API_KEY}" \
  -H "apikey: ${WORKFORCE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "50f4c696-ac2a-4c21-ab9b-2b4ac928bf75",
    "updates": [
      { "task_id": "a6041c87-36b2-4b91-83c0-4cbde0358b3d", "status": "done" },
      { "task_id": "542898ca-2075-456a-aedf-aea294fda421", "status": "blocked" }
    ]
  }' \
  "https://gerxucfvjluujtpwnybt.supabase.co/functions/v1/api-tasks-status-update"
```

## Deploy

```bash
supabase functions deploy api-tasks-status-update
```
