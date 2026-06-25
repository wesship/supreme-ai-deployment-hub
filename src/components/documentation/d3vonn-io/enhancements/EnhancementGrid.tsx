
import React from 'react';
import EnhancementCard, { Enhancement } from './EnhancementCard';

interface EnhancementGridProps {
  enhancements: Enhancement[];
}

const EnhancementGrid: React.FC<EnhancementGridProps> = ({ enhancements }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {enhancements.map((enhancement) => (
        <EnhancementCard key={enhancement.id} enhancement={enhancement} />
      ))}
    </div>
  );
};

export default EnhancementGrid;
