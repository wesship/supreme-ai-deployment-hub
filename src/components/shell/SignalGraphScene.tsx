import { ErrorBoundary } from '@/components/ErrorBoundary';
import DecorativeGraph from '@/components/sovereign/approved/DecorativeGraph';

/** Keep graph monitoring with the scene, outside Film's opaque backdrop. */
export default function SignalGraphScene() {
  return <ErrorBoundary fallback={<span />}><DecorativeGraph compact /></ErrorBoundary>;
}
