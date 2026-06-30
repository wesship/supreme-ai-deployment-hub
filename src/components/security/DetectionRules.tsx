/**
 * DetectionRules — Display configured detection rules and their status
 */

import React, { useEffect, useState } from "react";
import { Lock, CheckCircle, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface DetectionRule {
  id: string;
  name: string;
  description?: string;
  event_type: string;
  threshold: number;
  window_seconds: number;
  severity: string;
  enabled: boolean;
}

const severityColors: Record<string, string> = {
  critical: "bg-red-500/20 text-red-300 border-red-500/50",
  high: "bg-orange-500/20 text-orange-300 border-orange-500/50",
  medium: "bg-amber-500/20 text-amber-300 border-amber-500/50",
  low: "bg-blue-500/20 text-blue-300 border-blue-500/50",
};

export const DetectionRules: React.FC = () => {
  const [rules, setRules] = useState<DetectionRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/security/rules`);
        if (res.ok) {
          const data = await res.json();
          setRules(data);
        }
      } catch (err) {
        console.error("Failed to fetch detection rules:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRules();
  }, []);

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <Lock className="w-4 h-4 text-green-400" />
          Detection Rules
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-gray-500 py-8">Loading rules...</p>
        ) : rules.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            No detection rules configured.
          </p>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {rule.enabled ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-500" />
                      )}
                      <span className="text-sm font-medium text-white">
                        {rule.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={severityColors[rule.severity] || ""}
                      >
                        {rule.severity}
                      </Badge>
                    </div>
                    {rule.description && (
                      <p className="text-xs text-gray-400 mt-1 ml-6">
                        {rule.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 ml-6">
                      <span className="text-xs text-gray-500">
                        <code className="text-gray-400">{rule.event_type}</code>
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {rule.threshold} events / {rule.window_seconds}s
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      rule.enabled
                        ? "border-green-700 text-green-400"
                        : "border-gray-700 text-gray-500"
                    }
                  >
                    {rule.enabled ? "Active" : "Disabled"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
