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
      // Step 1: Get nonce from Better Auth
      const { data: nonceData, error: nonceError } = await authClient.siwe.nonce({
        walletAddress: address,
        chainId,
      });

      if (nonceError || !nonceData?.nonce) {
        throw new Error("Failed to get nonce");
      }

      // Step 2: Create SIWE message
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: process.env.NEXT_PUBLIC_SIWE_STATEMENT || "Sign in to Coincents",
        uri: window.location.origin,
        version: "1",
        chainId,
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

      console.log("✅ SIWE authentication successful:", verifyData);
      
      return { 
        success: true, 
        user: verifyData.user,
        session: verifyData.session 
      };

    } catch (err) {
      console.error("SIWE authentication error:", err);
      const errorMessage = err.message || "Authentication failed";
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

