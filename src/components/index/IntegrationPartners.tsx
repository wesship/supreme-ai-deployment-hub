
import React from 'react';
import { motion } from 'framer-motion';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import { Brain, Cpu, Database, ServerCog, Network, Boxes, BrainCircuit, Bot, Code, FileCode, Command, Microchip } from 'lucide-react';

const partners = [
  { 
    name: 'Neural Network', 
    icon: BrainCircuit,
    image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5",
    color: "bg-blue-500/10 text-blue-500"
  },
  { 
    name: 'Tensor Processing', 
    icon: Cpu,
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475",
    color: "bg-purple-500/10 text-purple-500"
  },
  { 
    name: 'Vector Database', 
    icon: Database,
    image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5",
    color: "bg-green-500/10 text-green-500"
  },
  { 
    name: 'AI Inference', 
    icon: ServerCog,
    image: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b",
    color: "bg-amber-500/10 text-amber-500"
  },
  { 
    name: 'Distributed ML', 
    icon: Network,
    image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6",
    color: "bg-red-500/10 text-red-500"
  },
  { 
    name: 'Containerized AI', 
    icon: Boxes,
    image: "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7",
    color: "bg-indigo-500/10 text-indigo-500"
  },
  { 
    name: 'Chatbot Models', 
    icon: Bot,
    image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5",
    color: "bg-teal-500/10 text-teal-500"
  },
  { 
    name: 'AI Accelerators', 
    icon: Microchip,
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475",
    color: "bg-cyan-500/10 text-cyan-500"
  },
  { 
    name: 'AI Embeddings', 
    icon: Database,
    image: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b",
    color: "bg-emerald-500/10 text-emerald-500"
  },
  { 
    name: 'Model Serving', 
    icon: Code,
    image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6",
    color: "bg-violet-500/10 text-violet-500"
  },
  { 
    name: 'AI Orchestration', 
    icon: Command,
    image: "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7",
    color: "bg-pink-500/10 text-pink-500"
  },
  { 
    name: 'LLM Models', 
    icon: Brain,
    image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5",
    color: "bg-blue-500/10 text-blue-500"
  },
];

const IntegrationPartners: React.FC = () => {
  return (
    <section className="py-20 relative overflow-hidden">
      {/* Enhanced abstract background pattern with floating particles */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 z-0"></div>
        <img 
          src="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5" 
          alt="AI pattern background" 
          className="w-full h-full object-cover"
        />
        
        {/* Animated floating particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-primary/20"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 3 + Math.random() * 5,
              repeat: Infinity,
              delay: Math.random() * 5,
            }}
          />
        ))}
      </div>
      
      <Container maxWidth="2xl">
        <SectionHeading 
          centered
          animate 
          tag="Ecosystem"
          subheading="D3VONN.IO integrates seamlessly with leading tools and platforms"
        >
          Integration Partners
        </SectionHeading>
        
        <div className="mt-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
          {partners.map((partner, i) => {
            const Icon = partner.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.3, delay: 0.05 * i }}
                whileHover={{ 
                  scale: 1.05,
                  transition: { duration: 0.2 }
                }}
                className="flex flex-col items-center justify-center p-4 text-center group cursor-pointer"
              >
                <motion.div 
                  className={`w-16 h-16 ${partner.color} rounded-full shadow-md flex items-center justify-center mb-2 relative overflow-hidden`}
                  whileHover={{ 
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" 
                  }}
                >
                  <div className="absolute inset-0 opacity-10">
                    <img 
                      src={partner.image} 
                      alt={partner.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-full border border-primary/20 opacity-70"
                  ></motion.div>
                  <Icon className="w-8 h-8 relative z-10" />
                </motion.div>
                <span className="text-xs font-medium text-muted-foreground mt-1 group-hover:text-primary transition-colors duration-300">{partner.name}</span>
              </motion.div>
            );
          })}
        </div>
      </Container>
    </section>
  );
};

export default IntegrationPartners;
