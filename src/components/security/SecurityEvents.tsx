/**
 * SecurityEvents — Recent events timeline
 */

import React, { useEffect, useState } from "react";
import { Activity, ArrowDown, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface SecurityEvent {
  id: string;
  created_at: string;
  source: string;
  event_type: string;
  severity: string;
  actor?: string;
  ip?: string;
  metadata: Record<string, any>;
  outcome: string;
}

interface SecurityEventsProps {
  events?: SecurityEvent[];
}

const severityDot: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-blue-500",
  info: "bg-gray-500",
};

const outcomeBadge: Record<string, string> = {
  success: "text-green-400 border-green-700",
  failure: "text-red-400 border-red-700",
  unknown: "text-gray-400 border-gray-700",
};

export const SecurityEvents: React.FC<SecurityEventsProps> = ({
  events: initialEvents,
}) => {
  const [events, setEvents] = useState<SecurityEvent[]>(initialEvents || []);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(50);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/security/events?limit=${limit}`
      );
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialEvents || initialEvents.length === 0) {
      fetchEvents();
    }
  }, []);

  const displayEvents = events.length > 0 ? events : initialEvents || [];

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          Security Events
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchEvents}
          disabled={loading}
          className="text-xs text-gray-400"
        >
          <Filter className="w-3 h-3 mr-1" />
          Load All
        </Button>
      </CardHeader>
      <CardContent>
        {displayEvents.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            No security events recorded yet.
          </p>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {displayEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors"
              >
                {/* Severity indicator */}
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    severityDot[event.severity] || severityDot.info
                  }`}
                />

                {/* Event info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-gray-200 truncate">
                      {event.event_type}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        outcomeBadge[event.outcome] || outcomeBadge.unknown
                      }`}
                    >
                      {event.outcome}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">
                      {event.source}
                    </span>
                    {event.actor && (
                      <span className="text-xs text-gray-400 font-mono">
                        {event.actor}
                      </span>
                    )}
                    {event.ip && (
                      <span className="text-xs text-gray-500 font-mono">
                        {event.ip}
                      </span>
                    )}
                  </div>
                </div>

                {/* Timestamp */}
                <span className="text-[10px] text-gray-600 shrink-0">
                  {new Date(event.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}

        {displayEvents.length >= limit && (
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLimit((l) => l + 50);
                fetchEvents();
              }}
              className="text-xs text-gray-400"
            >
              <ArrowDown className="w-3 h-3 mr-1" />
              Load More
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
