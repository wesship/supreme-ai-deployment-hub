
import React, { useState } from 'react';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import FeatureGrid from './FeatureGrid';
import { features } from './featuresData';

const AIFeatureShowcase: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  
  return (
    <section className="py-20 bg-gradient-to-b from-background to-secondary/30">
      <Container maxWidth="2xl">
        <SectionHeading
          centered
          animate
          tag="AI Capabilities"
          subheading="Powerful features designed to streamline AI deployment and management"
        >
          Advanced AI Features
        </SectionHeading>
        
        <FeatureGrid
          features={features}
          activeFeature={activeFeature}
          setActiveFeature={setActiveFeature}
        />
      </Container>
    </section>
  );
};

export default AIFeatureShowcase;
