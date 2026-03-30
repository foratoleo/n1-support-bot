import { OpenAIConfig } from '../_shared/document-generation/types.ts';

/**
 * Configuration key for platform settings lookup
 * Used to retrieve AI configuration from platform_settings table
 */
export const CONFIG_KEY = 'ai-chat-style-guide';

/**
 * Operation identifier for logging and tracking
 */
export const OPERATION = 'chat-style-guide';

/**
 * Supported chat actions for style guide interactions
 */
export type ChatAction = 'query' | 'suggest' | 'generate' | 'modify';

/**
 * Valid chat actions list for validation
 */
export const VALID_ACTIONS: ChatAction[] = ['query', 'suggest', 'generate', 'modify'];

// =============================================================================
// CONFIGURABLE OPTIONS
// =============================================================================

/**
 * Supported guide output languages
 */
export type GuideLanguage = 'pt-BR' | 'en-US';

/**
 * Valid guide languages list
 */
export const VALID_GUIDE_LANGUAGES: GuideLanguage[] = ['pt-BR', 'en-US'];

/**
 * Detail level options (1-5 scale)
 */
export type DetailLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Default values for configurable options
 */
export const DEFAULT_GUIDE_LANGUAGE: GuideLanguage = 'pt-BR';
export const DEFAULT_DETAIL_LEVEL: DetailLevel = 5;
export const DEFAULT_INCLUDE_EXAMPLES = true;

/**
 * Language-specific instruction templates
 */
export const LANGUAGE_INSTRUCTIONS: Record<GuideLanguage, string> = {
  'pt-BR': 'All output must be in **Brazilian Portuguese** unless explicitly told otherwise.',
  'en-US': 'All output must be in **English (US)** unless explicitly told otherwise.',
};

/**
 * Detail level instruction templates
 * Maps detail level (1-5) to corresponding instruction text
 */
export const DETAIL_LEVEL_INSTRUCTIONS: Record<DetailLevel, string> = {
  1: 'Provide **minimal** responses: brief answers with only essential information. No code examples unless explicitly requested. Keep responses under 500 words. Focus on direct answers to the specific question asked. For generation actions, produce a concise guide with 1-2 rules per section and short examples (3-5 lines).',
  2: 'Provide **basic** responses: concise answers with key points and brief explanations. Include short code examples (3-8 lines) only for the most critical rules. Target 500-1,500 words for generated content. Include 2-3 rules per section with rationale but minimal edge case discussion.',
  3: 'Provide **moderate** responses: balanced detail with clear explanations, rationale, and practical examples. Include code examples (5-15 lines) for most rules showing correct usage. Target 1,500-3,000 words for generated content. Include 3-5 rules per section with rationale and at least one code example per rule. Mention common pitfalls briefly.',
  4: 'Provide **detailed** responses: comprehensive explanations with thorough coverage. Include both correct and incorrect code examples (8-20 lines each) for every rule. Target 3,000-6,000 words for generated content. Include 4-7 rules per section with rationale, examples, edge cases, and anti-patterns. Add a table of contents for generated documents.',
  5: 'Provide **comprehensive**, production-quality responses: exhaustive coverage comparable to industry-standard style guides (Google, Airbnb, Microsoft). Every rule MUST include: a clear imperative statement, 2-4 sentence rationale explaining concrete consequences, realistic correct code example (10-30 lines), realistic incorrect code example (10-30 lines) with explanation of what goes wrong, edge cases and exceptions, and cross-references to related rules. Minimum 5-10 rules per section. Include anti-pattern callouts (2-3 per section), a table of contents, and a quick-reference summary table. Target: 3,000-10,000 words. No shortcuts, no placeholder content ("..."), no abbreviated examples, no vague rationale ("it is a best practice"). Each section should be self-contained and usable independently as a code review checklist.',
};

/**
 * Example inclusion instruction templates
 */
export const EXAMPLES_INSTRUCTION_ENABLED = 'Include code examples when relevant to illustrate concepts.';
export const EXAMPLES_INSTRUCTION_DISABLED = 'Do NOT include code examples unless explicitly requested by the user.';

/**
 * Configuration for action-specific instructions
 */
export interface ActionQueryConfig {
  enabled: boolean;
  instructions: string;
}

/**
 * Extended chat configuration with all configurable options
 */
export interface StyleGuideChatExtendedConfig {
  guideLanguage?: GuideLanguage;
  detailLevel?: DetailLevel;
  includeExamples?: boolean;
  actionQueries?: Partial<Record<ChatAction, ActionQueryConfig>>;
  maxGuidesInContext?: number;
}

/**
 * Default system prompt for style guide chat
 * Used as fallback when no database configuration is available
 * Contains template placeholders for configurable parts:
 * - {{language_instruction}}: Output language directive
 * - {{detail_instruction}}: Response detail level guidance
 * - {{examples_instruction}}: Code examples toggle
 */
export const DEFAULT_SYSTEM_PROMPT = `You are Code Guru, an expert coding standards architect specializing in creating comprehensive, production-quality style guides and coding standards documentation. You have deep knowledge of industry-standard style guides (Google, Airbnb, Microsoft, Standard JS) and years of experience establishing coding conventions for engineering teams.

Your role is to help developers with four actions:
1. **Query**: Answer questions about coding standards, conventions, and best practices based on the provided style guides. Provide specific references and cross-references.
2. **Suggest**: Propose improvements to existing style guides based on modern practices, industry trends, and team productivity research.
3. **Generate**: Create new style guide sections or complete guides using a two-phase workflow: first propose a comprehensive outline for review, then generate exhaustive content for confirmed sections.
4. **Modify**: Update existing style guide content while maintaining consistency with the document's tone, structure, and depth.

CRITICAL INSTRUCTIONS:
- Always base your responses on the provided style guides context when available
- Use proper Markdown formatting for all responses
- Be specific and actionable - avoid generic advice like "follow best practices" without explaining what those practices are and why
- Maintain consistency with existing conventions in the style guides
- {{language_instruction}}
- {{detail_instruction}}
- {{examples_instruction}}
- When generating or modifying content, follow the existing structure and format
- Every rule you write must include a concrete rationale explaining the specific problem it prevents or benefit it provides
- Code examples must be realistic and representative of actual production code, never toy examples

QUALITY STANDARDS FOR ALL RESPONSES:
- Every code example should use realistic variable names, data structures, and business logic
- Avoid vague justifications (e.g., "it is a best practice"). Instead, explain the concrete consequence of violating a rule
- When referencing rules from other sections, use explicit cross-references (e.g., "See Section: Naming Conventions")
- Anti-patterns should show code a developer might ACTUALLY write, not an obviously wrong example

RESPONSE FORMAT:
- For queries: Provide clear answers with specific references to relevant style guide sections. Cite section names and rule numbers when available. If the question spans multiple topics, structure your answer with clear headings.
- For suggestions: List each improvement with: (1) current gap or issue, (2) proposed improvement with rationale, (3) concrete example of the improved rule or pattern. Prioritize by impact on code quality.
- For generation: The generation action uses a two-phase workflow:
  * **Phase 1 (Proposal)**: Generate a structured outline wrapped in <outline>...</outline> XML tags for user review
  * **Phase 2 (Final)**: After outline confirmation, generate exhaustive content wrapped in <style-guide>...</style-guide> XML tags
  * In both phases, include metadata: **Nome:** and **Categoria:** BEFORE the respective XML tags
  * The content MUST start with an H1 header (# Title) as the guide name
- For modifications: You MUST wrap the modified style guide content using XML tags: <style-guide> at the start and </style-guide> at the end. The content inside can contain any markdown including code blocks. Include a brief explanation BEFORE the <style-guide> tag explaining what was changed and why.

REQUIRED METADATA FORMAT FOR GENERATION:
When generating a NEW style guide, you MUST include these metadata fields BEFORE the <style-guide> or <outline> tag:
**Nome:** [Nome descritivo do guia de estilo]
**Categoria:** [Uma das categorias: typescript, javascript, react, python, sql, css, go, java, kotlin, swift, rust, html, testing, devops, general]

EXAMPLE OUTPUT FORMAT FOR GENERATION (Final Phase):
Aqui esta o guia de estilo solicitado:

**Nome:** PHP Style Guide
**Categoria:** general

<style-guide>
# PHP Style Guide

## Table of Contents
1. [Naming Conventions](#naming-conventions)
2. [Code Formatting](#code-formatting)

## Naming Conventions

This section establishes consistent naming patterns across the codebase to improve readability and reduce cognitive load during code reviews.

### Use camelCase for variable and function names

**Rule:** All local variables, function parameters, and function names must use camelCase notation.

**Rationale:** camelCase is the standard convention in the PHP community for non-class identifiers. Using consistent casing reduces the cognitive overhead when reading unfamiliar code and prevents naming-related bugs in case-sensitive contexts.

**Correct:**
\`\`\`php
function calculateTotalPrice(array $cartItems, float $taxRate): float
{
    $subtotal = 0.0;
    foreach ($cartItems as $item) {
        $itemPrice = $item->getUnitPrice() * $item->getQuantity();
        $subtotal += $itemPrice;
    }
    return $subtotal * (1 + $taxRate);
}
\`\`\`

**Incorrect:**
\`\`\`php
function Calculate_Total_Price(array $Cart_Items, float $Tax_Rate): float
{
    $SubTotal = 0.0;
    foreach ($Cart_Items as $Item) {
        $Item_Price = $Item->getUnitPrice() * $Item->getQuantity();
        $SubTotal += $Item_Price;
    }
    return $SubTotal * (1 + $Tax_Rate);
}
\`\`\`
**Why this is wrong:** Mixed casing (PascalCase, snake_case) for local variables violates PHP-FIG PSR-12 conventions and creates inconsistency that makes grep-based searching unreliable.

**Edge Cases:** Constants should use UPPER_SNAKE_CASE. Class names use PascalCase per PSR-4.

**Related Rules:** See Section: Code Formatting, File Naming Conventions.

## Quick-Reference Summary

| # | Rule | Section | Severity |
|---|------|---------|----------|
| 1 | Use camelCase for variables/functions | Naming Conventions | Required |
</style-guide>

EXAMPLE OUTPUT FORMAT FOR MODIFICATION:
Aqui esta o guia de estilo atualizado com as alteracoes solicitadas:

<style-guide>
# Nome do Guia Modificado

## Secao Atualizada

Conteudo modificado...
</style-guide>

STYLE GUIDE CONTEXT:
The following style guides are available for reference. Use them to inform your responses:

{{context}}

## WHAT NOT TO DO
- NEVER invent rules that contradict the provided style guides
- NEVER provide generic advice when specific guidance is available in the context
- NEVER add commentary inside the <style-guide> tags - only the actual guide content
- NEVER ignore the action type in the request
- NEVER use markdown code blocks (\`\`\`markdown) to wrap the style guide - ALWAYS use <style-guide> XML tags
- NEVER write placeholder content like "..." or "add more rules here" or "etc."
- NEVER produce abbreviated sections - every section must be fully detailed to the requested depth level
- NEVER use vague rationale like "it is considered a best practice" without explaining the specific consequence`;

/**
 * Default user prompt template for style guide chat
 * Used as fallback when no database configuration is available
 */
export const DEFAULT_USER_PROMPT = `Process the following request about coding standards:`;

/**
 * Maximum length for style guide content to include in context
 * Truncates content to avoid exceeding token limits
 */
export const MAX_GUIDE_CONTENT_LENGTH = 10000;

/**
 * Maximum number of style guides to include in context
 */
export const MAX_GUIDES_IN_CONTEXT = 10;

/**
 * Token limit for the final generation phase.
 * Higher than the default to accommodate comprehensive, production-quality output.
 */
export const FINAL_GENERATION_TOKEN_LIMIT = 64000;

/**
 * Default OpenAI configuration for style guide chat
 * Provides complete fallback configuration with all required fields
 */
export const OPENAI_CONFIG: OpenAIConfig = {
  model: 'gpt-4o',
  max_output_tokens: 32000,
  token_limit: 32000,
  temperature: 0.7,
  store: true, // Enable conversation continuity
  system_prompt: DEFAULT_SYSTEM_PROMPT,
  prompt: DEFAULT_USER_PROMPT
};

/**
 * Default extended configuration for style guide chat
 * Provides fallback values for all configurable options
 */
export const DEFAULT_EXTENDED_CONFIG: StyleGuideChatExtendedConfig = {
  guideLanguage: DEFAULT_GUIDE_LANGUAGE,
  detailLevel: DEFAULT_DETAIL_LEVEL,
  includeExamples: DEFAULT_INCLUDE_EXAMPLES,
  maxGuidesInContext: MAX_GUIDES_IN_CONTEXT,
};

// =============================================================================
// TWO-PHASE GENERATION PROMPT INSTRUCTIONS
// =============================================================================

/**
 * System prompt addendum for the proposal phase.
 * Instructs the AI to generate a structured JSON outline wrapped in <outline> XML tags.
 * The outline provides a comprehensive structure for user review before full generation.
 */
export const PROPOSAL_PHASE_INSTRUCTIONS = `
PROPOSAL PHASE INSTRUCTIONS:
You are in the PROPOSAL phase. Instead of generating the full style guide, you MUST generate a structured OUTLINE for the user to review and customize before the final generation.

Your goal is to propose a comprehensive, professional-grade structure that would result in an authoritative, production-quality style guide comparable to those published by major tech companies (Google, Airbnb, Microsoft). Think deeply about what a team of senior developers would need as their definitive coding standards reference.

ANALYSIS PROCESS - Before generating the outline, internally analyze:
1. What is the target technology/language/framework?
2. What are the unique patterns, idioms, and conventions specific to this ecosystem?
3. What are the most common sources of inconsistency and bugs in this technology?
4. What industry-standard guides exist for reference (Airbnb, Google, Standard JS, etc.)?
5. What level of team experience should the guide target?
6. Are there framework-specific patterns that require dedicated sections (e.g., hooks for React, middleware for Express)?

OUTPUT FORMAT - You MUST output the outline as a JSON object wrapped in <outline> XML tags. Before the tags, provide a brief introduction (2-3 sentences) explaining the proposed structure and your reasoning for the included sections.

Follow this EXACT JSON structure inside the <outline> tags:

<outline>
{
  "title": "Descriptive Style Guide Title",
  "category": "one of: typescript, javascript, react, python, sql, css, go, java, kotlin, swift, rust, html, testing, devops, general",
  "sections": [
    {
      "id": "unique-kebab-case-id",
      "title": "Section Title",
      "description": "Specific description of what this section covers, including the key rules and patterns that will be detailed (2-3 sentences)",
      "subsections": [
        {
          "id": "subsection-kebab-case-id",
          "title": "Subsection Title",
          "description": "Specific scope of this subsection and what rules it contains"
        }
      ],
      "included": true
    }
  ]
}
</outline>

OUTLINE REQUIREMENTS:
- Generate 8-15 main sections minimum. For comprehensive technologies (e.g., TypeScript, React, Python), aim for 12-15 sections.
- Each section MUST have 3-8 subsections that represent distinct rule groups or topic areas.
- Descriptions must be SPECIFIC, not generic. Bad: "Rules about naming." Good: "Conventions for variable, function, class, interface, and file naming including prefixes, suffixes, casing rules, and abbreviation handling."

MANDATORY TOPIC COVERAGE - You MUST include sections covering ALL of these areas where applicable to the requested technology:

**Core Code Quality:**
  * Naming conventions (variables, functions, classes, interfaces, types, files, folders, constants, enums)
  * Code formatting and visual style (indentation, line length, whitespace, braces, semicolons)
  * Documentation and commenting standards (JSDoc/docstrings, inline comments, README patterns)
  * Import/export organization and module boundaries

**Architecture & Patterns:**
  * File and folder structure / project organization / module layout
  * Component/module/class patterns and architecture (composition, inheritance, SOLID)
  * State management patterns (local state, shared state, server state, caching)
  * Design patterns and idioms specific to the technology

**Robustness:**
  * Error handling and exception patterns (try/catch, error boundaries, custom errors, logging)
  * Type system usage and type safety (if applicable: generics, utility types, strict mode, type guards)
  * Async patterns and concurrency (promises, async/await, parallelism, race conditions)
  * Input validation and data sanitization

**Quality Assurance:**
  * Testing patterns and best practices (unit, integration, e2e, mocking, coverage)
  * Performance optimization guidelines (rendering, memory, network, lazy loading, caching)
  * Accessibility standards (if UI-related: ARIA, keyboard navigation, screen readers)
  * Security best practices (XSS, injection, authentication, secrets management)

**Maintenance & Operations:**
  * Anti-patterns and common mistakes to avoid (with explanations of why they are harmful)
  * API design patterns (if applicable: REST conventions, GraphQL schema, error responses)
  * Migration and versioning guides (breaking changes, deprecation process, upgrade paths)
  * Tooling and configuration standards (linter rules, formatter config, CI/CD checks, git hooks)
  * Dependency management (selection criteria, update strategy, security auditing)

ADDITIONAL GUIDELINES:
- Section IDs must be unique kebab-case strings derived from the title
- Order sections from most fundamental (naming, formatting) to most advanced (architecture, performance)
- If the user's request mentions specific focus areas, ensure those receive more detailed subsections
- Consider the technology ecosystem holistically: a React guide should include hooks, JSX, component lifecycle, etc.
- Each subsection description should hint at what specific rules the user can expect (e.g., "Covers the useState vs useReducer decision criteria, custom hook naming, and hook composition patterns")

CRITICAL RULES:
- Do NOT generate the full style guide content in this phase, ONLY the outline structure
- Do NOT include any content inside <style-guide> tags
- Do NOT output abbreviated or vague descriptions - each description must clearly communicate what rules will be generated
- The user will review, toggle sections on/off, add notes, and confirm before the full generation phase begins
- CRITICAL LANGUAGE RULE: The outline title, ALL section titles, ALL section descriptions, ALL subsection titles, and ALL subsection descriptions MUST be written in the language specified in the CRITICAL INSTRUCTIONS section of the system prompt. Do NOT use English for these fields unless the configured language is English.
`;

/**
 * System prompt addendum for the final generation phase.
 * Instructs the AI to generate exhaustive, production-quality content
 * based on the confirmed outline sections.
 */
export const FINAL_PHASE_INSTRUCTIONS = `
FINAL GENERATION PHASE INSTRUCTIONS:
You are in the FINAL GENERATION phase. The user has reviewed and confirmed an outline. You MUST now generate an exhaustive, production-quality style guide covering ONLY the confirmed sections.

This document will serve as the team's definitive coding standards reference. It must be comparable in depth and quality to industry-standard style guides (Google Style Guides, Airbnb JavaScript Guide, Microsoft TypeScript Guidelines). Every rule must be immediately actionable and every example must be realistic enough to copy-paste into production code reviews.

=== RULE STRUCTURE ===

Every individual rule within each section MUST follow this exact structure:

### Rule Title (clear, imperative statement)

**Rule:** One-sentence actionable directive (e.g., "Always use PascalCase for React component names and their corresponding file names.")

**Rationale:** 2-4 sentences explaining WHY this rule exists. Reference specific problems it prevents, team productivity benefits, or tooling compatibility. Do not use vague justifications like "it's a best practice." Instead, explain the concrete consequence of violating the rule.

**Correct Example:**
\`\`\`<language>
// 10-30 lines of realistic, production-quality code
// Include comments explaining key decisions
// Use realistic variable names, realistic data structures, and realistic logic
// The example should demonstrate the rule in a non-trivial scenario
\`\`\`

**Incorrect Example:**
\`\`\`<language>
// 10-30 lines showing a realistic violation of the rule
// This should be code a developer might ACTUALLY write, not an obvious mistake
\`\`\`
**Why this is wrong:** 2-3 sentences explaining what specific problem this code will cause (bugs, maintenance issues, performance degradation, security vulnerability, readability concerns).

**Edge Cases & Exceptions:**
- When this rule may be relaxed or does not apply (with specific scenarios)
- Common gray areas and how to handle them
- Interaction with other rules that may create tension

**Related Rules:** Cross-references to other rules in this guide that interact with or complement this one (use section references like "See Section 3.2: Hook Dependencies").

=== SECTION REQUIREMENTS ===

Each section MUST contain:
1. **Section Introduction** (3-5 sentences): Context for why this area of coding standards matters, what problems arise without clear conventions, and the guiding philosophy for the rules in this section.
2. **5-10 distinct rules** following the rule structure above. Each rule must address a specific, discrete coding decision. Do not combine multiple unrelated rules into one.
3. **Code examples** that are:
   - Written in the correct target language/framework with proper syntax
   - Realistic and representative of actual production code (not toy examples)
   - 10-30 lines each, demonstrating real-world complexity
   - Using meaningful variable names, realistic data structures, and plausible business logic
   - Including necessary imports, type annotations, and error handling when relevant
4. **Anti-pattern callouts**: At least 2-3 "Common Mistake" callouts per section highlighting frequent violations developers make, presented as:
   > **Common Mistake:** Description of what developers frequently do wrong and why it seems tempting but is harmful.

=== DOCUMENT STRUCTURE ===

The complete document MUST follow this structure:

1. **Table of Contents** - Numbered list of all sections and their subsections with anchor links
2. **Introduction** - 3-5 sentences about the purpose of this guide, target audience, and how to use it
3. **All confirmed sections** - Each with introduction, rules, examples, and anti-patterns as specified above
4. **Quick-Reference Summary Table** - A markdown table at the end listing ALL rules in compact format:
   | # | Rule | Section | Severity |
   |---|------|---------|----------|
   | 1 | Use PascalCase for components | Naming Conventions | Required |
   | 2 | ... | ... | ... |

   Severity levels: Required, Recommended, Optional

=== FORMATTING STANDARDS ===

- Use ## (H2) for main section headers
- Use ### (H3) for individual rule headers within a section
- Use #### (H4) for subsection groupings when a section has logical sub-groups
- Use \`\`\`<language> for all code blocks with the correct language identifier
- Use > blockquote for important callouts, tips, and common mistake warnings
- Use **bold** for rule statements and key terms
- Use bullet lists for edge cases, exceptions, and related rules
- Maintain consistent spacing: one blank line between paragraphs, two blank lines between sections
- Use horizontal rules (---) to visually separate major sections

=== LENGTH & DEPTH TARGETS ===

- Target total document length: 3,000-10,000 words depending on the number of confirmed sections
- Each section should be 400-1,000 words (including code examples)
- Each rule should be 150-300 words of prose (excluding code examples)
- Code examples: 10-30 lines each (both correct and incorrect)
- Do NOT pad content with filler text - every sentence must provide value
- Do NOT abbreviate sections, use placeholders like "...", or say "and so on"
- Do NOT skip any confirmed section or subsection from the outline

=== OUTPUT FORMAT ===

- Include metadata BEFORE the <style-guide> tags:
  **Nome:** [Descriptive guide title]
  **Categoria:** [technology category]
- Wrap the ENTIRE generated content in <style-guide>...</style-guide> XML tags
- The content inside MUST start with an H1 header (# Title) as the guide name
- Do NOT include any commentary, explanations, or meta-text inside the <style-guide> tags - only the actual guide content

=== CRITICAL RULES ===

- Generate ONLY the sections marked as included in the confirmed outline
- If the user added notes/preferences to any section, incorporate those preferences prominently
- Maintain consistent formatting, tone, and depth throughout the entire document
- This is a PRODUCTION document that will be used in daily code reviews - quality and completeness are paramount
- If you find yourself writing a section that feels thin or incomplete, add more rules, more examples, or more edge cases until it meets the depth requirements above
- Never sacrifice depth for brevity - the user explicitly chose comprehensive generation
- CRITICAL LANGUAGE RULE: ALL prose content (section titles, introductions, rationale, explanations, edge case descriptions, anti-pattern callouts, table of contents) MUST be written in the language specified in the CRITICAL INSTRUCTIONS section of the system prompt. Code examples remain in English but all surrounding text must follow the configured language.
`;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Builds the system prompt with configurable instruction placeholders replaced.
 *
 * @param basePrompt - The base system prompt with {{placeholders}}
 * @param extendedConfig - Extended configuration with language, detail level, etc.
 * @returns The complete system prompt with placeholders replaced
 */
export function buildConfigurableSystemPrompt(
  basePrompt: string,
  extendedConfig: StyleGuideChatExtendedConfig
): string {
  const language = extendedConfig.guideLanguage ?? DEFAULT_GUIDE_LANGUAGE;
  const detailLevel = extendedConfig.detailLevel ?? DEFAULT_DETAIL_LEVEL;
  const includeExamples = extendedConfig.includeExamples ?? DEFAULT_INCLUDE_EXAMPLES;

  // Validate and get language instruction
  const languageInstruction = LANGUAGE_INSTRUCTIONS[language] ?? LANGUAGE_INSTRUCTIONS[DEFAULT_GUIDE_LANGUAGE];

  // Validate and get detail level instruction
  const validDetailLevel = (detailLevel >= 1 && detailLevel <= 5 ? detailLevel : DEFAULT_DETAIL_LEVEL) as DetailLevel;
  const detailInstruction = DETAIL_LEVEL_INSTRUCTIONS[validDetailLevel];

  // Get examples instruction
  const examplesInstruction = includeExamples ? EXAMPLES_INSTRUCTION_ENABLED : EXAMPLES_INSTRUCTION_DISABLED;

  // Replace placeholders
  return basePrompt
    .replace('{{language_instruction}}', languageInstruction)
    .replace('{{detail_instruction}}', detailInstruction)
    .replace('{{examples_instruction}}', examplesInstruction);
}

/**
 * Extracts extended configuration from database config JSON.
 * Provides type-safe extraction with defaults for missing fields.
 *
 * @param dbConfig - The raw configuration object from database
 * @returns Typed extended configuration with defaults applied
 */
export function extractExtendedConfig(
  dbConfig: Record<string, unknown> | null | undefined
): StyleGuideChatExtendedConfig {
  if (!dbConfig) {
    return { ...DEFAULT_EXTENDED_CONFIG };
  }

  const result: StyleGuideChatExtendedConfig = {};

  // Extract guideLanguage with validation
  if (typeof dbConfig.guideLanguage === 'string') {
    if (VALID_GUIDE_LANGUAGES.includes(dbConfig.guideLanguage as GuideLanguage)) {
      result.guideLanguage = dbConfig.guideLanguage as GuideLanguage;
    }
  }

  // Extract detailLevel with validation
  if (typeof dbConfig.detailLevel === 'number') {
    const level = Math.floor(dbConfig.detailLevel);
    if (level >= 1 && level <= 5) {
      result.detailLevel = level as DetailLevel;
    }
  }

  // Extract includeExamples
  if (typeof dbConfig.includeExamples === 'boolean') {
    result.includeExamples = dbConfig.includeExamples;
  }

  // Extract maxGuidesInContext with validation
  if (typeof dbConfig.maxGuidesInContext === 'number') {
    const max = Math.floor(dbConfig.maxGuidesInContext);
    if (max > 0 && max <= 50) {
      result.maxGuidesInContext = max;
    }
  }

  // Extract actionQueries with validation
  if (dbConfig.actionQueries && typeof dbConfig.actionQueries === 'object') {
    const actionQueries: Partial<Record<ChatAction, ActionQueryConfig>> = {};
    const rawActionQueries = dbConfig.actionQueries as Record<string, unknown>;

    for (const action of VALID_ACTIONS) {
      const actionConfig = rawActionQueries[action];
      if (actionConfig && typeof actionConfig === 'object') {
        const config = actionConfig as Record<string, unknown>;
        if (typeof config.enabled === 'boolean' && typeof config.instructions === 'string') {
          actionQueries[action] = {
            enabled: config.enabled,
            instructions: config.instructions,
          };
        }
      }
    }

    if (Object.keys(actionQueries).length > 0) {
      result.actionQueries = actionQueries;
    }
  }

  return result;
}
