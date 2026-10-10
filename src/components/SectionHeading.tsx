
import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface SectionHeadingProps {
  children: React.ReactNode;
  subheading?: React.ReactNode;
  className?: string;
  subheadingClassName?: string;
  animate?: boolean;
  centered?: boolean;
  tag?: string;
}

const SectionHeading = ({
  children,
  subheading,
  className,
  subheadingClassName,
  animate = false,
  centered = false,
  tag
}: SectionHeadingProps) => {
  const headingContent = (
    <>
      {tag && (
        <div className="inline-block mb-2">
          <span className="inline-flex items-center px-3 py-1 text-xs font-medium tracking-wide uppercase rounded-full bg-primary/10 text-primary">
            {tag}
          </span>
        </div>
      )}
      <h2 className={cn(
        "text-2xl font-display font-semibold tracking-tight sm:text-3xl",
        centered && "text-center",
        className
      )}>
        {children}
      </h2>
      {subheading && (
        <p className={cn(
          "mt-2 text-lg text-muted-foreground",
          centered && "text-center",
          subheadingClassName
        )}>
          {subheading}
        </p>
      )}
    </>
  );

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {headingContent}
      </motion.div>
    );
  }

  return <div>{headingContent}</div>;
};

export default SectionHeading;
