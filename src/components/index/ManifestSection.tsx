import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FileCode2, ArrowRight, Shield, Server } from 'lucide-react';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import { Button } from '@/components/ui/button';

const ManifestSection: React.FC = () => {
  return (
    <section id="manifest" className="py-20 bg-muted/30">
      <Container maxWidth="2xl">
        <SectionHeading 
          animate 
          tag="Documentation"
          subheading="Complete Kubernetes deployment manifest for the D3VONN.IO Framework."
        >
          Deployment Manifest
        </SectionHeading>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-8 max-w-2xl mx-auto"
        >
          <div className="p-8 rounded-2xl border border-border bg-card shadow-lg text-center">
            <div className="flex justify-center gap-4 mb-6">
              <div className="p-3 rounded-xl bg-primary/10">
                <FileCode2 className="h-6 w-6 text-primary" />
              </div>
              <div className="p-3 rounded-xl bg-primary/10">
                <Server className="h-6 w-6 text-primary" />
              </div>
              <div className="p-3 rounded-xl bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
            </div>
            
            <h3 className="text-xl font-semibold mb-3">
              Infrastructure & Kubernetes Configurations
            </h3>
            <p className="text-muted-foreground mb-6">
              Access complete Terraform, Kubernetes, Istio, Kong, and observability stack configurations for production deployment.
            </p>
            
            <Link to="/manifest">
              <Button size="lg" className="gap-2">
                View Deployment Manifest
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </Container>
    </section>
  );
};

export default ManifestSection;
