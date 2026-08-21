export type CommandDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type CommandRiskLevel = 'safe' | 'caution' | 'dangerous';
export type CommandPlatform = 'linux' | 'windows' | 'macos' | 'cross-platform';

export interface DevCommand {
  id: string;
  command: string;
  title: string;
  description: string;

  categoryId: string;
  subcategoryId?: string;

  tags: string[];

  difficulty: CommandDifficulty;

  useCases: string[];

  explanation?: string;

  expectedOutput?: string;

  warnings?: string[];

  relatedArticleIds?: string[];

  relatedCommandIds?: string[];

  platform?: CommandPlatform;

  riskLevel?: CommandRiskLevel;

  workflowId?: string;
}
