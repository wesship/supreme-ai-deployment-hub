
import React from 'react';
import { Helmet } from 'react-helmet';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import APIConnectionsTab from '@/components/api/APIConnectionsTab';
import APIDocumentationTab from '@/components/api/APIDocumentationTab';
import APIPlaygroundTab from '@/components/api/APIPlaygroundTab';
import SavedResponsesTab from '@/components/api/SavedResponsesTab';
import APIKeysDemo from '@/components/api/APIKeysDemo';
import { useSavedResponses } from '@/hooks/useSavedResponses';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

const API: React.FC = () => {
  const { 
    savedResponses, 
    saveResponse, 
    deleteResponse, 
    copyToClipboard 
  } = useSavedResponses();

  return (
    <>
      <D3vonnPageBanner title="API Management" />
      <Helmet>
        <title>API Management - D3VONN.IO</title>
      </Helmet>
      <Container>
        <SectionHeading
          subheading="Connect D3VONN.IO to external services and APIs to extend its capabilities."
        >
          API Management
        </SectionHeading>
        
        <div className="mt-8">
          <Tabs defaultValue="connections" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="connections">API Connections</TabsTrigger>
              <TabsTrigger value="keys">API Keys</TabsTrigger>
              <TabsTrigger value="documentation">API Documentation</TabsTrigger>
              <TabsTrigger value="playground">API Playground</TabsTrigger>
              <TabsTrigger value="saved">Saved Responses</TabsTrigger>
            </TabsList>
            
            <TabsContent value="connections" className="mt-6">
              <APIConnectionsTab />
            </TabsContent>
            
            <TabsContent value="keys" className="mt-6">
              <APIKeysDemo />
            </TabsContent>
            
            <TabsContent value="documentation" className="mt-6">
              <APIDocumentationTab />
            </TabsContent>
            
            <TabsContent value="playground" className="mt-6">
              <APIPlaygroundTab onSaveResponse={saveResponse} />
            </TabsContent>
            
            <TabsContent value="saved" className="mt-6">
              <SavedResponsesTab 
                savedResponses={savedResponses} 
                onDeleteResponse={deleteResponse}
                onCopyToClipboard={copyToClipboard}
              />
            </TabsContent>
          </Tabs>
        </div>
      </Container>
    </>
  );
};

export default API;
