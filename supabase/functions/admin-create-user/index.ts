/**
 * Admin Create User Edge Function
 *
 * Creates new users with admin privileges via Supabase Auth Admin API.
 * This function bypasses email verification and allows setting user metadata directly.
 *
 * Requirements:
 * - Caller must be authenticated
 * - Caller must have admin/governance role
 * - Email must be unique
 * - Password must meet Supabase Auth requirements (min 6 chars)
 *
 * @module admin-create-user
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import {
  AdminCreateUserRequest,
  AdminCreateUserResponse,
  ProjectAssignment,
  ProjectAssignmentResult,
  CreatedProfileData,
  AdminErrorCode,
  createSuccessResponse,
  createErrorResponse,
  getStatusCodeForError,
  isValidRole,
} from '../_shared/admin-user-types.ts';

const OPERATION = 'admin-create-user';

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
function createResponse(data: AdminCreateUserResponse, statusCode: number): Response {
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
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * UUID validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates the request body
 */
function validateRequest(body: unknown): {
  valid: boolean;
  data?: AdminCreateUserRequest;
  error?: { code: AdminErrorCode; message: string; field?: string };
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

  // Validate email
  if (!request.email || typeof request.email !== 'string') {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Email is required',
        field: 'email',
      },
    };
  }

  const email = request.email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid email format',
        field: 'email',
      },
    };
  }

  if (email.length > 255) {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Email must be at most 255 characters',
        field: 'email',
      },
    };
  }

  // Validate password
  if (!request.password || typeof request.password !== 'string') {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Password is required',
        field: 'password',
      },
    };
  }

  const password = request.password;
  if (password.length < 6) {
    return {
      valid: false,
      error: {
        code: 'INVALID_PASSWORD',
        message: 'Password must be at least 6 characters',
        field: 'password',
      },
    };
  }

  // Validate full_name (optional)
  let fullName: string | undefined;
  if (request.full_name !== undefined) {
    if (typeof request.full_name !== 'string') {
      return {
        valid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Full name must be a string',
          field: 'full_name',
        },
      };
    }
    fullName = request.full_name.trim();
    if (fullName.length > 0 && fullName.length < 2) {
      return {
        valid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Full name must be at least 2 characters',
          field: 'full_name',
        },
      };
    }
    if (fullName.length > 100) {
      return {
        valid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Full name must be at most 100 characters',
          field: 'full_name',
        },
      };
    }
    if (fullName.length === 0) {
      fullName = undefined;
    }
  }

  // Validate avatar_url (optional)
  let avatarUrl: string | undefined;
  if (request.avatar_url !== undefined) {
    if (typeof request.avatar_url !== 'string') {
      return {
        valid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Avatar URL must be a string',
          field: 'avatar_url',
        },
      };
    }
    avatarUrl = request.avatar_url.trim();
    if (avatarUrl.length > 0) {
      try {
        new URL(avatarUrl);
      } catch {
        return {
          valid: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid avatar URL format',
            field: 'avatar_url',
          },
        };
      }
    } else {
      avatarUrl = undefined;
    }
  }

  // Validate project_assignments (optional)
  let projectAssignments: ProjectAssignment[] | undefined;
  if (request.project_assignments !== undefined) {
    if (!Array.isArray(request.project_assignments)) {
      return {
        valid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Project assignments must be an array',
          field: 'project_assignments',
        },
      };
    }

    projectAssignments = [];
    for (let i = 0; i < request.project_assignments.length; i++) {
      const assignment = request.project_assignments[i] as Record<string, unknown>;

      if (!assignment || typeof assignment !== 'object') {
        return {
          valid: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid project assignment at index ${i}`,
            field: 'project_assignments',
          },
        };
      }

      if (!assignment.project_id || typeof assignment.project_id !== 'string') {
        return {
          valid: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Project ID is required at index ${i}`,
            field: 'project_assignments',
          },
        };
      }

      if (!UUID_REGEX.test(assignment.project_id)) {
        return {
          valid: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid project ID format at index ${i}`,
            field: 'project_assignments',
          },
        };
      }

      let role: string | undefined;
      if (assignment.role !== undefined) {
        if (typeof assignment.role !== 'string') {
          return {
            valid: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `Role must be a string at index ${i}`,
              field: 'project_assignments',
            },
          };
        }
        if (!isValidRole(assignment.role)) {
          return {
            valid: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `Invalid role "${assignment.role}" at index ${i}`,
              field: 'project_assignments',
            },
          };
        }
        role = assignment.role;
      }

      projectAssignments.push({
        project_id: assignment.project_id,
        role: role as ProjectAssignment['role'],
      });
    }

    if (projectAssignments.length === 0) {
      projectAssignments = undefined;
    }
  }

  return {
    valid: true,
    data: {
      email,
      password,
      full_name: fullName,
      avatar_url: avatarUrl,
      project_assignments: projectAssignments,
    },
  };
}

// ============================================================================
// User Creation Logic
// ============================================================================

/**
 * Checks if an email is already registered
 * Checks both profiles table AND auth.users to prevent race conditions
 */
async function checkEmailExists(
  supabase: SupabaseClient,
  email: string
): Promise<{ exists: boolean; error: string | null }> {
  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Check profiles table first
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (profileError) {
      console.error(`[${OPERATION}] Profile email check error:`, profileError.message);
      return { exists: false, error: profileError.message };
    }

    if (profileData !== null) {
      console.log(`[${OPERATION}] Email exists in profiles: ${normalizedEmail}`);
      return { exists: true, error: null };
    }

    // Also check auth.users directly via Admin API to catch race conditions
    // where user was created but profile trigger hasn't fired yet
    try {
      const { data: listData, error: authError } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000, // Check up to 1000 users
      });

      if (authError) {
        console.error(`[${OPERATION}] Auth users check error:`, authError.message);
        // Don't fail the request, just log and continue with profiles check only
      } else if (listData?.users) {
        const existingUser = listData.users.find(
          (u) => u.email?.toLowerCase() === normalizedEmail
        );
        if (existingUser) {
          console.log(`[${OPERATION}] Email exists in auth.users: ${normalizedEmail}`);
          return { exists: true, error: null };
        }
      }
    } catch (authCheckErr) {
      console.error(`[${OPERATION}] Auth check exception:`, authCheckErr);
      // Continue - profiles check was clean
    }

    return { exists: false, error: null };
  } catch (err) {
    console.error(`[${OPERATION}] Email check exception:`, err);
    return { exists: false, error: 'Email check failed' };
  }
}

/**
 * Creates a new user via Supabase Auth Admin API
 */
async function createUser(
  supabase: SupabaseClient,
  request: AdminCreateUserRequest
): Promise<{ user: User | null; error: string | null }> {
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: request.email,
      password: request.password,
      email_confirm: true, // Bypass email verification
      user_metadata: {
        full_name: request.full_name,
        avatar_url: request.avatar_url,
      },
      app_metadata: {
        // Store any app-specific metadata here
        created_by_admin: true,
      },
    });

    if (error) {
      console.error(`[${OPERATION}] User creation error:`, error.message);
      return { user: null, error: error.message };
    }

    if (!data?.user) {
      return { user: null, error: 'User creation returned no user data' };
    }

    console.log(`[${OPERATION}] User created successfully: ${data.user.id}`);
    return { user: data.user, error: null };
  } catch (err) {
    console.error(`[${OPERATION}] User creation exception:`, err);
    return { user: null, error: 'User creation failed' };
  }
}

/**
 * Waits for the profile to be created by the database trigger
 * with exponential backoff
 */
async function waitForProfile(
  supabase: SupabaseClient,
  userId: string,
  maxAttempts = 5
): Promise<{ profile: CreatedProfileData | null; error: string | null }> {
  let attempt = 0;
  let delay = 100; // Start with 100ms

  while (attempt < maxAttempts) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error(`[${OPERATION}] Profile fetch error (attempt ${attempt + 1}):`, error.message);
    }

    if (data) {
      console.log(`[${OPERATION}] Profile found after ${attempt + 1} attempts`);
      return {
        profile: {
          id: data.id,
          email: data.email,
          full_name: data.full_name,
          avatar_url: data.avatar_url,
          created_at: data.created_at,
          updated_at: data.updated_at,
        },
        error: null,
      };
    }

    attempt++;
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }

  console.warn(`[${OPERATION}] Profile not found after ${maxAttempts} attempts`);
  return { profile: null, error: 'Profile not created within timeout' };
}

/**
 * Updates the profile with additional data (full_name, avatar_url)
 * In case the trigger didn't populate these fields
 */
async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  fullName?: string,
  avatarUrl?: string
): Promise<{ success: boolean; error: string | null }> {
  if (!fullName && !avatarUrl) {
    return { success: true, error: null };
  }

  try {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (fullName) updates.full_name = fullName;
    if (avatarUrl) updates.avatar_url = avatarUrl;

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (error) {
      console.error(`[${OPERATION}] Profile update error:`, error.message);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error(`[${OPERATION}] Profile update exception:`, err);
    return { success: false, error: 'Profile update failed' };
  }
}

// ============================================================================
// Project Assignment Logic
// ============================================================================

/**
 * Assigns the new user to projects
 */
async function assignUserToProjects(
  supabase: SupabaseClient,
  userId: string,
  assignments: ProjectAssignment[]
): Promise<ProjectAssignmentResult[]> {
  const results: ProjectAssignmentResult[] = [];

  for (const assignment of assignments) {
    try {
      // Check if project exists and is active
      const { data: project, error: projectError } = await supabase
        .from('project_knowledge_base')
        .select('id, is_active')
        .eq('id', assignment.project_id)
        .maybeSingle();

      if (projectError) {
        console.error(
          `[${OPERATION}] Project check error for ${assignment.project_id}:`,
          projectError.message
        );
        results.push({
          project_id: assignment.project_id,
          success: false,
          error: projectError.message,
        });
        continue;
      }

      if (!project) {
        results.push({
          project_id: assignment.project_id,
          success: false,
          error: 'Project not found',
        });
        continue;
      }

      if (!project.is_active) {
        results.push({
          project_id: assignment.project_id,
          success: false,
          error: 'Project is not active',
        });
        continue;
      }

      // Check if user is already assigned to this project
      const { data: existingAssignment, error: existingError } = await supabase
        .from('project_team_members')
        .select('id')
        .eq('project_id', assignment.project_id)
        .eq('member_id', userId)
        .is('deleted_at', null)
        .maybeSingle();

      if (existingError) {
        console.error(
          `[${OPERATION}] Existing assignment check error for ${assignment.project_id}:`,
          existingError.message
        );
      }

      if (existingAssignment) {
        results.push({
          project_id: assignment.project_id,
          success: false,
          error: 'User already assigned to this project',
        });
        continue;
      }

      // Create the assignment
      const { error: insertError } = await supabase.from('project_team_members').insert({
        project_id: assignment.project_id,
        member_id: userId,
        role: assignment.role || null,
        joined_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error(
          `[${OPERATION}] Assignment insert error for ${assignment.project_id}:`,
          insertError.message
        );
        results.push({
          project_id: assignment.project_id,
          success: false,
          error: insertError.message,
        });
        continue;
      }

      console.log(
        `[${OPERATION}] User ${userId} assigned to project ${assignment.project_id}`
      );
      results.push({
        project_id: assignment.project_id,
        success: true,
      });
    } catch (err) {
      console.error(
        `[${OPERATION}] Assignment exception for ${assignment.project_id}:`,
        err
      );
      results.push({
        project_id: assignment.project_id,
        success: false,
        error: 'Assignment failed due to unexpected error',
      });
    }
  }

  return results;
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
    const error = createErrorResponse('METHOD_NOT_ALLOWED', 'Only POST method is allowed');
    return createResponse(error, getStatusCodeForError('METHOD_NOT_ALLOWED'));
  }

  try {
    // Initialize Supabase admin client
    const supabase = createAdminClient();

    // Extract and validate Bearer token
    const authHeader = req.headers.get('Authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      console.error(`[${OPERATION}] No authorization token provided`);
      const error = createErrorResponse('UNAUTHORIZED', 'Authorization token is required');
      return createResponse(error, getStatusCodeForError('UNAUTHORIZED'));
    }

    // Authenticate the caller
    const { user: caller, error: authError } = await authenticateCaller(supabase, token);

    if (authError || !caller) {
      console.error(`[${OPERATION}] Authentication failed:`, authError);
      const error = createErrorResponse('UNAUTHORIZED', authError || 'Authentication failed');
      return createResponse(error, getStatusCodeForError('UNAUTHORIZED'));
    }

    console.log(`[${OPERATION}] Caller authenticated: ${caller.id}`);

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      const error = createErrorResponse('VALIDATION_ERROR', 'Invalid JSON in request body');
      return createResponse(error, getStatusCodeForError('VALIDATION_ERROR'));
    }

    const validation = validateRequest(body);

    if (!validation.valid || !validation.data) {
      console.error(`[${OPERATION}] Validation failed:`, validation.error);
      const error = createErrorResponse(
        validation.error?.code || 'VALIDATION_ERROR',
        validation.error?.message || 'Validation failed',
        validation.error?.field
      );
      return createResponse(error, getStatusCodeForError(validation.error?.code || 'VALIDATION_ERROR'));
    }

    const requestData = validation.data;
    console.log(`[${OPERATION}] Creating user: ${requestData.email}`);

    // Check if email already exists
    const { exists, error: emailError } = await checkEmailExists(supabase, requestData.email);

    if (emailError) {
      console.error(`[${OPERATION}] Email check failed:`, emailError);
      const error = createErrorResponse('DATABASE_ERROR', 'Failed to verify email availability');
      return createResponse(error, getStatusCodeForError('DATABASE_ERROR'));
    }

    if (exists) {
      console.error(`[${OPERATION}] Email already registered: ${requestData.email}`);
      const error = createErrorResponse('DUPLICATE_EMAIL', 'This email is already registered', 'email');
      return createResponse(error, getStatusCodeForError('DUPLICATE_EMAIL'));
    }

    // Create the user
    const { user: newUser, error: createError } = await createUser(supabase, requestData);

    if (createError || !newUser) {
      console.error(`[${OPERATION}] User creation failed:`, createError);

      // Check for specific Supabase Auth errors
      if (createError?.includes('already registered')) {
        const error = createErrorResponse('DUPLICATE_EMAIL', 'This email is already registered', 'email');
        return createResponse(error, getStatusCodeForError('DUPLICATE_EMAIL'));
      }

      const error = createErrorResponse('USER_CREATION_FAILED', createError || 'Failed to create user');
      return createResponse(error, getStatusCodeForError('USER_CREATION_FAILED'));
    }

    // Wait for profile to be created by database trigger
    const { profile, error: profileError } = await waitForProfile(supabase, newUser.id);

    if (profileError || !profile) {
      console.error(`[${OPERATION}] Profile creation failed:`, profileError);
      // User was created but profile wasn't - this is a partial failure
      // The user exists in auth.users but profile might be missing
      const error = createErrorResponse(
        'PROFILE_CREATION_FAILED',
        'User created but profile synchronization failed. Please contact support.'
      );
      return createResponse(error, getStatusCodeForError('PROFILE_CREATION_FAILED'));
    }

    // Update profile with full_name and avatar_url if provided
    // (in case the trigger didn't populate these from user_metadata)
    if (requestData.full_name || requestData.avatar_url) {
      await updateProfile(supabase, newUser.id, requestData.full_name, requestData.avatar_url);

      // Refresh profile data
      const { profile: updatedProfile } = await waitForProfile(supabase, newUser.id, 1);
      if (updatedProfile) {
        profile.full_name = updatedProfile.full_name;
        profile.avatar_url = updatedProfile.avatar_url;
        profile.updated_at = updatedProfile.updated_at;
      }
    }

    // Process project assignments
    let assignmentsResult: ProjectAssignmentResult[] = [];

    if (requestData.project_assignments && requestData.project_assignments.length > 0) {
      console.log(
        `[${OPERATION}] Assigning user to ${requestData.project_assignments.length} projects`
      );
      assignmentsResult = await assignUserToProjects(
        supabase,
        newUser.id,
        requestData.project_assignments
      );

      const successCount = assignmentsResult.filter((r) => r.success).length;
      const failCount = assignmentsResult.length - successCount;
      console.log(
        `[${OPERATION}] Project assignments: ${successCount} succeeded, ${failCount} failed`
      );
    }

    // Return success response
    const successResponse = createSuccessResponse(
      newUser.id,
      requestData.email,
      profile,
      assignmentsResult
    );

    console.log(`[${OPERATION}] User creation completed successfully: ${newUser.id}`);
    return createResponse(successResponse, 201);
  } catch (err) {
    console.error(`[${OPERATION}] Unexpected error:`, err);
    const error = createErrorResponse(
      'INTERNAL_ERROR',
      'An unexpected error occurred. Please try again.'
    );
    return createResponse(error, getStatusCodeForError('INTERNAL_ERROR'));
  }
});
