import React from "react";
import {
  User,
  Bell,
  Shield,
  Globe,
  ChevronRight,
  LogOut,
  Moon,
  Github,
  Twitter,
  Wallet,
} from "lucide-react";

const SettingItem = ({ icon: Icon, label, description, rightElement }) => (
  <div className="flex items-center justify-between p-4 bg-[#111] border border-[#1a1a1a] rounded-xl hover:border-[#333] transition-colors cursor-pointer group">
    <div className="flex items-center gap-4">
      <div className="p-2 bg-[#1a1a1a] rounded-lg group-hover:bg-[#222] transition-colors">
        <Icon className="text-[#4ade80]" size={20} />
      </div>
      <div>
        <p className="font-semibold text-white">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
    {rightElement || <ChevronRight size={18} className="text-gray-600" />}
  </div>
);

export default function SettingsPage() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-gray-400">
          Manage your profile, account security, and notifications.
        </p>
      </div>

      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest px-1">
            Account
          </h2>
          <div className="grid grid-cols-1 gap-3">
            <SettingItem
              icon={User}
              label="Profile Information"
              description="Update your display name and email address"
            />
            <SettingItem
              icon={Shield}
              label="Security & Auth"
              description="Manage password and 2FA settings"
            />
            <SettingItem
              icon={Wallet}
              label="Default Wallet"
              description="0x71C7...976F (Base Mainnet)"
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest px-1">
            App Settings
          </h2>
          <div className="grid grid-cols-1 gap-3">
            <SettingItem
              icon={Bell}
              label="Notifications"
              description="Configure on-chain event alerts"
            />
            <SettingItem
              icon={Globe}
              label="Network Preference"
              description="Select preferred blockchain networks"
              rightElement={
                <span className="text-xs font-bold text-[#4ade80] bg-[#1a2e1a] px-2 py-1 rounded">
                  Base
                </span>
              }
            />
            <SettingItem
              icon={Moon}
              label="Theme"
              description="Dark mode enabled by default"
              rightElement={
                <div className="w-10 h-5 bg-[#4ade80] rounded-full relative">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-black rounded-full" />
                </div>
              }
            />
          </div>
        </section>

        <section className="space-y-3 pt-6 border-t border-[#1a1a1a]">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest px-1">
            Social & Links
          </h2>
          <div className="flex gap-4">
            <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#111] border border-[#1a1a1a] rounded-xl hover:bg-[#1a1a1a] transition-colors">
              <Github size={20} />
              <span className="text-sm font-medium">Github</span>
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#111] border border-[#1a1a1a] rounded-xl hover:bg-[#1a1a1a] transition-colors">
              <Twitter size={20} />
              <span className="text-sm font-medium">Twitter</span>
            </button>
          </div>
        </section>

        <button className="w-full flex items-center justify-center gap-2 py-4 text-red-400 font-bold bg-red-400/5 hover:bg-red-400/10 border border-red-400/20 rounded-xl transition-all">
          <LogOut size={20} />
          Disconnect Wallet
        </button>
      </div>
    </div>
  );
}
