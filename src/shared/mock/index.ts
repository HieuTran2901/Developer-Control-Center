import { Workspace } from '@/domain/entities/Workspace';

export const mockWorkspace: Workspace = {
  version: 1,
  id: 'ws-mock',
  name: 'Mock Workspace',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  projects: [
    {
      id: 'p1',
      workspaceId: 'ws-mock',
      name: 'Developer Control Center',
      rootPath: 'E:\\Github project\\Developer-Control-Center',
      profiles: [
        {
          id: 'web',
          projectId: 'p1',
          name: 'Tauri App',
          workingDirectory: 'E:\\Github project\\Developer-Control-Center',
          command: 'npm',
          arguments: ['run', 'tauri', 'dev'],
        }
      ]
    }
  ]
};


