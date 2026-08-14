import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { AlertTriangle, Folder, FolderSearch } from 'lucide-react';

interface SecurityTargetTooBroadModalProps {
  isOpen: boolean;
  targetPath: string;
  reason?: string;
  onClose: () => void;
  onChooseFolder: () => void;
}

export function SecurityTargetTooBroadModal({
  isOpen,
  targetPath,
  reason,
  onClose,
  onChooseFolder,
}: SecurityTargetTooBroadModalProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg bg-[#0d1117] border-destructive/30 text-foreground p-6 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive font-semibold">
            <AlertTriangle className="w-5 h-5 shrink-0 text-destructive" />
            <DialogTitle className="text-lg">Scan Target Too Broad</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="border border-destructive/30 rounded-lg p-4 bg-destructive/10 space-y-3">
            <div className="flex items-start gap-2.5">
              <Folder className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <span className="font-mono text-sm break-all font-medium text-foreground">
                {targetPath}
              </span>
            </div>

            <p className="text-sm text-foreground/90 leading-relaxed">
              {reason || 'You selected a location that is too broad to scan safely and efficiently.'}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Security scans should target a specific project or workspace rather than an entire drive.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Please select a specific project folder instead.
          </p>
        </div>

        <DialogFooter className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onChooseFolder} className="bg-primary text-primary-foreground">
            <FolderSearch className="w-4 h-4 mr-2" />
            Choose Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
