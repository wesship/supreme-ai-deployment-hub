
import React from 'react';
import { motion } from 'framer-motion';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import { cardHover, staggerWithConfig } from '@/lib/animations';

const componentsData = [
  {
    title: "Istio Service Mesh",
    description: "Advanced traffic management with mTLS encryption and robust authorization policies.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1",
    details: [
      "Service Discovery",
      "Circuit Breaking",
      "Fault Injection",
      "Traffic Shifting"
    ],
    color: "from-blue-500 to-indigo-600"
  },
  {
    title: "Kong API Gateway",
    description: "Secure and efficient API management with rate limiting and authentication plugins.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    image: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b",
    details: [
      "Rate Limiting",
      "Authentication",
      "Logging & Analytics",
      "Request Transformation"
    ],
    color: "from-green-500 to-emerald-600"
  },
  {
    title: "Observability Stack",
    description: "Comprehensive monitoring with Prometheus, Grafana, and Jaeger for complete system visibility.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
        <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M19 9L13 15L9 11L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    image: "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7",
    details: [
      "Real-time Metrics",
      "Distributed Tracing",
      "Log Aggregation",
      "Custom Dashboards"
    ],
    color: "from-amber-500 to-orange-600"
  },
];

const KeyComponents: React.FC = () => {
  const containerVariants = staggerWithConfig(0.2, 0.1);
  
  return (
    <section className="py-20 bg-gradient-to-b from-background to-secondary/50">
      <Container maxWidth="2xl">
        <SectionHeading 
          centered 
          animate 
          tag="Architecture"
          subheading="Built with precision and simplicity in mind, our framework offers a comprehensive solution for AI deployment."
        >
          Key Components
        </SectionHeading>
        
        <motion.div 
          className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {componentsData.map((feature, i) => (
            <motion.div
              key={i}
              variants={cardHover}
              initial="rest"
              whileHover="hover"
              whileTap="rest"
              className="rounded-xl overflow-hidden shadow-md transition-all duration-300 h-full"
            >
              <div className="h-48 overflow-hidden relative">
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-90`}></div>
                <img 
                  src={feature.image} 
                  alt={feature.title} 
                  className="w-full h-full object-cover opacity-50 mix-blend-overlay"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div 
                    className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center"
                    animate={{ 
                      boxShadow: [
                        "0 0 0 0 rgba(255, 255, 255, 0.3)",
                        "0 0 0 20px rgba(255, 255, 255, 0)",
                      ],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatType: "loop"
                    }}
                  >
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                      <div className="text-primary w-10 h-10">
                        {feature.icon}
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
              
              <div className="p-6 bg-white dark:bg-gray-900">
                <h3 className="text-xl font-medium mb-2">{feature.title}</h3>
                <p className="text-muted-foreground mb-4">{feature.description}</p>
                
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Key Features</h4>
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {feature.details.map((detail, idx) => (
                      <li key={idx} className="flex items-center text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mr-2"></div>
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
};

export default KeyComponents;
