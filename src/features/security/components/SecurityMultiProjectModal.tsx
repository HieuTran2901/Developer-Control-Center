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
import { FolderGit2, Play, FolderSearch } from 'lucide-react';
import { cn } from '@/shared/utils';

export interface ProjectCandidate {
  name: string;
  path: string;
  relativePath: string;
  manifestType: string;
  frameworks: string[];
  languages: string[];
}

interface SecurityMultiProjectModalProps {
  isOpen: boolean;
  parentPath: string;
  candidates: ProjectCandidate[];
  onClose: () => void;
  onSelectProject: (candidate: ProjectCandidate) => void;
  onChangeFolder: () => void;
}

export function SecurityMultiProjectModal({
  isOpen,
  parentPath,
  candidates,
  onClose,
  onSelectProject,
  onChangeFolder,
}: SecurityMultiProjectModalProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(() => {
    return candidates.length > 0 ? candidates[0].path : null;
  });

  React.useEffect(() => {
    if (candidates.length > 0) {
      setSelectedPath(candidates[0].path);
    }
  }, [candidates]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const chosen = candidates.find((c) => c.path === selectedPath);
    if (chosen) {
      onSelectProject(chosen);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl bg-[#0d1117] border-border/40 text-foreground p-6 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <FolderGit2 className="w-5 h-5 shrink-0 text-amber-500" />
            <DialogTitle className="text-lg">Multiple Projects Detected</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="border border-border/40 rounded-lg p-3.5 bg-card/40 space-y-1">
            <div className="text-xs text-muted-foreground truncate font-mono">
              {parentPath}
            </div>
            <p className="text-xs text-muted-foreground">
              This folder contains multiple projects. Select the project you want to scan.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center justify-between">
              <span>Select a project to scan ({candidates.length})</span>
            </div>

            <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1">
              {candidates.map((candidate) => {
                const isSelected = selectedPath === candidate.path;
                return (
                  <div
                    key={candidate.path}
                    onClick={() => setSelectedPath(candidate.path)}
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
                        {candidate.manifestType && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0 border-border/50 text-muted-foreground">
                            {candidate.manifestType}
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground truncate font-mono mt-0.5">
                        {candidate.path}
                      </div>

                      {(candidate.languages.length > 0 || candidate.frameworks.length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {candidate.languages.length > 0 && (
                            <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                              {candidate.languages.join(' / ')}
                            </span>
                          )}
                          {candidate.frameworks.length > 0 && (
                            <span className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
                              {candidate.frameworks.join(' / ')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={onChangeFolder} className="text-xs text-muted-foreground hover:text-foreground">
            <FolderSearch className="w-3.5 h-3.5 mr-1.5" />
            Choose another folder
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedPath}
              className="bg-primary text-primary-foreground"
            >
              <Play className="w-4 h-4 mr-2" />
              Scan Selected Project
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
