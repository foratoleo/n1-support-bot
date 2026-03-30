/**
 * JIRA API Client for Supabase Edge Functions
 *
 * Provides a robust client for interacting with JIRA REST API v3
 * with retry logic, rate limiting, and comprehensive error handling.
 *
 * @module jira-client
 */

export interface JiraConfig {
  baseUrl: string;
  apiToken: string;
  email: string;
  projectKey: string;
}

export interface JiraIssue {
  id?: string;
  key?: string;
  fields: {
    summary: string;
    description?: string;
    issuetype: {
      id?: string;
      name?: string;
    };
    project: {
      key: string;
    };
    priority?: {
      id?: string;
      name?: string;
    };
    status?: {
      id?: string;
      name?: string;
    };
    assignee?: {
      accountId: string;
    } | null;
    labels?: string[];
    [key: string]: any;
  };
}

export interface JiraIssueUpdate {
  fields?: Partial<JiraIssue['fields']>;
  transition?: {
    id: string;
  };
}

export interface JiraSearchResult {
  issues: JiraIssue[];
  total: number;
  maxResults: number;
  // New pagination token (replaces startAt in new API)
  nextPageToken?: string;
  // Deprecated fields (kept for backward compatibility)
  startAt?: number;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: {
    id: string;
    name: string;
  };
}

export interface JiraErrorResponse {
  errorMessages?: string[];
  errors?: Record<string, string>;
}

export class JiraClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public jiraErrors?: JiraErrorResponse,
    public apiRequest?: { url: string; method: string; body?: any },
    public apiResponse?: { status: number; body?: any }
  ) {
    super(message);
    this.name = 'JiraClientError';
  }
}

export class JiraClient {
  private baseUrl: string;
  private authHeader: string;
  private projectKey: string;
  private maxRetries: number = 3;
  private baseBackoffMs: number = 1000;

  constructor(config: JiraConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.projectKey = config.projectKey;

    // Create Basic Auth header: base64(email:apiToken)
    const authString = `${config.email}:${config.apiToken}`;
    this.authHeader = `Basic ${btoa(authString)}`;

    console.log('[JiraClient Init]', {
      baseUrl: this.baseUrl,
      projectKey: this.projectKey,
      email: config.email,
      hasApiToken: !!config.apiToken,
      // Security: Never log token values, even partially
    });
  }

  /**
   * Get the configured project key
   */
  getProjectKey(): string {
    return this.projectKey;
  }

  /**
   * Create a new JIRA issue
   */
  async createIssue(issueData: JiraIssue): Promise<JiraIssue> {
    const url = `${this.baseUrl}/rest/api/3/issue`;
    const requestBody = JSON.stringify(issueData);

    console.log('[JIRA API Request] POST', url);
    // Security: Don't log Authorization header values
    console.log('[JIRA API Request Body]', requestBody);

    const response = await this.executeWithRetry(async () => {
      return await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: requestBody,
      });
    });

    const responseText = await response.text();
    console.log('[JIRA API Response Status]', response.status);
    console.log('[JIRA API Response Body]', responseText);

    const data = responseText ? JSON.parse(responseText) : {};

    if (!response.ok) {
      throw new JiraClientError(
        'Failed to create JIRA issue',
        response.status,
        data as JiraErrorResponse,
        { url, method: 'POST', body: issueData },
        { status: response.status, body: data }
      );
    }

    return data as JiraIssue;
  }

  /**
   * Update an existing JIRA issue
   */
  async updateIssue(issueKey: string, updateData: JiraIssueUpdate): Promise<void> {
    const url = `${this.baseUrl}/rest/api/3/issue/${issueKey}`;
    const requestBody = JSON.stringify(updateData);

    console.log('[JIRA API Request] PUT', url);
    console.log('[JIRA API Request Body]', requestBody);

    const response = await this.executeWithRetry(async () => {
      return await fetch(url, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: requestBody,
      });
    });

    const responseText = await response.text();
    console.log('[JIRA API Response Status]', response.status);
    console.log('[JIRA API Response Body]', responseText);

    if (!response.ok) {
      const data = responseText ? JSON.parse(responseText) : {};
      throw new JiraClientError(
        `Failed to update JIRA issue ${issueKey}`,
        response.status,
        data as JiraErrorResponse,
        { url, method: 'PUT', body: updateData },
        { status: response.status, body: data }
      );
    }
  }

  /**
   * Get a JIRA issue by key
   */
  async getIssue(issueKey: string, fields?: string[]): Promise<JiraIssue> {
    let url = `${this.baseUrl}/rest/api/3/issue/${issueKey}`;

    if (fields && fields.length > 0) {
      url += `?fields=${fields.join(',')}}`;
    }

    const response = await this.executeWithRetry(async () => {
      return await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });
    });

    const data = await response.json();

    if (!response.ok) {
      throw new JiraClientError(
        `Failed to get JIRA issue ${issueKey}`,
        response.status,
        data as JiraErrorResponse
      );
    }

    return data as JiraIssue;
  }

  /**
   * Search for JIRA issues using JQL
   * Uses POST /rest/api/3/search/jql (new API)
   *
   * Migration from deprecated /rest/api/3/search:
   * - Uses nextPageToken for pagination instead of startAt
   * - POST request with JSON body instead of GET with query params
   * - See: https://developer.atlassian.com/changelog/#CHANGE-2046
   */
  async searchIssues(
    jql: string,
    nextPageToken?: string,
    maxResults: number = 50,
    fields?: string[]
  ): Promise<JiraSearchResult> {
    const url = `${this.baseUrl}/rest/api/3/search/jql`;

    const fieldsList = fields || ['summary', 'status', 'assignee', 'updated', 'description', 'issuetype', 'priority', 'labels'];

    // Build request body according to new API specification
    const requestBody: any = {
      jql: jql,
      maxResults: maxResults,
      fields: fieldsList,
    };

    // Add nextPageToken only if provided (for subsequent pages)
    if (nextPageToken) {
      requestBody.nextPageToken = nextPageToken;
    }

    console.log('[JIRA API] Searching issues with JQL:', {
      jql,
      maxResults,
      hasNextPageToken: !!nextPageToken,
    });

    const response = await this.executeWithRetry(async () => {
      return await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      });
    });

    const data = await response.json();

    if (!response.ok) {
      throw new JiraClientError(
        'Failed to search JIRA issues',
        response.status,
        data as JiraErrorResponse
      );
    }

    console.log('[JIRA API] Search completed:', {
      total: data.total,
      returned: data.issues?.length || 0,
      hasNextPage: !!data.nextPageToken,
    });

    return data as JiraSearchResult;
  }

  /**
   * Get available transitions for an issue
   */
  async getTransitions(issueKey: string): Promise<JiraTransition[]> {
    const url = `${this.baseUrl}/rest/api/3/issue/${issueKey}/transitions`;

    const response = await this.executeWithRetry(async () => {
      return await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });
    });

    const data = await response.json();

    if (!response.ok) {
      throw new JiraClientError(
        `Failed to get transitions for issue ${issueKey}`,
        response.status,
        data as JiraErrorResponse
      );
    }

    return data.transitions as JiraTransition[];
  }

  /**
   * Transition an issue to a new status
   */
  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    const url = `${this.baseUrl}/rest/api/3/issue/${issueKey}/transitions`;

    const response = await this.executeWithRetry(async () => {
      return await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          transition: { id: transitionId },
        }),
      });
    });

    if (!response.ok) {
      const data = await response.json();
      throw new JiraClientError(
        `Failed to transition issue ${issueKey}`,
        response.status,
        data as JiraErrorResponse
      );
    }
  }

  /**
   * Delete a JIRA issue
   */
  async deleteIssue(issueKey: string): Promise<void> {
    const url = `${this.baseUrl}/rest/api/3/issue/${issueKey}`;

    const response = await this.executeWithRetry(async () => {
      return await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
    });

    if (!response.ok) {
      const data = await response.json();
      throw new JiraClientError(
        `Failed to delete issue ${issueKey}`,
        response.status,
        data as JiraErrorResponse
      );
    }
  }

  /**
   * Get request headers with authentication
   */
  private getHeaders(): HeadersInit {
    return {
      'Authorization': this.authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Execute a request with retry logic and exponential backoff
   */
  private async executeWithRetry<T>(
    operation: () => Promise<Response>
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await operation();

        // Don't retry on client errors (4xx), except rate limiting (429)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return response;
        }

        // Success or server error (will retry server errors)
        if (response.ok || response.status >= 500) {
          return response;
        }

        // Rate limiting - wait and retry
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitMs = retryAfter
            ? parseInt(retryAfter) * 1000
            : this.calculateBackoff(attempt);

          console.log(`Rate limited. Waiting ${waitMs}ms before retry ${attempt + 1}/${this.maxRetries}`);
          await this.delay(waitMs);
          continue;
        }

        return response;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on the last attempt
        if (attempt === this.maxRetries - 1) {
          break;
        }

        const backoffMs = this.calculateBackoff(attempt);
        console.log(`Request failed. Retrying in ${backoffMs}ms (attempt ${attempt + 1}/${this.maxRetries})`);
        await this.delay(backoffMs);
      }
    }

    throw new JiraClientError(
      `Request failed after ${this.maxRetries} attempts: ${lastError?.message}`,
      undefined,
      undefined
    );
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    return Math.min(
      this.baseBackoffMs * Math.pow(2, attempt),
      10000 // Max 10 seconds
    );
  }

  /**
   * Delay execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
