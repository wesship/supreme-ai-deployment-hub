
import React from 'react';
import { cn } from '@/lib/utils';

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Spinner: React.FC<SpinnerProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn("animate-spin rounded-full border-2 border-current border-t-transparent", className)}
      {...props}
    >
      <span className="sr-only">Loading</span>
    </div>
  );
};

export default Spinner;
