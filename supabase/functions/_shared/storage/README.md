# Modulo compartilhado: _shared/storage

**Criado em:** 2026-03-16
**Ultima atualizacao:** 2026-03-16

---

## Indice

1. [Visao geral](#1-visao-geral)
2. [Estrutura de arquivos](#2-estrutura-de-arquivos)
3. [Arquitetura: Provider Factory Pattern](#3-arquitetura-provider-factory-pattern)
4. [Variaveis de ambiente por provider](#4-variaveis-de-ambiente-por-provider)
5. [Configurar Supabase Secrets: AWS S3](#5-configurar-supabase-secrets-aws-s3)
6. [Configurar Supabase Secrets: Google Cloud Storage](#6-configurar-supabase-secrets-google-cloud-storage)
7. [Configurar CORS no bucket GCS](#7-configurar-cors-no-bucket-gcs)
8. [Permissoes IAM da Service Account GCS](#8-permissoes-iam-da-service-account-gcs)
9. [Estrategia de migracao entre providers](#9-estrategia-de-migracao-entre-providers)
10. [Como adicionar um novo provider](#10-como-adicionar-um-novo-provider)

---

## 1. Visao geral

Este modulo implementa uma camada de abstracao de armazenamento de objetos para as Edge Functions do projeto. Ele permite alternar entre **AWS S3** e **Google Cloud Storage (GCS)** sem alterar codigo ou realizar redeploy — basta ajustar a variavel de ambiente `STORAGE_PROVIDER` nas secrets do Supabase.

O Supabase Storage (usado para avatares, logos e outros arquivos internos da plataforma) esta fora do escopo deste modulo e permanece inalterado.

### Edge Functions que utilizam este modulo

| Edge Function | Operacao |
|---|---|
| `upload-to-s3` | Upload direto de arquivo via Edge Function |
| `upload-to-presigned-s3` | Geracao de URL presigned para upload direto do browser |
| `generate-presigned-download-url` | Geracao de URL presigned para download direto do browser |

---

## 2. Estrutura de arquivos

```
supabase/functions/_shared/storage/
├── index.ts            # Barrel file — unica porta de entrada para as Edge Functions
├── types.ts            # Interfaces e tipos do contrato de storage
├── config.ts           # Leitura e validacao das variaveis de ambiente
├── provider-factory.ts # Factory: le STORAGE_PROVIDER e instancia o provider correto
├── s3-provider.ts      # Implementacao AWS S3 (via AWS SDK v3)
├── gcs-provider.ts     # Implementacao GCS (via REST API + OAuth2)
├── gcs-auth.ts         # Autenticacao GCS: JWT RS256 e Signed URLs via IAM signBlob
└── README.md           # Este arquivo
```

### Como importar nas Edge Functions

```typescript
import { createStorageProvider } from '../_shared/storage/index.ts';
import type { StorageProvider, UploadResult } from '../_shared/storage/index.ts';
```

Importe sempre pelo `index.ts`. Nunca importe diretamente de `s3-provider.ts`, `gcs-provider.ts` ou qualquer outro arquivo interno do modulo.

---

## 3. Arquitetura: Provider Factory Pattern

O modulo usa o padrao **Provider Factory**: a funcao `createStorageProvider()` le a variavel `STORAGE_PROVIDER` do ambiente e retorna a implementacao concreta correspondente. As Edge Functions interagem apenas com a interface `StorageProvider`, sem conhecer qual provider esta ativo.

```
Edge Function
    |
    v
createStorageProvider()           <- le STORAGE_PROVIDER do ambiente
    |
    +-- 's3'  --> S3Provider      <- AWS SDK v3 (multipart upload, presigned POST)
    |
    +-- 'gcs' --> GCSProvider     <- REST API + OAuth2 JWT (upload media, signed URL PUT)
                      |
                      v
                  gcs-auth.ts     <- JWT RS256 via Web Crypto API, signBlob via IAM API
```

### Interface StorageProvider

Todos os providers implementam os mesmos quatro metodos:

| Metodo | Descricao |
|---|---|
| `upload(params)` | Upload direto de arquivo via Edge Function |
| `generatePresignedUploadUrl(params)` | URL presigned para upload pelo browser |
| `generatePresignedDownloadUrl(params)` | URL presigned para download pelo browser |
| `deleteObject(key)` | Remove um objeto do bucket |

### Diferenca de metodo HTTP no upload presigned

O campo `method` em `PresignedUploadResult` indica ao frontend qual metodo HTTP usar:

| Provider | Metodo | Formato do corpo |
|---|---|---|
| S3 | `POST` | `multipart/form-data` com `fields` obrigatorios |
| GCS | `PUT` | Binario direto (`Content-Type` do arquivo) |

O hook `usePresignedUpload` no frontend le este campo e adapta o comportamento do XHR automaticamente.

---

## 4. Variaveis de ambiente por provider

### Variavel de controle (obrigatoria para ambos)

| Variavel | Valores aceitos | Padrao |
|---|---|---|
| `STORAGE_PROVIDER` | `s3`, `gcs` | `s3` |

A ausencia da variavel equivale a `s3` (compatibilidade retroativa).

### Variaveis do AWS S3

| Variavel | Obrigatoria | Descricao |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | Sim | ID da chave de acesso IAM |
| `AWS_SECRET_ACCESS_KEY` | Sim | Chave secreta IAM |
| `AWS_S3_BUCKET` | Sim | Nome do bucket S3 |
| `AWS_REGION` | Nao | Regiao AWS (padrao: `us-east-1`) |
| `AWS_S3_ACCESS_POINT` | Nao | Alias do S3 Access Point |
| `AWS_S3_ACCESS_POINT_ARN` | Nao | ARN do S3 Access Point |

### Variaveis do Google Cloud Storage

| Variavel | Obrigatoria | Descricao |
|---|---|---|
| `GCS_PROJECT_ID` | Sim | ID do projeto GCP |
| `GCS_BUCKET` | Sim | Nome do bucket GCS |
| `GCS_CLIENT_EMAIL` | Sim | Email da Service Account |
| `GCS_PRIVATE_KEY` | Sim | Chave privada RSA da Service Account (formato PEM, com `\n` literais) |

---

## 5. Configurar Supabase Secrets: AWS S3

Configure as secrets via CLI do Supabase. Substitua os valores pelos dados reais da sua conta AWS:

```bash
supabase secrets set STORAGE_PROVIDER=s3
supabase secrets set AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
supabase secrets set AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
supabase secrets set AWS_S3_BUCKET=meu-bucket-producao
supabase secrets set AWS_REGION=us-east-1
```

Para verificar quais secrets estao configuradas:

```bash
supabase secrets list
```

---

## 6. Configurar Supabase Secrets: Google Cloud Storage

### 6.1 Pre-requisitos no GCP

Antes de configurar as secrets, voce precisa de:

1. Um projeto GCP com a **Cloud Storage API** habilitada
2. Um bucket GCS criado na regiao desejada
3. Uma **Service Account** com as permissoes necessarias (ver secao 8)
4. O arquivo de chave JSON da Service Account baixado do GCP Console

### 6.2 Extrair os valores do arquivo de chave JSON

O arquivo de chave JSON da Service Account tem este formato:

```json
{
  "type": "service_account",
  "project_id": "meu-projeto-gcp",
  "private_key_id": "abc123",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n",
  "client_email": "storage-sa@meu-projeto-gcp.iam.gserviceaccount.com",
  "client_id": "123456789",
  ...
}
```

Os campos necessarios sao: `project_id`, `client_email` e `private_key`.

### 6.3 Configurar as secrets

```bash
supabase secrets set STORAGE_PROVIDER=gcs
supabase secrets set GCS_PROJECT_ID=meu-projeto-gcp
supabase secrets set GCS_BUCKET=meu-bucket-gcs
supabase secrets set GCS_CLIENT_EMAIL=storage-sa@meu-projeto-gcp.iam.gserviceaccount.com
```

Para a chave privada, o valor deve ser a string PEM com as quebras de linha substituidas por `\n` literais. Use o comando abaixo para extrair o valor correto diretamente do arquivo JSON:

```bash
cat chave-service-account.json | python3 -c "import json,sys; k=json.load(sys.stdin)['private_key']; print(k.replace('\n','\\\\n'))" | xargs -I{} supabase secrets set GCS_PRIVATE_KEY={}
```

Ou manualmente, copie o valor do campo `private_key` e substitua cada quebra de linha real por `\n` antes de definir a secret. O modulo converte os `\n` literais de volta para quebras de linha reais antes de importar a chave (via `.replace(/\\n/g, '\n')` em `config.ts`).

---

## 7. Configurar CORS no bucket GCS

O upload via URL presigned (operacao `generatePresignedUploadUrl`) usa o metodo `PUT` com envio binario direto do browser para o GCS. Para que o browser aceite a resposta cross-origin, o bucket GCS precisa ter CORS configurado explicitamente.

### 7.1 Criar o arquivo de configuracao CORS

Crie um arquivo chamado `cors.json` com o seguinte conteudo. Ajuste as origens conforme o ambiente:

```json
[
  {
    "origin": [
      "https://app.draiworkforce.com",
      "http://localhost:5173"
    ],
    "method": [
      "PUT",
      "GET",
      "OPTIONS"
    ],
    "responseHeader": [
      "Content-Type",
      "Authorization"
    ],
    "maxAgeSeconds": 3600
  }
]
```

Para ambientes de staging ou preview, adicione as origens correspondentes no array `origin`.

### 7.2 Aplicar a configuracao CORS via gcloud CLI

```bash
gcloud storage buckets update gs://BUCKET_NAME --cors-file=cors.json
```

Substitua `BUCKET_NAME` pelo nome real do bucket.

### 7.3 Verificar a configuracao

```bash
gcloud storage buckets describe gs://BUCKET_NAME --format="json(cors)"
```

### 7.4 Observacoes

- A configuracao CORS e necessaria apenas para o metodo `PUT` (upload presigned via GCS). O download presigned via `GET` tambem requer CORS se o browser precisar ler o conteudo (ex.: visualizacao inline).
- O S3 tem seu proprio mecanismo de CORS configurado diretamente no console AWS ou via SDK; este arquivo documenta apenas a configuracao GCS.
- Alteracoes de CORS no GCS podem levar alguns minutos para propagar.

---

## 8. Permissoes IAM da Service Account GCS

A Service Account usada nas secrets precisa das seguintes permissoes no bucket GCS:

### 8.1 Permissoes necessarias

| Permissao | Motivo |
|---|---|
| `storage.objects.create` | Upload direto e upload via URL presigned |
| `storage.objects.get` | Geracao de URL presigned de download e leitura de objetos |
| `storage.objects.delete` | Remocao de objetos via `deleteObject()` |
| `iam.serviceAccounts.signBlob` | Assinatura de Signed URLs via IAM API (obrigatoria para URLs presigned) |

### 8.2 Papel recomendado

O papel `roles/storage.objectAdmin` no bucket cobre `storage.objects.create`, `storage.objects.get` e `storage.objects.delete`. A permissao `iam.serviceAccounts.signBlob` precisa ser concedida separadamente.

### 8.3 Configurar via gcloud CLI

```bash
# Conceder acesso de escrita/leitura/delete no bucket
gcloud storage buckets add-iam-policy-binding gs://BUCKET_NAME \
  --member="serviceAccount:storage-sa@SEU_PROJETO.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Conceder permissao de signBlob no nivel do projeto (necessaria para Signed URLs)
gcloud projects add-iam-policy-binding SEU_PROJETO \
  --member="serviceAccount:storage-sa@SEU_PROJETO.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"
```

Substitua `BUCKET_NAME`, `SEU_PROJETO` e o email da Service Account pelos valores reais.

### 8.4 Alternativa com papel customizado (menor privilegio)

Se o principio de menor privilegio for necessario, crie um papel customizado contendo apenas as quatro permissoes listadas na secao 8.1:

```bash
gcloud iam roles create DrAiStorageRole \
  --project=SEU_PROJETO \
  --title="DR AI Storage Role" \
  --permissions="storage.objects.create,storage.objects.get,storage.objects.delete,iam.serviceAccounts.signBlob"

gcloud projects add-iam-policy-binding SEU_PROJETO \
  --member="serviceAccount:storage-sa@SEU_PROJETO.iam.gserviceaccount.com" \
  --role="projects/SEU_PROJETO/roles/DrAiStorageRole"
```

---

## 9. Estrategia de migracao entre providers

### 9.1 Comportamento da troca

A mudanca de provider e uma **troca definitiva sem migracao automatica de dados**:

- Ao alterar `STORAGE_PROVIDER` de `s3` para `gcs`, todos os novos uploads passam a ir para o GCS.
- Arquivos ja armazenados no S3 **nao sao migrados** automaticamente e continuam acessiveis pelas suas URLs originais enquanto existirem no bucket S3.
- Nao ha suporte a dual-read (consultar ambos os providers simultaneamente).

### 9.2 Como realizar a troca

1. Provisione o bucket GCS e configure as permissoes IAM (secao 8).
2. Configure o CORS no bucket GCS (secao 7).
3. Adicione as secrets GCS no Supabase (secao 6).
4. Altere a secret `STORAGE_PROVIDER` para `gcs`:

```bash
supabase secrets set STORAGE_PROVIDER=gcs
```

5. As Edge Functions lerão o novo valor na proxima invocacao — nenhum redeploy e necessario.

### 9.3 Como reverter

Para voltar ao S3:

```bash
supabase secrets set STORAGE_PROVIDER=s3
```

### 9.4 Migracao manual de arquivos existentes

Se for necessario mover os arquivos antigos do S3 para o GCS, utilize o `gsutil` ou um script de migracao customizado. Esta operacao esta fora do escopo deste modulo.

---

## 10. Como adicionar um novo provider

Para adicionar suporte a um novo provedor de armazenamento (ex.: Azure Blob Storage, Cloudflare R2), siga os passos abaixo.

### 10.1 Implementar a interface StorageProvider

Crie o arquivo `supabase/functions/_shared/storage/nome-provider.ts` e implemente todos os metodos da interface `StorageProvider` definida em `types.ts`:

```typescript
import type {
  StorageProvider,
  UploadParams,
  UploadResult,
  PresignedUploadParams,
  PresignedUploadResult,
  PresignedDownloadParams,
  PresignedDownloadResult,
} from './types.ts';

export class NovoProvider implements StorageProvider {
  constructor(config: NovoProviderConfig) {
    // inicializar com as credenciais do provider
  }

  async upload(params: UploadParams): Promise<UploadResult> {
    // implementar upload direto
  }

  async generatePresignedUploadUrl(params: PresignedUploadParams): Promise<PresignedUploadResult> {
    // implementar URL presigned de upload
    // definir method: 'PUT' ou 'POST' conforme o provider
  }

  async generatePresignedDownloadUrl(params: PresignedDownloadParams): Promise<PresignedDownloadResult> {
    // implementar URL presigned de download
  }

  async deleteObject(key: string): Promise<void> {
    // implementar remocao de objeto
  }
}
```

### 10.2 Adicionar o tipo em StorageProviderName

Em `types.ts`, adicione o novo provider ao union type:

```typescript
export type StorageProviderName = 's3' | 'gcs' | 'novo-provider';
```

### 10.3 Adicionar validacao de config em config.ts

Em `config.ts`, crie a funcao `validateNovoProviderConfig()` seguindo o mesmo padrao de `validateS3Config()` e `validateGCSConfig()`:

```typescript
export function validateNovoProviderConfig(): NovoProviderConfig {
  const varA = Deno.env.get('NOVO_VAR_A');
  const varB = Deno.env.get('NOVO_VAR_B');

  const missingVars: string[] = [];
  if (!varA) missingVars.push('NOVO_VAR_A');
  if (!varB) missingVars.push('NOVO_VAR_B');

  if (missingVars.length > 0) {
    throw new Error(
      `[NovoProvider Config] Missing required environment variables: ${missingVars.join(', ')}. ` +
        'Set them via `supabase secrets set <VAR>=<VALUE>`.'
    );
  }

  return { varA: varA!, varB: varB! };
}
```

### 10.4 Registrar na factory

Em `provider-factory.ts`, adicione o novo case no switch:

```typescript
case 'novo-provider': {
  const config = validateNovoProviderConfig();
  return new NovoProvider(config);
}
```

### 10.5 Exportar pelo index.ts

Em `index.ts`, adicione as re-exportacoes necessarias:

```typescript
export { validateNovoProviderConfig } from './config.ts';
```

### 10.6 Documentar as variaveis de ambiente

Adicione a nova secret na tabela da secao 4 deste README e crie uma secao de instrucoes de configuracao equivalente as secoes 5 e 6.

### 10.7 Consideracoes sobre o campo method

Se o novo provider usar `PUT` para upload presigned (como o GCS), o campo `method: 'PUT'` em `PresignedUploadResult` ja e suportado pelo hook `usePresignedUpload` no frontend. Se usar `POST` com form fields (como o S3), retorne `method: 'POST'` e popule o campo `fields` com os parametros necessarios.
