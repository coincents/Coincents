import { ethers } from "ethers";
// WalletConnect removed; using RainbowKit + wagmi instead
import {
  debugLog,
  debugError,
  debugWalletState,
  checkEnvironmentVariables,
} from "./debug.js";

let provider = null;
let signer = null;
let walletConnectProvider = null;

// Wallet types and their detection methods
const WALLET_TYPES = {
  METAMASK: "metamask",
  WALLETCONNECT: "walletconnect",
  COINBASE: "coinbase",
  TRUST: "trust",
  BRAVE: "brave",
  PHANTOM: "phantom",
  BINANCE: "binance",
};

// Cookie utility functions
const setCookie = (name, value, days = 7) => {
  if (typeof window === "undefined") return;

  try {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
  } catch (error) {
    console.warn("Failed to set cookie:", error);
  }
};

const getCookie = (name) => {
  if (typeof window === "undefined") return null;

  try {
    const nameEQ = name + "=";
    const ca = document.cookie.split(";");
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === " ") c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
  } catch (error) {
    console.warn("Failed to get cookie:", error);
  }

  return null;
};

const deleteCookie = (name) => {
  if (typeof window === "undefined") return;

  try {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
  } catch (error) {
    console.warn("Failed to delete cookie:", error);
  }
};

// Save wallet connection to cookies
const saveWalletConnection = (walletType, address) => {
  setCookie("walletbase_wallet_type", walletType, 7);
  setCookie("walletbase_wallet_address", address, 7);
};

// Load wallet connection from cookies
const loadWalletConnection = () => {
  const walletType = getCookie("walletbase_wallet_type");
  const address = getCookie("walletbase_wallet_address");

  if (walletType && address) {
    return { walletType, address };
  }

  return null;
};

// Clear wallet connection from cookies
const clearWalletConnection = () => {
  deleteCookie("walletbase_wallet_type");
  deleteCookie("walletbase_wallet_address");
};

// Detect available wallets
export const detectWallets = () => {
  const availableWallets = [];

  // Check if running in browser
  if (typeof window === "undefined") {
    return availableWallets;
  }

  // MetaMask
  if (window.ethereum && window.ethereum.isMetaMask) {
    availableWallets.push({
      type: WALLET_TYPES.METAMASK,
      name: "MetaMask",
      icon: "🦊",
      description: "The most popular Web3 wallet",
      isInstalled: true,
    });
  }

  // Coinbase Wallet
  if (window.ethereum && window.ethereum.isCoinbaseWallet) {
    availableWallets.push({
      type: WALLET_TYPES.COINBASE,
      name: "Coinbase Wallet",
      icon: "🪙",
      description: "Coinbase's Web3 wallet",
      isInstalled: true,
    });
  }

  // Brave Wallet
  if (window.ethereum && window.ethereum.isBraveWallet) {
    availableWallets.push({
      type: WALLET_TYPES.BRAVE,
      name: "Brave Wallet",
      icon: "🦁",
      description: "Built into Brave browser",
      isInstalled: true,
    });
  }

  // Trust Wallet
  if (window.ethereum && window.ethereum.isTrust) {
    availableWallets.push({
      type: WALLET_TYPES.TRUST,
      name: "Trust Wallet",
      icon: "🛡️",
      description: "Binance's mobile wallet",
      isInstalled: true,
    });
  }

  // Phantom Wallet (Ethereum)
  if (window.ethereum && window.ethereum.isPhantom) {
    availableWallets.push({
      type: WALLET_TYPES.PHANTOM,
      name: "Phantom",
      icon: "👻",
      description: "Popular multi-chain wallet",
      isInstalled: true,
    });
  }

  // Binance Wallet
  if (window.ethereum && window.ethereum.isBinanceWallet) {
    availableWallets.push({
      type: WALLET_TYPES.BINANCE,
      name: "Binance Wallet",
      icon: "🔶",
      description: "Binance's Web3 wallet",
      isInstalled: true,
    });
  }

  // WalletConnect option removed

  return availableWallets;
};

// Load wallet data from cookies (no auto-reconnect)
export const loadWalletFromCookies = () => {
  return loadWalletConnection();
};

// Restore wallet connection from cookies
export const restoreWalletFromCookies = async () => {
  try {
    const savedConnection = loadWalletConnection();
    if (!savedConnection) return null;

    const { walletType, address } = savedConnection;

    // Check if we're already connected to the same wallet
    if (provider && signer) {
      try {
        const currentAddress = await signer.getAddress();
        if (currentAddress.toLowerCase() === address.toLowerCase()) {
          console.log("Wallet already connected:", currentAddress);
          return currentAddress;
        }
      } catch (error) {
        console.log("Error getting current address, will attempt restoration");
      }
    }

    // Restore the connection based on wallet type
    if (walletType === WALLET_TYPES.WALLETCONNECT) {
      // For WalletConnect, we need to check if the session is still valid
      const config = getWalletConnectConfig();
      try {
        walletConnectProvider = await EthereumProvider.init({
          projectId: config.projectId,
          chains: config.chains,
          showQrModal: false, // Don't show QR modal for restoration
          rpcMap: config.rpcMap,
          metadata: config.metadata,
        });

        if (walletConnectProvider.connected) {
          const accounts = await walletConnectProvider.request({
            method: "eth_accounts",
          });

          if (
            accounts &&
            accounts.length > 0 &&
            accounts[0].toLowerCase() === address.toLowerCase()
          ) {
            provider = new ethers.BrowserProvider(walletConnectProvider);
            signer = await provider.getSigner();
            console.log("WalletConnect session restored:", address);
            return address;
          }
        }
      } catch (error) {
        console.log("WalletConnect session restoration failed:", error.message);
        // Clear invalid session
        clearWalletConnection();
        return null;
      }
    } else {
      // For injected wallets, check if the wallet is available and connected
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({
            method: "eth_accounts",
          });

          if (
            accounts &&
            accounts.length > 0 &&
            accounts[0].toLowerCase() === address.toLowerCase()
          ) {
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
            console.log("Injected wallet restored:", address);
            return address;
          }
        } catch (error) {
          console.log("Injected wallet restoration failed:", error.message);
        }
      }
    }

    // If restoration fails, clear the saved connection
    console.log("Wallet restoration failed, clearing saved connection");
    clearWalletConnection();
    return null;
  } catch (error) {
    console.error("Error restoring wallet from cookies:", error);
    clearWalletConnection();
    return null;
  }
};

// Connect to a specific wallet type
export const connectWallet = async (walletType = WALLET_TYPES.METAMASK) => {
  try {
    debugLog("Attempting to connect wallet:", walletType);
    debugWalletState();
    checkEnvironmentVariables();

    if (typeof window === "undefined") {
      throw new Error(
        "Wallet connection is only available in browser environment"
      );
    }

    let address;

    switch (walletType) {
      case WALLET_TYPES.METAMASK:
      case WALLET_TYPES.COINBASE:
      case WALLET_TYPES.BRAVE:
      case WALLET_TYPES.TRUST:
      case WALLET_TYPES.PHANTOM:
      case WALLET_TYPES.BINANCE:
        address = await connectInjectedWallet(walletType);
        break;

      // WalletConnect removed

      default:
        throw new Error(`Unsupported wallet type: ${walletType}`);
    }

    // Save connection to localStorage
    if (address) {
      saveWalletConnection(walletType, address);
    }

    return address;
  } catch (error) {
    console.error("Wallet connection failed:", error);
    throw error;
  }
};

// Connect to injected wallets (MetaMask, Coinbase, etc.)
const connectInjectedWallet = async (walletType) => {
  if (!window.ethereum) {
    throw new Error(
      "No Web3 wallet detected. Please install a Web3 wallet extension."
    );
  }

  // Check if the specific wallet is available
  const walletChecks = {
    [WALLET_TYPES.METAMASK]: () => window.ethereum.isMetaMask,
    [WALLET_TYPES.COINBASE]: () => window.ethereum.isCoinbaseWallet,
    [WALLET_TYPES.BRAVE]: () => window.ethereum.isBraveWallet,
    [WALLET_TYPES.TRUST]: () => window.ethereum.isTrust,
    [WALLET_TYPES.PHANTOM]: () => window.ethereum.isPhantom,
    [WALLET_TYPES.BINANCE]: () => window.ethereum.isBinanceWallet,
  };

  const checkWallet = walletChecks[walletType];
  if (checkWallet && !checkWallet()) {
    throw new Error(
      `${getWalletName(
        walletType
      )} is not available. Please install or unlock the wallet.`
    );
  }

  try {
    // Request account access
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found. Please unlock your wallet.");
    }

    const address = accounts[0];

    // Create provider and signer
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    console.log(`Connected to ${getWalletName(walletType)}:`, address);
    return address;
  } catch (error) {
    if (error.code === 4001) {
      throw new Error("User rejected the connection request.");
    }
    throw error;
  }
};

// WalletConnect connection removed

// Get wallet name for display
const getWalletName = (walletType) => {
  const names = {
    [WALLET_TYPES.METAMASK]: "MetaMask",
    [WALLET_TYPES.WALLETCONNECT]: "WalletConnect",
    [WALLET_TYPES.COINBASE]: "Coinbase Wallet",
    [WALLET_TYPES.BRAVE]: "Brave Wallet",
    [WALLET_TYPES.TRUST]: "Trust Wallet",
    [WALLET_TYPES.PHANTOM]: "Phantom",
    [WALLET_TYPES.BINANCE]: "Binance Wallet",
  };
  return names[walletType] || "Unknown Wallet";
};

// Disconnect wallet
export const disconnectWallet = () => {
  // Disconnect WalletConnect if connected
  if (walletConnectProvider) {
    try {
      walletConnectProvider.disconnect();
    } catch (error) {
      console.warn("Error disconnecting WalletConnect:", error);
    }
    walletConnectProvider = null;
  }

  provider = null;
  signer = null;

  // Clear from localStorage
  clearWalletConnection();

  console.log("Wallet disconnected");
};

// Get current provider
export const getProvider = () => {
  return provider;
};

// Get current signer
export const getSigner = () => {
  return signer;
};

// Check if wallet is connected
export const isWalletConnected = () => {
  return provider !== null && signer !== null;
};

// Get current wallet address
export const getCurrentAddress = async () => {
  if (!signer) {
    return null;
  }
  try {
    return await signer.getAddress();
  } catch (error) {
    console.error("Failed to get current address:", error);
    return null;
  }
};

// Listen for wallet changes
export const setupWalletListeners = (
  onAccountChange,
  onChainChange,
  onDisconnect
) => {
  if (typeof window === "undefined") {
    return;
  }

  // Listen for injected wallet events
  if (window.ethereum) {
    window.ethereum.on("accountsChanged", (accounts) => {
      if (accounts.length === 0) {
        // User disconnected
        disconnectWallet();
        if (onDisconnect) onDisconnect();
      } else {
        // Account changed
        const newAddress = accounts[0];
        // Update cookies with new address
        const savedConnection = loadWalletConnection();
        if (savedConnection) {
          saveWalletConnection(savedConnection.walletType, newAddress);
        }
        if (onAccountChange) onAccountChange(newAddress);
      }
    });

    window.ethereum.on("chainChanged", (chainId) => {
      if (onChainChange) onChainChange(chainId);
    });

    window.ethereum.on("disconnect", () => {
      disconnectWallet();
      if (onDisconnect) onDisconnect();
    });
  }

  // Listen for WalletConnect events
  if (walletConnectProvider) {
    walletConnectProvider.on("accountsChanged", (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
        if (onDisconnect) onDisconnect();
      } else {
        const newAddress = accounts[0];
        // Update cookies with new address
        const savedConnection = loadWalletConnection();
        if (savedConnection) {
          saveWalletConnection(savedConnection.walletType, newAddress);
        }
        if (onAccountChange) onAccountChange(newAddress);
      }
    });

    walletConnectProvider.on("chainChanged", (chainId) => {
      if (onChainChange) onChainChange(chainId);
    });

    walletConnectProvider.on("disconnect", () => {
      disconnectWallet();
      if (onDisconnect) onDisconnect();
    });
  }
};

// Remove wallet listeners
export const removeWalletListeners = () => {
  if (typeof window === "undefined") {
    return;
  }

  if (window.ethereum) {
    window.ethereum.removeAllListeners();
  }

  if (walletConnectProvider) {
    walletConnectProvider.removeAllListeners();
  }
};

export { WALLET_TYPES };
