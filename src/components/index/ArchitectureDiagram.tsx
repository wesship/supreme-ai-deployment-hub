
import React from 'react';
import { motion } from 'framer-motion';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';

const ArchitectureDiagram: React.FC = () => {
  return (
    <section className="py-20 bg-gradient-to-b from-background to-secondary/20">
      <Container maxWidth="2xl">
        <SectionHeading 
          centered
          animate 
          tag="Architecture"
          subheading="Visual representation of the D3VONN.IO framework components and their interactions"
        >
          Technical Architecture
        </SectionHeading>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-12 bg-white dark:bg-gray-900 p-6 rounded-xl shadow-lg"
        >
          <div className="w-full overflow-hidden rounded-lg">
            {/* Architecture Diagram */}
            <div className="w-full h-[400px] bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-lg p-6 flex items-center justify-center">
              <div className="relative w-full max-w-4xl h-full">
                {/* User Layer */}
                <div className="absolute top-0 left-0 right-0 flex justify-center">
                  <div className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow-md">
                    Client Applications
                  </div>
                </div>
                
                {/* API Gateway Layer */}
                <div className="absolute top-[20%] left-0 right-0 flex justify-center">
                  <div className="px-6 py-3 bg-purple-500 text-white rounded-lg shadow-md w-64 text-center">
                    Kong API Gateway
                  </div>
                </div>
                
                {/* Service Mesh Layer */}
                <div className="absolute top-[40%] left-0 right-0 flex justify-center">
                  <div className="px-6 py-3 bg-indigo-500 text-white rounded-lg shadow-md w-72 text-center">
                    Istio Service Mesh
                  </div>
                </div>
                
                {/* Microservices Layer */}
                <div className="absolute top-[60%] left-0 right-0 flex justify-around px-12">
                  <div className="px-4 py-2 bg-green-500 text-white rounded-lg shadow-md">
                    AI Model Service
                  </div>
                  <div className="px-4 py-2 bg-green-500 text-white rounded-lg shadow-md">
                    Data Processing
                  </div>
                  <div className="px-4 py-2 bg-green-500 text-white rounded-lg shadow-md">
                    Authentication
                  </div>
                  <div className="px-4 py-2 bg-green-500 text-white rounded-lg shadow-md">
                    Storage Service
                  </div>
                </div>
                
                {/* Infrastructure Layer */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-center">
                  <div className="px-6 py-3 bg-gray-700 text-white rounded-lg shadow-md w-80 text-center">
                    Kubernetes Infrastructure
                  </div>
                </div>
                
                {/* Observability sidebar */}
                <div className="absolute top-[30%] right-0 flex flex-col gap-2">
                  <div className="px-3 py-2 bg-amber-500 text-white rounded-lg shadow-md text-sm">
                    Prometheus
                  </div>
                  <div className="px-3 py-2 bg-teal-500 text-white rounded-lg shadow-md text-sm">
                    Grafana
                  </div>
                  <div className="px-3 py-2 bg-blue-400 text-white rounded-lg shadow-md text-sm">
                    Jaeger
                  </div>
                </div>
                
                {/* Connection Lines */}
                <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  {/* User to API Gateway */}
                  <line x1="50%" y1="32" x2="50%" y2="80" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" />
                  {/* API Gateway to Service Mesh */}
                  <line x1="50%" y1="112" x2="50%" y2="160" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" />
                  {/* Service Mesh to Microservices */}
                  <line x1="50%" y1="192" x2="25%" y2="240" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" />
                  <line x1="50%" y1="192" x2="40%" y2="240" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" />
                  <line x1="50%" y1="192" x2="60%" y2="240" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" />
                  <line x1="50%" y1="192" x2="75%" y2="240" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" />
                  {/* Microservices to Infrastructure */}
                  <line x1="25%" y1="272" x2="50%" y2="320" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" />
                  <line x1="40%" y1="272" x2="50%" y2="320" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" />
                  <line x1="60%" y1="272" x2="50%" y2="320" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" />
                  <line x1="75%" y1="272" x2="50%" y2="320" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" />
                </svg>
              </div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <a
              href="#"
              className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              View Full Architecture Documentation
            </a>
          </div>
        </motion.div>
      </Container>
    </section>
  );
};

export default ArchitectureDiagram;
