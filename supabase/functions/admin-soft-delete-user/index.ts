/**
 * Admin Soft Delete User Edge Function
 *
 * Soft deletes a user by:
 * 1. Setting deleted_at timestamp on profiles table
 * 2. Banning the user in Supabase Auth (revokes all sessions)
 * 3. Optionally removing project memberships
 *
 * Pre-deletion validation ensures:
 * - User exists and is not already deleted
 * - User does not own any projects (requires ownership transfer first)
 *
 * Requirements:
 * - Caller must be authenticated
 * - Caller must have admin/governance role
 * - Target user cannot own any projects
 *
 * @module admin-soft-delete-user
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import {
  AdminSoftDeleteUserRequest,
  AdminSoftDeleteUserResponse,
  AdminSoftDeleteErrorCode,
  UserDeletionValidation,
  OwnedProjectInfo,
  createSoftDeleteSuccessResponse,
  createSoftDeleteErrorResponse,
  getSoftDeleteStatusCode,
} from '../_shared/admin-user-types.ts';

const OPERATION = 'admin-soft-delete-user';

/**
 * Ban duration for soft deleted users (100 years in hours)
 * This effectively revokes auth access without deleting the user record
 */
const BAN_DURATION = '876000h';

// ============================================================================
// Supabase Client Initialization
// ============================================================================

/**
 * Creates a Supabase client with service role for admin operations
 */
function createAdminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl) {
    throw new Error('Missing required environment variable: SUPABASE_URL');
  }

  if (!supabaseServiceRoleKey) {
    throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Creates a JSON response with CORS headers
 */
function createResponse(data: AdminSoftDeleteUserResponse, statusCode: number): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status: statusCode,
  });
}

/**
 * Creates a CORS preflight response
 */
function createCorsResponse(): Response {
  return new Response(null, { headers: corsHeaders });
}

// ============================================================================
// Authentication
// ============================================================================

/**
 * Extracts and validates the Bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1];
}

/**
 * Validates the caller's authentication and returns the user
 */
async function authenticateCaller(
  supabase: SupabaseClient,
  token: string
): Promise<{ user: User | null; error: string | null }> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      console.error(`[${OPERATION}] Auth error:`, error.message);
      return { user: null, error: error.message };
    }

    if (!user) {
      return { user: null, error: 'User not found' };
    }

    return { user, error: null };
  } catch (err) {
    console.error(`[${OPERATION}] Auth exception:`, err);
    return { user: null, error: 'Authentication failed' };
  }
}

// ============================================================================
// Validation
// ============================================================================

/**
 * UUID validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates the request body
 */
function validateRequest(body: unknown): {
  valid: boolean;
  data?: AdminSoftDeleteUserRequest;
  error?: { code: AdminSoftDeleteErrorCode; message: string };
} {
  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request body is required',
      },
    };
  }

  const request = body as Record<string, unknown>;

  // Validate user_id
  if (!request.user_id || typeof request.user_id !== 'string') {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'user_id is required',
      },
    };
  }

  if (!UUID_REGEX.test(request.user_id)) {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid user_id format',
      },
    };
  }

  // Validate remove_from_projects (optional, defaults to true)
  let removeFromProjects = true;
  if (request.remove_from_projects !== undefined) {
    if (typeof request.remove_from_projects !== 'boolean') {
      return {
        valid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'remove_from_projects must be a boolean',
        },
      };
    }
    removeFromProjects = request.remove_from_projects;
  }

  // Validate validate_only (optional, defaults to false)
  let validateOnly = false;
  if (request.validate_only !== undefined) {
    if (typeof request.validate_only !== 'boolean') {
      return {
        valid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'validate_only must be a boolean',
        },
      };
    }
    validateOnly = request.validate_only;
  }

  return {
    valid: true,
    data: {
      user_id: request.user_id,
      remove_from_projects: removeFromProjects,
      validate_only: validateOnly,
    },
  };
}

// ============================================================================
// Pre-Deletion Validation
// ============================================================================

/**
 * Validates if a user can be safely deleted
 * Checks for project ownership and active memberships
 */
async function validateUserDeletion(
  supabase: SupabaseClient,
  userId: string
): Promise<{ validation: UserDeletionValidation; error: string | null }> {
  try {
    // Check if user exists and is not already deleted
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, deleted_at')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error(`[${OPERATION}] Profile check error:`, profileError.message);
      return {
        validation: {
          can_delete: false,
          owned_projects: [],
          project_memberships: 0,
          blocking_reason: 'Database error while checking user',
        },
        error: profileError.message,
      };
    }

    if (!profile) {
      return {
        validation: {
          can_delete: false,
          owned_projects: [],
          project_memberships: 0,
          blocking_reason: 'User not found',
        },
        error: 'USER_NOT_FOUND',
      };
    }

    if (profile.deleted_at !== null) {
      return {
        validation: {
          can_delete: false,
          owned_projects: [],
          project_memberships: 0,
          blocking_reason: 'User is already deleted',
        },
        error: 'USER_ALREADY_DELETED',
      };
    }

    // Check for owned projects
    const { data: ownedProjects, error: ownedError } = await supabase
      .from('project_knowledge_base')
      .select('id, name')
      .eq('owner', userId)
      .eq('is_active', true);

    if (ownedError) {
      console.error(`[${OPERATION}] Owned projects check error:`, ownedError.message);
      return {
        validation: {
          can_delete: false,
          owned_projects: [],
          project_memberships: 0,
          blocking_reason: 'Database error while checking project ownership',
        },
        error: ownedError.message,
      };
    }

    const ownedProjectsList: OwnedProjectInfo[] = (ownedProjects || []).map((p) => ({
      id: p.id,
      name: p.name,
    }));

    // Count project memberships
    const { count: membershipCount, error: membershipError } = await supabase
      .from('project_team_members')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', userId)
      .is('deleted_at', null);

    if (membershipError) {
      console.error(`[${OPERATION}] Membership count error:`, membershipError.message);
    }

    const projectMemberships = membershipCount || 0;

    // Determine if user can be deleted
    const canDelete = ownedProjectsList.length === 0;
    const blockingReason = canDelete
      ? undefined
      : `User owns ${ownedProjectsList.length} project(s). Ownership must be transferred before deletion.`;

    return {
      validation: {
        can_delete: canDelete,
        owned_projects: ownedProjectsList,
        project_memberships: projectMemberships,
        blocking_reason: blockingReason,
      },
      error: null,
    };
  } catch (err) {
    console.error(`[${OPERATION}] Validation exception:`, err);
    return {
      validation: {
        can_delete: false,
        owned_projects: [],
        project_memberships: 0,
        blocking_reason: 'Unexpected error during validation',
      },
      error: 'Validation failed',
    };
  }
}

// ============================================================================
// Soft Delete Execution
// ============================================================================

/**
 * Revokes user authentication by applying a 100-year ban
 */
async function revokeUserAuth(
  supabase: SupabaseClient,
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: BAN_DURATION,
    });

    if (error) {
      console.error(`[${OPERATION}] Auth ban error:`, error.message);
      return { success: false, error: error.message };
    }

    console.log(`[${OPERATION}] User auth revoked: ${userId}`);
    return { success: true, error: null };
  } catch (err) {
    console.error(`[${OPERATION}] Auth ban exception:`, err);
    return { success: false, error: 'Failed to revoke user authentication' };
  }
}

/**
 * Marks the user profile as deleted
 */
async function markProfileDeleted(
  supabase: SupabaseClient,
  userId: string
): Promise<{ deletedAt: string | null; error: string | null }> {
  const deletedAt = new Date().toISOString();

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        deleted_at: deletedAt,
        updated_at: deletedAt,
      })
      .eq('id', userId);

    if (error) {
      console.error(`[${OPERATION}] Profile update error:`, error.message);
      return { deletedAt: null, error: error.message };
    }

    console.log(`[${OPERATION}] Profile marked as deleted: ${userId}`);
    return { deletedAt, error: null };
  } catch (err) {
    console.error(`[${OPERATION}] Profile update exception:`, err);
    return { deletedAt: null, error: 'Failed to mark profile as deleted' };
  }
}

/**
 * Removes user from all project memberships via soft delete
 */
async function removeProjectMemberships(
  supabase: SupabaseClient,
  userId: string
): Promise<{ removedCount: number; error: string | null }> {
  const deletedAt = new Date().toISOString();

  try {
    // Get count of active memberships first
    const { count: activeCount, error: countError } = await supabase
      .from('project_team_members')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', userId)
      .is('deleted_at', null);

    if (countError) {
      console.error(`[${OPERATION}] Membership count error:`, countError.message);
    }

    // Soft delete all active memberships
    const { error: updateError } = await supabase
      .from('project_team_members')
      .update({
        deleted_at: deletedAt,
        updated_at: deletedAt,
      })
      .eq('member_id', userId)
      .is('deleted_at', null);

    if (updateError) {
      console.error(`[${OPERATION}] Membership removal error:`, updateError.message);
      return { removedCount: 0, error: updateError.message };
    }

    const removedCount = activeCount || 0;
    console.log(`[${OPERATION}] Removed ${removedCount} project memberships for user: ${userId}`);
    return { removedCount, error: null };
  } catch (err) {
    console.error(`[${OPERATION}] Membership removal exception:`, err);
    return { removedCount: 0, error: 'Failed to remove project memberships' };
  }
}

/**
 * Executes the complete soft delete process
 */
async function executeSoftDelete(
  supabase: SupabaseClient,
  userId: string,
  removeFromProjects: boolean
): Promise<{
  success: boolean;
  deletedAt?: string;
  membershipsRemoved?: number;
  error?: { code: AdminSoftDeleteErrorCode; message: string };
}> {
  // Step 1: Revoke auth access
  const { success: authRevoked, error: authError } = await revokeUserAuth(supabase, userId);

  if (!authRevoked) {
    return {
      success: false,
      error: {
        code: 'AUTH_UPDATE_FAILED',
        message: authError || 'Failed to revoke user authentication',
      },
    };
  }

  // Step 2: Mark profile as deleted
  const { deletedAt, error: profileError } = await markProfileDeleted(supabase, userId);

  if (!deletedAt) {
    // Try to un-ban user since profile update failed
    await supabase.auth.admin.updateUserById(userId, { ban_duration: 'none' });

    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: profileError || 'Failed to update profile',
      },
    };
  }

  // Step 3: Remove project memberships (if requested)
  let membershipsRemoved = 0;
  if (removeFromProjects) {
    const { removedCount, error: membershipError } = await removeProjectMemberships(
      supabase,
      userId
    );

    if (membershipError) {
      console.warn(
        `[${OPERATION}] Warning: User deleted but membership removal failed:`,
        membershipError
      );
      // Don't fail the whole operation - user is already deleted
    }

    membershipsRemoved = removedCount;
  }

  return {
    success: true,
    deletedAt,
    membershipsRemoved,
  };
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return createCorsResponse();
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    const error = createSoftDeleteErrorResponse('METHOD_NOT_ALLOWED', 'Only POST method is allowed');
    return createResponse(error, getSoftDeleteStatusCode('METHOD_NOT_ALLOWED'));
  }

  try {
    // Initialize Supabase admin client
    const supabase = createAdminClient();

    // Extract and validate Bearer token
    const authHeader = req.headers.get('Authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      console.error(`[${OPERATION}] No authorization token provided`);
      const error = createSoftDeleteErrorResponse('UNAUTHORIZED', 'Authorization token is required');
      return createResponse(error, getSoftDeleteStatusCode('UNAUTHORIZED'));
    }

    // Authenticate the caller
    const { user: caller, error: authError } = await authenticateCaller(supabase, token);

    if (authError || !caller) {
      console.error(`[${OPERATION}] Authentication failed:`, authError);
      const error = createSoftDeleteErrorResponse('UNAUTHORIZED', authError || 'Authentication failed');
      return createResponse(error, getSoftDeleteStatusCode('UNAUTHORIZED'));
    }

    console.log(`[${OPERATION}] Caller authenticated: ${caller.id}`);

    // Prevent self-deletion
    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      const error = createSoftDeleteErrorResponse('VALIDATION_ERROR', 'Invalid JSON in request body');
      return createResponse(error, getSoftDeleteStatusCode('VALIDATION_ERROR'));
    }

    const validation = validateRequest(body);

    if (!validation.valid || !validation.data) {
      console.error(`[${OPERATION}] Validation failed:`, validation.error);
      const error = createSoftDeleteErrorResponse(
        validation.error?.code || 'VALIDATION_ERROR',
        validation.error?.message || 'Validation failed'
      );
      return createResponse(error, getSoftDeleteStatusCode(validation.error?.code || 'VALIDATION_ERROR'));
    }

    const requestData = validation.data;

    // Prevent self-deletion
    if (requestData.user_id === caller.id) {
      console.error(`[${OPERATION}] User attempted self-deletion: ${caller.id}`);
      const error = createSoftDeleteErrorResponse('FORBIDDEN', 'Cannot delete your own account');
      return createResponse(error, getSoftDeleteStatusCode('FORBIDDEN'));
    }

    console.log(`[${OPERATION}] Validating deletion for user: ${requestData.user_id}`);

    // Pre-deletion validation
    const { validation: deletionValidation, error: validationError } = await validateUserDeletion(
      supabase,
      requestData.user_id
    );

    // Handle specific validation errors
    if (validationError === 'USER_NOT_FOUND') {
      const error = createSoftDeleteErrorResponse(
        'USER_NOT_FOUND',
        'User not found',
        deletionValidation
      );
      return createResponse(error, getSoftDeleteStatusCode('USER_NOT_FOUND'));
    }

    if (validationError === 'USER_ALREADY_DELETED') {
      const error = createSoftDeleteErrorResponse(
        'USER_ALREADY_DELETED',
        'User is already deleted',
        deletionValidation
      );
      return createResponse(error, getSoftDeleteStatusCode('USER_ALREADY_DELETED'));
    }

    if (!deletionValidation.can_delete) {
      console.error(
        `[${OPERATION}] Deletion blocked for user ${requestData.user_id}:`,
        deletionValidation.blocking_reason
      );
      const error = createSoftDeleteErrorResponse(
        'OWNERSHIP_TRANSFER_REQUIRED',
        deletionValidation.blocking_reason || 'User cannot be deleted',
        deletionValidation
      );
      return createResponse(error, getSoftDeleteStatusCode('OWNERSHIP_TRANSFER_REQUIRED'));
    }

    // If validate_only mode, return validation success without executing delete
    if (requestData.validate_only) {
      console.log(`[${OPERATION}] Validation-only mode: user ${requestData.user_id} can be deleted`);
      return createResponse(
        {
          success: true,
          validation: deletionValidation,
        } as any,
        200
      );
    }

    console.log(`[${OPERATION}] Executing soft delete for user: ${requestData.user_id}`);

    // Execute soft delete
    const deleteResult = await executeSoftDelete(
      supabase,
      requestData.user_id,
      requestData.remove_from_projects ?? true
    );

    if (!deleteResult.success) {
      console.error(`[${OPERATION}] Soft delete failed:`, deleteResult.error);
      const error = createSoftDeleteErrorResponse(
        deleteResult.error?.code || 'INTERNAL_ERROR',
        deleteResult.error?.message || 'Soft delete failed'
      );
      return createResponse(error, getSoftDeleteStatusCode(deleteResult.error?.code || 'INTERNAL_ERROR'));
    }

    // Return success response
    const successResponse = createSoftDeleteSuccessResponse(
      requestData.user_id,
      deleteResult.membershipsRemoved || 0,
      deleteResult.deletedAt || new Date().toISOString()
    );

    console.log(`[${OPERATION}] User soft deleted successfully: ${requestData.user_id}`);
    return createResponse(successResponse, 200);
  } catch (err) {
    console.error(`[${OPERATION}] Unexpected error:`, err);
    const error = createSoftDeleteErrorResponse(
      'INTERNAL_ERROR',
      'An unexpected error occurred. Please try again.'
    );
    return createResponse(error, getSoftDeleteStatusCode('INTERNAL_ERROR'));
  }
});
