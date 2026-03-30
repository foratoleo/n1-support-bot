import { RequestBody } from './types.ts';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateRequestBody(body: RequestBody): ValidationResult {
  if (!body.content?.trim()) {
    return { valid: false, error: 'Content is required' };
  }

  if (!body.project_id?.trim()) {
    return { valid: false, error: 'Project ID is required' };
  }

  return { valid: true };
}

export function validateMethod(method: string): ValidationResult {
  if (method !== 'POST') {
    return { valid: false, error: 'Method not allowed' };
  }

  return { valid: true };
}
