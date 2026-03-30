# Create Technical Specs API Documentation

## Endpoint

```
POST /create-technical-specs
```

Generate comprehensive technical specifications using OpenAI's GPT-4o model with conversation context support.

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
  content: string;              // Required - Source content for technical specs generation
  project_id: string;           // Required - Project identifier for metadata tracking
  system_prompt?: string;       // Optional - Custom system instructions (defaults to built-in technical specs template)
  user_prompt?: string;         // Optional - Custom user prompt (defaults to standard prompt)
  previous_response_id?: string; // Optional - OpenAI Response ID for conversation continuity
  model?: string;               // Optional - OpenAI model to use (defaults to gpt-4o)
  temperature?: number;         // Optional - Temperature setting (defaults to 0.5)
  token_limit?: number;         // Optional - Max output tokens (defaults to 8000)
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | Input content describing features/system to specify. Must not be empty. |
| `project_id` | string | Yes | Project identifier for tracking and metadata. Must not be empty. |
| `system_prompt` | string | No | Override default technical specs generation instructions. Uses predefined template if omitted. |
| `user_prompt` | string | No | Override default user prompt. Uses standard prompt if omitted. |
| `previous_response_id` | string | No | OpenAI Response ID to maintain conversation context across multiple spec generations. |
| `model` | string | No | OpenAI model name (e.g., "gpt-4o", "gpt-4o-mini"). Defaults to "gpt-4o". |
| `temperature` | number | No | Creativity/randomness setting (0.0-2.0). Defaults to 0.5 for balanced output. |
| `token_limit` | number | No | Maximum output tokens. Defaults to 8000. |

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "document": "# Especificação Técnica\n\n## 1. Overview Técnico\n### Contexto\nSistema de chat em tempo real...",
  "response_id": "resp_abc123xyz"
}
```

**Fields:**
- `success`: Always `true` for successful requests
- `document`: Generated technical specification content in Markdown format
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

## Default Technical Specification Structure

When using the default `system_prompt`, generated technical specifications follow this structure:

### 1. Overview Técnico
- Context and problem statement
- High-level solution approach
- Technology stack overview

### 2. Arquitetura do Sistema
- System architecture diagram (described in text/mermaid)
- Component breakdown and responsibilities
- Communication patterns between components
- Deployment architecture

### 3. Design de Componentes
- Detailed component specifications
- Class/module structures
- Responsibilities and interfaces
- Design patterns applied

### 4. Modelos de Dados
- Database schema design
- Entity relationships
- Data validation rules
- Indexing strategy
- Migration considerations

### 5. APIs e Contratos
- API endpoints specification
- Request/response formats
- Authentication and authorization
- Error handling and status codes
- Rate limiting and quotas

### 6. Pontos de Integração
- External services and APIs
- Third-party libraries and dependencies
- Integration patterns and protocols
- Data synchronization strategies

### 7. Segurança
- Authentication mechanisms
- Authorization and access control
- Data encryption (at rest and in transit)
- Security best practices
- Vulnerability mitigation

### 8. Performance e Escalabilidade
- Performance requirements and targets
- Caching strategy
- Load balancing approach
- Horizontal/vertical scaling considerations
- Database optimization

### 9. Observabilidade
- Logging strategy and levels
- Metrics and monitoring
- Alerting and notifications
- Debugging and troubleshooting

### 10. Diretrizes de Implementação
- Development workflow
- Code organization and structure
- Testing strategy (unit, integration, e2e)
- Deployment process
- Configuration management

### 11. Considerações Técnicas
- Technical constraints and limitations
- Technical debt considerations
- Migration and rollback strategies
- Backward compatibility

### 12. Anexos Técnicos
- Diagrams and flowcharts
- Code snippets and examples
- Configuration templates
- Reference documentation

Output is always in **Brazilian Portuguese** unless explicitly specified otherwise in custom prompts.

## OpenAI Configuration

- **Model**: `gpt-4o`
- **Max Output Tokens**: 8000
- **Temperature**: 0.5 (balanced for technical accuracy and completeness)
- **Store**: `false`

## CORS Support

The endpoint supports CORS preflight requests:

```
OPTIONS /create-technical-specs
```

Returns 200 with appropriate CORS headers.

## Usage Examples

### Basic Technical Specification Generation

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-technical-specs \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Real-time chat system with WebSocket support, message persistence, and user presence tracking",
    "project_id": "proj_123"
  }'
```

### Technical Specification with Architecture Focus

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-technical-specs \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Microservices architecture for e-commerce platform with payment processing",
    "project_id": "proj_456",
    "system_prompt": "Generate technical specification with emphasis on microservices design patterns and inter-service communication",
    "user_prompt": "Create detailed architecture specification for:\n{{content}}",
    "temperature": 0.4
  }'
```

### Continuing Previous Specification Session

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-technical-specs \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Add specifications for API gateway, service mesh, and observability stack",
    "project_id": "proj_456",
    "previous_response_id": "resp_abc123xyz"
  }'
```

### Using Different Model for Simpler Specs

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-technical-specs \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Simple REST API for CRUD operations on user profiles",
    "project_id": "proj_789",
    "model": "gpt-4o-mini",
    "temperature": 0.4
  }'
```

### Security-Focused Technical Specification

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-technical-specs \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Healthcare patient records system with HIPAA compliance requirements",
    "project_id": "proj_999",
    "system_prompt": "Generate security-first technical specification with emphasis on data protection, encryption, and compliance",
    "temperature": 0.3
  }'
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
- Metadata includes `project_id` and `operation: 'create-technical-specs'` for tracking
- All responses include CORS headers for web client compatibility
- Built on Deno runtime with TypeScript
- Moderate temperature (0.5) used for balanced technical accuracy and completeness
- Comprehensive coverage of architecture, design, security, and implementation

## Best Practices

1. **Content Quality**: Provide clear, detailed descriptions of system requirements and constraints
2. **Conversation Context**: Use `previous_response_id` to build upon previous specifications
3. **Temperature Setting**: Keep temperature moderate (0.4-0.6) for consistent technical content
4. **Model Selection**: Use `gpt-4o` for complex systems, `gpt-4o-mini` for simpler specifications
5. **Custom Prompts**: Add specific focus areas (security, performance, scalability) in custom prompts
6. **Iteration**: Generate initial specs, then refine with follow-up requests for specific sections
7. **Completeness**: Include all relevant context about technology stack, constraints, and requirements

## Technical Coverage Areas

The default configuration generates specifications covering:

- **Architecture**: System design, component interaction, deployment topology
- **Components**: Detailed module specifications, interfaces, responsibilities
- **Data Models**: Database schema, relationships, indexing, migrations
- **APIs**: Endpoint contracts, authentication, error handling, rate limiting
- **Integration**: External services, third-party libraries, communication protocols
- **Security**: Authentication, authorization, encryption, vulnerability mitigation
- **Performance**: Scalability strategy, caching, optimization, load handling
- **Observability**: Logging, monitoring, metrics, alerting, debugging
- **Implementation**: Development workflow, testing strategy, deployment process
- **Technical Considerations**: Constraints, technical debt, migration strategies

## Use Cases

- **New System Design**: Complete technical specification for greenfield projects
- **System Modernization**: Technical specs for migrating legacy systems
- **API Design**: Detailed API contracts and integration specifications
- **Microservices**: Service boundaries, communication patterns, data consistency
- **Security Reviews**: Security-focused technical specifications and threat models
- **Performance Optimization**: Technical specifications for performance improvements
- **Integration Projects**: Specifications for integrating with external systems
- **Database Design**: Data model specifications with schema and indexing strategy
