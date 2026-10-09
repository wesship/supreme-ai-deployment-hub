interface SectionHeaderProps {
  index?: string;
  label: string;
  title: React.ReactNode;
  copy?: string;
  align?: 'left' | 'center';
}

export default function SectionHeader({ index, label, title, copy, align = 'left' }: SectionHeaderProps) {
  const centered = align === 'center';
  return (
    <div className={`max-w-3xl ${centered ? 'mx-auto text-center' : ''}`}>
      <div className={`flex items-center gap-3 ${centered ? 'justify-center' : ''}`}>
        {index && (
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary-500/80">{index}</span>
        )}
        <span className="h-px w-8 bg-primary-500/40"></span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground-200">
          {label}
        </span>
      </div>
      <h2 className="mt-6 font-heading text-4xl font-bold leading-[1.05] tracking-tight text-foreground-900 sm:text-5xl md:text-6xl">
        {title}
      </h2>
      {copy && (
        <p className={`mt-6 max-w-2xl text-base leading-7 text-foreground-200 font-medium ${centered ? 'mx-auto' : ''}`}>
          {copy}
        </p>
      )}
    </div>
  );
}