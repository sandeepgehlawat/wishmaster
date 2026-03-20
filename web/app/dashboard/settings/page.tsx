"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("anon_user_42");
  const [email, setEmail] = useState("user@example.com");
  const [company, setCompany] = useState("");
  const [notifications, setNotifications] = useState({
    emailBids: true,
    emailMessages: true,
    pushAlerts: false,
  });

  const walletAddress = "7xKpR4mN8vQw2bZ5tYjL6sHd3eF9fDq";

  return (
    <div className="space-y-8 font-mono max-w-2xl">
      {/* Header */}
      <h1 className="text-2xl font-bold tracking-wide">Settings</h1>

      {/* PROFILE */}
      <div className="border border-neutral-700/40 p-6 space-y-6 bg-[#1a1a1f]">
        <h2 className="text-xs text-gray-500 tracking-wide">Profile</h2>

        <div>
          <label className="block text-xs text-gray-500 tracking-wide mb-2">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-[#111114] border border-neutral-700/40 px-4 py-3 text-sm text-white outline-none focus:border-white/25 transition-colors duration-150"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 tracking-wide mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#111114] border border-neutral-700/40 px-4 py-3 text-sm text-white outline-none focus:border-white/25 transition-colors duration-150"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 tracking-wide mb-2">Company</label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Optional..."
            className="w-full bg-[#111114] border border-neutral-700/40 px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-white/25 transition-colors duration-150"
          />
        </div>

        <button className="bg-white text-black px-6 py-2 text-sm font-medium tracking-wide hover:bg-white/90 transition-colors duration-150">
          Save
        </button>
      </div>

      {/* WALLET */}
      <div className="border border-neutral-700/40 p-6 space-y-6 bg-[#1a1a1f]">
        <h2 className="text-xs text-gray-500 tracking-wide">Wallet</h2>

        <div>
          <p className="text-xs text-gray-500 tracking-wide mb-2">Connected Address</p>
          <p className="text-sm font-mono bg-[#111114] border border-neutral-700/40 px-4 py-3 text-gray-300">
            {walletAddress}
          </p>
        </div>

        <button className="border border-neutral-700/40 px-6 py-2 text-sm font-medium tracking-wide hover:bg-[#1a1a1f] transition-colors duration-150">
          Disconnect
        </button>
      </div>

      {/* NOTIFICATIONS */}
      <div className="border border-neutral-700/40 p-6 space-y-6 bg-[#1a1a1f]">
        <h2 className="text-xs text-gray-500 tracking-wide">Notifications</h2>

        <div className="space-y-4">
          <label className="flex items-center justify-between py-2 border-b border-neutral-700/40 cursor-pointer">
            <span className="text-sm">Email Bid Alerts</span>
            <input
              type="checkbox"
              checked={notifications.emailBids}
              onChange={() =>
                setNotifications((prev) => ({ ...prev, emailBids: !prev.emailBids }))
              }
              className="w-5 h-5 accent-white appearance-none border border-neutral-700/40 bg-[#111114] checked:bg-white cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between py-2 border-b border-neutral-700/40 cursor-pointer">
            <span className="text-sm">Email Messages</span>
            <input
              type="checkbox"
              checked={notifications.emailMessages}
              onChange={() =>
                setNotifications((prev) => ({
                  ...prev,
                  emailMessages: !prev.emailMessages,
                }))
              }
              className="w-5 h-5 accent-white appearance-none border border-neutral-700/40 bg-[#111114] checked:bg-white cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between py-2 cursor-pointer">
            <span className="text-sm">Push Alerts</span>
            <input
              type="checkbox"
              checked={notifications.pushAlerts}
              onChange={() =>
                setNotifications((prev) => ({
                  ...prev,
                  pushAlerts: !prev.pushAlerts,
                }))
              }
              className="w-5 h-5 accent-white appearance-none border border-neutral-700/40 bg-[#111114] checked:bg-white cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* DANGER ZONE */}
      <div className="border border-red-500/20 p-6 space-y-6 bg-red-500/[0.03]">
        <h2 className="text-xs text-red-400 tracking-wide">Danger Zone</h2>

        <p className="text-sm text-gray-400">
          This action is irreversible. All data associated with your account will be permanently deleted.
        </p>

        <button className="border border-red-500/20 text-red-400 px-6 py-2 text-sm font-medium tracking-wide hover:bg-red-500/10 transition-colors duration-150">
          Delete Account
        </button>
      </div>
    </div>
  );
}
