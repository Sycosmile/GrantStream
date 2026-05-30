import React, { useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  PlusCircle,
  Wallet,
  TrendingUp,
  History,
  Activity,
  ChevronRight,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const StatCard = ({ label, value, icon: Icon, trend }) => (
  <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 hover:border-[#222] transition-colors">
    <div className="flex items-start justify-between mb-4">
      <div className="p-2 bg-[#1a1a1a] rounded-lg">
        <Icon className="text-[#4ade80]" size={20} />
      </div>
      {trend && (
        <span className="text-xs font-medium text-[#4ade80] bg-[#1a2e1a] px-2 py-1 rounded-full flex items-center gap-1">
          <TrendingUp size={12} /> {trend}
        </span>
      )}
    </div>
    <p className="text-sm text-gray-400 mb-1">{label}</p>
    <h3 className="text-2xl font-bold">{value}</h3>
  </div>
);

const ActivityItem = ({ item }) => {
  const getIcon = (type) => {
    switch (type) {
      case "milestone_approved":
        return <CheckCircle2 className="text-[#4ade80]" size={16} />;
      case "grant_created":
        return <PlusCircle className="text-blue-400" size={16} />;
      case "milestone_updated":
        return <Activity className="text-purple-400" size={16} />;
      default:
        return <Clock className="text-gray-400" size={16} />;
    }
  };

  return (
    <div className="flex items-start gap-4 p-4 hover:bg-[#111] rounded-xl transition-colors group">
      <div className="mt-1">{getIcon(item.event_type)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200">{item.message}</p>
        <p className="text-xs text-gray-500 mt-1">
          {new Date(item.timestamp).toLocaleString()}
        </p>
      </div>
      <button className="opacity-0 group-hover:opacity-100 transition-opacity">
        <ExternalLink size={14} className="text-gray-500" />
      </button>
    </div>
  );
};

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return res.json();
    },
  });

  if (isLoading)
    return (
      <div className="p-8 space-y-8 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-[#111] rounded-2xl" />
          ))}
        </div>
        <div className="h-96 bg-[#111] rounded-2xl" />
      </div>
    );

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a2e1a] to-[#0a0a0a] border border-[#2d4d2d] p-8 lg:p-12">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-4xl lg:text-5xl font-bold mb-4 tracking-tight leading-tight">
            Streamline On-Chain <span className="text-[#4ade80]">Grants</span>{" "}
            with Verifiable Milestones.
          </h1>
          <p className="text-gray-400 text-lg mb-8">
            Lock funds securely and release them automatically as milestones are
            approved. Transparent, accountable, and trustless.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="/grants"
              className="px-6 py-3 bg-[#4ade80] text-black font-semibold rounded-xl hover:bg-[#22c55e] transition-colors flex items-center gap-2"
            >
              <PlusCircle size={20} />
              Create Grant
            </a>
            <button className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors backdrop-blur-sm border border-white/10">
              View Documentation
            </button>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-[-50%] right-[-10%] w-[600px] h-[600px] bg-[#4ade80]/10 rounded-full blur-[100px]" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label="Total Locked Value"
          value={`${data.stats.totalLocked.toLocaleString()} USDC`}
          icon={Wallet}
          trend="+12% this week"
        />
        <StatCard
          label="Total Distributed"
          value={`${data.stats.totalPaid.toLocaleString()} USDC`}
          icon={ArrowUpRight}
          trend="+5.4% this week"
        />
        <StatCard
          label="Active Grants"
          value={data.stats.activeGrants}
          icon={ShieldCheck}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Grants */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Featured Grants</h2>
            <a
              href="/grants"
              className="text-[#4ade80] text-sm font-medium hover:underline flex items-center gap-1"
            >
              View All <ChevronRight size={14} />
            </a>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {data.grants.slice(0, 3).map((grant) => (
              <div
                key={grant.id}
                className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl hover:border-[#333] transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg mb-1">{grant.title}</h3>
                    <p className="text-xs text-gray-500 font-mono">
                      {grant.recipient_address.slice(0, 10)}...
                      {grant.recipient_address.slice(-8)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#4ade80]">
                      {grant.total_amount.toLocaleString()} USDC
                    </p>
                    <p className="text-xs text-gray-500">Total Amount</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-gray-400">
                    <Activity size={14} />
                    <span>Active Milestones</span>
                  </div>
                  <div className="h-1 flex-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div className="h-full bg-[#4ade80] w-[45%]" />
                  </div>
                  <span className="text-xs text-gray-500">45%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Activity Feed</h2>
            <button className="text-gray-500 text-sm hover:text-white transition-colors">
              <History size={18} />
            </button>
          </div>
          <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden divide-y divide-[#1a1a1a]">
            {data.activity.map((item) => (
              <ActivityItem key={item.id} item={item} />
            ))}
            {data.activity.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-gray-500">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
