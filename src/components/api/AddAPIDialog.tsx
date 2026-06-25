
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Shield } from 'lucide-react';
import { NewAPIConfig } from '@/types/api';

interface AddAPIDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  newConfig: NewAPIConfig;
  onConfigChange: (config: NewAPIConfig) => void;
  onAddAPI: () => void;
}

const AddAPIDialog: React.FC<AddAPIDialogProps> = ({
  isOpen,
  onOpenChange,
  newConfig,
  onConfigChange,
  onAddAPI
}) => {
  const [secureStorage, setSecureStorage] = useState(true);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="flex items-center gap-1">
          <Plus className="h-4 w-4" />
          Add API
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New API Connection</DialogTitle>
          <DialogDescription>
            Configure a new API endpoint to connect with D3VONN.IO
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-name">API Name</Label>
            <Input 
              id="api-name" 
              value={newConfig.name}
              onChange={(e) => onConfigChange({...newConfig, name: e.target.value})}
              placeholder="e.g., Weather API, OpenAI API"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="api-endpoint">API Endpoint</Label>
            <Input 
              id="api-endpoint" 
              value={newConfig.endpoint}
              onChange={(e) => onConfigChange({...newConfig, endpoint: e.target.value})}
              placeholder="https://api.example.com/v1"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input 
              id="api-key" 
              type="password"
              value={newConfig.apiKey}
              onChange={(e) => onConfigChange({...newConfig, apiKey: e.target.value})}
              placeholder="Your API key"
            />
            <div className="flex items-center space-x-2 mt-1">
              <Shield className="h-4 w-4 text-amber-500" />
              <p className="text-xs text-muted-foreground">
                {secureStorage 
                  ? "API key will be stored securely using encryption" 
                  : "API key will be stored without encryption"}
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="api-description">Description (Optional)</Label>
            <Textarea 
              id="api-description" 
              value={newConfig.description}
              onChange={(e) => onConfigChange({...newConfig, description: e.target.value})}
              placeholder="What this API is used for"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch 
              id="secure-storage" 
              checked={secureStorage} 
              onCheckedChange={setSecureStorage} 
            />
            <Label htmlFor="secure-storage" className="cursor-pointer">Encrypt API key in storage</Label>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onAddAPI} disabled={!newConfig.name || !newConfig.endpoint}>
            Add API
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddAPIDialog;
