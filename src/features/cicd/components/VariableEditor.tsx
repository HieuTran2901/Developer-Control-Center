import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Icon } from '@/shared/components/ui/Icon';
import { Badge } from '@/shared/components/ui/badge';
import { invoke } from '@tauri-apps/api/core';

export type EnvironmentVariable =
  | { type: 'plaintext'; key: String; value: String }
  | { type: 'secretRef'; key: String; reference: String };

interface VariableEditorProps {
  envId: string;
  variables: EnvironmentVariable[];
  onVariablesChange: (variables: EnvironmentVariable[]) => void;
  disabled?: boolean;
}

export function VariableEditor({ envId, variables, onVariablesChange, disabled }: VariableEditorProps) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isSecret, setIsSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    
    // Validate key
    if (!/^[A-Z_][A-Z0-9_]*$/.test(newKey)) {
      setError('Key must be uppercase alphanumeric or underscores.');
      return;
    }
    
    if (variables.some(v => v.key === newKey)) {
      setError('Variable key already exists.');
      return;
    }
    
    setError(null);
    setSaving(true);
    
    try {
      if (isSecret) {
        // Send via IPC to secure storage immediately
        const reference = await invoke<string>('set_environment_secret', {
          envId,
          key: newKey,
          plaintextSecret: newValue
        });
        
        onVariablesChange([
          ...variables,
          { type: 'secretRef', key: newKey, reference }
        ]);
      } else {
        onVariablesChange([
          ...variables,
          { type: 'plaintext', key: newKey, value: newValue }
        ]);
      }
      
      setNewKey('');
      setNewValue('');
      setIsSecret(false);
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (keyToRemove: String) => {
    onVariablesChange(variables.filter(v => v.key !== keyToRemove));
  };

  return (
    <div className="space-y-4">
      {/* Existing Variables */}
      <div className="space-y-2">
        {variables.length === 0 && (
          <div className="text-sm text-muted-foreground italic p-4 border rounded-md text-center">
            No variables configured.
          </div>
        )}
        {variables.map((v, i) => (
          <div key={i} className="flex items-center gap-3 p-2 bg-muted/30 border rounded-md">
            <div className="flex-1 font-mono text-sm">{v.key}</div>
            <div className="flex-[2] font-mono text-sm text-muted-foreground truncate">
              {v.type === 'plaintext' ? v.value : '********'}
            </div>
            <div>
              {v.type === 'secretRef' ? (
                <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">Secret</Badge>
              ) : (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Public</Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemove(v.key)}
              disabled={disabled || saving}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
            >
              <Icon name="Trash2" size={14} />
            </Button>
          </div>
        ))}
      </div>

      {/* Add New Variable */}
      <div className="flex items-start gap-2 pt-2 border-t">
        <div className="flex-1 space-y-2">
          <Input 
            placeholder="KEY (e.g. DATABASE_URL)" 
            value={newKey}
            onChange={(e) => setNewKey(e.target.value.toUpperCase())}
            disabled={disabled || saving}
            className="font-mono text-sm"
          />
        </div>
        <div className="flex-[2] space-y-2">
          <Input 
            placeholder={isSecret ? "Secret Value" : "Value"}
            type={isSecret ? "password" : "text"}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            disabled={disabled || saving}
            className="font-mono text-sm"
          />
          {error && <div className="text-xs text-red-500 font-medium">{error}</div>}
        </div>
        <div className="flex items-center gap-2 h-10">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSecret(!isSecret)}
            disabled={disabled || saving}
            className={isSecret ? "bg-orange-500/10 text-orange-500 border-orange-500/50 hover:bg-orange-500/20" : ""}
          >
            <Icon name={isSecret ? "Lock" : "Unlock"} size={14} className="mr-2" />
            {isSecret ? "Secret" : "Public"}
          </Button>
          <Button 
            onClick={handleAdd} 
            disabled={!newKey || !newValue || disabled || saving}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
