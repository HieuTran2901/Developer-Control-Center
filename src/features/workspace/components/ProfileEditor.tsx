import React, { useState, useEffect } from 'react';
import { RuntimeProfile } from '@/domain/entities/RuntimeProfile';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Icon } from '@/shared/components/ui/Icon';
import { Switch } from '@/shared/components/ui/switch';
import { tauriDesktopGateway } from '@/application/services';

interface ProfileEditorProps {
  profile: RuntimeProfile;
  onSave: (profile: RuntimeProfile) => void;
  onDelete: () => void;
}

export function ProfileEditor({ profile, onSave, onDelete }: ProfileEditorProps) {
  const [formData, setFormData] = useState<RuntimeProfile>(profile);
  const [argsStr, setArgsStr] = useState(profile.arguments.join(' '));

  // Sync state when selected profile changes
  useEffect(() => {
    setFormData(profile);
    setArgsStr(profile.arguments.join(' '));
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleArgsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setArgsStr(e.target.value);
    // Simple split by space for now, could be improved with regex to handle quotes
    const args = e.target.value.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    setFormData({ ...formData, arguments: args.map(a => a.replace(/"/g, '')) });
  };

  const handlePickFolder = async () => {
    try {
      const selected = await tauriDesktopGateway.selectFolder();
      if (selected) {
        setFormData({ ...formData, workingDirectory: selected });
      }
    } catch (err) {
      console.error('Failed to pick folder', err);
    }
  };

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Runtime Profile</h2>
          <p className="text-muted-foreground text-sm mt-1">Configure environment and launch commands.</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="destructive" onClick={onDelete}>
            <Icon name="Trash2" size={16} className="mr-2" />
            Delete
          </Button>
          <Button onClick={handleSave}>
            <Icon name="Save" size={16} className="mr-2" />
            Save Profile
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="space-y-6 bg-[#0d1117] p-6 rounded-lg border border-border/40 shadow-sm col-span-1 lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                <Icon name="Tag" size={14} className="mr-2 text-primary" />
                Profile Name
              </label>
              <Input 
                name="name" 
                value={formData.name} 
                onChange={handleChange} 
                placeholder="e.g. Frontend Dev"
                className="bg-[#161b22] border-border/50"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                <Icon name="FolderGit2" size={14} className="mr-2 text-primary" />
                Working Directory
              </label>
              <div className="flex space-x-2">
                <Input 
                  name="workingDirectory" 
                  value={formData.workingDirectory} 
                  onChange={handleChange} 
                  placeholder="Select folder..."
                  className="bg-[#161b22] border-border/50 flex-1 font-mono text-sm"
                  readOnly
                />
                <Button variant="secondary" onClick={handlePickFolder} className="shrink-0">
                  <Icon name="FolderOpen" size={16} />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 bg-[#0d1117] p-6 rounded-lg border border-border/40 shadow-sm">
          <h3 className="font-semibold mb-4 border-b border-border/40 pb-2">Execution</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                <Icon name="Terminal" size={14} className="mr-2 text-primary" />
                Command
              </label>
              <Input 
                name="command" 
                value={formData.command} 
                onChange={handleChange} 
                placeholder="e.g. npm, docker-compose, cargo"
                className="bg-[#161b22] border-border/50 font-mono text-sm"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                <Icon name="Text" size={14} className="mr-2 text-primary" />
                Arguments
              </label>
              <Input 
                value={argsStr} 
                onChange={handleArgsChange} 
                placeholder="e.g. run dev --port 3000"
                className="bg-[#161b22] border-border/50 font-mono text-sm"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6 bg-[#0d1117] p-6 rounded-lg border border-border/40 shadow-sm">
          <h3 className="font-semibold mb-4 border-b border-border/40 pb-2">Behavior</h3>
          
          <div className="flex items-center justify-between p-3 border border-border/40 rounded-md bg-[#161b22]">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">Auto Start</label>
              <p className="text-xs text-muted-foreground">Automatically start this profile when the project opens.</p>
            </div>
            <Switch 
              checked={formData.autoStart || false}
              onCheckedChange={(c) => setFormData({...formData, autoStart: c})}
            />
          </div>
        </div>
      </div>

      {/* Runtime Preview */}
      <div className="bg-[#0d1117] p-6 rounded-lg border border-border/40 shadow-sm">
        <h3 className="font-semibold mb-4 flex items-center">
          <Icon name="Eye" size={16} className="mr-2 text-primary" />
          Runtime Preview
        </h3>
        
        <div className="bg-[#161b22] rounded-md p-4 font-mono text-sm border border-border/40 overflow-x-auto relative group">
          <div className="flex items-center text-muted-foreground mb-2 text-xs">
            <span className="text-primary/70 mr-2">cwd:</span>
            {formData.workingDirectory || '<none>'}
          </div>
          <div className="flex items-center">
            <span className="text-green-400 mr-2">$</span>
            <span className="text-blue-400 font-semibold mr-2">{formData.command || '<cmd>'}</span>
            <span className="text-yellow-200/80">{formData.arguments.join(' ')}</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 bg-muted/50"
            onClick={() => {
              navigator.clipboard.writeText(`${formData.command} ${formData.arguments.join(' ')}`);
            }}
          >
            <Icon name="Copy" size={12} />
          </Button>
        </div>
      </div>
    </div>
  );
}

