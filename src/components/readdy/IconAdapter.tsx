import type { AriaAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  Bot,
  Check,
  Clapperboard,
  Cloud,
  Cpu,
  Database,
  FileText,
  Film,
  Keyboard,
  Lock,
  Mic,
  Monitor,
  Network,
  Palette,
  Play,
  Quote,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Volume2,
  WandSparkles,
  Workflow,
} from 'lucide-react';

/**
 * Local replacement for the source export's Remix icon class names.
 * Keeping this map at the presentation boundary avoids an icon-font CDN and
 * makes each V90 visual independently accessible to the application bundle.
 */
const icons = {
  arrow: ArrowRight,
  agents: Bot,
  cloud: Cloud,
  cpu: Cpu,
  database: Database,
  document: FileText,
  film: Film,
  keyboard: Keyboard,
  lock: Lock,
  mic: Mic,
  monitor: Monitor,
  network: Network,
  palette: Palette,
  play: Play,
  quote: Quote,
  radio: Radio,
  research: Search,
  shield: ShieldCheck,
  sound: Volume2,
  sparkles: Sparkles,
  story: WandSparkles,
  user: UserRoundCheck,
  workflow: Workflow,
  clapperboard: Clapperboard,
  check: Check,
} satisfies Record<string, LucideIcon>;

export type ReaddyIconName = keyof typeof icons;

interface ReaddyIconProps {
  name: ReaddyIconName;
  className?: string;
  'aria-hidden'?: AriaAttributes['aria-hidden'];
}

export default function ReaddyIcon({ name, className, ...props }: ReaddyIconProps) {
  const Icon = icons[name];
  return <Icon className={className} {...props} />;
}
