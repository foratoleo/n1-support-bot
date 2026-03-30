import { TaskStatus } from '../types.ts';

const VALID_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done', 'blocked'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MIN_PAGE = 1;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

export function validateStatus(status: string): boolean {
  return VALID_STATUSES.includes(status as TaskStatus);
}

export function validateUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid);
}

export function validatePagination(page: number, limit: number): { valid: boolean; error?: string } {
  if (page < MIN_PAGE) {
    return { valid: false, error: `Page must be at least ${MIN_PAGE}` };
  }

  if (limit < MIN_LIMIT || limit > MAX_LIMIT) {
    return { valid: false, error: `Limit must be between ${MIN_LIMIT} and ${MAX_LIMIT}` };
  }

  return { valid: true };
}

export function validateStatuses(statuses: string[]): { valid: boolean; error?: string } {
  const invalidStatuses = statuses.filter(s => !validateStatus(s));

  if (invalidStatuses.length > 0) {
    return {
      valid: false,
      error: `Invalid status values: ${invalidStatuses.join(', ')}. Valid values are: ${VALID_STATUSES.join(', ')}`
    };
  }

  return { valid: true };
}
