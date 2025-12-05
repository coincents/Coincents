import { useState, useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { getAddress } from "viem";
import { SiweMessage } from "siwe";
import { authClient } from "@/lib/auth-client";

function mapSiweConstructionError(err) {
  const rawMessage = err?.message || "";
  if (rawMessage.includes("EIP-55")) {
    return "Wallet returned an address without the required checksum. Please switch networks in your wallet or reconnect.";
  }
  if (rawMessage.includes("chain-id")) {
    return "Your wallet reported an unsupported chain id. Please switch to Ethereum Mainnet and try again.";
  }
  if (rawMessage.includes("max line number")) {
    return "Wallet sent an unexpectedly formatted SIWE payload. Reconnect or upgrade your wallet before trying again.";
  }
  return null;
}

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
      if (!authClient) {
        throw new Error("Authentication client not initialized");
      }

      let checksumAddress;
      try {
        checksumAddress = getAddress(address);
      } catch (addrErr) {
        const addrMessage =
          "Wallet returned an invalid address. Please reconnect and ensure you're using a standard EVM account.";
        setError(addrMessage);
        return { success: false, error: addrMessage };
      }

      const normalizedChainId = Number(chainId);
      if (!Number.isInteger(normalizedChainId) || normalizedChainId <= 0) {
        const chainMessage =
          "Unsupported chain id from wallet. Switch to Ethereum Mainnet (chain id 1) and try again.";
        setError(chainMessage);
        return { success: false, error: chainMessage };
      }

      // Step 1: Get nonce from Better Auth (with 15s timeout for mobile)
      const nonceController = new AbortController();
      const nonceTimeout = setTimeout(() => nonceController.abort(), 15000);

      let nonceData, nonceError;
      try {
        const result = await authClient.siwe.nonce({
          walletAddress: checksumAddress,
          chainId: normalizedChainId,
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
      let preparedMessage;
      try {
        const message = new SiweMessage({
          domain,
          address: checksumAddress,
          uri: window.location.origin,
          version: "1",
          chainId: normalizedChainId,
          nonce: nonceData.nonce,
        });
        preparedMessage = message.prepareMessage();
      } catch (messageError) {
        const friendly = mapSiweConstructionError(messageError);
        if (friendly) {
          setError(friendly);
          return { success: false, error: friendly };
        }
        throw messageError;
      }

      // Step 3: Sign message with wallet
      const signature = await signMessageAsync({
        message: preparedMessage,
      });

      // Step 4: Verify signature with Better Auth
      const { data: verifyData, error: verifyError } = await authClient.siwe.verify({
        message: preparedMessage,
        signature,
        walletAddress: checksumAddress,
        chainId: normalizedChainId,
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

