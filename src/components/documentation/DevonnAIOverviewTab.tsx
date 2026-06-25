
import React from 'react';
import { Separator } from '@/components/ui/separator';
import {
  ProjectOverviewHeader,
  FeatureHighlightSection,
  CoreInfoSection,
  DownloadSection,
  NextStepsSection,
  OptionalEnhancementsSection
} from './devonn-ai';

const DevonnAIOverviewTab: React.FC = () => {
  return (
    <div className="space-y-8">
      <section>
        <ProjectOverviewHeader />
        <FeatureHighlightSection />
        <CoreInfoSection />
      </section>
      
      <DownloadSection />
      
      <Separator className="my-8" />
      
      <NextStepsSection />
      
      <Separator className="my-8" />
      
      <OptionalEnhancementsSection />
    </div>
  );
};

export default DevonnAIOverviewTab;
