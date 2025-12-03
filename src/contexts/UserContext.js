"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
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
  const [connectionError, setConnectionError] = useState(null);
  const [syncInProgress, setSyncInProgress] = useState(false);

  // Sync wagmi connection to context and backend
  useEffect(() => {
    const sync = async () => {
      // Clear error on new sync attempt
      setConnectionError(null);

      if (!isConnected || !address) {
        setUserId("");
        setWalletAddress("");
        setBackendUser(null);
        setLastSyncedAddress(null);
        setSyncInProgress(false);
        return;
      }

      // Skip if we already synced this address or sync is in progress
      if (address === lastSyncedAddress || syncInProgress) {
        return;
      }

      setSyncInProgress(true);

      // Normalize to checksum for UI
      const normalized = address;
      setWalletAddress(normalized);
      setLastSyncedAddress(normalized);

      // Upsert user via wallet auth endpoint with timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        await fetch("/api/auth/wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: normalized }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (e) {
        if (e.name === "AbortError") {
          console.warn("Wallet auth timed out");
          setConnectionError("Connection timed out. Please try again.");
        } else {
          console.warn("Wallet auth failed:", e);
        }
      }

      // Fetch backend user by address with timeout
      setIsLoadingUser(true);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(`/api/users?address=${normalized}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const data = await res.json();
        if (data?.success && data.user) {
          setBackendUser(data.user);
          setUserId(data.user.id);
        }
      } catch (e) {
        if (e.name === "AbortError") {
          console.warn("User fetch timed out");
          setConnectionError("Loading user data timed out. Please refresh.");
        } else {
          console.warn("Failed to load backend user", e);
          setConnectionError("Failed to load user data. Please try again.");
        }
      } finally {
        setIsLoadingUser(false);
        setSyncInProgress(false);
      }
    };
    sync();
  }, [isConnected, address, lastSyncedAddress, syncInProgress]);

  // Redirect to portfolio only from landing page, and only after full connection (not reconnecting)
  useEffect(() => {
    const isLanding = pathname === "/";
    const isReadyConnected = isConnected && !!address && status === "connected";
    if (isLanding && isReadyConnected) {
      router.replace("/portfolio");
    }
  }, [isConnected, address, status, pathname]);

  // Poll balance every 60 seconds when connected
  useEffect(() => {
    if (!isConnected || !address) return;

    const pollBalance = async () => {
      try {
        const res = await fetch(`/api/users?address=${address}`);
        const data = await res.json();
        if (data?.success && data.user) {
          setBackendUser(data.user);
          setUserId(data.user.id || "");
        }
      } catch (e) {
        console.warn("Balance poll failed", e);
      }
    };

    const interval = setInterval(pollBalance, 60000);
    return () => clearInterval(interval);
  }, [isConnected, address]);

  const updateUser = (newUserId, newWalletAddress) => {
    setUserId(newUserId || "");
    setWalletAddress(newWalletAddress || "");
  };

  const clearUser = () => {
    setUserId("");
    setWalletAddress("");
    setBackendUser(null);
    setConnectionError(null);
  };

  const retryConnection = () => {
    setConnectionError(null);
    setLastSyncedAddress(null);
    setSyncInProgress(false);
  };

  const clearConnectionError = () => {
    setConnectionError(null);
  };

  const refreshUserFromBackend = useCallback(async () => {
    if (!address) return null;
    try {
      const res = await fetch(`/api/users?address=${address}`);
      const data = await res.json();
      if (data?.success && data.user) {
        setBackendUser(data.user);
        setUserId(data.user.id || "");
        return data.user;
      }
    } catch (error) {
      console.warn("Manual user refresh failed", error);
    }
    return null;
  }, [address]);

  const value = {
    userId,
    walletAddress,
    backendUser,
    isLoadingUser,
    connectionError,
    updateUser,
    clearUser,
    refreshUserFromBackend,
    retryConnection,
    clearConnectionError,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
