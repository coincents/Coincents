import { useState, useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import { authClient } from "@/lib/auth-client";

export function useSIWE() {
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState(null);

  const signIn = useCallback(async () => {
    if (!address || !chainId) {
      setError("Wallet not connected");
      return { success: false, error: "Wallet not connected" };
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      // Step 1: Get nonce from Better Auth (with 15s timeout for mobile)
      const nonceController = new AbortController();
      const nonceTimeout = setTimeout(() => nonceController.abort(), 15000);

      let nonceData, nonceError;
      try {
        const result = await authClient.siwe.nonce({
          walletAddress: address,
          chainId,
        });
        nonceData = result.data;
        nonceError = result.error;
      } catch (e) {
        if (e.name === "AbortError") {
          throw new Error("Connection timed out. Please try again.");
        }
        throw e;
      } finally {
        clearTimeout(nonceTimeout);
      }

      if (nonceError || !nonceData?.nonce) {
        throw new Error("Failed to get nonce. Please try again.");
      }

      // Step 2: Create SIWE message with minimal required fields
      // Domain must match server config (hostname only, no port)
      const domain = window.location.hostname;
      const message = new SiweMessage({
        domain,
        address,
        uri: window.location.origin,
        version: "1",
        chainId: Number(chainId),
        nonce: nonceData.nonce,
      });

      const preparedMessage = message.prepareMessage();

      // Step 3: Sign message with wallet
      const signature = await signMessageAsync({
        message: preparedMessage,
      });

      // Step 4: Verify signature with Better Auth
      const { data: verifyData, error: verifyError } = await authClient.siwe.verify({
        message: preparedMessage,
        signature,
        walletAddress: address,
        chainId,
      });

      if (verifyError || !verifyData) {
        throw new Error(verifyError?.message || "Verification failed");
      }

      return { 
        success: true, 
        user: verifyData.user,
        session: verifyData.session 
      };

    } catch (err) {
      console.error("SIWE authentication error:", err);

      // Handle common mobile wallet errors with user-friendly messages
      let errorMessage = err.message || "Authentication failed";

      if (err.message?.includes("User rejected") || err.message?.includes("rejected")) {
        errorMessage = "Signature request was rejected. Please try again.";
      } else if (err.message?.includes("timeout") || err.message?.includes("timed out")) {
        errorMessage = "Connection timed out. Please check your internet and try again.";
      } else if (err.message?.includes("network") || err.message?.includes("fetch")) {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (err.code === 4001) {
        errorMessage = "You cancelled the signature request.";
      }

      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsAuthenticating(false);
    }
  }, [address, chainId, signMessageAsync]);

  const signOut = useCallback(async () => {
    try {
      await authClient.signOut();
      return { success: true };
    } catch (err) {
      console.error("Sign out error:", err);
      return { success: false, error: err.message };
    }
  }, []);

  return {
    signIn,
    signOut,
    isAuthenticating,
    error,
    address,
    chainId,
  };
}

