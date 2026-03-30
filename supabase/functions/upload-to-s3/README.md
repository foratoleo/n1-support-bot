# Supabase Edge Function: upload-to-s3

Esta Edge Function permite o upload de arquivos para um bucket S3 da AWS através de requisições POST com multipart/form-data.

## 📋 Funcionalidades

- ✅ Upload de arquivos para AWS S3
- ✅ Organização automática por projeto: `drai_files/{project}/`
- ✅ Geração de nomes únicos com timestamp
- ✅ Validação de tipos de arquivo e tamanho
- ✅ Suporte a multipart upload para arquivos grandes
- ✅ Tratamento completo de erros
- ✅ Headers CORS configurados
- ✅ Logging estruturado

## 🚀 Endpoint

```
POST /functions/v1/upload-to-s3
Content-Type: multipart/form-data
```

### Parâmetros da Requisição

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `file` | File | ✅ | Arquivo a ser enviado |
| `project` | string | ✅ | Identificador do projeto |

### Exemplo de Requisição

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('project', 'meu-projeto');

const response = await fetch('/functions/v1/upload-to-s3', {
  method: 'POST',
  body: formData
});

const result = await response.json();
```

### Resposta de Sucesso (200)

```json
{
  "success": true,
  "filename": "documento_1703845800000.pdf",
  "project": "meu-projeto",
  "message": "File uploaded successfully"
}
```

### Resposta de Erro (400/500)

```json
{
  "success": false,
  "message": "File size exceeds 50MB limit",
  "error": "Validation error"
}
```

## 📁 Estrutura do Projeto

```
supabase/functions/upload-to-s3/
├── index.ts              # Handler principal
├── types.ts              # Interfaces TypeScript
├── utils/
│   ├── aws-config.ts     # Configuração AWS S3
│   ├── file-utils.ts     # Utilitários para arquivos
│   └── validation.ts     # Validação de entrada
└── README.md             # Esta documentação
```

## 🔧 Configuração

### Variáveis de Ambiente Obrigatórias

Configure estas variáveis no painel do Supabase:

```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=meu-bucket
```

### Permissões IAM Mínimas

A chave AWS deve ter as seguintes permissões no bucket S3:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::meu-bucket/drai_files/*"
    }
  ]
}
```

## 📝 Validações Implementadas

### Tipos de Arquivo Permitidos

- **Imagens**: JPEG, PNG, GIF, WebP, SVG, BMP, TIFF, ICO
- **Documentos**: PDF, TXT, CSV, MD (Markdown), DOCX, XLSX, PPTX, DOC, XLS, PPT
- **Dados**: JSON, XML
- **Áudio**: MP3, WAV, OGG, FLAC, AAC, M4A, WMA, AIFF, AMR, Opus, WebM Audio, AU
- **Vídeo**: MP4, AVI, MOV, WebM, WMV, FLV, MKV, MPEG, 3GP, OGV, TS, M4V
- **Arquivos**: ZIP, RAR, TAR, GZIP

### Limitações

- **Tamanho máximo**: 50MB por arquivo
- **Tamanho mínimo**: 1 byte
- **Nome do arquivo**: máximo 255 caracteres
- **Nome do projeto**: 1-100 caracteres (alfanuméricos, espaços, hífens, underscores)
- **Timeout**: 30 segundos para upload

## 🎯 Estrutura de Arquivos no S3

Os arquivos são organizados da seguinte forma:

```
meu-bucket/
└── drai_files/
    ├── projeto-a/
    │   ├── documento_1703845800000.pdf
    │   └── imagem_1703845900000.jpg
    └── projeto-b/
        └── arquivo_1703846000000.xlsx
```

### Geração de Nomes

O sistema gera nomes únicos automaticamente:

1. **Slug**: Remove acentos e caracteres especiais do nome original
2. **Timestamp**: Adiciona timestamp em milissegundos
3. **Extensão**: Preserva a extensão original

**Exemplo**: `Meu Documento (1).pdf` → `meu-documento-1_1703845800000.pdf`

## 🔍 Logging e Monitoramento

### Logs de Upload

```typescript
// Log de início
console.log(`Starting upload: ${file.name} (${file.size} bytes) to project: ${project}`);

// Progress tracking
upload.on("httpUploadProgress", (progress) => {
  const percent = progress.total ?
    Math.round((progress.loaded / progress.total) * 100) : 0;
  console.log(`Upload progress: ${percent}% (${progress.loaded}/${progress.total} bytes)`);
});

// Log de sucesso
console.log("Upload completed successfully", { key, etag: result.ETag });
```

### Estrutura dos Logs

Todos os logs incluem:
- Timestamp
- Tamanho do arquivo
- Nome do projeto
- Progresso do upload
- ETag do S3 (após sucesso)
- Detalhes de erro (se aplicável)

## 🚨 Tratamento de Erros

### Erros de Validação (400)

- Arquivo não fornecido
- Campo project ausente ou inválido
- Tipo de arquivo não permitido
- Arquivo muito grande (>50MB)
- Nome de arquivo muito longo

### Erros do AWS S3 (500)

- Credenciais inválidas
- Bucket não encontrado
- Permissões insuficientes
- Timeout na conexão
- Limite de taxa excedido

### Códigos de Erro Comuns

| Código | Descrição | Solução |
|--------|-----------|---------|
| `NoSuchBucket` | Bucket S3 não existe | Verificar nome do bucket |
| `AccessDenied` | Permissões insuficientes | Revisar policy IAM |
| `SignatureDoesNotMatch` | Credenciais inválidas | Verificar access key/secret |
| `EntityTooLarge` | Arquivo muito grande | Reduzir tamanho do arquivo |
| `RequestTimeout` | Timeout na requisição | Tentar novamente |

## 🧪 Testes

### Teste Local

```bash
# Deploy da function
supabase functions deploy upload-to-s3

# Teste com curl
curl -X POST \
  -F "file=@/path/to/test.pdf" \
  -F "project=teste" \
  https://your-project.supabase.co/functions/v1/upload-to-s3
```

### Teste com JavaScript

```javascript
// Teste básico
async function testUpload() {
  const fileInput = document.querySelector('input[type="file"]');
  const formData = new FormData();

  formData.append('file', fileInput.files[0]);
  formData.append('project', 'teste-upload');

  try {
    const response = await fetch('/functions/v1/upload-to-s3', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    console.log('Upload result:', result);
  } catch (error) {
    console.error('Upload error:', error);
  }
}
```

## 🔒 Segurança

### Medidas Implementadas

1. **Validação de MIME type**: Apenas tipos permitidos são aceitos
2. **Sanitização de nomes**: Remoção de caracteres perigosos
3. **Limitação de tamanho**: Máximo 50MB por arquivo
4. **Timeout**: Previne uploads infinitos
5. **Headers CORS**: Configurados adequadamente
6. **Não exposição de credenciais**: AWS keys mantidas em environment variables

### Recomendações Adicionais

- [ ] Implementar rate limiting por IP
- [ ] Adicionar autenticação JWT
- [ ] Configurar bucket policy restritiva
- [ ] Habilitar versionamento no S3
- [ ] Configurar lifecycle rules para limpeza automática
- [ ] Implementar logging para auditoria

## 📈 Performance

### Otimizações Implementadas

- **Multipart Upload**: Para arquivos >5MB
- **Streaming**: Upload direto sem armazenamento local
- **Configuração otimizada**: Queue size e part size adequados
- **Progress tracking**: Monitoramento de progresso
- **Error retry**: Não deixa partes órfãs em caso de erro

### Métricas Esperadas

- **Throughput**: ~10-50MB/s (dependendo da região)
- **Latência**: <2s para arquivos pequenos (<1MB)
- **Timeout**: 30s máximo por upload
- **Concorrência**: Suporte a múltiplos uploads simultâneos

## 🛠️ Deploy

### Pré-requisitos

1. ✅ Projeto Supabase configurado
2. ✅ Bucket S3 criado
3. ✅ Credenciais AWS configuradas
4. ✅ Supabase CLI instalado

### Comandos de Deploy

```bash
# Deploy da function
supabase functions deploy upload-to-s3

# Configurar environment variables
supabase secrets set AWS_ACCESS_KEY_ID=your_access_key
supabase secrets set AWS_SECRET_ACCESS_KEY=your_secret_key
supabase secrets set AWS_REGION=us-east-1
supabase secrets set AWS_S3_BUCKET=your_bucket_name

# Verificar deploy
supabase functions list
```

### Verificação Pós-Deploy

1. ✅ Function aparece na lista
2. ✅ Environment variables configuradas
3. ✅ Teste de upload bem-sucedido
4. ✅ Arquivo aparece no S3
5. ✅ Logs aparecem no dashboard

## 📚 Referências

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [AWS SDK v3 for JavaScript](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [AWS S3 Multipart Upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)
- [Deno Runtime](https://deno.land/manual)

## 🐛 Troubleshooting

### Problemas Comuns

**1. "Missing environment variables"**
- Verificar se todas as variáveis AWS estão configuradas
- Comando: `supabase secrets list`

**2. "S3 bucket not found"**
- Verificar nome do bucket
- Verificar região do bucket

**3. "Access Denied"**
- Revisar permissões IAM
- Verificar bucket policy

**4. "Request timeout"**
- Verificar conectividade com AWS
- Reduzir tamanho do arquivo
- Tentar novamente

**5. "File type not allowed"**
- Verificar lista de MIME types permitidos
- Verificar extensão do arquivo