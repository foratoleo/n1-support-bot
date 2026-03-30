// User Stories Generator - Agile User Story Generation
// Creates comprehensive user stories with acceptance criteria from meeting transcripts

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
  getQualityInstructions
} from "../prompts/templates.ts";
import type { OpenAIRequestConfig } from "../openai-client.ts";

/**
 * User story structure
 */
export interface UserStory {
  id: string;
  epic: string;
  title: string;
  asA: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria: AcceptanceCriteria[];
  storyPoints: number;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  dependencies: string[];
  notes?: string;
  tags?: string[];
}

/**
 * Acceptance criteria structure
 */
export interface AcceptanceCriteria {
  given: string;
  when: string;
  then: string;
  and?: string[];
}

/**
 * Epic structure
 */
export interface Epic {
  id: string;
  title: string;
  description: string;
  businessValue: string;
  successCriteria: string[];
  stories: string[]; // Story IDs
}

/**
 * User Stories Generator Implementation
 */
export class UserStoriesGenerator extends DocumentGenerator {
  private stories: UserStory[] = [];
  private epics: Epic[] = [];
  
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
   * Generate complete user stories document
   */
  async generateDocument(request: DocumentGenerationRequest): Promise<GeneratedDocument> {
    const startTime = Date.now();
    
    try {
      // Extract metadata
      const metadata = this.extractMetadata(request.context.transcript);
      
      // Define sections
      const sections = this.defineSections(request.context);
      
      // Generate sections
      const generatedSections = request.options?.parallelSections !== false
        ? await this.generateSectionsParallel(sections, request.context, request.options)
        : await this.generateSectionsSequential(sections, request.context, request.options);
      
      // Parse generated content into structured stories
      this.parseGeneratedContent(generatedSections);
      
      // Enhance with story mapping
      const enhancedSections = this.enhanceSectionsWithStructuredData(generatedSections);
      
      // Assemble document
      const document = this.assembleDocument(
        enhancedSections,
        DocumentType.USER_STORIES,
        { ...metadata, storyCount: this.stories.length, epicCount: this.epics.length }
      );
      
      // Validate
      const validation = this.validateDocument(document);
      if (!validation.isValid) {
        console.warn('User stories validation issues:', validation);
        document.warnings = validation.errors.concat(validation.warnings);
      }
      
      // Calculate quality metrics
      if (request.options?.includeQualityMetrics) {
        document.qualityMetrics = await this.calculateQualityMetrics(document);
      }
      
      // Format output
      if (request.options?.outputFormat === 'json') {
        document.content = this.formatAsJSON();
      } else if (request.options?.outputFormat === 'html') {
        document.content = this.formatAsHTML(document);
      }
      
      document.metadata.generationTimeMs = Date.now() - startTime;
      
      return document;
    } catch (error) {
      console.error('Error generating user stories:', error);
      throw new Error(`User stories generation failed: ${error.message}`);
    }
  }
  
  /**
   * Define sections for user stories document
   */
  defineSections(context: DocumentGenerationRequest['context']): DocumentSection[] {
    return [
      {
        id: 'epics',
        title: 'Epic Definitions',
        order: 0,
        dependencies: []
      },
      {
        id: 'user_stories',
        title: 'User Stories',
        order: 1,
        dependencies: ['epics']
      },
      {
        id: 'acceptance_criteria',
        title: 'Detailed Acceptance Criteria',
        order: 2,
        dependencies: ['user_stories']
      },
      {
        id: 'story_mapping',
        title: 'Story Mapping & Dependencies',
        order: 3,
        dependencies: ['user_stories']
      },
      {
        id: 'prioritization',
        title: 'Prioritized Backlog',
        order: 4,
        dependencies: ['user_stories', 'story_mapping']
      },
      {
        id: 'sprint_planning',
        title: 'Sprint Planning Recommendations',
        order: 5,
        dependencies: ['prioritization']
      },
      {
        id: 'estimation_summary',
        title: 'Effort Estimation Summary',
        order: 6,
        dependencies: ['user_stories']
      }
    ];
  }
  
  /**
   * Generate sections sequentially
   */
  private async generateSectionsSequential(
    sections: DocumentSection[],
    context: DocumentGenerationRequest['context'],
    options?: DocumentGenerationRequest['options']
  ): Promise<DocumentSection[]> {
    const generated: DocumentSection[] = [];
    
    for (const section of sections) {
      const enhancedContext = this.buildEnhancedContext(context, section, generated);
      const generatedSection = await this.generateSection(section, enhancedContext, options);
      generated.push(generatedSection);
    }
    
    return generated;
  }
  
  /**
   * Build enhanced context
   */
  private buildEnhancedContext(
    baseContext: DocumentGenerationRequest['context'],
    currentSection: DocumentSection,
    previousSections: DocumentSection[]
  ): DocumentGenerationRequest['context'] {
    if (!currentSection.dependencies || currentSection.dependencies.length === 0) {
      return baseContext;
    }
    
    const dependentContent = previousSections
      .filter(s => currentSection.dependencies?.includes(s.id))
      .map(s => `## ${s.title}\n${s.content}`)
      .join('\n\n');
    
    return {
      ...baseContext,
      projectContext: `${baseContext.projectContext || ''}\n\n### Context from Previous Sections:\n${dependentContent}`
    };
  }
  
  /**
   * Get system prompt
   */
  protected getSystemPrompt(): string {
    return SYSTEM_PROMPTS.USER_STORY_GENERATOR;
  }
  
  /**
   * Build section-specific prompt
   */
  protected buildSectionPrompt(
    section: DocumentSection,
    context: DocumentGenerationRequest['context']
  ): string {
    const sectionMap: Record<string, any> = {
      'epics': SECTION_TEMPLATES.USER_STORIES_EPIC_DEFINITION,
      'user_stories': SECTION_TEMPLATES.USER_STORIES_DETAILED,
      'acceptance_criteria': this.getAcceptanceCriteriaTemplate(),
      'story_mapping': this.getStoryMappingTemplate(),
      'prioritization': SECTION_TEMPLATES.USER_STORIES_PRIORITIZATION,
      'sprint_planning': this.getSprintPlanningTemplate(),
      'estimation_summary': this.getEstimationSummaryTemplate()
    };
    
    const template = sectionMap[section.id];
    if (!template) {
      throw new Error(`No template found for section: ${section.id}`);
    }
    
    const promptContext = {
      transcript: context.transcript,
      projectContext: context.projectContext || '',
      requirements: context.requirements?.join('\n') || '',
      epics: this.extractPreviousSectionContent('epics', context),
      stories: this.extractPreviousSectionContent('user_stories', context),
      businessContext: context.metadata?.businessContext || ''
    };
    
    const qualityInstructions = getQualityInstructions('USER_STORIES');
    
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
   * Template for Acceptance Criteria section
   */
  private getAcceptanceCriteriaTemplate() {
    return {
      template: `Expand on the acceptance criteria for each user story:

User Stories:
{{stories}}

For each story, provide comprehensive acceptance criteria including:

1. Happy Path Scenarios
   - Given: Initial context/state
   - When: User action/trigger
   - Then: Expected outcome
   - And: Additional outcomes (if any)

2. Edge Cases
   - Boundary conditions
   - Invalid inputs
   - Concurrent actions
   - System limits

3. Error Scenarios
   - Error conditions
   - Error messages
   - Recovery paths
   - Fallback behavior

4. Non-Functional Criteria
   - Performance requirements
   - Security requirements
   - Accessibility requirements
   - Usability requirements

Format each criterion clearly and make them testable.`,
      variables: ['stories']
    };
  }
  
  /**
   * Template for Story Mapping section
   */
  private getStoryMappingTemplate() {
    return {
      template: `Create a story map showing relationships and dependencies:

User Stories:
{{stories}}

Provide:

1. User Journey Mapping
   - Map stories to user journey stages
   - Identify critical path stories
   - Show story flow and transitions

2. Dependency Analysis
   - Technical dependencies
   - Data dependencies
   - Business logic dependencies
   - External system dependencies

3. Story Relationships
   - Parent-child relationships
   - Blocking/blocked by relationships
   - Related stories
   - Alternative paths

4. Risk Assessment
   - High-risk stories
   - Dependencies on external teams
   - Technical complexity
   - Business criticality

Create a clear dependency matrix and highlight the critical path.`,
      variables: ['stories']
    };
  }
  
  /**
   * Template for Sprint Planning section
   */
  private getSprintPlanningTemplate() {
    return {
      template: `Create sprint planning recommendations:

Prioritized Stories:
{{stories}}

Project Context:
{{projectContext}}

Provide:

1. Sprint 1 (MVP/Foundation)
   - Core functionality stories
   - Critical path items
   - Estimated velocity: [points]
   - Sprint goal

2. Sprint 2-3 (Core Features)
   - Primary feature stories
   - User-facing functionality
   - Estimated velocity per sprint
   - Sprint goals

3. Sprint 4-5 (Enhancement)
   - Quality improvements
   - Additional features
   - Performance optimization
   - Sprint goals

4. Future Sprints
   - Nice-to-have features
   - Technical debt
   - Optimization stories

For each sprint include:
- Story IDs and titles
- Total story points
- Key deliverables
- Success criteria
- Risks and dependencies`,
      variables: ['stories', 'projectContext']
    };
  }
  
  /**
   * Template for Estimation Summary section
   */
  private getEstimationSummaryTemplate() {
    return {
      template: `Create an effort estimation summary:

User Stories:
{{stories}}

Provide:

1. Overall Estimates
   - Total story points
   - Estimated team velocity
   - Number of sprints required
   - Timeline projection

2. Estimation by Epic
   - Points per epic
   - Percentage of total effort
   - Complexity assessment
   - Risk factors

3. Estimation by Priority
   - P0 (Must Have): X points
   - P1 (Should Have): Y points
   - P2 (Nice to Have): Z points
   - P3 (Future): W points

4. Resource Requirements
   - Frontend effort
   - Backend effort
   - QA effort
   - DevOps effort
   - Design effort

5. Confidence Levels
   - High confidence estimates
   - Medium confidence estimates
   - Low confidence (needs refinement)

Include assumptions and factors that could affect estimates.`,
      variables: ['stories']
    };
  }
  
  /**
   * Parse generated content into structured data
   */
  private parseGeneratedContent(sections: DocumentSection[]): void {
    // Parse epics from the epics section
    const epicsSection = sections.find(s => s.id === 'epics');
    if (epicsSection?.content) {
      this.parseEpics(epicsSection.content);
    }
    
    // Parse stories from the user stories section
    const storiesSection = sections.find(s => s.id === 'user_stories');
    if (storiesSection?.content) {
      this.parseStories(storiesSection.content);
    }
  }
  
  /**
   * Parse epics from content
   */
  private parseEpics(content: string): void {
    // Simple parsing logic - in production, use more sophisticated parsing
    const epicMatches = content.matchAll(/Epic:\s*([^\n]+)/g);
    let epicIndex = 0;
    
    for (const match of epicMatches) {
      this.epics.push({
        id: `EPIC-${epicIndex + 1}`,
        title: match[1].trim(),
        description: '',
        businessValue: '',
        successCriteria: [],
        stories: []
      });
      epicIndex++;
    }
  }
  
  /**
   * Parse stories from content
   */
  private parseStories(content: string): void {
    // Parse user stories using regex patterns
    const storyPattern = /Story ID:\s*(US-\d+)[^]*?As a\s+([^,]+)[^]*?I want\s+([^,]+)[^]*?So that\s+([^\.]+)/gi;
    const matches = content.matchAll(storyPattern);
    
    for (const match of matches) {
      const story: UserStory = {
        id: match[1],
        epic: this.epics[0]?.id || 'EPIC-1',
        title: `${match[3].trim()}`,
        asA: match[2].trim(),
        iWant: match[3].trim(),
        soThat: match[4].trim(),
        acceptanceCriteria: [],
        storyPoints: this.estimateStoryPoints(match[3]),
        priority: this.assignPriority(match[0]),
        dependencies: []
      };
      
      this.stories.push(story);
    }
  }
  
  /**
   * Estimate story points based on description
   */
  private estimateStoryPoints(description: string): number {
    const complexity = description.length;
    if (complexity < 50) return 1;
    if (complexity < 100) return 2;
    if (complexity < 150) return 3;
    if (complexity < 200) return 5;
    if (complexity < 300) return 8;
    return 13;
  }
  
  /**
   * Assign priority based on content
   */
  private assignPriority(content: string): 'P0' | 'P1' | 'P2' | 'P3' {
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('critical') || lowerContent.includes('must have')) return 'P0';
    if (lowerContent.includes('important') || lowerContent.includes('should have')) return 'P1';
    if (lowerContent.includes('nice to have') || lowerContent.includes('enhancement')) return 'P2';
    return 'P3';
  }
  
  /**
   * Enhance sections with structured data
   */
  private enhanceSectionsWithStructuredData(sections: DocumentSection[]): DocumentSection[] {
    // Add a summary section with structured data
    const summarySection: DocumentSection = {
      id: 'summary',
      title: 'Summary Statistics',
      order: -1,
      content: this.generateSummaryContent()
    };
    
    return [summarySection, ...sections];
  }
  
  /**
   * Generate summary content
   */
  private generateSummaryContent(): string {
    const totalPoints = this.stories.reduce((sum, story) => sum + story.storyPoints, 0);
    const p0Stories = this.stories.filter(s => s.priority === 'P0').length;
    const p1Stories = this.stories.filter(s => s.priority === 'P1').length;
    
    return `## Summary Statistics

- **Total Stories**: ${this.stories.length}
- **Total Epics**: ${this.epics.length}
- **Total Story Points**: ${totalPoints}
- **P0 Stories**: ${p0Stories}
- **P1 Stories**: ${p1Stories}
- **Estimated Sprints**: ${Math.ceil(totalPoints / 30)} (assuming velocity of 30 points/sprint)

### Story Point Distribution
- 1 point: ${this.stories.filter(s => s.storyPoints === 1).length} stories
- 2 points: ${this.stories.filter(s => s.storyPoints === 2).length} stories
- 3 points: ${this.stories.filter(s => s.storyPoints === 3).length} stories
- 5 points: ${this.stories.filter(s => s.storyPoints === 5).length} stories
- 8 points: ${this.stories.filter(s => s.storyPoints === 8).length} stories
- 13 points: ${this.stories.filter(s => s.storyPoints === 13).length} stories`;
  }
  
  /**
   * Format as JSON
   */
  private formatAsJSON(): string {
    return JSON.stringify({
      epics: this.epics,
      stories: this.stories,
      summary: {
        totalStories: this.stories.length,
        totalEpics: this.epics.length,
        totalPoints: this.stories.reduce((sum, s) => sum + s.storyPoints, 0),
        priorityBreakdown: {
          P0: this.stories.filter(s => s.priority === 'P0').length,
          P1: this.stories.filter(s => s.priority === 'P1').length,
          P2: this.stories.filter(s => s.priority === 'P2').length,
          P3: this.stories.filter(s => s.priority === 'P3').length
        }
      }
    }, null, 2);
  }
  
  /**
   * Format as HTML
   */
  private formatAsHTML(document: GeneratedDocument): string {
    const storyCards = this.stories.map(story => `
      <div class="story-card">
        <div class="story-header">
          <span class="story-id">${story.id}</span>
          <span class="priority priority-${story.priority.toLowerCase()}">${story.priority}</span>
          <span class="points">${story.storyPoints} pts</span>
        </div>
        <div class="story-content">
          <p><strong>As a</strong> ${story.asA}</p>
          <p><strong>I want</strong> ${story.iWant}</p>
          <p><strong>So that</strong> ${story.soThat}</p>
        </div>
      </div>
    `).join('');
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>User Stories - ${document.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
    .story-card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
    .story-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .story-id { font-weight: bold; color: #0066cc; }
    .priority { padding: 2px 8px; border-radius: 4px; font-size: 12px; }
    .priority-p0 { background: #ff4444; color: white; }
    .priority-p1 { background: #ff8800; color: white; }
    .priority-p2 { background: #00aa00; color: white; }
    .priority-p3 { background: #888; color: white; }
    .points { background: #f0f0f0; padding: 2px 8px; border-radius: 4px; }
    .story-content p { margin: 5px 0; }
  </style>
</head>
<body>
  <h1>User Stories</h1>
  <div class="stories-container">
    ${storyCards}
  </div>
</body>
</html>`;
  }
  
  /**
   * Extract previous section content
   */
  private extractPreviousSectionContent(sectionId: string, context: any): string {
    return context.projectContext || '';
  }
  
  /**
   * Calculate quality metrics specific to user stories
   */
  protected async calculateQualityMetrics(document: GeneratedDocument): Promise<QualityMetrics> {
    const baseMetrics = await super.calculateQualityMetrics(document);
    
    const issues: string[] = [...baseMetrics.issues];
    const recommendations: string[] = [...baseMetrics.recommendations];
    
    // Check story quality
    if (this.stories.length === 0) {
      issues.push('No user stories were generated');
    }
    
    // Check for acceptance criteria
    const storiesWithoutCriteria = this.stories.filter(s => s.acceptanceCriteria.length === 0);
    if (storiesWithoutCriteria.length > 0) {
      issues.push(`${storiesWithoutCriteria.length} stories lack acceptance criteria`);
    }
    
    // Check for proper story format
    const malformedStories = this.stories.filter(s => !s.asA || !s.iWant || !s.soThat);
    if (malformedStories.length > 0) {
      issues.push(`${malformedStories.length} stories have incomplete format`);
    }
    
    // Calculate story-specific score
    let storyScore = 1.0;
    storyScore -= (storiesWithoutCriteria.length / Math.max(this.stories.length, 1)) * 0.3;
    storyScore -= (malformedStories.length / Math.max(this.stories.length, 1)) * 0.2;
    
    const adjustedScore = (baseMetrics.overallScore * 0.6) + (storyScore * 0.4);
    
    return {
      ...baseMetrics,
      overallScore: Math.max(0, adjustedScore),
      issues,
      recommendations
    };
  }
}