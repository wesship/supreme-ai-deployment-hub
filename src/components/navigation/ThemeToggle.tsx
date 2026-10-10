import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    // Reserve space to prevent header layout shift on hydration
    return <div className="h-9 w-9" aria-hidden />;
  }

  const isDark = theme === 'dark';
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  return (
    <Button
      type="button"
      onClick={toggleTheme}
      variant="ghost"
      size="icon"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="h-9 w-9 rounded-full border border-primary/20 bg-background/40 text-primary hover:bg-primary/10 hover:text-primary backdrop-blur-sm"
    >
      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
};

export default ThemeToggle;
