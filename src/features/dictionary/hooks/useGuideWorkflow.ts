import { useState, useCallback, useEffect } from 'react';

const WORKFLOW_PROGRESS_KEY = 'dcc_dictionary_workflow_progress';

export interface WorkflowProgressState {
  [workflowId: string]: {
    completedSteps: string[];
    updatedAt?: string;
  };
}

export function useGuideWorkflow() {
  const [progressState, setProgressState] = useState<WorkflowProgressState>(() => {
    try {
      const stored = localStorage.getItem(WORKFLOW_PROGRESS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as WorkflowProgressState;
        }
      }
    } catch (e) {
      console.warn('Failed to parse workflow progress from localStorage', e);
    }
    return {};
  });

  // Save to localStorage whenever progress updates
  useEffect(() => {
    try {
      localStorage.setItem(WORKFLOW_PROGRESS_KEY, JSON.stringify(progressState));
    } catch (e) {
      console.warn('Failed to save workflow progress to localStorage', e);
    }
  }, [progressState]);

  // Toggle step completion
  const toggleStep = useCallback((workflowId: string, stepId: string) => {
    if (!workflowId || !stepId) return;

    setProgressState((prev) => {
      const currentSteps = prev[workflowId]?.completedSteps || [];
      const isCompleted = currentSteps.includes(stepId);

      const updatedSteps = isCompleted
        ? currentSteps.filter((id) => id !== stepId)
        : [...currentSteps, stepId];

      return {
        ...prev,
        [workflowId]: {
          completedSteps: updatedSteps,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }, []);

  // Check if a step is marked completed
  const isStepCompleted = useCallback(
    (workflowId: string, stepId: string): boolean => {
      if (!workflowId || !stepId) return false;
      const currentSteps = progressState[workflowId]?.completedSteps || [];
      return currentSteps.includes(stepId);
    },
    [progressState]
  );

  // Get progress metrics
  const getProgress = useCallback(
    (workflowId: string, totalSteps: number) => {
      const currentSteps = progressState[workflowId]?.completedSteps || [];
      const completedCount = currentSteps.length;
      const percentage = totalSteps > 0 ? Math.min(100, Math.round((completedCount / totalSteps) * 100)) : 0;
      const isFinished = totalSteps > 0 && completedCount >= totalSteps;

      return {
        completedCount,
        percentage,
        isFinished,
      };
    },
    [progressState]
  );

  // Reset workflow progress
  const resetWorkflowProgress = useCallback((workflowId: string) => {
    if (!workflowId) return;
    setProgressState((prev) => {
      const copy = { ...prev };
      delete copy[workflowId];
      return copy;
    });
  }, []);

  return {
    progressState,
    toggleStep,
    isStepCompleted,
    getProgress,
    resetWorkflowProgress,
  };
}
