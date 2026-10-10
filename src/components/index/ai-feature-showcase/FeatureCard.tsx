
import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Feature } from './featuresData';

interface FeatureCardProps {
  feature: Feature;
  isActive: boolean;
  onClick: () => void;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ feature, isActive, onClick }) => {
  return (
    <motion.div
      whileHover={{ scale: isActive ? 1 : 1.03 }}
      transition={{ duration: 0.2 }}
      className={`cursor-pointer ${isActive ? 'col-span-2 row-span-2' : ''}`}
      onClick={onClick}
    >
      <Card className={`h-full border-2 overflow-hidden ${isActive ? 'border-primary' : 'border-transparent hover:border-primary/30'} transition-all duration-300`}>
        <CardContent className="p-0">
          <div className="relative h-full">
            {/* Background Image */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-br bg-gray-900/80 z-10"></div>
              <img 
                src={feature.image} 
                alt={feature.title} 
                className="w-full h-full object-cover opacity-30"
              />
            </div>
            
            <div className="relative z-20 p-6 flex flex-col h-full">
              <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg`}>
                <feature.icon className="text-white" size={24} />
              </div>
              
              <h3 className="text-lg font-medium text-white mb-2">{feature.title}</h3>
              
              <p className="text-gray-300 mb-4 text-sm">{feature.description}</p>
              
              {isActive && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-auto"
                >
                  <h4 className="text-white font-medium mb-2">Key Capabilities:</h4>
                  <ul className="grid grid-cols-2 gap-2">
                    {feature.details.map((detail, index) => (
                      <motion.li 
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center text-gray-300 text-sm"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mr-2"></div>
                        {detail}
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              )}
              
              {!isActive && (
                <div className="mt-auto text-primary text-sm font-medium">
                  Click to learn more →
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default FeatureCard;
