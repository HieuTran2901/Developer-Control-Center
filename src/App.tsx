import { useEffect } from 'react';
import { setupDesktopIpc } from './desktop/ipc';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './shared/components/layouts/MainLayout';
import { Dashboard } from './features/dashboard/pages/Dashboard';
import { Settings } from './features/settings/pages/Settings';
import { WorkspacePage } from './features/workspace/pages/WorkspacePage';
import { PlaceholderPage } from './shared/components/ui/PlaceholderPage';
import { WorkspaceProvider } from './shared/hooks/useWorkspace';
import { ToastProvider } from './shared/hooks/useToast';
import { SecurityOverview } from './features/security/pages/SecurityOverview';
import { CICDOverview } from './features/cicd/pages/CICDOverview';

export default function App() {
  console.log('[DEBUG 1 App.tsx] App rendering, mounting WorkspaceProvider');
  useEffect(() => {
    console.log('[DEBUG 1 App.tsx] App useEffect setupDesktopIpc()');
    let unlisten: (() => void) | undefined;
    let isMounted = true;
    
    setupDesktopIpc().then((fn) => {
      unlisten = fn;
      if (!isMounted && unlisten) {
        unlisten();
      }
    });

    return () => {
      isMounted = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  return (
    <ToastProvider>
      <WorkspaceProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="projects" element={<Navigate to="/workspace" replace />} />
              <Route path="workspace" element={<WorkspacePage />} />
              <Route path="processes" element={<PlaceholderPage title="Processes" icon="Activity" />} />
              <Route path="terminal" element={<PlaceholderPage title="Terminal" icon="Terminal" />} />
              <Route path="logs" element={<PlaceholderPage title="Logs" icon="List" />} />
              <Route path="security" element={<SecurityOverview />} />
              <Route path="cicd" element={<CICDOverview />} />
              <Route path="settings" element={<Settings />} />
              <Route path="about" element={<PlaceholderPage title="About" icon="Info" />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </WorkspaceProvider>
    </ToastProvider>
  );
}
