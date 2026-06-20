
import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, FileText, Database, Terminal } from "lucide-react";
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <D3vonnPageBanner title="Lost in the Grid" />
      <div className="text-center max-w-md px-4">
        <h1 className="text-6xl font-bold mb-4 text-primary">404</h1>
        <p className="text-2xl text-foreground mb-4">Page Not Found</p>
        <p className="text-muted-foreground mb-8">
          Sorry, we couldn't find the page you're looking for: <span className="font-mono bg-secondary px-2 py-1 rounded">{location.pathname}</span>
        </p>
        
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Link to="/">
            <Button className="w-full" variant="default">
              <Home className="mr-2" size={16} />
              Home
            </Button>
          </Link>
          
          <Link to="/documentation">
            <Button className="w-full" variant="outline">
              <FileText className="mr-2" size={16} />
              Documentation
            </Button>
          </Link>
          
          <Link to="/api">
            <Button className="w-full" variant="outline">
              <Database className="mr-2" size={16} />
              API
            </Button>
          </Link>
          
          <Link to="/deployment">
            <Button className="w-full" variant="outline">
              <Terminal className="mr-2" size={16} />
              Deployment
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
