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
      <h1 className="text-2xl font-bold tracking-wider">SETTINGS</h1>

      {/* PROFILE */}
      <div className="border-2 border-white p-6 space-y-6">
        <h2 className="text-xs text-white/50 tracking-wider">PROFILE</h2>

        <div>
          <label className="block text-xs text-white/60 tracking-wider mb-2">DISPLAY_NAME</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-black border-2 border-white px-4 py-3 text-sm text-white outline-none focus:bg-white/5"
          />
        </div>

        <div>
          <label className="block text-xs text-white/60 tracking-wider mb-2">EMAIL</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-black border-2 border-white px-4 py-3 text-sm text-white outline-none focus:bg-white/5"
          />
        </div>

        <div>
          <label className="block text-xs text-white/60 tracking-wider mb-2">COMPANY</label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Optional..."
            className="w-full bg-black border-2 border-white px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:bg-white/5"
          />
        </div>

        <button className="border-2 border-white px-6 py-2 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors">
          [SAVE]
        </button>
      </div>

      {/* WALLET */}
      <div className="border-2 border-white p-6 space-y-6">
        <h2 className="text-xs text-white/50 tracking-wider">WALLET</h2>

        <div>
          <p className="text-xs text-white/60 tracking-wider mb-2">CONNECTED_ADDRESS</p>
          <p className="text-sm font-mono bg-white/5 border border-white/30 px-4 py-3">
            {walletAddress}
          </p>
        </div>

        <button className="border-2 border-white px-6 py-2 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors">
          [DISCONNECT]
        </button>
      </div>

      {/* NOTIFICATIONS */}
      <div className="border-2 border-white p-6 space-y-6">
        <h2 className="text-xs text-white/50 tracking-wider">NOTIFICATIONS</h2>

        <div className="space-y-4">
          <label className="flex items-center justify-between py-2 border-b border-white/20 cursor-pointer">
            <span className="text-sm">EMAIL_BID_ALERTS</span>
            <input
              type="checkbox"
              checked={notifications.emailBids}
              onChange={() =>
                setNotifications((prev) => ({ ...prev, emailBids: !prev.emailBids }))
              }
              className="w-5 h-5 accent-white appearance-none border-2 border-white bg-black checked:bg-white cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between py-2 border-b border-white/20 cursor-pointer">
            <span className="text-sm">EMAIL_MESSAGES</span>
            <input
              type="checkbox"
              checked={notifications.emailMessages}
              onChange={() =>
                setNotifications((prev) => ({
                  ...prev,
                  emailMessages: !prev.emailMessages,
                }))
              }
              className="w-5 h-5 accent-white appearance-none border-2 border-white bg-black checked:bg-white cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between py-2 cursor-pointer">
            <span className="text-sm">PUSH_ALERTS</span>
            <input
              type="checkbox"
              checked={notifications.pushAlerts}
              onChange={() =>
                setNotifications((prev) => ({
                  ...prev,
                  pushAlerts: !prev.pushAlerts,
                }))
              }
              className="w-5 h-5 accent-white appearance-none border-2 border-white bg-black checked:bg-white cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* DANGER ZONE */}
      <div className="border-2 border-white p-6 space-y-6">
        <h2 className="text-xs text-white/50 tracking-wider">DANGER_ZONE</h2>

        <p className="text-sm text-white/60">
          This action is irreversible. All data associated with your account will be permanently deleted.
        </p>

        <button className="border-2 border-white px-6 py-2 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors">
          {"\u26A0"} [DELETE ACCOUNT]
        </button>
      </div>
    </div>
  );
}
