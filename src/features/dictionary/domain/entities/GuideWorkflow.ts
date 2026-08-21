export interface GuideWorkflowStep {
  id: string;
  order: number;
  title: string;
  description?: string;
  articleId?: string;
  commands?: string[];
  verification?: string;
  optional?: boolean;
}

export interface GuideWorkflow {
  id: string;
  taskId: string;
  title: string;
  description: string;
  estimatedMinutes?: number;
  outcomes?: string[];
  steps: GuideWorkflowStep[];
}
