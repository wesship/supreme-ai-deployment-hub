import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import Navbar from '@/components/Navbar';
import HomepageShell from '@/components/home/HomepageShell';
import V90Homepage from '@/components/readdy/V90Homepage';
import {
  defaultHomepageTelemetry,
  fetchHomepageTelemetry,
  type HomepageTelemetry,
} from '@/lib/homepageTelemetry';
import '@/styles/readdy-v90.css';

/**
 * Canonical D3VONN.IO public frontend entry.
 *
 * The visual presentation is the repository-local adaptation of the approved
 * Readdy project export. Application authority stays repository-native: auth,
 * APIs, Hermes execution, protected routes, security, and deployment remain
 * outside the presentation component.
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
        <title>D3VONN.IO — AI Business Operating System</title>
        <meta
          name="description"
          content="D3VONN.IO is a voice-engageable AI Business Operating System for orchestrating agents, knowledge, tools, workflows, infrastructure, security, and operations through Hermes."
        />
        <meta property="og:title" content="D3VONN.IO — AI Business Operating System" />
        <meta
          property="og:description"
          content="Operate D3VONN through one governed command layer connecting Hermes, agents, knowledge, workflows, voice, and infrastructure."
        />
        <meta property="og:url" content="https://d3vonn.io/" />
        <link rel="canonical" href="https://d3vonn.io/" />
      </Helmet>

      <Navbar transparent />
      <HomepageShell className="readdy-v90-shell">
        <V90Homepage telemetry={telemetry} />
      </HomepageShell>
    </>
  );
};

export default Index;
