const categories = [
  'AI Agents',
  'AI Films',
  'Voice',
  'Automation',
  'Local Inference',
  'Creative Systems',
  'Deployment',
];

export default function SignalRail() {
  const items = [...categories, ...categories];

  return (
    <div className="relative overflow-hidden border-y border-foreground-200/10 bg-background-100/50 py-4 group/ticker">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background-50 to-transparent"></div>
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background-50 to-transparent"></div>

      <div className="animate-ticker flex w-max items-center group-hover/ticker:[animation-play-state:paused]">
        {items.map((c, i) => (
          <span key={i} className="flex items-center whitespace-nowrap">
            <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-foreground-300 transition-colors duration-300 group-hover/ticker:text-foreground-200">
              {c}
            </span>
            <span className="mx-6 flex h-1 w-1 rotate-45 items-center justify-center bg-primary-500/50"></span>
          </span>
        ))}
      </div>
    </div>
  );
}