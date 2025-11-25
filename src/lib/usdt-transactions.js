import { ethers } from "ethers";
import {
  TOKEN_CONTRACTS,
  requireTokenAddress,
  getTokenContractsForChain,
} from "./config.js";

// USDT ERC-20 ABI (minimal for transfers)
const USDT_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
];

// USDC ERC-20 ABI (same as USDT)
const USDC_ABI = USDT_ABI;

// Normalize and validate an Ethereum address. Accept non-checksummed by lowercasing if format is valid.
const normalizeAddress = (maybeAddress) => {
  if (typeof maybeAddress !== "string") {
    throw new Error("Invalid address: not a string");
  }
  const trimmed = maybeAddress.trim();
  try {
    return ethers.getAddress(trimmed);
  } catch {
    const lower = trimmed.toLowerCase();
    if (ethers.isAddress(lower)) return lower;
    throw new Error("Invalid Ethereum address format");
  }
};

// Get USDT contract instance
export const getUSDTContract = async (signer) => {
  const provider = signer.provider || signer;
  const network = await provider.getNetwork();
  const usdtAddress = requireTokenAddress("USDT", Number(network.chainId));
  return new ethers.Contract(usdtAddress, USDT_ABI, signer);
};

// Get USDC contract instance
export const getUSDCContract = async (signer) => {
  const provider = signer.provider || signer;
  const network = await provider.getNetwork();
  const usdcAddress = requireTokenAddress("USDC", Number(network.chainId));
  return new ethers.Contract(usdcAddress, USDC_ABI, signer);
};

// Get USDT balance for an address
export const getUSDTBalance = async (address, provider) => {
  try {
    const normalized = normalizeAddress(address);
    const network = await provider.getNetwork();
    const usdtAddress = requireTokenAddress("USDT", Number(network.chainId));
    const contract = new ethers.Contract(usdtAddress, USDT_ABI, provider);
    // Defensive: ensure the configured address is a contract on the connected network
    const code = await provider.getCode(usdtAddress);
    if (code === "0x") {
      throw new Error(
        `No contract at ${usdtAddress} on chainId ${network.chainId}. Check network and token address.`
      );
    }
    const balance = await contract.balanceOf(normalized);
    const decimals = await contract.decimals();
    return parseFloat(ethers.formatUnits(balance, decimals));
  } catch (error) {
    console.error("Error fetching USDT balance:", error);
    throw new Error("Failed to fetch USDT balance");
  }
};

// Get USDC balance for an address
export const getUSDCBalance = async (address, provider) => {
  try {
    const normalized = normalizeAddress(address);
    const network = await provider.getNetwork();
    const usdcAddress = requireTokenAddress("USDC", Number(network.chainId));
    const contract = new ethers.Contract(usdcAddress, USDC_ABI, provider);
    const balance = await contract.balanceOf(normalized);
    const decimals = await contract.decimals();
    return parseFloat(ethers.formatUnits(balance, decimals));
  } catch (error) {
    console.error("Error fetching USDC balance:", error);
    throw new Error("Failed to fetch USDC balance");
  }
};

// Transfer USDT
export const transferUSDT = async (fromAddress, toAddress, amount, signer) => {
  try {
    const from = normalizeAddress(fromAddress);
    const to = normalizeAddress(toAddress);
    const contract = await getUSDTContract(signer);
    const decimals = await contract.decimals();
    const amountWei = ethers.parseUnits(amount.toString(), decimals);

    console.log(`Transferring ${amount} USDT from ${from} to ${to}`);

    // Estimate gas for the transaction
    const gasEstimate = await contract.transfer.estimateGas(to, amountWei);

    // Execute the transfer
    const tx = await contract.transfer(to, amountWei, {
      gasLimit: gasEstimate.mul(120).div(100), // Add 20% buffer
    });

    console.log("USDT transfer transaction sent:", tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();

    return {
      success: true,
      txHash: tx.hash,
      receipt,
      amount,
      from,
      to,
    };
  } catch (error) {
    console.error("Error transferring USDT:", error);
    throw new Error(`USDT transfer failed: ${error.message}`);
  }
};

// Transfer USDC
export const transferUSDC = async (fromAddress, toAddress, amount, signer) => {
  try {
    const from = normalizeAddress(fromAddress);
    const to = normalizeAddress(toAddress);
    const contract = await getUSDCContract(signer);
    const decimals = await contract.decimals();
    const amountWei = ethers.parseUnits(amount.toString(), decimals);

    console.log(`Transferring ${amount} USDC from ${from} to ${to}`);

    // Estimate gas for the transaction
    const gasEstimate = await contract.transfer.estimateGas(to, amountWei);

    // Execute the transfer
    const tx = await contract.transfer(to, amountWei, {
      gasLimit: gasEstimate.mul(120).div(100), // Add 20% buffer
    });

    console.log("USDC transfer transaction sent:", tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();

    return {
      success: true,
      txHash: tx.hash,
      receipt,
      amount,
      from,
      to,
    };
  } catch (error) {
    console.error("Error transferring USDC:", error);
    throw new Error(`USDC transfer failed: ${error.message}`);
  }
};

// Get token information
export const getTokenInfo = async (tokenAddress, provider) => {
  try {
    const contract = new ethers.Contract(tokenAddress, USDT_ABI, provider);
    const [name, symbol, decimals] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
    ]);

    return {
      name,
      symbol,
      decimals,
      address: tokenAddress,
    };
  } catch (error) {
    console.error("Error fetching token info:", error);
    throw new Error("Failed to fetch token information");
  }
};

// Validate token address
export const isValidTokenAddress = (address) => {
  try {
    return ethers.isAddress(address);
  } catch (error) {
    return false;
  }
};

// Get token balance for any ERC-20 token
export const getTokenBalance = async (tokenAddress, userAddress, provider) => {
  try {
    const token = ethers.getAddress(tokenAddress);
    const user = normalizeAddress(userAddress);
    const contract = new ethers.Contract(token, USDT_ABI, provider);
    const balance = await contract.balanceOf(user);
    const decimals = await contract.decimals();
    return parseFloat(ethers.formatUnits(balance, decimals));
  } catch (error) {
    console.error("Error fetching token balance:", error);
    throw new Error("Failed to fetch token balance");
  }
};

// Transfer any ERC-20 token
export const transferToken = async (
  tokenAddress,
  fromAddress,
  toAddress,
  amount,
  signer
) => {
  try {
    const token = ethers.getAddress(tokenAddress);
    const from = normalizeAddress(fromAddress);
    const to = normalizeAddress(toAddress);
    const contract = new ethers.Contract(token, USDT_ABI, signer);
    const decimals = await contract.decimals();
    const amountWei = ethers.parseUnits(amount.toString(), decimals);

    // Estimate gas for the transaction
    const gasEstimate = await contract.transfer.estimateGas(to, amountWei);

    // Execute the transfer
    const tx = await contract.transfer(to, amountWei, {
      gasLimit: gasEstimate.mul(120).div(100), // Add 20% buffer
    });

    // Wait for confirmation
    const receipt = await tx.wait();

    return {
      success: true,
      txHash: tx.hash,
      receipt,
      amount,
      from: fromAddress,
      to: toAddress,
    };
  } catch (error) {
    console.error("Error transferring token:", error);
    throw new Error(`Token transfer failed: ${error.message}`);
  }
};
