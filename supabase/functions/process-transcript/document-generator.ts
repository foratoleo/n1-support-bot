// Document Generation System - Base Generator with Common Functionality
// Provides parallel processing, validation, and quality control for all document types

import { OpenAIClient, OpenAIRequestConfig, OpenAIError } from "./openai-client.ts";
import type { ChatCompletionMessageParam } from "https://esm.sh/openai@4.28.0";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Document type enumeration for different generation modes
 */
export enum DocumentType {
  PRD = 'PRD',
  USER_STORIES = 'USER_STORIES',
  FUNCTIONAL_SPEC = 'FUNCTIONAL_SPEC',
  TASK_LIST = 'TASK_LIST',
  TECHNICAL_SPEC = 'TECHNICAL_SPEC',
  TEST_PLAN = 'TEST_PLAN'
}

/**
 * Quality metrics for generated documents
 */
export interface QualityMetrics {
  completeness: number; // 0-1 score
  coherence: number; // 0-1 score
  relevance: number; // 0-1 score
  structure: number; // 0-1 score
  clarity: number; // 0-1 score
  overallScore: number; // weighted average
  issues: string[];
  recommendations: string[];
}

/**
 * Document generation request configuration
 */
export interface DocumentGenerationRequest {
  type: DocumentType;
  context: {
    transcript: string;
    metadata?: Record<string, any>;
    projectContext?: string;
    constraints?: string[];
    requirements?: string[];
  };
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    streaming?: boolean;
    includeQualityMetrics?: boolean;
    parallelSections?: boolean;
    outputFormat?: 'markdown' | 'json' | 'html';
  };
}

/**
 * Section of a document for parallel processing
 */
export interface DocumentSection {
  id: string;
  title: string;
  order: number;
  content?: string;
  prompt?: string;
  dependencies?: string[]; // IDs of sections this depends on
  metadata?: Record<string, any>;
  tokensUsed?: number;
  generationTime?: number;
}

/**
 * Generated document response
 */
export interface GeneratedDocument {
  id: string;
  type: DocumentType;
  title: string;
  sections: DocumentSection[];
  content: string; // Full assembled content
  metadata: {
    generatedAt: string;
    model: string;
    tokensUsed: number;
    costEstimate: number;
    generationTimeMs: number;
    version: string;
  };
  qualityMetrics?: QualityMetrics;
  warnings?: string[];
}

/**
 * Document validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// ============================================================================
// Base Document Generator Class
// ============================================================================

export abstract class DocumentGenerator {
  protected client: OpenAIClient;
  protected defaultConfig: OpenAIRequestConfig;
  
  constructor(apiKey: string, defaultConfig?: Partial<OpenAIRequestConfig>) {
    this.client = new OpenAIClient(apiKey);
    this.defaultConfig = {
      model: defaultConfig?.model || 'gpt-4-turbo-preview',
      temperature: defaultConfig?.temperature || 0.7,
      maxTokens: defaultConfig?.maxTokens || 4000,
      topP: defaultConfig?.topP || 0.9,
      ...defaultConfig
    };
  }
  
  /**
   * Abstract method to be implemented by specific generators
   */
  abstract generateDocument(request: DocumentGenerationRequest): Promise<GeneratedDocument>;
  
  /**
   * Abstract method to define document sections for parallel processing
   */
  abstract defineSections(context: DocumentGenerationRequest['context']): DocumentSection[];
  
  /**
   * Generate content for a single section
   */
  protected async generateSection(
    section: DocumentSection,
    context: DocumentGenerationRequest['context'],
    config?: Partial<OpenAIRequestConfig>
  ): Promise<DocumentSection> {
    const startTime = Date.now();
    
    try {
      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: this.getSystemPrompt()
        },
        {
          role: 'user',
          content: section.prompt || this.buildSectionPrompt(section, context)
        }
      ];
      
      const response = await this.client.createChatCompletion(messages, {
        ...this.defaultConfig,
        ...config
      });
      
      const content = response.choices[0]?.message?.content || '';
      
      return {
        ...section,
        content,
        tokensUsed: response.usage?.total_tokens || 0,
        generationTime: Date.now() - startTime
      };
    } catch (error) {
      console.error(`Error generating section ${section.id}:`, error);
      throw new Error(`Failed to generate section ${section.title}: ${error.message}`);
    }
  }
  
  /**
   * Generate multiple sections in parallel with dependency management
   */
  protected async generateSectionsParallel(
    sections: DocumentSection[],
    context: DocumentGenerationRequest['context'],
    config?: Partial<OpenAIRequestConfig>
  ): Promise<DocumentSection[]> {
    const generated = new Map<string, DocumentSection>();
    const pending = new Set(sections.map(s => s.id));
    
    // Process sections in waves based on dependencies
    while (pending.size > 0) {
      const wave: DocumentSection[] = [];
      
      for (const section of sections) {
        if (!pending.has(section.id)) continue;
        
        // Check if all dependencies are satisfied
        const depsReady = !section.dependencies || 
          section.dependencies.every(dep => generated.has(dep));
        
        if (depsReady) {
          wave.push(section);
        }
      }
      
      if (wave.length === 0 && pending.size > 0) {
        throw new Error('Circular dependency detected in document sections');
      }
      
      // Generate current wave in parallel
      const results = await Promise.all(
        wave.map(section => {
          // Inject dependent section content into context if needed
          const enhancedContext = this.enhanceContextWithDependencies(
            context,
            section,
            generated
          );
          return this.generateSection(section, enhancedContext, config);
        })
      );
      
      // Store results and update pending set
      for (const result of results) {
        generated.set(result.id, result);
        pending.delete(result.id);
      }
    }
    
    // Return in original order
    return sections.map(s => generated.get(s.id)!);
  }
  
  /**
   * Enhance context with dependent section content
   */
  protected enhanceContextWithDependencies(
    context: DocumentGenerationRequest['context'],
    section: DocumentSection,
    generated: Map<string, DocumentSection>
  ): DocumentGenerationRequest['context'] {
    if (!section.dependencies || section.dependencies.length === 0) {
      return context;
    }
    
    const dependentContent = section.dependencies
      .map(depId => {
        const dep = generated.get(depId);
        return dep ? `## ${dep.title}\n${dep.content}` : '';
      })
      .filter(content => content)
      .join('\n\n');
    
    return {
      ...context,
      projectContext: `${context.projectContext || ''}\n\n### Previous Sections:\n${dependentContent}`
    };
  }
  
  /**
   * Validate generated document structure and content
   */
  protected validateDocument(document: GeneratedDocument): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    
    // Check document structure
    if (!document.title || document.title.trim() === '') {
      errors.push('Document title is missing');
    }
    
    if (!document.sections || document.sections.length === 0) {
      errors.push('Document has no sections');
    }
    
    // Check section completeness
    for (const section of document.sections) {
      if (!section.content || section.content.trim() === '') {
        warnings.push(`Section "${section.title}" has no content`);
      }
      
      if (section.content && section.content.length < 100) {
        warnings.push(`Section "${section.title}" seems too short (${section.content.length} chars)`);
      }
    }
    
    // Check token usage
    if (document.metadata.tokensUsed > 100000) {
      warnings.push(`High token usage: ${document.metadata.tokensUsed} tokens`);
    }
    
    // Add suggestions based on document type
    if (document.type === DocumentType.PRD && !document.content.includes('Success Metrics')) {
      suggestions.push('Consider adding success metrics to the PRD');
    }
    
    if (document.type === DocumentType.USER_STORIES && !document.content.includes('Acceptance Criteria')) {
      suggestions.push('Consider adding acceptance criteria to user stories');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }
  
  /**
   * Calculate quality metrics for generated document
   */
  protected async calculateQualityMetrics(document: GeneratedDocument): Promise<QualityMetrics> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Completeness check
    const requiredSections = this.getRequiredSections(document.type);
    const presentSections = document.sections.map(s => s.title.toLowerCase());
    const missingRequired = requiredSections.filter(
      req => !presentSections.some(present => present.includes(req.toLowerCase()))
    );
    
    const completeness = 1 - (missingRequired.length / requiredSections.length);
    if (missingRequired.length > 0) {
      issues.push(`Missing required sections: ${missingRequired.join(', ')}`);
    }
    
    // Coherence check (basic word count and sentence structure)
    const avgSectionLength = document.sections.reduce((sum, s) => 
      sum + (s.content?.length || 0), 0) / document.sections.length;
    const coherence = Math.min(avgSectionLength / 1000, 1); // Normalize to 0-1
    
    if (coherence < 0.3) {
      issues.push('Sections appear to be too brief');
      recommendations.push('Consider expanding sections with more detail');
    }
    
    // Relevance check (keyword presence)
    const relevantKeywords = this.getRelevantKeywords(document.type);
    const contentLower = document.content.toLowerCase();
    const keywordMatches = relevantKeywords.filter(kw => contentLower.includes(kw));
    const relevance = keywordMatches.length / relevantKeywords.length;
    
    if (relevance < 0.5) {
      recommendations.push('Consider including more domain-specific terminology');
    }
    
    // Structure check
    const hasProperHeadings = document.sections.every(s => s.title && s.title.length > 0);
    const hasLogicalOrder = document.sections.every((s, i) => s.order === i);
    const structure = (hasProperHeadings ? 0.5 : 0) + (hasLogicalOrder ? 0.5 : 0);
    
    if (!hasProperHeadings) {
      issues.push('Some sections lack proper headings');
    }
    
    // Clarity check (simple readability heuristic)
    const avgSentenceLength = this.calculateAvgSentenceLength(document.content);
    const clarity = avgSentenceLength > 10 && avgSentenceLength < 30 ? 1 : 0.7;
    
    if (avgSentenceLength > 30) {
      recommendations.push('Consider breaking down long sentences for better readability');
    }
    
    // Calculate overall score
    const weights = { completeness: 0.3, coherence: 0.2, relevance: 0.2, structure: 0.2, clarity: 0.1 };
    const overallScore = 
      completeness * weights.completeness +
      coherence * weights.coherence +
      relevance * weights.relevance +
      structure * weights.structure +
      clarity * weights.clarity;
    
    return {
      completeness,
      coherence,
      relevance,
      structure,
      clarity,
      overallScore,
      issues,
      recommendations
    };
  }
  
  /**
   * Get required sections based on document type
   */
  protected getRequiredSections(type: DocumentType): string[] {
    const sectionMap: Record<DocumentType, string[]> = {
      [DocumentType.PRD]: ['Executive Summary', 'Problem Statement', 'Solution', 'Requirements', 'Success Metrics'],
      [DocumentType.USER_STORIES]: ['User Stories', 'Acceptance Criteria', 'Priority'],
      [DocumentType.FUNCTIONAL_SPEC]: ['Overview', 'Requirements', 'Implementation', 'Dependencies'],
      [DocumentType.TASK_LIST]: ['Tasks', 'Priority', 'Effort Estimation'],
      [DocumentType.TECHNICAL_SPEC]: ['Architecture', 'Components', 'API', 'Data Model', 'Security'],
      [DocumentType.TEST_PLAN]: ['Test Strategy', 'Test Cases', 'Test Data', 'Success Criteria']
    };
    
    return sectionMap[type] || [];
  }
  
  /**
   * Get relevant keywords for document type
   */
  protected getRelevantKeywords(type: DocumentType): string[] {
    const keywordMap: Record<DocumentType, string[]> = {
      [DocumentType.PRD]: ['requirement', 'user', 'feature', 'goal', 'metric', 'success', 'problem', 'solution'],
      [DocumentType.USER_STORIES]: ['user', 'story', 'acceptance', 'criteria', 'given', 'when', 'then', 'epic'],
      [DocumentType.FUNCTIONAL_SPEC]: ['function', 'interface', 'input', 'output', 'validation', 'error', 'flow'],
      [DocumentType.TASK_LIST]: ['task', 'priority', 'effort', 'dependency', 'milestone', 'deliverable'],
      [DocumentType.TECHNICAL_SPEC]: ['api', 'database', 'architecture', 'component', 'security', 'performance'],
      [DocumentType.TEST_PLAN]: ['test', 'case', 'scenario', 'expected', 'actual', 'pass', 'fail']
    };
    
    return keywordMap[type] || [];
  }
  
  /**
   * Calculate average sentence length for readability
   */
  protected calculateAvgSentenceLength(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return 0;
    
    const totalWords = sentences.reduce((sum, sentence) => {
      return sum + sentence.trim().split(/\s+/).length;
    }, 0);
    
    return totalWords / sentences.length;
  }
  
  /**
   * Assemble sections into final document
   */
  protected assembleDocument(
    sections: DocumentSection[],
    type: DocumentType,
    metadata: Partial<GeneratedDocument['metadata']> = {}
  ): GeneratedDocument {
    const sortedSections = [...sections].sort((a, b) => a.order - b.order);
    const content = sortedSections
      .map(section => `# ${section.title}\n\n${section.content || ''}`)
      .join('\n\n---\n\n');
    
    const totalTokens = sections.reduce((sum, s) => sum + (s.tokensUsed || 0), 0);
    const totalTime = sections.reduce((sum, s) => sum + (s.generationTime || 0), 0);
    
    return {
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title: this.generateDocumentTitle(type, sections),
      sections: sortedSections,
      content,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: this.defaultConfig.model || 'gpt-4-turbo-preview',
        tokensUsed: totalTokens,
        costEstimate: this.estimateCost(totalTokens),
        generationTimeMs: totalTime,
        version: '1.0.0',
        ...metadata
      }
    };
  }
  
  /**
   * Generate document title based on type and content
   */
  protected generateDocumentTitle(type: DocumentType, sections: DocumentSection[]): string {
    const titleMap: Record<DocumentType, string> = {
      [DocumentType.PRD]: 'Product Requirements Document',
      [DocumentType.USER_STORIES]: 'User Stories and Acceptance Criteria',
      [DocumentType.FUNCTIONAL_SPEC]: 'Functional Specification',
      [DocumentType.TASK_LIST]: 'Project Task List and Roadmap',
      [DocumentType.TECHNICAL_SPEC]: 'Technical Specification',
      [DocumentType.TEST_PLAN]: 'Test Plan and Strategy'
    };
    
    return titleMap[type] || 'Generated Document';
  }
  
  /**
   * Estimate cost based on token usage
   */
  protected estimateCost(tokens: number): number {
    // GPT-4 Turbo pricing (as of 2024)
    const costPer1kTokens = 0.01; // $0.01 per 1K tokens (average of input/output)
    return (tokens / 1000) * costPer1kTokens;
  }
  
  /**
   * Get system prompt for the generator
   */
  protected abstract getSystemPrompt(): string;
  
  /**
   * Build prompt for a specific section
   */
  protected abstract buildSectionPrompt(
    section: DocumentSection,
    context: DocumentGenerationRequest['context']
  ): string;
  
  /**
   * Extract metadata from transcript
   */
  protected extractMetadata(transcript: string): Record<string, any> {
    const metadata: Record<string, any> = {};
    
    // Extract potential project name
    const projectMatch = transcript.match(/project[:\s]+([^,.\n]+)/i);
    if (projectMatch) {
      metadata.projectName = projectMatch[1].trim();
    }
    
    // Extract stakeholders
    const stakeholderMatch = transcript.match(/stakeholder[s]?[:\s]+([^,.\n]+)/i);
    if (stakeholderMatch) {
      metadata.stakeholders = stakeholderMatch[1].trim().split(/,\s*/);
    }
    
    // Extract timeline mentions
    const timelineMatch = transcript.match(/timeline[:\s]+([^,.\n]+)/i);
    if (timelineMatch) {
      metadata.timeline = timelineMatch[1].trim();
    }
    
    // Extract technology mentions
    const techKeywords = ['react', 'node', 'python', 'aws', 'docker', 'kubernetes'];
    const mentionedTech = techKeywords.filter(tech => 
      transcript.toLowerCase().includes(tech)
    );
    if (mentionedTech.length > 0) {
      metadata.technologies = mentionedTech;
    }
    
    // Word count and estimated reading time
    metadata.wordCount = transcript.split(/\s+/).length;
    metadata.estimatedReadingTime = Math.ceil(metadata.wordCount / 200); // minutes
    
    return metadata;
  }
  
  /**
   * Format document for specific output type
   */
  protected formatDocument(document: GeneratedDocument, format: 'markdown' | 'json' | 'html'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(document, null, 2);
      
      case 'html':
        return this.convertToHTML(document);
      
      case 'markdown':
      default:
        return document.content;
    }
  }
  
  /**
   * Convert document to HTML format
   */
  protected convertToHTML(document: GeneratedDocument): string {
    const sections = document.sections
      .map(section => `
        <section id="${section.id}">
          <h2>${this.escapeHTML(section.title)}</h2>
          <div class="content">
            ${this.markdownToHTML(section.content || '')}
          </div>
        </section>
      `)
      .join('\n');
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHTML(document.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; }
    section { margin-bottom: 40px; }
    .metadata { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 30px; }
    .content { line-height: 1.6; color: #333; }
  </style>
</head>
<body>
  <h1>${this.escapeHTML(document.title)}</h1>
  <div class="metadata">
    <p><strong>Generated:</strong> ${document.metadata.generatedAt}</p>
    <p><strong>Model:</strong> ${document.metadata.model}</p>
    <p><strong>Tokens Used:</strong> ${document.metadata.tokensUsed}</p>
  </div>
  ${sections}
</body>
</html>
    `;
  }
  
  /**
   * Basic markdown to HTML conversion
   */
  protected markdownToHTML(markdown: string): string {
    return markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }
  
  /**
   * Escape HTML special characters
   */
  protected escapeHTML(text: string): string {
    const escapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    
    return text.replace(/[&<>"']/g, char => escapeMap[char]);
  }
}

/**
 * Utility function to select appropriate generator based on document type
 */
export function createDocumentGenerator(
  type: DocumentType,
  apiKey: string,
  config?: Partial<OpenAIRequestConfig>
): DocumentGenerator {
  // This will be implemented when specific generators are created
  throw new Error(`Generator for type ${type} not implemented yet`);
}