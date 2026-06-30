/**
 * D3VONN Plan Management
 *
 * Displays available plans, current plan details, upgrade/downgrade
 * options, and feature comparison matrix.
 */

import { useState } from "react";

interface PlanDisplay {
  id: string;
  name: string;
  tier: "free" | "pro" | "enterprise";
  price: number;
  interval: string;
  features: string[];
  limits: Record<string, string>;
  highlighted: boolean;
}

const PLANS: PlanDisplay[] = [
  {
    id: "free",
    name: "Free",
    tier: "free",
    price: 0,
    interval: "forever",
    highlighted: false,
    features: [
      "3 agents",
      "1 workspace",
      "Community support",
      "Basic event bus",
      "5 RBAC roles",
    ],
    limits: {
      "API Calls": "1,000/mo",
      "Agent Invocations": "500/mo",
      "Storage": "1 GB",
      "Team Members": "3",
      "Webhooks": "5",
    },
  },
  {
    id: "pro",
    name: "Pro",
    tier: "pro",
    price: 79,
    interval: "/month",
    highlighted: true,
    features: [
      "8 agents",
      "10 workspaces",
      "Priority support",
      "Full event bus + replay",
      "Custom RBAC policies",
      "Knowledge graph",
      "Observability suite",
    ],
    limits: {
      "API Calls": "50,000/mo",
      "Agent Invocations": "5,000/mo",
      "Storage": "50 GB",
      "Team Members": "25",
      "Webhooks": "25",
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tier: "enterprise",
    price: 299,
    interval: "/month",
    highlighted: false,
    features: [
      "Unlimited agents",
      "Unlimited workspaces",
      "24/7 dedicated support",
      "Full event bus + DLQ + replay",
      "Custom RBAC + SSO/SAML",
      "Knowledge graph + custom nodes",
      "Full observability + Sentry",
      "Data sovereignty",
      "Custom SLA",
    ],
    limits: {
      "API Calls": "Unlimited",
      "Agent Invocations": "Unlimited",
      "Storage": "500 GB",
      "Team Members": "Unlimited",
      "Webhooks": "Unlimited",
    },
  },
];

export function PlanManagement() {
  const [currentPlan] = useState<string>("pro");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Plan Management</h2>
        <span className="text-sm text-gray-400">Current: Pro Plan</span>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-lg p-6 border ${
              plan.highlighted
                ? "border-purple-500 bg-gray-800 ring-1 ring-purple-500/50"
                : "border-gray-700 bg-gray-800"
            }`}
          >
            {plan.highlighted && (
              <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">
                Current Plan
              </span>
            )}
            <h3 className="text-xl font-bold text-white mt-2">{plan.name}</h3>
            <div className="mt-2">
              <span className="text-3xl font-bold text-white">
                {plan.price === 0 ? "Free" : `$${plan.price}`}
              </span>
              {plan.price > 0 && (
                <span className="text-gray-400 text-sm">{plan.interval}</span>
              )}
            </div>

            <ul className="mt-4 space-y-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-gray-300">
                  <span className="text-green-400">✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Limits</p>
              {Object.entries(plan.limits).map(([key, value]) => (
                <div key={key} className="flex justify-between text-xs py-0.5">
                  <span className="text-gray-400">{key}</span>
                  <span className="text-gray-300">{value}</span>
                </div>
              ))}
            </div>

            <button
              className={`w-full mt-4 py-2 rounded text-sm font-medium ${
                plan.id === currentPlan
                  ? "bg-gray-700 text-gray-400 cursor-default"
                  : plan.tier === "enterprise"
                    ? "bg-blue-600 hover:bg-blue-500 text-white"
                    : "bg-purple-600 hover:bg-purple-500 text-white"
              }`}
              disabled={plan.id === currentPlan}
            >
              {plan.id === currentPlan
                ? "Current Plan"
                : plan.tier === "enterprise"
                  ? "Contact Sales"
                  : plan.price > (PLANS.find((p) => p.id === currentPlan)?.price ?? 0)
                    ? "Upgrade"
                    : "Downgrade"}
            </button>
          </div>
        ))}
      </div>

      {/* Feature Comparison */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Feature Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2">Feature</th>
                <th className="text-center py-2">Free</th>
                <th className="text-center py-2">Pro</th>
                <th className="text-center py-2">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Multi-tenant", "✗", "✓", "✓"],
                ["Custom RBAC", "✗", "✓", "✓"],
                ["SSO/SAML", "✗", "✗", "✓"],
                ["Event Replay", "✗", "✓", "✓"],
                ["Dead Letter Queue", "✗", "✓", "✓"],
                ["Knowledge Graph", "✗", "✓", "✓"],
                ["Sentry Integration", "✗", "✗", "✓"],
                ["Data Sovereignty", "✗", "✗", "✓"],
                ["Custom SLA", "✗", "✗", "✓"],
                ["Priority Support", "✗", "✓", "✓"],
                ["Dedicated Support", "✗", "✗", "✓"],
              ].map(([feature, free, pro, enterprise]) => (
                <tr key={feature} className="border-b border-gray-700/50">
                  <td className="py-2 text-gray-300">{feature}</td>
                  <td className={`py-2 text-center ${free === "✓" ? "text-green-400" : "text-gray-600"}`}>{free}</td>
                  <td className={`py-2 text-center ${pro === "✓" ? "text-green-400" : "text-gray-600"}`}>{pro}</td>
                  <td className={`py-2 text-center ${enterprise === "✓" ? "text-green-400" : "text-gray-600"}`}>{enterprise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default PlanManagement;
