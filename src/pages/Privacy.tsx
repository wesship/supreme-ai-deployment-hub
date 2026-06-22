
import React from 'react';
import { Helmet } from 'react-helmet';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import { motion } from 'framer-motion';
import { Shield, Lock, Eye, FileText, Bell, Users, BrainCircuit, Database, ServerCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { staggerContainer, slideUp } from '@/lib/animations';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

const Privacy: React.FC = () => {
  return (
    <>
      <D3vonnPageBanner title="Privacy at D3VONN.IO" />
      <Helmet>
        <title>Privacy Policy - D3VONN.IO</title>
      </Helmet>
      
      {/* Hero section */}
      <div className="relative overflow-hidden bg-muted py-16">
        <div className="absolute inset-0 opacity-10">
          <img 
            src="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5" 
            alt="AI network" 
            className="w-full h-full object-cover"
          />
        </div>
        <Container>
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="relative z-10"
          >
            <motion.div variants={slideUp}>
              <SectionHeading tag="Privacy" centered>
                Protecting Your Data in the AI Era
              </SectionHeading>
              <p className="text-center text-muted-foreground mt-4 max-w-2xl mx-auto">
                At D3VONN.IO, we prioritize the protection of your personal information and AI training data with advanced encryption and security measures.
              </p>
            </motion.div>
          </motion.div>
        </Container>
      </div>
      
      <Container>
        <div className="mb-12 rounded-xl overflow-hidden shadow-lg mt-10">
          <div className="relative">
            <img 
              src="https://images.unsplash.com/photo-1485827404703-89b55fcc595e" 
              alt="AI protection visualization" 
              className="w-full h-64 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-white">Privacy Policy</h2>
                <p className="text-muted-foreground">Last Updated: August 1, 2023</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-card border border-border p-6 rounded-xl shadow-sm flex flex-col items-center text-center group hover:shadow-md transition-all duration-200"
          >
            <div className="bg-blue-500/10 p-3 rounded-full mb-4">
              <Shield className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Data Protection</h3>
            <p className="text-muted-foreground text-sm">We implement robust security measures to protect your personal information and AI training data.</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-card border border-border p-6 rounded-xl shadow-sm flex flex-col items-center text-center group hover:shadow-md transition-all duration-200"
          >
            <div className="bg-purple-500/10 p-3 rounded-full mb-4">
              <Lock className="w-8 h-8 text-purple-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Encryption</h3>
            <p className="text-muted-foreground text-sm">All sensitive data is encrypted both in transit and at rest to prevent unauthorized access.</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-card border border-border p-6 rounded-xl shadow-sm flex flex-col items-center text-center group hover:shadow-md transition-all duration-200"
          >
            <div className="bg-green-500/10 p-3 rounded-full mb-4">
              <Eye className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Transparency</h3>
            <p className="text-muted-foreground text-sm">We are committed to being transparent about how we collect and use your data.</p>
          </motion.div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="prose dark:prose-invert max-w-none my-8"
        >
          <div className="bg-muted/50 p-6 rounded-xl mb-8 border border-border">
            <h2 className="flex items-center gap-2 mt-0">
              <BrainCircuit className="text-primary" /> 
              AI Data Processing
            </h2>
            <p>
              At D3VONN.IO, we understand the unique privacy considerations that come with AI systems. Our privacy practices are designed specifically for the AI era, ensuring that your data is processed ethically and securely while still allowing our systems to learn and improve.
            </p>
            <ul>
              <li>We use anonymization techniques to protect personal identifiers in training data</li>
              <li>Model training processes are conducted in secure, isolated environments</li>
              <li>We employ differential privacy techniques to prevent model memorization of sensitive data</li>
              <li>Regular audits ensure our AI systems respect privacy boundaries</li>
            </ul>
          </div>
          
          <h2 className="flex items-center gap-2"><FileText className="text-primary" /> Introduction</h2>
          <p>
            D3VONN.IO ("we," "our," or "us") respects your privacy and is committed to protecting it through our compliance with this policy. This privacy policy describes the types of information we may collect from you or that you may provide when you visit our website and our practices for collecting, using, maintaining, protecting, and disclosing that information.
          </p>
          
          <h2 className="flex items-center gap-2"><Users className="text-primary" /> Information We Collect</h2>
          <p>
            We collect several types of information from and about users of our website, including:
          </p>
          <ul>
            <li>Personal information such as name, email address, and contact details when you register for an account or contact us.</li>
            <li>Usage information about your visits to our website, including the pages you view and the features you use.</li>
            <li>Technical information such as your IP address, browser type, and operating system.</li>
            <li>AI-related data, such as model training inputs, model outputs, and feedback provided to improve our services.</li>
          </ul>
          
          <div className="bg-muted/50 p-6 rounded-xl my-8 border border-border">
            <h2 className="flex items-center gap-2 mt-0">
              <Database className="text-primary" /> 
              Data Storage & Retention
            </h2>
            <p>
              Our AI systems require data to function effectively, but we balance this need with strong data protection principles:
            </p>
            <ul>
              <li>Your data is stored in secure, encrypted databases with strict access controls</li>
              <li>We maintain clear data retention policies, only keeping information as long as necessary</li>
              <li>You can request deletion of your personal data at any time through our user portal</li>
              <li>Our AI models are regularly retrained with updated privacy safeguards</li>
            </ul>
          </div>
          
          <h2 className="flex items-center gap-2"><Shield className="text-primary" /> How We Use Your Information</h2>
          <p>
            We use information that we collect about you or that you provide to us:
          </p>
          <ul>
            <li>To present our website and its contents to you.</li>
            <li>To provide you with information, products, or services that you request from us.</li>
            <li>To fulfill any other purpose for which you provide it.</li>
            <li>To improve our website and user experience.</li>
            <li>To enhance and train our AI models, while respecting privacy and confidentiality concerns.</li>
          </ul>
          
          <h2 className="flex items-center gap-2"><Lock className="text-primary" /> Data Security</h2>
          <p>
            We have implemented measures designed to secure your personal information from accidental loss and from unauthorized access, use, alteration, and disclosure. However, the transmission of information via the internet is not completely secure, and we cannot guarantee the security of your personal information transmitted to our website.
          </p>
          
          <div className="bg-muted/50 p-6 rounded-xl my-8 border border-border">
            <h2 className="flex items-center gap-2 mt-0">
              <ServerCog className="text-primary" /> 
              AI System Monitoring
            </h2>
            <p>
              We continuously monitor our AI systems to ensure they operate within our privacy framework:
            </p>
            <ul>
              <li>Automated monitoring tools detect unusual data access patterns</li>
              <li>Regular privacy impact assessments evaluate potential risks</li>
              <li>Independent auditors review our AI operations and privacy practices</li>
              <li>We maintain transparent logs of how AI systems interact with user data</li>
            </ul>
          </div>
          
          <h2 className="flex items-center gap-2"><Bell className="text-primary" /> Changes to Our Privacy Policy</h2>
          <p>
            We may update our privacy policy from time to time. If we make material changes to how we treat our users' personal information, we will notify you through a notice on the website home page.
          </p>
          
          <h2 className="flex items-center gap-2"><FileText className="text-primary" /> Contact Information</h2>
          <p>
            To ask questions or comment about this privacy policy and our privacy practices, contact us at: privacy@d3vonn.io
          </p>
          
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild>
              <Link to="/contact">Contact Us About Privacy</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/terms">View Terms of Service</Link>
            </Button>
          </div>
        </motion.div>
      </Container>
    </>
  );
};

export default Privacy;
