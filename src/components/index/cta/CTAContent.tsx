
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { fadeIn, slideUp } from '@/lib/animations';

const CTAContent: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto text-center relative z-10">
      <motion.h2 
        variants={fadeIn}
        className="text-2xl md:text-3xl lg:text-4xl font-display font-semibold tracking-tight text-white mb-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        Ready to Deploy Your AI Framework?
      </motion.h2>
      
      <motion.p 
        variants={slideUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="text-white/90 mb-8 text-lg"
      >
        Start with our comprehensive deployment framework and take your AI applications to production with confidence.
      </motion.p>
      
      <motion.div 
        variants={slideUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        transition={{ delay: 0.2 }}
        className="flex flex-col sm:flex-row gap-4 justify-center"
      >
        <Button
          asChild
          size="lg"
          className="bg-white text-primary hover:bg-white/90 hover:scale-105 transition-transform shadow-lg group"
        >
          <Link to="/deployment">
            <span className="group-hover:translate-x-1 transition-transform inline-block">
              Get Started
            </span>
          </Link>
        </Button>
        
        <Button
          asChild
          variant="outline"
          size="lg"
          className="bg-primary/20 text-white hover:bg-primary/30 border border-white/20 hover:scale-105 transition-transform shadow-md backdrop-blur-sm group"
        >
          <Link to="/documentation">
            <span className="group-hover:translate-x-1 transition-transform inline-block">
              View Documentation
            </span>
          </Link>
        </Button>
      </motion.div>
    </div>
  );
};

export default CTAContent;
