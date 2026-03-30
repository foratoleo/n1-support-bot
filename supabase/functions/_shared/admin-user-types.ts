/**
 * Admin User Creation Types for Edge Functions
 *
 * Type definitions for the admin-create-user edge function.
 * These types define the request/response structure for creating users
 * with admin privileges via Supabase Auth Admin API.
 *
 * @module _shared/admin-user-types
 */

/**
 * Valid role types for team members
 * Matches TeamMemberProfile from frontend types
 */
export type TeamMemberRole =
  // Planning
  | 'pm'
  | 'po'
  | 'analyst'
  | 'requirements_analyst'
  | 'business_analyst'
  | 'designer'
  | 'ux_researcher'
  // Development
  | 'fullstack'
  | 'frontend'
  | 'backend'
  | 'mobile'
  | 'devops'
  | 'tech_lead'
  | 'architect'
  | 'data_engineer'
  // Quality
  | 'qa'
  | 'test_analyst'
  | 'automation_qa'
  | 'code_reviewer'
  // Governance
  | 'admin'
  | 'director'
  | 'cto'
  | 'ceo'
  | 'scrum_master';

/**
 * Project assignment payload for user creation
 */
export interface ProjectAssignment {
  /** UUID of the project to assign */
  project_id: string;
  /** Role in the project (optional, uses profile type) */
  role?: TeamMemberRole;
}

/**
 * Request body for admin user creation
 */
export interface AdminCreateUserRequest {
  /** User email address (required, must be unique) */
  email: string;
  /** User password (required, min 6 characters) */
  password: string;
  /** User's full name (optional) */
  full_name?: string;
  /** URL to user's avatar image (optional) */
  avatar_url?: string;
  /** Array of project assignments (optional) */
  project_assignments?: ProjectAssignment[];
}

/**
 * Result of a single project assignment operation
 */
export interface ProjectAssignmentResult {
  /** UUID of the project */
  project_id: string;
  /** Whether the assignment was successful */
  success: boolean;
  /** Error message if assignment failed */
  error?: string;
}

/**
 * Profile data returned after user creation
 */
export interface CreatedProfileData {
  /** User UUID (same as auth.users id) */
  id: string;
  /** User email */
  email: string;
  /** User's full name */
  full_name?: string;
  /** Avatar URL */
  avatar_url?: string;
  /** Timestamp when profile was created */
  created_at: string;
  /** Timestamp when profile was last updated */
  updated_at: string;
}

/**
 * Successful response from admin user creation
 */
export interface AdminCreateUserSuccessResponse {
  success: true;
  /** Created user's UUID */
  user_id: string;
  /** User email */
  email: string;
  /** Profile data from profiles table */
  profile: CreatedProfileData;
  /** Results of project assignments */
  assignments_result: ProjectAssignmentResult[];
}

/**
 * Error response from admin user creation
 */
export interface AdminCreateUserErrorResponse {
  success: false;
  /** Error code for client handling */
  code: AdminErrorCode;
  /** Human-readable error message */
  error: string;
  /** Field that caused the error (for validation errors) */
  field?: string;
}

/**
 * Union type for all possible responses
 */
export type AdminCreateUserResponse =
  | AdminCreateUserSuccessResponse
  | AdminCreateUserErrorResponse;

/**
 * Error codes for admin user creation
 */
export type AdminErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'DUPLICATE_EMAIL'
  | 'INVALID_PASSWORD'
  | 'USER_CREATION_FAILED'
  | 'PROFILE_CREATION_FAILED'
  | 'PROJECT_ASSIGNMENT_FAILED'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR'
  | 'METHOD_NOT_ALLOWED';

/**
 * Maps error codes to HTTP status codes
 */
export const ERROR_STATUS_MAP: Record<AdminErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  DUPLICATE_EMAIL: 409,
  INVALID_PASSWORD: 400,
  USER_CREATION_FAILED: 500,
  PROFILE_CREATION_FAILED: 500,
  PROJECT_ASSIGNMENT_FAILED: 500,
  DATABASE_ERROR: 500,
  INTERNAL_ERROR: 500,
  METHOD_NOT_ALLOWED: 405,
};

/**
 * Get HTTP status code for an error code
 */
export function getStatusCodeForError(code: AdminErrorCode): number {
  return ERROR_STATUS_MAP[code] || 500;
}

/**
 * Creates a success response object
 */
export function createSuccessResponse(
  userId: string,
  email: string,
  profile: CreatedProfileData,
  assignmentsResult: ProjectAssignmentResult[]
): AdminCreateUserSuccessResponse {
  return {
    success: true,
    user_id: userId,
    email,
    profile,
    assignments_result: assignmentsResult,
  };
}

/**
 * Creates an error response object
 */
export function createErrorResponse(
  code: AdminErrorCode,
  error: string,
  field?: string
): AdminCreateUserErrorResponse {
  return {
    success: false,
    code,
    error,
    field,
  };
}

/**
 * Governance roles that are allowed to create users
 */
export const ADMIN_ROLES: TeamMemberRole[] = ['admin', 'director', 'cto', 'ceo'];

/**
 * Check if a role has admin permissions
 */
export function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role as TeamMemberRole);
}

/**
 * All valid team member roles (for validation)
 */
export const VALID_ROLES: TeamMemberRole[] = [
  // Planning
  'pm',
  'po',
  'analyst',
  'requirements_analyst',
  'business_analyst',
  'designer',
  'ux_researcher',
  // Development
  'fullstack',
  'frontend',
  'backend',
  'mobile',
  'devops',
  'tech_lead',
  'architect',
  'data_engineer',
  // Quality
  'qa',
  'test_analyst',
  'automation_qa',
  'code_reviewer',
  // Governance
  'admin',
  'director',
  'cto',
  'ceo',
  'scrum_master',
];

/**
 * Check if a role string is valid
 */
export function isValidRole(role: string): role is TeamMemberRole {
  return VALID_ROLES.includes(role as TeamMemberRole);
}

// ============================================================================
// Admin Soft Delete User Types
// ============================================================================

/**
 * Request body for admin soft delete user
 */
export interface AdminSoftDeleteUserRequest {
  /** UUID of the user to soft delete */
  user_id: string;
  /** Whether to also soft delete project memberships (default: true) */
  remove_from_projects?: boolean;
  /** If true, only validate deletion constraints without executing delete (default: false) */
  validate_only?: boolean;
}

/**
 * Information about a project owned by the user
 */
export interface OwnedProjectInfo {
  /** Project UUID */
  id: string;
  /** Project name */
  name: string;
}

/**
 * Validation result before deletion
 */
export interface UserDeletionValidation {
  /** Whether the user can be deleted */
  can_delete: boolean;
  /** Projects owned by the user (blocks deletion) */
  owned_projects: OwnedProjectInfo[];
  /** Number of project memberships (for information) */
  project_memberships: number;
  /** Error message if deletion is blocked */
  blocking_reason?: string;
}

/**
 * Successful response from admin soft delete user
 */
export interface AdminSoftDeleteUserSuccessResponse {
  success: true;
  /** Deleted user's UUID */
  user_id: string;
  /** Number of project memberships removed */
  memberships_removed: number;
  /** Timestamp when user was deleted */
  deleted_at: string;
}

/**
 * Error response from admin soft delete user
 */
export interface AdminSoftDeleteUserErrorResponse {
  success: false;
  /** Error code for client handling */
  code: AdminSoftDeleteErrorCode;
  /** Human-readable error message */
  error: string;
  /** Validation result (for ownership blocking) */
  validation?: UserDeletionValidation;
}

/**
 * Union type for soft delete responses
 */
export type AdminSoftDeleteUserResponse =
  | AdminSoftDeleteUserSuccessResponse
  | AdminSoftDeleteUserErrorResponse;

/**
 * Error codes specific to soft delete operation
 */
export type AdminSoftDeleteErrorCode =
  | 'USER_NOT_FOUND'
  | 'USER_ALREADY_DELETED'
  | 'OWNERSHIP_TRANSFER_REQUIRED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'DATABASE_ERROR'
  | 'AUTH_UPDATE_FAILED'
  | 'INTERNAL_ERROR'
  | 'METHOD_NOT_ALLOWED';

/**
 * Maps soft delete error codes to HTTP status codes
 */
export const SOFT_DELETE_ERROR_STATUS_MAP: Record<AdminSoftDeleteErrorCode, number> = {
  USER_NOT_FOUND: 404,
  USER_ALREADY_DELETED: 409,
  OWNERSHIP_TRANSFER_REQUIRED: 409,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  DATABASE_ERROR: 500,
  AUTH_UPDATE_FAILED: 500,
  INTERNAL_ERROR: 500,
  METHOD_NOT_ALLOWED: 405,
};

/**
 * Get HTTP status code for a soft delete error code
 */
export function getSoftDeleteStatusCode(code: AdminSoftDeleteErrorCode): number {
  return SOFT_DELETE_ERROR_STATUS_MAP[code] || 500;
}

/**
 * Creates a soft delete success response object
 */
export function createSoftDeleteSuccessResponse(
  userId: string,
  membershipsRemoved: number,
  deletedAt: string
): AdminSoftDeleteUserSuccessResponse {
  return {
    success: true,
    user_id: userId,
    memberships_removed: membershipsRemoved,
    deleted_at: deletedAt,
  };
}

/**
 * Creates a soft delete error response object
 */
export function createSoftDeleteErrorResponse(
  code: AdminSoftDeleteErrorCode,
  error: string,
  validation?: UserDeletionValidation
): AdminSoftDeleteUserErrorResponse {
  return {
    success: false,
    code,
    error,
    validation,
  };
}
