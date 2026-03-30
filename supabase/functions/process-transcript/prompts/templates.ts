// Modular Prompt Templates for Document Generation
// Provides structured templates with variable substitution and quality control

// ============================================================================
// Type Definitions
// ============================================================================

export interface PromptVariable {
  key: string;
  value: string | number | boolean;
  required?: boolean;
}

export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  variables: string[];
  examples?: string[];
  constraints?: string[];
  outputFormat?: string;
}

// ============================================================================
// System Prompts
// ============================================================================

export const SYSTEM_PROMPTS = {
  PRD_GENERATOR: `You are an expert Product Manager with extensive experience in creating comprehensive Product Requirements Documents (PRDs). Your task is to analyze meeting transcripts and generate well-structured, actionable PRDs that clearly communicate product vision, requirements, and success metrics.

Key responsibilities:
- Extract and synthesize key product requirements from discussions
- Identify stakeholders, goals, and constraints
- Define clear success metrics and KPIs
- Structure information in a logical, professional format
- Ensure all requirements are specific, measurable, and testable

Writing style:
- Clear, concise, and professional
- Use bullet points for easy scanning
- Include specific examples and use cases
- Avoid ambiguity and ensure clarity`,

  USER_STORY_GENERATOR: `You are an experienced Agile coach and Product Owner specializing in creating user stories that follow best practices. Your task is to transform meeting discussions into well-crafted user stories with clear acceptance criteria.

Key responsibilities:
- Create user stories following the "As a [user], I want [feature], so that [benefit]" format
- Define comprehensive acceptance criteria using Given-When-Then format
- Assign realistic story points based on complexity
- Group related stories into epics
- Identify dependencies and prerequisites

Writing style:
- Consistent format across all stories
- Clear and testable acceptance criteria
- Include edge cases and error scenarios
- Focus on user value and outcomes`,

  FUNCTIONAL_SPEC_GENERATOR: `You are a Senior Technical Analyst with expertise in creating detailed functional specifications. Your task is to translate business requirements into comprehensive functional specifications that development teams can implement.

Key responsibilities:
- Define detailed functional requirements
- Specify system behavior and business logic
- Document data flows and process workflows
- Identify technical dependencies and constraints
- Create clear interface specifications

Writing style:
- Technical but accessible to non-developers
- Use diagrams and flowcharts where helpful (describe them textually)
- Include validation rules and error handling
- Be precise about system behavior`,

  TASK_LIST_GENERATOR: `You are an experienced Project Manager and Technical Lead skilled in breaking down complex projects into actionable tasks. Your task is to create comprehensive, prioritized task lists with realistic effort estimates.

Key responsibilities:
- Break down high-level requirements into specific tasks
- Assign priority levels (P0-P3) based on impact and urgency
- Provide effort estimates in hours or story points
- Identify task dependencies and sequencing
- Group tasks by category or sprint

Writing style:
- Action-oriented task descriptions
- Start each task with a verb
- Include clear completion criteria
- Be specific about deliverables`,

  TECHNICAL_SPEC_GENERATOR: `You are a Senior Software Architect with deep expertise in system design and technical documentation. Your task is to create comprehensive technical specifications that guide implementation.

Key responsibilities:
- Define system architecture and components
- Specify APIs and data models
- Document technical constraints and requirements
- Address security, performance, and scalability
- Provide implementation guidelines

Writing style:
- Technically precise and detailed
- Include code examples where relevant
- Use standard technical terminology
- Focus on implementation clarity`,

  TEST_PLAN_GENERATOR: `You are a QA Lead with extensive experience in test planning and strategy. Your task is to create comprehensive test plans that ensure quality and coverage.

Key responsibilities:
- Define test strategy and approach
- Create detailed test cases with steps
- Specify test data requirements
- Define success and exit criteria
- Plan for different testing types (unit, integration, E2E)

Writing style:
- Clear, step-by-step instructions
- Include expected results for each test
- Cover positive and negative scenarios
- Be specific about test data and conditions`
};

// ============================================================================
// Section Templates
// ============================================================================

export const SECTION_TEMPLATES = {
  // PRD Sections
  PRD_EXECUTIVE_SUMMARY: {
    id: 'prd_executive_summary',
    name: 'Executive Summary',
    template: `Based on the following meeting transcript and context, create a comprehensive executive summary for the PRD:

Transcript:
{{transcript}}

Project Context:
{{projectContext}}

The executive summary should include:
1. Product vision and strategic alignment
2. Key problems being solved
3. Target users and market
4. High-level solution approach
5. Expected business impact
6. Success criteria overview

Format as professional prose with bullet points for key highlights. Keep it concise (300-500 words).`,
    variables: ['transcript', 'projectContext'],
    outputFormat: 'markdown'
  },

  PRD_PROBLEM_STATEMENT: {
    id: 'prd_problem_statement',
    name: 'Problem Statement',
    template: `Analyze the transcript and define the problem statement:

Transcript:
{{transcript}}

Constraints:
{{constraints}}

Create a detailed problem statement that includes:
1. Current situation and pain points
2. Impact on users/business
3. Root causes
4. Why this problem needs solving now
5. Consequences of not solving it

Use data and specific examples from the transcript where available.`,
    variables: ['transcript', 'constraints'],
    outputFormat: 'markdown'
  },

  PRD_SOLUTION_OVERVIEW: {
    id: 'prd_solution_overview',
    name: 'Solution Overview',
    template: `Based on the discussion, describe the proposed solution:

Transcript:
{{transcript}}

Problem Context:
{{problemStatement}}

Requirements:
{{requirements}}

Provide:
1. High-level solution description
2. Key features and capabilities
3. User journey and workflows
4. Integration points
5. Success metrics
6. MVP vs. future phases

Be specific about what will be built and how it addresses the problems.`,
    variables: ['transcript', 'problemStatement', 'requirements'],
    outputFormat: 'markdown'
  },

  PRD_REQUIREMENTS: {
    id: 'prd_requirements',
    name: 'Feature Requirements',
    template: `Extract and organize all feature requirements from the discussion:

Transcript:
{{transcript}}

Previous Sections:
{{previousSections}}

Organize requirements into:
1. Functional Requirements
   - Must Have (P0)
   - Should Have (P1)
   - Nice to Have (P2)
2. Non-Functional Requirements
   - Performance
   - Security
   - Usability
   - Scalability
3. Constraints and Assumptions

Each requirement should be:
- Specific and measurable
- Include acceptance criteria
- Have a clear priority
- Be technically feasible`,
    variables: ['transcript', 'previousSections'],
    outputFormat: 'markdown'
  },

  PRD_SUCCESS_METRICS: {
    id: 'prd_success_metrics',
    name: 'Success Metrics',
    template: `Define success metrics and KPIs for the product:

Transcript:
{{transcript}}

Solution Overview:
{{solutionOverview}}

Create comprehensive success metrics including:
1. Business Metrics
   - Revenue impact
   - Cost savings
   - Market share
2. User Metrics
   - Adoption rate
   - User satisfaction (NPS)
   - Engagement metrics
3. Technical Metrics
   - Performance benchmarks
   - Reliability targets
   - Quality metrics
4. Timeline and Milestones

Include specific targets, measurement methods, and review cadence.`,
    variables: ['transcript', 'solutionOverview'],
    outputFormat: 'markdown'
  },

  // User Stories Sections
  USER_STORIES_EPIC_DEFINITION: {
    id: 'user_stories_epic',
    name: 'Epic Definition',
    template: `Identify and define the main epics from the discussion:

Transcript:
{{transcript}}

Context:
{{projectContext}}

For each epic provide:
1. Epic title
2. Epic description
3. Business value
4. Success criteria
5. Dependencies
6. Estimated timeline

Group related functionality into logical epics.`,
    variables: ['transcript', 'projectContext'],
    outputFormat: 'markdown'
  },

  USER_STORIES_DETAILED: {
    id: 'user_stories_detailed',
    name: 'User Stories',
    template: `Create detailed user stories from the requirements:

Transcript:
{{transcript}}

Epics:
{{epics}}

For each user story provide:

**Story ID**: US-XXX
**Epic**: [Parent Epic]
**As a** [type of user]
**I want** [feature/capability]
**So that** [benefit/value]

**Acceptance Criteria**:
- Given [context]
- When [action]
- Then [outcome]

**Story Points**: [1, 2, 3, 5, 8, 13]
**Priority**: [P0, P1, P2, P3]
**Dependencies**: [List any dependencies]

Create at least 10-15 stories covering the main functionality.`,
    variables: ['transcript', 'epics'],
    outputFormat: 'markdown'
  },

  USER_STORIES_PRIORITIZATION: {
    id: 'user_stories_priority',
    name: 'Story Prioritization',
    template: `Create a prioritized backlog from the user stories:

Stories:
{{stories}}

Business Context:
{{businessContext}}

Prioritize stories considering:
1. Business value
2. User impact
3. Technical dependencies
4. Risk mitigation
5. Quick wins

Organize into:
- Sprint 1 (MVP)
- Sprint 2-3 (Core Features)
- Sprint 4+ (Enhancements)
- Future Backlog

Include rationale for prioritization.`,
    variables: ['stories', 'businessContext'],
    outputFormat: 'markdown'
  },

  // Functional Spec Sections
  FUNCTIONAL_SPEC_OVERVIEW: {
    id: 'func_spec_overview',
    name: 'System Overview',
    template: `Create a system overview based on the requirements:

Transcript:
{{transcript}}

Technical Context:
{{technicalContext}}

Include:
1. System purpose and scope
2. Key functional areas
3. User roles and permissions
4. System boundaries
5. Integration points
6. High-level data flow

Focus on WHAT the system does, not HOW.`,
    variables: ['transcript', 'technicalContext'],
    outputFormat: 'markdown'
  },

  FUNCTIONAL_SPEC_REQUIREMENTS: {
    id: 'func_spec_requirements',
    name: 'Functional Requirements',
    template: `Detail all functional requirements:

Transcript:
{{transcript}}

System Overview:
{{systemOverview}}

For each requirement specify:
1. Requirement ID
2. Description
3. Input specifications
4. Processing logic
5. Output specifications
6. Validation rules
7. Error handling
8. Performance criteria

Use clear, testable language.`,
    variables: ['transcript', 'systemOverview'],
    outputFormat: 'markdown'
  },

  FUNCTIONAL_SPEC_WORKFLOWS: {
    id: 'func_spec_workflows',
    name: 'Process Workflows',
    template: `Document the main process workflows:

Transcript:
{{transcript}}

Requirements:
{{requirements}}

For each workflow:
1. Workflow name
2. Trigger/initiator
3. Step-by-step process
4. Decision points
5. Alternative paths
6. Error scenarios
7. End conditions

Describe workflows textually (as if creating a flowchart).`,
    variables: ['transcript', 'requirements'],
    outputFormat: 'markdown'
  },

  // Task List Sections
  TASK_LIST_BREAKDOWN: {
    id: 'task_list_breakdown',
    name: 'Task Breakdown',
    template: `Break down the project into detailed tasks:

Transcript:
{{transcript}}

Requirements:
{{requirements}}

For each task provide:
- Task ID
- Task Title (start with verb)
- Description
- Category [Frontend|Backend|Database|DevOps|Testing|Documentation]
- Priority [P0|P1|P2|P3]
- Effort Estimate [hours]
- Dependencies [task IDs]
- Acceptance Criteria

Group tasks logically and ensure comprehensive coverage.`,
    variables: ['transcript', 'requirements'],
    outputFormat: 'markdown'
  },

  TASK_LIST_ROADMAP: {
    id: 'task_list_roadmap',
    name: 'Implementation Roadmap',
    template: `Create an implementation roadmap:

Tasks:
{{tasks}}

Timeline Constraints:
{{timeline}}

Organize into:
1. Phase 1 - Foundation (Week 1-2)
2. Phase 2 - Core Features (Week 3-4)
3. Phase 3 - Enhanced Features (Week 5-6)
4. Phase 4 - Polish & Deploy (Week 7-8)

Include:
- Critical path
- Parallel work streams
- Milestones
- Risk points
- Resource requirements`,
    variables: ['tasks', 'timeline'],
    outputFormat: 'markdown'
  },

  TASK_LIST_DEPENDENCIES: {
    id: 'task_list_dependencies',
    name: 'Dependency Matrix',
    template: `Create a dependency matrix for the tasks:

Tasks:
{{tasks}}

Identify:
1. Task dependencies (blocking/blocked by)
2. Resource dependencies
3. External dependencies
4. Critical path
5. Potential bottlenecks
6. Parallelization opportunities

Format as a clear dependency map with risk analysis.`,
    variables: ['tasks'],
    outputFormat: 'markdown'
  }
};

// ============================================================================
// Prompt Building Utilities
// ============================================================================

/**
 * Replace variables in a template with actual values
 */
export function substituteVariables(
  template: string,
  variables: Record<string, string | number | boolean>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, String(value));
  }
  
  // Check for any remaining unsubstituted variables
  const remaining = result.match(/{{[^}]+}}/g);
  if (remaining) {
    console.warn('Unsubstituted variables found:', remaining);
  }
  
  return result;
}

/**
 * Build a complete prompt with context injection
 */
export function buildPrompt(
  template: PromptTemplate | { template: string; variables: string[] },
  context: Record<string, any>,
  additionalInstructions?: string[]
): string {
  // Validate required variables
  const missingVars = template.variables.filter(v => !(v in context));
  if (missingVars.length > 0) {
    throw new Error(`Missing required variables: ${missingVars.join(', ')}`);
  }
  
  // Start with base template
  let prompt = substituteVariables(template.template, context);
  
  // Add constraints if present
  if ('constraints' in template && template.constraints) {
    prompt += '\n\nConstraints:\n' + template.constraints.map(c => `- ${c}`).join('\n');
  }
  
  // Add examples if present
  if ('examples' in template && template.examples) {
    prompt += '\n\nExamples:\n' + template.examples.join('\n\n');
  }
  
  // Add additional instructions
  if (additionalInstructions && additionalInstructions.length > 0) {
    prompt += '\n\nAdditional Instructions:\n' + additionalInstructions.map(i => `- ${i}`).join('\n');
  }
  
  // Add output format reminder
  if ('outputFormat' in template && template.outputFormat) {
    prompt += `\n\nPlease format the output as ${template.outputFormat}.`;
  }
  
  return prompt;
}

/**
 * Create a chain of prompts for sequential generation
 */
export function createPromptChain(
  templates: PromptTemplate[],
  baseContext: Record<string, any>
): Array<{ template: PromptTemplate; context: Record<string, any> }> {
  const chain: Array<{ template: PromptTemplate; context: Record<string, any> }> = [];
  const cumulativeContext = { ...baseContext };
  
  for (const template of templates) {
    chain.push({
      template,
      context: { ...cumulativeContext }
    });
    
    // Add placeholder for this template's output to be used by next template
    cumulativeContext[`${template.id}_output`] = `[Output from ${template.name}]`;
  }
  
  return chain;
}

/**
 * Quality control instructions to append to prompts
 */
export const QUALITY_INSTRUCTIONS = {
  COMPLETENESS: [
    'Ensure all sections are comprehensive and complete',
    'Include specific details and examples from the transcript',
    'Address all mentioned requirements and concerns'
  ],
  
  CLARITY: [
    'Use clear, unambiguous language',
    'Define any technical terms or acronyms',
    'Structure content with clear headings and bullet points'
  ],
  
  ACCURACY: [
    'Base all content on information from the transcript',
    'Do not invent requirements or features not discussed',
    'Flag any assumptions or areas needing clarification'
  ],
  
  PROFESSIONALISM: [
    'Maintain a professional, objective tone',
    'Use industry-standard terminology',
    'Format consistently throughout the document'
  ],
  
  ACTIONABILITY: [
    'Make all requirements specific and measurable',
    'Include clear acceptance criteria',
    'Provide enough detail for implementation'
  ]
};

/**
 * Get quality instructions for a document type
 */
export function getQualityInstructions(documentType: string): string[] {
  const instructions: string[] = [];
  
  // Add base quality instructions
  instructions.push(...QUALITY_INSTRUCTIONS.COMPLETENESS);
  instructions.push(...QUALITY_INSTRUCTIONS.CLARITY);
  instructions.push(...QUALITY_INSTRUCTIONS.ACCURACY);
  
  // Add type-specific instructions
  switch (documentType) {
    case 'PRD':
      instructions.push(...QUALITY_INSTRUCTIONS.PROFESSIONALISM);
      instructions.push('Include measurable success criteria');
      instructions.push('Address technical feasibility');
      break;
    
    case 'USER_STORIES':
      instructions.push(...QUALITY_INSTRUCTIONS.ACTIONABILITY);
      instructions.push('Follow standard user story format');
      instructions.push('Include comprehensive acceptance criteria');
      break;
    
    case 'FUNCTIONAL_SPEC':
      instructions.push(...QUALITY_INSTRUCTIONS.ACTIONABILITY);
      instructions.push('Specify all validation rules');
      instructions.push('Document error handling');
      break;
    
    case 'TASK_LIST':
      instructions.push('Provide realistic effort estimates');
      instructions.push('Identify all dependencies');
      instructions.push('Use action-oriented language');
      break;
  }
  
  return instructions;
}

/**
 * Format validation to ensure output meets requirements
 */
export function validateOutput(
  output: string,
  expectedFormat: string
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check basic structure
  if (!output || output.trim().length === 0) {
    errors.push('Output is empty');
  }
  
  // Check for required markdown elements if markdown format
  if (expectedFormat === 'markdown') {
    if (!output.includes('#')) {
      errors.push('Missing markdown headers');
    }
    
    // Check for reasonable length
    if (output.length < 500) {
      errors.push('Output seems too short');
    }
  }
  
  // Check for placeholder text that wasn't replaced
  if (output.includes('{{') || output.includes('}}')) {
    errors.push('Contains unsubstituted variables');
  }
  
  if (output.includes('[Output from') || output.includes('[TODO')) {
    errors.push('Contains placeholder text');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}