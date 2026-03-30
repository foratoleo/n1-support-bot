export interface AssignTaskRequest {
  projectId: string;
  taskId: string;
  assignedTo: string | null;
}

export interface AssignedToInfo {
  id: string;
  name: string;
  slug: string;
}

export interface AssignTaskResponse {
  id: string;
  title: string;
  assignedTo: AssignedToInfo | null;
  previousAssignedTo: AssignedToInfo | null;
  updatedAt: string;
}
