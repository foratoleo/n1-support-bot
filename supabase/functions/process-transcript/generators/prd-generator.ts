// PRD Generator - Product Requirements Document Generation
// Creates comprehensive PRDs from meeting transcripts with structured sections

import {
  DocumentGenerator,
  DocumentGenerationRequest,
  GeneratedDocument,
  DocumentSection,
  DocumentType,
  QualityMetrics
} from "../document-generator.ts";
import {
  SYSTEM_PROMPTS,
  SECTION_TEMPLATES,
  buildPrompt,
  getQualityInstructions,
  validateOutput
} from "../prompts/templates.ts";
import type { OpenAIRequestConfig } from "../openai-client.ts";

/**
 * PRD-specific section configuration
 */
interface PRDSection extends DocumentSection {
  requiresAnalysis?: boolean;
  minWords?: number;
  maxWords?: number;
}

/**
 * PRD Generator Implementation
 */
export class PRDGenerator extends DocumentGenerator {
  constructor(apiKey: string, config?: Partial<OpenAIRequestConfig>) {
    super(apiKey, {
      model: 'gpt-4-turbo-preview',
      temperature: 0.7,
      maxTokens: 4000,
      topP: 0.9,
      ...config
    });
  }
  
  /**
   * Generate a complete PRD document
   */
  async generateDocument(request: DocumentGenerationRequest): Promise<GeneratedDocument> {
    const startTime = Date.now();
    
    try {
      // Extract metadata from transcript
      const metadata = this.extractMetadata(request.context.transcript);
      
      // Define sections for the PRD
      const sections = this.defineSections(request.context);
      
      // Generate sections in parallel where possible
      const generatedSections = request.options?.parallelSections !== false
        ? await this.generateSectionsParallel(sections, request.context, request.options)
        : await this.generateSectionsSequential(sections, request.context, request.options);
      
      // Assemble the document
      const document = this.assembleDocument(
        generatedSections,
        DocumentType.PRD,
        { ...metadata }
      );
      
      // Validate the document
      const validation = this.validateDocument(document);
      if (!validation.isValid) {
        console.warn('PRD validation issues:', validation);
        document.warnings = validation.errors.concat(validation.warnings);
      }
      
      // Calculate quality metrics if requested
      if (request.options?.includeQualityMetrics) {
        document.qualityMetrics = await this.calculateQualityMetrics(document);
      }
      
      // Format output based on requested format
      if (request.options?.outputFormat && request.options.outputFormat !== 'markdown') {
        const formatted = this.formatDocument(document, request.options.outputFormat);
        document.content = formatted;
      }
      
      // Add generation time
      document.metadata.generationTimeMs = Date.now() - startTime;
      
      return document;
    } catch (error) {
      console.error('Error generating PRD:', error);
      throw new Error(`PRD generation failed: ${error.message}`);
    }
  }
  
  /**
   * Define PRD sections with dependencies
   */
  defineSections(context: DocumentGenerationRequest['context']): PRDSection[] {
    return [
      {
        id: 'exec_summary',
        title: 'Executive Summary',
        order: 0,
        requiresAnalysis: true,
        minWords: 300,
        maxWords: 500,
        dependencies: [] // No dependencies, can be generated first
      },
      {
        id: 'problem_statement',
        title: 'Problem Statement',
        order: 1,
        requiresAnalysis: true,
        minWords: 200,
        maxWords: 400,
        dependencies: []
      },
      {
        id: 'solution_overview',
        title: 'Solution Overview',
        order: 2,
        requiresAnalysis: true,
        minWords: 400,
        maxWords: 800,
        dependencies: ['problem_statement'] // Depends on problem being defined
      },
      {
        id: 'target_users',
        title: 'Target Users & Personas',
        order: 3,
        requiresAnalysis: false,
        minWords: 200,
        maxWords: 400,
        dependencies: ['problem_statement']
      },
      {
        id: 'requirements',
        title: 'Feature Requirements',
        order: 4,
        requiresAnalysis: true,
        minWords: 600,
        maxWords: 1200,
        dependencies: ['solution_overview', 'target_users']
      },
      {
        id: 'user_experience',
        title: 'User Experience & Design',
        order: 5,
        requiresAnalysis: false,
        minWords: 300,
        maxWords: 600,
        dependencies: ['requirements', 'target_users']
      },
      {
        id: 'technical_considerations',
        title: 'Technical Considerations',
        order: 6,
        requiresAnalysis: true,
        minWords: 300,
        maxWords: 600,
        dependencies: ['requirements']
      },
      {
        id: 'success_metrics',
        title: 'Success Metrics & KPIs',
        order: 7,
        requiresAnalysis: true,
        minWords: 250,
        maxWords: 500,
        dependencies: ['solution_overview', 'requirements']
      },
      {
        id: 'risks_mitigation',
        title: 'Risks & Mitigation',
        order: 8,
        requiresAnalysis: true,
        minWords: 200,
        maxWords: 400,
        dependencies: ['requirements', 'technical_considerations']
      },
      {
        id: 'timeline_milestones',
        title: 'Timeline & Milestones',
        order: 9,
        requiresAnalysis: false,
        minWords: 200,
        maxWords: 400,
        dependencies: ['requirements']
      },
      {
        id: 'appendix',
        title: 'Appendix & References',
        order: 10,
        requiresAnalysis: false,
        minWords: 100,
        maxWords: 300,
        dependencies: [] // Can be generated independently
      }
    ];
  }
  
  /**
   * Generate sections sequentially (fallback method)
   */
  private async generateSectionsSequential(
    sections: PRDSection[],
    context: DocumentGenerationRequest['context'],
    options?: DocumentGenerationRequest['options']
  ): Promise<DocumentSection[]> {
    const generated: DocumentSection[] = [];
    
    for (const section of sections) {
      // Build enhanced context with previous sections
      const enhancedContext = this.buildEnhancedContext(context, section, generated);
      const generatedSection = await this.generateSection(section, enhancedContext, options);
      generated.push(generatedSection);
    }
    
    return generated;
  }
  
  /**
   * Build enhanced context with previous section content
   */
  private buildEnhancedContext(
    baseContext: DocumentGenerationRequest['context'],
    currentSection: PRDSection,
    previousSections: DocumentSection[]
  ): DocumentGenerationRequest['context'] {
    if (!currentSection.dependencies || currentSection.dependencies.length === 0) {
      return baseContext;
    }
    
    const dependentSections = previousSections
      .filter(s => currentSection.dependencies?.includes(s.id))
      .map(s => `## ${s.title}\n${s.content}`)
      .join('\n\n');
    
    return {
      ...baseContext,
      projectContext: `${baseContext.projectContext || ''}\n\n### Previous Sections:\n${dependentSections}`
    };
  }
  
  /**
   * Get system prompt for PRD generation
   */
  protected getSystemPrompt(): string {
    return SYSTEM_PROMPTS.PRD_GENERATOR;
  }
  
  /**
   * Build section-specific prompt
   */
  protected buildSectionPrompt(
    section: DocumentSection,
    context: DocumentGenerationRequest['context']
  ): string {
    const sectionMap: Record<string, any> = {
      'exec_summary': SECTION_TEMPLATES.PRD_EXECUTIVE_SUMMARY,
      'problem_statement': SECTION_TEMPLATES.PRD_PROBLEM_STATEMENT,
      'solution_overview': SECTION_TEMPLATES.PRD_SOLUTION_OVERVIEW,
      'requirements': SECTION_TEMPLATES.PRD_REQUIREMENTS,
      'success_metrics': SECTION_TEMPLATES.PRD_SUCCESS_METRICS,
      'target_users': this.getTargetUsersTemplate(),
      'user_experience': this.getUserExperienceTemplate(),
      'technical_considerations': this.getTechnicalConsiderationsTemplate(),
      'risks_mitigation': this.getRisksMitigationTemplate(),
      'timeline_milestones': this.getTimelineMilestonesTemplate(),
      'appendix': this.getAppendixTemplate()
    };
    
    const template = sectionMap[section.id];
    if (!template) {
      throw new Error(`No template found for section: ${section.id}`);
    }
    
    // Build context object for variable substitution
    const promptContext = {
      transcript: context.transcript,
      projectContext: context.projectContext || '',
      constraints: context.constraints?.join('\n') || '',
      requirements: context.requirements?.join('\n') || '',
      previousSections: context.projectContext || '',
      problemStatement: this.extractPreviousSectionContent('problem_statement', context),
      solutionOverview: this.extractPreviousSectionContent('solution_overview', context)
    };
    
    // Get quality instructions for PRD
    const qualityInstructions = getQualityInstructions('PRD');
    
    // Handle both template objects and inline templates
    if (typeof template === 'object' && 'template' in template) {
      return buildPrompt(template, promptContext, qualityInstructions);
    } else {
      return buildPrompt(
        { template: template.template, variables: template.variables },
        promptContext,
        qualityInstructions
      );
    }
  }
  
  /**
   * Extract content from a previous section if available in context
   */
  private extractPreviousSectionContent(sectionId: string, context: any): string {
    // This would extract content from previously generated sections
    // passed through the context
    return context.projectContext || '';
  }
  
  /**
   * Template for Target Users section
   */
  private getTargetUsersTemplate() {
    return {
      template: `Based on the meeting transcript, identify and describe the target users:

Transcript:
{{transcript}}

Problem Context:
{{problemStatement}}

Create detailed user personas including:
1. Primary Users
   - Role/Title
   - Goals and needs
   - Pain points
   - Technical proficiency
   - Usage patterns

2. Secondary Users
   - Stakeholders
   - Administrators
   - Support teams

3. User Segments
   - Market segments
   - Geographic considerations
   - Industry verticals

For each persona, include:
- Demographics
- Motivations
- Frustrations
- Success criteria
- Feature priorities`,
      variables: ['transcript', 'problemStatement']
    };
  }
  
  /**
   * Template for User Experience section
   */
  private getUserExperienceTemplate() {
    return {
      template: `Define the user experience and design requirements:

Transcript:
{{transcript}}

Requirements:
{{requirements}}

Include:
1. User Journey Maps
   - Key workflows
   - Touch points
   - Decision points
   - Pain points to address

2. Design Principles
   - Usability goals
   - Accessibility requirements
   - Brand alignment
   - Mobile responsiveness

3. Interface Requirements
   - Navigation structure
   - Key screens/pages
   - Interaction patterns
   - Feedback mechanisms

4. Design Constraints
   - Technical limitations
   - Platform requirements
   - Performance considerations`,
      variables: ['transcript', 'requirements']
    };
  }
  
  /**
   * Template for Technical Considerations section
   */
  private getTechnicalConsiderationsTemplate() {
    return {
      template: `Analyze technical considerations for the solution:

Transcript:
{{transcript}}

Requirements:
{{requirements}}

Address:
1. Architecture Requirements
   - System architecture
   - Technology stack
   - Integration points
   - API requirements

2. Performance Requirements
   - Response time targets
   - Throughput requirements
   - Scalability needs
   - Resource constraints

3. Security Requirements
   - Authentication/Authorization
   - Data protection
   - Compliance requirements
   - Security standards

4. Infrastructure Requirements
   - Hosting/deployment
   - Database requirements
   - Third-party services
   - Monitoring/logging

5. Development Considerations
   - Team skills required
   - Development timeline
   - Testing requirements
   - Documentation needs`,
      variables: ['transcript', 'requirements']
    };
  }
  
  /**
   * Template for Risks & Mitigation section
   */
  private getRisksMitigationTemplate() {
    return {
      template: `Identify risks and mitigation strategies:

Transcript:
{{transcript}}

Technical Context:
{{previousSections}}

For each risk provide:
1. Risk Description
2. Probability (High/Medium/Low)
3. Impact (High/Medium/Low)
4. Mitigation Strategy
5. Contingency Plan

Categories to consider:
- Technical Risks
  - Technology choices
  - Integration challenges
  - Performance issues
  - Security vulnerabilities

- Business Risks
  - Market changes
  - Competitive threats
  - Resource constraints
  - Regulatory compliance

- Project Risks
  - Timeline delays
  - Scope creep
  - Team availability
  - Budget overruns

- User Adoption Risks
  - Learning curve
  - Change resistance
  - Feature complexity`,
      variables: ['transcript', 'previousSections']
    };
  }
  
  /**
   * Template for Timeline & Milestones section
   */
  private getTimelineMilestonesTemplate() {
    return {
      template: `Create a timeline with key milestones:

Transcript:
{{transcript}}

Requirements:
{{requirements}}

Provide:
1. Project Phases
   - Phase name
   - Duration
   - Key deliverables
   - Success criteria

2. Major Milestones
   - Milestone name
   - Target date
   - Dependencies
   - Deliverables
   - Stakeholder checkpoints

3. Release Plan
   - MVP features
   - Beta release
   - Production release
   - Post-launch iterations

4. Critical Path
   - Key dependencies
   - Potential bottlenecks
   - Parallel workstreams

Include buffer time for testing, iterations, and unforeseen challenges.`,
      variables: ['transcript', 'requirements']
    };
  }
  
  /**
   * Template for Appendix section
   */
  private getAppendixTemplate() {
    return {
      template: `Create an appendix with supporting information:

Transcript:
{{transcript}}

Include:
1. Glossary of Terms
   - Technical terms
   - Acronyms
   - Domain-specific language

2. References
   - Meeting notes
   - Related documents
   - Industry standards
   - Competitive analysis

3. Assumptions
   - Business assumptions
   - Technical assumptions
   - Resource assumptions

4. Open Questions
   - Unresolved issues
   - Pending decisions
   - Information needed

5. Change Log
   - Version history
   - Major changes
   - Review notes`,
      variables: ['transcript']
    };
  }
  
  /**
   * Override quality metrics calculation for PRD-specific metrics
   */
  protected async calculateQualityMetrics(document: GeneratedDocument): Promise<QualityMetrics> {
    const baseMetrics = await super.calculateQualityMetrics(document);
    
    // PRD-specific quality checks
    const prdIssues: string[] = [...baseMetrics.issues];
    const prdRecommendations: string[] = [...baseMetrics.recommendations];
    
    // Check for PRD-specific requirements
    const hasUserPersonas = document.content.toLowerCase().includes('persona');
    const hasSuccessMetrics = document.content.toLowerCase().includes('success metric');
    const hasTimeline = document.content.toLowerCase().includes('timeline');
    const hasRisks = document.content.toLowerCase().includes('risk');
    
    let prdSpecificScore = 0;
    
    if (hasUserPersonas) prdSpecificScore += 0.25;
    else prdRecommendations.push('Consider adding detailed user personas');
    
    if (hasSuccessMetrics) prdSpecificScore += 0.25;
    else prdIssues.push('Missing success metrics');
    
    if (hasTimeline) prdSpecificScore += 0.25;
    else prdRecommendations.push('Add timeline and milestones');
    
    if (hasRisks) prdSpecificScore += 0.25;
    else prdRecommendations.push('Include risk assessment');
    
    // Adjust overall score with PRD-specific score
    const adjustedScore = (baseMetrics.overallScore * 0.7) + (prdSpecificScore * 0.3);
    
    return {
      ...baseMetrics,
      overallScore: adjustedScore,
      issues: prdIssues,
      recommendations: prdRecommendations
    };
  }
}