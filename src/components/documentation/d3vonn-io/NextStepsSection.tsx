import React from 'react';
import {
  Bot,
  Cpu,
  BarChart,
  GitBranch,
  Rocket,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

type NextStepItem = {
  icon: React.ElementType;
  title: string;
  description: string;
  href?: string;
  to?: string;
};

export const nextSteps: NextStepItem[] = [
  {
    icon: Bot,
    title: 'Test your agents',
    description: 'Use the agents UI to create LangChain agent configurations and test their capabilities.',
    to: '/agents',
  },
  {
    icon: Cpu,
    title: 'Add memory/tools',
    description: 'Hook up memory, Google Search, OpenAI tools via LangChain to enhance agent capabilities.',
    href: 'https://python.langchain.com/docs/modules/agents/tools/',
  },
  {
    icon: BarChart,
    title: 'Visualize everything',
    description: 'Use the status dashboard to monitor service health and metrics.',
    to: '/status',
  },
  {
    icon: GitBranch,
    title: 'Add fine-tuned models',
    description: 'Load Hugging Face or OpenAI fine-tuned models for specialized tasks and industries.',
    href: 'https://huggingface.co/docs/transformers/training',
  },
  {
    icon: Rocket,
    title: 'Deploy to cloud',
    description: 'Launch via the deployment dashboard for global scale with high availability.',
    to: '/deployment',
  },
];

const NextStepsSection: React.FC = () => {
  const navigate = useNavigate();

  const handleClick = (step: NextStepItem) => {
    if (step.to) navigate(step.to);
    else if (step.href) window.open(step.href, '_blank', 'noopener,noreferrer');
  };

  return (
    <section>
      <h3 className="text-2xl font-bold tracking-tight mb-6 text-primary">What You Can Do Next</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {nextSteps.map((step, index) => (
          <Card key={index} className="overflow-hidden border-border hover:shadow-md transition-shadow duration-300">
            <div className="h-2 bg-gradient-to-r from-primary to-primary/60"></div>
            <CardHeader>
              <div className="flex items-center gap-2">
                <step.icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{step.title}</CardTitle>
              </div>
              <CardDescription className="pt-2">{step.description}</CardDescription>
            </CardHeader>
            <CardFooter className="pt-0">
              <Button
                variant="outline"
                className="w-full mt-2 group"
                onClick={() => handleClick(step)}
              >
                Learn More
                <ExternalLink className="ml-2 h-3 w-3 opacity-70 group-hover:opacity-100 transition-opacity" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default NextStepsSection;
