export type DeveloperIntentType = 'DO' | 'FIND' | 'LEARN' | 'FIX';
export type UserDifficultyLevel = 'beginner' | 'engineer' | 'deep_dive';

export interface ContextRecommendation {
  title: string;
  reason: string;
  targetType: 'chapter' | 'article' | 'workflow' | 'command' | 'troubleshooting';
  targetId: string;
  category?: string;
}

export interface DeveloperContext {
  intent: DeveloperIntentType;
  categoryId?: string;
  subcategoryId?: string;
  articleId?: string;
  chapterId?: string;
  sectionId?: string;
  taskId?: string;
  workflowId?: string;
  workflowStepId?: string;
  commandId?: string;
  troubleshootingId?: string;
  difficulty: UserDifficultyLevel;
  learningMode: boolean;
  searchQuery: string;
  recentTopics: string[];
  completedSectionIds: string[];
}

export const DEFAULT_DEVELOPER_CONTEXT: DeveloperContext = {
  intent: 'DO',
  categoryId: 'docker',
  subcategoryId: 'containers',
  articleId: 'docker-cli-cheatsheet',
  chapterId: 'docker-containers-chapter',
  sectionId: 'sec-3-1',
  difficulty: 'engineer',
  learningMode: false,
  searchQuery: '',
  recentTopics: ['docker', 'git', 'aws'],
  completedSectionIds: [],
};
