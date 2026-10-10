
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';

const AIVisualization: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Only run this code in the browser
    if (typeof window === 'undefined' || !canvasRef.current) return;
    
    let animationFrameId: number;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Set canvas dimensions
    const handleResize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    // Particles system
    const particles: {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;
    }[] = [];
    
    const connections: {
      from: number;
      to: number;
      active: boolean;
      timer: number;
    }[] = [];
    
    // Create particles
    for (let i = 0; i < 70; i++) {
      const size = Math.random() * 3 + 1;
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5,
        color: `hsla(${Math.random() * 40 + 200}, 100%, 50%, ${0.3 + Math.random() * 0.7})`
      });
    }
    
    // Create connections
    for (let i = 0; i < particles.length; i++) {
      // Connect each particle to 2-3 others
      const connectionCount = Math.floor(Math.random() * 2) + 2;
      
      for (let j = 0; j < connectionCount; j++) {
        const targetParticle = Math.floor(Math.random() * particles.length);
        if (targetParticle !== i) {
          connections.push({
            from: i,
            to: targetParticle,
            active: false,
            timer: 0
          });
        }
      }
    }
    
    const activateRandomConnection = () => {
      const randomConnection = Math.floor(Math.random() * connections.length);
      connections[randomConnection].active = true;
      connections[randomConnection].timer = 100;
      
      // Chain reaction
      setTimeout(() => {
        const sourceParticle = connections[randomConnection].to;
        for (let i = 0; i < connections.length; i++) {
          if (connections[i].from === sourceParticle && !connections[i].active) {
            connections[i].active = true;
            connections[i].timer = 100;
          }
        }
      }, 100 + Math.random() * 300);
    };
    
    // Start some random connections
    setInterval(activateRandomConnection, 300 + Math.random() * 500);
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw connections
      for (let i = 0; i < connections.length; i++) {
        const connection = connections[i];
        if (connection.active) {
          const fromParticle = particles[connection.from];
          const toParticle = particles[connection.to];
          
          const gradient = ctx.createLinearGradient(
            fromParticle.x, 
            fromParticle.y, 
            toParticle.x, 
            toParticle.y
          );
          
          gradient.addColorStop(0, fromParticle.color);
          gradient.addColorStop(1, toParticle.color);
          
          ctx.beginPath();
          ctx.moveTo(fromParticle.x, fromParticle.y);
          ctx.lineTo(toParticle.x, toParticle.y);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = connection.timer / 100 * 2;
          ctx.stroke();
          
          // Decrease timer
          connection.timer -= 1;
          if (connection.timer <= 0) {
            connection.active = false;
          }
        }
      }
      
      // Draw and update particles
      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        
        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();
        
        // Update position
        particle.x += particle.speedX;
        particle.y += particle.speedY;
        
        // Boundary checking
        if (particle.x < 0 || particle.x > canvas.width) particle.speedX *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.speedY *= -1;
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);
  
  return (
    <section className="py-20">
      <Container maxWidth="2xl">
        <SectionHeading
          centered
          animate
          tag="Interactive Demo"
          subheading="Watch AI networks in action with this interactive visualization"
        >
          AI Network Visualization
        </SectionHeading>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-800"
        >
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-4 md:p-6 rounded-xl">
            <canvas 
              ref={canvasRef} 
              className="w-full h-[400px] rounded-lg"
            />
          </div>
          
          <div className="bg-white dark:bg-gray-900 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              This visualization represents neural connections in a typical AI framework deployment.
              Each node represents a processing unit, with connections showing data flow.
            </p>
          </div>
        </motion.div>
      </Container>
    </section>
  );
};

export default AIVisualization;
