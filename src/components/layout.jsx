import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  PlusCircle,
  ShieldCheck,
  Settings,
  Wallet,
  Menu,
  X,
  Bell,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

const SidebarItem = ({ icon: Icon, label, href, active, onClick }) => (
  <a
    href={href}
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      active
        ? "bg-[#1a2e1a] text-[#4ade80] border border-[#2d4d2d]"
        : "text-gray-400 hover:text-white hover:bg-[#111]"
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </a>
);

export default function AppLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");

  // Use window.location.pathname for active state since we're not using a router
  const [pathname, setPathname] = useState("");

  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  const connectWallet = () => {
    if (isConnected) {
      setIsConnected(false);
      setWalletAddress("");
    } else {
      setIsConnected(true);
      setWalletAddress("0x71C...976F");
    }
  };

  const navigation = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/" },
    { label: "My Grants", icon: PlusCircle, href: "/grants" },
    { label: "Verify", icon: ShieldCheck, href: "/verify" },
    { label: "Settings", icon: Settings, href: "/settings" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-[#1a1a1a] p-4 gap-8">
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="w-8 h-8 bg-[#4ade80] rounded-lg flex items-center justify-center">
            <ShieldCheck className="text-black" size={20} />
          </div>
          <span className="text-xl font-bold tracking-tight">GrantStream</span>
        </div>

        <nav className="flex flex-col gap-2">
          {navigation.map((item) => (
            <SidebarItem
              key={item.href}
              {...item}
              active={pathname === item.href}
            />
          ))}
        </nav>

        <div className="mt-auto p-4 bg-[#111] rounded-xl border border-[#1a1a1a]">
          <p className="text-xs text-gray-500 mb-2">Network</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#4ade80]" />
            <span className="text-sm font-medium">Base Mainnet</span>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-[#0a0a0a] border-r border-[#1a1a1a] z-50 transition-transform lg:hidden ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-[#4ade80]" />
              <span className="text-xl font-bold">GrantStream</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)}>
              <X size={24} />
            </button>
          </div>
          <nav className="flex flex-col gap-2">
            {navigation.map((item) => (
              <SidebarItem
                key={item.href}
                {...item}
                active={pathname === item.href}
                onClick={() => setIsSidebarOpen(false)}
              />
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-[#1a1a1a] flex items-center justify-between px-4 lg:px-8 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-30">
          <button
            className="lg:hidden p-2 text-gray-400"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>

          <div className="flex-1 lg:max-w-md mx-4">
            {/* Search or page title could go here */}
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-gray-400 hover:text-white transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-[#4ade80] rounded-full border-2 border-[#0a0a0a]" />
            </button>
            <button
              onClick={connectWallet}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isConnected
                  ? "bg-[#1a2e1a] text-[#4ade80] border border-[#2d4d2d]"
                  : "bg-[#4ade80] text-black hover:bg-[#22c55e]"
              }`}
            >
              <Wallet size={18} />
              {isConnected ? walletAddress : "Connect Wallet"}
            </button>
          </div>
        </header>

        {/* Page Body */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
