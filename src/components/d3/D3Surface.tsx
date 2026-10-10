import React from 'react';
import { cn } from '@/lib/utils';

type D3SurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  material?: 'glass' | 'titanium';
  interactive?: boolean;
  glow?: 0 | 1 | 2 | 3 | 4;
};

export const D3Surface = React.forwardRef<HTMLDivElement, D3SurfaceProps>(
  ({ className, material = 'glass', interactive = false, glow = 0, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        material === 'titanium' ? 'd3-titanium-panel' : 'd3-surface',
        interactive && 'd3-surface-interactive',
        glow > 0 && `d3-glow-${glow}`,
        className
      )}
      {...props}
    />
  )
);

D3Surface.displayName = 'D3Surface';

type D3SectionHeaderProps = {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
};

export const D3SectionHeader = ({
  eyebrow,
  title,
  description,
  align = 'left',
  className,
}: D3SectionHeaderProps) => (
  <div className={cn(align === 'center' && 'mx-auto text-center', className)}>
    {eyebrow && <p className="d3-kicker">{eyebrow}</p>}
    <h2 className="d3-display-title mt-4 text-3xl font-black text-white sm:text-4xl lg:text-5xl">{title}</h2>
    {description && (
      <div className={cn('d3-section-copy mt-5 text-base sm:text-lg', align === 'center' && 'mx-auto')}>
        {description}
      </div>
    )}
  </div>
);
