/**
 * D3VONN Overage Panel
 *
 * Displays overage events, charges, policies, and provides
 * controls for configuring overage behavior per tenant.
 */

import { useState } from "react";

interface OverageEventDisplay {
  id: string;
  metric: string;
  overageAmount: number;
  chargeAmount: number;
  timestamp: string;
  policy: "block" | "allow_and_charge" | "allow_with_warning" | "throttle";
}

interface OverageRateDisplay {
  metric: string;
  unitSize: string;
  unitPrice: string;
  maxUnits: number;
}

const MOCK_EVENTS: OverageEventDisplay[] = [
  { id: "ovg_001", metric: "Agent Invocations", overageAmount: 120, chargeAmount: 4.00, timestamp: "2026-06-28T14:30:00Z", policy: "allow_and_charge" },
  { id: "ovg_002", metric: "API Calls", overageAmount: 2300, chargeAmount: 1.50, timestamp: "2026-06-27T09:15:00Z", policy: "allow_and_charge" },
  { id: "ovg_003", metric: "Webhook Deliveries", overageAmount: 450, chargeAmount: 0, timestamp: "2026-06-25T16:45:00Z", policy: "allow_with_warning" },
];

const OVERAGE_RATES: OverageRateDisplay[] = [
  { metric: "API Calls", unitSize: "per 1,000", unitPrice: "$0.50", maxUnits: 100 },
  { metric: "Agent Invocations", unitSize: "per 100", unitPrice: "$2.00", maxUnits: 50 },
  { metric: "Storage", unitSize: "per GB", unitPrice: "$0.25", maxUnits: 100 },
  { metric: "Webhook Deliveries", unitSize: "per 1,000", unitPrice: "$1.00", maxUnits: 25 },
  { metric: "Knowledge Queries", unitSize: "per 1,000", unitPrice: "$0.75", maxUnits: 50 },
  { metric: "Integration Calls", unitSize: "per 500", unitPrice: "$1.50", maxUnits: 20 },
];

export function OveragePanel() {
  const [events] = useState<OverageEventDisplay[]>(MOCK_EVENTS);
  const [policy, setPolicy] = useState<string>("allow_and_charge");
  const [maxMonthlyCharge, setMaxMonthlyCharge] = useState<number>(50);

  const totalCharges = events.reduce((sum, e) => sum + e.chargeAmount, 0);

  const policyDescriptions = {
    block: "Block requests when limit is reached",
    allow_and_charge: "Allow requests and charge overage fees",
    allow_with_warning: "Allow requests with warning notifications",
    throttle: "Throttle request rate when limit is reached",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Overage Management</h2>
        <span className="text-sm text-gray-400">
          This month: <span className="text-yellow-400 font-medium">${totalCharges.toFixed(2)}</span>
        </span>
      </div>

      {/* Policy Configuration */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Overage Policy</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-400 block mb-2">Policy</label>
            <select
              value={policy}
              onChange={(e) => setPolicy(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            >
              {Object.entries(policyDescriptions).map(([key, desc]) => (
                <option key={key} value={key}>{desc}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-2">Max Monthly Overage ($)</label>
            <input
              type="number"
              value={maxMonthlyCharge}
              onChange={(e) => setMaxMonthlyCharge(Number(e.target.value))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            />
          </div>
        </div>
      </div>

      {/* Overage Rates */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Overage Rates</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2">Metric</th>
                <th className="text-left py-2">Unit Size</th>
                <th className="text-right py-2">Price</th>
                <th className="text-right py-2">Max Units</th>
                <th className="text-right py-2">Max Charge</th>
              </tr>
            </thead>
            <tbody>
              {OVERAGE_RATES.map((rate) => (
                <tr key={rate.metric} className="border-b border-gray-700/50">
                  <td className="py-2 text-white">{rate.metric}</td>
                  <td className="py-2 text-gray-300">{rate.unitSize}</td>
                  <td className="py-2 text-right text-gray-300">{rate.unitPrice}</td>
                  <td className="py-2 text-right text-gray-300">{rate.maxUnits}</td>
                  <td className="py-2 text-right text-yellow-400">
                    ${(parseFloat(rate.unitPrice.replace("$", "")) * rate.maxUnits).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Overage Events */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Overage Events</h3>
        {events.length === 0 ? (
          <p className="text-gray-400 text-sm">No overage events this period.</p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
                <div>
                  <p className="text-white text-sm">{event.metric}</p>
                  <p className="text-gray-400 text-xs">
                    +{event.overageAmount.toLocaleString()} over limit • {new Date(event.timestamp).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  {event.chargeAmount > 0 ? (
                    <span className="text-yellow-400 font-medium">${event.chargeAmount.toFixed(2)}</span>
                  ) : (
                    <span className="text-gray-500 text-sm">No charge</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OveragePanel;
