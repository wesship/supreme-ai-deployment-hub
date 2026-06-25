
import React from 'react';
import { motion } from 'framer-motion';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Database, Shield, Bolt } from 'lucide-react';

const caseStudiesData = [
  {
    company: "NeuroLeap AI",
    title: "Scaling to 10M Predictions Per Day",
    description: "How NeuroLeap deployed their NLP model to handle 10 million daily predictions with 99.99% availability",
    icon: <Database className="w-5 h-5" />
  },
  {
    company: "VisionCraft",
    title: "Secure Multi-tenant Deployment",
    description: "Implementing strict isolation and security for a computer vision platform serving multiple enterprise clients",
    icon: <Shield className="w-5 h-5" />
  },
  {
    company: "PredictSphere",
    title: "Cost Optimization Journey",
    description: "Reducing cloud costs by 68% while improving performance through efficient architecture design",
    icon: <Bolt className="w-5 h-5" />
  }
];

const CaseStudies: React.FC = () => {
  return (
    <section className="py-20">
      <Container maxWidth="2xl">
        <SectionHeading 
          animate 
          tag="Success Stories"
          subheading="Real-world applications of the D3VONN.IO Framework in production environments"
        >
          Case Studies
        </SectionHeading>
        
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {caseStudiesData.map((study, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * i }}
              className="relative group"
            >
              <Card className="h-full overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-lg">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-blue-500"></div>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                      {study.icon}
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">{study.company}</span>
                  </div>
                  <CardTitle>{study.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{study.description}</p>
                  <a href="#" className="inline-block mt-4 text-primary font-medium hover:underline">
                    Read case study →
                  </a>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
};

export default CaseStudies;
