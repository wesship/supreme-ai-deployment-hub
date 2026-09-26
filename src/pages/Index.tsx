import React from 'react';
import { Helmet } from 'react-helmet-async';
import KnowledgeGraphOS from './KnowledgeGraphOS';

/**
 * Canonical D3VONN.IO frontend entry.
 *
 * The public root is now the repository-native Neural Nexus / Knowledge Graph
 * experience. No Readdy runtime or project dependency is required.
 */
const Index: React.FC = () => (
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
        content="Operate D3VONN through the Neural Nexus: a live, governed knowledge graph connected to Hermes execution."
      />
      <meta property="og:url" content="https://d3vonn.io/" />
      <link rel="canonical" href="https://d3vonn.io/" />
    </Helmet>
    <KnowledgeGraphOS />
  </>
);

export default Index;
