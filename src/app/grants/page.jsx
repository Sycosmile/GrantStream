import React, { useState } from "react";
import {
  PlusCircle,
  Trash2,
  Wallet,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function GrantsPage() {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    totalAmount: "",
    recipientAddress: "",
    milestones: [{ title: "", amount: "" }],
  });

  const { data: grants, isLoading } = useQuery({
    queryKey: ["grants"],
    queryFn: async () => {
      const res = await fetch("/api/grants");
      if (!res.ok) throw new Error("Failed to fetch grants");
      return res.json();
    },
  });

  const createGrantMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch("/api/grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create grant");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["grants"]);
      queryClient.invalidateQueries(["dashboard"]);
      setShowCreateForm(false);
      setFormData({
        title: "",
        totalAmount: "",
        recipientAddress: "",
        milestones: [{ title: "", amount: "" }],
      });
      toast.success("Grant created successfully on-chain (mocked)");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const addMilestone = () => {
    setFormData({
      ...formData,
      milestones: [...formData.milestones, { title: "", amount: "" }],
    });
  };

  const removeMilestone = (index) => {
    const newMilestones = formData.milestones.filter((_, i) => i !== index);
    setFormData({ ...formData, milestones: newMilestones });
  };

  const handleMilestoneChange = (index, field, value) => {
    const newMilestones = [...formData.milestones];
    newMilestones[index][field] = value;
    setFormData({ ...formData, milestones: newMilestones });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const totalMilestoneAmount = formData.milestones.reduce(
      (acc, m) => acc + Number(m.amount),
      0,
    );
    if (totalMilestoneAmount !== Number(formData.totalAmount)) {
      toast.error(
        `Total milestone amounts (${totalMilestoneAmount}) must equal total grant amount (${formData.totalAmount})`,
      );
      return;
    }
    createGrantMutation.mutate(formData);
  };

  if (isLoading)
    return (
      <div className="p-8 text-center text-gray-500">Loading grants...</div>
    );

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Grants</h1>
          <p className="text-gray-400">
            Manage and track your on-chain grant programs.
          </p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-5 py-2.5 bg-[#4ade80] text-black font-semibold rounded-xl hover:bg-[#22c55e] transition-colors flex items-center gap-2"
          >
            <PlusCircle size={20} />
            Create New Grant
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="bg-[#111] border border-[#2d4d2d] rounded-2xl p-6 lg:p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="text-[#4ade80]" />
              New Grant Configuration
            </h2>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">
                  Grant Title
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. DeFi Protocol Research"
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 focus:outline-none focus:border-[#4ade80] transition-colors"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">
                  Recipient Wallet Address
                </label>
                <input
                  required
                  type="text"
                  placeholder="0x..."
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:border-[#4ade80] transition-colors"
                  value={formData.recipientAddress}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      recipientAddress: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">
                  Total Grant Amount (USDC)
                </label>
                <input
                  required
                  type="number"
                  placeholder="5000"
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 focus:outline-none focus:border-[#4ade80] transition-colors"
                  value={formData.totalAmount}
                  onChange={(e) =>
                    setFormData({ ...formData, totalAmount: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-400">
                  Milestone Breakdown
                </label>
                <button
                  type="button"
                  onClick={addMilestone}
                  className="text-xs font-bold text-[#4ade80] hover:underline"
                >
                  + Add Milestone
                </button>
              </div>

              {formData.milestones.map((milestone, index) => (
                <div
                  key={index}
                  className="flex gap-4 items-start bg-[#1a1a1a] p-4 rounded-xl border border-[#333]"
                >
                  <div className="flex-1 space-y-2">
                    <input
                      required
                      type="text"
                      placeholder={`Milestone ${index + 1} Title`}
                      className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4ade80]"
                      value={milestone.title}
                      onChange={(e) =>
                        handleMilestoneChange(index, "title", e.target.value)
                      }
                    />
                  </div>
                  <div className="w-32 space-y-2">
                    <input
                      required
                      type="number"
                      placeholder="Amount"
                      className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4ade80]"
                      value={milestone.amount}
                      onChange={(e) =>
                        handleMilestoneChange(index, "amount", e.target.value)
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMilestone(index)}
                    className="p-2 text-gray-500 hover:text-red-400 mt-0.5"
                    disabled={formData.milestones.length === 1}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={createGrantMutation.isLoading}
              className="w-full py-4 bg-[#4ade80] text-black font-bold rounded-xl hover:bg-[#22c55e] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {createGrantMutation.isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Deploying Smart Contract...
                </>
              ) : (
                <>
                  <ShieldCheck size={20} />
                  Deploy Grant Stream
                </>
              )}
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {grants.map((grant) => (
          <div
            key={grant.id}
            className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-[#1a1a1a] flex flex-wrap justify-between items-start gap-4">
              <div className="space-y-1">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  {grant.title}
                  <span className="text-[10px] px-2 py-0.5 bg-[#1a2e1a] text-[#4ade80] border border-[#2d4d2d] rounded-full uppercase tracking-widest">
                    Active
                  </span>
                </h3>
                <p className="text-xs text-gray-500 font-mono flex items-center gap-2">
                  Recipient: {grant.recipient_address}
                  <ExternalLink
                    size={12}
                    className="cursor-pointer hover:text-white"
                  />
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[#4ade80]">
                  {grant.total_amount.toLocaleString()} USDC
                </p>
                <p className="text-xs text-gray-500">Contract Balance</p>
              </div>
            </div>

            <div className="p-6 bg-[#0d0d0d]">
              <div className="space-y-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Milestones Tracker
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {grant.milestones?.map((m) => (
                    <div
                      key={m.id}
                      className={`p-4 rounded-xl border ${
                        m.status === "paid"
                          ? "bg-[#1a2e1a]/20 border-[#2d4d2d]"
                          : m.status === "approved"
                            ? "bg-[#111] border-[#4ade80]/30"
                            : m.status === "submitted"
                              ? "bg-[#111] border-blue-900/50"
                              : "bg-[#111] border-[#1a1a1a]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            m.status === "paid"
                              ? "text-[#4ade80]"
                              : m.status === "approved"
                                ? "text-green-400"
                                : m.status === "submitted"
                                  ? "text-blue-400"
                                  : "text-gray-500"
                          }`}
                        >
                          {m.status}
                        </span>
                        {m.status === "paid" && (
                          <CheckCircle2 size={14} className="text-[#4ade80]" />
                        )}
                      </div>
                      <h4 className="text-sm font-semibold mb-1 truncate">
                        {m.title}
                      </h4>
                      <p className="text-xs text-gray-400">{m.amount} USDC</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

        {grants.length === 0 && !showCreateForm && (
          <div className="py-20 text-center border-2 border-dashed border-[#1a1a1a] rounded-3xl">
            <PlusCircle className="mx-auto text-gray-700 mb-4" size={48} />
            <p className="text-gray-500">
              No grants found. Start by creating one!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
