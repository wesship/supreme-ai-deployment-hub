import React, { Suspense, useEffect, useState } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import Navbar from '@/components/Navbar';
import V90Homepage from '@/components/readdy/V90Homepage';
import HermesOrchestrationDemo from '@/components/home/HermesOrchestrationDemo';
import KnowledgeGraphPreview from '@/components/home/KnowledgeGraphPreview';
import MarketplacePreview from '@/components/home/MarketplacePreview';
import TrustCenterPreview from '@/components/home/TrustCenterPreview';
import PlatformVideosSection from '@/components/home/PlatformVideosSection';
import HomepageShell from '@/components/homepage/HomepageShell';
import {
  defaultHomepageTelemetry,
  fetchHomepageTelemetry,
  type HomepageTelemetry,
} from '@/lib/homepageTelemetry';
import '@/styles/readdy-v90.css';

/**
 * Canonical public telemetry remains independent of the Readdy V90 presentation.
 * The abort and fallback path are intentionally retained so the homepage never
 * implies a remote value when the public stats endpoint is unavailable.
 */
const useHomepageTelemetry = () => {
  const [telemetry, setTelemetry] = useState<HomepageTelemetry>(defaultHomepageTelemetry);

  useEffect(() => {
    const controller = new AbortController();

    fetchHomepageTelemetry(controller.signal).then((value) => {
      if (!controller.signal.aborted) setTelemetry(value);
    });

    return () => controller.abort();
  }, []);

  return telemetry;
};

const GovernedIntegrationsSection: React.FC = () => (
  <section className="relative overflow-hidden bg-[#010611] py-24 sm:py-32" aria-labelledby="governed-integrations-heading">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(37,126,255,0.14),transparent_42%)]" aria-hidden="true" />
    <div className="container relative mx-auto px-4 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-300/65">Canonical D3VONN platform surfaces</p>
        <h2 id="governed-integrations-heading" className="mt-5 text-balance text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
          Governed intelligence, connected to the real platform.
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-blue-50/60">
          These working previews remain canonical D3VONN integrations. Their underlying authority, data controls, and access policies are not supplied by the V90 presentation layer.
        </p>
      </div>

      <div className="mt-14 grid gap-5 xl:grid-cols-2">
        <Suspense fallback={<div className="min-h-[360px] animate-pulse rounded-2xl border border-blue-200/15 bg-blue-400/[0.04]" />}>
          <HermesOrchestrationDemo />
        </Suspense>
        <Suspense fallback={<div className="min-h-[360px] animate-pulse rounded-2xl border border-blue-200/15 bg-blue-400/[0.04]" />}>
          <KnowledgeGraphPreview />
        </Suspense>
        <Suspense fallback={<div className="min-h-[360px] animate-pulse rounded-2xl border border-blue-200/15 bg-blue-400/[0.04]" />}>
          <MarketplacePreview />
        </Suspense>
        <Suspense fallback={<div className="min-h-[360px] animate-pulse rounded-2xl border border-blue-200/15 bg-blue-400/[0.04]" />}>
          <TrustCenterPreview />
        </Suspense>
      </div>
    </div>
  </section>
);

const Index: React.FC = () => {
  const telemetry = useHomepageTelemetry();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 90, damping: 26, restDelta: 0.001 });

  return (
    <HomepageShell>
      <Helmet>
        <title>D3VONN.IO — The AI Business Operating System</title>
        <meta
          name="description"
          content="D3VONN.IO is the AI Business Operating System: intelligent agents, automation, knowledge, voice and vision, marketplace and an operator command center, orchestrated by Hermes."
        />
        <meta property="og:title" content="D3VONN.IO — The AI Business Operating System" />
        <meta
          property="og:description"
          content="One Platform, Infinite Intelligence. Orchestrate agents, automation, knowledge and operations from one governed control plane."
        />
        <meta property="og:url" content="https://d3vonn.io/" />
        <link rel="canonical" href="https://d3vonn.io/" />
      </Helmet>

      {/* App's homepage-specific ShellChrome leaves navigation to this page. */}
      <Navbar />

      <motion.div
        className="fixed left-0 right-0 top-0 z-[90] h-[2px] origin-left bg-gradient-to-r from-blue-500 via-cyan-300 to-blue-400"
        style={{ scaleX }}
        aria-hidden="true"
      />

      <div>
        <V90Homepage telemetry={telemetry} />
        <PlatformVideosSection />
        <GovernedIntegrationsSection />
      </div>
    </HomepageShell>
  );
};

export default Index;
