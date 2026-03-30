import { CreateProjectRequest, UpdateProjectData, ProjectUpdateData } from './types.ts';

export interface ProjectInsertData {
  name: string;
  description: string;
  category: string | null;
  tags: string[];
  context_data: Record<string, unknown>;
  is_active: boolean;
  owner: string | null;
  leaders_managers: unknown[];
  team_member_links: unknown[];
  git_repository_url: string | null;
  jira_url: string | null;
}

export function mapRequestToInsertData(request: CreateProjectRequest): ProjectInsertData {
  return {
    name: request.name,
    description: request.description,
    category: request.category ?? null,
    tags: request.tags ?? [],
    context_data: request.context_data ?? {},
    is_active: request.is_active ?? true,
    owner: request.owner ?? null,
    leaders_managers: request.leaders_managers ?? [],
    team_member_links: request.team_member_links ?? [],
    git_repository_url: request.git_repository_url ?? null,
    jira_url: request.jira_url ?? null
  };
}

export function mapUpdateRequestToData(data: UpdateProjectData): ProjectUpdateData {
  const updateData: ProjectUpdateData = {
    updated_at: new Date().toISOString()
  };

  if (data.name !== undefined) {
    updateData.name = data.name;
  }
  if (data.description !== undefined) {
    updateData.description = data.description;
  }
  if (data.category !== undefined) {
    updateData.category = data.category;
  }
  if (data.tags !== undefined) {
    updateData.tags = data.tags;
  }
  if (data.context_data !== undefined) {
    updateData.context_data = data.context_data;
  }
  if (data.is_active !== undefined) {
    updateData.is_active = data.is_active;
  }
  if (data.owner !== undefined) {
    updateData.owner = data.owner;
  }
  if (data.leaders_managers !== undefined) {
    updateData.leaders_managers = data.leaders_managers;
  }
  if (data.team_member_links !== undefined) {
    updateData.team_member_links = data.team_member_links;
  }
  if (data.git_repository_url !== undefined) {
    updateData.git_repository_url = data.git_repository_url;
  }
  if (data.jira_url !== undefined) {
    updateData.jira_url = data.jira_url;
  }

  return updateData;
}
