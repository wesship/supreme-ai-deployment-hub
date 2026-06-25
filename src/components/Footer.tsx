
import React from 'react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { Bot, Database, Network, BrainCircuit, Code } from 'lucide-react';
import logoAsset from '@/assets/d3vonn-logo.png.asset.json';

interface FooterProps {
  className?: string;
}

const Footer = ({ className }: FooterProps) => {
  return (
    <footer className={cn("border-t border-blue-500/20 py-12 bg-[#020817]", className)}>
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <Link to="/" className="flex items-center gap-3" aria-label="D3VONN.IO home">
              <img
                src={logoAsset.url}
                alt="D3VONN.IO"
                className="h-10 w-auto object-contain"
                draggable={false}
              />
            </Link>
            <p className="mt-4 text-sm text-white/70 max-w-md">
              The World's First AI Business Operating System. Orchestrate your AI workforce, 
              automate everything, and scale without limits.
            </p>
            <p className="mt-2 text-xs text-white/40 italic">
              You're here at an opportune time so Live
            </p>
            
            <div className="mt-6 flex space-x-4">
              <a 
                href="#" 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-blue-500/10 text-white/70 hover:text-blue-400 transition-colors border border-white/10 hover:border-blue-500/30"
                aria-label="Database"
              >
                <Database className="w-4 h-4" />
              </a>
              <a 
                href="#" 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-blue-500/10 text-white/70 hover:text-blue-400 transition-colors border border-white/10 hover:border-blue-500/30"
                aria-label="Network"
              >
                <Network className="w-4 h-4" />
              </a>
              <a 
                href="#" 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-blue-500/10 text-white/70 hover:text-blue-400 transition-colors border border-white/10 hover:border-blue-500/30"
                aria-label="AI Intelligence"
              >
                <BrainCircuit className="w-4 h-4" />
              </a>
              <a 
                href="#" 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-blue-500/10 text-white/70 hover:text-blue-400 transition-colors border border-white/10 hover:border-blue-500/30"
                aria-label="Source Code"
              >
                <Code className="w-4 h-4" />
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 relative inline-block">
              Resources
              <span className="absolute -bottom-1 left-0 w-1/2 h-0.5 bg-blue-500/50"></span>
            </h3>
            <ul className="space-y-2">
              <li>
                <Link to="/documentation" className="text-sm text-white/70 hover:text-blue-400 transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <Link to="/platform" className="text-sm text-white/70 hover:text-blue-400 transition-colors">
                  Platform
                </Link>
              </li>
              <li>
                <Link to="/api" className="text-sm text-white/70 hover:text-blue-400 transition-colors">
                  API Reference
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-sm text-white/70 hover:text-blue-400 transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 relative inline-block">
              Company
              <span className="absolute -bottom-1 left-0 w-1/2 h-0.5 bg-blue-500/50"></span>
            </h3>
            <ul className="space-y-2">
              <li>
                <Link to="/about" className="text-sm text-white/70 hover:text-blue-400 transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-sm text-white/70 hover:text-blue-400 transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/agents" className="text-sm text-white/70 hover:text-blue-400 transition-colors">
                  Agents
                </Link>
              </li>
              <li>
                <a 
                  href="https://github.com/wesship/supreme-ai-deployment-hub" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white/70 hover:text-blue-400 transition-colors"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-blue-500/10 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-white/50">
            &copy; {new Date().getFullYear()} D3VONN.IO. All rights reserved.
          </p>
          <div className="mt-4 md:mt-0 flex space-x-6">
            <Link to="/privacy" className="text-sm text-white/50 hover:text-blue-400 transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="text-sm text-white/50 hover:text-blue-400 transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
