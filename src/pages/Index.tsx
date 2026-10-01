import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import SovereignSignalHomepage from '@/components/sovereign/SovereignSignalHomepage';
import {
  defaultHomepageTelemetry,
  fetchHomepageTelemetry,
  type HomepageTelemetry,
} from '@/lib/homepageTelemetry';

/**
 * Canonical D3VONN.IO public frontend entry.
 *
 * The presentation layer follows the approved Sovereign Signal direction from
 * the current Readdy project. Application authority remains repository-native:
 * auth, APIs, Hermes execution, protected routes, security, voice, and
 * deployment stay outside this presentation component.
 */
const Index: React.FC = () => {
  const [telemetry, setTelemetry] = useState<HomepageTelemetry>(defaultHomepageTelemetry);

  useEffect(() => {
    const controller = new AbortController();

    void fetchHomepageTelemetry(controller.signal).then(setTelemetry);

    return () => controller.abort();
  }, []);

  return (
    <>
      <Helmet>
        <title>D3VONN.IO — Sovereign AI Operating System</title>
        <meta
          name="description"
          content="D3VONN.IO is a sovereign, voice-engageable AI operating system for commanding Hermes, agents, knowledge, creative systems, workflows, infrastructure, security, and operations from one governed intelligence layer."
        />
        <meta property="og:title" content="D3VONN.IO — Sovereign AI Operating System" />
        <meta
          property="og:description"
          content="Intelligence under your command: Hermes, AI agents, voice, films, knowledge, workflows, infrastructure, and operations in one governed platform."
        />
        <meta property="og:url" content="https://d3vonn.io/" />
        <link rel="canonical" href="https://d3vonn.io/" />
      </Helmet>

      <SovereignSignalHomepage telemetry={telemetry} />
    </>
  );
};

export default Index;
