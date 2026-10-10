import React, { useEffect, useState } from 'react';
import { ArrowRight, Boxes, Brain, CheckCircle2, Cpu, Database, Inbox } from 'lucide-react';
import { useCalmMotion, useInView } from './os-hooks';

const STAGES = [
  { label: 'Request', icon: Inbox, detail: 'Operator or system event' },
  { label: 'Hermes', icon: Brain, detail: 'Plan + policy check' },
  { label: 'Agent', icon: Cpu, detail: 'Specialist execution' },
  { label: 'Tool', icon: Boxes, detail: 'API / connector call' },
  { label: 'Memory', icon: Database, detail: 'Write back to knowledge' },
  { label: 'Result', icon: CheckCircle2, detail: 'Verified output' },
];

/** Live workflow visualization with a travelling execution pulse. */
const WorkflowPulse: React.FC = () => {
  const calm = useCalmMotion();
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView || calm) return;
    const timer = window.setInterval(() => setStep((value) => (value + 1) % (STAGES.length + 1)), 900);
    return () => window.clearInterval(timer);
  }, [inView, calm]);

  return (
    <div ref={ref} className="os-card p-4 md:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-bold">Execution path</h3>
          <p className="text-sm text-[color:var(--os-ink-60)]">Every request is planned, supervised and written back.</p>
        </div>
        <span className="os-pill os-mono w-fit px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[color:var(--os-ink-60)]">
          Demo trace
        </span>
      </div>

      <ol className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STAGES.map((stage, index) => {
          const active = !calm && index === step;
          const done = !calm && index < step;
          const Icon = stage.icon;
          return (
            <li key={stage.label} className="flex items-center gap-3">
              <div
                className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border p-4 transition-colors duration-300 md:p-5"
                style={{
                  borderColor: active ? 'var(--os-orange)' : done ? 'var(--os-lime-deep)' : 'var(--os-line)',
                  background: active ? 'rgba(255,122,26,0.07)' : 'rgba(255,255,255,0.6)',
                }}
              >
                <Icon
                  className="h-5 w-5"
                  style={{ color: active ? 'var(--os-orange)' : done ? 'var(--os-lime-deep)' : 'var(--os-ink-40)' }}
                  aria-hidden="true"
                />
                <span className="text-sm font-semibold">{stage.label}</span>
                <span className="text-xs text-[color:var(--os-ink-60)]">{stage.detail}</span>
              </div>
              {index < STAGES.length - 1 && (
                <ArrowRight
                  className="hidden h-4 w-4 shrink-0 lg:block"
                  style={{ color: done ? 'var(--os-lime-deep)' : 'var(--os-ink-40)' }}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default WorkflowPulse;
