import React from 'react';
import { ArrowRight, Command } from 'lucide-react';
import { Link } from 'react-router-dom';
import SmartLaunchLink from '@/components/SmartLaunchLink';
import { cn } from '@/lib/utils';

interface HomepageCTAGroupProps {
  className?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  secondaryTo?: string;
}

/**
 * Canonical homepage CTA hierarchy for RC1.
 *
 * Primary: launch or resume the authenticated D3VONN.IO experience.
 * Secondary: explore the public platform without authentication.
 */
const HomepageCTAGroup = ({
  className,
  primaryLabel = 'Enter D3VONN.IO',
  secondaryLabel = 'Explore the platform',
  secondaryTo = '/solutions',
}: HomepageCTAGroupProps) => (
  <div className={cn('flex flex-col gap-3 sm:flex-row', className)}>
    <SmartLaunchLink
      authedTo="/app"
      className="d3-command-surface inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-3 font-semibold text-white shadow-[0_0_38px_rgba(37,126,255,0.45)] transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#010611]"
    >
      <Command className="h-4 w-4" aria-hidden="true" />
      {primaryLabel}
    </SmartLaunchLink>

    <Link
      to={secondaryTo}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-200/20 bg-white/[0.035] px-6 py-3 font-semibold text-blue-50 backdrop-blur transition hover:border-blue-200/40 hover:bg-blue-300/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#010611]"
    >
      {secondaryLabel}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  </div>
);

export default HomepageCTAGroup;
