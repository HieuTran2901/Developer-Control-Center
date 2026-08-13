import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';
import { PipelineDefinition, usePipelineContext } from '../context/PipelineContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';

interface PolicyStepPreview {
  stepId: string;
  stepName: string;
  decision: any;
}

interface PolicyPreview {
  isAllowed: boolean;
  isApprovalRequired: boolean;
  steps: PolicyStepPreview[];
}

interface ExportPipelineResult {
  content: string;
  targetFilePath: string;
  targetDirectory: string;
}

interface PipelinePreviewProps {
  pipeline: PipelineDefinition;
  securityPreview: PolicyPreview;
  platform: string;
  onBack: () => void;
}

export function PipelinePreview({ pipeline, securityPreview, platform, onBack }: PipelinePreviewProps) {
  const { selectedProject } = usePipelineContext();
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportPipelineResult | null>(null);
  const [error, setError] = useState('');
  const [yamlPreview, setYamlPreview] = useState<string | null>(null);
  const [localApprovalStatuses, setLocalApprovalStatuses] = useState<Record<string, string>>({});
  const [approvalIdMap, setApprovalIdMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const handleStatusChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ approvalId: string; status: string }>;
      setLocalApprovalStatuses(prev => ({
        ...prev,
        [customEvent.detail.approvalId]: customEvent.detail.status
      }));
    };

    const handleApprovalRenewed = (e: Event) => {
      const customEvent = e as CustomEvent<{ oldApprovalId: string; newApprovalId: string; status: string }>;
      const { oldApprovalId, newApprovalId, status } = customEvent.detail;
      setApprovalIdMap(prev => ({
        ...prev,
        [oldApprovalId]: newApprovalId
      }));
      setLocalApprovalStatuses(prev => ({
        ...prev,
        [newApprovalId]: status || 'PENDING'
      }));
    };

    window.addEventListener('pipeline:approval-status-changed', handleStatusChanged);
    window.addEventListener('pipeline:approval-renewed', handleApprovalRenewed);
    return () => {
      window.removeEventListener('pipeline:approval-status-changed', handleStatusChanged);
      window.removeEventListener('pipeline:approval-renewed', handleApprovalRenewed);
    };
  }, []);

  useEffect(() => {
    setExportResult(null);
    setYamlPreview(null);
    setError('');
  }, [pipeline?.id, selectedProject?.id, platform]);

  const { isAllowed, isApprovalRequired, steps } = securityPreview;

  const handleExport = async () => {
    if (!isAllowed) return;
    setExporting(true);
    setError('');
    setExportResult(null);

    try {
      const res = await invoke<ExportPipelineResult>('export_pipeline_cmd', { 
        pipeline, 
        platform,
        projectRootPath: selectedProject?.rootPath || null,
        approvalId: null 
      });
      setYamlPreview(res.content);
      setExportResult(res);
    } catch (err: any) {
      const errStr = err.toString();
      if (errStr.includes('APPROVAL_REQUIRED')) {
        setError('A high-risk export action requires your explicit approval. Please approve the prompt dialog, then click Export again.');
      } else {
        setError(`Export failed: ${errStr}`);
      }
    } finally {
      setExporting(false);
    }
  };

  const getStepConfig = (stepId: string) => {
    if (!pipeline?.stages) return null;
    for (const stage of pipeline.stages) {
      for (const step of stage.steps) {
        if (step.id === stepId) {
          return step;
        }
      }
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full min-h-0 overflow-hidden bg-card/40">
      <div className="shrink-0 border-b border-border/20 px-6 py-4 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Icon name="Eye" size={20} />
            <h2 className="text-lg font-bold text-foreground">Pipeline Security Review</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Review steps and security decisions before exporting.
          </p>
        </div>
        <Button variant="ghost" onClick={onBack} className="h-8">
          <Icon name="ArrowLeft" size={16} className="mr-2" />
          Back to Generator
        </Button>
      </div>
      
      <div className="flex-1 flex flex-col min-h-0 p-6 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto pr-2 flex flex-col gap-6">
          {/* Security Preview Banners */}
          {pipeline.verificationStatus === 'REJECTED' && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex gap-3 items-start text-red-500 shrink-0">
              <Icon name="AlertTriangle" size={20} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Reality Verification Failed</h4>
                <p className="text-xs text-muted-foreground">
                  The proposed pipeline conflicts with the physical repository reality (e.g. missing wrappers, invalid components).
                </p>
                <div className="text-[10px] font-mono mt-1 opacity-80">Confidence: {pipeline.confidenceScore?.toFixed(2)}</div>
              </div>
            </div>
          )}

          {pipeline.verificationStatus === 'VERIFIED' && (
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 flex gap-3 items-start text-blue-500 shrink-0">
              <Icon name="CheckCircle" size={20} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Reality Verification Passed</h4>
                <p className="text-xs text-muted-foreground">
                  Pipeline structurally validated against repository context.
                </p>
                <div className="text-[10px] font-mono mt-1 opacity-80 flex gap-4">
                  <span>Confidence: {pipeline.confidenceScore?.toFixed(2)}</span>
                  <span>Evidence Points: {pipeline.provenance?.globalEvidence?.length || 0}</span>
                </div>
              </div>
            </div>
          )}

          {!isAllowed && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex gap-3 items-start text-red-500 shrink-0">
              <Icon name="ShieldX" size={20} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Security Policy Denied</h4>
                <p className="text-xs text-muted-foreground">
                  This pipeline cannot be exported or run. It contains commands or patterns that violate the security policy.
                </p>
              </div>
            </div>
          )}
          
          {isAllowed && isApprovalRequired && (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 flex gap-3 items-start text-amber-500 shrink-0">
              <Icon name="ShieldAlert" size={20} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Security Approval Required</h4>
                <p className="text-xs text-muted-foreground">
                  This pipeline contains high-risk steps. You must authorize pending steps before exporting.
                </p>
              </div>
            </div>
          )}

          {isAllowed && !isApprovalRequired && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 flex gap-3 items-start text-green-500 shrink-0">
              <Icon name="ShieldCheck" size={20} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Security Verification Passed</h4>
                <p className="text-xs text-muted-foreground">
                  All generated actions conform to safe rules and can be exported directly.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between shrink-0 mt-2">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Icon name="Shield" size={16} className="text-primary" />
                Step Security Decisions
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <Icon name="Code" size={14} className="mr-1.5" />
                    Internal JSON
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Internal Pipeline Representation</DialogTitle>
                  </DialogHeader>
                  <div className="flex-1 min-h-0 overflow-y-auto bg-muted/30 p-4 rounded border border-border/30 font-mono text-xs">
                    <pre className="whitespace-pre-wrap break-words">{JSON.stringify(pipeline, null, 2)}</pre>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <Icon name="FileText" size={14} className="mr-1.5" />
                    Preview YAML
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>{platform === 'github' ? 'GitHub Actions' : platform === 'gitlab' ? 'GitLab CI' : 'Generic Shell'} Output</DialogTitle>
                  </DialogHeader>
                  <div className="flex-1 min-h-0 overflow-y-auto bg-muted/30 p-4 rounded border border-border/30 font-mono text-xs">
                    {yamlPreview ? (
                      <pre className="text-green-400 whitespace-pre-wrap break-words">{yamlPreview}</pre>
                    ) : (
                      <div className="text-muted-foreground flex flex-col items-center justify-center h-full gap-2 opacity-70">
                        <Icon name="FileText" size={32} />
                        <p>Click Export Pipeline to render the final YAML output.</p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {steps.map((step) => {
              const originalType = step.decision.type;
              const originalApprovalId = step.decision.details?.approvalId;
              const activeApprovalId = originalApprovalId ? (approvalIdMap[originalApprovalId] || originalApprovalId) : undefined;
              const localStatus = activeApprovalId ? localApprovalStatuses[activeApprovalId] : undefined;
              
              let isDeny = originalType === 'deny';
              let isReqApp = originalType === 'requireApproval';
              
              if (localStatus === 'APPROVED') {
                isDeny = false;
                isReqApp = false;
              } else if (localStatus === 'REJECTED') {
                isDeny = true;
                isReqApp = false;
              }

              const stepConfig = getStepConfig(step.stepId);
              
              return (
                <div key={step.stepId} className="flex flex-col p-3 rounded-lg bg-card border border-border/40 shadow-sm">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-foreground truncate">{step.stepName}</span>
                      <span className="text-[10px] text-muted-foreground font-mono mt-0.5">{step.stepId}</span>
                    </div>
                    <div className="shrink-0 flex items-center">
                      {isDeny && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-500 border border-red-500/20">
                          <Icon name="ShieldX" size={10} />
                          DENIED
                        </span>
                      )}
                      {isReqApp && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          <Icon name="Clock" size={10} />
                          PENDING
                        </span>
                      )}
                      {!isDeny && !isReqApp && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-green-500/10 text-green-500 border border-green-500/20">
                          <Icon name="Check" size={10} />
                          ALLOWED
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-auto flex items-center justify-between border-t border-border/10 pt-3">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground">
                          <Icon name="Search" size={12} className="mr-1.5" />
                          Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            {step.stepName}
                            {!isDeny && !isReqApp && (
                              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-green-500/10 text-green-500 border border-green-500/20 uppercase">Allowed</span>
                            )}
                            {isReqApp && (
                              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase">Pending</span>
                            )}
                            {isDeny && (
                              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-500 border border-red-500/20 uppercase">Denied</span>
                            )}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pt-2">
                          <div>
                            <h4 className="text-sm font-semibold mb-1 text-muted-foreground">Step ID</h4>
                            <p className="font-mono text-xs">{step.stepId}</p>
                          </div>
                          {stepConfig && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Configuration</h4>
                              <div className="bg-muted/30 border border-border/30 rounded p-3 font-mono text-xs overflow-x-auto">
                                <pre>{JSON.stringify(stepConfig, null, 2)}</pre>
                              </div>
                            </div>
                          )}
                          <div>
                            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Security Decision Details</h4>
                            <div className="bg-muted/30 border border-border/30 rounded p-3 font-mono text-xs overflow-x-auto">
                              <pre className="whitespace-pre-wrap break-words">{JSON.stringify(step.decision, null, 2)}</pre>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {isReqApp && activeApprovalId && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-[11px] px-3 border-amber-500/30 hover:bg-amber-500/10 text-amber-500"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('pipeline:approval-required', { 
                            detail: {
                              approvalId: activeApprovalId,
                              stepId: step.stepId,
                              prompt: step.decision.details.prompt,
                              actionFingerprint: step.decision.details.actionFingerprint,
                              pipeline,
                              platform
                            } 
                          }));
                        }}
                      >
                        <Icon name="ShieldAlert" size={12} className="mr-1.5" />
                        Authorize
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 flex flex-col gap-3">
          {error && (
            <div className="mt-4 p-3 text-sm text-red-500 bg-red-500/10 rounded border border-red-500/20 flex gap-2 items-start">
              <Icon name="ShieldAlert" size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          
          {exportResult && (
            <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-green-500">
              <div className="flex items-start gap-2.5 min-w-0">
                <Icon name="CheckCircle2" size={18} className="shrink-0 mt-0.5" />
                <div className="space-y-0.5 min-w-0">
                  <p className="font-semibold text-sm">Pipeline exported successfully!</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    File written to: <span className="text-foreground font-medium">{exportResult.targetFilePath}</span>
                  </p>
                </div>
              </div>
              {exportResult.targetDirectory && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 border-green-500/30 text-green-500 hover:bg-green-500/10 shrink-0"
                  onClick={async () => {
                    try {
                      await invoke('open_folder_command', { path: exportResult.targetDirectory });
                    } catch (e) {
                      console.error('Failed to open directory:', e);
                    }
                  }}
                >
                  <Icon name="FolderOpen" size={14} />
                  Open Folder
                </Button>
              )}
            </div>
          )}

          <div className="mt-2 shrink-0 flex justify-end gap-3 pt-4 border-t border-border/20">
            <Button variant="outline" onClick={onBack}>
              Cancel
            </Button>
            <Button 
              onClick={handleExport}
              disabled={!isAllowed || exporting || (exportResult !== null)}
              className="min-w-[140px]"
            >
              {exporting ? (
                <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
              ) : (
                <Icon name="Download" size={16} className="mr-2" />
              )}
              {exporting ? 'Exporting...' : exportResult ? 'Exported' : 'Export Pipeline'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
