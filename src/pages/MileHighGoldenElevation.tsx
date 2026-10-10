import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Diamond,
  Gem,
  Heart,
  MapPin,
  Recycle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const PAGE_URL = 'https://www.d3vonn.io/mile-high-golden-elevation';
const CONSULTATION_URL = '/contact?inquiry=mile-high-golden-elevation';

const collections = [
  {
    title: 'Engagement',
    description: 'Personal guidance for natural or lab-grown diamonds and a setting shaped around your story.',
    icon: Heart,
    inquiry: 'Discuss an engagement piece',
  },
  {
    title: 'Fine jewelry',
    description: 'Considered pieces in gold, platinum, diamonds, and colored gemstones for meaningful occasions.',
    icon: Gem,
    inquiry: 'Explore fine jewelry',
  },
  {
    title: 'Custom and heirloom',
    description: 'A collaborative path from an idea, sketch, or heirloom to a distinctive one-of-one design.',
    icon: Sparkles,
    inquiry: 'Start a custom consultation',
  },
] as const;

const launchStatus = [
  ['Private inquiries', 'Available now'],
  ['Product catalog', 'In development'],
  ['Live inventory and pricing', 'Not yet published'],
  ['Online checkout', 'Not yet enabled'],
] as const;

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Mile High Golden Elevation LLC',
  url: PAGE_URL,
  founder: { '@type': 'Person', name: 'Wesley K. Little' },
  areaServed: { '@type': 'City', name: 'Denver' },
  description:
    'A Denver fine-jewelry company focused on handcrafted pieces, responsibly sourced precious metals, custom design, and private consultation.',
};

export default function MileHighGoldenElevation() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#080704] text-[#f8f3e8]">
      <Helmet>
        <title>Mile High Golden Elevation | Denver Fine Jewelry</title>
        <meta
          name="description"
          content="Discover Mile High Golden Elevation, a Denver fine-jewelry company focused on handcrafted pieces, responsible materials, custom design, and private consultation."
        />
        <link rel="canonical" href={PAGE_URL} />
        <meta property="og:title" content="Mile High Golden Elevation | Denver Fine Jewelry" />
        <meta
          property="og:description"
          content="Handcrafted fine jewelry, responsible materials, custom design, and private consultation from Denver."
        />
        <meta property="og:url" content={PAGE_URL} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <section className="relative isolate border-b border-amber-100/10">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_72%_22%,rgba(217,176,90,0.2),transparent_28%),radial-gradient(circle_at_14%_78%,rgba(255,255,255,0.055),transparent_30%)]"
        />
        <div aria-hidden="true" className="absolute -right-28 top-20 -z-10 h-80 w-80 rotate-45 rounded-[4rem] border border-amber-200/10" />
        <div className="mx-auto grid max-w-7xl gap-16 px-6 py-20 lg:grid-cols-[1.25fr_0.75fr] lg:px-8 lg:py-28">
          <div className="max-w-4xl">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.32em] text-amber-200/80">
              <MapPin className="h-4 w-4" aria-hidden="true" /> Denver, Colorado
            </p>
            <h1 className="mt-8 font-serif text-5xl leading-[0.94] tracking-[-0.045em] sm:text-7xl lg:text-[6.8rem]">
              Jewelry with a
              <span className="block text-amber-200">higher standard.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-[#d6cdbc] sm:text-xl">
              Mile High Golden Elevation is an independent Denver jewelry company founded by Wesley K. Little—built around personal service, handcrafted expression, and responsibly sourced precious metals.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to={{ hash: '#collections' }}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-amber-200 px-6 py-3 text-sm font-semibold text-[#171005] transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
              >
                Explore the house <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to={CONSULTATION_URL}
                className="inline-flex min-h-12 items-center gap-2 rounded-full border border-amber-100/25 px-6 py-3 text-sm font-semibold transition hover:border-amber-100/50 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
              >
                Request a private consultation
              </Link>
            </div>
          </div>

          <aside className="self-end rounded-[2rem] border border-amber-100/15 bg-black/25 p-7 backdrop-blur-sm" aria-label="Relaunch status">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200/75">Relaunch status</p>
            <dl className="mt-6 divide-y divide-white/10">
              {launchStatus.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-5 py-4 text-sm">
                  <dt className="text-[#bdb3a3]">{label}</dt>
                  <dd className="text-right font-medium text-[#f8f3e8]">{value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>

      <section id="collections" className="scroll-mt-24 mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/70">The house</p>
          <h2 className="mt-5 font-serif text-4xl leading-tight sm:text-6xl">Made personal from the first conversation.</h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#bdb3a3]">
            The relaunch begins with consultation-led service. Each inquiry is handled as a conversation—not as a claim that a live catalog, price, or stone is already available.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {collections.map(({ title, description, icon: Icon, inquiry }) => (
            <article key={title} className="group flex min-h-[22rem] flex-col rounded-3xl border border-white/10 bg-white/[0.035] p-7 transition hover:-translate-y-1 hover:border-amber-200/30 hover:bg-white/[0.055]">
              <Icon className="h-8 w-8 text-amber-200" strokeWidth={1.4} aria-hidden="true" />
              <h3 className="mt-12 font-serif text-3xl">{title}</h3>
              <p className="mt-4 flex-1 leading-7 text-[#bdb3a3]">{description}</p>
              <Link to={CONSULTATION_URL} className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-amber-200 underline-offset-4 hover:underline">
                {inquiry} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200/20 bg-emerald-200/[0.06]">
              <Recycle className="h-6 w-6 text-emerald-200" aria-hidden="true" />
            </div>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200/70">Responsible by design</p>
            <h2 className="mt-5 font-serif text-4xl leading-tight sm:text-5xl">Craft and circular ambition.</h2>
            <p className="mt-6 max-w-xl leading-8 text-[#bdb3a3]">
              Responsibly sourced precious metals are a core brand standard. Mile High Golden Elevation is also developing a separate circular-gold initiative around qualified e-waste recovery and verified refining.
            </p>
            <p className="mt-4 max-w-xl rounded-2xl border border-emerald-100/10 bg-emerald-100/[0.035] p-4 text-sm leading-6 text-emerald-50/65">
              This initiative remains in development. The page does not represent recovered material, a refining partner, or an e-waste supply agreement as active inventory.
            </p>
          </div>

          <div className="rounded-[2rem] border border-amber-100/15 bg-[#0d0b07] p-8 sm:p-10">
            <div className="flex items-center gap-3">
              <Diamond className="h-6 w-6 text-amber-200" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200/75">Diamond concierge</p>
            </div>
            <h2 className="mt-6 font-serif text-4xl">Find the stone. Shape the story.</h2>
            <p className="mt-5 leading-8 text-[#bdb3a3]">
              Consultation can begin with shape, carat, color, clarity, budget, and natural or lab-grown preference. Certification and availability must be verified before any recommendation becomes an offer.
            </p>
            <ul className="mt-8 space-y-4 text-sm text-[#d6cdbc]">
              {[
                'Natural and lab-grown preferences supported',
                'Certification-first product review',
                'Private custom-design conversation',
                'Supplier search and pricing verified before an offer',
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-8 border-t border-white/10 pt-6 text-xs leading-5 text-[#8f877a]">
              Nivoda connectivity is integration-ready but not live. No supplier inventory, price, certificate, reservation, or fulfillment promise is presented until verified credentials and commercial terms are active.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
        <div className="rounded-[2rem] border border-amber-100/15 bg-[radial-gradient(circle_at_top_right,rgba(217,176,90,0.18),transparent_42%),rgba(255,255,255,0.035)] p-8 sm:p-12 lg:p-16">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/75">Begin with a conversation</p>
          <h2 className="mt-5 max-w-4xl font-serif text-4xl leading-tight sm:text-6xl">Tell us what the piece should mean.</h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#bdb3a3]">
            Share the occasion, style, material, timeline, and budget range. The consultation form carries your Mile High Golden Elevation inquiry into D3VONN.IO’s existing contact workflow.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <Link to={CONSULTATION_URL} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-amber-200 px-6 py-3 text-sm font-semibold text-[#171005] transition hover:bg-amber-100">
              Request a consultation <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <span className="inline-flex min-h-12 items-center rounded-full border border-white/15 px-6 py-3 text-sm text-[#a69d90]">
              MileHighGoldenElevation.com relaunch pending
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
