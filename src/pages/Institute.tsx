import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Building2,
  Cpu,
  GraduationCap,
  HandHeart,
  HeartPulse,
  Home,
  Leaf,
  ShieldCheck,
  Users,
  Globe2,
  Radio,
} from 'lucide-react';

const programs = [
  {
    icon: Cpu,
    title: 'Technology',
    text: 'Digital access, AI literacy, practical tools, and innovation support for underserved communities.',
  },
  {
    icon: Users,
    title: 'Kids Programs',
    text: 'Mentorship, STEM education, leadership development, and pathways that expand opportunity for young people.',
  },
  {
    icon: HeartPulse,
    title: 'Medical & Wellness',
    text: 'Community health education, wellness initiatives, preventive-care outreach, and access-oriented partnerships.',
  },
  {
    icon: ShieldCheck,
    title: 'Financial Resilience',
    text: 'Education and partnerships that strengthen household protection, financial capability, and community resilience.',
  },
  {
    icon: Home,
    title: 'Housing',
    text: 'Support for safe, affordable, sustainable housing initiatives and community-centered development.',
  },
  {
    icon: GraduationCap,
    title: 'Education',
    text: 'Scholarships, learning resources, digital literacy, workforce training, and lifelong education programs.',
  },
];

const operatingPillars = [
  {
    icon: HandHeart,
    title: 'Programs & Impact',
    text: 'Project delivery, community outreach, outcome tracking, and local implementation.',
  },
  {
    icon: BookOpen,
    title: 'Grants & Development',
    text: 'Grant intelligence, fundraising readiness, partnerships, and sustainable program funding.',
  },
  {
    icon: Building2,
    title: 'Finance & Compliance',
    text: 'Transparent reporting, governance controls, audit readiness, and responsible stewardship.',
  },
  {
    icon: Cpu,
    title: 'Technology & Innovation',
    text: 'Digital platforms, AI-enabled tools, data systems, and solutions designed for public benefit.',
  },
];

const Institute: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#03130b] text-white">
      <Helmet>
        <title>D3VONN.IO Institute — Technology, Global Relief & Sustainable Development</title>
        <meta
          name="description"
          content="D3VONN.IO Institute advances technology, environmental stewardship, education, health, housing, youth development, and global relief through community-centered programs and partnerships."
        />
        <link rel="canonical" href="https://d3vonn.io/institute" />
      </Helmet>

      <section className="relative isolate overflow-hidden border-b border-emerald-300/15 bg-[#03130b]">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_18%_18%,rgba(34,197,94,0.23),transparent_30%),radial-gradient(circle_at_78%_24%,rgba(14,165,233,0.16),transparent_34%),linear-gradient(135deg,#03130b_0%,#062015_48%,#03131b_100%)]" />
        <div className="absolute inset-0 -z-10 opacity-20 bg-[linear-gradient(rgba(134,239,172,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(134,239,172,0.06)_1px,transparent_1px)] bg-[size:72px_72px]" />
        <div className="container mx-auto px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/8 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-100/80">
              <Leaf className="h-4 w-4" />
              People · Planet · Prosperity
            </div>

            <div className="mt-8 grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.28em] text-emerald-200/65">
                  D3VONN.IO Institute
                </p>
                <h1 className="mt-4 max-w-4xl text-balance text-5xl font-black leading-[0.92] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
                  Technology for global relief and sustainable development.
                </h1>
                <p className="mt-7 max-w-3xl text-lg leading-8 text-emerald-50/72 sm:text-xl">
                  We connect technology, environmental stewardship, education, health, housing, youth development, and community partnerships to create lasting impact for people and the planet.
                </p>
                <div className="mt-9 flex flex-wrap gap-3">
                  <a
                    href="#programs"
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-[#02120a] transition hover:bg-emerald-400"
                  >
                    Explore programs
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <Link
                    to="/contact"
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-200/20 bg-white/[0.04] px-5 py-3 font-semibold text-emerald-50 transition hover:border-emerald-200/40 hover:bg-white/[0.08]"
                  >
                    Partner with the Institute
                  </Link>
                </div>
              </div>

              <div className="rounded-[28px] border border-emerald-200/15 bg-white/[0.035] p-6 backdrop-blur-xl sm:p-8">
                <Globe2 className="h-9 w-9 text-emerald-300" />
                <p className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-emerald-200/55">Our vision</p>
                <p className="mt-3 text-2xl font-bold leading-tight text-white">
                  A world where technology, compassion, sustainability, and opportunity strengthen communities locally and globally.
                </p>
                <div className="mt-8 border-t border-white/10 pt-6">
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/45">Core values</p>
                  <p className="mt-3 text-sm leading-7 text-emerald-50/68">
                    Stewardship · Integrity · Innovation · Inclusivity · Transparency · Impact · Empowerment
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="programs" className="bg-[#04160d] py-20 sm:py-28">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-300/65">Our programs</p>
              <h2 className="mt-4 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
                Community systems built around real needs.
              </h2>
              <p className="mt-5 text-lg leading-8 text-emerald-50/58">
                The Institute is designed as a multi-program platform that can coordinate direct services, education, technology, partners, grants, and field operations under one public-benefit mission.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {programs.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-2xl border border-emerald-200/12 bg-emerald-300/[0.035] p-6 transition hover:-translate-y-1 hover:border-emerald-300/30 hover:bg-emerald-300/[0.06]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-200/15 bg-emerald-300/10">
                    <Icon className="h-6 w-6 text-emerald-300" />
                  </div>
                  <h3 className="mt-6 text-xl font-bold text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-emerald-50/58">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-emerald-200/10 bg-[#03130b] py-20 sm:py-28">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-300/65">Nonprofit operating model</p>
                <h2 className="mt-4 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
                  Governance, impact, and innovation in one structure.
                </h2>
                <p className="mt-6 text-lg leading-8 text-emerald-50/58">
                  The Institute is structured around board governance and executive leadership, with dedicated operating pillars for programs, development, compliance, and technology.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {operatingPillars.map(({ icon: Icon, title, text }) => (
                  <div key={title} className="rounded-2xl border border-emerald-200/12 bg-white/[0.03] p-6">
                    <Icon className="h-6 w-6 text-emerald-300" />
                    <h3 className="mt-5 text-lg font-bold text-white">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-emerald-50/55">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#04160d] py-20 sm:py-28">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
            <div className="rounded-[28px] border border-emerald-200/12 bg-[linear-gradient(145deg,rgba(16,64,39,0.78),rgba(3,19,11,0.96))] p-8 sm:p-10">
              <Globe2 className="h-8 w-8 text-emerald-300" />
              <h2 className="mt-6 text-3xl font-black text-white">Local action. Global impact.</h2>
              <p className="mt-4 text-base leading-7 text-emerald-50/62">
                Community partners, global stakeholders, and field operations can connect Institute programs to international relief, environmental recovery, and sustainable-development initiatives.
              </p>
            </div>

            <div className="rounded-[28px] border border-emerald-200/12 bg-[linear-gradient(145deg,rgba(8,42,36,0.86),rgba(3,19,11,0.96))] p-8 sm:p-10">
              <Radio className="h-8 w-8 text-cyan-300" />
              <h2 className="mt-6 text-3xl font-black text-white">HNF — The Brand</h2>
              <p className="mt-4 text-base leading-7 text-emerald-50/62">
                HNF serves as a storytelling, media, community-engagement, and awareness platform that can amplify Institute programs, partnerships, and impact.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#03130b] py-20 sm:py-28">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-5xl rounded-[32px] border border-emerald-300/18 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.16),transparent_46%),linear-gradient(145deg,rgba(5,33,19,0.96),rgba(2,17,12,0.98))] px-6 py-14 text-center sm:px-12 sm:py-18">
            <Leaf className="mx-auto h-10 w-10 text-emerald-300" />
            <h2 className="mx-auto mt-6 max-w-3xl text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
              Building a more sustainable, equitable, and technologically empowered world.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-emerald-50/60">
              Connect with D3VONN.IO Institute to explore community partnerships, program collaboration, grant opportunities, and technology-for-impact initiatives.
            </p>
            <Link
              to="/contact"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-[#02120a] transition hover:bg-emerald-400"
            >
              Contact the Institute
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mx-auto mt-7 max-w-2xl text-xs leading-5 text-emerald-100/38">
              Public charity and federal tax-exempt status should be described in accordance with the organization&apos;s completed formation and IRS determination documents.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Institute;
