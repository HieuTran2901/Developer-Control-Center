import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Icon } from '@/shared/components/ui/Icon';
import { cn } from '@/shared/utils';

export interface DiscoveredProjectCandidate {
  name: string;
  path: string;
  relativePath: string;
  manifestType: string;
  frameworks: string[];
  languages: string[];
}

export type ScopeClassification = 'SAFE' | 'LARGE' | 'BLOCKED';

export interface FolderScopeAnalysis {
  rootPath: string;
  classification: ScopeClassification;
  reason?: string;
  estimatedFiles: number;
  estimatedDirectories: number;
  excludedDirectories: string[];
  projectCandidates: DiscoveredProjectCandidate[];
  isBudgetExceeded: boolean;
  isCancelled: boolean;
  scanDurationMs: number;
}

interface FolderScopeModalProps {
  isOpen: boolean;
  isAnalyzing: boolean;
  analysis: FolderScopeAnalysis | null;
  onClose: () => void;
  onSelectProject: (targetPath: string) => void;
  onChangeFolder: () => void;
}

export function FolderScopeModal({
  isOpen,
  isAnalyzing,
  analysis,
  onClose,
  onSelectProject,
  onChangeFolder,
}: FolderScopeModalProps) {
  const [selectedCandidatePath, setSelectedCandidatePath] = useState<string | null>(null);

  // Sync selected candidate when analysis updates
  React.useEffect(() => {
    if (analysis?.projectCandidates && analysis.projectCandidates.length > 0) {
      setSelectedCandidatePath(analysis.projectCandidates[0].path);
    } else if (analysis) {
      setSelectedCandidatePath(analysis.rootPath);
    }
  }, [analysis]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl bg-[#0d1117] border-border/40 text-foreground p-6 shadow-2xl">
        {/* State 1: ANALYZING */}
        {isAnalyzing && (
          <div className="py-8 flex flex-col items-center justify-center space-y-4">
            <Icon name="Loader2" size={36} className="animate-spin text-primary" />
            <div className="text-center">
              <h3 className="font-semibold text-lg">Analyzing Folder Scope...</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Checking safety limits and discovering project structure without deep recursion.
              </p>
            </div>
            <div className="pt-4">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* State 2: ANALYSIS RESULT */}
        {!isAnalyzing && analysis && (
          <>
            {/* ----------------- BLOCKED VIEW ----------------- */}
            {analysis.classification === 'BLOCKED' && (
              <div className="space-y-6">
                <DialogHeader>
                  <div className="flex items-center gap-2 text-destructive font-semibold">
                    <Icon name="AlertTriangle" size={20} />
                    <DialogTitle className="text-lg">Large / Protected Folder</DialogTitle>
                  </div>
                </DialogHeader>

                <div className="border border-destructive/30 rounded-lg p-4 bg-destructive/10 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Icon name="Folder" size={18} className="text-destructive mt-0.5 shrink-0" />
                    <span className="font-mono text-sm break-all font-medium text-foreground">
                      {analysis.rootPath}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                    <span className="text-xs font-semibold text-destructive uppercase tracking-wider">
                      Scan Blocked
                    </span>
                  </div>

                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {analysis.reason || 'This location is too broad for a project scan.'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    DCC will not scan this location automatically to prevent system resource exhaustion.
                    Please select the actual project folder.
                  </p>
                </div>

                <DialogFooter className="flex justify-end gap-2 pt-2">
                  <Button variant="default" onClick={onChangeFolder} className="bg-primary text-primary-foreground">
                    <Icon name="FolderSearch" size={15} className="mr-2" />
                    Choose Another Folder
                  </Button>
                </DialogFooter>
              </div>
            )}

            {/* ----------------- SAFE VIEW ----------------- */}
            {analysis.classification === 'SAFE' && (
              <div className="space-y-6">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                    <Icon name="FolderCheck" size={20} className="text-green-500" />
                    Folder Scope
                  </DialogTitle>
                </DialogHeader>

                <div className="border border-border/40 rounded-lg p-4 bg-card/40 space-y-4">
                  <div className="flex items-start gap-2.5">
                    <Icon name="Folder" size={18} className="text-blue-500 mt-0.5 shrink-0" />
                    <span className="font-mono text-sm break-all font-medium text-foreground">
                      {analysis.rootPath}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs font-semibold text-green-500 uppercase tracking-wider">
                      Safe
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                      Estimated scope
                    </div>
                    <div className="text-sm text-foreground font-mono">
                      {analysis.estimatedFiles.toLocaleString()} files • {analysis.estimatedDirectories.toLocaleString()} directories
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                      Excluded from scan
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground font-mono">
                      {analysis.excludedDirectories.join(' • ')}
                    </div>
                  </div>
                </div>

                <DialogFooter className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => onSelectProject(analysis.rootPath)}
                    className="bg-primary text-primary-foreground"
                  >
                    <Icon name="Play" size={15} className="mr-2" />
                    Scan Project
                  </Button>
                </DialogFooter>
              </div>
            )}

            {/* ----------------- LARGE VIEW ----------------- */}
            {analysis.classification === 'LARGE' && (
              <div className="space-y-5">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                    <Icon name="FolderGit2" size={20} className="text-amber-500" />
                    Select Project Scope
                  </DialogTitle>
                </DialogHeader>

                <div className="border border-border/40 rounded-lg p-4 bg-card/40 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Icon name="Folder" size={18} className="text-amber-500 mt-0.5 shrink-0" />
                    <span className="font-mono text-sm break-all font-medium text-foreground">
                      {analysis.rootPath}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
                      Large Scope
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {analysis.isBudgetExceeded
                      ? '⚠ Scan scope is too large. Discovery was stopped to protect system resources. Please select a specific project.'
                      : 'This folder contains multiple project candidates or nested modules. Please select one to analyze.'}
                  </p>
                </div>

                {/* Project Candidates List */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center justify-between">
                    <span>Project Candidates ({analysis.projectCandidates.length})</span>
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {analysis.estimatedDirectories} dirs • {analysis.estimatedFiles} files inspected
                    </span>
                  </div>

                  <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                    {analysis.projectCandidates.map((candidate) => {
                      const isSelected = selectedCandidatePath === candidate.path;
                      return (
                        <div
                          key={candidate.path}
                          onClick={() => setSelectedCandidatePath(candidate.path)}
                          className={cn(
                            'p-3 rounded-lg border text-left cursor-pointer transition-all flex items-start gap-3',
                            isSelected
                              ? 'bg-primary/10 border-primary/60 text-foreground'
                              : 'bg-[#161b22]/40 border-border/40 text-foreground/80 hover:bg-[#161b22]/80'
                          )}
                        >
                          <div className="pt-0.5">
                            <div
                              className={cn(
                                'w-4 h-4 rounded-full border flex items-center justify-center transition-all',
                                isSelected
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-muted-foreground/50 bg-transparent'
                              )}
                            >
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-sm truncate">{candidate.name}</span>
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0 border-border/50 text-muted-foreground">
                                {candidate.manifestType}
                              </Badge>
                            </div>

                            <div className="text-xs text-muted-foreground truncate font-mono mt-0.5">
                              {candidate.relativePath}
                            </div>

                            {/* Tags (Frameworks + Languages) */}
                            {(candidate.frameworks.length > 0 || candidate.languages.length > 0) && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {candidate.frameworks.map((fw) => (
                                  <Badge key={fw} variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] py-0 px-1.5">
                                    {fw}
                                  </Badge>
                                ))}
                                {candidate.languages.map((lang) => (
                                  <Badge key={lang} variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] py-0 px-1.5">
                                    {lang}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {analysis.projectCandidates.length === 0 && (
                      <div className="p-4 text-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-lg">
                        No direct project manifests found within scan budget.
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter className="flex items-center justify-between pt-2">
                  <Button variant="ghost" size="sm" onClick={onChangeFolder} className="text-xs text-muted-foreground hover:text-foreground">
                    Choose another folder
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => selectedCandidatePath && onSelectProject(selectedCandidatePath)}
                      disabled={!selectedCandidatePath}
                      className="bg-primary text-primary-foreground"
                    >
                      <Icon name="Play" size={15} className="mr-2" />
                      Scan Selected Project
                    </Button>
                  </div>
                </DialogFooter>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
