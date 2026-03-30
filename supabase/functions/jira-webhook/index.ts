/**
 * JIRA Webhook Handler Edge Function
 *
 * Receives and processes JIRA webhook events for real-time synchronization.
 * Handles issue created, updated, and deleted events with idempotency and retry logic.
 *
 * @module jira-webhook
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { JiraDbService, DevTask } from '../_shared/jira-db-service.ts';

// ============================================================================
// Types
// ============================================================================

interface WebhookPayload {
  webhookEvent: string;
  issue?: {
    key: string;
    id: string;
    fields: {
      summary: string;
      description?: string;
      status?: {
        id: string;
        name: string;
      };
      priority?: {
        id: string;
        name: string;
      };
      issuetype?: {
        id: string;
        name: string;
      };
      labels?: string[];
      updated: string;
      [key: string]: unknown;
    };
  };
  changelog?: {
    items: Array<{
      field: string;
      fieldtype: string;
      from?: string;
      fromString?: string;
      to?: string;
      toString?: string;
    }>;
  };
  user?: {
    accountId: string;
    displayName: string;
    emailAddress?: string;
  };
  issue_event_type_name?: string;
  timestamp?: number;
}

interface WebhookHeaders {
  signature?: string;
  webhookId?: string;
  timestamp?: string;
}

interface EventProcessResult {
  success: boolean;
  taskId?: string;
  operation: 'create' | 'update' | 'delete' | 'skip';
  message: string;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SUPPORTED_EVENTS = {
  ISSUE_CREATED: 'jira:issue_created',
  ISSUE_UPDATED: 'jira:issue_updated',
  ISSUE_DELETED: 'jira:issue_deleted',
};

const STATUS_FIELD_MAPPING: Record<string, string> = {
  'To Do': 'todo',
  'In Progress': 'in_progress',
  'Done': 'done',
  'Blocked': 'blocked',
  'Cancelled': 'cancelled',
};

const PRIORITY_FIELD_MAPPING: Record<string, string> = {
  'Lowest': 'low',
  'Low': 'low',
  'Medium': 'medium',
  'High': 'high',
  'Highest': 'critical',
};

// ============================================================================
// Main Handler
// ============================================================================

const dbService = new JiraDbService();

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return formatErrorResponse(
        'METHOD_NOT_ALLOWED',
        'Only POST method is supported',
        requestId,
        405
      );
    }

    // Extract webhook headers
    const webhookHeaders: WebhookHeaders = {
      signature: req.headers.get('x-hub-signature-256') || req.headers.get('x-atlassian-webhook-identifier') || undefined,
      webhookId: req.headers.get('x-request-id') || req.headers.get('x-atlassian-webhook-identifier') || undefined,
      timestamp: req.headers.get('x-request-timestamp') || undefined,
    };

    // Get raw body for signature validation
    const rawBody = await req.text();
    let payload: WebhookPayload;

    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      return formatErrorResponse(
        'INVALID_PAYLOAD',
        'Failed to parse webhook payload',
        requestId,
        400
      );
    }

    console.log('Webhook received:', {
      requestId,
      webhookId: webhookHeaders.webhookId,
      event: payload.webhookEvent,
      issueKey: payload.issue?.key,
      timestamp: webhookHeaders.timestamp,
    });

    // Extract project ID from issue key (e.g., "PROJ-123" -> need to find by jira_project_key)
    if (!payload.issue?.key) {
      return formatErrorResponse(
        'MISSING_ISSUE_KEY',
        'Webhook payload missing issue key',
        requestId,
        400
      );
    }

    const jiraProjectKey = payload.issue.key.split('-')[0];

    // Get project config by JIRA project key
    const config = await getConfigByJiraProjectKey(jiraProjectKey);
    if (!config) {
      console.warn(`No configuration found for JIRA project: ${jiraProjectKey}`);
      return formatErrorResponse(
        'CONFIG_NOT_FOUND',
        `No active JIRA configuration found for project key: ${jiraProjectKey}`,
        requestId,
        404
      );
    }

    // Validate webhook signature if secret is configured
    if (config.webhook_secret) {
      const isValid = await validateWebhookSignature(
        rawBody,
        webhookHeaders.signature || '',
        config.webhook_secret
      );

      if (!isValid) {
        console.error('Invalid webhook signature:', {
          requestId,
          webhookId: webhookHeaders.webhookId,
        });
        return formatErrorResponse(
          'INVALID_SIGNATURE',
          'Webhook signature validation failed',
          requestId,
          401
        );
      }
    }

    // Check idempotency - prevent duplicate processing
    if (webhookHeaders.webhookId) {
      const isDuplicate = await checkIdempotency(
        config.project_id,
        webhookHeaders.webhookId
      );

      if (isDuplicate) {
        console.log('Duplicate webhook ignored:', {
          requestId,
          webhookId: webhookHeaders.webhookId,
        });
        return formatSuccessResponse(
          {
            success: true,
            operation: 'skip',
            message: 'Duplicate webhook event ignored',
          },
          requestId,
          Date.now() - startTime
        );
      }
    }

    // Process the webhook event
    const result = await processWebhookEvent(
      payload,
      config.project_id,
      webhookHeaders.webhookId
    );

    // Log the webhook processing
    await dbService.createSyncLog({
      project_id: config.project_id,
      task_id: result.taskId,
      jira_issue_key: payload.issue?.key,
      operation: result.operation === 'skip' ? 'update' : result.operation,
      direction: 'jira_to_dr',
      status: result.success ? 'success' : 'error',
      error_message: result.error,
      retry_count: 0,
    });

    return formatSuccessResponse(
      result,
      requestId,
      Date.now() - startTime
    );

  } catch (error) {
    console.error('Webhook processing error:', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return formatErrorResponse(
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Unknown error occurred',
      requestId,
      500
    );
  }
});

// ============================================================================
// Event Processing
// ============================================================================

async function processWebhookEvent(
  payload: WebhookPayload,
  projectId: string,
  webhookId?: string
): Promise<EventProcessResult> {
  const eventType = payload.webhookEvent;

  switch (eventType) {
    case SUPPORTED_EVENTS.ISSUE_CREATED:
      return await handleIssueCreated(payload, projectId);

    case SUPPORTED_EVENTS.ISSUE_UPDATED:
      return await handleIssueUpdated(payload, projectId);

    case SUPPORTED_EVENTS.ISSUE_DELETED:
      return await handleIssueDeleted(payload, projectId);

    default:
      console.log(`Unsupported event type: ${eventType}`);
      return {
        success: true,
        operation: 'skip',
        message: `Event type ${eventType} not supported`,
      };
  }
}

/**
 * Handle issue_created events
 * Creates a new DR task from the JIRA issue
 */
async function handleIssueCreated(
  payload: WebhookPayload,
  projectId: string
): Promise<EventProcessResult> {
  const issue = payload.issue;
  if (!issue) {
    return {
      success: false,
      operation: 'create',
      message: 'Missing issue data in payload',
      error: 'MISSING_ISSUE_DATA',
    };
  }

  try {
    // Check if task already exists for this JIRA issue
    const existingTask = await dbService.getTaskByJiraKey(issue.key, projectId);
    if (existingTask) {
      console.log(`Task already exists for JIRA issue ${issue.key}`);
      return {
        success: true,
        operation: 'skip',
        taskId: existingTask.id,
        message: 'Task already exists for this JIRA issue',
      };
    }

    // Map JIRA fields to DR task fields
    const taskData = mapJiraToTaskFields(issue, projectId);

    // Create new task in database (using direct insert since we don't have a createTask method)
    // Note: In production, this should use a proper task creation service
    const { data: newTask, error } = await dbService['supabase']
      .from('dev_tasks')
      .insert({
        ...taskData,
        jira_issue_key: issue.key,
        jira_sync_status: 'synced',
        last_jira_sync: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create task: ${error.message}`);
    }

    console.log(`Created task ${newTask.id} from JIRA issue ${issue.key}`);

    return {
      success: true,
      operation: 'create',
      taskId: newTask.id,
      message: `Created task from JIRA issue ${issue.key}`,
    };
  } catch (error) {
    console.error('Failed to handle issue_created:', error);
    return {
      success: false,
      operation: 'create',
      message: 'Failed to create task',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Handle issue_updated events
 * Updates existing DR task with JIRA changes
 */
async function handleIssueUpdated(
  payload: WebhookPayload,
  projectId: string
): Promise<EventProcessResult> {
  const issue = payload.issue;
  if (!issue) {
    return {
      success: false,
      operation: 'update',
      message: 'Missing issue data in payload',
      error: 'MISSING_ISSUE_DATA',
    };
  }

  try {
    // Find existing task
    const existingTask = await dbService.getTaskByJiraKey(issue.key, projectId);
    if (!existingTask) {
      console.log(`No task found for JIRA issue ${issue.key}, creating new task`);
      // Create task if it doesn't exist
      return await handleIssueCreated(payload, projectId);
    }

    // Determine which fields changed
    const changedFields = extractChangedFields(payload.changelog);
    console.log(`Issue ${issue.key} updated, changed fields:`, changedFields);

    // Map JIRA fields to DR task fields
    const taskUpdates = mapJiraToTaskFields(issue, projectId);

    // Update task in database
    const { data: updatedTask, error } = await dbService['supabase']
      .from('dev_tasks')
      .update({
        ...taskUpdates,
        jira_sync_status: 'synced',
        last_jira_sync: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingTask.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update task: ${error.message}`);
    }

    console.log(`Updated task ${existingTask.id} from JIRA issue ${issue.key}`);

    return {
      success: true,
      operation: 'update',
      taskId: existingTask.id,
      message: `Updated task from JIRA issue ${issue.key}`,
    };
  } catch (error) {
    console.error('Failed to handle issue_updated:', error);

    // Queue for retry if task exists
    const existingTask = await dbService.getTaskByJiraKey(issue.key, projectId);
    if (existingTask) {
      await queueForRetry(existingTask.id, issue.key, projectId, 'update', error);
    }

    return {
      success: false,
      operation: 'update',
      message: 'Failed to update task',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Handle issue_deleted events
 * Marks DR task as archived or deleted
 */
async function handleIssueDeleted(
  payload: WebhookPayload,
  projectId: string
): Promise<EventProcessResult> {
  const issue = payload.issue;
  if (!issue) {
    return {
      success: false,
      operation: 'delete',
      message: 'Missing issue data in payload',
      error: 'MISSING_ISSUE_DATA',
    };
  }

  try {
    // Find existing task
    const existingTask = await dbService.getTaskByJiraKey(issue.key, projectId);
    if (!existingTask) {
      console.log(`No task found for deleted JIRA issue ${issue.key}`);
      return {
        success: true,
        operation: 'skip',
        message: `No task found for JIRA issue ${issue.key}`,
      };
    }

    // Mark task as deleted (soft delete)
    const { error } = await dbService['supabase']
      .from('dev_tasks')
      .update({
        deleted_at: new Date().toISOString(),
        jira_sync_status: 'synced',
        last_jira_sync: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingTask.id);

    if (error) {
      throw new Error(`Failed to delete task: ${error.message}`);
    }

    console.log(`Soft deleted task ${existingTask.id} for JIRA issue ${issue.key}`);

    return {
      success: true,
      operation: 'delete',
      taskId: existingTask.id,
      message: `Archived task for deleted JIRA issue ${issue.key}`,
    };
  } catch (error) {
    console.error('Failed to handle issue_deleted:', error);

    return {
      success: false,
      operation: 'delete',
      message: 'Failed to delete task',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Field Mapping
// ============================================================================

function mapJiraToTaskFields(
  issue: WebhookPayload['issue'],
  projectId: string
): Partial<DevTask> {
  if (!issue) {
    throw new Error('Issue data is required');
  }

  const fields = issue.fields;

  return {
    project_id: projectId,
    title: fields.summary,
    description: fields.description || '',
    status: mapJiraStatusToDR(fields.status?.name),
    priority: mapJiraPriorityToDR(fields.priority?.name),
    tags: fields.labels || [],
  };
}

function mapJiraStatusToDR(jiraStatus?: string): string {
  if (!jiraStatus) return 'todo';
  return STATUS_FIELD_MAPPING[jiraStatus] || 'todo';
}

function mapJiraPriorityToDR(jiraPriority?: string): string {
  if (!jiraPriority) return 'medium';
  return PRIORITY_FIELD_MAPPING[jiraPriority] || 'medium';
}

function extractChangedFields(changelog?: WebhookPayload['changelog']): string[] {
  if (!changelog?.items) return [];
  return changelog.items.map(item => item.field);
}

// ============================================================================
// Security & Validation
// ============================================================================

async function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) {
    return false;
  }

  try {
    // JIRA uses HMAC-SHA256 for webhook signatures
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );

    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Remove 'sha256=' prefix if present
    const receivedSignature = signature.replace(/^sha256=/, '');

    return expectedSignature === receivedSignature;
  } catch (error) {
    console.error('Signature validation error:', error);
    return false;
  }
}

async function checkIdempotency(
  projectId: string,
  webhookId: string
): Promise<boolean> {
  try {
    // Check if we've already processed this webhook ID
    const { data, error } = await dbService['supabase']
      .from('jira_sync_log')
      .select('id')
      .eq('project_id', projectId)
      .eq('error_message', `webhook_id:${webhookId}`)
      .limit(1);

    if (error) {
      console.error('Idempotency check error:', error);
      return false;
    }

    // If we found a record, this is a duplicate
    return data && data.length > 0;
  } catch (error) {
    console.error('Idempotency check error:', error);
    return false;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getConfigByJiraProjectKey(jiraProjectKey: string) {
  try {
    const { data, error } = await dbService['supabase']
      .from('jira_sync_config')
      .select('*')
      .eq('jira_project_key', jiraProjectKey)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to get config by JIRA project key:', error);
    return null;
  }
}

async function queueForRetry(
  taskId: string,
  jiraIssueKey: string,
  projectId: string,
  operation: 'create' | 'update' | 'delete',
  error: unknown
) {
  try {
    await dbService.createSyncLog({
      project_id: projectId,
      task_id: taskId,
      jira_issue_key: jiraIssueKey,
      operation,
      direction: 'jira_to_dr',
      status: 'pending',
      error_message: error instanceof Error ? error.message : String(error),
      retry_count: 0,
    });
    console.log(`Queued for retry: task ${taskId}, issue ${jiraIssueKey}`);
  } catch (logError) {
    console.error('Failed to queue for retry:', logError);
  }
}

// ============================================================================
// Response Formatting
// ============================================================================

function formatSuccessResponse(
  data: EventProcessResult,
  requestId: string,
  processingTime: number
) {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      metadata: {
        requestId,
        processingTime,
        timestamp: new Date().toISOString(),
      },
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

function formatErrorResponse(
  code: string,
  message: string,
  requestId: string,
  status: number = 400
) {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code,
        message,
      },
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}
