/**
 * AgentActions — Hermes Security Agent audit trail
 */

import React, { useEffect, useState } from "react";
import { Bot, CheckCircle, XCircle, Clock, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface AgentAction {
  id: string;
  created_at: string;
  alert_id?: string;
  action_type: string;
  parameters: Record<string, any>;
  result: string;
  agent_version: string;
}

const resultIcons: Record<string, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-green-400" />,
  failure: <XCircle className="w-4 h-4 text-red-400" />,
  pending: <Clock className="w-4 h-4 text-amber-400" />,
  skipped: <Zap className="w-4 h-4 text-gray-400" />,
};

const actionTypeLabels: Record<string, string> = {
  block_ip: "Block IP",
  revoke_token: "Revoke Token",
  notify_admin: "Notify Admin",
  quarantine_account: "Quarantine Account",
  escalate_incident: "Escalate Incident",
};

export const AgentActions: React.FC = () => {
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActions = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/security/agent/actions`);
        if (res.ok) {
          const data = await res.json();
          setActions(data.actions || []);
        }
      } catch (err) {
        console.error("Failed to fetch agent actions:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchActions();
  }, []);

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <Bot className="w-4 h-4 text-purple-400" />
          Hermes Security Agent — Action Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-gray-500 py-8">
            Loading agent actions...
          </p>
        ) : actions.length === 0 ? (
          <div className="text-center py-8">
            <Bot className="w-12 h-12 text-purple-400 mx-auto mb-3 opacity-40" />
            <p className="text-gray-400">
              No automated actions taken yet.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              The Hermes Security Agent will log actions here when alerts
              trigger automated responses.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {actions.map((action) => (
              <div
                key={action.id}
                className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {resultIcons[action.result] || resultIcons.pending}
                    <div>
                      <span className="text-sm font-medium text-white">
                        {actionTypeLabels[action.action_type] ||
                          action.action_type}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant="outline"
                          className="text-[10px] border-gray-700 text-gray-400"
                        >
                          v{action.agent_version}
                        </Badge>
                        {action.parameters?.actor && (
                          <span className="text-xs text-gray-500 font-mono">
                            {action.parameters.actor}
                          </span>
                        )}
                        {action.parameters?.ip && (
                          <span className="text-xs text-gray-500 font-mono">
                            {action.parameters.ip}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge
                      variant="outline"
                      className={
                        action.result === "success"
                          ? "border-green-700 text-green-400"
                          : action.result === "failure"
                          ? "border-red-700 text-red-400"
                          : "border-gray-700 text-gray-400"
                      }
                    >
                      {action.result}
                    </Badge>
                    <p className="text-[10px] text-gray-600 mt-1">
                      {new Date(action.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
