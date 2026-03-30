/**
 * Prompt construction logic for unit test generation
 *
 * Provides language and framework-specific prompt building with:
 * - System prompt construction with best practices
 * - User prompt formatting with test scenarios
 * - Framework-specific guidelines
 * - Code formatting and escaping
 */

import {
  TestScenario,
  UnitTestFormData,
  SUPPORTED_LANGUAGES,
} from '../_shared/document-generation/types.ts';

import {
  LANGUAGE_FRAMEWORK_COMPATIBILITY,
  FRAMEWORK_PATTERNS,
  FrameworkConfig,
  isFrameworkCompatible,
} from './types.ts';

/**
 * Prompt pair for OpenAI API
 */
export interface PromptPair {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Validate language-framework compatibility
 */
export function validateUnitTestFormData(data: UnitTestFormData): {
  valid: boolean;
  error?: string;
} {
  if (!isFrameworkCompatible(data.language, data.framework)) {
    const validFrameworks = LANGUAGE_FRAMEWORK_COMPATIBILITY[data.language.toLowerCase()] || [];
    return {
      valid: false,
      error: `Framework '${data.framework}' is not compatible with language '${data.language}'. Valid frameworks: ${validFrameworks.join(', ')}`,
    };
  }

  if (!data.functionName || data.functionName.trim() === '') {
    return {
      valid: false,
      error: 'Function name is required',
    };
  }

  if (!data.testScenarios || data.testScenarios.length === 0) {
    return {
      valid: false,
      error: 'At least one test scenario is required',
    };
  }

  return { valid: true };
}

/**
 * Format function code with proper escaping
 */
export function formatFunctionCode(code: string, language: string): string {
  // Remove excessive whitespace while preserving code structure
  const trimmedCode = code.trim();

  // Escape backticks for markdown
  const escapedCode = trimmedCode.replace(/`/g, '\\`');

  // Return formatted code block
  return `\`\`\`${language}\n${escapedCode}\n\`\`\``;
}

/**
 * Format a test scenario for prompt
 */
export function formatTestScenario(scenario: TestScenario, index: number): string {
  let formatted = `${index + 1}. **${scenario.description}**\n`;

  if (scenario.input) {
    formatted += `   - Input: ${scenario.input}\n`;
  }

  if (scenario.expectedOutput) {
    formatted += `   - Expected Output: ${scenario.expectedOutput}\n`;
  }

  if (scenario.shouldThrow) {
    formatted += `   - Should Throw: Yes\n`;
    if (scenario.errorMessage) {
      formatted += `   - Error Message: ${scenario.errorMessage}\n`;
    }
  }

  return formatted;
}

/**
 * Get framework-specific guidelines
 */
export function getFrameworkSpecificGuidelines(framework: string): string {
  const config = FRAMEWORK_PATTERNS[framework.toLowerCase()];

  if (!config) {
    return `Use ${framework} framework conventions and best practices.`;
  }

  return `
**${framework} Specific Guidelines:**
- **File Naming**: ${config.fileNaming}
- **Imports**: ${config.imports.join(', ')}
- **Assertions**: Use ${config.assertions.join(', ')}
- **Mocking**: Use ${config.mocking.join(', ')}
- **Setup**: ${config.setup}
- **Teardown**: ${config.teardown}
`;
}

/**
 * Build language-specific system prompt
 */
export function buildSystemPrompt(language: string, framework: string): string {
  const languageUpper = language.charAt(0).toUpperCase() + language.slice(1);
  const frameworkUpper = framework.charAt(0).toUpperCase() + framework.slice(1);

  return `You are an expert ${languageUpper} developer specializing in writing production-ready unit tests using ${frameworkUpper}.

**Your Task:**
Generate comprehensive, production-ready unit tests following these principles:

**1. Test Structure (AAA Pattern):**
- **Arrange**: Set up test data and dependencies
- **Act**: Execute the function/method being tested
- **Assert**: Verify the results match expectations

**2. Best Practices:**
- Write clear, descriptive test names that explain what is being tested
- Test one behavior per test case
- Use proper assertions for the expected behavior
- Include setup and teardown when needed
- Mock external dependencies appropriately
- Test edge cases and error conditions
- Ensure tests are isolated and independent

**3. Code Quality:**
- Follow ${languageUpper} naming conventions
- Use ${frameworkUpper} best practices and patterns
- Write clean, readable test code
- Add comments for complex test logic
- Ensure proper error handling

**4. Coverage:**
- Happy path scenarios
- Edge cases and boundary conditions
- Error handling and exceptions
- Invalid input handling
- Null/undefined checks (where applicable)

**5. Framework-Specific:**
${getFrameworkSpecificGuidelines(framework)}

**6. Output Format:**
- Provide complete, runnable test code
- Include all necessary imports
- Use proper file structure
- Add descriptive comments
- Format code according to ${languageUpper} standards

**7. Language Considerations:**
${getLanguageSpecificConsiderations(language)}

**What NOT to do:**
- Don't write incomplete tests
- Don't skip error cases
- Don't use hard-coded values without explanation
- Don't test implementation details
- Don't create test dependencies
- Don't ignore setup/teardown needs

Generate tests that are production-ready, maintainable, and follow industry best practices.`;
}

/**
 * Get language-specific considerations
 */
function getLanguageSpecificConsiderations(language: string): string {
  const considerations: Record<string, string> = {
    javascript: `
- Use async/await for asynchronous tests
- Test Promise resolution and rejection
- Handle event loop properly
- Use proper equality checks (=== vs ==)
`,
    typescript: `
- Leverage TypeScript types for type safety
- Test type assertions and guards
- Use proper interface mocking
- Ensure type compatibility in tests
`,
    python: `
- Follow PEP 8 naming conventions (test_*)
- Use pytest fixtures for setup
- Parametrize tests for multiple inputs
- Use context managers for resource cleanup
`,
    java: `
- Follow Java naming conventions (camelCase)
- Use @Test annotations properly
- Implement proper exception testing
- Use Mockito for mocking when needed
`,
    go: `
- Use table-driven tests
- Follow Go naming conventions (Test*)
- Use subtests for related test cases
- Mock interfaces, not implementations
`,
    ruby: `
- Use RSpec's 'describe' and 'it' blocks
- Leverage 'let' for test data
- Use shared examples for common behaviors
- Follow Ruby naming conventions
`,
    php: `
- Use PHPUnit conventions (@test or test*)
- Implement data providers for parametrization
- Use proper assertion methods
- Follow PSR coding standards
`,
    rust: `
- Use #[test] attribute
- Test ownership and borrowing
- Use #[should_panic] for error cases
- Follow Rust naming conventions
`,
    swift: `
- Use XCTest framework
- Test async/await properly
- Use XCTAssert* assertions
- Follow Swift naming conventions
`,
    kotlin: `
- Use JUnit 5 with Kotlin
- Test coroutines properly
- Use inline functions when appropriate
- Follow Kotlin naming conventions
`,
    cpp: `
- Use TEST() and TEST_F() macros
- Test RAII and resource management
- Use EXPECT_* for non-fatal assertions
- Follow C++ naming conventions
`,
    c: `
- Use simple assert-based testing
- Test memory management
- Use proper setup/teardown
- Follow C naming conventions
`,
    csharp: `
- Use async Task for async tests
- Test LINQ expressions
- Use proper assertion methods
- Follow C# naming conventions
`,
  };

  return considerations[language.toLowerCase()] || 'Follow language conventions and best practices.';
}

/**
 * Build user prompt with test scenarios
 */
export function buildUserPrompt(data: UnitTestFormData): string {
  let prompt = `Generate unit tests for the following ${data.language} function using the ${data.framework} framework.\n\n`;

  // Add function name
  prompt += `**Function/Class Name:** ${data.functionName}\n\n`;

  // Add function code if provided
  if (data.functionCode && data.functionCode.trim() !== '') {
    prompt += `**Code to Test:**\n${formatFunctionCode(data.functionCode, data.language)}\n\n`;
  }

  // Add test scenarios
  prompt += `**Test Scenarios:**\n`;
  data.testScenarios.forEach((scenario, index) => {
    prompt += formatTestScenario(scenario, index) + '\n';
  });

  // Add additional context if provided
  if (data.additionalContext && data.additionalContext.trim() !== '') {
    prompt += `\n**Additional Context:**\n${data.additionalContext}\n\n`;
  }

  // Add framework-specific requirements
  const frameworkGuidelines = getFrameworkSpecificGuidelines(data.framework);
  prompt += `\n${frameworkGuidelines}\n`;

  prompt += `\n**Requirements:**
- Generate complete, production-ready test code
- Follow the AAA (Arrange-Act-Assert) pattern
- Include all necessary imports and setup
- Ensure tests are isolated and independent
- Add descriptive test names and comments
- Cover all specified scenarios
- Include proper error handling tests
- Use ${data.framework}-specific best practices

Please provide the complete test file with all tests implemented.`;

  return prompt;
}

/**
 * Build complete prompts for OpenAI API
 */
export function buildUnitTestPrompts(data: UnitTestFormData): PromptPair {
  // Validate input
  const validation = validateUnitTestFormData(data);
  if (!validation.valid) {
    throw new Error(`Invalid unit test data: ${validation.error}`);
  }

  const systemPrompt = buildSystemPrompt(data.language, data.framework);
  const userPrompt = buildUserPrompt(data);

  return {
    systemPrompt,
    userPrompt,
  };
}
