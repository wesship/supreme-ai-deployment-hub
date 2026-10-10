
import React from 'react';
import { 
  Brain, 
  BarChart, 
  AlertCircle,
  Lock,
  Code,
  Terminal,
  Workflow
} from 'lucide-react';

type CapabilityItem = {
  icon: React.ElementType;
  text: string;
};

export const capabilities: CapabilityItem[] = [
  { 
    icon: Brain, 
    text: "Create and manage AI agents (LangChain-powered)" 
  },
  { 
    icon: BarChart, 
    text: "Real-time tracking of agent usage (via Boost.Space)" 
  },
  { 
    icon: AlertCircle, 
    text: "Slack alert integration for errors and lifecycle events" 
  },
  { 
    icon: Lock, 
    text: "FastAPI backend with JWT auth, PostgreSQL, Alembic" 
  },
  { 
    icon: Code, 
    text: "React frontend with TailwindCSS, Zustand, and Agent UI" 
  },
  { 
    icon: Terminal, 
    text: "Docker + GitHub CI/CD, NGINX + HTTPS setup" 
  },
  { 
    icon: Workflow, 
    text: "Multi-agent orchestration-ready" 
  }
];

const CapabilitiesSection: React.FC = () => {
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
      {capabilities.map((capability, index) => (
        <li key={index} className="flex items-start gap-2">
          <capability.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <span className="text-sm">{capability.text}</span>
        </li>
      ))}
    </ul>
  );
};

export default CapabilitiesSection;
