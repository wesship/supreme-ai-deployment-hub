import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  GitBranch,
  ListChecks,
  Play,
  RotateCcw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

const demoSteps = [
  {
    label: 'Goal received',
    detail: 'Launch an AI workforce campaign for a new enterprise prospect.',
    icon: ClipboardCheck,
  },
  {
    label: 'Plan generated',
    detail: 'Hermes decomposes the goal into tasks, dependencies, tools, and checkpoints.',
    icon: GitBranch,
  },
  {
    label: 'Agents assigned',
    detail: 'Research, Builder, Marketing, Security, and Compliance agents receive scoped work.',
    icon: Bot,
  },
  {
    label: 'Workflow running',
    detail: 'The workflow engine tracks status, retries, outputs, and queue movement.',
    icon: ListChecks,
  },
  {
    label: 'Human checkpoint',
    detail: 'High-impact actions pause for approval before execution continues.',
    icon: UserCheck,
  },
  {
    label: 'Output delivered',
    detail: 'Final assets, brief, automation, and next actions are packaged for review.',
    icon: FileCheck2,
  },
  {
    label: 'Audit log written',
    detail: 'Every key decision is captured for supervision, security, and trust.',
    icon: ShieldCheck,
  },
];

const HermesOrchestrationDemo: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const current = demoSteps[activeStep];
  const Icon = current.icon;
  const progress = useMemo(() => ((activeStep + 1) / demoSteps.length) * 100, [activeStep]);

  const nextStep = () => setActiveStep((value) => (value + 1) % demoSteps.length);
  const reset = () => setActiveStep(0);

  return (
    <section id="hermes-demo" className="relative overflow-hidden bg-[#031f4f] py-24 scroll-mt-24">
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_18%_24%,rgba(59,130,246,0.42),transparent_30%),radial-gradient(circle_at_78%_70%,rgba(14,165,233,0.32),transparent_34%)]" />
      <div className="container relative mx-auto px-6">
        <div className="grid gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Hermes Command Center Demo</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
              Watch Hermes turn a goal into governed agent execution
            </h2>
            <p className="mt-5 text-blue-100/72">
              This public demo shows the operating pattern behind D3VONN.IO: goal intake, plan generation, agent assignment, workflow execution, human checkpointing, delivery, and auditability.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={nextStep}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200/35 bg-blue-600/80 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(59,130,246,0.38)] transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <Play className="h-4 w-4" />
                Advance Demo
              </button>
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200/20 bg-white/5 px-6 py-3 text-sm font-semibold text-blue-50 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
              <Link
                to="/workflows"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200/20 bg-blue-300/10 px-6 py-3 text-sm font-semibold text-blue-50 transition hover:bg-blue-300/15 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                Open Workflows
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-blue-200/15 bg-slate-950/30 p-5 shadow-[0_0_70px_-24px_rgba(59,130,246,0.85)] backdrop-blur-xl">
            <div className="rounded-2xl border border-blue-200/10 bg-[#021b48]/80 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-200/10 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-blue-100/55">Demo Run</p>
                  <h3 className="mt-1 text-xl font-black text-white">Enterprise Prospect Campaign</h3>
                </div>
                <span className="rounded-full border border-blue-200/20 bg-blue-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
                  Public Demo
                </span>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-blue-950/80">
                <div
                  className="h-full rounded-full bg-blue-300 shadow-[0_0_18px_rgba(147,197,253,0.8)] transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-[0.7fr_1.3fr]">
                <div className="rounded-2xl border border-blue-200/15 bg-blue-400/[0.04] p-5 text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-blue-300/35 bg-blue-500/20 shadow-[0_0_38px_rgba(59,130,246,0.38)]">
                    <Icon className="h-9 w-9 text-blue-100" />
                  </div>
                  <p className="mt-5 text-sm uppercase tracking-[0.2em] text-blue-100/55">
                    Step {activeStep + 1} of {demoSteps.length}
                  </p>
                  <h4 className="mt-2 text-2xl font-black text-white">{current.label}</h4>
                  <p className="mt-3 text-sm text-blue-100/66">{current.detail}</p>
                </div>

                <div className="space-y-3">
                  {demoSteps.map((step, index) => {
                    const StepIcon = step.icon;
                    const isActive = index === activeStep;
                    const isComplete = index < activeStep;
                    return (
                      <button
                        key={step.label}
                        type="button"
                        onClick={() => setActiveStep(index)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                          isActive
                            ? 'border-blue-200/55 bg-blue-500/20 shadow-[0_0_24px_-10px_rgba(147,197,253,0.9)]'
                            : 'border-blue-200/10 bg-white/[0.03] hover:border-blue-200/30 hover:bg-blue-500/10'
                        }`}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-200/20 bg-blue-500/10">
                          {isComplete ? <CheckCircle2 className="h-5 w-5 text-blue-200" /> : <StepIcon className="h-5 w-5 text-blue-100" />}
                        </span>
                        <span>
                          <span className="block text-sm font-bold text-white">{step.label}</span>
                          <span className="block text-xs text-blue-100/55">{step.detail}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HermesOrchestrationDemo;
