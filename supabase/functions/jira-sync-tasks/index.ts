/**
 * JIRA Sync Tasks Edge Function
 *
 * Main synchronization endpoint for bidirectional sync between DR_AI tasks and JIRA issues.
 * Supports single task sync, bulk operations, and conflict resolution.
 *
 * @module jira-sync-tasks
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { JiraClient, JiraIssue, JiraClientError } from '../_shared/jira-client.ts';
import { JiraDbService, DevTask, JiraSyncConfig } from '../_shared/jira-db-service.ts';
import { BatchProcessor, SmartBatchProcessor, BatchProgress, BatchItemError } from '../_shared/batch-processor.ts';
import { ProgressTracker } from './progress-tracker.ts';
import {
  SyncTaskRequest,
  SyncTaskResponse,
  SyncResult,
  BulkSyncResult,
  SyncError,
  ConflictInfo,
  FieldMappingConfig,
  ValidationResult,
  ProgressRequest,
  ProgressResponse,
  CancellationStatus,
} from './types.ts';

const dbService = new JiraDbService();
const progressTracker = new ProgressTracker(dbService);

// Store cancellation tokens in memory
const cancellationTokens = new Map<string, CancellationStatus>();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    if (req.method !== 'POST') {
      return formatErrorResponse(
        'METHOD_NOT_ALLOWED',
        'Only POST method is supported',
        requestId,
        405
      );
    }

    const body: SyncTaskRequest = await req.json();

    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      return formatErrorResponse(
        'INVALID_INPUT',
        validation.error!,
        requestId,
        400
      );
    }

    console.log('JIRA sync request:', {
      requestId,
      operation: body.operation,
      projectId: body.projectId,
      taskCount: body.taskIds?.length || (body.taskId ? 1 : 0),
    });

    // Get JIRA configuration
    const config = await dbService.getConfig(body.projectId);
    if (!config) {
      return formatErrorResponse(
        'CONFIG_NOT_FOUND',
        'JIRA sync configuration not found for this project',
        requestId,
        404
      );
    }

    if (!config.is_active) {
      return formatErrorResponse(
        'CONFIG_INACTIVE',
        'JIRA sync is not active for this project',
        requestId,
        400
      );
    }

    // Initialize JIRA client
    console.log('[JIRA Config Debug]', {
      baseUrl: config.jira_url,
      email: config.jira_email,
      projectKey: config.jira_project_key,
      hasApiToken: !!config.api_token_encrypted,
      apiTokenLength: config.api_token_encrypted?.length || 0,
      apiTokenPreview: config.api_token_encrypted ? `${config.api_token_encrypted.substring(0, 10)}...` : 'MISSING',
    });

    if (!config.jira_email) {
      return formatErrorResponse(
        'CONFIG_INVALID',
        'JIRA email is not configured. Please update jira_sync_config with a valid jira_email.',
        requestId,
        400
      );
    }

    if (!config.api_token_encrypted) {
      return formatErrorResponse(
        'CONFIG_INVALID',
        'JIRA API token is not configured.',
        requestId,
        400
      );
    }

    const jiraClient = new JiraClient({
      baseUrl: config.jira_url,
      apiToken: config.api_token_encrypted,
      email: config.jira_email,
      projectKey: config.jira_project_key,
    });

    // Get field mapping
    let fieldMapping: FieldMappingConfig | null = null;
    if (config.field_mapping_id) {
      const mapping = await dbService.getFieldMapping(config.field_mapping_id);
      if (mapping) {
        fieldMapping = {
          dr_to_jira: mapping.dr_to_jira,
          jira_to_dr: mapping.jira_to_dr,
        };
      }
    }

    // Use default field mapping if none configured
    if (!fieldMapping) {
      fieldMapping = getDefaultFieldMapping();
    }

    // Execute sync operation
    let result;
    switch (body.operation) {
      case 'sync-to-jira':
        if (body.taskId) {
          result = await syncTaskToJira(
            body.taskId,
            body.projectId,
            jiraClient,
            fieldMapping,
            body.conflictResolution || 'last-write-wins',
            body.createIfNotExists || true,
            config.default_issue_type || 'Task'
          );
        } else {
          return formatErrorResponse(
            'INVALID_INPUT',
            'taskId is required for sync-to-jira operation',
            requestId,
            400
          );
        }
        break;

      case 'sync-from-jira':
        if (body.taskId) {
          result = await syncTaskFromJira(
            body.taskId,
            body.projectId,
            jiraClient,
            fieldMapping,
            body.conflictResolution || 'last-write-wins'
          );
        } else {
          return formatErrorResponse(
            'INVALID_INPUT',
            'taskId is required for sync-from-jira operation',
            requestId,
            400
          );
        }
        break;

      case 'bulk-sync':
      case 'batch-sync':
        if (!body.taskIds || body.taskIds.length === 0) {
          return formatErrorResponse(
            'INVALID_INPUT',
            'taskIds array is required for bulk-sync operation',
            requestId,
            400
          );
        }

        // Use enhanced bulk sync if batch config provided
        if (body.batchConfig || body.progressTracking) {
          result = await enhancedBulkSync(
            body.taskIds,
            body.projectId,
            jiraClient,
            fieldMapping,
            body.conflictResolution || 'last-write-wins',
            body.createIfNotExists || true,
            config.default_issue_type || 'Task',
            body.batchConfig,
            body.progressTracking || false,
            body.operationId || requestId,
            body.cancellationToken
          );
        } else {
          // Legacy bulk sync for backward compatibility
          result = await bulkSyncTasks(
            body.taskIds,
            body.projectId,
            jiraClient,
            fieldMapping,
            body.conflictResolution || 'last-write-wins',
            body.createIfNotExists || true,
            config.default_issue_type || 'Task'
          );
        }
        break;

      case 'scheduled-sync':
        // Scheduled sync operation for cron jobs
        // Syncs all tasks in a project based on direction parameter
        result = await scheduledProjectSync(
          body.projectId,
          jiraClient,
          fieldMapping,
          body.direction || 'to-jira',
          body.conflictResolution || 'last-write-wins',
          body.createIfNotExists !== false,
          config.default_issue_type || 'Task',
          body.batchConfig,
          body.progressTracking || false,
          requestId,
          body.filters
        );
        break;

      case 'cancel-operation':
        if (!body.operationId) {
          return formatErrorResponse(
            'INVALID_INPUT',
            'operationId is required for cancel-operation',
            requestId,
            400
          );
        }
        result = await cancelOperation(body.operationId);
        break;

      case 'get-progress':
        const progressReq = body as unknown as ProgressRequest;
        result = await getProgress(progressReq);
        break;

      default:
        return formatErrorResponse(
          'INVALID_INPUT',
          `Unknown operation: ${body.operation}`,
          requestId,
          400
        );
    }

    const processingTime = Date.now() - startTime;
    console.log('Sync completed:', {
      requestId,
      operation: body.operation,
      processingTime,
    });

    const response: SyncTaskResponse = {
      success: true,
      data: result,
      metadata: {
        processingTime,
        requestId,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Processing-Time-Ms': processingTime.toString(),
      },
    });

  } catch (error) {
    console.error('Sync error:', error);

    let errorCode = 'INTERNAL_ERROR';
    let statusCode = 500;

    if (error instanceof JiraClientError) {
      errorCode = 'JIRA_API_ERROR';
      statusCode = error.statusCode || 500;
    }

    return formatErrorResponse(
      errorCode,
      error instanceof Error ? error.message : 'An unexpected error occurred',
      requestId,
      statusCode,
      error
    );
  }
});

/**
 * Sync a single task to JIRA
 */
async function syncTaskToJira(
  taskId: string,
  projectId: string,
  jiraClient: JiraClient,
  fieldMapping: FieldMappingConfig,
  conflictResolution: string,
  createIfNotExists: boolean,
  defaultIssueType: string = 'Task'
): Promise<SyncResult> {
  const logId = crypto.randomUUID();

  try {
    // Get task from database
    const task = await dbService.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (task.project_id !== projectId) {
      throw new Error('Task does not belong to the specified project');
    }

    // Log sync operation start
    await dbService.createSyncLog({
      project_id: projectId,
      task_id: taskId,
      jira_issue_key: task.jira_issue_key,
      operation: task.jira_issue_key ? 'update' : 'create',
      direction: 'dr_to_jira',
      status: 'pending',
    });

    let jiraIssue: JiraIssue;
    let operation: 'created' | 'updated' | 'no-change';

    if (task.jira_issue_key) {
      // Update existing JIRA issue
      try {
        const existingIssue = await jiraClient.getIssue(task.jira_issue_key);
        const conflicts = detectConflicts(task, existingIssue, fieldMapping);

        // Apply conflict resolution
        const issueUpdate = mapTaskToJiraUpdate(task, fieldMapping, conflicts, conflictResolution);

        if (Object.keys(issueUpdate.fields || {}).length > 0) {
          await jiraClient.updateIssue(task.jira_issue_key, issueUpdate);
          operation = 'updated';
        } else {
          operation = 'no-change';
        }

        jiraIssue = existingIssue;
      } catch (error) {
        if (createIfNotExists) {
          // Issue doesn't exist in JIRA, create it
          const issueData = mapTaskToJiraIssue(task, fieldMapping, jiraClient, defaultIssueType);
          jiraIssue = await jiraClient.createIssue(issueData);
          operation = 'created';

          // Update task with new JIRA key
          await dbService.updateTaskJiraData(taskId, {
            jira_issue_key: jiraIssue.key,
            jira_sync_status: 'synced',
            last_jira_sync: new Date().toISOString(),
          });
        } else {
          throw error;
        }
      }
    } else {
      // Create new JIRA issue
      const issueData = mapTaskToJiraIssue(task, fieldMapping, jiraClient, defaultIssueType);
      jiraIssue = await jiraClient.createIssue(issueData);
      operation = 'created';

      // Update task with JIRA key
      await dbService.updateTaskJiraData(taskId, {
        jira_issue_key: jiraIssue.key,
        jira_sync_status: 'synced',
        last_jira_sync: new Date().toISOString(),
      });
    }

    // Update sync log
    await dbService.createSyncLog({
      project_id: projectId,
      task_id: taskId,
      jira_issue_key: jiraIssue.key,
      operation: operation === 'created' ? 'create' : 'update',
      direction: 'dr_to_jira',
      status: 'success',
    });

    return {
      taskId,
      jiraIssueKey: jiraIssue.key!,
      operation,
      syncedFields: Object.keys(fieldMapping.dr_to_jira),
    };

  } catch (error) {
    const syncLog: any = {
      project_id: projectId,
      task_id: taskId,
      operation: 'sync',
      direction: 'dr_to_jira',
      status: 'error',
      error_message: error instanceof Error ? error.message : 'Unknown error',
    };

    if (error instanceof JiraClientError) {
      if (error.apiRequest) {
        syncLog.jira_api_request = error.apiRequest;
      }
      if (error.apiResponse) {
        syncLog.jira_api_response = error.apiResponse;
      }
    }

    await dbService.createSyncLog(syncLog);

    throw error;
  }
}

/**
 * Sync a single task from JIRA
 */
async function syncTaskFromJira(
  taskId: string,
  projectId: string,
  jiraClient: JiraClient,
  fieldMapping: FieldMappingConfig,
  conflictResolution: string
): Promise<SyncResult> {
  try {
    const task = await dbService.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (!task.jira_issue_key) {
      throw new Error('Task has no associated JIRA issue');
    }

    // Get JIRA issue
    const jiraIssue = await jiraClient.getIssue(task.jira_issue_key);

    // Map JIRA data to task update
    const taskUpdate = mapJiraToTask(jiraIssue, fieldMapping);

    // Update task
    await dbService.updateTaskJiraData(taskId, {
      ...taskUpdate,
      jira_sync_status: 'synced',
      last_jira_sync: new Date().toISOString(),
    });

    // Log sync
    await dbService.createSyncLog({
      project_id: projectId,
      task_id: taskId,
      jira_issue_key: task.jira_issue_key,
      operation: 'update',
      direction: 'jira_to_dr',
      status: 'success',
    });

    return {
      taskId,
      jiraIssueKey: task.jira_issue_key,
      operation: 'updated',
      syncedFields: Object.keys(fieldMapping.jira_to_dr),
    };

  } catch (error) {
    await dbService.createSyncLog({
      project_id: projectId,
      task_id: taskId,
      operation: 'sync',
      direction: 'jira_to_dr',
      status: 'error',
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}

/**
 * Bulk sync multiple tasks
 */
async function bulkSyncTasks(
  taskIds: string[],
  projectId: string,
  jiraClient: JiraClient,
  fieldMapping: FieldMappingConfig,
  conflictResolution: string,
  createIfNotExists: boolean,
  defaultIssueType: string = 'Task'
): Promise<BulkSyncResult> {
  const results: SyncResult[] = [];
  const errors: SyncError[] = [];

  for (const taskId of taskIds) {
    try {
      const result = await syncTaskToJira(
        taskId,
        projectId,
        jiraClient,
        fieldMapping,
        conflictResolution,
        createIfNotExists,
        defaultIssueType
      );
      results.push(result);
    } catch (error) {
      errors.push({
        taskId,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: error instanceof JiraClientError ? error.statusCode?.toString() : undefined,
      });
    }
  }

  return {
    totalTasks: taskIds.length,
    successful: results.length,
    failed: errors.length,
    results,
    errors,
  };
}

/**
 * Map DR task to JIRA issue format
 * Uses issue type IDs for reliable API compatibility across different JIRA configurations
 */
function mapTaskToJiraIssue(
  task: DevTask,
  fieldMapping: FieldMappingConfig,
  jiraClient: JiraClient,
  defaultIssueType: string = '10004' // Default to Tarefa (Task) ID
): JiraIssue {
  const mapping = fieldMapping.dr_to_jira;

  // Determine issue type ID: use task_type mapping if available, otherwise use default
  let issueTypeId = defaultIssueType;
  if (task.task_type && mapping.task_type) {
    const mappedType = mapping.task_type[task.task_type];
    if (mappedType) {
      issueTypeId = mappedType;
    }
  }

  return {
    fields: {
      project: {
        key: jiraClient['projectKey'],
      },
      summary: task.title,
      description: convertToAtlassianDocumentFormat(task.description || ''),
      issuetype: {
        id: issueTypeId,
      },
      priority: mapping.priority && task.priority
        ? { name: mapping.priority[task.priority] || task.priority }
        : undefined,
      labels: task.tags || [],
    },
  };
}

/**
 * Map DR task to JIRA issue update format
 */
function mapTaskToJiraUpdate(
  task: DevTask,
  fieldMapping: FieldMappingConfig,
  conflicts: ConflictInfo[],
  conflictResolution: string
): { fields: Partial<JiraIssue['fields']> } {
  const mapping = fieldMapping.dr_to_jira;
  const fields: Partial<JiraIssue['fields']> = {};

  if (conflictResolution === 'dr-wins' || conflictResolution === 'last-write-wins') {
    fields.summary = task.title;
    if (task.description) {
      fields.description = convertToAtlassianDocumentFormat(task.description);
    }
    if (task.tags) fields.labels = task.tags;
  }

  return { fields };
}

/**
 * Map JIRA issue to DR task format
 */
function mapJiraToTask(
  jiraIssue: JiraIssue,
  fieldMapping: FieldMappingConfig
): Partial<DevTask> {
  const mapping = fieldMapping.jira_to_dr;

  return {
    title: jiraIssue.fields.summary,
    description: jiraIssue.fields.description,
    // Additional field mappings can be added here
  };
}

/**
 * Detect conflicts between DR task and JIRA issue
 */
function detectConflicts(
  task: DevTask,
  jiraIssue: JiraIssue,
  fieldMapping: FieldMappingConfig
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];

  // Check title/summary conflict
  if (task.title !== jiraIssue.fields.summary) {
    conflicts.push({
      field: 'title',
      drValue: task.title,
      jiraValue: jiraIssue.fields.summary,
      resolution: 'dr',
    });
  }

  // Check description conflict
  if (task.description !== jiraIssue.fields.description) {
    conflicts.push({
      field: 'description',
      drValue: task.description,
      jiraValue: jiraIssue.fields.description,
      resolution: 'dr',
    });
  }

  return conflicts;
}

/**
 * Get default field mapping
 * Note: Issue type IDs are specific to the DRS project configuration
 * Available types: Epic (10001), Subtask (10002), Nova Funcionalidade (10003),
 *                  Tarefa (10004), Story (10005), Bug (10006), Melhoria (10007)
 */
function getDefaultFieldMapping(): FieldMappingConfig {
  return {
    dr_to_jira: {
      title: 'summary',
      description: 'description',
      status: {
        todo: 'To Do',
        in_progress: 'In Progress',
        done: 'Done',
        blocked: 'Blocked',
      },
      priority: {
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        critical: 'Highest',
      },
      task_type: {
        feature: '10005',      // Story
        bug: '10006',          // Bug
        enhancement: '10004',  // Tarefa
        technical_debt: '10004', // Tarefa
        research: '10004',     // Tarefa
        documentation: '10004', // Tarefa
        testing: '10004',      // Tarefa
        refactor: '10004',     // Tarefa
        deployment: '10004',   // Tarefa
        maintenance: '10004',  // Tarefa
      },
      tags: 'labels',
    },
    jira_to_dr: {
      summary: 'title',
      description: 'description',
      status: {
        'To Do': 'todo',
        'In Progress': 'in_progress',
        'Done': 'done',
        'Blocked': 'blocked',
      },
      priority: {
        'Low': 'low',
        'Medium': 'medium',
        'High': 'high',
        'Highest': 'critical',
      },
      issuetype: {
        'Story': 'feature',
        'Bug': 'bug',
        'Task': 'enhancement',
        'Epic': 'feature',
        'Sub-task': 'enhancement',
      },
      labels: 'tags',
    },
  };
}

/**
 * Scheduled project-wide sync operation
 *
 * Synchronizes all tasks in a project without requiring taskIds parameter.
 * Designed for cron-based scheduled synchronization.
 *
 * @param projectId - The project to sync
 * @param jiraClient - Initialized JIRA client
 * @param fieldMapping - Field mapping configuration
 * @param direction - Sync direction: 'to-jira' | 'from-jira' | 'bidirectional'
 * @param conflictResolution - Conflict resolution strategy
 * @param createIfNotExists - Create JIRA issues if they don't exist
 * @param batchConfig - Batch processing configuration
 * @param progressTracking - Enable progress tracking
 * @param operationId - Operation ID for tracking
 * @param filters - Optional filters for task selection
 */
async function scheduledProjectSync(
  projectId: string,
  jiraClient: JiraClient,
  fieldMapping: FieldMappingConfig,
  direction: 'to-jira' | 'from-jira' | 'bidirectional',
  conflictResolution: string,
  createIfNotExists: boolean,
  defaultIssueType: string = 'Task',
  batchConfig?: any,
  progressTracking: boolean = false,
  operationId?: string,
  filters?: {
    status?: string[];
    syncStatus?: string[];
    hasJiraIssue?: boolean;
  }
): Promise<{
  direction: string;
  toJiraResults?: BulkSyncResult;
  fromJiraResults?: BulkSyncResult;
  summary: {
    totalTasksProcessed: number;
    successfulSyncs: number;
    failedSyncs: number;
    skippedTasks: number;
  };
}> {
  const startTime = Date.now();
  const opId = operationId || crypto.randomUUID();

  console.log('Starting scheduled project sync:', {
    projectId,
    direction,
    operationId: opId,
    filters,
    // Enhanced temporal filter logging for operational visibility
    temporalFilter: filters?.updatedSince
      ? `Tasks updated since ${filters.updatedSince}`
      : 'No temporal filter (full sync)',
    excludedStatuses: filters?.excludeStatuses || [],
    syncMode: filters?.updatedSince ? 'incremental' : 'full',
  });

  let toJiraResults: BulkSyncResult | undefined;
  let fromJiraResults: BulkSyncResult | undefined;

  // Sync DR tasks to JIRA
  if (direction === 'to-jira' || direction === 'bidirectional') {
    // Get all tasks that need syncing to JIRA
    const tasksToSync = await dbService.getTasks(projectId, {
      ...filters,
      // Only sync tasks that have jira_sync_enabled (if not filtered out)
    });

    console.log(`Found ${tasksToSync.length} tasks to sync to JIRA`);

    if (tasksToSync.length > 0) {
      const taskIds = tasksToSync.map(t => t.id);

      // Use enhanced bulk sync for better performance
      toJiraResults = await enhancedBulkSync(
        taskIds,
        projectId,
        jiraClient,
        fieldMapping,
        conflictResolution,
        createIfNotExists,
        defaultIssueType,
        batchConfig || {
          batchSize: 10,
          maxConcurrency: 3,
          continueOnError: true,
          retryFailedItems: true,
        },
        progressTracking,
        `${opId}-to-jira`,
        undefined
      );
    } else {
      toJiraResults = {
        totalTasks: 0,
        successful: 0,
        failed: 0,
        results: [],
        errors: [],
      };
    }
  }

  // Sync JIRA issues to DR tasks
  if (direction === 'from-jira' || direction === 'bidirectional') {
    // Get all tasks that have JIRA issue keys (linked tasks)
    const linkedTasks = await dbService.getTasks(projectId, {
      ...filters,
      hasJiraIssue: true,
    });

    console.log(`Found ${linkedTasks.length} tasks to sync from JIRA`);

    if (linkedTasks.length > 0) {
      const taskIds = linkedTasks.map(t => t.id);

      // Sync from JIRA for each task
      const results: SyncResult[] = [];
      const errors: SyncError[] = [];

      for (const taskId of taskIds) {
        try {
          const result = await syncTaskFromJira(
            taskId,
            projectId,
            jiraClient,
            fieldMapping,
            conflictResolution
          );
          results.push(result);
        } catch (error) {
          errors.push({
            taskId,
            error: error instanceof Error ? error.message : 'Unknown error',
            code: error instanceof JiraClientError ? error.statusCode?.toString() : undefined,
          });
        }
      }

      fromJiraResults = {
        totalTasks: taskIds.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors,
      };
    } else {
      fromJiraResults = {
        totalTasks: 0,
        successful: 0,
        failed: 0,
        results: [],
        errors: [],
      };
    }
  }

  // Calculate summary
  const summary = {
    totalTasksProcessed:
      (toJiraResults?.totalTasks || 0) + (fromJiraResults?.totalTasks || 0),
    successfulSyncs:
      (toJiraResults?.successful || 0) + (fromJiraResults?.successful || 0),
    failedSyncs:
      (toJiraResults?.failed || 0) + (fromJiraResults?.failed || 0),
    skippedTasks: 0, // Can be enhanced based on filters
  };

  const processingTime = Date.now() - startTime;

  console.log('Scheduled sync completed:', {
    projectId,
    direction,
    operationId: opId,
    summary,
    processingTime,
  });

  // Log scheduled sync operation
  await dbService.createSyncLog({
    project_id: projectId,
    operation: 'sync',
    direction: direction === 'to-jira' ? 'dr_to_jira' :
               direction === 'from-jira' ? 'jira_to_dr' :
               'dr_to_jira', // Default for bidirectional
    status: summary.failedSyncs === 0 ? 'success' :
            summary.successfulSyncs > 0 ? 'success' : 'error',
    error_message: summary.failedSyncs > 0
      ? `Scheduled sync completed with ${summary.failedSyncs} failures`
      : undefined,
  });

  return {
    direction,
    toJiraResults,
    fromJiraResults,
    summary,
  };
}

/**
 * Validate sync request
 */
function validateRequest(request: SyncTaskRequest): ValidationResult {
  if (!request.operation) {
    return { valid: false, error: 'operation is required' };
  }

  if (!request.projectId) {
    return { valid: false, error: 'projectId is required' };
  }

  if (!isValidUUID(request.projectId)) {
    return { valid: false, error: 'projectId must be a valid UUID' };
  }

  if (request.taskId && !isValidUUID(request.taskId)) {
    return { valid: false, error: 'taskId must be a valid UUID' };
  }

  if (request.taskIds) {
    for (const id of request.taskIds) {
      if (!isValidUUID(id)) {
        return { valid: false, error: `Invalid UUID in taskIds: ${id}` };
      }
    }
  }

  // Validate temporal filters for scheduled-sync operations
  if (request.filters?.updatedSince) {
    const timestamp = new Date(request.filters.updatedSince);
    if (isNaN(timestamp.getTime())) {
      return { valid: false, error: 'filters.updatedSince must be a valid ISO 8601 timestamp' };
    }

    // For scheduled-sync operations, restrict to last 30 days
    // This prevents expensive full-table scans and encourages proper full sync usage
    if (request.operation === 'scheduled-sync') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (timestamp < thirtyDaysAgo) {
        return {
          valid: false,
          error: 'filters.updatedSince cannot be older than 30 days (use scheduled-sync without filters for full sync)',
        };
      }
    }
  }

  // Validate excludeStatuses is an array if provided
  if (request.filters?.excludeStatuses !== undefined) {
    if (!Array.isArray(request.filters.excludeStatuses)) {
      return { valid: false, error: 'filters.excludeStatuses must be an array of status strings' };
    }
  }

  return { valid: true };
}

/**
 * Validate UUID format
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Convert plain text/markdown to Atlassian Document Format (ADF)
 */
function convertToAtlassianDocumentFormat(text: string): any {
  if (!text) {
    return {
      type: 'doc',
      version: 1,
      content: [],
    };
  }

  const lines = text.split('\n');
  const content: any[] = [];
  let currentList: any = null;
  let currentListItems: any[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      if (currentList) {
        currentList.content = currentListItems;
        content.push(currentList);
        currentList = null;
        currentListItems = [];
      }
      continue;
    }

    if (trimmedLine.startsWith('## ')) {
      if (currentList) {
        currentList.content = currentListItems;
        content.push(currentList);
        currentList = null;
        currentListItems = [];
      }
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: trimmedLine.substring(3) }],
      });
    } else if (trimmedLine.startsWith('# ')) {
      if (currentList) {
        currentList.content = currentListItems;
        content.push(currentList);
        currentList = null;
        currentListItems = [];
      }
      content.push({
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: trimmedLine.substring(2) }],
      });
    } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      const itemText = trimmedLine.substring(2);

      if (!currentList) {
        currentList = {
          type: 'bulletList',
          content: [],
        };
      }

      currentListItems.push({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: itemText }],
          },
        ],
      });
    } else {
      if (currentList) {
        currentList.content = currentListItems;
        content.push(currentList);
        currentList = null;
        currentListItems = [];
      }

      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: trimmedLine }],
      });
    }
  }

  if (currentList) {
    currentList.content = currentListItems;
    content.push(currentList);
  }

  return {
    type: 'doc',
    version: 1,
    content,
  };
}

/**
 * Enhanced bulk sync with parallel processing and progress tracking
 */
async function enhancedBulkSync(
  taskIds: string[],
  projectId: string,
  jiraClient: JiraClient,
  fieldMapping: FieldMappingConfig,
  conflictResolution: string,
  createIfNotExists: boolean,
  defaultIssueType: string = 'Task',
  batchConfig?: any,
  progressTracking: boolean = false,
  operationId?: string,
  cancellationToken?: string
): Promise<BulkSyncResult> {
  const opId = operationId || crypto.randomUUID();
  const startTime = Date.now();

  // Initialize progress tracking if enabled
  if (progressTracking) {
    await progressTracker.initializeProgress(
      opId,
      projectId,
      taskIds.length,
      'batch-sync',
      { batchConfig }
    );
  }

  // Register cancellation token if provided
  if (cancellationToken) {
    cancellationTokens.set(cancellationToken, {
      cancelled: false,
      cancellationToken,
    });
  }

  // Configure batch processor
  const processor = batchConfig?.groupByJiraProject
    ? new SmartBatchProcessor<string, SyncResult>({
        batchSize: batchConfig?.batchSize || 10,
        maxConcurrency: batchConfig?.maxConcurrency || 3,
        continueOnError: batchConfig?.continueOnError !== false,
        delayBetweenBatches: batchConfig?.delayBetweenBatches || 0,
        retryConfig: batchConfig?.retryConfig || {
          maxRetries: batchConfig?.retryFailedItems ? 2 : 0,
          retryDelay: 1000,
          backoffMultiplier: 2,
        },
        onProgress: async (progress: BatchProgress) => {
          if (progressTracking) {
            await progressTracker.updateProgress(opId, {
              processedItems: progress.processedItems,
              successfulItems: progress.successfulItems,
              failedItems: progress.failedItems,
              currentBatch: progress.currentBatch,
              status: progress.currentPhase === 'cancelled' ? 'cancelled' :
                      progress.currentPhase === 'completing' ? 'completed' : 'processing',
            });
          }
        },
        onItemError: async (error: BatchItemError<string>) => {
          console.error(`Task sync error [${error.item}]:`, error.error);
          if (progressTracking) {
            await progressTracker.updateProgress(opId, {
              errorMessage: `Task ${error.item}: ${error.error.message}`,
            });
          }
        },
        isCancelled: async () => {
          if (cancellationToken) {
            const status = cancellationTokens.get(cancellationToken);
            return status?.cancelled || false;
          }
          return false;
        },
      })
    : new BatchProcessor<string, SyncResult>({
        batchSize: batchConfig?.batchSize || 10,
        maxConcurrency: batchConfig?.maxConcurrency || 3,
        continueOnError: batchConfig?.continueOnError !== false,
        delayBetweenBatches: batchConfig?.delayBetweenBatches || 0,
        retryConfig: batchConfig?.retryConfig || {
          maxRetries: batchConfig?.retryFailedItems ? 2 : 0,
          retryDelay: 1000,
          backoffMultiplier: 2,
        },
        onProgress: async (progress: BatchProgress) => {
          if (progressTracking) {
            await progressTracker.updateProgress(opId, {
              processedItems: progress.processedItems,
              successfulItems: progress.successfulItems,
              failedItems: progress.failedItems,
              currentBatch: progress.currentBatch,
              status: progress.currentPhase === 'cancelled' ? 'cancelled' :
                      progress.currentPhase === 'completing' ? 'completed' : 'processing',
            });
          }
        },
        onItemError: async (error: BatchItemError<string>) => {
          console.error(`Task sync error [${error.item}]:`, error.error);
          if (progressTracking) {
            await progressTracker.updateProgress(opId, {
              errorMessage: `Task ${error.item}: ${error.error.message}`,
            });
          }
        },
        isCancelled: async () => {
          if (cancellationToken) {
            const status = cancellationTokens.get(cancellationToken);
            return status?.cancelled || false;
          }
          return false;
        },
      });

  // Process tasks with batch processor
  const batchResult = await processor.process(
    taskIds,
    async (taskId) => {
      return await syncTaskToJira(
        taskId,
        projectId,
        jiraClient,
        fieldMapping,
        conflictResolution,
        createIfNotExists,
        defaultIssueType
      );
    }
  );

  // Complete progress tracking
  if (progressTracking) {
    await progressTracker.completeProgress(
      opId,
      batchResult.cancelled ? 'cancelled' :
      batchResult.failed.length === 0 ? 'completed' : 'failed'
    );
  }

  // Clean up cancellation token
  if (cancellationToken) {
    cancellationTokens.delete(cancellationToken);
  }

  // Format results
  const errors: SyncError[] = batchResult.failed.map(f => ({
    taskId: f.item,
    error: f.result.message,
    code: f.result.name,
  }));

  return {
    totalTasks: taskIds.length,
    successful: batchResult.successful.length,
    failed: batchResult.failed.length,
    results: batchResult.successful.map(s => s.result),
    errors,
    operationId: opId,
    processingTime: Date.now() - startTime,
    batchesProcessed: batchResult.batchesProcessed,
    cancelled: batchResult.cancelled,
    progressUrl: progressTracking ? `/jira-sync-tasks?operation=get-progress&operationId=${opId}` : undefined,
  };
}

/**
 * Cancel an ongoing operation
 */
async function cancelOperation(operationId: string): Promise<{ success: boolean; message: string }> {
  // Cancel via progress tracker
  const cancelled = await progressTracker.cancelOperation(operationId);

  // Also set cancellation token if exists
  for (const [token, status] of cancellationTokens) {
    if (status.cancellationToken === operationId) {
      status.cancelled = true;
      status.reason = 'User requested cancellation';
    }
  }

  return {
    success: cancelled,
    message: cancelled ? 'Operation cancelled successfully' : 'Operation not found or already completed',
  };
}

/**
 * Get progress for operations
 */
async function getProgress(request: ProgressRequest): Promise<ProgressResponse> {
  try {
    if (request.operationId) {
      const progress = await progressTracker.getProgress(request.operationId);
      if (!progress) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Progress not found for operation: ${request.operationId}`,
          },
        };
      }
      return {
        success: true,
        progress: {
          operationId: progress.operationId,
          projectId: progress.projectId,
          status: progress.status,
          totalItems: progress.totalItems,
          processedItems: progress.processedItems,
          successfulItems: progress.successfulItems,
          failedItems: progress.failedItems,
          percentComplete: progress.percentComplete,
          startedAt: progress.startedAt,
          updatedAt: progress.updatedAt,
          completedAt: progress.completedAt,
          estimatedCompletionTime: progress.estimatedCompletionTime,
          currentBatch: progress.currentBatch,
          totalBatches: progress.totalBatches,
          errorSummary: progress.errorSummary,
        },
      };
    } else {
      const progressList = await progressTracker.queryProgress({
        projectId: request.projectId,
        status: request.status,
        since: request.since,
        limit: request.limit,
      });
      return {
        success: true,
        progress: progressList.map(p => ({
          operationId: p.operationId,
          projectId: p.projectId,
          status: p.status,
          totalItems: p.totalItems,
          processedItems: p.processedItems,
          successfulItems: p.successfulItems,
          failedItems: p.failedItems,
          percentComplete: p.percentComplete,
          startedAt: p.startedAt,
          updatedAt: p.updatedAt,
          completedAt: p.completedAt,
          estimatedCompletionTime: p.estimatedCompletionTime,
          currentBatch: p.currentBatch,
          totalBatches: p.totalBatches,
          errorSummary: p.errorSummary,
        })),
      };
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get progress',
      },
    };
  }
}

/**
 * Format error response
 */
function formatErrorResponse(
  code: string,
  message: string,
  requestId: string,
  statusCode: number,
  details?: any
): Response {
  const processingTime = Date.now();

  const response: SyncTaskResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    metadata: {
      processingTime,
      requestId,
    },
  };

  return new Response(JSON.stringify(response), {
    status: statusCode,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
