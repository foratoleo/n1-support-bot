/**
 * Sync JIRA to DR-AI Edge Function
 *
 * Handles ONLY JIRA → DR-AI synchronization (one-way sync).
 * Discovers new JIRA issues and creates corresponding DR-AI tasks.
 * Updates existing DR-AI tasks from JIRA issue changes.
 * Supports single task sync, bulk operations, and automatic issue discovery.
 *
 * @module sync-jira-to-drai
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
  MultiProjectSyncResult,
  ProjectSyncResult,
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

    // Validate request body size (1MB limit to prevent DoS)
    const contentLength = req.headers.get('content-length');
    const MAX_BODY_SIZE = 1024 * 1024; // 1MB
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return formatErrorResponse(
        'PAYLOAD_TOO_LARGE',
        `Request body exceeds maximum size of ${MAX_BODY_SIZE} bytes`,
        requestId,
        413
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
      projectId: body.projectId || 'ALL_PROJECTS',
      taskCount: body.taskIds?.length || (body.taskId ? 1 : 0),
    });

    // Handle multi-project scheduled sync (when projectId is omitted)
    if (!body.projectId && body.operation === 'scheduled-sync') {
      const multiProjectResult = await syncAllProjects(body, requestId);
      const processingTime = Date.now() - startTime;

      const response: SyncTaskResponse = {
        success: true,
        data: multiProjectResult,
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
    }

    // Get JIRA configuration (required for single-project operations)
    const config = await dbService.getConfig(body.projectId!);
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
    console.log('[JIRA Config]', {
      baseUrl: config.jira_url,
      email: config.jira_email,
      projectKey: config.jira_project_key,
      hasApiToken: !!config.api_token_encrypted,
      // Security: Never log token values, even partially
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
        // This function only handles JIRA → DR-AI sync
        return formatErrorResponse(
          'INVALID_OPERATION',
          'sync-to-jira is not supported by this endpoint. Use sync-drai-to-jira function instead.',
          requestId,
          400
        );

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
        // Bulk sync from JIRA to DR-AI is not supported via taskIds.
        // Use 'scheduled-sync' operation instead, which discovers JIRA issues automatically.
        return formatErrorResponse(
          'OPERATION_NOT_SUPPORTED',
          'bulk-sync and batch-sync operations are not supported by this endpoint. ' +
          'Use scheduled-sync operation to discover and sync JIRA issues to DR-AI, ' +
          'or use sync-drai-to-jira function for bulk DR-AI to JIRA synchronization.',
          requestId,
          400
        );

      case 'scheduled-sync':
        // Scheduled sync operation for cron jobs
        // Discovers and syncs all JIRA issues to DR-AI (direction is always 'from-jira')
        result = await scheduledProjectSync(
          body.projectId,
          jiraClient,
          fieldMapping,
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

// syncTaskToJira removed - not supported by this endpoint
// Use sync-drai-to-jira function for DR-AI → JIRA synchronization

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

// bulkSyncTasks removed - not supported by this endpoint
// Use sync-drai-to-jira function for bulk DR-AI → JIRA synchronization

// mapTaskToJiraIssue and mapTaskToJiraUpdate removed - not needed for JIRA → DR-AI sync
// Use sync-drai-to-jira function for DR-AI → JIRA field mapping

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

// detectConflicts removed - not needed for JIRA → DR-AI sync (JIRA always wins)
// Conflicts only matter when DR-AI pushes to JIRA

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
 * Build JQL query string from project key and optional filters
 *
 * @param projectKey - JIRA project key
 * @param filters - Optional filters for JQL construction
 * @returns JQL query string
 */
function buildJQL(
  projectKey: string,
  filters?: {
    status?: string[];
    updatedSince?: string;
    excludeStatuses?: string[];
  }
): string {
  const conditions: string[] = [`project = "${projectKey}"`];

  // Filter by JIRA statuses
  if (filters?.status?.length) {
    const statusList = filters.status.map(s => `"${s}"`).join(', ');
    conditions.push(`status IN (${statusList})`);
  }

  // Exclude specific statuses
  if (filters?.excludeStatuses?.length) {
    const excludeList = filters.excludeStatuses.map(s => `"${s}"`).join(', ');
    conditions.push(`status NOT IN (${excludeList})`);
  }

  // Temporal filtering - only sync issues updated since specified date
  if (filters?.updatedSince) {
    // JIRA expects format: "yyyy/MM/dd HH:mm" or relative like "-7d"
    const date = new Date(filters.updatedSince);
    const jiraDateFormat = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    conditions.push(`updated >= "${jiraDateFormat}"`);
  }

  return conditions.join(' AND ');
}

/**
 * Scheduled project-wide sync operation (JIRA → DR-AI only)
 *
 * CRITICAL FEATURE: Discovers ALL JIRA issues and creates missing DR-AI tasks.
 * This solves the problem where new JIRA issues created outside DR-AI are never imported.
 * Direction is always 'from-jira' - this function only syncs JIRA → DR-AI.
 *
 * Process:
 * 1. Fetch ALL issues from JIRA project using JQL search
 * 2. For each JIRA issue:
 *    - Check if DR-AI task exists (by jira_issue_key)
 *    - If exists: Update it with JIRA data
 *    - If NOT exists: Create new DR-AI task from JIRA issue
 *
 * @param projectId - The DR-AI project ID
 * @param jiraClient - Initialized JIRA client
 * @param fieldMapping - Field mapping configuration
 * @param conflictResolution - Conflict resolution strategy
 * @param createIfNotExists - Not used (always creates for new issues)
 * @param defaultIssueType - Not used for JIRA → DR-AI
 * @param batchConfig - Batch processing configuration
 * @param progressTracking - Enable progress tracking
 * @param operationId - Operation ID for tracking
 * @param filters - Optional filters for issue selection
 */
async function scheduledProjectSync(
  projectId: string,
  jiraClient: JiraClient,
  fieldMapping: FieldMappingConfig,
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
    updatedSince?: string;
    excludeStatuses?: string[];
  }
): Promise<{
  direction: string;
  fromJiraResults?: BulkSyncResult;
  summary: {
    totalTasksProcessed: number;
    successfulSyncs: number;
    failedSyncs: number;
    skippedTasks: number;
    newTasksCreated: number;
    existingTasksUpdated: number;
  };
}> {
  const startTime = Date.now();
  const opId = operationId || crypto.randomUUID();
  const direction = 'from-jira'; // Hardcoded - this function always syncs JIRA → DR-AI

  console.log('Starting JIRA issue discovery and sync (JIRA → DR-AI):', {
    projectId,
    direction,
    operationId: opId,
    filters,
    syncMode: filters?.updatedSince ? 'incremental' : 'full',
  });

  // Build JQL query with filters
  const jql = buildJQL(jiraClient.getProjectKey(), filters);
  console.log('Fetching JIRA issues with JQL:', jql);

  const results: SyncResult[] = [];
  const errors: SyncError[] = [];
  let newTasksCreated = 0;
  let existingTasksUpdated = 0;

  try {
    // Fetch issues with pagination using nextPageToken (new API)
    let nextPageToken: string | undefined;
    const maxResults = 50;
    let totalIssues = 0;
    let fetchedIssues = 0;

    do {
      const searchResult = await jiraClient.searchIssues(jql, nextPageToken, maxResults);
      totalIssues = searchResult.total;
      fetchedIssues += searchResult.issues.length;

      console.log(`Fetched ${searchResult.issues.length} JIRA issues (${fetchedIssues}/${totalIssues})`);

      // Process each JIRA issue
      for (const jiraIssue of searchResult.issues) {
        try {
          // Check if DR-AI task already exists for this JIRA issue
          const existingTask = await dbService.getTaskByJiraKey(jiraIssue.key!, projectId);

          if (existingTask) {
            // Task exists - update it
            const taskUpdate = mapJiraToTask(jiraIssue, fieldMapping);
            await dbService.updateTaskJiraData(existingTask.id, {
              ...taskUpdate,
              jira_sync_status: 'synced',
              last_jira_sync: new Date().toISOString(),
            });

            results.push({
              taskId: existingTask.id,
              jiraIssueKey: jiraIssue.key!,
              operation: 'updated',
              syncedFields: Object.keys(fieldMapping.jira_to_dr),
            });

            existingTasksUpdated++;
            console.log(`Updated existing DR-AI task ${existingTask.id} from JIRA issue ${jiraIssue.key}`);

            // Log sync
            await dbService.createSyncLog({
              project_id: projectId,
              task_id: existingTask.id,
              jira_issue_key: jiraIssue.key,
              operation: 'update',
              direction: 'jira_to_dr',
              status: 'success',
            });
          } else {
            // Task does NOT exist - create new DR-AI task from JIRA issue
            const newTask = await dbService.createTaskFromJira(
              projectId,
              jiraIssue,
              fieldMapping
            );

            results.push({
              taskId: newTask.id,
              jiraIssueKey: jiraIssue.key!,
              operation: 'created',
              syncedFields: Object.keys(fieldMapping.jira_to_dr),
            });

            newTasksCreated++;
            console.log(`Created new DR-AI task ${newTask.id} from JIRA issue ${jiraIssue.key}`);

            // Log sync
            await dbService.createSyncLog({
              project_id: projectId,
              task_id: newTask.id,
              jira_issue_key: jiraIssue.key,
              operation: 'create',
              direction: 'jira_to_dr',
              status: 'success',
            });
          }
        } catch (error) {
          errors.push({
            taskId: jiraIssue.key || 'unknown',
            error: error instanceof Error ? error.message : 'Unknown error',
            code: error instanceof JiraClientError ? error.statusCode?.toString() : undefined,
          });

          console.error(`Failed to sync JIRA issue ${jiraIssue.key}:`, error);

          // Log error
          await dbService.createSyncLog({
            project_id: projectId,
            jira_issue_key: jiraIssue.key,
            operation: 'sync',
            direction: 'jira_to_dr',
            status: 'error',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Get next page token for pagination (undefined means no more pages)
      nextPageToken = searchResult.nextPageToken;
    } while (nextPageToken);

  } catch (error) {
    console.error('Failed to fetch JIRA issues:', error);
    throw error;
  }

  const fromJiraResults: BulkSyncResult = {
    totalTasks: results.length + errors.length,
    successful: results.length,
    failed: errors.length,
    results,
    errors,
  };

  // Calculate summary
  const summary = {
    totalTasksProcessed: fromJiraResults.totalTasks,
    successfulSyncs: fromJiraResults.successful,
    failedSyncs: fromJiraResults.failed,
    skippedTasks: 0,
    newTasksCreated,
    existingTasksUpdated,
  };

  const processingTime = Date.now() - startTime;

  console.log('JIRA issue discovery and sync completed:', {
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
    direction: 'jira_to_dr',
    status: summary.failedSyncs === 0 ? 'success' :
            summary.successfulSyncs > 0 ? 'success' : 'error',
    error_message: summary.failedSyncs > 0
      ? `Scheduled sync completed with ${summary.failedSyncs} failures`
      : undefined,
  });

  return {
    direction: 'from-jira',
    fromJiraResults,
    summary,
  };
}

/**
 * Sync all projects with active JIRA configurations
 */
async function syncAllProjects(
  request: SyncTaskRequest,
  operationId: string
): Promise<MultiProjectSyncResult> {
  const startTime = Date.now();
  console.log('[Multi-Project Sync] Starting sync for all active projects (JIRA → DR-AI)');

  // Get all active projects
  const projects = await dbService.getActiveProjects();
  console.log(`[Multi-Project Sync] Found ${projects.length} active projects`);

  if (projects.length === 0) {
    console.log('[Multi-Project Sync] No active projects found');
    return {
      totalProjects: 0,
      successfulProjects: 0,
      failedProjects: 0,
      results: [],
      totalProcessingTime: Date.now() - startTime,
    };
  }

  const results: ProjectSyncResult[] = [];

  // Sync each project sequentially with continue-on-error pattern
  for (const project of projects) {
    const projectStartTime = Date.now();
    console.log(`[Multi-Project Sync] Syncing project: ${project.project_name} (${project.project_id})`);

    try {
      // Create a single-project sync request
      const projectRequest: SyncTaskRequest = {
        ...request,
        projectId: project.project_id,
      };

      // Execute single project sync
      const syncResult = await syncSingleProject(projectRequest, project.config, `${operationId}-${project.project_id}`);

      results.push({
        projectId: project.project_id,
        projectName: project.project_name,
        status: 'success',
        tasksSynced: syncResult.fromJiraResults?.successful || 0,
        newTasksCreated: syncResult.summary?.newTasksCreated || 0,
        existingTasksUpdated: syncResult.summary?.existingTasksUpdated || 0,
        processingTime: Date.now() - projectStartTime,
      });

      console.log(`[Multi-Project Sync] Successfully synced project ${project.project_name}: ${syncResult.fromJiraResults?.successful || 0} tasks (${syncResult.summary?.newTasksCreated || 0} new, ${syncResult.summary?.existingTasksUpdated || 0} updated)`);
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Enhanced error details for JiraClientError
      if (error && typeof error === 'object' && 'name' in error && error.name === 'JiraClientError') {
        const jiraError = error as any;
        const details = [];

        if (jiraError.statusCode) {
          details.push(`HTTP ${jiraError.statusCode}`);
        }

        if (jiraError.jiraErrors) {
          if (jiraError.jiraErrors.errorMessages && jiraError.jiraErrors.errorMessages.length > 0) {
            details.push(`JIRA: ${jiraError.jiraErrors.errorMessages.join(', ')}`);
          }
          if (jiraError.jiraErrors.errors) {
            const errorKeys = Object.keys(jiraError.jiraErrors.errors);
            if (errorKeys.length > 0) {
              details.push(`Fields: ${errorKeys.map(k => `${k}=${jiraError.jiraErrors.errors[k]}`).join(', ')}`);
            }
          }
        }

        if (details.length > 0) {
          errorMessage = `${errorMessage} (${details.join(' | ')})`;
        }
      }

      console.error(`[Multi-Project Sync] Failed to sync project ${project.project_name}:`, {
        error: errorMessage,
        errorObject: error,
      });

      results.push({
        projectId: project.project_id,
        projectName: project.project_name,
        status: 'error',
        error: errorMessage,
        processingTime: Date.now() - projectStartTime,
      });
    }
  }

  const successfulProjects = results.filter(r => r.status === 'success').length;
  const failedProjects = results.filter(r => r.status === 'error').length;
  const totalProcessingTime = Date.now() - startTime;

  console.log('[Multi-Project Sync] Completed:', {
    totalProjects: projects.length,
    successfulProjects,
    failedProjects,
    totalProcessingTime,
  });

  return {
    totalProjects: projects.length,
    successfulProjects,
    failedProjects,
    results,
    totalProcessingTime,
  };
}

/**
 * Sync a single project (extracted from scheduledProjectSync for reusability)
 */
async function syncSingleProject(
  request: SyncTaskRequest,
  config: JiraSyncConfig,
  operationId: string
): Promise<{
  direction: string;
  fromJiraResults?: BulkSyncResult;
  summary: {
    totalTasksProcessed: number;
    successfulSyncs: number;
    failedSyncs: number;
    skippedTasks: number;
    newTasksCreated: number;
    existingTasksUpdated: number;
  };
}> {
  // Initialize JIRA client
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

  // Execute scheduled project sync (always JIRA → DR-AI)
  return await scheduledProjectSync(
    request.projectId!,
    jiraClient,
    fieldMapping,
    request.conflictResolution || 'last-write-wins',
    request.createIfNotExists !== false,
    config.default_issue_type || 'Task',
    request.batchConfig,
    request.progressTracking || false,
    operationId,
    request.filters
  );
}

/**
 * Validate sync request
 */
function validateRequest(request: SyncTaskRequest): ValidationResult {
  if (!request.operation) {
    return { valid: false, error: 'operation is required' };
  }

  // projectId is optional only for scheduled-sync operation
  if (!request.projectId && request.operation !== 'scheduled-sync') {
    return { valid: false, error: 'projectId is required for this operation' };
  }

  if (request.projectId && !isValidUUID(request.projectId)) {
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

// convertToAtlassianDocumentFormat removed - not needed for JIRA → DR-AI sync
// ADF conversion is only needed when creating/updating JIRA issues
// Use sync-drai-to-jira function for ADF conversion

// enhancedBulkSync removed - not supported by this endpoint
// Bulk sync is handled by scheduledProjectSync for JIRA → DR-AI direction
// Use sync-drai-to-jira function for bulk DR-AI → JIRA synchronization

/**
 * Cancel an ongoing operation
 */
async function cancelOperation(operationId: string): Promise<{ success: boolean; message: string }> {
  // Cancel via progress tracker
  const cancelled = await progressTracker.cancelOperation(operationId);

  // Also set cancellation token if exists and clean up
  const tokensToDelete: string[] = [];
  for (const [token, status] of cancellationTokens) {
    if (status.cancellationToken === operationId) {
      status.cancelled = true;
      status.reason = 'User requested cancellation';
      tokensToDelete.push(token);
    }
  }

  // Clean up cancellation tokens to prevent memory leak
  for (const token of tokensToDelete) {
    cancellationTokens.delete(token);
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
