import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import {
  Film, DollarSign, Brain, Crown, Music, Network,
  TrendingUp, Glasses, LogOut, Sparkles, ArrowRight,
} from 'lucide-react';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import AppShell from '@/components/app/AppShell';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/login');
      } else {
        setUser(session.user);
      }
    });
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
    toast.success('Logged out successfully');
  };

  const features = [
    { icon: Film, title: 'AI Filmmaker', description: 'Create 4K films from ideas', path: '/film', available: true },
    { icon: DollarSign, title: 'MoneyHub', description: '100+ earning agents', path: '/moneyhub', available: true },
    { icon: Brain, title: 'AI Therapy', description: '4-level avatar therapy', path: '/ai-therapy', available: true },
    { icon: Crown, title: 'Sovereignty Matrix', description: 'O.P.I. scoring system', path: '/sovereignty', available: true },
    { icon: Music, title: 'Music Generator', description: 'Full AI songs with lyrics', path: '/music', available: true },
    { icon: Network, title: 'Workflows', description: '1100+ n8n templates', path: '/workflows', available: true },
    { icon: TrendingUp, title: 'Backtesting', description: 'Trading strategy analysis', path: '/backtesting', available: true },
    { icon: Glasses, title: 'Jetson Control', description: 'Smart glasses cluster', path: '/jetson-control', available: true },
  ];

  return (
    <AppShell>
      <div className="min-h-screen bg-[radial-gradient(circle_at_70%_0%,rgba(112,128,255,0.14),transparent_36%),linear-gradient(180deg,#02030a_0%,#070817_100%)] text-foreground">
        <D3vonnPageBanner title="D3VONN.IO Dashboard" />

        <div className="border-b border-white/10 bg-black/35 backdrop-blur-xl">
          <div className="container mx-auto px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_20px_rgba(112,128,255,0.25)]">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Authenticated workspace</p>
                  <h1 className="truncate text-xl font-black tracking-tight text-white sm:text-2xl">D3VONN.IO Ecosystem Hub</h1>
                </div>
              </div>

              <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-end">
                <span className="min-w-0 truncate text-xs text-white/55 sm:max-w-[220px]" title={user?.email ?? ''}>
                  {user?.email ?? 'Signed in'}
                </span>
                <Button onClick={handleLogout} variant="outline" size="sm" className="min-h-11 shrink-0">
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>

        <main className="container mx-auto px-4 py-8 sm:px-6 sm:py-12" aria-labelledby="ecosystem-heading">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="d3-titanium-panel relative overflow-hidden p-6 sm:p-8 lg:p-10"
          >
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(37,135,255,0.18),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent_38%)]" />
            <div className="relative z-10 max-w-3xl">
              <div className="d3-system-status">Workspace active</div>
              <p className="d3-kicker mt-6">Command Deck</p>
              <h2 id="ecosystem-heading" className="d3-display-title mt-3 text-4xl font-black text-white sm:text-5xl">
                AI Ecosystem Hub
              </h2>
              <p className="d3-section-copy mt-4 max-w-2xl text-sm sm:text-base">
                Open specialized D3VONN.IO workspaces from one authenticated command surface without changing the underlying product flows.
              </p>
            </div>
          </motion.section>

          <section className="mt-8" aria-labelledby="workspace-grid-heading">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="d3-kicker">Available modules</p>
                <h2 id="workspace-grid-heading" className="mt-2 text-2xl font-bold text-white">Choose a workspace</h2>
              </div>
              <span className="hidden text-xs text-white/45 sm:block">{features.length} modules</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.path}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.25) }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (feature.available) {
                          navigate(feature.path);
                        } else {
                          toast.info('Coming soon! Building features one by one.');
                        }
                      }}
                      disabled={!feature.available}
                      className="d3-command-surface d3-chrome-panel group relative flex h-full min-h-[190px] w-full flex-col rounded-2xl p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 sm:p-6"
                      aria-label={`Open ${feature.title}`}
                    >
                      {!feature.available && (
                        <span className="absolute right-3 top-3 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-widest text-white/50">
                          Soon
                        </span>
                      )}

                      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary transition-transform duration-200 motion-safe:group-hover:-translate-y-0.5">
                        <Icon className="h-6 w-6" aria-hidden="true" />
                      </div>

                      <h3 className="mt-5 text-lg font-bold text-white">{feature.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-white/55">{feature.description}</p>

                      <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-xs font-semibold text-primary">
                        Open workspace <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    </AppShell>
  );
};

export default Dashboard;
