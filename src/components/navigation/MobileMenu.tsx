
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bot, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger,
  SheetClose 
} from '@/components/ui/sheet';
import { NavButton } from './NavButton';

interface MobileMenuProps {
  navigationItems: Array<{ name: string, path: string }>;
}

const MobileMenu: React.FC<MobileMenuProps> = ({ navigationItems }) => {
  const location = useLocation();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <NavButton variant="ghost" size="icon">
          <span className="sr-only">Open menu</span>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 12H21"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M3 6H21"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M3 18H21"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </NavButton>
      </SheetTrigger>
      <SheetContent side="right" className="bg-black/95 border-l border-primary/30">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Bot className="w-6 h-6 mr-2 text-primary" />
              <span className="text-lg font-display font-semibold text-white">
                D3VONN<span className="text-primary">.IO</span>
              </span>
            </div>
            <SheetClose asChild>
              <NavButton variant="ghost" size="icon" className="text-white/70 hover:text-white">
                <X className="h-5 w-5" />
              </NavButton>
            </SheetClose>
          </div>
          
          <nav className="flex flex-col space-y-4">
            {navigationItems.map(item => (
              <SheetClose asChild key={item.name}>
                <Link 
                  to={item.path} 
                  className={cn(
                    "px-2 py-1.5 rounded-md text-sm font-medium transition-colors",
                    location.pathname === item.path
                      ? "bg-primary/10 text-primary border-l-2 border-primary pl-3"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {item.name}
                </Link>
              </SheetClose>
            ))}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileMenu;
