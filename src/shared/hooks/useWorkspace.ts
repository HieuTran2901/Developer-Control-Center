import { useState, useEffect, createContext, useContext, ReactNode, createElement } from 'react';
import { Workspace } from '@/domain/entities/Workspace';
import { Project } from '@/domain/entities/Project';
import { workspaceRepository, applicationStateService } from '@/application/services';
import { EventBus, EventType } from '@/application/events/EventBus';
import { ProcessStatusResponse } from '@/desktop/ipc/dto/ProcessStatusResponse';
import { ProcessState } from '@/domain/entities/ProcessState';
import { WorkspaceSession } from '@/domain/entities/WorkspaceSession';

export interface RuntimeProfileViewModel {
  id: string;
  projectId: string;
  name: string;
  workingDirectory: string;
  command: string;
  arguments: string[];
  status: ProcessState;
  pid?: number;
}

export interface ProjectViewModel extends Project {
  status: ProcessState;
  profiles: RuntimeProfileViewModel[];
}

export interface WorkspaceViewModel extends Workspace {
  projects: ProjectViewModel[];
}

// ─── Helper ────────────────────────────────────────────────────────────────
function toViewModel(ws: Workspace): WorkspaceViewModel {
  const projects = Array.isArray(ws?.projects) ? ws.projects : [];
  return {
    ...ws,
    projects: projects.map(p => ({
      ...p,
      status: ProcessState.Idle,
      profiles: Array.isArray(p?.profiles) ? p.profiles.map(pr => ({
        ...pr,
        status: ProcessState.Idle,
        pid: undefined
      })) : []
    }))
  };
}

function mergeViewModel(prev: WorkspaceViewModel, next: WorkspaceViewModel): WorkspaceViewModel {
  const mergedProjects = next.projects.map(newProj => {
    const oldProj = prev.projects.find(p => p.id === newProj.id);
    if (!oldProj) return newProj;
    return {
      ...newProj,
      status: oldProj.status,
      profiles: newProj.profiles.map(newProf => {
        const oldProf = oldProj.profiles.find(p => p.id === newProf.id);
        if (!oldProf) return newProf;
        return { ...newProf, status: oldProf.status, pid: oldProf.pid };
      })
    };
  });
  return { ...next, projects: mergedProjects };
}

// ─── Context ────────────────────────────────────────────────────────────────
interface WorkspaceContextValue {
  workspace: WorkspaceViewModel | null;
  session: WorkspaceSession | null;
  updateSession: (updates: Partial<WorkspaceSession>) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

let initCallCount = 0;

// ─── Provider ───────────────────────────────────────────────────────────────
function WorkspaceProviderComponent({ children }: { children: ReactNode }) {
  console.log('[DEBUG 2 WorkspaceProvider] Provider rendering');
  const [workspace, setWorkspace] = useState<WorkspaceViewModel | null>(null);
  const [session, setSession] = useState<WorkspaceSession | null>(null);

  useEffect(() => {
    initCallCount++;
    console.log(`[DEBUG 2 WorkspaceProvider] init() triggered. Execution count: ${initCallCount}`);
    
    // ── Initial load ─────────────────────────────────────────────────────
    const init = async () => {
      console.log('[DEBUG 2 WorkspaceProvider] init() async started');
      // 1. Load session first (always succeeds — falls back to default)
      let sess: WorkspaceSession;
      try {
        sess = await applicationStateService.loadSession();
        console.log('[DEBUG 2 WorkspaceProvider] loadSession succeeded:', sess);
      } catch (err) {
        console.error('[DEBUG 2 WorkspaceProvider] loadSession failed:', err);
        sess = { sidebarExpanded: true, recentWorkspaces: [], startupOption: 'always_restore', runtimeStates: {} };
      }
      setSession(sess);

      // 2. Load workspace (always succeeds — falls back to default)
      let ws: Workspace;
      try {
        console.log('[DEBUG 3 WorkspaceRepository] Calling workspaceRepository.getWorkspace()...');
        ws = await workspaceRepository.getWorkspace();
        console.log('[DEBUG 3 WorkspaceRepository] getWorkspace() returned:', ws);
      } catch (err) {
        console.error('[DEBUG 3 WorkspaceRepository] getWorkspace() failed:', err);
        ws = { id: 'ws-default', version: 1, name: 'Default Workspace', createdAt: Date.now(), updatedAt: Date.now(), projects: [] };
      }

      // 3. Set workspace state immediately (do NOT block on session save)
      const vm = toViewModel(ws);
      console.log('[DEBUG 4 useWorkspace] Setting workspace ViewModel:', vm, `Project count: ${vm.projects.length}`);
      setWorkspace(vm);

      // 4. Fire-and-forget: update recent workspaces (non-critical)
      applicationStateService.addRecentWorkspace({
        id: ws.id,
        name: ws.name,
        path: 'Local AppData',
        lastOpened: Date.now(),
        isPinned: false
      }).catch(err => console.warn('[DEBUG 2 WorkspaceProvider] addRecentWorkspace failed:', err));
    };

    init();

    // ── Subscriptions ─────────────────────────────────────────────────────
    const unsubSession = EventBus.subscribe<WorkspaceSession>(EventType.SettingsChanged, (s) => {
      console.log('[DEBUG 2 WorkspaceProvider] Received EventType.SettingsChanged:', s);
      setSession(s);
    });

    const unsubWorkspace = EventBus.subscribe<Workspace>(EventType.WorkspaceChanged, (ws) => {
      console.log('[DEBUG 8 EventBus] Subscriber received EventType.WorkspaceChanged:', ws);
      setWorkspace(prev => {
        const next = toViewModel(ws);
        const merged = prev ? mergeViewModel(prev, next) : next;
        console.log('[DEBUG 4 useWorkspace] Workspace state updated after WorkspaceChanged event. Project count:', merged.projects.length);
        return merged;
      });
    });

    const handleStatusChange = (payload: any) => {
      console.log('[DEBUG 2 WorkspaceProvider] Received process status change:', payload);
      setWorkspace(prev => {
        if (!prev) return prev;
        const updatedProjects = prev.projects.map(project => {
          if (project.id !== payload.projectId) return project;
          const updatedProfiles = project.profiles.map(profile => {
            const targetId = payload.profileId || payload.serviceId;
            if (profile.id !== targetId) return profile;
            return { ...profile, status: payload.status, pid: payload.pid };
          });
          const isAnyRunning = updatedProfiles.some(s => s.status === ProcessState.Running || s.status === ProcessState.Starting);
          const isAnyError = updatedProfiles.some(s => s.status === ProcessState.Failed);
          const projectStatus = isAnyError ? ProcessState.Failed : (isAnyRunning ? ProcessState.Running : ProcessState.Stopped);
          return { ...project, profiles: updatedProfiles, status: projectStatus };
        });
        return { ...prev, projects: updatedProjects };
      });
    };

    const unsubStarted = EventBus.subscribe<ProcessStatusResponse>(EventType.ProcessStarted, handleStatusChange);
    const unsubStopped = EventBus.subscribe<ProcessStatusResponse>(EventType.ProcessStopped, handleStatusChange);
    const unsubExited = EventBus.subscribe<ProcessStatusResponse>(EventType.ProcessExited, handleStatusChange);
    const unsubFailed = EventBus.subscribe<ProcessStatusResponse>(EventType.ProcessFailed, handleStatusChange);
    const unsubRestarting = EventBus.subscribe<ProcessStatusResponse>(EventType.ProcessRestarting, handleStatusChange);

    return () => {
      unsubSession();
      unsubWorkspace();
      unsubStarted();
      unsubStopped();
      unsubExited();
      unsubFailed();
      unsubRestarting();
    };
  }, []);

  const updateSession = (updates: Partial<WorkspaceSession>) => {
    console.log('[DEBUG 7 Session] updateSession called with updates:', updates);
    applicationStateService.updateSession(updates);
  };

  return createElement(WorkspaceContext.Provider, { value: { workspace, session, updateSession } }, children);
}

export const WorkspaceProvider = WorkspaceProviderComponent;

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  console.log('[DEBUG 4 useWorkspace] hook called. Context presents?', !!ctx, 'Workspace:', ctx?.workspace, 'Project count:', ctx?.workspace?.projects?.length);
  if (!ctx) throw new Error('useWorkspace() must be used inside <WorkspaceProvider>');
  return ctx;
}
