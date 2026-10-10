import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, FileCode2, Shield, Server } from 'lucide-react';
import { Link } from 'react-router-dom';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import ManifestCode from '@/components/index/manifest/ManifestCode';
import { ManifestSearch } from '@/components/index/manifest/ManifestSearch';
import { yamlCode, deploymentFiles } from '@/data/manifest/index.cjs';
import { Button } from '@/components/ui/button';
import Footer from '@/components/Footer';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

const ManifestPage: React.FC = () => {
  // Combine all manifest content for searching
  const combinedCode = `${yamlCode}\n\n${deploymentFiles}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex flex-col"
    >
      <D3vonnPageBanner title="Deployment Manifest" />
      <Container maxWidth="2xl" className="flex-1 py-12">
        {/* Back Button */}
        <Link to="/">
          <Button variant="ghost" className="mb-8 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        {/* Header */}
        <div className="mb-12">
          <SectionHeading 
            animate 
            tag="Documentation"
            subheading="Complete Kubernetes deployment manifest for the D3VONN.IO Framework including Terraform, Istio, Kong, and observability stack configurations."
          >
            Deployment Manifest
          </SectionHeading>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-xl border border-border bg-card"
          >
            <FileCode2 className="h-8 w-8 text-primary mb-4" />
            <h3 className="font-semibold mb-2">Infrastructure as Code</h3>
            <p className="text-sm text-muted-foreground">
              Complete Terraform configurations for AWS EKS, RDS, VPC, and security resources.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-xl border border-border bg-card"
          >
            <Server className="h-8 w-8 text-primary mb-4" />
            <h3 className="font-semibold mb-2">Kubernetes Ready</h3>
            <p className="text-sm text-muted-foreground">
              Production-ready manifests with Istio service mesh, Kong API Gateway, and Argo Rollouts.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-6 rounded-xl border border-border bg-card"
          >
            <Shield className="h-8 w-8 text-primary mb-4" />
            <h3 className="font-semibold mb-2">Security First</h3>
            <p className="text-sm text-muted-foreground">
              GuardDuty, Security Hub, CloudTrail, and comprehensive IAM policies included.
            </p>
          </motion.div>
        </div>

        {/* Search Feature */}
        <ManifestSearch code={combinedCode} />

        {/* Manifest Code Sections */}
        <div className="space-y-12">
          <ManifestCode 
            code={yamlCode}
            title="Deployment Manifest"
            downloadFileName="d3vonn-io-manifest.yaml"
          />
          
          <ManifestCode 
            code={deploymentFiles}
            title="Deployment File Manifest"
            downloadFileName="d3vonn-io-deployment-files.txt"
          />
        </div>
      </Container>

      <Footer />
    </motion.div>
  );
};

export default ManifestPage;
