
import React from 'react';
import { motion } from 'framer-motion';
import FeatureCard from './FeatureCard';
import { Feature } from './featuresData';

interface FeatureGridProps {
  features: Feature[];
  activeFeature: string | null;
  setActiveFeature: React.Dispatch<React.SetStateAction<string | null>>;
}

const FeatureGrid: React.FC<FeatureGridProps> = ({ 
  features, 
  activeFeature, 
  setActiveFeature 
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {features.map((feature) => (
        <FeatureCard
          key={feature.id}
          feature={feature}
          isActive={activeFeature === feature.id}
          onClick={() => setActiveFeature(activeFeature === feature.id ? null : feature.id)}
        />
      ))}
    </motion.div>
  );
};

export default FeatureGrid;
