import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { getOpenAIClient } from "../process-transcript/openai-client.ts"

interface RequestBody {
  transcript: string
  prompt: string
  documentTypes?: string[]
  projectContext?: string
  previousResponseId?: string // Support for conversation continuity with Responses API
}

interface GeneratedDocuments {
  prd: string
  userStories: string
  specs: string
  tasks: string
}

interface ResponseData {
  success: boolean
  documents?: GeneratedDocuments
  responseId?: string // For future previous_response_id usage
  error?: string
}

// Get OpenAI client with robust error handling
const openaiClient = getOpenAIClient()

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      throw new Error('Method not allowed')
    }

    // Parse request body
    const body: RequestBody = await req.json()

    // Validate required fields
    if (!body.transcript?.trim()) {
      throw new Error('Transcript is required')
    }

    if (!body.prompt?.trim()) {
      throw new Error('Prompt is required')
    }

    // Prepare the context section if project context is provided
    let contextSection = ''
    if (body.projectContext) {
      contextSection = `
PROJECT CONTEXT:
${body.projectContext}

Consider the above project context when generating the documents. The technical decisions, architecture, and requirements should align with the project's existing structure and patterns.

`
    }

    // Prepare the complete input for OpenAI Responses API
    const input = `You are a specialized assistant for generating technical documentation from meeting transcriptions.

CRITICAL INSTRUCTIONS:
- Return ONLY a valid JSON object, nothing else
- JSON must have exactly these keys: "prd", "userStories", "specs", "tasks"
- Each value should be a string containing Markdown content
- Use proper JSON escaping for quotes and newlines
- Do NOT include any explanations, comments, or text outside the JSON
- Ensure all JSON braces and quotes are properly closed
- Follow standard JSON format with no trailing commas

Response format example:
{
  "prd": "# Product Requirements Document\\n\\nContent here...",
  "userStories": "# User Stories\\n\\nContent here...",
  "specs": "# Technical Specifications\\n\\nContent here...",
  "tasks": "# Implementation Tasks\\n\\nContent here..."
}

${body.prompt}
${contextSection}
Be specific and detailed based on the meeting transcript content.
Use appropriate Markdown formatting (headers, lists, code, etc).
Follow the prompt instructions above precisely.
${body.projectContext ? 'Align with the project context provided above.' : ''}

Meeting transcript:
${body.transcript}`

    // Log conversation context for debugging
    if (body.previousResponseId) {
      console.log(`Continuing conversation from: ${body.previousResponseId}`)
    }

    // Use OpenAI client with built-in retry logic and error handling
    console.log('Calling OpenAI Responses API...')

    const response = await openaiClient.createCompletion(input, {
      model: 'gpt-4o',
      temperature: 0.7,
      maxOutputTokens: 4000,
      
      enableLogging: true,
      // requestId: crypto.randomUUID(),
      metadata: {
        previousResponseId: body.previousResponseId,
        operation: 'generate-documents'
      }
    })

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to generate documents')
    }

    console.log('Received response from OpenAI, parsing JSON...')

    // Parse and validate the response
    const documents = JSON.parse(response.data) as GeneratedDocuments

    // Validate all required fields are present
    if (!documents.prd || !documents.userStories || !documents.specs || !documents.tasks) {
      throw new Error('Incomplete documents in response')
    }

    // Return successful response in expected format
    const responseData: ResponseData = {
      success: true,
      documents,
      responseId: response.requestId // Use request ID for future reference
    }

    return new Response(
      JSON.stringify(responseData),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)

    // Determine error status code
    let statusCode = 500
    if (error?.status) {
      statusCode = error.status
    } else if (error?.message?.includes('Method not allowed')) {
      statusCode = 405
    } else if (error?.message?.includes('required')) {
      statusCode = 400
    }

    // Return error response
    const responseData: ResponseData = {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }

    return new Response(
      JSON.stringify(responseData),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: statusCode,
      }
    )
  }
})