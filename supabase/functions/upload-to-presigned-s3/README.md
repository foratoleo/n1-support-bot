# Upload to Presigned S3 - Edge Function

Sistema de upload de arquivos para AWS S3 usando URLs pré-assinadas que permite upload direto do frontend para S3, bypassando o backend durante a transferência.

## Funcionalidades

- ✅ **Upload Direto**: Frontend faz POST direto para AWS S3
- ✅ **URLs Temporárias**: Expiração automática em 15 minutos
- ✅ **Validação Dupla**: Backend + S3 policy conditions
- ✅ **Progress Tracking**: Progresso detalhado via XMLHttpRequest
- ✅ **Access Points**: Suporte para AWS S3 Access Points
- ✅ **Sem Timeout**: Não limitado pelos 30s das Edge Functions
- ✅ **Tipos de Arquivo**: Suporte para 60+ tipos (imagens, docs, áudio, vídeo)

## Arquitetura

```
[Frontend] → [Backend: presigned URL] → [Frontend] → [S3 Direct]
    ↓              ↓                        ↓           ↓
Select File    Generate URL             POST to S3    Store File
Validate       Add Conditions           Track Progress Final URL
```

### Vantagens vs Upload Tradicional

| Aspecto | Upload Tradicional | Presigned S3 Upload |
|---------|-------------------|---------------------|
| **Path** | Frontend → Backend → S3 | Frontend → Backend → Frontend → S3 |
| **Processing** | Backend processa arquivo | Backend apenas gera URL |
| **Timeout** | Edge Function 30s limit | Sem limite no upload |
| **Scalability** | Limitado pelo backend | Upload direto escalável |
| **Progress** | Limitado | XMLHttpRequest detalhado |
| **Bandwidth** | Usa servidor | Zero servidor |

## API

### Endpoint
```
POST /functions/v1/upload-to-presigned-s3
```

### Request Body
```json
{
  "project": "nome-do-projeto",
  "filename": "arquivo.pdf",
  "contentType": "application/pdf",
  "fileSize": 1048576
}
```

### Response Success
```json
{
  "success": true,
  "url": "https://my-bucket.s3.amazonaws.com/",
  "fields": {
    "key": "drai_files/projeto/arquivo_1234567890.pdf",
    "Content-Type": "application/pdf",
    "acl": "bucket-owner-full-control",
    "policy": "eyJ...",
    "x-amz-algorithm": "AWS4-HMAC-SHA256",
    "x-amz-credential": "...",
    "x-amz-date": "...",
    "x-amz-signature": "..."
  },
  "key": "drai_files/projeto/arquivo_1234567890.pdf",
  "expires": "2025-09-30T17:15:00.000Z",
  "message": "Presigned URL generated successfully"
}
```

### Response Error
```json
{
  "success": false,
  "message": "Validation failed",
  "error": "File type 'text/plain' is not allowed. Please use supported formats."
}
```

## Configuração

### Environment Variables

```bash
# AWS Credentials (mesmas da função upload-to-s3)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name

# Opcional: Access Point para controle granular
AWS_S3_ACCESS_POINT=arn:aws:s3:us-east-1:123456789012:accesspoint/my-access-point
```

### Deploy

```bash
# Deploy para Supabase
supabase functions deploy upload-to-presigned-s3

# Configurar environment variables
supabase secrets set AWS_ACCESS_KEY_ID=your-key
supabase secrets set AWS_SECRET_ACCESS_KEY=your-secret
supabase secrets set AWS_REGION=us-east-1
supabase secrets set AWS_S3_BUCKET=your-bucket
```

## Uso Frontend

### Hook React
```typescript
import { usePresignedUpload } from '@/hooks/usePresignedUpload';

function UploadComponent() {
  const { uploadFile, state, currentStep, logs } = usePresignedUpload();

  const handleUpload = async (file: File) => {
    await uploadFile(file, 'meu-projeto');
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
      <div>Status: {currentStep.message}</div>
      {state.progress && <div>Progress: {state.progress.percentage}%</div>}
    </div>
  );
}
```

### Upload Manual
```typescript
// 1. Solicitar presigned URL
const response = await supabase.functions.invoke('upload-to-presigned-s3', {
  body: {
    project: 'meu-projeto',
    filename: file.name,
    contentType: file.type,
    fileSize: file.size
  }
});

// 2. Upload direto para S3
const formData = new FormData();
Object.entries(response.data.fields).forEach(([key, value]) => {
  formData.append(key, value);
});
formData.append('file', file);

const uploadResponse = await fetch(response.data.url, {
  method: 'POST',
  body: formData
});
```

## Segurança

### Policy Conditions
```typescript
Conditions: [
  ['content-length-range', 1, MAX_FILE_SIZE],  // 50MB max
  ['eq', '$Content-Type', request.contentType], // Tipo específico
  ['eq', '$acl', 'bucket-owner-full-control'],  // ACL controlada
]
```

### Validações
1. **Frontend**: Tipo de arquivo e tamanho básico
2. **Backend**: Metadados e geração de policies
3. **S3**: Validação final via policy conditions

### Expiração
- URLs expiram em **15 minutos** automaticamente
- Não é possível reutilizar URLs após expiração
- Políticas S3 impedem uploads não autorizados

## Tipos de Arquivo Suportados

- **Imagens**: JPG, PNG, GIF, WebP, SVG, BMP, TIFF, ICO
- **Documentos**: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, MD, CSV
- **Dados**: JSON, XML
- **Áudio**: MP3, WAV, FLAC, AAC, OGG, Opus, M4A, AIFF, WMA
- **Vídeo**: MP4, AVI, MOV, WebM, WMV, MKV, FLV, 3GP
- **Arquivos**: ZIP, RAR, TAR, GZ

## Monitoramento

### Logs Estruturados
```typescript
console.log("Processing presigned upload request:", {
  project: uploadRequest.project,
  filename: uploadRequest.filename,
  contentType: uploadRequest.contentType,
  fileSize: uploadRequest.fileSize
});
```

### Debug Credentials
```typescript
import { debugCredentials } from "./utils/aws-config.ts";

// Para diagnosticar problemas de credenciais
const debug = debugCredentials(config);
console.log("Credential debug info:", debug);
```

## Troubleshooting

### Erro: "Authorization header is malformed"
```bash
# Verificar formato das credenciais AWS
# Remover espaços/tabs das environment variables
AWS_ACCESS_KEY_ID="AKIA..." # sem espaços
AWS_SECRET_ACCESS_KEY="abc123..." # sem espaços
```

### Erro: "File type not allowed"
```typescript
// Verificar se o tipo está na lista ALLOWED_FILE_TYPES
import { ALLOWED_FILE_TYPES } from "./types.ts";
console.log("Tipos permitidos:", ALLOWED_FILE_TYPES);
```

### Erro: "Presigned URL expired"
```typescript
// URLs expiram em 15 minutos
// Solicitar nova URL se necessário
const isExpired = new Date() > new Date(presignedData.expires);
```

## Performance

### Métricas Esperadas
- **Geração de URL**: ~100-300ms
- **Upload S3**: Depende da conexão do usuário
- **Bandwidth servidor**: 0% (upload direto)
- **Timeout**: Sem limitação (vs 30s das Edge Functions)

### Otimizações
- Cache de credentials validation
- Parallel processing de multiple uploads
- Retry logic automático para network errors
- Progress chunking para UX responsiva

## Demo

Acesse `/presigned-upload-demo` para testar o sistema com interface visual completa incluindo:

- Seleção de arquivos com preview
- Progress tracking em tempo real
- Logs técnicos detalhados
- Comparação com upload tradicional
- Métricas de performance