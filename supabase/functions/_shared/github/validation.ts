/**
 * GitHub Sync Validation Utilities
 *
 * Provides validation functions for GitHub sync configurations,
 * repository URLs, and Edge Function requests.
 *
 * @module github/validation
 */

import { isGitHubUrl, parseGitHubUrl, type ParsedGitHubUrl } from './url-parser.ts';

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Field that caused the error (for form validation) */
  field?: string;
}

/**
 * Result of validating multiple fields
 */
export interface MultiValidationResult {
  /** Whether all validations passed */
  valid: boolean;
  /** Array of validation errors */
  errors: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * GitHub Personal Access Token configuration
 */
export interface GitHubTokenConfig {
  /** The personal access token */
  token: string;
  /** Token type (classic or fine-grained) */
  tokenType?: 'classic' | 'fine-grained';
}

/**
 * GitHub sync configuration for a repository
 */
export interface GitHubSyncConfig {
  /** Repository URL (any supported format) */
  repositoryUrl: string;
  /** GitHub Personal Access Token */
  accessToken: string;
  /** Optional: default branch to sync */
  defaultBranch?: string;
  /** Optional: sync interval in minutes */
  syncIntervalMinutes?: number;
  /** Optional: enable automatic sync */
  autoSync?: boolean;
}

/**
 * Request body for the sync-github-prs Edge Function
 */
export interface SyncGitHubPRsRequest {
  /** Project ID (UUID) */
  projectId: string;
  /** Repository ID from project_git_repositories */
  repositoryId?: string;
  /** Optional: specific PR number to sync */
  pullRequestNumber?: number;
  /** Optional: sync state filter (open, closed, all) */
  state?: 'open' | 'closed' | 'all';
  /** Optional: maximum PRs to sync */
  limit?: number;
  /** Optional: force full sync (ignore last sync time) */
  forceFullSync?: boolean;
}

/**
 * Token format patterns
 */
const TOKEN_PATTERNS = {
  /** Classic Personal Access Token: ghp_XXXXX */
  classic: /^ghp_[a-zA-Z0-9]{36}$/,
  /** Fine-grained Personal Access Token: github_pat_XXXXX */
  fineGrained: /^github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}$/,
  /** OAuth token: gho_XXXXX */
  oauth: /^gho_[a-zA-Z0-9]{36}$/,
  /** User-to-server token: ghu_XXXXX */
  userToServer: /^ghu_[a-zA-Z0-9]{36}$/,
  /** Server-to-server token: ghs_XXXXX */
  serverToServer: /^ghs_[a-zA-Z0-9]{36}$/,
  /** Refresh token: ghr_XXXXX */
  refresh: /^ghr_[a-zA-Z0-9]{36}$/,
} as const;

/**
 * UUID v4 pattern for validating project/repository IDs
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates a GitHub Personal Access Token format.
 *
 * Supports multiple token formats:
 * - Classic PAT: ghp_XXXXX (36 chars)
 * - Fine-grained PAT: github_pat_XXXX_XXXX
 * - OAuth: gho_XXXXX
 * - User-to-server: ghu_XXXXX
 * - Server-to-server: ghs_XXXXX
 *
 * @param token - The token to validate
 * @returns ValidationResult indicating if the token format is valid
 *
 * @example
 * ```typescript
 * validateGitHubToken('ghp_abc123...'); // { valid: true }
 * validateGitHubToken('invalid'); // { valid: false, error: '...' }
 * ```
 */
export function validateGitHubToken(token: string): ValidationResult {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      error: 'GitHub token is required',
      field: 'accessToken',
    };
  }

  const trimmedToken = token.trim();

  if (trimmedToken.length === 0) {
    return {
      valid: false,
      error: 'GitHub token cannot be empty',
      field: 'accessToken',
    };
  }

  // Check against all known token patterns
  const isValidFormat = Object.values(TOKEN_PATTERNS).some(pattern =>
    pattern.test(trimmedToken)
  );

  if (!isValidFormat) {
    // Check if it looks like a token but wrong format
    if (trimmedToken.startsWith('ghp_') || trimmedToken.startsWith('github_pat_')) {
      return {
        valid: false,
        error: 'GitHub token appears to be malformed. Please check the token and try again.',
        field: 'accessToken',
      };
    }

    return {
      valid: false,
      error: 'Invalid GitHub token format. Token should start with ghp_, github_pat_, gho_, ghu_, or ghs_',
      field: 'accessToken',
    };
  }

  return { valid: true };
}

/**
 * Validates a GitHub repository URL.
 *
 * @param url - The repository URL to validate
 * @returns ValidationResult with parsed info on success
 *
 * @example
 * ```typescript
 * validateRepositoryUrl('https://github.com/owner/repo');
 * // { valid: true }
 *
 * validateRepositoryUrl('https://gitlab.com/owner/repo');
 * // { valid: false, error: '...' }
 * ```
 */
export function validateRepositoryUrl(url: string): ValidationResult & { parsed?: ParsedGitHubUrl } {
  if (!url || typeof url !== 'string') {
    return {
      valid: false,
      error: 'Repository URL is required',
      field: 'repositoryUrl',
    };
  }

  const trimmedUrl = url.trim();

  if (trimmedUrl.length === 0) {
    return {
      valid: false,
      error: 'Repository URL cannot be empty',
      field: 'repositoryUrl',
    };
  }

  if (!isGitHubUrl(trimmedUrl)) {
    // Provide helpful error message based on URL format
    if (trimmedUrl.includes('gitlab.com')) {
      return {
        valid: false,
        error: 'Only GitHub repositories are supported. GitLab URLs are not accepted.',
        field: 'repositoryUrl',
      };
    }

    if (trimmedUrl.includes('bitbucket.org')) {
      return {
        valid: false,
        error: 'Only GitHub repositories are supported. Bitbucket URLs are not accepted.',
        field: 'repositoryUrl',
      };
    }

    return {
      valid: false,
      error: 'Invalid GitHub repository URL. Supported formats: https://github.com/owner/repo, git@github.com:owner/repo.git',
      field: 'repositoryUrl',
    };
  }

  const parsed = parseGitHubUrl(trimmedUrl);
  if (!parsed) {
    return {
      valid: false,
      error: 'Could not parse repository owner and name from URL',
      field: 'repositoryUrl',
    };
  }

  return { valid: true, parsed };
}

/**
 * Validates a UUID format (v4).
 *
 * @param uuid - The UUID to validate
 * @param fieldName - Field name for error messages
 * @returns ValidationResult
 */
export function validateUUID(uuid: string, fieldName: string = 'id'): ValidationResult {
  if (!uuid || typeof uuid !== 'string') {
    return {
      valid: false,
      error: `${fieldName} is required`,
      field: fieldName,
    };
  }

  if (!UUID_PATTERN.test(uuid.trim())) {
    return {
      valid: false,
      error: `${fieldName} must be a valid UUID`,
      field: fieldName,
    };
  }

  return { valid: true };
}

/**
 * Validates a complete GitHub sync configuration.
 *
 * @param config - The sync configuration to validate
 * @returns MultiValidationResult with all validation errors
 *
 * @example
 * ```typescript
 * const result = validateSyncConfig({
 *   repositoryUrl: 'https://github.com/owner/repo',
 *   accessToken: 'ghp_xxxx...',
 *   syncIntervalMinutes: 30
 * });
 *
 * if (!result.valid) {
 *   console.log(result.errors);
 * }
 * ```
 */
export function validateSyncConfig(config: Partial<GitHubSyncConfig>): MultiValidationResult {
  const errors: Array<{ field: string; message: string }> = [];

  // Validate required fields
  if (!config) {
    return {
      valid: false,
      errors: [{ field: 'config', message: 'Configuration object is required' }],
    };
  }

  // Validate repository URL
  const urlResult = validateRepositoryUrl(config.repositoryUrl || '');
  if (!urlResult.valid && urlResult.error) {
    errors.push({ field: urlResult.field || 'repositoryUrl', message: urlResult.error });
  }

  // Validate access token
  const tokenResult = validateGitHubToken(config.accessToken || '');
  if (!tokenResult.valid && tokenResult.error) {
    errors.push({ field: tokenResult.field || 'accessToken', message: tokenResult.error });
  }

  // Validate optional fields
  if (config.defaultBranch !== undefined) {
    if (typeof config.defaultBranch !== 'string' || config.defaultBranch.trim().length === 0) {
      errors.push({ field: 'defaultBranch', message: 'Default branch must be a non-empty string' });
    } else if (!/^[a-zA-Z0-9._/-]+$/.test(config.defaultBranch)) {
      errors.push({ field: 'defaultBranch', message: 'Default branch contains invalid characters' });
    }
  }

  if (config.syncIntervalMinutes !== undefined) {
    if (typeof config.syncIntervalMinutes !== 'number' || !Number.isInteger(config.syncIntervalMinutes)) {
      errors.push({ field: 'syncIntervalMinutes', message: 'Sync interval must be an integer' });
    } else if (config.syncIntervalMinutes < 1) {
      errors.push({ field: 'syncIntervalMinutes', message: 'Sync interval must be at least 1 minute' });
    } else if (config.syncIntervalMinutes > 1440) {
      errors.push({ field: 'syncIntervalMinutes', message: 'Sync interval cannot exceed 1440 minutes (24 hours)' });
    }
  }

  if (config.autoSync !== undefined && typeof config.autoSync !== 'boolean') {
    errors.push({ field: 'autoSync', message: 'Auto sync must be a boolean' });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a sync-github-prs Edge Function request.
 *
 * @param body - The request body to validate
 * @returns MultiValidationResult with all validation errors
 *
 * @example
 * ```typescript
 * const result = validateSyncRequest({
 *   projectId: '123e4567-e89b-12d3-a456-426614174000',
 *   state: 'open',
 *   limit: 50
 * });
 *
 * if (!result.valid) {
 *   return new Response(JSON.stringify({ errors: result.errors }), { status: 400 });
 * }
 * ```
 */
export function validateSyncRequest(body: unknown): MultiValidationResult {
  const errors: Array<{ field: string; message: string }> = [];

  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      errors: [{ field: 'body', message: 'Request body must be a valid JSON object' }],
    };
  }

  const request = body as Partial<SyncGitHubPRsRequest>;

  // Validate required projectId
  const projectIdResult = validateUUID(request.projectId || '', 'projectId');
  if (!projectIdResult.valid && projectIdResult.error) {
    errors.push({ field: 'projectId', message: projectIdResult.error });
  }

  // Validate optional repositoryId
  if (request.repositoryId !== undefined) {
    const repoIdResult = validateUUID(request.repositoryId, 'repositoryId');
    if (!repoIdResult.valid && repoIdResult.error) {
      errors.push({ field: 'repositoryId', message: repoIdResult.error });
    }
  }

  // Validate optional pullRequestNumber
  if (request.pullRequestNumber !== undefined) {
    if (typeof request.pullRequestNumber !== 'number' || !Number.isInteger(request.pullRequestNumber)) {
      errors.push({ field: 'pullRequestNumber', message: 'Pull request number must be an integer' });
    } else if (request.pullRequestNumber < 1) {
      errors.push({ field: 'pullRequestNumber', message: 'Pull request number must be positive' });
    }
  }

  // Validate optional state
  if (request.state !== undefined) {
    const validStates = ['open', 'closed', 'all'];
    if (!validStates.includes(request.state)) {
      errors.push({
        field: 'state',
        message: `Invalid state: ${request.state}. Must be one of: ${validStates.join(', ')}`,
      });
    }
  }

  // Validate optional limit
  if (request.limit !== undefined) {
    if (typeof request.limit !== 'number' || !Number.isInteger(request.limit)) {
      errors.push({ field: 'limit', message: 'Limit must be an integer' });
    } else if (request.limit < 1) {
      errors.push({ field: 'limit', message: 'Limit must be at least 1' });
    } else if (request.limit > 100) {
      errors.push({ field: 'limit', message: 'Limit cannot exceed 100' });
    }
  }

  // Validate optional forceFullSync
  if (request.forceFullSync !== undefined && typeof request.forceFullSync !== 'boolean') {
    errors.push({ field: 'forceFullSync', message: 'Force full sync must be a boolean' });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a standardized validation error response for Edge Functions.
 *
 * @param result - The validation result
 * @returns Response object with appropriate status and error body
 */
export function createValidationErrorResponse(result: MultiValidationResult): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Validation failed',
      errors: result.errors,
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
