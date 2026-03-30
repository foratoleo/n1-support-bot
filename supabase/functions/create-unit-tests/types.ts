/**
 * Extended type definitions for unit test generation
 *
 * Provides comprehensive types for language-specific test generation
 * with framework compatibility and test scenario structures
 */

// Re-export types from shared types
export type {
  UnitTestRequestBody,
  TestScenario,
  UnitTestFormData,
  SupportedLanguage,
} from '../_shared/document-generation/types.ts';

export {
  SUPPORTED_LANGUAGES,
  FRAMEWORK_OPTIONS,
} from '../_shared/document-generation/types.ts';

/**
 * Test requirements configuration
 */
export interface TestRequirements {
  isolation?: boolean;
  coverage?: 'basic' | 'comprehensive' | 'exhaustive';
  mocking?: 'none' | 'minimal' | 'extensive';
}

/**
 * Framework-specific configuration
 */
export interface FrameworkConfig {
  assertions: string[];
  mocking: string[];
  setup: string;
  teardown: string;
  fileNaming: string;
  imports: string[];
}

/**
 * Test generation result metadata
 */
export interface TestGenerationResult {
  language: string;
  framework: string;
  functionName: string;
  scenarioCount: number;
  testCode: string;
}

/**
 * Language-framework compatibility matrix
 * Maps languages to their compatible testing frameworks
 */
export const LANGUAGE_FRAMEWORK_COMPATIBILITY: Record<string, string[]> = {
  javascript: ['jest', 'mocha', 'vitest', 'jasmine', 'qunit', 'tape', 'ava'],
  typescript: ['jest', 'vitest', 'mocha', 'jasmine'],
  python: ['pytest', 'unittest', 'nose2', 'doctest'],
  java: ['junit', 'junit5', 'testng', 'mockito'],
  go: ['testing', 'testify', 'goconvey'],
  ruby: ['rspec', 'minitest', 'test-unit'],
  php: ['phpunit', 'codeception', 'pest'],
  rust: ['cargo-test', 'rusttest'],
  swift: ['xctest', 'quick'],
  kotlin: ['junit5', 'kotlintest', 'spek'],
  cpp: ['gtest', 'catch2', 'boost-test'],
  c: ['unity', 'cmocka', 'check'],
  csharp: ['nunit', 'xunit', 'mstest'],
};

/**
 * Framework-specific patterns and configurations
 */
export const FRAMEWORK_PATTERNS: Record<string, FrameworkConfig> = {
  jest: {
    assertions: ['expect()', 'toBe()', 'toEqual()', 'toThrow()'],
    mocking: ['jest.fn()', 'jest.mock()', 'jest.spyOn()'],
    setup: 'beforeEach()',
    teardown: 'afterEach()',
    fileNaming: '*.test.js or *.spec.js',
    imports: ['import { describe, test, expect } from "@jest/globals";'],
  },
  pytest: {
    assertions: ['assert', 'pytest.raises()'],
    mocking: ['monkeypatch', 'mocker', 'unittest.mock'],
    setup: '@pytest.fixture',
    teardown: 'yield in fixture',
    fileNaming: 'test_*.py or *_test.py',
    imports: ['import pytest'],
  },
  junit5: {
    assertions: ['assertEquals()', 'assertTrue()', 'assertThrows()'],
    mocking: ['Mockito.mock()', '@Mock', '@InjectMocks'],
    setup: '@BeforeEach',
    teardown: '@AfterEach',
    fileNaming: '*Test.java',
    imports: ['import org.junit.jupiter.api.*;'],
  },
  vitest: {
    assertions: ['expect()', 'toBe()', 'toEqual()', 'toThrow()'],
    mocking: ['vi.fn()', 'vi.mock()', 'vi.spyOn()'],
    setup: 'beforeEach()',
    teardown: 'afterEach()',
    fileNaming: '*.test.ts or *.spec.ts',
    imports: ['import { describe, test, expect } from "vitest";'],
  },
  mocha: {
    assertions: ['chai.expect()', 'assert()'],
    mocking: ['sinon.stub()', 'sinon.spy()', 'sinon.mock()'],
    setup: 'beforeEach()',
    teardown: 'afterEach()',
    fileNaming: '*.test.js or *.spec.js',
    imports: ['import { expect } from "chai";', 'import sinon from "sinon";'],
  },
  rspec: {
    assertions: ['expect()', 'to eq()', 'to raise_error()'],
    mocking: ['allow()', 'receive()', 'double()'],
    setup: 'before(:each)',
    teardown: 'after(:each)',
    fileNaming: '*_spec.rb',
    imports: ['require "rspec"'],
  },
  gtest: {
    assertions: ['EXPECT_EQ()', 'ASSERT_TRUE()', 'EXPECT_THROW()'],
    mocking: ['MOCK_METHOD()', 'NiceMock<>', 'StrictMock<>'],
    setup: 'SetUp()',
    teardown: 'TearDown()',
    fileNaming: '*_test.cpp',
    imports: ['#include <gtest/gtest.h>'],
  },
};

/**
 * Check if a framework is compatible with a language
 */
export function isFrameworkCompatible(language: string, framework: string): boolean {
  const compatibleFrameworks = LANGUAGE_FRAMEWORK_COMPATIBILITY[language.toLowerCase()];
  if (!compatibleFrameworks) return false;
  return compatibleFrameworks.includes(framework.toLowerCase());
}

/**
 * Get framework configuration
 */
export function getFrameworkConfig(framework: string): FrameworkConfig | undefined {
  return FRAMEWORK_PATTERNS[framework.toLowerCase()];
}

/**
 * Parse unit test form data from JSON content
 */
export function parseUnitTestContent(content: string): {
  language: string;
  framework: string;
  functionName: string;
  functionCode?: string;
  testScenarios: TestScenario[];
  additionalContext?: string;
} {
  const data = JSON.parse(content);
  return {
    language: data.language || 'typescript',
    framework: data.framework || 'jest',
    functionName: data.functionName || '',
    functionCode: data.functionCode,
    testScenarios: data.testScenarios || [],
    additionalContext: data.additionalContext,
  };
}
