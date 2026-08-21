import React, { createContext, useContext, useState, useMemo } from 'react';
import {
  DeveloperContext,
  DeveloperIntentType,
  UserDifficultyLevel,
  DEFAULT_DEVELOPER_CONTEXT,
  ContextRecommendation,
} from '../domain/entities/DeveloperContext';
import { DeveloperContextEngine } from '../services/DeveloperContextEngine';
import { DevCommand } from '../domain/entities/DevCommand';
import { GuideArticle } from '../domain/entities/GuideArticle';
import { GuideWorkflow } from '../domain/entities/GuideWorkflow';

const RECENT_TOPICS_KEY = 'dcc_developer_recent_topics';

interface DeveloperContextValue {
  context: DeveloperContext;
  setIntent: (intent: DeveloperIntentType) => void;
  setCategory: (categoryId: string, subcategoryId?: string | null) => void;
  setArticle: (articleId: string) => void;
  setChapter: (chapterId: string, sectionId?: string) => void;
  setSection: (sectionId: string) => void;
  setTask: (taskId: string | null) => void;
  setWorkflow: (workflowId: string | null, stepId?: string) => void;
  setCommand: (commandId: string | null) => void;
  setTroubleshooting: (errId: string | null) => void;
  setDifficulty: (level: UserDifficultyLevel) => void;
  setSearchQuery: (query: string) => void;
  toggleSectionCompleted: (sectionId: string) => void;
  relatedCommands: DevCommand[];
  relatedArticles: GuideArticle[];
  relatedWorkflow: GuideWorkflow | null;
  recommendedNextStep: ContextRecommendation;
}

const DeveloperContextStateContext = createContext<DeveloperContextValue | null>(null);

export function DeveloperContextProvider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<DeveloperContext>(() => {
    let storedTopics: string[] = ['docker', 'git', 'aws'];
    try {
      const stored = localStorage.getItem(RECENT_TOPICS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) storedTopics = parsed;
      }
    } catch {
      // Fallback
    }

    return {
      ...DEFAULT_DEVELOPER_CONTEXT,
      recentTopics: storedTopics,
    };
  });

  // Track recent topics persistence safely
  const updateRecentTopic = (topic: string) => {
    if (!topic) return;
    setContext((prev) => {
      const filtered = prev.recentTopics.filter((t) => t.toLowerCase() !== topic.toLowerCase());
      const updated = [topic, ...filtered].slice(0, 5);
      try {
        localStorage.setItem(RECENT_TOPICS_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage write error
      }
      return { ...prev, recentTopics: updated };
    });
  };

  const setIntent = (intent: DeveloperIntentType) => {
    setContext((prev) => ({ ...prev, intent }));
  };

  const setCategory = (categoryId: string, subcategoryId?: string | null) => {
    updateRecentTopic(categoryId);
    setContext((prev) => ({
      ...prev,
      categoryId,
      subcategoryId: subcategoryId || undefined,
    }));
  };

  const setArticle = (articleId: string) => {
    setContext((prev) => ({ ...prev, articleId }));
  };

  const setChapter = (chapterId: string, sectionId?: string) => {
    setContext((prev) => ({
      ...prev,
      chapterId,
      sectionId: sectionId || prev.sectionId,
      intent: 'LEARN',
    }));
  };

  const setSection = (sectionId: string) => {
    setContext((prev) => ({ ...prev, sectionId }));
  };

  const setTask = (taskId: string | null) => {
    setContext((prev) => ({
      ...prev,
      taskId: taskId || undefined,
      intent: taskId ? 'DO' : prev.intent,
    }));
  };

  const setWorkflow = (workflowId: string | null, stepId?: string) => {
    setContext((prev) => ({
      ...prev,
      workflowId: workflowId || undefined,
      workflowStepId: stepId || undefined,
      intent: workflowId ? 'DO' : prev.intent,
    }));
  };

  const setCommand = (commandId: string | null) => {
    setContext((prev) => ({
      ...prev,
      commandId: commandId || undefined,
      intent: commandId ? 'FIND' : prev.intent,
    }));
  };

  const setTroubleshooting = (errId: string | null) => {
    setContext((prev) => ({
      ...prev,
      troubleshootingId: errId || undefined,
      intent: errId ? 'FIX' : prev.intent,
    }));
  };

  const setDifficulty = (difficulty: UserDifficultyLevel) => {
    setContext((prev) => ({ ...prev, difficulty }));
  };

  const setSearchQuery = (searchQuery: string) => {
    setContext((prev) => ({ ...prev, searchQuery }));
  };

  const toggleSectionCompleted = (sectionId: string) => {
    setContext((prev) => {
      const isCompleted = prev.completedSectionIds.includes(sectionId);
      const updated = isCompleted
        ? prev.completedSectionIds.filter((id) => id !== sectionId)
        : [...prev.completedSectionIds, sectionId];
      return { ...prev, completedSectionIds: updated };
    });
  };

  // Derived relationship queries memoized via DeveloperContextEngine
  const relatedCommands = useMemo(() => DeveloperContextEngine.getRelatedCommands(context), [context]);
  const relatedArticles = useMemo(() => DeveloperContextEngine.getRelatedArticles(context), [context]);
  const relatedWorkflow = useMemo(() => DeveloperContextEngine.getRelatedWorkflow(context), [context]);
  const recommendedNextStep = useMemo(
    () => DeveloperContextEngine.getRecommendedNextStep(context),
    [context]
  );

  const value = useMemo(
    () => ({
      context,
      setIntent,
      setCategory,
      setArticle,
      setChapter,
      setSection,
      setTask,
      setWorkflow,
      setCommand,
      setTroubleshooting,
      setDifficulty,
      setSearchQuery,
      toggleSectionCompleted,
      relatedCommands,
      relatedArticles,
      relatedWorkflow,
      recommendedNextStep,
    }),
    [context, relatedCommands, relatedArticles, relatedWorkflow, recommendedNextStep]
  );

  return (
    <DeveloperContextStateContext.Provider value={value}>
      {children}
    </DeveloperContextStateContext.Provider>
  );
}

export function useDeveloperContext(): DeveloperContextValue {
  const ctx = useContext(DeveloperContextStateContext);
  if (!ctx) {
    throw new Error('useDeveloperContext must be used within a DeveloperContextProvider');
  }
  return ctx;
}
