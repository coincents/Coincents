"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useRouter, usePathname } from "next/navigation";

const UserContext = createContext();

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const { address, isConnected, status } = useAccount();
  const router = useRouter();
  const pathname = usePathname();

  const [userId, setUserId] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [backendUser, setBackendUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [lastSyncedAddress, setLastSyncedAddress] = useState(null);

  // Sync wagmi connection to context and backend
  useEffect(() => {
    const sync = async () => {
      if (!isConnected || !address) {
        setUserId("");
        setWalletAddress("");
        setBackendUser(null);
        setLastSyncedAddress(null);
        return;
      }

      // Skip if we already synced this address
      if (address === lastSyncedAddress) {
        return;
      }

      // Normalize to checksum for UI
      const normalized = address;
      setWalletAddress(normalized);
      setLastSyncedAddress(normalized);

      // Upsert user via wallet auth endpoint
      try {
        await fetch("/api/auth/wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: normalized }),
        });
      } catch {}

      // Fetch backend user by address
      setIsLoadingUser(true);
      try {
        const res = await fetch(`/api/users?address=${normalized}`);
        const data = await res.json();
        if (data?.success && data.user) {
          setBackendUser(data.user);
          setUserId(data.user.id);
        }
      } catch (e) {
        console.warn("Failed to load backend user", e);
      } finally {
        setIsLoadingUser(false);
      }
    };
    sync();
  }, [isConnected, address, lastSyncedAddress]);

  // Redirect to portfolio only from landing page, and only after full connection (not reconnecting)
  useEffect(() => {
    const isLanding = pathname === "/";
    const isReadyConnected = isConnected && !!address && status === "connected";
    if (isLanding && isReadyConnected) {
      router.replace("/portfolio");
    }
  }, [isConnected, address, status, pathname]);

  const updateUser = (newUserId, newWalletAddress) => {
    setUserId(newUserId || "");
    setWalletAddress(newWalletAddress || "");
  };

  const clearUser = () => {
    setUserId("");
    setWalletAddress("");
    setBackendUser(null);
  };

  const refreshUserFromBackend = async () => {
    if (!address) return null;
    try {
      const res = await fetch(`/api/users?address=${address}`);
      const data = await res.json();
      if (data?.success && data.user) {
        setBackendUser(data.user);
        setUserId(data.user.id || "");
        return data.user;
      }
    } catch {}
    return null;
  };

  const value = {
    userId,
    walletAddress,
    backendUser,
    isLoadingUser,
    updateUser,
    clearUser,
    refreshUserFromBackend,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
