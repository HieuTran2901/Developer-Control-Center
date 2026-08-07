import { ProcessState } from './ProcessState';

export interface RecentWorkspace {
  id: string;
  name: string;
  path: string;
  lastOpened: number;
  isPinned: boolean;
}

export interface RuntimeSessionInfo {
  pid?: number;
  status: ProcessState;
  lastExitCode?: number;
  lastStarted?: number;
  lastStopped?: number;
}

export type StartupOption = 'always_restore' | 'ask_every_time' | 'empty';

export interface WorkspaceSession {
  currentWorkspaceId?: string;
  selectedProjectId?: string;
  selectedProfileId?: string;
  activeTerminalId?: string;
  sidebarExpanded: boolean;
  windowLayout?: string;
  theme?: string;
  recentWorkspaces: RecentWorkspace[];
  startupOption: StartupOption;
  runtimeStates: Record<string, RuntimeSessionInfo>;
}

export const createDefaultSession = (): WorkspaceSession => ({
  sidebarExpanded: true,
  recentWorkspaces: [],
  startupOption: 'always_restore',
  runtimeStates: {},
});
