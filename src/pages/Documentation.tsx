
import React from 'react';
import { motion } from 'framer-motion';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import DocumentationTabs from '@/components/documentation/DocumentationTabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Code, Server, Sparkles } from 'lucide-react';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

const Documentation: React.FC = () => {
  const docTypes = [
    { 
      title: "Guides", 
      description: "Step-by-step tutorials for common AI deployment scenarios", 
      icon: <BookOpen className="h-5 w-5" />,
      color: "bg-blue-500/10 text-blue-500 border-blue-500/20" 
    },
    { 
      title: "API Reference", 
      description: "Complete reference for the D3VONN.IO framework API", 
      icon: <Code className="h-5 w-5" />,
      color: "bg-purple-500/10 text-purple-500 border-purple-500/20" 
    },
    { 
      title: "Deployment", 
      description: "Infrastructure setup and deployment configuration", 
      icon: <Server className="h-5 w-5" />,
      color: "bg-amber-500/10 text-amber-500 border-amber-500/20" 
    },
    { 
      title: "Examples", 
      description: "Real-world examples of AI systems built with D3VONN.IO", 
      icon: <Sparkles className="h-5 w-5" />,
      color: "bg-green-500/10 text-green-500 border-green-500/20" 
    }
  ];

  return (
    <div className="py-16">
      <D3vonnPageBanner title="D3VONN.IO Documentation" />
      <Container maxWidth="2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <SectionHeading 
            tag="Documentation" 
            subheading="Comprehensive guides and reference materials for D3VONN.IO"
          >
            <div className="flex items-center gap-2">
              D3VONN.IO Documentation
              <motion.div
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <Badge className="ml-2 bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30">
                  v2.1.0
                </Badge>
              </motion.div>
            </div>
          </SectionHeading>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {docTypes.map((type, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
            >
              <Card className="border border-primary/10 bg-black/20 backdrop-blur-sm hover:border-primary/20 transition-colors h-full">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${type.color}`}>
                      {type.icon}
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">{type.title}</h3>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-10 border border-primary/10 rounded-lg bg-black/20 backdrop-blur-sm"
        >
          <DocumentationTabs />
        </motion.div>
      </Container>
    </div>
  );
};

export default Documentation;
