import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { 
  Film, DollarSign, Brain, Crown, Music, Network, 
  TrendingUp, Glasses, LogOut, Sparkles 
} from 'lucide-react';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
    {
      icon: Film,
      title: 'AI Filmmaker',
      description: 'Create 4K films from ideas',
      path: '/film',
      gradient: 'from-purple-500 to-pink-500',
      available: true,
    },
    {
      icon: DollarSign,
      title: 'MoneyHub',
      description: '100+ earning agents',
      path: '/moneyhub',
      gradient: 'from-green-500 to-emerald-500',
      available: false,
    },
    {
      icon: Brain,
      title: 'AI Therapy',
      description: '4-level avatar therapy',
      path: '/therapy',
      gradient: 'from-blue-500 to-cyan-500',
      available: false,
    },
    {
      icon: Crown,
      title: 'Sovereignty Matrix',
      description: 'O.P.I. scoring system',
      path: '/sovereignty',
      gradient: 'from-yellow-500 to-orange-500',
      available: false,
    },
    {
      icon: Music,
      title: 'Music Generator',
      description: 'Full AI songs with lyrics',
      path: '/music',
      gradient: 'from-pink-500 to-rose-500',
      available: false,
    },
    {
      icon: Network,
      title: 'Workflows',
      description: '1100+ n8n templates',
      path: '/workflows',
      gradient: 'from-indigo-500 to-purple-500',
      available: false,
    },
    {
      icon: TrendingUp,
      title: 'Backtesting',
      description: 'Trading strategy analysis',
      path: '/backtesting',
      gradient: 'from-cyan-500 to-blue-500',
      available: false,
    },
    {
      icon: Glasses,
      title: 'Jetson Control',
      description: 'Smart glasses cluster',
      path: '/jetson',
      gradient: 'from-violet-500 to-purple-500',
      available: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <D3vonnPageBanner title="D3VONN.IO Dashboard" />
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-primary" />
              <h2 className="text-2xl font-bold text-foreground tracking-tight">
                D3VONN.IO
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground text-sm">{user?.email}</span>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-5xl font-bold mb-4 text-foreground">
            AI Ecosystem Hub
          </h2>
          <p className="text-muted-foreground text-lg">
            Your gateway to next-generation AI capabilities
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.path}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <button
                  onClick={() => {
                    if (feature.available) {
                      navigate(feature.path);
                    } else {
                      toast.info('Coming soon! Building features one by one.');
                    }
                  }}
                  className={`relative w-full h-full p-6 rounded-2xl border transition-all duration-300 ${
                    feature.available
                      ? 'border-border bg-card/50 hover:bg-card/70 hover:border-primary/60 hover:scale-105 cursor-pointer'
                      : 'border-border/40 bg-card/30 cursor-not-allowed opacity-60'
                  } backdrop-blur-xl group`}
                >
                  {!feature.available && (
                    <div className="absolute top-3 right-3 bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full border border-border">
                      Soon
                    </div>
                  )}

                  <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/30 p-3 mb-4 group-hover:scale-110 transition-transform">
                    <Icon className="w-full h-full text-primary" />
                  </div>

                  <h3 className="text-xl font-bold text-foreground mb-2">
                    {feature.title}
                  </h3>

                  <p className="text-muted-foreground text-sm">
                    {feature.description}
                  </p>
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
