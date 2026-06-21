import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Clock, ExternalLink } from 'lucide-react';

const RAILWAY_URL = 'https://devonn-ai-api-production.up.railway.app';

interface ServiceStatus {
  name: string;
  url: string;
  status: 'checking' | 'online' | 'degraded' | 'offline';
}

const LiveDeploymentBanner: React.FC = () => {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Frontend', url: 'https://d3vonn.io', status: 'online' },
    { name: 'API', url: RAILWAY_URL, status: 'checking' },
    { name: 'Database', url: '', status: 'online' },
    { name: 'Hermes', url: '', status: 'checking' },
  ]);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  useEffect(() => {
    let cancelled = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const checkHealth = async () => {
      let nextStatus: ServiceStatus['status'] = 'offline';
      try {
        const res = await fetch(`${RAILWAY_URL}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          nextStatus = data?.status === 'ok' ? 'online' : 'degraded';
          failures = 0;
        } else {
          nextStatus = 'degraded';
          failures += 1;
        }
      } catch {
        // Network/timeout — Railway service is unreachable. Mark offline and back off.
        nextStatus = 'offline';
        failures += 1;
      }

      if (cancelled) return;
      setServices(prev => prev.map(s => {
        if (s.name === 'API' || s.name === 'Hermes') return { ...s, status: nextStatus };
        return s;
      }));
      setLastChecked(new Date());

      // Adaptive polling: 30s normally, back off to 5min after 3 consecutive failures
      const delay = failures >= 3 ? 5 * 60 * 1000 : 30 * 1000;
      timer = setTimeout(checkHealth, delay);
    };

    checkHealth();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const allOnline = services.every(s => s.status === 'online');
  const anyOffline = services.some(s => s.status === 'offline');

  const statusColor = allOnline ? '#00FF41' : anyOffline ? '#EF4444' : '#F59E0B';
  const statusText = allOnline ? 'All systems operational' : anyOffline ? 'Service disruption' : 'Partial degradation';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      className="w-full border-b border-border/50 bg-black/80 backdrop-blur-sm"
    >
      <div className="container max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4 flex-wrap">
        {/* Overall status */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: statusColor }} />
          <span className="text-xs font-mono" style={{ color: statusColor }}>{statusText}</span>
        </div>

        {/* Individual service statuses */}
        <div className="flex items-center gap-4 flex-wrap">
          {services.map(service => (
            <div key={service.name} className="flex items-center gap-1.5">
              {service.status === 'checking' ? (
                <Clock className="w-3 h-3 text-yellow-500 animate-spin" />
              ) : service.status === 'online' ? (
                <CheckCircle className="w-3 h-3 text-[#00FF41]" />
              ) : (
                <AlertCircle className="w-3 h-3 text-red-500" />
              )}
              <span className="text-xs text-gray-400 font-mono">{service.name}</span>
            </div>
          ))}
        </div>

        {/* Last checked */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 font-mono">
            Updated {lastChecked.toLocaleTimeString()}
          </span>
          <a
            href="https://devonn-ai-api-production.up.railway.app/health/deep"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-400 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </motion.div>
  );
};

export default LiveDeploymentBanner;
