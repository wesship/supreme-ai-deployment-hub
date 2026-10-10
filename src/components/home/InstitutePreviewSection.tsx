import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Cpu, Globe2, GraduationCap, HeartPulse, Home, Leaf, Users } from 'lucide-react';

const highlights = [
  { icon: Cpu, label: 'Technology' },
  { icon: Users, label: 'Youth' },
  { icon: HeartPulse, label: 'Health' },
  { icon: Home, label: 'Housing' },
  { icon: GraduationCap, label: 'Education' },
  { icon: Globe2, label: 'Global Relief' },
];

const InstitutePreviewSection: React.FC = () => (
  <section className="relative overflow-hidden border-y border-emerald-300/10 bg-[#03130b] py-24 sm:py-32">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_30%,rgba(34,197,94,0.18),transparent_30%),radial-gradient(circle_at_82%_60%,rgba(14,165,233,0.11),transparent_34%)]" />
    <div className="container relative mx-auto px-4 sm:px-6">
      <div className="mx-auto max-w-6xl rounded-[32px] border border-emerald-200/15 bg-[linear-gradient(145deg,rgba(7,39,23,0.94),rgba(2,17,14,0.97))] p-6 shadow-[0_0_90px_-35px_rgba(34,197,94,0.55)] sm:p-10 lg:p-12">
        <div className="grid gap-12 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/18 bg-emerald-300/[0.06] px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-100/75">
              <Leaf className="h-4 w-4" />
              D3VONN.IO Institute
            </div>
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.28em] text-emerald-300/65">People · Planet · Prosperity</p>
            <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">
              Technology, global relief, and sustainable development.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-emerald-50/62">
              The nonprofit arm of the D3VONN ecosystem connects technology, environmental stewardship, education, health, housing, youth development, community partnerships, and international impact.
            </p>
            <Link
              to="/institute"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-[#02120a] transition hover:bg-emerald-400"
            >
              Explore the Institute
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {highlights.map(({ icon: Icon, label }) => (
              <div key={label} className="flex min-h-[130px] flex-col justify-between rounded-2xl border border-emerald-200/12 bg-white/[0.035] p-4">
                <Icon className="h-6 w-6 text-emerald-300" />
                <p className="text-sm font-bold text-white">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default InstitutePreviewSection;
