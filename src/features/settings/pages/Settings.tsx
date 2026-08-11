import { useState } from 'react';

import { PageContainer } from '@/shared/components/layouts/PageContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';
import { AIProviders } from '../components/AIProviders';
import { desktopHealthService } from '@/application/services';
import { HealthStatus } from '@/application/services/DesktopHealthService';

export function Settings() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const runDiagnostic = async () => {
    setIsChecking(true);
    setHealthStatus(null);
    try {
      const status = await desktopHealthService.checkHealth();
      setHealthStatus(status);
    } catch (e) {
      console.error(e);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <PageContainer title="Settings" description="Manage your application preferences and configurations.">
      <Tabs defaultValue="appearance" className="w-full max-w-4xl animate-in fade-in duration-500">
        <TabsList className="mb-6">
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="developer">Developer Options</TabsTrigger>
          <TabsTrigger value="ai-providers">AI Providers</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>
        
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>Select your preferred color theme. Dark mode is default.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4">
                <div className="border-2 border-primary rounded-lg p-4 bg-background w-32 cursor-pointer text-center">
                  <div className="w-full h-16 bg-card rounded mb-2"></div>
                  <span className="text-sm font-medium">System</span>
                </div>
                <div className="border border-border rounded-lg p-4 bg-white text-zinc-950 w-32 cursor-pointer text-center">
                  <div className="w-full h-16 bg-zinc-100 rounded mb-2 border border-zinc-200"></div>
                  <span className="text-sm font-medium">Light</span>
                </div>
                <div className="border border-border rounded-lg p-4 bg-zinc-950 text-white w-32 cursor-pointer text-center">
                  <div className="w-full h-16 bg-zinc-900 rounded mb-2 border border-zinc-800"></div>
                  <span className="text-sm font-medium">Dark</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="developer">
          <Card>
            <CardHeader>
              <CardTitle>Developer Configuration</CardTitle>
              <CardDescription>Advanced settings for developers.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Settings for default workspace path, terminal shell, and environment variables will go here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-providers">
          <AIProviders />
        </TabsContent>

        <TabsContent value="health">
          <Card>
            <CardHeader>
              <CardTitle>Desktop Gateway Diagnostic</CardTitle>
              <CardDescription>Check the IPC connection between React and Rust (Tauri).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-md bg-muted/50 border">
                  <div className="flex items-center space-x-3">
                    <Icon name="Activity" className="text-primary" />
                    <div>
                      <div className="font-medium">Rust Connected</div>
                      <div className="text-xs text-muted-foreground">Tests the ping() command to the Rust backend</div>
                    </div>
                  </div>
                  <div>
                    {healthStatus ? (
                      healthStatus.rustConnected ? <Icon name="CheckCircle2" className="text-success" /> : <Icon name="XCircle" className="text-danger" />
                    ) : <span className="text-xs text-muted-foreground">Pending</span>}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-md bg-muted/50 border">
                  <div className="flex items-center space-x-3">
                    <Icon name="Cpu" className="text-primary" />
                    <div>
                      <div className="font-medium">Tauri API Ready</div>
                      <div className="text-xs text-muted-foreground">Tests getAppVersion() via Tauri API</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {healthStatus?.version && <span className="text-xs font-mono bg-background px-2 py-1 rounded">{healthStatus.version}</span>}
                    {healthStatus ? (
                      healthStatus.tauriReady ? <Icon name="CheckCircle2" className="text-success" /> : <Icon name="XCircle" className="text-danger" />
                    ) : <span className="text-xs text-muted-foreground">Pending</span>}
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-md bg-muted/50 border">
                  <div className="flex items-center space-x-3">
                    <Icon name="Network" className="text-primary" />
                    <div>
                      <div className="font-medium">IPC Connected</div>
                      <div className="text-xs text-muted-foreground">Verifies Inter-Process Communication channel</div>
                    </div>
                  </div>
                  <div>
                    {healthStatus ? (
                      healthStatus.ipcConnected ? <Icon name="CheckCircle2" className="text-success" /> : <Icon name="XCircle" className="text-danger" />
                    ) : <span className="text-xs text-muted-foreground">Pending</span>}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={runDiagnostic} disabled={isChecking}>
                {isChecking ? <Icon name="Loader2" className="mr-2 h-16 w-16 animate-spin" /> : <Icon name="Play" className="mr-2 h-16 w-16" />}
                {isChecking ? 'Running Test...' : 'Run Diagnostic'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle>Developer Control Center</CardTitle>
              <CardDescription>Version 1.0.0-alpha</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Built with Tauri, React, and Tailwind CSS.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
