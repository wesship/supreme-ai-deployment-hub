import { ArrowRight, Gem, Heart, Sparkles, ShieldCheck, Diamond } from "lucide-react";
import { Link } from "react-router-dom";

const collections = [
  { title: "Engagement", text: "Exceptional stones and settings for the moment that changes everything.", icon: Heart },
  { title: "Fine Jewelry", text: "Elevated pieces in gold, platinum, diamonds, and colored gemstones.", icon: Gem },
  { title: "Custom", text: "Bring an idea, sketch, heirloom, or inspiration. We help turn it into a one-of-one piece.", icon: Sparkles },
];

const promises = [
  "Natural and lab-grown diamond sourcing",
  "Certification-first product information",
  "Private consultation and custom design",
  "Live supplier inventory integration planned through Nivoda",
];

export default function MileHighGoldenElevation() {
  return (
    <div className="min-h-screen bg-[#090806] text-white">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(214,168,77,0.18),transparent_34%),radial-gradient(circle_at_15%_80%,rgba(255,255,255,0.06),transparent_28%)]" />
        <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-16 lg:px-8 lg:pb-32 lg:pt-24">
          <div className="max-w-3xl">
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.38em] text-amber-300/80">Mile High Golden Elevation LLC</p>
            <h1 className="font-serif text-5xl leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">FINE JEWELRY<br /><span className="text-amber-200/90">Worth Elevating.</span></h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-white/65 sm:text-xl">A new chapter for a Denver fine-jewelry brand — built around personal service, custom craftsmanship, and smarter access to exceptional diamonds and gemstones.</p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="#collections" className="inline-flex items-center gap-2 rounded-full bg-amber-200 px-6 py-3 text-sm font-semibold text-black transition hover:bg-amber-100">Explore the collection <ArrowRight className="h-4 w-4" /></Link>
              <Link to="#consultation" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Private consultation</Link>
            </div>
          </div>
        </div>
      </section>

      <section id="collections" className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300/70">The House</p>
          <h2 className="mt-4 font-serif text-4xl sm:text-5xl">Designed for pieces that become part of your story.</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {collections.map(({ title, text, icon: Icon }) => (
            <article key={title} className="group rounded-3xl border border-white/10 bg-white/[0.035] p-7 transition hover:-translate-y-1 hover:border-amber-200/30 hover:bg-white/[0.055]">
              <Icon className="h-7 w-7 text-amber-200" strokeWidth={1.5} />
              <h3 className="mt-12 font-serif text-3xl">{title}</h3>
              <p className="mt-4 leading-7 text-white/55">{text}</p>
              <span className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-amber-200">Discover <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[1fr_1.1fr] lg:px-8 lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300/70">The Diamond Concierge</p>
            <h2 className="mt-4 font-serif text-4xl sm:text-5xl">Find the stone. Then make it yours.</h2>
            <p className="mt-6 max-w-xl leading-8 text-white/60">The relaunch is designed to combine expert jewelry guidance with modern sourcing technology. Customers will be able to search by shape, carat, color, clarity, budget, and natural or lab-grown preference.</p>
          </div>
          <div className="rounded-3xl border border-amber-200/15 bg-black/30 p-7">
            <div className="flex items-center gap-3"><Diamond className="h-5 w-5 text-amber-200" /><span className="text-sm font-semibold">Sourcing architecture</span></div>
            <div className="mt-6 space-y-4">
              {promises.map((promise) => (
                <div key={promise} className="flex gap-3 text-sm leading-6 text-white/65"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-200/80" />{promise}</div>
              ))}
            </div>
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-5 text-white/45">Nivoda integration is intentionally presented as planned until Mile High Golden Elevation's verified Nivoda credentials and commercial account are connected. No inventory or pricing is represented as live on this page.</div>
          </div>
        </div>
      </section>

      <section id="consultation" className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
        <div className="rounded-[2rem] border border-amber-200/15 bg-[radial-gradient(circle_at_top_right,rgba(214,168,77,0.16),transparent_42%),rgba(255,255,255,0.03)] p-8 sm:p-12 lg:p-16">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300/70">Reopening soon</p>
          <h2 className="mt-4 max-w-3xl font-serif text-4xl sm:text-6xl">Private service. Personal vision. Fine jewelry.</h2>
          <p className="mt-6 max-w-2xl leading-8 text-white/60">The new Mile High Golden Elevation experience is being prepared for online discovery, custom consultations, and a technology-enabled diamond sourcing experience.</p>
          <div className="mt-9 flex flex-wrap gap-4">
            <Link to="/contact" className="inline-flex items-center gap-2 rounded-full bg-amber-200 px-6 py-3 text-sm font-semibold text-black">Request a consultation <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold">Powered by D3VONN.IO</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
