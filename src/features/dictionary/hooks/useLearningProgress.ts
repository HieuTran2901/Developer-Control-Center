import { useState, useCallback, useEffect } from 'react';

const LEARNING_PROGRESS_KEY = 'dcc_dictionary_learning_progress';

export interface LearningProgressState {
  completedSections: Record<string, string[]>; // chapterId -> sectionId[]
  completedChapters: string[]; // chapterId[]
  activeSectionId?: string;
}

export function useLearningProgress() {
  const [state, setState] = useState<LearningProgressState>(() => {
    try {
      const stored = localStorage.getItem(LEARNING_PROGRESS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          return {
            completedSections: parsed.completedSections || {},
            completedChapters: parsed.completedChapters || [],
            activeSectionId: parsed.activeSectionId,
          };
        }
      }
    } catch (e) {
      console.warn('Failed to parse learning progress from localStorage', e);
    }
    return { completedSections: {}, completedChapters: [] };
  });

  useEffect(() => {
    try {
      localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save learning progress to localStorage', e);
    }
  }, [state]);

  const toggleSectionCompleted = useCallback((chapterId: string, sectionId: string) => {
    if (!chapterId || !sectionId) return;

    setState((prev) => {
      const current = prev.completedSections[chapterId] || [];
      const isDone = current.includes(sectionId);
      const updated = isDone ? current.filter((id) => id !== sectionId) : [...current, sectionId];

      return {
        ...prev,
        completedSections: {
          ...prev.completedSections,
          [chapterId]: updated,
        },
      };
    });
  }, []);

  const isSectionCompleted = useCallback(
    (chapterId: string, sectionId: string): boolean => {
      if (!chapterId || !sectionId) return false;
      const current = state.completedSections[chapterId] || [];
      return current.includes(sectionId);
    },
    [state.completedSections]
  );

  const toggleChapterCompleted = useCallback((chapterId: string) => {
    if (!chapterId) return;

    setState((prev) => {
      const isDone = prev.completedChapters.includes(chapterId);
      const updated = isDone
        ? prev.completedChapters.filter((id) => id !== chapterId)
        : [...prev.completedChapters, chapterId];

      return {
        ...prev,
        completedChapters: updated,
      };
    });
  }, []);

  const isChapterCompleted = useCallback(
    (chapterId: string): boolean => {
      if (!chapterId) return false;
      return state.completedChapters.includes(chapterId);
    },
    [state.completedChapters]
  );

  const getChapterProgress = useCallback(
    (chapterId: string, totalSections: number) => {
      const completed = state.completedSections[chapterId] || [];
      const count = completed.length;
      const percentage = totalSections > 0 ? Math.min(100, Math.round((count / totalSections) * 100)) : 0;
      return { count, percentage, isFinished: count >= totalSections };
    },
    [state.completedSections]
  );

  return {
    state,
    toggleSectionCompleted,
    isSectionCompleted,
    toggleChapterCompleted,
    isChapterCompleted,
    getChapterProgress,
  };
}
