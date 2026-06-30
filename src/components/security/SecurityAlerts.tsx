/**
 * SecurityAlerts — Alert feed with status management
 */

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface Alert {
  id: string;
  created_at: string;
  rule_id: string;
  title: string;
  description?: string;
  severity: string;
  status: string;
  actor?: string;
  ip?: string;
  evidence: any[];
  resolved_at?: string;
  resolved_by?: string;
}

interface SecurityAlertsProps {
  alerts: Alert[];
  onRefresh: () => void;
}

const severityColors: Record<string, string> = {
  critical: "bg-red-500/20 text-red-300 border-red-500/50",
  high: "bg-orange-500/20 text-orange-300 border-orange-500/50",
  medium: "bg-amber-500/20 text-amber-300 border-amber-500/50",
  low: "bg-blue-500/20 text-blue-300 border-blue-500/50",
};

const statusIcons: Record<string, React.ReactNode> = {
  open: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  acknowledged: <Clock className="w-4 h-4 text-blue-400" />,
  investigating: <Shield className="w-4 h-4 text-purple-400" />,
  resolved: <CheckCircle className="w-4 h-4 text-green-400" />,
  false_positive: <XCircle className="w-4 h-4 text-gray-400" />,
};

export const SecurityAlerts: React.FC<SecurityAlertsProps> = ({
  alerts,
  onRefresh,
}) => {
  const [updating, setUpdating] = useState<string | null>(null);

  const updateAlertStatus = async (alertId: string, status: string) => {
    setUpdating(alertId);
    try {
      const res = await fetch(`${API_BASE}/api/security/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error("Failed to update alert:", err);
    } finally {
      setUpdating(null);
    }
  };

  if (!alerts || alerts.length === 0) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-8 text-center">
          <Shield className="w-12 h-12 text-green-400 mx-auto mb-3 opacity-60" />
          <p className="text-gray-400">No active alerts. Systems nominal.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Security Alerts ({alerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {statusIcons[alert.status] || statusIcons.open}
                  <span className="text-sm font-medium text-white truncate">
                    {alert.title}
                  </span>
                </div>
                {alert.description && (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                    {alert.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <Badge
                    variant="outline"
                    className={severityColors[alert.severity] || ""}
                  >
                    {alert.severity}
                  </Badge>
                  {alert.actor && (
                    <span className="text-xs text-gray-500 font-mono">
                      {alert.actor}
                    </span>
                  )}
                  {alert.ip && (
                    <span className="text-xs text-gray-500 font-mono">
                      {alert.ip}
                    </span>
                  )}
                  <span className="text-xs text-gray-600">
                    {new Date(alert.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {alert.status === "open" && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-blue-400 hover:bg-blue-900/20"
                      onClick={() =>
                        updateAlertStatus(alert.id, "acknowledged")
                      }
                      disabled={updating === alert.id}
                    >
                      Ack
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-green-400 hover:bg-green-900/20"
                      onClick={() => updateAlertStatus(alert.id, "resolved")}
                      disabled={updating === alert.id}
                    >
                      Resolve
                    </Button>
                  </>
                )}
                {alert.status === "acknowledged" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-purple-400 hover:bg-purple-900/20"
                    onClick={() =>
                      updateAlertStatus(alert.id, "investigating")
                    }
                    disabled={updating === alert.id}
                  >
                    Investigate
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
