import { z } from "zod";

// Address validation patterns
const ADDRESS_PATTERNS = {
  BTC: /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/,
  ETH: /^0x[a-fA-F0-9]{40}$/,
  USDT: /^(0x[a-fA-F0-9]{40}|T[A-Za-z1-9]{33})$/, // Ethereum or Tron
  USDC: /^0x[a-fA-F0-9]{40}$/,
  BNB: /^0x[a-fA-F0-9]{40}$/,
  SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
};

const ALLOWED_NETWORKS = [
  "Bitcoin",
  "Ethereum",
  "Tron",
  "Solana",
  "Polygon",
  "BSC",
  "Arbitrum",
  "Optimism",
];

const ALLOWED_TOKENS = ["BTC", "ETH", "USDT", "USDC", "BNB", "SOL"];

export const depositAddressSchema = z.object({
  token: z.enum(ALLOWED_TOKENS, {
    errorMap: () => ({ message: "Invalid token. Must be BTC, ETH, USDT, USDC, BNB, or SOL" }),
  }),
  address: z.string().min(1, "Address is required"),
  network: z.enum(ALLOWED_NETWORKS, {
    errorMap: () => ({ message: `Network must be one of: ${ALLOWED_NETWORKS.join(", ")}` }),
  }).optional(),
  isActive: z.boolean().optional(),
});

export const updateDepositAddressesSchema = z.object({
  addresses: z.array(depositAddressSchema).min(1, "At least one address is required"),
});

/**
 * Validate address format based on token type
 */
export function validateAddressFormat(token, address) {
  const pattern = ADDRESS_PATTERNS[token];
  if (!pattern) {
    return { valid: true, message: "No validation pattern for this token" };
  }

  const isValid = pattern.test(address);
  if (!isValid) {
    return {
      valid: false,
      message: `Invalid ${token} address format`,
    };
  }

  return { valid: true };
}

/**
 * Validate network matches token
 */
export function validateNetworkForToken(token, network) {
  const validNetworks = {
    BTC: ["Bitcoin"],
    ETH: ["Ethereum", "Polygon", "BSC", "Arbitrum", "Optimism"],
    USDT: ["Ethereum", "Tron", "Polygon", "BSC", "Arbitrum", "Optimism"],
    USDC: ["Ethereum", "Polygon", "BSC", "Arbitrum", "Optimism", "Solana"],
    BNB: ["BSC", "Ethereum"],
    SOL: ["Solana"],
  };

  const allowed = validNetworks[token] || [];
  if (!allowed.includes(network)) {
    return {
      valid: false,
      message: `${token} is not supported on ${network}. Supported networks: ${allowed.join(", ")}`,
    };
  }

  return { valid: true };
}

