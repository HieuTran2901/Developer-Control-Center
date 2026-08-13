import React, { createContext, useContext, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useWorkspace, ProjectViewModel } from '@/shared/hooks/useWorkspace';

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  steps: PipelineStep[];
}

export interface PipelineEvidence {
  evidenceId: string;
  componentPath: string;
  sourceType: string;
  sourcePath: string;
  observedValue: string;
  confidence: number;
}

export interface PipelineStepProvenance {
  evidenceIds: string[];
  artifactEvidenceIds: string[];
  stepConfidence: number;
}

export interface PipelineProvenance {
  globalEvidence: PipelineEvidence[];
  pipelineConfidence: number;
}

export interface PipelineStep {
  id: string;
  name: string;
  stepCase: string;
  order: number;
  timeoutSeconds?: number;
  provenance?: PipelineStepProvenance;
}

export interface PipelineDefinition {
  id: string;
  name: string;
  description?: string;
  version: number;
  trigger: string;
  stages: PipelineStage[];
  verificationStatus?: string;
  confidenceScore?: number;
  provenance?: PipelineProvenance;
}

export interface PipelineRunDto {
  id: string;
  name: string;
  project: string;
  status: string;
  branch: string;
  commit: string;
  commitMessage: string;
  duration: string;
  triggeredAt: string;
  triggeredBy: string;
}

export interface HealthStatsDto {
  total: number;
  success: number;
  failed: number;
  cancelled: number;
  running: number;
}

export interface ExecutionStateDto {
  executionId: string;
  pipelineId: string;
  status: string;
  startTimeMs: number;
  endTimeMs?: number;
  isCancelled: boolean;
}

interface PipelineContextState {
  pipelines: PipelineDefinition[];
  recentExecutions: PipelineRunDto[];
  healthStats: HealthStatsDto;
  activeExecutions: Record<string, ExecutionStateDto>;
  triggerPipeline: (pipelineId: string) => Promise<void>;
  approveStep: (approvalId: string, approved: boolean) => Promise<void>;
  selectedProject: ProjectViewModel | null;
  setSelectedProjectId: (id: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const defaultStats: HealthStatsDto = {
  total: 0,
  success: 0,
  failed: 0,
  cancelled: 0,
  running: 0,
};

const PipelineContext = createContext<PipelineContextState>({
  pipelines: [],
  recentExecutions: [],
  healthStats: defaultStats,
  activeExecutions: {},
  triggerPipeline: async () => {},
  approveStep: async () => {},
  selectedProject: null,
  setSelectedProjectId: () => {},
  activeTab: 'overview',
  setActiveTab: () => {},
});

export const usePipelineContext = () => useContext(PipelineContext);

export const PipelineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { workspace, session, updateSession } = useWorkspace();
  const selectedProject = workspace?.projects?.find(p => p.id === session?.selectedProjectId) || null;

  const [activeTab, setActiveTab] = useState('overview');
  const [pipelines, setPipelines] = useState<PipelineDefinition[]>([]);
  const [recentExecutions, setRecentExecutions] = useState<PipelineRunDto[]>([]);
  const [healthStats, setHealthStats] = useState<HealthStatsDto>(defaultStats);
  const [activeExecutions, setActiveExecutions] = useState<Record<string, ExecutionStateDto>>({});

  useEffect(() => {
    if (!selectedProject) {
      setPipelines([]);
      setRecentExecutions([]);
      setHealthStats(defaultStats);
      setActiveExecutions({});
      return;
    }

    // Initial fetch
    const fetchData = async () => {
      try {
        const p = await invoke<PipelineDefinition[]>('get_pipelines');
        setPipelines(p);

        const r = await invoke<PipelineRunDto[]>('get_recent_executions');
        setRecentExecutions(r);

        const h = await invoke<HealthStatsDto>('get_pipeline_health_stats');
        setHealthStats(h);
      } catch (err) {
        console.error('Error fetching pipeline data:', err);
      }
    };
    
    fetchData();
  }, [selectedProject?.id]);

  useEffect(() => {
    // Event listener setup
    let unlisten: UnlistenFn | undefined;

    const setupListener = async () => {
      unlisten = await listen('pipeline_event', (event) => {
        const payload: any = event.payload;
        console.log('Received pipeline event:', payload);
        
        // Handle Policy Approval
        if (payload.type === 'policyApprovalRequired') {
          // Open dialog globally (we can dispatch a custom event or set a state for it)
          window.dispatchEvent(new CustomEvent('pipeline:approval-required', { detail: payload.payload }));
        }
        
        // Handle Status Updates
        if (payload.type === 'pipelineStarted' || payload.type === 'pipelineCompleted' || payload.type === 'pipelineFailed') {
          // Fetch updated health stats or update local active executions
          invoke<ExecutionStateDto>('get_pipeline_execution_state', { executionId: payload.payload.executionId })
            .then(state => {
              setActiveExecutions(prev => ({
                ...prev,
                [state.executionId]: state
              }));
            })
            .catch(console.error);
        }
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const triggerPipeline = async (pipelineId: string) => {
    try {
      await invoke('trigger_pipeline', { pipelineId });
      // The event listener will catch PipelineStarted and update active executions
    } catch (err) {
      console.error('Error triggering pipeline:', err);
    }
  };

  const approveStep = async (approvalId: string, approved: boolean) => {
    try {
      await invoke('submit_step_approval', { approvalId, approved });
    } catch (err) {
      console.error('Error submitting approval:', err);
    }
  };

  const setSelectedProjectId = (id: string) => {
    updateSession({ selectedProjectId: id });
  };

  return (
    <PipelineContext.Provider
      value={{
        pipelines,
        recentExecutions,
        healthStats,
        activeExecutions,
        triggerPipeline,
        approveStep,
        selectedProject,
        setSelectedProjectId,
        activeTab,
        setActiveTab,
      }}
    >
      {children}
    </PipelineContext.Provider>
  );
};
