export interface CommandItem {
  command: string;
  description?: string;
  expectedResult?: string;
  verificationCommand?: string;
  verificationCheck?: string;
}

export interface CommonMistakeItem {
  problem: string;
  why: string;
  fix: string;
}

export interface ChapterSection {
  id: string;
  title: string;
  content: string;
  whyItMatters?: string;
  commands?: CommandItem[];
  commonMistakes?: CommonMistakeItem[];
}

export interface GuideChapter {
  id: string;
  articleId: string;
  chapterNumber: number;
  totalChapters: number;
  title: string;
  subtitle: string;
  categoryName: string;
  subcategoryName: string;
  learningObjectives: string[];
  sections: ChapterSection[];
  nextChapterId?: string;
  nextChapterTitle?: string;
  prevChapterId?: string;
  prevChapterTitle?: string;
}
