
import React from 'react';
import { motion } from 'framer-motion';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import { Clock } from 'lucide-react';

const updatesData = [
  {
    date: "June 15, 2023",
    title: "Version 2.3.0 Released",
    description: "Major improvements to the observability stack and enhanced security features",
    badge: "Release",
    image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c"
  },
  {
    date: "May 28, 2023",
    title: "Kong API Gateway Integration Improved",
    description: "Added support for custom plugins and enhanced rate limiting capabilities",
    badge: "Feature",
    image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158"
  },
  {
    date: "May 12, 2023",
    title: "Security Vulnerability Patched",
    description: "Critical security update for Istio components, all users should update immediately",
    badge: "Security",
    image: "https://images.unsplash.com/photo-1473091534298-04dcbce3278c"
  }
];

const LatestUpdates: React.FC = () => {
  return (
    <section className="py-20">
      <Container maxWidth="2xl">
        <SectionHeading 
          animate 
          tag="Updates"
          subheading="Stay informed about the latest improvements and changes to the framework"
        >
          Latest News
        </SectionHeading>
        
        <div className="mt-8 space-y-6">
          {updatesData.map((update, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * i }}
              className="flex gap-4 p-6 border rounded-xl hover:bg-secondary/10 transition-colors"
            >
              <div className="hidden sm:flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="w-px h-full bg-gray-200 dark:bg-gray-700 my-2"></div>
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-sm text-muted-foreground">{update.date}</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    update.badge === 'Release' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
                    update.badge === 'Feature' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                    'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                  }`}>
                    {update.badge}
                  </span>
                </div>
                <div className="md:flex items-start gap-4">
                  <div className="md:flex-1">
                    <h3 className="text-lg font-medium mb-1">{update.title}</h3>
                    <p className="text-muted-foreground">{update.description}</p>
                    <a href="#" className="inline-block mt-2 text-primary hover:underline">Read more →</a>
                  </div>
                  <div className="mt-4 md:mt-0 md:w-1/4 rounded-lg overflow-hidden">
                    <img 
                      src={update.image} 
                      alt={update.title} 
                      className="w-full h-24 object-cover"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
        <div className="mt-8 flex justify-center">
          <a
            href="#"
            className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            View All Updates
          </a>
        </div>
      </Container>
    </section>
  );
};

export default LatestUpdates;
