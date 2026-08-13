import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';
import { PipelinePreview } from './PipelinePreview';
import { usePipelineContext } from '../context/PipelineContext';
import { Badge } from '@/shared/components/ui/badge';

type ScanState = 'idle' | 'scanning' | 'complete' | 'error';

export function PipelineGenerator() {
  const { selectedProject } = usePipelineContext();
  
  const [intent, setIntent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRefusal, setIsRefusal] = useState(false);
  const [platform, setPlatform] = useState('github');
  const [generatedPipeline, setGeneratedPipeline] = useState<any | null>(null);

  // Intelligence State
  const [customPath, setCustomPath] = useState<string | null>(null);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [intelligence, setIntelligence] = useState<any | null>(null);

  const activePath = customPath || selectedProject?.rootPath;
  const projectName = customPath ? activePath?.split(/[/\\]/).pop() : selectedProject?.name;
  
  // Auto-scan when active path changes
  useEffect(() => {
    if (activePath) {
      scanProject(activePath);
    }
  }, [activePath]);

  const scanProject = async (path: string) => {
    setScanState('scanning');
    setError('');
    try {
      const result = await invoke<any>('scan_project_cmd', { projectRootPath: path });
      setIntelligence(result);
      setScanState('complete');
    } catch (err: any) {
      console.error('Failed to scan project:', err);
      setError(err.toString());
      setScanState('error');
    }
  };

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        setCustomPath(selected);
      }
    } catch (err) {
      console.error('Dialog error:', err);
    }
  };

  const handleUseWorkspace = () => {
    setCustomPath(null);
  };

  const handleGenerate = async () => {
    if (!activePath) return;
    setLoading(true);
    setError('');
    setIsRefusal(false);
    setGeneratedPipeline(null);

    try {
      const result = await invoke<any>('generate_pipeline_cmd', { 
        userIntent: intent || `Generate a ${platform} pipeline for my project`,
        projectRootPath: activePath
      });
      setGeneratedPipeline(result);
    } catch (err: any) {
      console.error('Failed to generate pipeline:', err);
      const errMsg = err.toString();
      setError(errMsg);
      if (errMsg.includes('AI Safety Refusal')) {
        setIsRefusal(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setGeneratedPipeline(null);
    setIntent('');
    setError('');
    setIsRefusal(false);
    // don't clear intelligence/path
  };

  if (generatedPipeline) {
    return (
      <PipelinePreview 
        pipeline={generatedPipeline.pipeline} 
        securityPreview={generatedPipeline.securityPreview} 
        platform={platform} 
        onBack={reset} 
      />
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full overflow-y-auto">
      <div className="w-full flex-1 flex flex-col p-6 lg:p-8 space-y-8">
        
        <div className="flex items-center justify-between pb-4 border-b border-border/20 shrink-0">
          <div className="flex items-center gap-3 text-primary">
            <Icon name="Wand2" size={24} />
            <div>
              <h2 className="text-xl font-bold text-foreground">AI Pipeline Generator</h2>
              <p className="text-sm text-muted-foreground mt-1">Generate a secure CI/CD pipeline tailored to your codebase.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={reset} disabled={loading || (!generatedPipeline && !intent)}>
              Clear
            </Button>
            <Button 
              onClick={handleGenerate} 
              disabled={loading || scanState !== 'complete' || !activePath} 
              className="bg-primary text-primary-foreground min-w-[160px]"
            >
              {loading ? (
                <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
              ) : (
                <Icon name="Sparkles" size={16} className="mr-2" />
              )}
              {loading ? 'Generating...' : 'Generate Pipeline'}
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 shrink-0">
          
          {/* Project Source Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Icon name="FolderOpen" size={16} className="text-muted-foreground" />
              Project Source
            </h3>
            
            <div className="border border-border/40 rounded-lg p-5 bg-card/40 flex flex-col justify-between gap-4 h-[140px]">
              <div className="flex items-start gap-3 overflow-hidden">
                <Icon name={activePath ? "Folder" : "FolderOpen"} className="text-blue-500 mt-1 shrink-0" size={24} />
                <div className="min-w-0">
                  <div className="font-semibold text-base truncate">{projectName || 'No Project Selected'}</div>
                  <div className="text-sm text-muted-foreground truncate mt-1" title={activePath}>
                    {activePath || 'Please select a source folder to scan.'}
                  </div>
                  {intelligence?.git_info?.branch && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                      <Icon name="GitBranch" size={14} />
                      <span>Branch: {intelligence.git_info.branch}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-2 mt-auto justify-end">
                {customPath && selectedProject && (
                  <Button size="sm" variant="outline" onClick={handleUseWorkspace}>
                    Use Workspace
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={handleSelectFolder}>
                  <Icon name="FolderSearch" size={16} className="mr-2" />
                  {activePath ? 'Change Folder' : 'Select Folder'}
                </Button>
              </div>
            </div>
          </div>

          {/* Project Intelligence Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Icon name="Cpu" size={16} className="text-muted-foreground" />
              Project Intelligence
            </h3>
            
            <div className="border border-border/40 rounded-lg p-5 bg-card/40 flex flex-col justify-center min-h-[140px] max-h-[300px] overflow-y-auto">
              {scanState === 'idle' && (
                <div className="text-center text-sm text-muted-foreground">Waiting for project source...</div>
              )}
              
              {scanState === 'scanning' && (
                <div className="flex flex-col items-center justify-center gap-3">
                  <Icon name="Loader2" size={24} className="animate-spin text-primary" />
                  <div className="text-sm font-medium">Scanning project structure...</div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Icon name="CheckCircle2" size={12} className="text-green-500"/> Detecting language</span>
                    <span className="flex items-center gap-1"><Icon name="CheckCircle2" size={12} className="text-green-500"/> Detecting framework</span>
                  </div>
                </div>
              )}

              {scanState === 'error' && (
                <div className="text-center text-sm text-red-500 flex flex-col items-center gap-2">
                  <Icon name="AlertTriangle" size={24} />
                  <span>Failed to scan project: {error}</span>
                </div>
              )}

              {scanState === 'complete' && intelligence && (
                <div className="space-y-4">
                  {intelligence.frameworks?.length === 0 && intelligence.languages?.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-4">No framework or language detected</div>
                  ) : (
                    <div className="space-y-3">
                      {intelligence.architecture_type && intelligence.architecture_type !== 'unknown' && (
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] uppercase text-muted-foreground font-semibold min-w-[90px] pt-1 tracking-wider">Architecture</span>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="secondary" className="bg-stone-500/10 text-stone-500 border-stone-500/20 capitalize">{intelligence.architecture_type}</Badge>
                            {intelligence.components?.length > 1 && (
                              <span className="text-xs text-muted-foreground self-center ml-1">{intelligence.components.length} components</span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {intelligence.languages?.length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] uppercase text-muted-foreground font-semibold min-w-[90px] pt-1 tracking-wider">Languages</span>
                          <div className="flex flex-wrap gap-1.5">
                            {intelligence.languages.map((item: string) => (
                              <Badge key={item} variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20">{item}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {intelligence.frameworks?.length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] uppercase text-muted-foreground font-semibold min-w-[90px] pt-1 tracking-wider">Frameworks</span>
                          <div className="flex flex-wrap gap-1.5">
                            {intelligence.frameworks.map((fw: string) => (
                              <Badge key={fw} variant="secondary" className="bg-purple-500/10 text-purple-500 border-purple-500/20">{fw}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {(intelligence.build_tools?.length > 0 || intelligence.package_managers?.length > 0) && (
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] uppercase text-muted-foreground font-semibold min-w-[90px] pt-1 tracking-wider">Build</span>
                          <div className="flex flex-wrap gap-1.5">
                            {intelligence.build_tools?.map((bt: string) => (
                              <Badge key={bt} variant="secondary" className="bg-orange-500/10 text-orange-500 border-orange-500/20">{bt}</Badge>
                            ))}
                            {intelligence.package_managers?.map((pm: string) => (
                              <Badge key={pm} variant="secondary" className="bg-orange-500/10 text-orange-500 border-orange-500/20">{pm}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {intelligence.test_frameworks?.length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] uppercase text-muted-foreground font-semibold min-w-[90px] pt-1 tracking-wider">Tests</span>
                          <div className="flex flex-wrap gap-1.5">
                            {intelligence.test_frameworks.map((tf: string) => (
                              <Badge key={tf} variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">{tf}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {(intelligence.infrastructure?.length > 0 || intelligence.ci_cd?.length > 0 || intelligence.git_info?.repository) && (
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] uppercase text-muted-foreground font-semibold min-w-[90px] pt-1 tracking-wider">Infra & CI</span>
                          <div className="flex flex-wrap gap-1.5">
                            {intelligence.infrastructure?.map((inf: string) => (
                              <Badge key={inf} variant="secondary" className="bg-cyan-500/10 text-cyan-500 border-cyan-500/20">{inf}</Badge>
                            ))}
                            {intelligence.ci_cd?.map((ci: string) => (
                              <Badge key={ci} variant="secondary" className="bg-rose-500/10 text-rose-500 border-rose-500/20">{ci}</Badge>
                            ))}
                            {intelligence.git_info?.repository && <Badge variant="secondary" className="bg-stone-500/10 text-stone-500 border-stone-500/20">Git Repo</Badge>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="text-xs text-muted-foreground flex items-center justify-between pt-2 border-t border-border/20">
                    <div>
                      Analyzed {intelligence.scanned_file_count || intelligence.relevantFiles?.length || 0} critical files. 
                      {intelligence.existing_ci?.length > 0 && ` Found ${intelligence.existing_ci.length} existing CI config(s).`}
                    </div>
                    <div className="text-emerald-500 flex items-center gap-1 font-medium">
                      <Icon name="ShieldCheck" size={14} />
                      Sanitized
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Generator Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 shrink-0">
          <div className="space-y-4">
             <label className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
               <Icon name="Rocket" size={16} className="text-muted-foreground" />
               Deployment Target
             </label>
             <select 
               className="flex h-12 w-full rounded-md border border-input bg-card/40 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
               value={platform}
               onChange={(e) => setPlatform(e.target.value)}
               disabled={loading || scanState !== 'complete'}
             >
               <option value="github">GitHub Actions</option>
               <option value="gitlab">GitLab CI</option>
               <option value="shell">Generic Shell Script</option>
             </select>
          </div>
          
          <div className="space-y-4 md:col-span-2">
            <label className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-2"><Icon name="MessageSquare" size={16} className="text-muted-foreground" /> Additional Instructions</span>
              <span className="text-muted-foreground font-normal lowercase">(Optional)</span>
            </label>
            <textarea
              className="flex w-full rounded-md border border-input bg-card/40 px-3 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[48px] resize-y"
              placeholder="e.g. Deploy to AWS ECS cluster 'prod', ensure we run linters first..."
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              disabled={loading || scanState !== 'complete'}
            />
          </div>
        </div>

        {error && isRefusal && (
          <div className="p-4 text-sm text-amber-500 bg-amber-500/10 rounded-lg border border-amber-500/20 flex flex-col gap-2 items-start shrink-0">
            <div className="flex gap-2 items-center font-semibold">
              <Icon name="ShieldAlert" size={18} className="shrink-0 text-amber-500" />
              <span>AI Safety Refusal</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The AI provider refused to generate this pipeline because the request violated safety policies. Please modify your instructions.
            </p>
          </div>
        )}
        
        {error && !isRefusal && scanState === 'complete' && (
          <div className="p-4 text-sm text-red-500 bg-red-500/10 rounded-lg border border-red-500/20 flex gap-2 items-start shrink-0">
            <Icon name="AlertTriangle" size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        
      </div>
    </div>
  );
}
