
import React, { useEffect } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import Footer from '@/components/Footer';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

// Core sections
import HeroSection from '@/components/index/HeroSection';
import DashboardPreview from '@/components/index/DashboardPreview';
import GettingStartedSteps from '@/components/index/GettingStartedSteps';
import KeyComponents from '@/components/index/KeyComponents';
import LatestUpdates from '@/components/index/LatestUpdates';
import ArchitectureDiagram from '@/components/index/ArchitectureDiagram';
import CaseStudies from '@/components/index/CaseStudies';
import FAQSection from '@/components/index/FAQSection';
import IntegrationPartners from '@/components/index/IntegrationPartners';
import Testimonials from '@/components/index/Testimonials';
import ManifestSection from '@/components/index/ManifestSection';
import CTASection from '@/components/index/CTASection';

// AI & platform sections
import AIFeatureShowcase from '@/components/index/AIFeatureShowcase';
import AIVisualization from '@/components/index/AIVisualization';
import VoiceEnabledAI from '@/components/index/VoiceEnabledAI';
import MultiCloudDeployment from '@/components/index/MultiCloudDeployment';
import PricingSection from '@/components/index/PricingSection';

// New sections
import HermesStatusSection from '@/components/index/HermesStatusSection';
import ProductionStackSection from '@/components/index/ProductionStackSection';
import LiveDeploymentBanner from '@/components/index/LiveDeploymentBanner';

const Index = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    toast('Welcome to DEVONN.AI', {
      description: 'The autonomous AI deployment platform — powered by Hermes Intelligence Fabric',
      position: 'bottom-right',
      duration: 5000,
    });
    window.scrollTo(0, 0);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="min-h-screen flex flex-col overflow-hidden"
    >
      {/* Scroll progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-primary z-50 origin-left"
        style={{ scaleX }}
      />

      {/* Live deployment status banner */}
      <LiveDeploymentBanner />

      {/* Hero */}
      <HeroSection />

      {/* AI Visualization */}
      <AIVisualization />

      {/* Hermes Intelligence Fabric — new flagship section */}
      <HermesStatusSection />

      {/* Voice AI */}
      <VoiceEnabledAI />

      {/* Dashboard preview */}
      <DashboardPreview />

      {/* Multi-cloud deployment */}
      <MultiCloudDeployment />

      {/* Production stack breakdown — new section */}
      <ProductionStackSection />

      {/* Getting started */}
      <GettingStartedSteps />

      {/* Key components */}
      <KeyComponents />

      {/* AI feature showcase */}
      <AIFeatureShowcase />

      {/* Pricing */}
      <PricingSection />

      {/* Latest updates */}
      <LatestUpdates />

      {/* Architecture diagram */}
      <ArchitectureDiagram />

      {/* Case studies */}
      <CaseStudies />

      {/* Integration partners */}
      <IntegrationPartners />

      {/* Testimonials */}
      <Testimonials />

      {/* FAQ */}
      <FAQSection />

      {/* Manifest */}
      <ManifestSection />

      {/* Flow Editor callout */}
      <div className="py-12 bg-muted/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto text-center"
          >
            <h2 className="text-3xl font-bold mb-4">Interactive Flow Editor</h2>
            <p className="text-muted-foreground text-lg mb-8">
              Design complex agent workflows visually with our PocketFlow editor, built on ReactFlow.
            </p>
            <Link to="/flow">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-3 bg-primary text-primary-foreground rounded-lg shadow-lg hover:bg-primary/90 transition-colors font-semibold"
              >
                Try Flow Editor
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </div>

      {/* CTA */}
      <CTASection />

      <Footer />

      {/* Scroll to top FAB */}
      <motion.button
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center z-40 hover:bg-primary/90 transition-colors"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={scrollToTop}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        aria-label="Scroll to top"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m18 15-6-6-6 6"/>
        </svg>
      </motion.button>
    </motion.div>
  );
};

export default Index;
