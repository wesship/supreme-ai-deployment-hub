
import React from 'react';
import { motion } from 'framer-motion';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Code2, Server, Shield, Database } from 'lucide-react';

const stepsData = [
  {
    step: 1,
    title: "Install Tools",
    description: "Set up the required CLI tools for Kubernetes, Helm, and Istio",
    icon: <Code2 className="w-6 h-6" />
  },
  {
    step: 2,
    title: "Deploy Core Services",
    description: "Install and configure the service mesh, API gateway, and observability stack",
    icon: <Server className="w-6 h-6" />
  },
  {
    step: 3,
    title: "Configure Security",
    description: "Set up mTLS, authentication, and authorization policies",
    icon: <Shield className="w-6 h-6" />
  },
  {
    step: 4,
    title: "Deploy AI Services",
    description: "Deploy your AI models and supporting services",
    icon: <Database className="w-6 h-6" />
  }
];

const GettingStartedSteps: React.FC = () => {
  return (
    <section className="py-20">
      <Container maxWidth="2xl">
        <SectionHeading 
          centered 
          animate 
          tag="Quick Start"
          subheading="Follow these steps to get started with D3VONN.IO Framework"
        >
          Getting Started
        </SectionHeading>
        
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stepsData.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * i }}
              className="relative"
            >
              <Card className="h-full border-2 border-primary/10 hover:border-primary/30 transition-colors">
                <div className="absolute -top-5 -left-3 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg">
                  {item.step}
                </div>
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
                    {item.icon}
                  </div>
                  <CardTitle>{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{item.description}</p>
                  <a href="#" className="inline-block mt-4 text-primary hover:underline">Learn more →</a>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
        
        <div className="mt-12 flex justify-center">
          <a 
            href="#"
            className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Complete Installation Guide
          </a>
        </div>
      </Container>
    </section>
  );
};

export default GettingStartedSteps;
