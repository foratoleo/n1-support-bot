import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../_shared/cors.ts';
import { 
  OpenAIClient, 
  OpenAIRequestConfig,
  OpenAIResponse,
  OpenAIErrorType 
} from './openai-client.ts';
import { DatabaseService } from './database-service.ts';
import { createLogger, LogLevel } from './monitoring-logger.ts';
import { performanceOptimizer } from './performance-optimizer.ts';

interface ProjectContext {
  name: string;
  description: string;
  industry?: string;
  techStack?: string[];
}

interface TranscriptProcessRequest {
  transcript: string;
  context: ProjectContext;
  requestId?: string;
}

interface ProcessedDocuments {
  prd: DocumentContent;
  userStories: UserStory[];
  functionalSpecs: FunctionalSpec[];
  taskList: Task[];
  metadata: ProcessingMetadata;
}

interface DocumentContent {
  title: string;
  content: string;
  sections: DocumentSection[];
  wordCount: number;
  generatedAt: string;
}

interface DocumentSection {
  title: string;
  content: string;
  order: number;
}

interface UserStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: 'High' | 'Medium' | 'Low';
  storyPoints: number;
  epic: string;
}

interface FunctionalSpec {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  technicalDetails: string;
  dependencies: string[];
}

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  estimatedHours: number;
  dependencies: string[];
  category: string;
}

interface ProcessingMetadata {
  processingTime: number;
  tokensUsed: number;
  modelUsed: string;
  generatedAt: string;
  version: string;
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    retryable: boolean;
  };
  requestId: string;
  timestamp: string;
}

// Initialize OpenAI client with retry logic and monitoring
const openaiClient = new OpenAIClient();

// Initialize Database service
const dbService = new DatabaseService();

// Rate limiting map (in production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const logger = createLogger(requestId, dbService.getSupabaseClient());
  const stopTimer = logger.startTimer('total_request_processing');

  try {
    // Log incoming request
    logger.logRequest(req.method, req.url, req.headers, await req.clone().text());

    // Only allow POST requests
    if (req.method !== 'POST') {
      const response = {
        error: 'Method not allowed'
      };
      logger.warn('Invalid method attempted', { method: req.method });
      logger.logResponse(405, response);
      return new Response(
        JSON.stringify(response),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const startTime = Date.now();
    
    // Get client IP for rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    logger.info('Processing request', { clientIP, requestId });
    
    // Check rate limit
    const rateLimitTimer = logger.startTimer('rate_limit_check');
    const rateLimitPassed = await checkRateLimit(clientIP);
    rateLimitTimer();
    
    if (!rateLimitPassed) {
      logger.warn('Rate limit exceeded', { clientIP });
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please try again later.',
            retryable: true
          },
          requestId,
          timestamp: new Date().toISOString()
        } as ErrorResponse),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body
    const parseTimer = logger.startTimer('request_parsing');
    const body: TranscriptProcessRequest = await req.json();
    parseTimer();
    logger.debug('Request parsed', { contextName: body.context?.name });
    
    // Validate input
    const validationTimer = logger.startTimer('input_validation');
    const validation = validateInput(body);
    validationTimer();
    if (!validation.valid) {
      logger.error('Input validation failed', validation.error);
      const errorResponse = {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: validation.error,
          retryable: false
        },
        requestId,
        timestamp: new Date().toISOString()
      } as ErrorResponse;
      logger.logResponse(400, errorResponse);
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Store initial request in database
    const dbTimer = logger.startTimer('database_create_request');
    const { data: dbRequest, error: dbError } = await dbService.createRequest(
      requestId,
      body.transcript,
      body.context,
      'ai_processing'
    );
    dbTimer();

    if (dbError) {
      logger.error('Database error', dbError);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to store request',
            retryable: true
          },
          requestId,
          timestamp: new Date().toISOString()
        } as ErrorResponse),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check cache first
    const cacheKey = performanceOptimizer.generateCacheKey(body.transcript, body.context);
    const cachedResult = performanceOptimizer.getCachedResult(cacheKey);
    
    let documents: ProcessedDocuments;
    if (cachedResult) {
      logger.info('Cache hit, returning cached result', { cacheKey });
      documents = cachedResult;
    } else {
      logger.info('Cache miss, generating new documents', { cacheKey });
      
      try {
        // Update status to show processing has started
        await dbService.updateStatus(requestId, 'ai_processing');
        
        const genTimer = logger.startTimer('document_generation');
        documents = await generateDocuments(body.transcript, body.context);
        const genDuration = genTimer();
        
        // Cache the result
        performanceOptimizer.setCachedResult(cacheKey, documents);
        performanceOptimizer.recordMetrics(genDuration, documents.metadata.tokensUsed || 0, false);
        logger.info('Documents generated successfully', { 
          duration: genDuration,
          tokensUsed: documents.metadata.tokensUsed 
        });
      
      const processingTime = Date.now() - startTime;
      
      // Store results in database with metadata
      const { error: storeError } = await dbService.storeResults(
        requestId,
        documents,
        {
          processingTime,
          tokensUsed: documents.metadata.tokensUsed,
          modelUsed: documents.metadata.modelUsed,
          generatedAt: documents.metadata.generatedAt,
          version: documents.metadata.version
        }
      );

      if (storeError) {
        logger.error('Failed to store results', storeError);
        // Continue anyway - we have the results to return
      }
      } catch (processingError) {
        logger.error('Document generation failed', processingError);
        performanceOptimizer.recordMetrics(Date.now() - startTime, 0, true);
        
        // Update status to failed
        await dbService.rollbackRequest(
          requestId,
          processingError instanceof Error ? processingError.message : 'Unknown error'
        );
      
        const errorResponse = {
          success: false,
          error: {
            code: 'PROCESSING_ERROR',
            message: 'Failed to generate documents',
            details: processingError instanceof Error ? processingError.message : undefined,
            retryable: true
          },
          requestId,
          timestamp: new Date().toISOString()
        } as ErrorResponse;
        
        logger.logResponse(500, errorResponse, Date.now() - startTime);
        return new Response(
          JSON.stringify(errorResponse),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }
    
    const processingTime = Date.now() - startTime;
    stopTimer();
    
    // Log success metrics
    logger.info('Request processed successfully', {
      requestId,
      processingTime,
      documentsGenerated: true
    });
    
    const successResponse = {
      success: true,
      data: {
        requestId,
        documents,
        processingTime
      }
    };
    
    logger.logResponse(200, successResponse, processingTime);
    
    // Log health metrics
    const health = logger.healthCheck();
    if (health.status !== 'healthy') {
      logger.warn('Service health degraded', health);
    }

    // Return success response
    return new Response(
      JSON.stringify(successResponse),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    logger.critical('Unexpected error in request handler', error);
    stopTimer();
    
    const criticalError = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        retryable: true
      },
      requestId,
      timestamp: new Date().toISOString()
    } as ErrorResponse;
    
    logger.logResponse(500, criticalError);
    
    return new Response(
      JSON.stringify(criticalError),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function checkRateLimit(clientIP: string): Promise<boolean> {
  const now = Date.now();
  const windowSize = 60 * 60 * 1000; // 1 hour
  const maxRequests = 100;

  const current = rateLimitMap.get(clientIP);
  
  if (!current || now > current.resetTime) {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + windowSize });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count++;
  return true;
}

function validateInput(body: TranscriptProcessRequest): { valid: boolean; error?: string } {
  if (!body.transcript || typeof body.transcript !== 'string') {
    return { valid: false, error: 'Transcript is required and must be a string' };
  }

  if (body.transcript.length > 50000) {
    return { valid: false, error: 'Transcript exceeds maximum length of 50,000 characters' };
  }

  if (!body.context || typeof body.context !== 'object') {
    return { valid: false, error: 'Context is required and must be an object' };
  }

  if (!body.context.name || !body.context.description) {
    return { valid: false, error: 'Context must include name and description' };
  }

  // Basic content filtering
  const sanitized = sanitizeInput(body.transcript);
  if (sanitized !== body.transcript) {
    return { valid: false, error: 'Transcript contains invalid content' };
  }

  return { valid: true };
}

function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

async function generateDocuments(transcript: string, context: ProjectContext): Promise<ProcessedDocuments> {
  const startTime = Date.now();
  const totalTokensUsed = 0;
  const totalCost = 0;

  try {
    // Check circuit breaker state before proceeding
    const circuitState = openaiClient.getCircuitBreakerState();
    if (circuitState.state === 'OPEN') {
      console.warn('Circuit breaker is open, waiting for recovery');
      // Could implement fallback strategy here
    }

    // Generate all documents in parallel for efficiency
    const results = await Promise.allSettled([
      generatePRD(transcript, context),
      generateUserStories(transcript, context),
      generateFunctionalSpecs(transcript, context),
      generateTaskList(transcript, context)
    ]);

    // Extract successful results and handle failures gracefully
    const prd = results[0].status === 'fulfilled' ? results[0].value : {
      title: 'PRD Generation Failed',
      content: 'Failed to generate PRD due to an error',
      sections: [],
      wordCount: 0,
      generatedAt: new Date().toISOString()
    };

    const userStories = results[1].status === 'fulfilled' ? results[1].value : [];
    const functionalSpecs = results[2].status === 'fulfilled' ? results[2].value : [];
    const taskList = results[3].status === 'fulfilled' ? results[3].value : [];

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const docType = ['PRD', 'User Stories', 'Functional Specs', 'Task List'][index];
        console.error(`Failed to generate ${docType}:`, result.reason);
      }
    });

    // Get rate limit state for monitoring
    const rateLimitState = openaiClient.getRateLimitState();
    console.log('Rate Limit State:', {
      requestsRemaining: rateLimitState.requestsRemaining,
      tokensRemaining: rateLimitState.tokensRemaining,
      resetTime: new Date(rateLimitState.resetTime).toISOString()
    });

    const processingTime = Date.now() - startTime;

    return {
      prd,
      userStories,
      functionalSpecs,
      taskList,
      metadata: {
        processingTime,
        tokensUsed: totalTokensUsed,
        modelUsed: 'gpt-4o',
        generatedAt: new Date().toISOString(),
        version: '1.0.0'
      }
    };
  } catch (error) {
    console.error('Document generation error:', error);
    
    // Check if it's a rate limit error and provide specific guidance
    if (error instanceof Error && error.message.includes('rate')) {
      throw new Error('Rate limit exceeded. Please try again in a few minutes.');
    }
    
    throw new Error('Failed to generate documents. Please try again.');
  }
}

async function generatePRD(transcript: string, context: ProjectContext): Promise<DocumentContent> {
  const systemPrompt = `You are a senior product manager creating comprehensive PRDs (Product Requirements Documents). 
Your responses should be professional, well-structured, and follow industry best practices.`;
  
  const prompt = `Create a comprehensive PRD based on the following meeting transcript.

TRANSCRIPT:
${transcript}

PROJECT CONTEXT:
Type: ${context.name}
Description: ${context.description}
${context.industry ? `Industry: ${context.industry}` : ''}
${context.techStack ? `Tech Stack: ${context.techStack.join(', ')}` : ''}

REQUIREMENTS:
1. Extract key features and requirements from the transcript
2. Structure as a professional PRD with:
   - Executive Summary
   - Problem Statement  
   - Solution Overview
   - Feature Requirements (detailed)
   - Success Metrics
   - Technical Considerations
   - Timeline and Milestones

OUTPUT FORMAT: Professional PRD document in markdown format with clear sections and bullet points.`;

  const config: OpenAIRequestConfig = {
    model: 'gpt-4o',
    systemPrompt,
    temperature: 0.7,
    maxTokens: 4000,
    enableLogging: true,
    metadata: { documentType: 'PRD', context: context.name }
  };

  const response = await openaiClient.createCompletion(prompt, config);
  
  if (!response.success || !response.data) {
    console.error('Failed to generate PRD:', response.error);
    throw new Error(`PRD generation failed: ${response.error?.message || 'Unknown error'}`);
  }

  const content = response.data;
  const sections = extractSections(content);

  // Log token usage for monitoring
  if (response.usage) {
    console.log(`PRD Generation - Tokens: ${response.usage.totalTokens}, Cost: $${response.usage.estimatedCost}`);
  }

  return {
    title: `PRD - ${context.name}`,
    content,
    sections,
    wordCount: content.split(' ').length,
    generatedAt: new Date().toISOString()
  };
}

async function generateUserStories(transcript: string, context: ProjectContext): Promise<UserStory[]> {
  const systemPrompt = `You are an Agile product manager expert in creating user stories. 
Always respond with valid JSON that can be parsed directly.`;
  
  const prompt = `Create detailed user stories from the following meeting transcript.

TRANSCRIPT:
${transcript}

PROJECT CONTEXT:
Type: ${context.name}
Description: ${context.description}

REQUIREMENTS:
1. Extract user stories from the transcript
2. Format each story as: "As a [user type], I want [goal] so that [benefit]"
3. Include acceptance criteria for each story
4. Assign priority (High/Medium/Low) and story points (1-13)
5. Group related stories under epics

OUTPUT FORMAT: Return ONLY a valid JSON array of user story objects with the following structure:
[{
  "id": "US001",
  "title": "Story title",
  "description": "As a user, I want...",
  "acceptanceCriteria": ["AC1", "AC2"],
  "priority": "High|Medium|Low",
  "storyPoints": 5,
  "epic": "Epic name"
}]`;

  const config: OpenAIRequestConfig = {
    model: 'gpt-4o',
    instructions: systemPrompt,
    temperature: 0.5, // Lower temperature for more consistent JSON
    maxTokens: 3000,
    enableLogging: true,
    metadata: { documentType: 'UserStories', context: context.name }
  };

  const response = await openaiClient.createCompletion(prompt, config);
  
  if (!response.success || !response.data) {
    console.error('Failed to generate user stories:', response.error);
    // Return empty array instead of throwing to allow partial document generation
    return [];
  }

  try {
    // Clean up response in case of markdown formatting
    const jsonStr = response.data.replace(/```json\n?|```\n?/g, '').trim();
    const stories = JSON.parse(jsonStr);
    
    // Validate structure
    if (!Array.isArray(stories)) {
      console.error('User stories response is not an array');
      return [];
    }
    
    return stories;
  } catch (error) {
    console.error('Failed to parse user stories JSON:', error);
    console.error('Raw response:', response.data);
    return [];
  }
}

async function generateFunctionalSpecs(transcript: string, context: ProjectContext): Promise<FunctionalSpec[]> {
  const systemPrompt = `You are a technical architect creating detailed functional specifications. 
Your responses must be valid JSON that can be parsed directly.`;
  
  const prompt = `Create functional specifications from the following meeting transcript.

TRANSCRIPT:
${transcript}

PROJECT CONTEXT:
Type: ${context.name}
Description: ${context.description}
${context.techStack ? `Tech Stack: ${context.techStack.join(', ')}` : ''}

REQUIREMENTS:
1. Extract functional requirements from the transcript
2. Create detailed specifications for each major component
3. Include technical requirements and constraints
4. Identify dependencies between components

OUTPUT FORMAT: Return ONLY a valid JSON array of functional specification objects:
[{
  "id": "FS001",
  "title": "Component name",
  "description": "Detailed description",
  "requirements": ["Req1", "Req2"],
  "technicalDetails": "Implementation details",
  "dependencies": ["Component1", "Component2"]
}]`;

  const config: OpenAIRequestConfig = {
    model: 'gpt-4o',
    systemPrompt,
    temperature: 0.5,
    maxTokens: 3000,
    enableLogging: true,
    metadata: { documentType: 'FunctionalSpecs', context: context.name }
  };

  const response = await openaiClient.createCompletion(prompt, config);
  
  if (!response.success || !response.data) {
    console.error('Failed to generate functional specs:', response.error);
    return [];
  }

  try {
    const jsonStr = response.data.replace(/```json\n?|```\n?/g, '').trim();
    const specs = JSON.parse(jsonStr);
    
    if (!Array.isArray(specs)) {
      console.error('Functional specs response is not an array');
      return [];
    }
    
    return specs;
  } catch (error) {
    console.error('Failed to parse functional specs JSON:', error);
    console.error('Raw response:', response.data);
    return [];
  }
}

async function generateTaskList(transcript: string, context: ProjectContext): Promise<Task[]> {
  const systemPrompt = `You are a project manager creating detailed task breakdowns. 
Your responses must be valid JSON that can be parsed directly.`;
  
  const prompt = `Create a prioritized task list from the following meeting transcript.

TRANSCRIPT:
${transcript}

PROJECT CONTEXT:
Type: ${context.name}
Description: ${context.description}

REQUIREMENTS:
1. Break down the project into specific, actionable tasks
2. Prioritize tasks (High/Medium/Low)
3. Estimate hours for each task
4. Identify dependencies between tasks
5. Categorize tasks (Development, Design, Testing, etc.)

OUTPUT FORMAT: Return ONLY a valid JSON array of task objects:
[{
  "id": "T001",
  "title": "Task title",
  "description": "Detailed task description",
  "priority": "High|Medium|Low",
  "estimatedHours": 8,
  "dependencies": ["T002", "T003"],
  "category": "Development|Design|Testing|Documentation"
}]`;

  const config: OpenAIRequestConfig = {
    model: 'gpt-4o',
    systemPrompt,
    temperature: 0.5,
    maxTokens: 3000,
    enableLogging: true,
    metadata: { documentType: 'TaskList', context: context.name }
  };

  const response = await openaiClient.createCompletion(prompt, config);
  
  if (!response.success || !response.data) {
    console.error('Failed to generate task list:', response.error);
    return [];
  }

  try {
    const jsonStr = response.data.replace(/```json\n?|```\n?/g, '').trim();
    const tasks = JSON.parse(jsonStr);
    
    if (!Array.isArray(tasks)) {
      console.error('Task list response is not an array');
      return [];
    }
    
    return tasks;
  } catch (error) {
    console.error('Failed to parse task list JSON:', error);
    console.error('Raw response:', response.data);
    return [];
  }
}

function extractSections(content: string): DocumentSection[] {
  const sections: DocumentSection[] = [];
  const lines = content.split('\n');
  let currentSection: DocumentSection | null = null;
  let order = 0;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        title: line.substring(3).trim(),
        content: '',
        order: order++
      };
    } else if (currentSection && line.trim()) {
      currentSection.content += line + '\n';
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}