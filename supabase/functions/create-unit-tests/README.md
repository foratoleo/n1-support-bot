# Create Unit Tests Edge Function

This Supabase Edge Function generates production-ready unit tests using OpenAI's API with intelligent configuration management through the platform_settings system.

## Table of Contents

- [Overview](#overview)
- [Supported Languages and Frameworks](#supported-languages-and-frameworks)
- [Environment Variables](#environment-variables)
- [Platform Settings Integration](#platform-settings-integration)
- [API Usage](#api-usage)
- [Test Generation Features](#test-generation-features)
- [Troubleshooting](#troubleshooting)
- [Development](#development)

## Overview

The `create-unit-tests` function:
- Generates comprehensive unit tests from code using OpenAI
- Supports multiple programming languages (JavaScript, TypeScript, Python, Java)
- Adapts to different testing frameworks (Jest, pytest, JUnit, etc.)
- Loads AI configurations from the `platform_settings` database table
- Supports configuration overrides via request body
- Maintains conversation context with OpenAI Responses API
- Follows framework-specific best practices and conventions
- Implements Arrange-Act-Assert pattern for all test cases

## Supported Languages and Frameworks

### JavaScript
- **Frameworks**: Jest, Vitest, Mocha
- **Features**: ES6+ syntax, async/await, promises, mock functions
- **Best Practices**: AAA pattern, describe/it blocks, proper mocking

### TypeScript
- **Frameworks**: Jest, Vitest, Mocha with Chai
- **Features**: Type-safe mocks, generic test utilities, interface testing
- **Best Practices**: Type safety, AAA pattern, proper typing for mocks

### Python
- **Frameworks**: pytest, unittest
- **Features**: Fixtures, parametrization, monkeypatching, context managers
- **Best Practices**: PEP 8 naming, fixtures, proper assertions

### Java
- **Frameworks**: JUnit 5, JUnit 4, TestNG
- **Features**: Annotations, Mockito integration, assertions
- **Best Practices**: @Test annotations, Mockito when/verify, proper naming

## Environment Variables

### Required Variables

These environment variables must be configured in your Supabase project:

#### `OPENAI_API_KEY` (Required)
- **Purpose**: Authentication for OpenAI API requests
- **How to obtain**:
  1. Visit https://platform.openai.com/api-keys
  2. Create a new secret key
  3. Copy the key (it won't be shown again)
- **Security**: Never commit this to version control or expose in client-side code

#### `SUPABASE_URL` (Required)
- **Purpose**: Your Supabase project's base URL
- **How to obtain**:
  1. Go to Supabase Dashboard
  2. Navigate to Project Settings > API
  3. Copy the "Project URL" value
- **Example**: `https://abcdefghijklmnop.supabase.co`

#### `SUPABASE_SERVICE_ROLE_KEY` (Required)
- **Purpose**: Server-side authentication with elevated privileges to access platform_settings
- **How to obtain**:
  1. Go to Supabase Dashboard
  2. Navigate to Project Settings > API
  3. Copy the "service_role" key (under "Project API keys")
- **Security**:
  - This key bypasses Row Level Security (RLS) policies
  - Never expose in client-side code
  - Only use in secure server environments

### Setting Environment Variables

**Via Supabase Dashboard:**
1. Go to Project Settings > Edge Functions
2. Add each variable in the "Environment Variables" section
3. Click "Save"

**Via Supabase CLI:**
```bash
supabase secrets set OPENAI_API_KEY=sk-proj-your-key-here
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**For Local Development:**
Create a `.env` file in the `supabase/functions/` directory:
```bash
cp supabase/functions/.env.example supabase/functions/.env
# Edit .env with your actual values
```

## Platform Settings Integration

### Configuration Precedence

The function uses a three-tier configuration system with the following precedence (highest to lowest):

1. **Request Body Parameters** - Explicit values in the API request
2. **Database Configuration** - Settings stored in `platform_settings` table
3. **Default Values** - Hardcoded fallback values in `config.ts`

### Database Configuration

AI configurations are stored in the `platform_settings` table with the key `ai-create-unit-tests`.

**Configuration Structure:**
```json
{
  "model": "gpt-4o",
  "temperature": 0.2,
  "token_limit": 4000,
  "system_prompt": "You are a specialized unit test generator...",
  "user_prompt": "Generate unit tests for:\n{{content}}"
}
```

**Key Fields:**
- `model`: OpenAI model to use (e.g., "gpt-4o", "gpt-4o-mini")
- `temperature`: Randomness/creativity (0.0 to 2.0, lower = more deterministic)
- `token_limit`: Maximum response length
- `system_prompt`: Instructions for the AI's role and behavior
- `user_prompt`: Template for the user's request (supports Handlebars placeholders)

### Prompt Template Placeholders

The `user_prompt` supports multiple Handlebars-style placeholders for dynamic content injection:

- `{{content}}` - Main content/instructions
- `{{functionName}}` - Name of the function/class being tested
- `{{language}}` - Programming language
- `{{framework}}` - Testing framework
- `{{code}}` - Code to generate tests for
- `{{scenarios}}` - Specific test scenarios to cover

**Example:**
```json
{
  "user_prompt": "Generate unit tests for {{functionName}} in {{language}} using {{framework}}.\n\nCode:\n{{code}}\n\nScenarios:\n{{scenarios}}"
}
```

## API Usage

### Basic Request (Auto-detect Language)

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/create-unit-tests' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "Generate tests for user authentication function",
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "language": "typescript",
    "framework": "jest",
    "functionName": "authenticateUser"
  }'
```

### Request with Code Snippet

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/create-unit-tests' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "Generate comprehensive unit tests",
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "language": "python",
    "framework": "pytest",
    "functionName": "calculate_discount",
    "code": "def calculate_discount(price, discount_percent):\n    return price * (1 - discount_percent / 100)",
    "scenarios": "- Valid discount percentages\n- Edge cases (0%, 100%)\n- Invalid inputs\n- Negative numbers"
  }'
```

### Request with Configuration Override

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/create-unit-tests' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "Generate unit tests",
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "language": "java",
    "framework": "junit5",
    "model": "gpt-4o",
    "temperature": 0.1,
    "system_prompt": "You are an expert Java test engineer. Generate JUnit 5 tests with Mockito.",
    "user_prompt": "Create tests for:\n{{content}}"
  }'
```

### Request with Conversation Continuation

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/create-unit-tests' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "Add integration tests for database operations",
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "language": "typescript",
    "framework": "jest",
    "previous_response_id": "resp_abc123xyz"
  }'
```

### Response Format

**Success Response (200 OK):**
```json
{
  "success": true,
  "document": "import { describe, it, expect, beforeEach } from 'vitest';\n\ndescribe('authenticateUser', () => {\n  // Test cases here\n});",
  "response_id": "resp_abc123xyz"
}
```

**Error Response (4xx/5xx):**
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error context"
}
```

## Test Generation Features

### Arrange-Act-Assert Pattern

All generated tests follow the AAA pattern:

```typescript
it('should authenticate valid user credentials', () => {
  // Arrange
  const mockUser = { username: 'test', password: 'password123' };
  const mockAuthService = jest.fn().mockResolvedValue(true);

  // Act
  const result = authenticateUser(mockUser, mockAuthService);

  // Assert
  expect(result).toBe(true);
  expect(mockAuthService).toHaveBeenCalledWith(mockUser);
});
```

### Comprehensive Test Coverage

Generated tests include:

1. **Happy Path Scenarios** - Expected successful behavior
2. **Edge Cases** - Boundary conditions, empty inputs, null values
3. **Error Scenarios** - Exception handling, invalid inputs
4. **Async Patterns** - Proper async/await, promise handling
5. **Mock Configurations** - External dependency mocking
6. **Test Isolation** - Setup/teardown for clean state

### Framework-Specific Features

**Jest/Vitest (JavaScript/TypeScript):**
```typescript
describe('User Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create user with valid data', async () => {
    // Test implementation
  });
});
```

**pytest (Python):**
```python
@pytest.fixture
def user_service():
    return UserService()

def test_create_user_with_valid_data(user_service):
    # Test implementation
    pass
```

**JUnit 5 (Java):**
```java
@DisplayName("User Service Tests")
class UserServiceTest {
    @Mock
    private UserRepository repository;

    @InjectMocks
    private UserService service;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    @DisplayName("Should create user with valid data")
    void testCreateUserWithValidData() {
        // Test implementation
    }
}
```

## Troubleshooting

### Common Issues

#### 1. Unsupported Language/Framework

**Error:**
```
Language 'xyz' or framework 'abc' not supported
```

**Solution:**
Check the supported languages and frameworks:
- JavaScript: jest, vitest, mocha
- TypeScript: jest, vitest, mocha
- Python: pytest, unittest
- Java: junit5, junit4, testng

#### 2. Missing Code Context

**Symptoms:**
- Generic tests without specific implementation details
- Tests don't match actual code structure

**Solution:**
Provide the `code` parameter with the actual function/class implementation:
```json
{
  "code": "function calculateTotal(items) { /* implementation */ }",
  "functionName": "calculateTotal"
}
```

#### 3. Incomplete Test Coverage

**Symptoms:**
- Missing edge cases
- No error scenario tests

**Solution:**
Specify detailed scenarios in the `scenarios` parameter:
```json
{
  "scenarios": "- Empty array input\n- Null values\n- Invalid data types\n- Large datasets\n- Concurrent access"
}
```

#### 4. Framework-Specific Syntax Issues

**Solution:**
Override the system prompt with framework-specific instructions:
```json
{
  "system_prompt": "Generate Jest tests using ES6+ syntax with async/await for all asynchronous operations..."
}
```

## Development

### Local Testing

1. **Install Supabase CLI:**
```bash
npm install -g supabase
```

2. **Start local Supabase:**
```bash
supabase start
```

3. **Set up environment:**
```bash
cd supabase/functions
cp .env.example .env
# Edit .env with your keys
```

4. **Serve function locally:**
```bash
supabase functions serve create-unit-tests --env-file .env
```

5. **Test the function:**
```bash
curl -X POST 'http://localhost:54321/functions/v1/create-unit-tests' \
  -H 'Authorization: Bearer YOUR_LOCAL_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "Generate tests for user registration",
    "project_id": "test-id",
    "language": "typescript",
    "framework": "jest"
  }'
```

### Deployment

```bash
# Deploy function
supabase functions deploy create-unit-tests

# Set environment variables (if not already set)
supabase secrets set OPENAI_API_KEY=sk-your-key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Monitoring

**View logs:**
```bash
# Real-time logs
supabase functions logs create-unit-tests --follow

# Recent logs
supabase functions logs create-unit-tests
```

**Check function status:**
```bash
supabase functions list
```

## Best Practices

### For Best Test Generation Results:

1. **Provide Clear Function Names**: Use descriptive names that indicate functionality
2. **Include Code Context**: Provide the actual code implementation when possible
3. **Specify Test Scenarios**: List specific edge cases and error conditions
4. **Choose Appropriate Framework**: Match the framework to your project setup
5. **Use Consistent Language**: Specify the correct programming language
6. **Iterate with Context**: Use `previous_response_id` to refine tests

### Example High-Quality Request:

```json
{
  "content": "Generate comprehensive unit tests",
  "project_id": "proj-123",
  "language": "typescript",
  "framework": "jest",
  "functionName": "processPayment",
  "code": "async function processPayment(amount: number, paymentMethod: string): Promise<PaymentResult> { /* implementation */ }",
  "scenarios": "- Successful payment processing\n- Insufficient funds\n- Invalid payment method\n- Network timeout\n- Duplicate transactions\n- Negative amounts\n- Zero amount edge case"
}
```

## Related Documentation

- [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Platform Settings Schema](../../../docs/schema.md)
- [Jest Documentation](https://jestjs.io/)
- [pytest Documentation](https://docs.pytest.org/)
- [JUnit 5 Documentation](https://junit.org/junit5/)

## Support

For issues or questions:
1. Check this troubleshooting guide
2. Review function logs: `supabase functions logs create-unit-tests`
3. Verify environment variables are set correctly
4. Test with configuration overrides to isolate issues
