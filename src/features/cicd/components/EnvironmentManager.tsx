import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Icon } from '@/shared/components/ui/Icon';
import { Badge } from '@/shared/components/ui/badge';
import { Switch } from '@/shared/components/ui/switch';
import { invoke } from '@tauri-apps/api/core';
import { VariableEditor, EnvironmentVariable } from './VariableEditor';

export interface EnvironmentConfig {
  id: string;
  name: string;
  isProduction: boolean;
  variables: EnvironmentVariable[];
  // Other configs omitted for brevity
}

export interface ProjectCIConfig {
  environments: EnvironmentConfig[];
}

export function EnvironmentManager() {
  const [config, setConfig] = useState<ProjectCIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [newEnvName, setNewEnvName] = useState('');
  const [isProd, setIsProd] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await invoke<ProjectCIConfig>('get_project_config');
      setConfig(data);
      setError(null);
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleCreate = async () => {
    if (!newEnvName.trim()) return;
    setCreating(true);
    try {
      await invoke('create_environment', {
        env: {
          id: crypto.randomUUID(),
          name: newEnvName,
          isProduction: isProd,
          variables: [],
          deploymentTargets: [],
          externalServices: [],
        }
      });
      setNewEnvName('');
      setIsProd(false);
      await fetchConfig();
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke('delete_environment', { envId: id });
      await fetchConfig();
    } catch (err: any) {
      if (err.toString().startsWith('APPROVAL_REQUIRED')) {
        // Trigger policy approval dialog flow (integration handled via contexts in real app)
        setError('Production deletion requires approval via Policy Engine. Approval prompted.');
        // In a real flow, this invokes the PolicyApprovalDialog globally via context.
      } else {
        setError(err.toString());
      }
    }
  };
  
  const handleUpdateEnv = async (env: EnvironmentConfig) => {
    try {
      await invoke('update_environment', { env });
      await fetchConfig();
    } catch (err: any) {
      if (err.toString().startsWith('APPROVAL_REQUIRED')) {
        setError('Production update requires approval via Policy Engine. Approval prompted.');
      } else {
        setError(err.toString());
      }
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading environments...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Environments</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage isolated configuration scopes across your CI/CD pipelines.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-md text-red-500 text-sm font-medium flex items-center">
          <Icon name="AlertTriangle" size={16} className="mr-2" />
          {error}
        </div>
      )}

      {/* Create Environment */}
      <Card className="border-dashed bg-muted/20">
        <CardContent className="pt-6 flex flex-wrap gap-4 items-end">
          <div className="space-y-2 flex-1 min-w-[200px]">
            <label className="text-sm font-medium">Environment Name</label>
            <Input 
              placeholder="e.g. staging, production, pr-preview" 
              value={newEnvName}
              onChange={(e) => setNewEnvName(e.target.value)}
              disabled={creating}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center h-5">Production Target</label>
            <div className="flex items-center gap-2 h-10 border rounded-md px-3 bg-background">
              <Switch checked={isProd} onCheckedChange={setIsProd} disabled={creating} />
              <span className="text-sm font-medium">{isProd ? 'Yes' : 'No'}</span>
            </div>
          </div>
          <Button onClick={handleCreate} disabled={!newEnvName || creating} className="w-[120px]">
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </CardContent>
      </Card>

      {/* List Environments */}
      <div className="space-y-6">
        {config?.environments.length === 0 && (
          <div className="text-center p-12 border rounded-md border-dashed text-muted-foreground">
            No environments configured. Create one to get started.
          </div>
        )}
        
        {config?.environments.map(env => (
          <Card key={env.id} className={env.isProduction ? "border-orange-500/30" : ""}>
            <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-xl flex items-center gap-2">
                  {env.name}
                  {env.isProduction && (
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30">
                      <Icon name="AlertTriangle" size={12} className="mr-1" /> Production
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>ID: {env.id}</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleDelete(env.id)}
                className="text-red-500 hover:bg-red-500/10 hover:text-red-500 border-red-500/20"
              >
                <Icon name="Trash2" size={14} className="mr-2" />
                Delete
              </Button>
            </CardHeader>
            <CardContent>
              <h4 className="text-sm font-medium mb-3">Variables & Secrets</h4>
              <VariableEditor 
                envId={env.id}
                variables={env.variables}
                onVariablesChange={(newVars) => {
                  handleUpdateEnv({ ...env, variables: newVars });
                }}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
