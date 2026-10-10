import { lazy, Suspense } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import ReduceMotionToggle from '@/components/sovereign/approved/ReduceMotionToggle';

const ThreeBackground = lazy(() => import('@/components/sovereign/approved/ThreeBackground'));
const nodes = [[120,160],[280,100],[460,180],[650,80],[850,170],
  [100,380],[300,310],[480,420],[690,300],[910,390],
  [150,600],[340,540],[520,660],[720,540],[880,620]] as const;
const links = [[0,1],[1,2],[2,3],[3,4],[0,5],[1,6],[2,6],[2,8],[3,8],[4,9],
  [5,6],[6,7],[7,8],[8,9],[5,10],[6,11],[7,11],[7,12],[8,13],[9,14],
  [10,11],[11,12],[12,13],[13,14]] as const;

/** Reuse the approved homepage graph without duplicating its WebGL scene. */
export default function SignalAtmosphere() {
  return (
    <>
      <div className="d3-signal-atmosphere" aria-hidden="true">
        <div className="d3-signal-grid" />
        <svg className="d3-signal-network" viewBox="0 0 1000 760" fill="none">
          <g stroke="#4da8ff" strokeWidth="1">
            {links.map(([from,to]) => <path key={`${from}-${to}`} d={`M${nodes[from][0]} ${nodes[from][1]}L${nodes[to][0]} ${nodes[to][1]}`} />)}
            <circle cx="500" cy="380" r="150" strokeDasharray="4 12" />
            <ellipse cx="500" cy="380" rx="150" ry="55" />
            <ellipse cx="500" cy="380" rx="55" ry="150" />
          </g>
          <g fill="#6ff0ff">
            {nodes.map(([cx,cy],i) => <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 3 : 2} />)}
            <circle className="d3-signal-core" cx="500" cy="380" r="8" />
          </g>
        </svg>
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
