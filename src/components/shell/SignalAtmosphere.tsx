import { lazy, Suspense } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import ReduceMotionToggle from '@/components/sovereign/approved/ReduceMotionToggle';

const ThreeBackground = lazy(() => import('@/components/sovereign/approved/ThreeBackground'));

/** Reuse the approved homepage graph without duplicating its WebGL scene. */
export default function SignalAtmosphere() {
  return (
    <>
      <div className="d3-signal-atmosphere" aria-hidden="true">
        <div className="d3-signal-grid" />
        <ErrorBoundary fallback={<span />}>
          <Suspense fallback={null}><ThreeBackground compact /></Suspense>
        </ErrorBoundary>
        <div className="d3-signal-shade" />
        <div className="d3-signal-grain" />
      </div>
      <div className="d3-signal-motion">
        <ReduceMotionToggle />
      </div>
    </>
  );
}
