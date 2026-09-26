import React from 'react';
import { cn } from '@/lib/utils';

interface D3VONNMarketingHeroProps {
  eyebrow: string;
  title: React.ReactNode;
  description: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const D3VONNMarketingHero = ({
  eyebrow,
  title,
  description,
  children,
  className,
}: D3VONNMarketingHeroProps) => (
  <section className={cn('relative px-4 pb-14 pt-20 sm:px-6 sm:pb-18 sm:pt-24 lg:px-8 lg:pb-20 lg:pt-28', className)}>
    <div className="mx-auto max-w-5xl text-center">
      <div className="inline-flex items-center border border-amber-200/20 bg-amber-200/[0.06] px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-amber-100">
        {eyebrow}
      </div>
      <h1 className="mx-auto mt-7 max-w-5xl text-balance text-4xl font-black leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
        {title}
      </h1>
      <p className="mx-auto mt-7 max-w-3xl text-base leading-7 text-white/58 sm:text-lg sm:leading-8">
        {description}
      </p>
      {children ? <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">{children}</div> : null}
    </div>
  </section>
);

export default D3VONNMarketingHero;
