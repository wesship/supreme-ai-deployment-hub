import ComingSoonPage from '@/components/ComingSoonPage';

const AITherapy = () => (
  <ComingSoonPage
    title="AI Therapy"
    description="A 4-level avatar therapy and wellness coaching experience with clinical-grade safety monitoring."
    roadmap={[
      'Tiered avatar therapists (L1–L4) with escalation logic',
      'Voice-first sessions with live STT/TTS',
      'Clinical safety monitor with crisis routing',
      'Private session journal and progress tracking',
    ]}
  />
);

export default AITherapy;
