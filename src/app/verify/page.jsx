import React from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Search,
  Filter,
  FileText,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function VerifyPage() {
  const queryClient = useQueryClient();

  const { data: grants, isLoading } = useQuery({
    queryKey: ["grants"],
    queryFn: async () => {
      const res = await fetch("/api/grants");
      if (!res.ok) throw new Error("Failed to fetch grants");
      return res.json();
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ milestoneId, status }) => {
      const res = await fetch("/api/milestones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId, status }),
      });
      if (!res.ok) throw new Error("Failed to update milestone");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(["grants"]);
      queryClient.invalidateQueries(["dashboard"]);
      toast.success(
        `Milestone ${data.status === "approved" ? "approved" : "rejected"} successfully`,
      );
    },
  });

  if (isLoading)
    return (
      <div className="p-8 text-center text-gray-500">
        Loading verification queue...
      </div>
    );

  // Filter milestones that are 'submitted' across all grants
  const queue =
    grants?.flatMap((g) =>
      (g.milestones || [])
        .filter((m) => m.status === "submitted")
        .map((m) => ({
          ...m,
          grantTitle: g.title,
          recipient: g.recipient_address,
        })),
    ) || [];

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Verifier Panel</h1>
        <p className="text-gray-400">
          Review submitted milestone evidence and authorize on-chain
          disbursements.
        </p>
      </div>

      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            size={18}
          />
          <input
            type="text"
            placeholder="Search by grant or wallet..."
            className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#4ade80] transition-colors"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#111] border border-[#1a1a1a] rounded-xl hover:bg-[#1a1a1a] transition-colors text-sm font-medium">
          <Filter size={18} />
          Filter
        </button>
      </div>

      <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#1a1a1a] bg-[#0d0d0d]">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Grant / Milestone
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Recipient
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Amount
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Evidence
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {queue.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-[#151515] transition-colors"
                >
                  <td className="px-6 py-4">
                    <p className="font-bold text-white">{item.grantTitle}</p>
                    <p className="text-sm text-gray-400">{item.title}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-mono text-[#4ade80]">
                      {item.recipient.slice(0, 8)}...{item.recipient.slice(-6)}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-white">
                      {item.amount.toLocaleString()} USDC
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <button className="flex items-center gap-2 text-sm text-blue-400 hover:underline">
                      <FileText size={16} />
                      View IPFS Link
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() =>
                          verifyMutation.mutate({
                            milestoneId: item.id,
                            status: "pending",
                          })
                        }
                        className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Reject"
                      >
                        <XCircle size={20} />
                      </button>
                      <button
                        onClick={() =>
                          verifyMutation.mutate({
                            milestoneId: item.id,
                            status: "approved",
                          })
                        }
                        className="p-2 text-[#4ade80] hover:bg-[#4ade80]/10 rounded-lg transition-colors"
                        title="Approve"
                      >
                        <CheckCircle2 size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {queue.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    className="px-6 py-12 text-center text-gray-500 italic"
                  >
                    All clear! No milestones awaiting verification.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
