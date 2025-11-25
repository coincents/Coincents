// Environment variables are loaded automatically by Next.js
// No need to manually load dotenv

// Receiving Addresses for Deposits
export const RECEIVING_ADDRESSES = {
  BTC: process.env.NEXT_PUBLIC_BTC_ADDRESS,
  USDT: process.env.NEXT_PUBLIC_USDT_ADDRESS,
  ETH: process.env.NEXT_PUBLIC_ETH_ADDRESS,
};

// WalletConnect Configuration
export const WALLETCONNECT_CONFIG = {
  PROJECT_ID: process.env.PROJECT_ID,
};

// Token Contract Addresses
export const TOKEN_CONTRACTS = {
  USDT:
    process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS ||
    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  USDC:
    process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS ||
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  WETH:
    process.env.NEXT_PUBLIC_WETH_CONTRACT_ADDRESS ||
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
};

// API Endpoints
export const API_ENDPOINTS = {
  COINGECKO:
    process.env.NEXT_PUBLIC_COINGECKO_API_URL ||
    "https://api.coingecko.com/api/v3",
  BLOCKCYPHER:
    process.env.NEXT_PUBLIC_BLOCKCYPHER_API_URL ||
    "https://api.blockcypher.com/v1",
};

// Network Configuration
export const NETWORK_CONFIG = {
  ETHEREUM_NETWORK: process.env.NEXT_PUBLIC_ETHEREUM_NETWORK || "mainnet",
  BITCOIN_NETWORK: process.env.NEXT_PUBLIC_BITCOIN_NETWORK || "mainnet",
};

// Debug configuration
export const DEBUG_CONFIG = {
  ENABLE_LOGS:
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_ENABLE_LOGS === "true",
};

// Common chain IDs
export const CHAIN_IDS = {
  ETHEREUM_MAINNET: 1,
  SEPOLIA: 11155111,
  POLYGON: 137,
  ARBITRUM_ONE: 42161,
  OPTIMISM: 10,
  BASE: 8453,
  BSC: 56,
  AVALANCHE: 43114,
  FANTOM: 250,
  GNOSIS: 100,
};

// Default known addresses by chainId (kept conservative; always override via env when unsure)
const TOKEN_DEFAULTS_BY_CHAIN = {
  [CHAIN_IDS.ETHEREUM_MAINNET]: {
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  },
};

// Helper to read env like NEXT_PUBLIC_USDT_CONTRACT_ADDRESS_137, then generic NEXT_PUBLIC_USDT_CONTRACT_ADDRESS
const envTokenForChain = (symbol, chainId) => {
  const chainScoped =
    process.env[`NEXT_PUBLIC_${symbol}_CONTRACT_ADDRESS_${chainId}`];
  if (chainScoped && chainScoped !== "") return chainScoped;
  const generic = process.env[`NEXT_PUBLIC_${symbol}_CONTRACT_ADDRESS`];
  if (generic && generic !== "") return generic;
  return null;
};

// Resolve token addresses for a given chainId with precedence: chain-scoped env > generic env > defaults
export const getTokenContractsForChain = (chainId) => {
  const envUSDT = envTokenForChain("USDT", chainId);
  const envUSDC = envTokenForChain("USDC", chainId);
  const envWETH = envTokenForChain("WETH", chainId);

  const defaults = TOKEN_DEFAULTS_BY_CHAIN[chainId] || {};

  return {
    USDT: envUSDT || defaults.USDT || null,
    USDC: envUSDC || defaults.USDC || null,
    WETH: envWETH || defaults.WETH || null,
  };
};

// Strict resolver for one token symbol; throws if not configured for the chain
export const requireTokenAddress = (symbol, chainId) => {
  const contracts = getTokenContractsForChain(chainId);
  const address = contracts[symbol];
  if (!address) {
    throw new Error(
      `No ${symbol} address configured for chainId ${chainId}. ` +
        `Set NEXT_PUBLIC_${symbol}_CONTRACT_ADDRESS_${chainId} or NEXT_PUBLIC_${symbol}_CONTRACT_ADDRESS.`
    );
  }
  return address;
};
