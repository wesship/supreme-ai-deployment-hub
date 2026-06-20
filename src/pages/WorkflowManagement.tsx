import React from 'react';
import Container from '@/components/Container';
import WorkflowManager from '@/components/workflow/WorkflowManager';
import { motion } from 'framer-motion';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

const WorkflowManagement: React.FC = () => {
  return (
    <div className="min-h-screen">
      <D3vonnPageBanner title="Workflow Management" />
      <Container maxWidth="2xl" className="py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <WorkflowManager />
        </motion.div>
      </Container>
    </div>
  );
};

export default WorkflowManagement;