/**
 * D3VONN Billing Dashboard
 *
 * Displays subscription status, current plan, usage overview,
 * and billing history for the active tenant.
 */

import { useState } from "react";

interface SubscriptionInfo {
  planName: string;
  planTier: "free" | "pro" | "enterprise";
  status: "trialing" | "active" | "past_due" | "canceled";
  billingInterval: "monthly" | "annual";
  currentPeriodEnd: string;
  daysUntilRenewal: number;
}

interface UsageMetric {
  name: string;
  used: number;
  limit: number;
  percentage: number;
  status: "ok" | "warning" | "critical" | "exceeded";
}

interface InvoiceEntry {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "open" | "past_due";
}

const MOCK_SUBSCRIPTION: SubscriptionInfo = {
  planName: "Pro",
  planTier: "pro",
  status: "active",
  billingInterval: "monthly",
  currentPeriodEnd: new Date(Date.now() + 15 * 86400000).toISOString(),
  daysUntilRenewal: 15,
};

const MOCK_USAGE: UsageMetric[] = [
  { name: "API Calls", used: 32450, limit: 50000, percentage: 65, status: "ok" },
  { name: "Agent Invocations", used: 4200, limit: 5000, percentage: 84, status: "warning" },
  { name: "Storage", used: 28, limit: 50, percentage: 56, status: "ok" },
  { name: "Workspaces", used: 6, limit: 10, percentage: 60, status: "ok" },
  { name: "Team Members", used: 18, limit: 25, percentage: 72, status: "ok" },
  { name: "Webhooks", used: 22, limit: 25, percentage: 88, status: "warning" },
];

const MOCK_INVOICES: InvoiceEntry[] = [
  { id: "inv_001", date: "2026-06-01", amount: 79.00, status: "paid" },
  { id: "inv_002", date: "2026-05-01", amount: 79.00, status: "paid" },
  { id: "inv_003", date: "2026-04-01", amount: 79.00, status: "paid" },
];

export function BillingDashboard() {
  const [subscription] = useState<SubscriptionInfo>(MOCK_SUBSCRIPTION);
  const [usage] = useState<UsageMetric[]>(MOCK_USAGE);
  const [invoices] = useState<InvoiceEntry[]>(MOCK_INVOICES);

  const statusColors = {
    ok: "bg-green-500/20 text-green-400",
    warning: "bg-yellow-500/20 text-yellow-400",
    critical: "bg-orange-500/20 text-orange-400",
    exceeded: "bg-red-500/20 text-red-400",
  };

  const planBadgeColors = {
    free: "bg-gray-600 text-gray-200",
    pro: "bg-purple-600 text-purple-100",
    enterprise: "bg-blue-600 text-blue-100",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Billing Dashboard</h2>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${planBadgeColors[subscription.planTier]}`}>
          {subscription.planName} Plan
        </span>
      </div>

      {/* Subscription Status */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Subscription</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-400">Status</p>
            <p className="text-white font-medium capitalize">{subscription.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Billing</p>
            <p className="text-white font-medium capitalize">{subscription.billingInterval}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Renewal</p>
            <p className="text-white font-medium">{subscription.daysUntilRenewal} days</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Monthly Cost</p>
            <p className="text-white font-medium">$79.00</p>
          </div>
        </div>
      </div>

      {/* Usage Overview */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Usage This Period</h3>
        <div className="space-y-4">
          {usage.map((metric) => (
            <div key={metric.name} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">{metric.name}</span>
                <span className={statusColors[metric.status]}>
                  {metric.used.toLocaleString()} / {metric.limit.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    metric.status === "ok" ? "bg-green-500" :
                    metric.status === "warning" ? "bg-yellow-500" :
                    metric.status === "critical" ? "bg-orange-500" : "bg-red-500"
                  }`}
                  style={{ width: `${Math.min(metric.percentage, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Invoices</h3>
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
              <div>
                <p className="text-white text-sm">{invoice.id}</p>
                <p className="text-gray-400 text-xs">{invoice.date}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white font-medium">${invoice.amount.toFixed(2)}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  invoice.status === "paid" ? "bg-green-500/20 text-green-400" :
                  invoice.status === "open" ? "bg-blue-500/20 text-blue-400" :
                  "bg-red-500/20 text-red-400"
                }`}>
                  {invoice.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default BillingDashboard;
