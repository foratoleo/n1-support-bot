const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_PAGE = 1;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

const TASK_STATUSES = ['todo', 'in_progress', 'testing', 'in_review', 'done', 'blocked', 'cancelled'] as const;
const SPRINT_STATUSES = ['planning', 'active', 'completed', 'cancelled'] as const;

export type TaskStatus = typeof TASK_STATUSES[number];
export type SprintStatus = typeof SPRINT_STATUSES[number];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid);
}

export function validatePagination(page: number, limit: number): ValidationResult {
  if (page < MIN_PAGE) {
    return { valid: false, error: `Page must be at least ${MIN_PAGE}` };
  }

  if (limit < MIN_LIMIT || limit > MAX_LIMIT) {
    return { valid: false, error: `Limit must be between ${MIN_LIMIT} and ${MAX_LIMIT}` };
  }

  return { valid: true };
}

export function validateEnum<T extends readonly string[]>(
  value: string,
  validValues: T,
  fieldName: string = 'value'
): ValidationResult {
  if (!validValues.includes(value)) {
    return {
      valid: false,
      error: `Invalid ${fieldName}: ${value}. Valid values are: ${validValues.join(', ')}`
    };
  }
  return { valid: true };
}

export function validateTaskStatus(status: string): ValidationResult {
  return validateEnum(status, TASK_STATUSES, 'task status');
}

export function validateSprintStatus(status: string): ValidationResult {
  return validateEnum(status, SPRINT_STATUSES, 'sprint status');
}

export function validateTaskStatuses(statuses: unknown): ValidationResult {
  if (!Array.isArray(statuses)) {
    return {
      valid: false,
      error: `status filter must be an array of strings. Valid values are: ${TASK_STATUSES.join(', ')}`
    };
  }

  const invalidStatuses = statuses.filter(s => !TASK_STATUSES.includes(s as TaskStatus));

  if (invalidStatuses.length > 0) {
    return {
      valid: false,
      error: `Invalid status values: ${invalidStatuses.join(', ')}. Valid values are: ${TASK_STATUSES.join(', ')}`
    };
  }

  return { valid: true };
}

export function validateSprintStatuses(statuses: unknown): ValidationResult {
  if (!Array.isArray(statuses)) {
    return {
      valid: false,
      error: `status filter must be an array of strings. Valid values are: ${SPRINT_STATUSES.join(', ')}`
    };
  }

  const invalidStatuses = statuses.filter(s => !SPRINT_STATUSES.includes(s as SprintStatus));

  if (invalidStatuses.length > 0) {
    return {
      valid: false,
      error: `Invalid status values: ${invalidStatuses.join(', ')}. Valid values are: ${SPRINT_STATUSES.join(', ')}`
    };
  }

  return { valid: true };
}

export function validatePositiveInteger(value: number, fieldName: string = 'value'): ValidationResult {
  if (!Number.isInteger(value) || value < 0) {
    return {
      valid: false,
      error: `${fieldName} must be a positive integer`
    };
  }

  return { valid: true };
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TASK_TYPES = ['feature', 'bug', 'enhancement', 'technical_debt', 'research', 'documentation', 'testing', 'deployment', 'maintenance'] as const;
const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical', 'urgent'] as const;

export type TaskType = typeof TASK_TYPES[number];
export type TaskPriority = typeof TASK_PRIORITIES[number];

export function validateDateFormat(dateStr: string, fieldName: string = 'date'): ValidationResult {
  if (!DATE_REGEX.test(dateStr)) {
    return {
      valid: false,
      error: `${fieldName} must be in YYYY-MM-DD format`
    };
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return {
      valid: false,
      error: `${fieldName} is not a valid date`
    };
  }

  return { valid: true };
}

export function validateDateRange(fromDate: string, toDate: string): ValidationResult {
  const fromValidation = validateDateFormat(fromDate, 'date_from');
  if (!fromValidation.valid) {
    return fromValidation;
  }

  const toValidation = validateDateFormat(toDate, 'date_to');
  if (!toValidation.valid) {
    return toValidation;
  }

  if (new Date(fromDate) > new Date(toDate)) {
    return {
      valid: false,
      error: 'date_from must be less than or equal to date_to'
    };
  }

  return { valid: true };
}

export function validateTags(tags: unknown): ValidationResult {
  if (!Array.isArray(tags)) {
    return { valid: false, error: 'tags must be an array' };
  }

  for (let i = 0; i < tags.length; i++) {
    if (typeof tags[i] !== 'string') {
      return { valid: false, error: `tags[${i}] must be a string` };
    }
    if (tags[i].trim() === '') {
      return { valid: false, error: `tags[${i}] cannot be empty` };
    }
  }

  return { valid: true };
}

export function validateTaskType(taskType: string): ValidationResult {
  return validateEnum(taskType, TASK_TYPES, 'task type');
}

export function validateTaskTypes(taskTypes: unknown): ValidationResult {
  if (!Array.isArray(taskTypes)) {
    return {
      valid: false,
      error: `task_type filter must be an array of strings. Valid values are: ${TASK_TYPES.join(', ')}`
    };
  }

  const invalidTypes = taskTypes.filter(t => !TASK_TYPES.includes(t as TaskType));

  if (invalidTypes.length > 0) {
    return {
      valid: false,
      error: `Invalid task type values: ${invalidTypes.join(', ')}. Valid values are: ${TASK_TYPES.join(', ')}`
    };
  }

  return { valid: true };
}

export function validateTaskPriority(priority: string): ValidationResult {
  return validateEnum(priority, TASK_PRIORITIES, 'task priority');
}

export function validateTaskPriorities(priorities: unknown): ValidationResult {
  if (!Array.isArray(priorities)) {
    return {
      valid: false,
      error: `priority filter must be an array of strings. Valid values are: ${TASK_PRIORITIES.join(', ')}`
    };
  }

  const invalidPriorities = priorities.filter(p => !TASK_PRIORITIES.includes(p as TaskPriority));

  if (invalidPriorities.length > 0) {
    return {
      valid: false,
      error: `Invalid priority values: ${invalidPriorities.join(', ')}. Valid values are: ${TASK_PRIORITIES.join(', ')}`
    };
  }

  return { valid: true };
}

export function validateTimestamp(timestamp: string, fieldName: string = 'timestamp'): ValidationResult {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    return {
      valid: false,
      error: `${fieldName} must be a valid ISO 8601 timestamp`
    };
  }

  return { valid: true };
}

export function validateTimestampRange(fromTimestamp: string, toTimestamp: string): ValidationResult {
  const fromValidation = validateTimestamp(fromTimestamp, 'date_from');
  if (!fromValidation.valid) {
    return fromValidation;
  }

  const toValidation = validateTimestamp(toTimestamp, 'date_to');
  if (!toValidation.valid) {
    return toValidation;
  }

  if (new Date(fromTimestamp) > new Date(toTimestamp)) {
    return {
      valid: false,
      error: 'date_from must be less than or equal to date_to'
    };
  }

  return { valid: true };
}
