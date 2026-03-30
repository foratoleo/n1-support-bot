/**
 * Field Mapping System for JIRA Synchronization
 *
 * This module provides bidirectional field mapping between DR_AI tasks and JIRA issues,
 * supporting both default mapping presets and custom field configurations.
 *
 * @module field-mapper
 */

/**
 * Type Definitions for Field Mappings
 */

export interface DevTask {
  id?: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  task_type?: 'feature' | 'bug' | 'enhancement' | 'technical_debt' | 'research' | 'documentation';
  assigned_to?: string;
  due_date?: string;
  tags?: string[];
  story_points?: number;
  sprint_id?: string;
  // JIRA-specific fields
  jira_issue_key?: string;
  jira_sync_status?: string;
  last_jira_sync?: string;
  [key: string]: any; // Support for custom fields
}

export interface JiraIssue {
  id?: string;
  key?: string;
  fields: {
    summary: string;
    description?: string | { content: any[] };
    issuetype: {
      id?: string;
      name: string;
    };
    project: {
      key: string;
      id?: string;
    };
    priority?: {
      id?: string;
      name: string;
    };
    status?: {
      id?: string;
      name: string;
      statusCategory?: {
        key?: string;
        name?: string;
      };
    };
    assignee?: {
      accountId?: string;
      emailAddress?: string;
      displayName?: string;
    } | null;
    duedate?: string;
    labels?: string[];
    customfield_10000?: number; // Story Points (common custom field)
    [key: string]: any; // Support for custom fields
  };
}

export interface FieldMapping {
  id: string;
  project_id: string;
  mapping_name: string;
  dr_to_jira: DRToJiraMapping;
  jira_to_dr: JiraToDRMapping;
  custom_field_mappings?: CustomFieldMapping[];
  created_at?: string;
  updated_at?: string;
}

export interface DRToJiraMapping {
  // Simple field mappings
  title?: string;
  description?: string;
  assigned_to?: string;
  due_date?: string;
  tags?: string;
  story_points?: string;

  // Complex mappings with value transformation
  status?: Record<string, string>;
  priority?: Record<string, string>;
  task_type?: Record<string, string>;

  // Custom field mappings (key is DR field, value is JIRA field ID)
  custom_fields?: Record<string, string>;
}

export interface JiraToDRMapping {
  // Simple field mappings
  summary?: string;
  description?: string;
  assignee?: string;
  duedate?: string;
  labels?: string;

  // Complex mappings with value transformation
  status?: Record<string, string>;
  priority?: Record<string, string>;
  issuetype?: Record<string, string>;

  // Custom field mappings (key is JIRA field ID, value is DR field)
  custom_fields?: Record<string, string>;
}

export interface CustomFieldMapping {
  source_field: string;
  target_field: string;
  transform?: 'none' | 'date' | 'number' | 'boolean' | 'json' | 'custom';
  transform_config?: any;
}

export interface FieldMapperConfig {
  jiraProjectKey: string;
  defaultIssueType?: string;
  dateFormat?: 'ISO' | 'JIRA'; // ISO: YYYY-MM-DD, JIRA: YYYY-MM-DD
  enableCustomFields?: boolean;
  strictMode?: boolean; // If true, throw on mapping errors; if false, log and continue
}

export interface MappingResult {
  success: boolean;
  data?: any;
  warnings?: string[];
  errors?: string[];
  mappedFields?: string[];
  skippedFields?: string[];
}

/**
 * Default Field Mapping Presets
 */
export const DEFAULT_FIELD_MAPPING: FieldMapping = {
  id: 'default',
  project_id: 'default',
  mapping_name: 'Default DR-JIRA Mapping',
  dr_to_jira: {
    // Simple mappings
    title: 'summary',
    description: 'description',
    assigned_to: 'assignee',
    due_date: 'duedate',
    tags: 'labels',
    story_points: 'customfield_10000', // Common JIRA story points field

    // Status mapping
    status: {
      'todo': 'To Do',
      'in_progress': 'In Progress',
      'done': 'Done',
      'blocked': 'Blocked'
    },

    // Priority mapping
    priority: {
      'low': 'Low',
      'medium': 'Medium',
      'high': 'High',
      'critical': 'Highest'
    },

    // Task type mapping
    task_type: {
      'feature': 'Story',
      'bug': 'Bug',
      'enhancement': 'Improvement',
      'technical_debt': 'Technical task',
      'research': 'Spike',
      'documentation': 'Documentation'
    }
  },
  jira_to_dr: {
    // Simple mappings
    summary: 'title',
    description: 'description',
    assignee: 'assigned_to',
    duedate: 'due_date',
    labels: 'tags',

    // Status mapping (reverse)
    status: {
      'To Do': 'todo',
      'Open': 'todo',
      'Backlog': 'todo',
      'In Progress': 'in_progress',
      'In Development': 'in_progress',
      'In Review': 'in_progress',
      'Done': 'done',
      'Closed': 'done',
      'Resolved': 'done',
      'Blocked': 'blocked',
      'On Hold': 'blocked'
    },

    // Priority mapping (reverse)
    priority: {
      'Lowest': 'low',
      'Low': 'low',
      'Medium': 'medium',
      'High': 'high',
      'Highest': 'critical',
      'Critical': 'critical',
      'Blocker': 'critical'
    },

    // Issue type mapping (reverse)
    issuetype: {
      'Story': 'feature',
      'User Story': 'feature',
      'Bug': 'bug',
      'Defect': 'bug',
      'Improvement': 'enhancement',
      'Enhancement': 'enhancement',
      'Technical task': 'technical_debt',
      'Tech Debt': 'technical_debt',
      'Spike': 'research',
      'Research': 'research',
      'Documentation': 'documentation',
      'Task': 'feature' // Generic task defaults to feature
    }
  }
};

/**
 * Field Mapper Class
 *
 * Provides bidirectional field mapping between DR_AI tasks and JIRA issues
 * with support for custom field mappings and value transformations.
 */
export class FieldMapper {
  private mapping: FieldMapping;
  private config: FieldMapperConfig;
  private warnings: string[] = [];
  private errors: string[] = [];

  constructor(
    mapping?: FieldMapping,
    config?: Partial<FieldMapperConfig>
  ) {
    this.mapping = mapping || DEFAULT_FIELD_MAPPING;
    this.config = {
      jiraProjectKey: config?.jiraProjectKey || 'PROJ',
      defaultIssueType: config?.defaultIssueType || 'Task',
      dateFormat: config?.dateFormat || 'ISO',
      enableCustomFields: config?.enableCustomFields ?? true,
      strictMode: config?.strictMode ?? false
    };
  }

  /**
   * Map DR_AI task to JIRA issue format
   */
  public mapDRToJira(task: DevTask): MappingResult {
    this.clearMessages();
    const mappedFields: string[] = [];
    const skippedFields: string[] = [];

    try {
      const jiraIssue: JiraIssue = {
        fields: {
          project: {
            key: this.config.jiraProjectKey
          },
          summary: '',
          issuetype: {
            name: this.config.defaultIssueType!
          }
        }
      };

      const mapping = this.mapping.dr_to_jira;

      // Map simple fields
      if (task.title && mapping.title) {
        jiraIssue.fields.summary = this.truncateString(task.title, 255);
        mappedFields.push('title');
      } else {
        this.addError('Title is required for JIRA issue');
        return this.createResult(false);
      }

      if (task.description && mapping.description) {
        jiraIssue.fields.description = this.formatDescription(task.description, 'jira');
        mappedFields.push('description');
      }

      // Map assignee
      if (task.assigned_to && mapping.assigned_to) {
        jiraIssue.fields.assignee = {
          accountId: task.assigned_to
        };
        mappedFields.push('assigned_to');
      }

      // Map due date
      if (task.due_date && mapping.due_date) {
        jiraIssue.fields[mapping.due_date] = this.formatDate(task.due_date, 'jira');
        mappedFields.push('due_date');
      }

      // Map tags to labels
      if (task.tags && task.tags.length > 0 && mapping.tags) {
        jiraIssue.fields[mapping.tags] = task.tags.map(tag =>
          this.sanitizeLabel(tag)
        );
        mappedFields.push('tags');
      }

      // Map story points
      if (task.story_points !== undefined && mapping.story_points) {
        jiraIssue.fields[mapping.story_points] = task.story_points;
        mappedFields.push('story_points');
      }

      // Map status (complex mapping)
      if (task.status && mapping.status) {
        const jiraStatus = mapping.status[task.status];
        if (jiraStatus) {
          // Status is typically set via transitions, not directly
          // Store it for reference but don't set in fields
          jiraIssue.fields.status = { name: jiraStatus };
          mappedFields.push('status');
          this.addWarning('Status must be set via JIRA transitions, not direct field update');
        } else {
          this.addWarning(`No mapping found for status: ${task.status}`);
          skippedFields.push('status');
        }
      }

      // Map priority (complex mapping)
      if (task.priority && mapping.priority) {
        const jiraPriority = mapping.priority[task.priority];
        if (jiraPriority) {
          jiraIssue.fields.priority = { name: jiraPriority };
          mappedFields.push('priority');
        } else {
          this.addWarning(`No mapping found for priority: ${task.priority}`);
          skippedFields.push('priority');
        }
      }

      // Map task type to issue type (complex mapping)
      if (task.task_type && mapping.task_type) {
        const jiraIssueType = mapping.task_type[task.task_type];
        if (jiraIssueType) {
          jiraIssue.fields.issuetype = { name: jiraIssueType };
          mappedFields.push('task_type');
        } else {
          this.addWarning(`No mapping found for task_type: ${task.task_type}`);
          skippedFields.push('task_type');
        }
      }

      // Map custom fields
      if (this.config.enableCustomFields && mapping.custom_fields) {
        for (const [drField, jiraField] of Object.entries(mapping.custom_fields)) {
          if (task[drField] !== undefined) {
            jiraIssue.fields[jiraField] = this.transformValue(
              task[drField],
              this.getCustomFieldTransform(drField)
            );
            mappedFields.push(drField);
          }
        }
      }

      // Handle custom field mappings array
      if (this.mapping.custom_field_mappings) {
        for (const customMapping of this.mapping.custom_field_mappings) {
          if (task[customMapping.source_field] !== undefined) {
            jiraIssue.fields[customMapping.target_field] = this.transformValue(
              task[customMapping.source_field],
              customMapping.transform || 'none',
              customMapping.transform_config
            );
            mappedFields.push(customMapping.source_field);
          }
        }
      }

      return this.createResult(true, jiraIssue, mappedFields, skippedFields);

    } catch (error) {
      this.addError(`Mapping error: ${error instanceof Error ? error.message : String(error)}`);
      return this.createResult(false);
    }
  }

  /**
   * Map JIRA issue to DR_AI task format
   */
  public mapJiraToDR(issue: JiraIssue): MappingResult {
    this.clearMessages();
    const mappedFields: string[] = [];
    const skippedFields: string[] = [];

    try {
      const task: Partial<DevTask> = {};
      const mapping = this.mapping.jira_to_dr;

      // Map simple fields
      if (issue.fields.summary && mapping.summary) {
        task[mapping.summary] = issue.fields.summary;
        mappedFields.push('summary');
      }

      if (issue.fields.description && mapping.description) {
        task[mapping.description] = this.formatDescription(issue.fields.description, 'dr');
        mappedFields.push('description');
      }

      // Map assignee
      if (issue.fields.assignee && mapping.assignee) {
        // Use accountId if available, otherwise emailAddress or displayName
        const assigneeId = issue.fields.assignee.accountId ||
                          issue.fields.assignee.emailAddress ||
                          issue.fields.assignee.displayName;
        if (assigneeId) {
          task[mapping.assignee] = assigneeId;
          mappedFields.push('assignee');
        }
      }

      // Map due date
      if (issue.fields.duedate && mapping.duedate) {
        task[mapping.duedate] = this.formatDate(issue.fields.duedate, 'dr');
        mappedFields.push('duedate');
      }

      // Map labels to tags
      if (issue.fields.labels && issue.fields.labels.length > 0 && mapping.labels) {
        task[mapping.labels] = issue.fields.labels;
        mappedFields.push('labels');
      }

      // Map status (complex mapping)
      if (issue.fields.status && mapping.status) {
        const statusName = issue.fields.status.name;
        const drStatus = mapping.status[statusName];

        if (drStatus) {
          task.status = drStatus as DevTask['status'];
          mappedFields.push('status');
        } else {
          // Try to map based on status category if direct mapping fails
          const categoryKey = issue.fields.status.statusCategory?.key;
          let fallbackStatus: DevTask['status'] = 'todo';

          switch (categoryKey) {
            case 'new':
              fallbackStatus = 'todo';
              break;
            case 'indeterminate':
            case 'in-progress':
              fallbackStatus = 'in_progress';
              break;
            case 'done':
              fallbackStatus = 'done';
              break;
            default:
              fallbackStatus = 'todo';
          }

          task.status = fallbackStatus;
          this.addWarning(`No exact mapping for status '${statusName}', using fallback: ${fallbackStatus}`);
          mappedFields.push('status');
        }
      }

      // Map priority (complex mapping)
      if (issue.fields.priority && mapping.priority) {
        const priorityName = issue.fields.priority.name;
        const drPriority = mapping.priority[priorityName];

        if (drPriority) {
          task.priority = drPriority as DevTask['priority'];
          mappedFields.push('priority');
        } else {
          this.addWarning(`No mapping found for priority: ${priorityName}`);
          skippedFields.push('priority');
        }
      }

      // Map issue type (complex mapping)
      if (issue.fields.issuetype && mapping.issuetype) {
        const issueTypeName = issue.fields.issuetype.name;
        const drTaskType = mapping.issuetype[issueTypeName];

        if (drTaskType) {
          task.task_type = drTaskType as DevTask['task_type'];
          mappedFields.push('issuetype');
        } else {
          this.addWarning(`No mapping found for issue type: ${issueTypeName}, defaulting to 'feature'`);
          task.task_type = 'feature';
          mappedFields.push('issuetype');
        }
      }

      // Map story points from custom field
      if (issue.fields.customfield_10000 !== undefined) {
        task.story_points = Number(issue.fields.customfield_10000);
        mappedFields.push('story_points');
      }

      // Map custom fields
      if (this.config.enableCustomFields && mapping.custom_fields) {
        for (const [jiraField, drField] of Object.entries(mapping.custom_fields)) {
          if (issue.fields[jiraField] !== undefined) {
            task[drField] = this.transformValue(
              issue.fields[jiraField],
              this.getCustomFieldTransform(drField)
            );
            mappedFields.push(jiraField);
          }
        }
      }

      // Handle custom field mappings array (reverse direction)
      if (this.mapping.custom_field_mappings) {
        for (const customMapping of this.mapping.custom_field_mappings) {
          if (issue.fields[customMapping.target_field] !== undefined) {
            task[customMapping.source_field] = this.transformValue(
              issue.fields[customMapping.target_field],
              customMapping.transform || 'none',
              customMapping.transform_config
            );
            mappedFields.push(customMapping.target_field);
          }
        }
      }

      // Store JIRA-specific metadata
      if (issue.key) {
        task.jira_issue_key = issue.key;
      }

      task.jira_sync_status = 'synced';
      task.last_jira_sync = new Date().toISOString();

      return this.createResult(true, task, mappedFields, skippedFields);

    } catch (error) {
      this.addError(`Mapping error: ${error instanceof Error ? error.message : String(error)}`);
      return this.createResult(false);
    }
  }

  /**
   * Validate field mapping configuration
   */
  public validateMapping(mapping: FieldMapping): MappingResult {
    this.clearMessages();

    try {
      // Check required fields
      if (!mapping.dr_to_jira || !mapping.jira_to_dr) {
        this.addError('Both dr_to_jira and jira_to_dr mappings are required');
        return this.createResult(false);
      }

      // Validate status mappings
      if (mapping.dr_to_jira.status) {
        const validDRStatuses = ['todo', 'in_progress', 'done', 'blocked'];
        for (const status of Object.keys(mapping.dr_to_jira.status)) {
          if (!validDRStatuses.includes(status)) {
            this.addWarning(`Invalid DR status in mapping: ${status}`);
          }
        }
      }

      // Validate priority mappings
      if (mapping.dr_to_jira.priority) {
        const validDRPriorities = ['low', 'medium', 'high', 'critical'];
        for (const priority of Object.keys(mapping.dr_to_jira.priority)) {
          if (!validDRPriorities.includes(priority)) {
            this.addWarning(`Invalid DR priority in mapping: ${priority}`);
          }
        }
      }

      // Validate task type mappings
      if (mapping.dr_to_jira.task_type) {
        const validTaskTypes = ['feature', 'bug', 'enhancement', 'technical_debt', 'research', 'documentation'];
        for (const taskType of Object.keys(mapping.dr_to_jira.task_type)) {
          if (!validTaskTypes.includes(taskType)) {
            this.addWarning(`Invalid DR task type in mapping: ${taskType}`);
          }
        }
      }

      // Validate custom field mappings
      if (mapping.custom_field_mappings) {
        for (const customMapping of mapping.custom_field_mappings) {
          if (!customMapping.source_field || !customMapping.target_field) {
            this.addError('Custom field mapping requires both source_field and target_field');
          }

          const validTransforms = ['none', 'date', 'number', 'boolean', 'json', 'custom'];
          if (customMapping.transform && !validTransforms.includes(customMapping.transform)) {
            this.addWarning(`Invalid transform type: ${customMapping.transform}`);
          }
        }
      }

      return this.createResult(this.errors.length === 0);

    } catch (error) {
      this.addError(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
      return this.createResult(false);
    }
  }

  /**
   * Get available field mapping presets
   */
  public static getPresets(): Record<string, FieldMapping> {
    return {
      default: DEFAULT_FIELD_MAPPING,
      minimal: {
        ...DEFAULT_FIELD_MAPPING,
        mapping_name: 'Minimal Mapping',
        dr_to_jira: {
          title: 'summary',
          description: 'description',
          status: DEFAULT_FIELD_MAPPING.dr_to_jira.status
        },
        jira_to_dr: {
          summary: 'title',
          description: 'description',
          status: DEFAULT_FIELD_MAPPING.jira_to_dr.status
        }
      },
      agile: {
        ...DEFAULT_FIELD_MAPPING,
        mapping_name: 'Agile Team Mapping',
        dr_to_jira: {
          ...DEFAULT_FIELD_MAPPING.dr_to_jira,
          story_points: 'customfield_10000',
          sprint_id: 'customfield_10001'
        },
        jira_to_dr: {
          ...DEFAULT_FIELD_MAPPING.jira_to_dr,
          custom_fields: {
            customfield_10000: 'story_points',
            customfield_10001: 'sprint_id'
          }
        }
      }
    };
  }

  /**
   * Merge custom mapping with default mapping
   */
  public static mergeWithDefault(customMapping: Partial<FieldMapping>): FieldMapping {
    return {
      ...DEFAULT_FIELD_MAPPING,
      ...customMapping,
      dr_to_jira: {
        ...DEFAULT_FIELD_MAPPING.dr_to_jira,
        ...(customMapping.dr_to_jira || {})
      },
      jira_to_dr: {
        ...DEFAULT_FIELD_MAPPING.jira_to_dr,
        ...(customMapping.jira_to_dr || {})
      }
    };
  }

  // Private helper methods

  private clearMessages(): void {
    this.warnings = [];
    this.errors = [];
  }

  private addWarning(message: string): void {
    this.warnings.push(message);
    if (!this.config.strictMode) {
      console.warn(`[FieldMapper] ${message}`);
    }
  }

  private addError(message: string): void {
    this.errors.push(message);
    if (this.config.strictMode) {
      throw new Error(message);
    }
    console.error(`[FieldMapper] ${message}`);
  }

  private createResult(
    success: boolean,
    data?: any,
    mappedFields?: string[],
    skippedFields?: string[]
  ): MappingResult {
    return {
      success,
      data,
      warnings: this.warnings.length > 0 ? this.warnings : undefined,
      errors: this.errors.length > 0 ? this.errors : undefined,
      mappedFields,
      skippedFields
    };
  }

  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }

  private formatDescription(description: any, target: 'jira' | 'dr'): string {
    if (!description) return '';

    // Handle JIRA's Atlassian Document Format (ADF)
    if (typeof description === 'object' && description.content) {
      // Convert ADF to plain text (simplified)
      return this.extractTextFromADF(description);
    }

    // Handle plain text
    if (typeof description === 'string') {
      if (target === 'jira') {
        // Could convert markdown to ADF if needed
        return description;
      }
      return description;
    }

    return String(description);
  }

  private extractTextFromADF(adf: any): string {
    let text = '';

    const extractFromNode = (node: any): void => {
      if (node.type === 'text') {
        text += node.text || '';
      } else if (node.content && Array.isArray(node.content)) {
        node.content.forEach(extractFromNode);
      }
    };

    if (adf.content && Array.isArray(adf.content)) {
      adf.content.forEach(extractFromNode);
    }

    return text.trim();
  }

  private formatDate(date: string, target: 'jira' | 'dr'): string {
    // Both JIRA and DR use ISO format (YYYY-MM-DD), but validate and ensure correct format
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        this.addWarning(`Invalid date format: ${date}`);
        return date;
      }
      return dateObj.toISOString().split('T')[0];
    } catch (error) {
      this.addWarning(`Error formatting date: ${date}`);
      return date;
    }
  }

  private sanitizeLabel(label: string): string {
    // JIRA labels cannot contain spaces
    return label.replace(/\s+/g, '_').toLowerCase();
  }

  private transformValue(
    value: any,
    transform: string,
    config?: any
  ): any {
    switch (transform) {
      case 'date':
        return this.formatDate(String(value), 'jira');

      case 'number':
        return Number(value);

      case 'boolean':
        return Boolean(value);

      case 'json':
        return typeof value === 'string' ? JSON.parse(value) : value;

      case 'custom':
        if (config && typeof config === 'function') {
          return config(value);
        }
        return value;

      case 'none':
      default:
        return value;
    }
  }

  private getCustomFieldTransform(field: string): string {
    // Infer transform type based on field name
    if (field.includes('date') || field.includes('_at')) {
      return 'date';
    }
    if (field.includes('points') || field.includes('count') || field.includes('number')) {
      return 'number';
    }
    if (field.includes('is_') || field.includes('has_') || field.includes('enabled')) {
      return 'boolean';
    }
    return 'none';
  }
}

/**
 * Export convenience functions
 */

export function createDefaultMapper(config?: Partial<FieldMapperConfig>): FieldMapper {
  return new FieldMapper(DEFAULT_FIELD_MAPPING, config);
}

export function validateFieldMapping(mapping: FieldMapping): MappingResult {
  const mapper = new FieldMapper(mapping);
  return mapper.validateMapping(mapping);
}

export { DEFAULT_FIELD_MAPPING };