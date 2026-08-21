export type ArticleType = 'cheatsheet' | 'step_by_step' | 'troubleshoot' | 'concept' | 'runbook';
export type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface CodeSnippet {
  language: string;
  code: string;
  description?: string;
  commandToRun?: string;
}

export interface StepItem {
  stepNumber: number;
  title: string;
  description: string;
  command?: string;
  expectedOutput?: string;
  tips?: string;
}

export interface CommonErrorItem {
  errorCode: string;
  cause: string;
  solution: string;
  commandFix?: string;
}

export interface TableRow {
  area: string;
  lab: string;
  prod: string;
}

export interface ConsoleVsCliRow {
  task: string;
  console: string;
  cli: string;
}

export interface PolicyTypeRow {
  feature: string;
  managed: string;
  inline: string;
}

export interface GuideArticle {
  id: string;
  title: string;
  categoryId: string;
  subcategoryId?: string;
  tags: string[];
  difficulty: DifficultyLevel;
  type: ArticleType;
  summary: string;
  updatedAt: string;
  readingTimeMinutes: number;
  isBookmarked?: boolean;
  architectureDiagram?: string;
  prerequisites?: string[];
  snippets?: CodeSnippet[];
  steps?: StepItem[];
  commonErrors?: CommonErrorItem[];
  checklist?: string[];
  securityRules?: string[];
  labVsProdTable?: TableRow[];
  consoleVsCliTable?: ConsoleVsCliRow[];
  managedVsInlineTable?: PolicyTypeRow[];
  learningPath?: string[];
  interviewQuestions?: { question: string; answer: string }[];
  onePageCheatSheet?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  parentId?: string;
  children?: Category[];
}
