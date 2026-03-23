"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getCurrentUser, updateUser } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Loader2, Settings, Shield, Wallet, Bell } from "lucide-react";
import { activeChain } from "@/lib/wagmi-config";

export default function SettingsPage() {
  const { address } = useAccount();
  const { token, signOut } = useAuth();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [notifications, setNotifications] = useState({
    emailBids: true,
    emailMessages: true,
    pushAlerts: false,
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  const walletAddress = address || "NOT_CONNECTED";
  const shortAddress = address
    ? `${address.slice(0, 10)}...${address.slice(-8)}`
    : "NOT_CONNECTED";

  // Fetch user data
  const { data: user, isLoading } = useQuery({
    queryKey: ["user"],
    queryFn: () => getCurrentUser(token!),
    enabled: !!token,
  });

  // Populate form when user data loads
  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || "");
      setEmail(user.email || "");
      setCompany(user.company_name || "");
    }
  }, [user]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => updateUser(data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      display_name: displayName,
      email,
      company_name: company,
    });
  };

  // Build explorer URL for X Layer
  const explorerUrl = activeChain.blockExplorers?.default?.url
    ? `${activeChain.blockExplorers.default.url}/address/${walletAddress}`
    : `https://www.oklink.com/xlayer/address/${walletAddress}`;

  return (
    <div className="space-y-6 font-mono max-w-2xl min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="h-4 w-4 text-green-400" />
        <h1 className="text-xl md:text-2xl font-bold tracking-wide">Settings</h1>
      </div>

      {/* Profile Section */}
      <div className="border border-neutral-700/40 bg-[#1a1a1f] p-5 sm:p-6 space-y-6">
        <h2 className="text-xs text-neutral-500 tracking-wider">PROFILE</h2>

        <div>
          <label className="block text-xs text-neutral-500 tracking-wider mb-2">
            DISPLAY_NAME
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your name..."
            className="w-full bg-[#131519] border border-neutral-700/40 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-neutral-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs text-neutral-500 tracking-wider mb-2">
            EMAIL
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-[#131519] border border-neutral-700/40 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-neutral-500 transition-colors"
          />
          <p className="text-xs text-neutral-600 mt-2">
            Used for notifications about your jobs
          </p>
        </div>

        <div>
          <label className="block text-xs text-neutral-500 tracking-wider mb-2">
            COMPANY (OPTIONAL)
          </label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Your company name..."
            className="w-full bg-[#131519] border border-neutral-700/40 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-neutral-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="bg-white text-black px-6 py-2 text-sm font-bold tracking-wider hover:bg-neutral-200 transition-colors disabled:opacity-50"
          >
            {updateMutation.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                SAVING...
              </span>
            ) : (
              "[SAVE]"
            )}
          </button>
          {saveSuccess && (
            <span className="text-xs text-green-400 tracking-wider">
              SAVED_SUCCESSFULLY
            </span>
          )}
        </div>
      </div>

      {/* Wallet Section */}
      <div className="border border-neutral-700/40 bg-[#1a1a1f] p-5 sm:p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Wallet className="h-3.5 w-3.5 text-neutral-500" />
          <h2 className="text-xs text-neutral-500 tracking-wider">WALLET</h2>
        </div>

        <div>
          <p className="text-xs text-neutral-500 tracking-wider mb-2">
            CONNECTED_ADDRESS
          </p>
          <p className="text-sm font-mono bg-[#131519] border border-neutral-700/40 px-4 py-3 break-all text-neutral-300">
            {walletAddress}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-neutral-700/40 px-4 py-2 text-xs font-bold tracking-wider hover:border-neutral-500 hover:text-white transition-colors text-neutral-300 no-underline"
          >
            [VIEW ON EXPLORER]
          </a>
          <button
            onClick={signOut}
            className="border border-neutral-700/40 px-4 py-2 text-xs font-bold tracking-wider hover:border-neutral-500 hover:text-white transition-colors text-neutral-300"
          >
            [DISCONNECT]
          </button>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="border border-neutral-700/40 bg-[#1a1a1f] p-5 sm:p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-neutral-500" />
          <h2 className="text-xs text-neutral-500 tracking-wider">NOTIFICATIONS</h2>
        </div>

        <div className="space-y-0">
          <label className="flex items-center justify-between py-3 border-b border-neutral-700/40 cursor-pointer">
            <div>
              <span className="text-sm">EMAIL_BID_ALERTS</span>
              <p className="text-xs text-neutral-500 mt-1">
                Get notified when agents bid on your jobs
              </p>
            </div>
            <input
              type="checkbox"
              checked={notifications.emailBids}
              onChange={() =>
                setNotifications((prev) => ({
                  ...prev,
                  emailBids: !prev.emailBids,
                }))
              }
              className="w-5 h-5 accent-green-400 appearance-none border border-neutral-700/40 bg-[#131519] checked:bg-green-400 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between py-3 border-b border-neutral-700/40 cursor-pointer">
            <div>
              <span className="text-sm">EMAIL_MESSAGES</span>
              <p className="text-xs text-neutral-500 mt-1">
                Get notified when agents send you messages
              </p>
            </div>
            <input
              type="checkbox"
              checked={notifications.emailMessages}
              onChange={() =>
                setNotifications((prev) => ({
                  ...prev,
                  emailMessages: !prev.emailMessages,
                }))
              }
              className="w-5 h-5 accent-green-400 appearance-none border border-neutral-700/40 bg-[#131519] checked:bg-green-400 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between py-3 cursor-pointer">
            <div>
              <span className="text-sm">PUSH_ALERTS</span>
              <p className="text-xs text-neutral-500 mt-1">
                Browser push notifications for urgent updates
              </p>
            </div>
            <input
              type="checkbox"
              checked={notifications.pushAlerts}
              onChange={() =>
                setNotifications((prev) => ({
                  ...prev,
                  pushAlerts: !prev.pushAlerts,
                }))
              }
              className="w-5 h-5 accent-green-400 appearance-none border border-neutral-700/40 bg-[#131519] checked:bg-green-400 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Security Tips */}
      <div className="border border-neutral-700/40 bg-[#1a1a1f] p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-neutral-500" />
          <h2 className="text-xs text-neutral-500 tracking-wider">SECURITY</h2>
        </div>

        <p className="text-sm text-neutral-400 leading-relaxed">
          Your wallet is the only way to access your account. Keep your seed
          phrase safe and never share it with anyone.
        </p>

        <div className="bg-[#131519] border border-neutral-700/40 p-4">
          <p className="text-xs text-neutral-500 tracking-wider mb-3">
            SECURITY_TIPS
          </p>
          <ul className="text-xs text-neutral-400 space-y-2">
            <li>* Never share your seed phrase</li>
            <li>* Use a hardware wallet for large amounts</li>
            <li>* Verify transaction details before signing</li>
            <li>* Enable 2FA on your wallet if available</li>
          </ul>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border border-red-500/10 bg-red-500/[0.02] p-5 sm:p-6 space-y-4">
        <h2 className="text-xs text-red-400/60 tracking-wider">DANGER_ZONE</h2>

        <p className="text-sm text-neutral-400">
          This action is irreversible. All data associated with your account
          will be permanently deleted.
        </p>

        <button className="border border-red-500/20 text-red-400 px-6 py-2 text-sm font-medium tracking-wide hover:bg-red-500/10 transition-colors duration-150">
          Delete Account
        </button>
      </div>
    </div>
  );
}
