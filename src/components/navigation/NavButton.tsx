
import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children: React.ReactNode;
}

export const NavButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF41] focus-visible:ring-offset-2 disabled:opacity-50",
          {
            'bg-[#00FF41] text-black hover:bg-[#00FF41]/90': variant === 'default',
            'hover:bg-white/10 text-white/70 hover:text-white': variant === 'ghost',
            'text-[#00FF41] underline-offset-4 hover:underline': variant === 'link',
            'h-10 px-4 py-2': size === 'default',
            'h-9 px-3': size === 'sm',
            'h-11 px-8': size === 'lg',
            'h-9 w-9 p-0': size === 'icon',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

NavButton.displayName = "NavButton";
