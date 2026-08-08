import React, { useState, useEffect } from 'react';
import { Project } from '@/domain/entities/Project';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Icon } from '@/shared/components/ui/Icon';
import { tauriDesktopGateway } from '@/application/services';
import { useToast } from '@/shared/hooks/useToast';

interface ProjectEditorProps {
  project: Project;
  onSave: (project: Project) => Promise<void>;
  onDelete: () => void;
}

export function ProjectEditor({ project, onSave, onDelete }: ProjectEditorProps) {
  const [formData, setFormData] = useState<Project>(project);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Sync state when selected project changes
  useEffect(() => {
    setFormData(project);
  }, [project]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePickFolder = async () => {
    try {
      const selected = await tauriDesktopGateway.selectFolder();
      if (selected) {
        setFormData({ ...formData, rootPath: selected });
      }
    } catch (err) {
      console.error('Failed to pick folder', err);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(formData);
      toast({
        title: "Changes saved successfully",
        type: "success"
      });
    } catch (err: any) {
      toast({
        title: "Failed to save changes",
        description: err?.message || String(err),
        type: "error"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Project Settings</h2>
          <p className="text-muted-foreground text-sm mt-1">Configure your project details and root path.</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="destructive" onClick={onDelete} disabled={isSaving}>
            <Icon name="Trash2" size={16} className="mr-2" />
            Delete
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Icon name={isSaving ? "Loader2" : "Save"} size={16} className={`mr-2 ${isSaving ? 'animate-spin' : ''}`} />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="space-y-6 bg-[#0d1117] p-6 rounded-lg border border-border/40 shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-medium">Project Name</label>
          <Input 
            name="name" 
            value={formData.name} 
            onChange={handleChange} 
            placeholder="e.g. My Awesome App"
            className="bg-[#161b22] border-border/50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Root Path</label>
          <div className="flex space-x-2">
            <Input 
              name="rootPath" 
              value={formData.rootPath} 
              onChange={handleChange} 
              placeholder="Select folder..."
              className="bg-[#161b22] border-border/50 flex-1 font-mono text-sm"
              readOnly
            />
            <Button variant="secondary" onClick={handlePickFolder}>
              <Icon name="FolderOpen" size={16} className="mr-2" />
              Browse
            </Button>
          </div>
          <p className="text-[13px] text-muted-foreground">The root directory for this project where runtime profiles will operate by default.</p>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Icon (Optional)</label>
          <Input 
            name="icon" 
            value={formData.icon || ''} 
            onChange={handleChange} 
            placeholder="e.g. Activity, Terminal, Code"
            className="bg-[#161b22] border-border/50"
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Description (Optional)</label>
          <Input 
            name="description" 
            value={formData.description || ''} 
            onChange={handleChange} 
            placeholder="Brief description of the project"
            className="bg-[#161b22] border-border/50"
          />
        </div>
      </div>
    </div>
  );
}

