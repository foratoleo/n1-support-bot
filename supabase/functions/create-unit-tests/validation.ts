/**
 * Validation module for unit test generation requests
 *
 * Provides comprehensive validation for:
 * - HTTP method validation
 * - Language and framework compatibility
 * - Test scenario structure
 * - Request body completeness
 */

import {
  SUPPORTED_LANGUAGES,
  FRAMEWORK_OPTIONS,
  TestScenario,
  UnitTestFormData,
  SupportedLanguage,
} from '../_shared/document-generation/types.ts';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: string[];
}

/**
 * Validate that the HTTP method is POST
 */
export function validateMethod(method: string): ValidationResult {
  if (method !== 'POST') {
    return {
      valid: false,
      error: `Method ${method} not allowed. Use POST.`,
    };
  }
  return { valid: true };
}

/**
 * Validate basic request fields
 */
export function validateBasicFields(body: any): ValidationResult {
  if (!body.content) {
    return {
      valid: false,
      error: 'Missing required field: content',
    };
  }

  if (!body.project_id) {
    return {
      valid: false,
      error: 'Missing required field: project_id',
    };
  }

  return { valid: true };
}

/**
 * Check if a language is supported
 */
export function isValidLanguage(language: string): boolean {
  return Object.values(SUPPORTED_LANGUAGES).includes(language as any);
}

/**
 * Check if a framework is compatible with the selected language
 */
export function isValidFramework(language: string, framework: string): boolean {
  const frameworks = FRAMEWORK_OPTIONS[language as SupportedLanguage];
  if (!frameworks) return false;

  return frameworks.some(fw =>
    fw.toLowerCase() === framework.toLowerCase()
  );
}

/**
 * Validate a single test scenario
 */
export function validateTestScenario(scenario: TestScenario, index: number): ValidationResult {
  const details: string[] = [];

  if (!scenario.description || scenario.description.trim() === '') {
    return {
      valid: false,
      error: `Test scenario ${index + 1}: description is required`,
    };
  }

  // Warning for shouldThrow without errorMessage
  if (scenario.shouldThrow && !scenario.errorMessage) {
    details.push(
      `Test scenario ${index + 1}: When shouldThrow is true, it's recommended to provide errorMessage`
    );
  }

  return {
    valid: true,
    details: details.length > 0 ? details : undefined,
  };
}

/**
 * Validate unit test request content
 */
export function validateUnitTestRequest(content: string): ValidationResult {
  let formData: UnitTestFormData;

  // Parse JSON content
  try {
    formData = JSON.parse(content);
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid JSON in content field',
      details: [(error as Error).message],
    };
  }

  const details: string[] = [];

  // Validate language
  if (!formData.language) {
    return {
      valid: false,
      error: 'Missing required field: language',
    };
  }

  if (!isValidLanguage(formData.language)) {
    return {
      valid: false,
      error: `Unsupported language: ${formData.language}`,
      details: [`Supported languages: ${Object.values(SUPPORTED_LANGUAGES).join(', ')}`],
    };
  }

  // Validate framework
  if (!formData.framework) {
    return {
      valid: false,
      error: 'Missing required field: framework',
    };
  }

  if (!isValidFramework(formData.language, formData.framework)) {
    const validFrameworks = FRAMEWORK_OPTIONS[formData.language as SupportedLanguage]
      ?.join(', ') || 'none';

    return {
      valid: false,
      error: `Framework '${formData.framework}' is not compatible with language '${formData.language}'`,
      details: [`Valid frameworks for ${formData.language}: ${validFrameworks}`],
    };
  }

  // Validate functionName
  if (!formData.functionName || formData.functionName.trim() === '') {
    return {
      valid: false,
      error: 'Missing required field: functionName',
    };
  }

  // Validate testScenarios
  if (!formData.testScenarios || !Array.isArray(formData.testScenarios)) {
    return {
      valid: false,
      error: 'Missing or invalid field: testScenarios (must be an array)',
    };
  }

  if (formData.testScenarios.length === 0) {
    return {
      valid: false,
      error: 'At least one test scenario is required',
    };
  }

  // Validate each test scenario
  for (let i = 0; i < formData.testScenarios.length; i++) {
    const scenarioValidation = validateTestScenario(formData.testScenarios[i], i);
    if (!scenarioValidation.valid) {
      return scenarioValidation;
    }
    if (scenarioValidation.details) {
      details.push(...scenarioValidation.details);
    }
  }

  // Warning for missing functionCode
  if (!formData.functionCode || formData.functionCode.trim() === '') {
    details.push(
      'Warning: functionCode is not provided. Tests will be generated based on scenarios only.'
    );
  }

  return {
    valid: true,
    details: details.length > 0 ? details : undefined,
  };
}

/**
 * Main validation function for complete request
 */
export function validateRequest(method: string, body: any): ValidationResult {
  // Validate method
  const methodValidation = validateMethod(method);
  if (!methodValidation.valid) {
    return methodValidation;
  }

  // Validate basic fields
  const basicValidation = validateBasicFields(body);
  if (!basicValidation.valid) {
    return basicValidation;
  }

  // Validate unit test specific content
  return validateUnitTestRequest(body.content);
}
