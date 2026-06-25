
import React, { useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Container from '@/components/Container';
import { AnimatedText } from '@/components/ui/animated-shiny-text';
import { MatrixRain } from '@/components/ui/matrix-rain';
import { CRTOverlay } from '@/components/ui/crt-overlay';
import { Button } from '@/components/ui/button';
import { ArrowRight, Download, Code } from 'lucide-react';
import InteractiveTerminal from './InteractiveTerminal';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const HeroSection: React.FC = () => {
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 300], [0, 100]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);
  const isMobile = useIsMobile();
  const [stats, setStats] = useState({
    deployments: 0,
    efficiency: 0,
    uptime: 0
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        deployments: Math.min(prev.deployments + 1, 1000),
        efficiency: Math.min(prev.efficiency + 1, 99),
        uptime: Math.min(prev.uptime + 0.1, 99.99)
      }));
    }, 50);

    return () => clearInterval(interval);
  }, []);

  const handleDownloadClick = () => {
    toast.success("Starting download...", {
      description: "The framework package will begin downloading shortly",
    });
    
    // Simulate download delay
    setTimeout(() => {
      // Create a download link for a fictional framework package
      const link = document.createElement('a');
      link.href = '/d3vonn-io-framework.zip'; // This would be a real file in production
      link.download = 'd3vonn-io-framework.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, 800);
  };

  const handleDocumentationClick = () => {
    navigate('/documentation');
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden devonn-hero-bg">
      <MatrixRain 
        speed={1.2} 
        density={0.6} 
        color="#7080FF" 
        glowColor="#00FF41"
        size={16} 
        opacity={0.5}
        glowIntensity={2.5}
      />
      
      <CRTOverlay 
        scanlineOpacity={0.08}
        scanlineSize={2}
        flickerIntensity={0.02}
        vignette={true}
        rgbShift={true}
        noise={true}
      />
      
      <div className="absolute inset-0 bg-background/50 z-0"></div>
      
      <Container maxWidth="2xl" animate>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
          <motion.div
            style={{ y, opacity }}
            className="lg:col-span-7 space-y-6 py-16 lg:py-0"
          >
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <span className="inline-block px-4 py-1.5 text-xs font-medium tracking-wider uppercase rounded-full accent-subtle-bg accent-subtle-border border text-primary">
                AI Framework
              </span>
              
              <AnimatedText 
                text="d3vonn.io"
                gradientColors="linear-gradient(90deg, hsl(235 100% 72%), hsl(235 90% 65%), hsl(235 100% 72%))"
                gradientAnimationDuration={3}
                hoverEffect={true}
                className="py-2 justify-start"
                textClassName={`${isMobile ? 'text-5xl sm:text-6xl' : 'text-6xl lg:text-7xl xl:text-8xl'} font-display font-bold tracking-tight`}
              />
              
              <p className="text-2xl text-primary/90 font-mono mb-3 max-w-md">
                Here at an opportune time.
              </p>
              
              <p className="text-secondary-opacity text-lg max-w-md paragraph-width leading-relaxed">
                A minimalist, elegant framework for deploying AI systems with precision and scalability.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-8">
                <Button 
                  size="lg"
                  className="shadow-accent-glow transition-all duration-300 group relative overflow-hidden w-full sm:w-auto text-lg py-6"
                  onClick={handleDownloadClick}
                >
                  <motion.div
                    className="absolute inset-0 bg-foreground/10"
                    initial={false}
                    animate={{ x: ["0%", "100%"] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <Download className="mr-2 h-5 w-5 opacity-70" />
                  <span className="relative z-10">Download Framework</span>
                  <ArrowRight className="ml-2 h-5 w-5 opacity-70 group-hover:translate-x-1 transition-transform" />
                </Button>
                
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto text-lg py-6"
                  onClick={handleDocumentationClick}
                >
                  <Code className="mr-2 h-5 w-5" />
                  View Documentation
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-6 pt-10">
                {[
                  { label: 'Deployments', value: stats.deployments.toLocaleString() },
                  { label: 'Efficiency', value: `${stats.efficiency}%` },
                  { label: 'Uptime', value: `${stats.uptime.toFixed(2)}%` }
                ].map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    className="text-center p-4 rounded-xl glass border border-border/10"
                  >
                    <div className="text-xl sm:text-2xl font-bold text-primary">{stat.value}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
          
          <motion.div 
            className="lg:col-span-5"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <InteractiveTerminal />
          </motion.div>
        </div>
      </Container>
    </section>
  );
};

export default HeroSection;
