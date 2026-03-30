import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export interface DeveloperMatrix {
  id: string;
  name: string;
  profile: string;
  technical_skills: string[];
  soft_skills: string[];
  domain_skills: string[];
  member_type: string;
  availability: string;
  current_workload: number;
}

/**
 * Fetch developer matrix for a project from materialized view
 *
 * Uses the optimized view_developer_matrix which pre-aggregates skills
 * for much faster query performance.
 *
 * @param supabase - Supabase client instance
 * @param projectId - Project UUID
 * @returns Array of developers with their skills and availability
 */
export async function fetchDeveloperMatrix(
  supabase: SupabaseClient,
  projectId: string
): Promise<DeveloperMatrix[]> {
  try {
    // Query the materialized view - single query, pre-aggregated data
    const { data, error } = await supabase
      .from('view_developer_matrix')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'active');

    if (error) {
      console.error('[developer-matrix] Error fetching from materialized view:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('[developer-matrix] No active developers found for project:', projectId);
      return [];
    }

    // Transform the view data to match our interface
    const developers: DeveloperMatrix[] = data.map((row: any) => ({
      id: row.id,
      name: row.name,
      profile: row.profile,
      technical_skills: Array.isArray(row.technical_skills) ? row.technical_skills : [],
      soft_skills: Array.isArray(row.soft_skills) ? row.soft_skills : [],
      domain_skills: Array.isArray(row.domain_skills) ? row.domain_skills : [],
      member_type: row.member_type,
      availability: row.availability || 'available',
      current_workload: row.current_workload || 0,
    }));

    console.log(`[developer-matrix] Found ${developers.length} active developers for project ${projectId}`);
    return developers;
  } catch (error) {
    console.error('[developer-matrix] Unexpected error fetching developer matrix:', error);
    return [];
  }
}

/**
 * Format developer matrix as JSON string for prompt injection
 *
 * @param developers - Array of developers
 * @returns Formatted JSON string for prompt
 */
export function formatDeveloperMatrixForPrompt(developers: DeveloperMatrix[]): string {
  if (developers.length === 0) {
    return '[]';
  }

  const formattedDevelopers = developers.map(dev => {
    return `{
  "id": "${dev.id}",
  "name": "${dev.name}",
  "profile": "${dev.profile}",
  "technical_skills": ${JSON.stringify(dev.technical_skills)},
  "soft_skills": ${JSON.stringify(dev.soft_skills)},
  "domain_skills": ${JSON.stringify(dev.domain_skills)},
  "member_type": "${dev.member_type}",
  "availability": "${dev.availability}",
  "current_workload": ${dev.current_workload}
}`;
  });

  return formattedDevelopers.join(',\n');
}
