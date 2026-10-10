
import React from 'react';
import { enhancementData } from './enhancements/enhancementData';
import SectionHeader from './enhancements/SectionHeader';
import EnhancementGrid from './enhancements/EnhancementGrid';

const OptionalEnhancementsSection: React.FC = () => {
  return (
    <section className="py-8">
      <SectionHeader
        title="Optional Enhancements"
        description="Extend D3VONN.IO with these powerful optional modules to address specific needs of your implementation."
      />
      <div className="mt-6">
        <EnhancementGrid enhancements={enhancementData} />
      </div>
    </section>
  );
};

export default OptionalEnhancementsSection;
