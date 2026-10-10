/**
 * D3VONN Cyber Command Center — Security Dashboard
 *
 * Main security operations page displaying:
 * - Real-time threat statistics
 * - Alert feed with status management
 * - Recent security events timeline
 * - Detection rule status
 * - Hermes agent action log
 */

import React, { useEffect, useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import {
  Shield,
  AlertTriangle,
  Activity,
  Eye,
  Bot,
  RefreshCw,
  Zap,
  Lock,
  Skull,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SecurityAlerts } from "@/components/security/SecurityAlerts";
import { SecurityEvents } from "@/components/security/SecurityEvents";
import { DetectionRules } from "@/components/security/DetectionRules";
import { AgentActions } from "@/components/security/AgentActions";
import { ThreatChart } from "@/components/security/ThreatChart";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface DashboardStats {
  total_events_24h: number;
  open_alerts: number;
  critical_alerts: number;
  active_incidents: number;
  events_by_severity: Record<string, number>;
  top_actors: Array<{ actor: string; count: number }>;
  recent_events: any[];
  recent_alerts: any[];
}

const SecurityDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/security/dashboard`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch security dashboard:", err);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const triggerSweep = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/security/sweep`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        console.log("Sweep completed:", data);
        fetchDashboard();
      }
    } catch (err) {
      console.error("Sweep failed:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#020817] text-white">
      <Helmet>
        <title>Cyber Command Center — D3VONN.IO</title>
        <meta
          name="description"
          content="D3VONN Security Operations Center — real-time threat monitoring, detection, and automated response."
        />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <Shield className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Cyber Command Center
              </h1>
              <p className="text-sm text-gray-400">
                D3VONN Security Operations — Real-time threat detection &
                response
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              Last refresh: {lastRefresh.toLocaleTimeString()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDashboard}
              className="border-gray-700 hover:bg-gray-800"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={triggerSweep}
              className="border-amber-700 text-amber-400 hover:bg-amber-900/20"
            >
              <Zap className="w-4 h-4 mr-1" />
              Run Sweep
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">
                    Events (24h)
                  </p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {stats?.total_events_24h ?? "—"}
                  </p>
                </div>
                <Activity className="w-8 h-8 text-blue-400 opacity-60" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">
                    Open Alerts
                  </p>
                  <p className="text-2xl font-bold text-amber-400 mt-1">
                    {stats?.open_alerts ?? "—"}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-amber-400 opacity-60" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">
                    Critical
                  </p>
                  <p className="text-2xl font-bold text-red-400 mt-1">
                    {stats?.critical_alerts ?? "—"}
                  </p>
                </div>
                <Skull className="w-8 h-8 text-red-400 opacity-60" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">
                    Active Incidents
                  </p>
                  <p className="text-2xl font-bold text-purple-400 mt-1">
                    {stats?.active_incidents ?? "—"}
                  </p>
                </div>
                <Eye className="w-8 h-8 text-purple-400 opacity-60" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Threat Distribution Chart */}
        {stats?.events_by_severity &&
          Object.keys(stats.events_by_severity).length > 0 && (
            <div className="mb-8">
              <ThreatChart data={stats.events_by_severity} />
            </div>
          )}

        {/* Tabbed Content */}
        <Tabs defaultValue="alerts" className="space-y-4">
          <TabsList className="bg-gray-900 border border-gray-800">
            <TabsTrigger
              value="alerts"
              className="data-[state=active]:bg-red-900/30 data-[state=active]:text-red-300"
            >
              <AlertTriangle className="w-4 h-4 mr-1" />
              Alerts
            </TabsTrigger>
            <TabsTrigger
              value="events"
              className="data-[state=active]:bg-blue-900/30 data-[state=active]:text-blue-300"
            >
              <Activity className="w-4 h-4 mr-1" />
              Events
            </TabsTrigger>
            <TabsTrigger
              value="rules"
              className="data-[state=active]:bg-green-900/30 data-[state=active]:text-green-300"
            >
              <Lock className="w-4 h-4 mr-1" />
              Rules
            </TabsTrigger>
            <TabsTrigger
              value="agent"
              className="data-[state=active]:bg-purple-900/30 data-[state=active]:text-purple-300"
            >
              <Bot className="w-4 h-4 mr-1" />
              Agent
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alerts">
            <SecurityAlerts alerts={stats?.recent_alerts || []} onRefresh={fetchDashboard} />
          </TabsContent>

          <TabsContent value="events">
            <SecurityEvents events={stats?.recent_events || []} />
          </TabsContent>

          <TabsContent value="rules">
            <DetectionRules />
          </TabsContent>

          <TabsContent value="agent">
            <AgentActions />
          </TabsContent>
        </Tabs>

        {/* Top Actors */}
        {stats?.top_actors && stats.top_actors.length > 0 && (
          <Card className="mt-8 bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-300">
                Top Actors (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.top_actors.map((actor, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 px-3 bg-gray-800/50 rounded-lg"
                  >
                    <span className="text-sm text-gray-300 font-mono">
                      {actor.actor}
                    </span>
                    <Badge
                      variant="outline"
                      className="border-amber-700 text-amber-400"
                    >
                      {actor.count} events
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SecurityDashboard;
