# Create Unit Tests API Documentation

## Endpoint

```
POST /create-unit-tests
```

Generate production-ready unit tests using OpenAI's GPT-4o model with multi-language and framework support.

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
  // Required fields
  content: string;              // Main instructions or context for test generation
  project_id: string;           // Project identifier for metadata tracking

  // Optional test configuration
  language?: string;            // Programming language (javascript, typescript, python, java)
  framework?: string;           // Testing framework (jest, vitest, pytest, junit5, etc.)
  functionName?: string;        // Name of function/class being tested
  code?: string;                // Actual code implementation to generate tests for
  scenarios?: string;           // Specific test scenarios to cover

  // Optional AI configuration overrides
  system_prompt?: string;       // Custom system instructions (overrides language-specific defaults)
  user_prompt?: string;         // Custom user prompt template
  previous_response_id?: string; // OpenAI Response ID for conversation continuity
  model?: string;               // OpenAI model override (default: gpt-4o)
  temperature?: number;         // Temperature override (default: 0.2)
  token_limit?: number;         // Token limit override (default: 4000)

  // Optional metadata
  user_id?: string;             // User identifier for tracking
  meeting_transcript_id?: string; // Optional transcript reference
}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `content` | string | Yes | - | Main instructions or context for test generation. Must not be empty. |
| `project_id` | string | Yes | - | Project identifier for tracking and metadata. Must not be empty. |
| `language` | string | No | `typescript` | Programming language. Supported: `javascript`, `typescript`, `python`, `java` |
| `framework` | string | No | Auto-detect | Testing framework. Language-dependent options available. |
| `functionName` | string | No | - | Name of the function or class being tested. Used in template placeholder `{{functionName}}`. |
| `code` | string | No | - | Actual code implementation to generate tests for. Provides context for more accurate test generation. |
| `scenarios` | string | No | - | Specific test scenarios to cover (e.g., "edge cases, error handling, async operations"). |
| `system_prompt` | string | No | Language-specific | Override default system instructions. Uses language-specific prompts if omitted. |
| `user_prompt` | string | No | Template-based | Override default user prompt template. Supports Handlebars placeholders. |
| `previous_response_id` | string | No | - | OpenAI Response ID to maintain conversation context across multiple test generations. |
| `model` | string | No | `gpt-4o` | OpenAI model to use. Options: `gpt-4o`, `gpt-4o-mini` |
| `temperature` | number | No | `0.2` | Randomness level (0.0-2.0). Lower values produce more deterministic output. |
| `token_limit` | number | No | `4000` | Maximum response length in tokens. |
| `user_id` | string | No | - | User identifier for tracking purposes. |
| `meeting_transcript_id` | string | No | - | Optional meeting transcript reference for document linking. |

### Supported Languages and Frameworks

| Language | Supported Frameworks |
|----------|---------------------|
| `javascript` | `jest`, `vitest`, `mocha` |
| `typescript` | `jest`, `vitest`, `mocha` |
| `python` | `pytest`, `unittest` |
| `java` | `junit5`, `junit4`, `testng` |

### Handlebars Placeholders

The `user_prompt` template supports these placeholders:

- `{{content}}` - Replaced with the `content` field value
- `{{functionName}}` - Replaced with the `functionName` field value
- `{{language}}` - Replaced with the `language` field value
- `{{framework}}` - Replaced with the `framework` field value
- `{{code}}` - Replaced with the `code` field value
- `{{scenarios}}` - Replaced with the `scenarios` field value

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "document": "import { describe, it, expect, jest } from '@jest/globals';\n\ndescribe('authenticateUser', () => {\n  it('should authenticate valid credentials', () => {\n    // Test implementation\n  });\n});",
  "response_id": "resp_abc123xyz"
}
```

**Fields:**
- `success`: Always `true` for successful requests
- `document`: Generated unit test code with proper imports and structure
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

#### 400 Bad Request - Invalid Language/Framework

```json
{
  "success": false,
  "error": "Unsupported language: xyz"
}
```

```json
{
  "success": false,
  "error": "Framework 'abc' not compatible with language 'python'"
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
  "error": "Failed to generate unit tests"
}
```

**Note**: OpenAI API errors preserve their original status codes when available.

## Default Test Structure

### JavaScript/TypeScript (Jest/Vitest)

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'jest';

describe('FunctionName', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Happy Path', () => {
    it('should handle valid input correctly', () => {
      // Arrange
      const input = 'valid';

      // Act
      const result = functionName(input);

      // Assert
      expect(result).toBe(expected);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      // Test implementation
    });

    it('should handle null values', () => {
      // Test implementation
    });
  });

  describe('Error Scenarios', () => {
    it('should throw error for invalid input', () => {
      expect(() => functionName(null)).toThrow();
    });
  });
});
```

### Python (pytest)

```python
import pytest
from module import function_name

@pytest.fixture
def sample_data():
    return {'key': 'value'}

class TestFunctionName:
    def test_valid_input(self, sample_data):
        """Testa entrada válida"""
        # Arrange
        input_data = sample_data

        # Act
        result = function_name(input_data)

        # Assert
        assert result == expected

    def test_empty_input(self):
        """Testa entrada vazia"""
        with pytest.raises(ValueError):
            function_name(None)

    @pytest.mark.parametrize("input,expected", [
        ("test1", "result1"),
        ("test2", "result2"),
    ])
    def test_parametrized(self, input, expected):
        """Testa múltiplos cenários"""
        assert function_name(input) == expected
```

### Java (JUnit 5 + Mockito)

```java
import org.junit.jupiter.api.*;
import org.mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DisplayName("Function Name Tests")
class FunctionNameTest {
    @Mock
    private DependencyService dependencyService;

    @InjectMocks
    private ServiceUnderTest serviceUnderTest;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @AfterEach
    void tearDown() {
        // Cleanup
    }

    @Nested
    @DisplayName("Happy Path")
    class HappyPath {
        @Test
        @DisplayName("Should handle valid input correctly")
        void testValidInput() {
            // Arrange
            String input = "valid";
            when(dependencyService.process(input)).thenReturn("result");

            // Act
            String result = serviceUnderTest.functionName(input);

            // Assert
            assertEquals("result", result);
            verify(dependencyService).process(input);
        }
    }

    @Nested
    @DisplayName("Error Scenarios")
    class ErrorScenarios {
        @Test
        @DisplayName("Should throw exception for null input")
        void testNullInput() {
            assertThrows(IllegalArgumentException.class,
                () -> serviceUnderTest.functionName(null));
        }
    }
}
```

## Test Generation Principles

Generated tests follow these principles:

1. **Arrange-Act-Assert (AAA) Pattern** - Clear three-phase test structure
2. **Test Isolation** - Each test is independent with proper setup/teardown
3. **Descriptive Names** - Test names clearly describe what is being tested
4. **Complete Coverage** - Happy paths, edge cases, and error scenarios
5. **Proper Mocking** - External dependencies are mocked appropriately
6. **Framework Conventions** - Follows language and framework best practices
7. **Production-Ready** - Tests are ready to run without modification

## OpenAI Configuration

- **Model**: `gpt-4o` (optimized for code generation)
- **Max Output Tokens**: 4000 (sufficient for comprehensive test suites)
- **Temperature**: 0.2 (low for deterministic, consistent output)
- **Store**: `true` (enables conversation continuity)

## CORS Support

The endpoint supports CORS preflight requests:

```
OPTIONS /create-unit-tests
```

Returns 200 with appropriate CORS headers.

## Usage Examples

### Example 1: Basic Test Generation (TypeScript + Jest)

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-unit-tests \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Generate tests for user authentication",
    "project_id": "proj_123",
    "language": "typescript",
    "framework": "jest",
    "functionName": "authenticateUser"
  }'
```

### Example 2: Test Generation with Code Context (Python + pytest)

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-unit-tests \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Generate comprehensive tests",
    "project_id": "proj_456",
    "language": "python",
    "framework": "pytest",
    "functionName": "calculate_discount",
    "code": "def calculate_discount(price: float, percent: float) -> float:\n    if percent < 0 or percent > 100:\n        raise ValueError(\"Invalid discount\")\n    return price * (1 - percent / 100)",
    "scenarios": "- Valid percentages (0-100)\n- Boundary values (0%, 100%)\n- Invalid percentages (negative, >100)\n- Edge cases (zero price, large numbers)"
  }'
```

### Example 3: Test Generation with Custom Prompts (Java + JUnit5)

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-unit-tests \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Generate integration tests",
    "project_id": "proj_789",
    "language": "java",
    "framework": "junit5",
    "functionName": "UserService",
    "system_prompt": "Generate JUnit 5 integration tests with Spring Boot Test annotations. Include database transaction tests.",
    "user_prompt": "Create comprehensive integration tests for {{functionName}} with Spring context:\n{{content}}"
  }'
```

### Example 4: Iterative Test Refinement

```bash
# First request - generate initial tests
curl -X POST https://your-project.supabase.co/functions/v1/create-unit-tests \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Generate tests for payment processing",
    "project_id": "proj_abc",
    "language": "typescript",
    "framework": "jest"
  }'

# Response includes response_id: "resp_xyz123"

# Second request - refine tests
curl -X POST https://your-project.supabase.co/functions/v1/create-unit-tests \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Add tests for concurrent payment processing and race conditions",
    "project_id": "proj_abc",
    "language": "typescript",
    "framework": "jest",
    "previous_response_id": "resp_xyz123"
  }'
```

### Example 5: Async/Promise Testing

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-unit-tests \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Generate tests for async API calls",
    "project_id": "proj_def",
    "language": "javascript",
    "framework": "jest",
    "functionName": "fetchUserData",
    "code": "async function fetchUserData(userId) {\n  const response = await fetch(`/api/users/${userId}`);\n  return response.json();\n}",
    "scenarios": "- Successful API response\n- Network errors\n- Invalid user ID\n- Timeout handling\n- JSON parse errors"
  }'
```

## Error Handling

The function implements comprehensive error handling:

1. **Method Validation**: Only POST requests accepted
2. **Body Validation**: Required fields checked before processing
3. **Language/Framework Validation**: Checks compatibility matrix
4. **OpenAI Error Propagation**: Original error status codes preserved
5. **Structured Error Responses**: Consistent JSON error format
6. **AI Interaction Tracking**: Failed requests logged for debugging

## Implementation Notes

- Uses OpenAI Responses API for conversation continuity
- Supports iterative test refinement via `previous_response_id`
- Language-specific system prompts optimize for framework conventions
- Metadata includes `project_id`, `language`, `framework`, `operation` for tracking
- All responses include CORS headers for web client compatibility
- Built on Deno runtime with TypeScript
- Automatic document storage in `generated_documents` table
- AI interaction tracking in `ai_interactions` table

## Language-Specific Features

### JavaScript/TypeScript
- ES6+ syntax and modern JavaScript features
- Async/await patterns for asynchronous code
- Jest/Vitest matchers and utilities
- Mock functions and spies
- Type-safe mocks (TypeScript only)

### Python
- pytest fixtures and parametrization
- unittest TestCase classes
- Context managers and decorators
- Monkeypatching for dependency injection
- PEP 8 naming conventions

### Java
- JUnit 5 annotations and lifecycle methods
- Mockito for mocking and verification
- AssertJ for fluent assertions
- DisplayName for readable test output
- Nested test classes for organization

## Best Practices

### For Optimal Test Generation:

1. **Specify Language and Framework**: Explicitly set both for best results
2. **Provide Code Context**: Include the actual implementation in `code` parameter
3. **Define Test Scenarios**: List specific edge cases and error conditions
4. **Use Descriptive Function Names**: Clear names help generate better tests
5. **Iterate with Context**: Use `previous_response_id` for refinement
6. **Match Project Setup**: Ensure framework matches your project configuration

### Quality Indicators:

- ✅ Tests follow AAA pattern
- ✅ Proper mocking of external dependencies
- ✅ Edge cases and error scenarios covered
- ✅ Descriptive test names
- ✅ Setup/teardown for test isolation
- ✅ Framework-specific best practices followed

## Related Documentation

- [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Jest Documentation](https://jestjs.io/)
- [pytest Documentation](https://docs.pytest.org/)
- [JUnit 5 User Guide](https://junit.org/junit5/docs/current/user-guide/)
- [Mockito Documentation](https://javadoc.io/doc/org.mockito/mockito-core/latest/org/mockito/Mockito.html)

## Comparison with Other Document Generation Functions

| Feature | create-prd | create-user-story | create-unit-tests |
|---------|------------|-------------------|-------------------|
| **Output** | PRD document | User stories | Unit test code |
| **Focus** | Requirements | User value | Code testing |
| **Languages** | Natural language | Natural language | Multi-language code |
| **Frameworks** | N/A | N/A | Language-specific |
| **Temperature** | 0.6 | 0.6 | 0.2 (deterministic) |
| **Tokens** | 8000 | 8000 | 4000 |
| **Store** | false | false | true (for iteration) |
