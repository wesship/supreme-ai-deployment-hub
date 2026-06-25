
import React from 'react';
import { 
  Server,
  Code,
  Globe
} from 'lucide-react';

type ComponentItem = {
  icon: React.ElementType;
  title: string;
  items: string[];
};

export const components: ComponentItem[] = [
  {
    icon: Server,
    title: "Backend",
    items: [
      "main.py, routes/, schemas/, services/",
      "API endpoints: /auth/, /secure/, /agents/new, /tasks/, /metrics/",
      "LangChain agent factory module",
      "Boost.Space event tracking",
      "JWT-auth protected APIs"
    ]
  },
  {
    icon: Code,
    title: "Frontend",
    items: [
      "Login/Register/Dashboard/Agent creation views",
      "Zustand token store",
      "TailwindCSS UI",
      "Axios API layer"
    ]
  },
  {
    icon: Globe,
    title: "DevOps",
    items: [
      "Dockerized with PostgreSQL, Redis, FastAPI, React",
      "GitHub Actions for CI/CD",
      "SSL-ready via NGINX + Certbot",
      "Environment templates + API key handling"
    ]
  }
];

const ProjectComponentsSection: React.FC = () => {
  return (
    <div className="space-y-4">
      {components.map((component, index) => (
        <div key={index}>
          <h4 className="font-semibold flex items-center gap-2">
            <component.icon className="h-4 w-4 text-primary" />
            {component.title}
          </h4>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground mt-1 text-sm">
            {component.items.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default ProjectComponentsSection;
