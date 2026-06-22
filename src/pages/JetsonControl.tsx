import ComingSoonPage from '@/components/ComingSoonPage';

const JetsonControl = () => (
  <ComingSoonPage
    title="Jetson Control"
    description="Edge AI orchestration for the Jetson smart-glasses cluster and on-device robotics control plane."
    roadmap={[
      'Live device telemetry across the cluster',
      'Over-the-air model and firmware deployment',
      'Vision pipeline composer for on-device inference',
      'Remote command and control with audit trail',
    ]}
  />
);

export default JetsonControl;
