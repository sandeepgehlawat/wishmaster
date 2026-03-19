"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getCurrentUser, updateUser } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Loader2 } from "lucide-react";
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
    <div className="space-y-8 font-mono max-w-2xl">
      {/* Header */}
      <h1 className="text-2xl font-bold tracking-wider">SETTINGS</h1>

      {/* Profile Section */}
      <div className="border-2 border-white p-6 space-y-6">
        <h2 className="text-xs text-white/50 tracking-wider">PROFILE</h2>

        <div>
          <label className="block text-xs text-white/60 tracking-wider mb-2">
            DISPLAY_NAME
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your name..."
            className="w-full bg-black border-2 border-white px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:bg-white/5"
          />
        </div>

        <div>
          <label className="block text-xs text-white/60 tracking-wider mb-2">
            EMAIL
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-black border-2 border-white px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:bg-white/5"
          />
          <p className="text-xs text-white/40 mt-2">
            Used for notifications about your jobs
          </p>
        </div>

        <div>
          <label className="block text-xs text-white/60 tracking-wider mb-2">
            COMPANY (OPTIONAL)
          </label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Your company name..."
            className="w-full bg-black border-2 border-white px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:bg-white/5"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="border-2 border-white px-6 py-2 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors disabled:opacity-50"
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
      <div className="border-2 border-white p-6 space-y-6">
        <h2 className="text-xs text-white/50 tracking-wider">WALLET</h2>

        <div>
          <p className="text-xs text-white/60 tracking-wider mb-2">
            CONNECTED_ADDRESS
          </p>
          <p className="text-sm font-mono bg-white/5 border border-white/30 px-4 py-3 break-all">
            {walletAddress}
          </p>
        </div>

        <div className="flex gap-4">
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="border-2 border-white px-4 py-2 text-xs font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
          >
            [VIEW ON EXPLORER]
          </a>
          <button
            onClick={signOut}
            className="border-2 border-white px-4 py-2 text-xs font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
          >
            [DISCONNECT]
          </button>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="border-2 border-white p-6 space-y-6">
        <h2 className="text-xs text-white/50 tracking-wider">NOTIFICATIONS</h2>

        <div className="space-y-4">
          <label className="flex items-center justify-between py-2 border-b border-white/20 cursor-pointer">
            <div>
              <span className="text-sm">EMAIL_BID_ALERTS</span>
              <p className="text-xs text-white/40 mt-1">
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
              className="w-5 h-5 accent-white appearance-none border-2 border-white bg-black checked:bg-white cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between py-2 border-b border-white/20 cursor-pointer">
            <div>
              <span className="text-sm">EMAIL_MESSAGES</span>
              <p className="text-xs text-white/40 mt-1">
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
              className="w-5 h-5 accent-white appearance-none border-2 border-white bg-black checked:bg-white cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between py-2 cursor-pointer">
            <div>
              <span className="text-sm">PUSH_ALERTS</span>
              <p className="text-xs text-white/40 mt-1">
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
              className="w-5 h-5 accent-white appearance-none border-2 border-white bg-black checked:bg-white cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Security Tips */}
      <div className="border-2 border-white p-6 space-y-4">
        <h2 className="text-xs text-white/50 tracking-wider">SECURITY</h2>

        <p className="text-sm text-white/60 leading-relaxed">
          Your wallet is the only way to access your account. Keep your seed
          phrase safe and never share it with anyone.
        </p>

        <div className="bg-white/5 border border-white/30 p-4">
          <p className="text-xs text-white/60 tracking-wider mb-3">
            SECURITY_TIPS
          </p>
          <ul className="text-xs text-white/50 space-y-2">
            <li>* Never share your seed phrase</li>
            <li>* Use a hardware wallet for large amounts</li>
            <li>* Verify transaction details before signing</li>
            <li>* Enable 2FA on your wallet if available</li>
          </ul>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border-2 border-white p-6 space-y-6">
        <h2 className="text-xs text-white/50 tracking-wider">DANGER_ZONE</h2>

        <p className="text-sm text-white/60">
          This action is irreversible. All data associated with your account
          will be permanently deleted.
        </p>

        <button className="border-2 border-white px-6 py-2 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors">
          {"\u26A0"} [DELETE ACCOUNT]
        </button>
      </div>
    </div>
  );
}
