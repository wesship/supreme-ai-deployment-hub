import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { WorkflowTemplate } from '@/types/workflow';
import { n8nService } from '@/services/workflow/n8nService';
import { Search, Star, Download, Play, Filter } from 'lucide-react';
import { toast } from 'sonner';

interface WorkflowTemplatesProps {
  onSelectTemplate?: (template: WorkflowTemplate) => void;
  onUseTemplate?: (template: WorkflowTemplate) => void;
}

const WorkflowTemplates: React.FC<WorkflowTemplatesProps> = ({
  onSelectTemplate,
  onUseTemplate
}) => {
  const [templates] = useState<WorkflowTemplate[]>(n8nService.getWorkflowTemplates());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    'all',
    'deployment',
    'ai-agent',
    'data-processing',
    'notification',
    'custom'
  ];

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleUseTemplate = (template: WorkflowTemplate) => {
    onUseTemplate?.(template);
    toast.success(`Using template: ${template.name}`);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'deployment': return '🚀';
      case 'ai-agent': return '🤖';
      case 'data-processing': return '📊';
      case 'notification': return '🔔';
      default: return '⚙️';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Workflow Templates</h2>
          <p className="text-muted-foreground">Pre-built workflows to get you started quickly</p>
        </div>
        
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map(category => (
          <Button
            key={category}
            variant={selectedCategory === category ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category)}
            className="whitespace-nowrap"
          >
            <Filter className="h-4 w-4 mr-1" />
            {category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}
          </Button>
        ))}
      </div>

      {/* Featured Templates */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Star className="h-5 w-5 mr-2 text-yellow-500" />
          Featured Templates
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates
            .filter(template => template.featured)
            .map(template => (
              <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getCategoryIcon(template.category)}</span>
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {template.category.replace('-', ' ')}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="text-sm font-medium">{template.popularity}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {template.description}
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => handleUseTemplate(template)}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Use Template
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onSelectTemplate?.(template)}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>

      {/* All Templates */}
      <div>
        <h3 className="text-lg font-semibold mb-4">All Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates
            .filter(template => !template.featured)
            .map(template => (
              <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getCategoryIcon(template.category)}</span>
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {template.category.replace('-', ' ')}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{template.popularity}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {template.description}
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleUseTemplate(template)}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Use Template
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onSelectTemplate?.(template)}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No templates found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}
    </div>
  );
};

export default WorkflowTemplates;