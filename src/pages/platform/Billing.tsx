/**
 * D3VONN Billing Page
 *
 * Container page for billing sub-routes with tab navigation.
 */

import { useState } from "react";
import { BillingDashboard } from "@/components/admin/billing/BillingDashboard";
import { UsageMeteringPanel } from "@/components/admin/billing/UsageMeteringPanel";
import { PlanManagement } from "@/components/admin/billing/PlanManagement";
import { OveragePanel } from "@/components/admin/billing/OveragePanel";

type BillingTab = "dashboard" | "usage" | "plans" | "overage";

const TABS: Array<{ id: BillingTab; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "usage", label: "Usage Metering" },
  { id: "plans", label: "Plans" },
  { id: "overage", label: "Overage" },
];

export function Billing() {
  const [activeTab, setActiveTab] = useState<BillingTab>("dashboard");

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-800 p-1 rounded-lg border border-gray-700 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "dashboard" && <BillingDashboard />}
      {activeTab === "usage" && <UsageMeteringPanel />}
      {activeTab === "plans" && <PlanManagement />}
      {activeTab === "overage" && <OveragePanel />}
    </div>
  );
}

export default Billing;
