"use client";

import styles from "../../styles/Landing.module.css";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ethers } from "ethers";
import QRCode from "qrcode";
import { RECEIVING_ADDRESSES } from "@/lib/config";
import {
  fetchBTCBalance,
  getBTCAddressInfo,
  isValidBTCAddress,
} from "@/lib/bitcoin";
import {
  getBitcoinBalance,
  getTransactionDetails,
  isValidBitcoinAddress as validateBTCAddress,
  isValidBitcoinAddressLenient as validateBTCLenient,
  testBitcoinAddress,
} from "@/lib/bitcoin-simple";
import {
  executeBitcoinTransfer,
  getAvailableTransferMethods,
  getNetworkFeeRates,
} from "@/lib/bitcoin-transactions";
import {
  getUSDTBalance,
  getUSDCBalance,
  transferUSDT,
  transferUSDC,
  getTokenInfo,
} from "@/lib/usdt-transactions";
import {
  createTransaction,
  createDeposit,
  createWithdrawal,
} from "@/lib/user-actions";
import { authClient } from "@/lib/auth-client";
import { useSIWE } from "@/hooks/useSIWE";

export default function PortfolioApp() {
  const router = useRouter();
  const { address: rkAddress, isConnected } = useAccount();
  
  // SIWE authentication
  const { signIn: siweSignIn, isAuthenticating: isSIWEAuthenticating } = useSIWE();
  
  // Local state for user data and session
  const [session, setSession] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [backendUser, setBackendUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [hasAttemptedSIWE, setHasAttemptedSIWE] = useState(false);
  
  // Computed values
  const userId = authUser?.id || backendUser?.id;

  const [cryptoData, setCryptoData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState("ETH");
  const [isProcessing, setIsProcessing] = useState(false);
  const [withdrawToAddress, setWithdrawToAddress] = useState("");
  const [transferMethod, setTransferMethod] = useState("server-side");
  const [availableTransferMethods, setAvailableTransferMethods] = useState([]);
  const [networkFeeRates, setNetworkFeeRates] = useState({
    low: 5000,
    medium: 10000,
    high: 20000,
  });
  const [selectedFeeRate, setSelectedFeeRate] = useState("medium");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [transactionHash, setTransactionHash] = useState("");
  const [transactionScreenshot, setTransactionScreenshot] = useState(null);
  const [depositAddresses, setDepositAddresses] = useState({
    BTC: RECEIVING_ADDRESSES.BTC,
    ETH: RECEIVING_ADDRESSES.ETH,
    USDT: RECEIVING_ADDRESSES.USDT,
    USDC: RECEIVING_ADDRESSES.ETH,
    BNB: RECEIVING_ADDRESSES.ETH,
    SOL: "",
  });

  const [balances, setBalances] = useState({
    ETH: "0.0000",
    BTC: "0.00000000",
    BNB: "0.0000",
    SOL: "0.0000",
    USDT: "0.00",
    USDC: "0.00",
  });
  const [usdBalances, setUsdBalances] = useState({
    ETH: 0,
    BTC: 0,
    BNB: 0,
    SOL: 0,
    USDT: 0,
    USDC: 0,
    total: 0,
  });
  const [prices, setPrices] = useState({});
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await authClient.getSession();
        if (data?.session && data?.user) {
          setSession(data.session);
          setAuthUser(data.user);
        }
      } catch (error) {
        console.log("No active session");
      }
    };
    checkSession();
  }, []);

  // Handle SIWE authentication when wallet connects
  useEffect(() => {
    const handleWalletAuth = async () => {
      if (!isConnected || !rkAddress) {
        setBackendUser(null);
        setHasAttemptedSIWE(false);
        return;
      }

      // Check if already authenticated with Better Auth (email/password or SIWE)
      if (session?.user) {
        // If user has no ethereumAddress, they're authenticated via email/password
        // Skip SIWE and just load their user data
        if (!session.user.ethereumAddress) {
          console.log("📧 User authenticated via email/password, skipping SIWE");
          try {
            const res = await fetch(`/api/users?userId=${session.user.id}`, {
              credentials: "include",
            });
            const userData = await res.json();
            if (userData?.success && userData.user) {
              setBackendUser(userData.user);
            }
          } catch (e) {
            console.warn("Failed to load user data", e);
          }
          return;
        }
        
        // Check if the session wallet matches connected wallet
        const sessionWallet = session.user.ethereumAddress.toLowerCase();
        const connectedWallet = rkAddress.toLowerCase();
        
        if (sessionWallet === connectedWallet) {
          // Load user data
          try {
            const res = await fetch(`/api/users?userId=${session.user.id}`, {
              credentials: "include",
            });
            const userData = await res.json();
            if (userData?.success && userData.user) {
              setBackendUser(userData.user);
            }
          } catch (e) {
            console.warn("Failed to load user data", e);
          }
          return;
        } else {
          // Different wallet connected - reset attempt flag
          setHasAttemptedSIWE(false);
        }
      }

      // Only trigger SIWE once per wallet connection
      if (hasAttemptedSIWE) {
        return;
      }

      // Not authenticated or different wallet - trigger SIWE
      try {
        setIsLoadingUser(true);
        setHasAttemptedSIWE(true);
        
        console.log("🔐 Starting SIWE authentication...");
        const result = await siweSignIn();
        
        if (result.success) {
          console.log("✅ SIWE authentication successful!");
          
          // Update session state
          setSession(result.session);
          setAuthUser(result.user);
          
          // Load user data
          try {
            const res = await fetch(`/api/users?userId=${result.user.id}`, {
              credentials: "include",
            });
            const userData = await res.json();
            if (userData?.success && userData.user) {
              setBackendUser(userData.user);
            }
          } catch (e) {
            console.warn("Failed to load user data", e);
          }
        } else {
          console.error("❌ SIWE authentication failed:", result.error);
          // Don't show alert for user rejection
          if (!result.error?.includes('rejected') && !result.error?.includes('denied')) {
            console.warn("SIWE authentication failed, but continuing without session");
          }
        }
        
      } catch (error) {
        console.error("SIWE authentication error:", error);
      } finally {
        setIsLoadingUser(false);
      }
    };

    handleWalletAuth();
  }, [isConnected, rkAddress, session, siweSignIn, hasAttemptedSIWE]);

  // Timers and data loading
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch deposit addresses from API
  useEffect(() => {
    const fetchDepositAddresses = async () => {
      try {
        const res = await fetch("/api/deposit-addresses/");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.addresses) {
            const addressMap = {};
            data.addresses.forEach((addr) => {
              addressMap[addr.token] = addr.address;
            });
            setDepositAddresses(addressMap);
          }
        }
      } catch (error) {
        console.error("Failed to fetch deposit addresses:", error);
        // Keep using env fallback addresses
      }
    };
    fetchDepositAddresses();
  }, []);

  useEffect(() => {
    const loadTransferData = async () => {
      try {
        const methods = getAvailableTransferMethods();
        setAvailableTransferMethods(methods);
        const rates = await getNetworkFeeRates();
        setNetworkFeeRates(rates);
      } catch (error) {
        console.error("Failed to load transfer data:", error);
      }
    };
    loadTransferData();
  }, []);

  useEffect(() => {
    const fetchCryptoData = async () => {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false"
        );
        const data = await response.json();
        const formatted = data.map((coin) => ({
          id: coin.id,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          price: coin.current_price,
          priceChange: coin.price_change_percentage_24h,
          priceChangeAmount: coin.price_change_24h,
          volume: coin.total_volume,
          marketCap: coin.market_cap,
          image: coin.image,
        }));
        setCryptoData(formatted);
      } catch (error) {
        console.error("Failed to fetch crypto data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCryptoData();
  }, []);

  // Price fetching and USD conversion
  const fetchAndUpdatePrices = async () => {
    try {
      const response = await fetch("/api/prices");
      const data = await response.json();
      if (data.success) {
        setPrices(data.prices);
        setLastPriceUpdate(data.timestamp);
        const newUsd = {};
        let total = 0;
        Object.keys(balances).forEach((token) => {
          if (data.prices[token]) {
            const usdValue =
              parseFloat(balances[token]) * data.prices[token].usd;
            newUsd[token] = usdValue;
            total += usdValue;
          }
        });
        newUsd.total = total;
        setUsdBalances(newUsd);
      }
    } catch (error) {
      console.error("Failed to fetch prices:", error);
    }
  };

  useEffect(() => {
    const priceInterval = setInterval(fetchAndUpdatePrices, 300000);
    return () => clearInterval(priceInterval);
  }, [balances]);

  // Wallet balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!rkAddress) return;
      try {
        const provider =
          typeof window !== "undefined" && window.ethereum
            ? new ethers.BrowserProvider(window.ethereum)
            : null;
        if (!provider) return;
        if (!ethers.isAddress(rkAddress)) {
          console.error("Invalid wallet address:", rkAddress);
          return;
        }

        const ethBalance = await provider.getBalance(rkAddress);
        const ethBalanceFormatted = ethers.formatEther(ethBalance);
        let btcBalance = "0.00000000";
        try {
          btcBalance = "0.00000000";
        } catch (btcError) {
          console.warn("Error fetching BTC balance:", btcError);
        }

        let usdtBalance = "0.00";
        let usdcBalance = "0.00";
        try {
          if (ethers.isAddress(rkAddress)) {
            usdtBalance = (
              await getUSDTBalance(rkAddress, provider)
            ).toFixed(2);
          }
        } catch (error) {
          console.warn("Error fetching USDT balance:", error);
        }

        try {
          if (ethers.isAddress(rkAddress)) {
            usdcBalance = (
              await getUSDCBalance(rkAddress, provider)
            ).toFixed(2);
          }
        } catch (error) {
          console.warn("Error fetching USDC balance:", error);
        }

        setBalances({
          ETH: parseFloat(ethBalanceFormatted).toFixed(4),
          BTC: btcBalance,
          USDT: usdtBalance,
          USDC: usdcBalance,
        });
      } catch (error) {
        console.error("Failed to fetch balances:", error);
      }
    };
    fetchBalances();
  }, [rkAddress]);

  const getReceivingAddress = (token) => {
    return depositAddresses[token] || depositAddresses.ETH || "";
  };

  const getNetworkName = (token) => {
    const networkMap = {
      BTC: "Bitcoin Network",
      ETH: "Ethereum Mainnet",
      BNB: "BSC (Binance Smart Chain)",
      SOL: "Solana Network",
      USDT: "Ethereum Mainnet",
      USDC: "Ethereum Mainnet",
    };
    return networkMap[token] || "Unknown Network";
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Address copied to clipboard!");
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      alert("Address copied to clipboard!");
    }
  };

  const generateQRCode = async (address) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(address, {
        width: 200,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
      });
      setQrCodeDataUrl(qrDataUrl);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  const generateUserId = () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    let result = "";
    for (let i = 0; i < 3; i++)
      result += letters.charAt(Math.floor(Math.random() * letters.length));
    for (let i = 0; i < 3; i++)
      result += numbers.charAt(Math.floor(Math.random() * numbers.length));
    return result;
  };

  const generateUserIdFromAddress = (address) => {
    if (!address) return generateUserId();
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    let result = "";
    for (let i = 0; i < 3; i++) {
      const charCode = address.charCodeAt(i + 2) || 0;
      result += letters[charCode % letters.length];
    }
    for (let i = 0; i < 3; i++) {
      const charCode = address.charCodeAt(i + 5) || 0;
      result += numbers[charCode % numbers.length];
    }
    return result;
  };

  const handleProofSubmission = async () => {
    if (!transactionHash || !transactionScreenshot) {
      alert("Please provide both transaction hash and screenshot");
      return;
    }
    setIsProcessing(true);
    try {
      const proofData = {
        userId,
        rkAddress,
        token: selectedToken,
        transactionHash: transactionHash.slice(-6),
        screenshot: transactionScreenshot,
        timestamp: new Date().toISOString(),
      };
      console.log("Proof submitted:", proofData);
      createDeposit(
        userId,
        rkAddress,
        selectedToken,
        depositAmount,
        transactionHash,
        transactionScreenshot
      );
      alert("Proof submitted successfully! Admin will review your deposit.");
      setShowProofModal(false);
      setTransactionHash("");
      setTransactionScreenshot(null);
    } catch (error) {
      console.error("Error submitting proof:", error);
      alert("Error submitting proof. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (
      file &&
      file.type &&
      typeof file.type === "string" &&
      file.type.startsWith("image/")
    ) {
      setTransactionScreenshot(file);
    } else {
      alert("Please select a valid image file");
    }
  };

  const handleDeposit = async () => {
    if (!rkAddress) {
      alert("Please connect your wallet first.");
      return;
    }
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    setIsProcessing(true);
    try {
      if (selectedToken === "ETH") {
        const provider =
          typeof window !== "undefined" && window.ethereum
            ? new ethers.BrowserProvider(window.ethereum)
            : null;
        const signer = provider ? await provider.getSigner() : null;
        if (!signer) throw new Error("Wallet not connected");
        const amountInWei = ethers.parseEther(depositAmount);
        const tx = { to: rkAddress, value: amountInWei };
        const transaction = await signer.sendTransaction(tx);
        await transaction.wait();
        alert(`ETH deposit successful! Transaction hash: ${transaction.hash}`);
        try {
          await fetch("/api/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              rkAddress,
              token: "ETH",
              type: "deposit",
              amount: parseFloat(depositAmount),
              transactionHash: transaction.hash,
              status: "completed",
            }),
          });
        } catch {}
        await createTransaction(
          userId,
          rkAddress,
          "ETH",
          "deposit",
          depositAmount,
          transaction.hash
        );
        if (provider) {
          const newEthBalance = await provider.getBalance(rkAddress);
          const ethBalanceFormatted = ethers.formatEther(newEthBalance);
          setBalances((prev) => ({
            ...prev,
            ETH: parseFloat(ethBalanceFormatted).toFixed(4),
          }));
        }
      } else if (selectedToken === "BTC") {
        const depositAddress = depositAddresses.BTC;
        alert(
          `BTC deposit initiated!\n\nAmount: ${depositAmount} BTC\nTo: ${depositAddress}\n\nNote: Real BTC transactions require private key access. This is a demo.`
        );
        try {
          await fetch("/api/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              rkAddress,
              token: "BTC",
              type: "deposit",
              amount: parseFloat(depositAmount),
              transactionHash: null,
              status: "pending",
            }),
          });
        } catch {}
        setTimeout(async () => {
          try {
            const newBtcBalance = await getBitcoinBalance(depositAddress);
            setBalances((prev) => ({ ...prev, BTC: newBtcBalance.toFixed(8) }));
          } catch {}
        }, 5000);
      } else if (selectedToken === "USDT") {
        const provider =
          typeof window !== "undefined" && window.ethereum
            ? new ethers.BrowserProvider(window.ethereum)
            : null;
        const signer = provider ? await provider.getSigner() : null;
        if (!signer) throw new Error("Wallet not connected");
        if (!provider) throw new Error("Provider not available");
        const currentBalance = await getUSDTBalance(rkAddress, provider);
        if (parseFloat(depositAmount) > currentBalance)
          throw new Error(
            `Insufficient USDT balance. Available: ${currentBalance} USDT`
          );
        const depositAddress = depositAddresses.USDT;
        const result = await transferUSDT(
          rkAddress,
          depositAddress,
          depositAmount,
          signer
        );
        alert(
          `USDT deposit successful!\n\nAmount: ${depositAmount} USDT\nTransaction Hash: ${result.txHash}`
        );
        try {
          await fetch("/api/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              rkAddress,
              token: "USDT",
              type: "deposit",
              amount: parseFloat(depositAmount),
              transactionHash: result.txHash,
              status: "completed",
            }),
          });
        } catch {}
        await createTransaction(
          userId,
          rkAddress,
          "USDT",
          "deposit",
          depositAmount,
          result.txHash
        );
        const newBalance = await getUSDTBalance(rkAddress, provider);
        setBalances((prev) => ({ ...prev, USDT: newBalance.toFixed(2) }));
      } else if (selectedToken === "USDC") {
        const provider =
          typeof window !== "undefined" && window.ethereum
            ? new ethers.BrowserProvider(window.ethereum)
            : null;
        const signer = provider ? await provider.getSigner() : null;
        if (!signer) throw new Error("Wallet not connected");
        if (!provider) throw new Error("Provider not available");
        const currentBalance = await getUSDCBalance(rkAddress, provider);
        if (parseFloat(depositAmount) > currentBalance)
          throw new Error(
            `Insufficient USDC balance. Available: ${currentBalance} USDC`
          );
        const depositAddress = depositAddresses.USDC;
        const result = await transferUSDC(
          rkAddress,
          depositAddress,
          depositAmount,
          signer
        );
        alert(
          `USDC deposit successful!\n\nAmount: ${depositAmount} USDC\nTransaction Hash: ${result.txHash}`
        );
        try {
          await fetch("/api/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              rkAddress,
              token: "USDC",
              type: "deposit",
              amount: parseFloat(depositAmount),
              transactionHash: result.txHash,
              status: "completed",
            }),
          });
        } catch {}
        await createTransaction(
          userId,
          rkAddress,
          "USDC",
          "deposit",
          depositAmount,
          result.txHash
        );
        const newBalance = await getUSDCBalance(rkAddress, provider);
        setBalances((prev) => ({ ...prev, USDC: newBalance.toFixed(2) }));
      }
      setShowDepositModal(false);
      setDepositAmount("");
    } catch (error) {
      console.error("Deposit failed:", error);
      alert(`Deposit failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    if (!withdrawToAddress || withdrawToAddress.trim() === "") {
      alert("Please enter a destination address.");
      return;
    }
    // Check against backend USD balance (from wallet or auth session)
    const currentBalance = backendUser?.balance || authUser?.balance || 0;
    if (currentBalance <= 0) {
      alert("You don't have any balance to withdraw. Please deposit funds first.");
      return;
    }
    if (parseFloat(withdrawAmount) > currentBalance) {
      alert(`Insufficient balance for withdrawal. Available: $${currentBalance.toFixed(2)} USD`);
      return;
    }
    setIsProcessing(true);
    try {
      // Get current user (from backend or auth session)
      const currentUser = backendUser || authUser;
      
      // Check if user is loaded
      if (!currentUser) {
        throw new Error("Please connect your wallet or sign in first");
      }

      // Create withdrawal request (USD-based simulator)
      const result = await createWithdrawal(
        currentUser.id,
        currentUser.ethereumAddress || rkAddress || "simulator",
        selectedToken,
        withdrawAmount,
        withdrawToAddress.trim(),
        "simulator"
      );

      if (result.success) {
        alert(
          `✅ Withdrawal request submitted successfully!\n\n` +
          `Amount: $${withdrawAmount} USD\n` +
          `Token: ${selectedToken}\n` +
          `To: ${withdrawToAddress.trim()}\n\n` +
          `Your request will be reviewed by an admin.`
        );
        setShowWithdrawModal(false);
        setWithdrawAmount("");
        setWithdrawToAddress("");
      } else {
        throw new Error(result.error || "Withdrawal request failed");
      }
    } catch (error) {
      console.error("Withdrawal error:", error);
      alert(`❌ Withdrawal failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Old blockchain-based withdraw handler (keeping for reference, can be removed)
  const handleWithdrawBlockchain = async () => {
    if (!rkAddress) {
      alert("Please connect your wallet first.");
      return;
    }
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    setIsProcessing(true);
    try {
      if (selectedToken === "ETH") {
        const provider =
          typeof window !== "undefined" && window.ethereum
            ? new ethers.BrowserProvider(window.ethereum)
            : null;
        const signer = provider ? await provider.getSigner() : null;
        if (!signer) throw new Error("Wallet not connected");
        if (!withdrawToAddress.trim())
          throw new Error("Please enter a destination address");
        if (
          !withdrawToAddress.startsWith("0x") ||
          withdrawToAddress.length !== 42
        )
          throw new Error("Please enter a valid Ethereum address (0x...)");
        const amountInWei = ethers.parseEther(withdrawAmount);
        const tx = { to: withdrawToAddress.trim(), value: amountInWei };
        const transaction = await signer.sendTransaction(tx);
        await transaction.wait();
        alert(
          `ETH withdrawal successful! Transaction hash: ${transaction.hash}`
        );
        await createTransaction(
          userId,
          rkAddress,
          "ETH",
          "withdrawal",
          withdrawAmount,
          transaction.hash
        );
        if (provider) {
          const newEthBalance = await provider.getBalance(rkAddress);
          const ethBalanceFormatted = ethers.formatEther(newEthBalance);
          setBalances((prev) => ({
            ...prev,
            ETH: parseFloat(ethBalanceFormatted).toFixed(4),
          }));
        }
      } else if (selectedToken === "BTC") {
        if (!withdrawToAddress.trim())
          throw new Error("Please enter a destination address");
        const isValidLenient = validateBTCLenient(withdrawToAddress.trim());
        if (!isValidLenient)
          throw new Error(
            "Please enter a valid Bitcoin address (bc1..., 1..., or 3...)"
          );
        const transferData = {
          fromAddress: depositAddresses.BTC,
          toAddress: withdrawToAddress.trim(),
          amount: parseFloat(withdrawAmount),
          feeRate: selectedFeeRate,
          network: "main",
        };
        const result = await executeBitcoinTransfer(
          transferData,
          transferMethod
        );
        if (result.success) {
          alert(
            `BTC withdrawal successful!\n\nAmount: ${withdrawAmount} BTC\nTo: ${withdrawToAddress.trim()}\nMethod: ${
              result.method
            }${result.txHash ? `\nTransaction Hash: ${result.txHash}` : ""}`
          );
          await createWithdrawal(
            userId,
            rkAddress,
            "BTC",
            withdrawAmount,
            withdrawToAddress.trim(),
            transferMethod
          );
          await createTransaction(
            userId,
            rkAddress,
            "BTC",
            "withdrawal",
            withdrawAmount,
            result.txHash || "pending"
          );
        } else {
          throw new Error(result.error || "Transfer failed");
        }
      } else if (selectedToken === "USDT") {
        const provider =
          typeof window !== "undefined" && window.ethereum
            ? new ethers.BrowserProvider(window.ethereum)
            : null;
        const signer = provider ? await provider.getSigner() : null;
        if (!signer) throw new Error("Wallet not connected");
        if (!provider) throw new Error("Provider not available");
        const currentBalance = await getUSDTBalance(rkAddress, provider);
        if (parseFloat(withdrawAmount) > currentBalance)
          throw new Error(
            `Insufficient USDT balance. Available: ${currentBalance} USDT`
          );
        if (!withdrawToAddress.trim())
          throw new Error("Please enter a destination address");
        if (
          !withdrawToAddress.startsWith("0x") ||
          withdrawToAddress.length !== 42
        )
          throw new Error(
            "Please enter a valid Ethereum address for USDT (0x...)"
          );
        const depositAddress = depositAddresses.USDT;
        const result = await transferUSDT(
          depositAddress,
          withdrawToAddress.trim(),
          withdrawAmount,
          signer
        );
        alert(
          `USDT withdrawal successful!\n\nAmount: ${withdrawAmount} USDT\nTransaction Hash: ${result.txHash}`
        );
        await createWithdrawal(
          userId,
          rkAddress,
          "USDT",
          withdrawAmount,
          withdrawToAddress.trim(),
          "server-side"
        );
        await createTransaction(
          userId,
          rkAddress,
          "USDT",
          "withdrawal",
          withdrawAmount,
          result.txHash
        );
        const newBalance = await getUSDTBalance(rkAddress, provider);
        setBalances((prev) => ({ ...prev, USDT: newBalance.toFixed(2) }));
      } else if (selectedToken === "USDC") {
        const provider =
          typeof window !== "undefined" && window.ethereum
            ? new ethers.BrowserProvider(window.ethereum)
            : null;
        const signer = provider ? await provider.getSigner() : null;
        if (!signer) throw new Error("Wallet not connected");
        if (!provider) throw new Error("Provider not available");
        const currentBalance = await getUSDCBalance(rkAddress, provider);
        if (parseFloat(withdrawAmount) > currentBalance)
          throw new Error(
            `Insufficient USDC balance. Available: ${currentBalance} USDC`
          );
        if (!withdrawToAddress.trim())
          throw new Error("Please enter a destination address");
        if (
          !withdrawToAddress.startsWith("0x") ||
          withdrawToAddress.length !== 42
        )
          throw new Error(
            "Please enter a valid Ethereum address for USDC (0x...)"
          );
        const depositAddress = depositAddresses.USDC;
        const result = await transferUSDC(
          depositAddress,
          withdrawToAddress.trim(),
          withdrawAmount,
          signer
        );
        alert(
          `USDC withdrawal successful!\n\nAmount: ${withdrawAmount} USDC\nTransaction Hash: ${result.txHash}`
        );
        await createWithdrawal(
          userId,
          rkAddress,
          "USDC",
          withdrawAmount,
          withdrawToAddress.trim(),
          "server-side"
        );
        await createTransaction(
          userId,
          rkAddress,
          "USDC",
          "withdrawal",
          withdrawAmount,
          result.txHash
        );
        const newBalance = await getUSDCBalance(rkAddress, provider);
        setBalances((prev) => ({ ...prev, USDC: newBalance.toFixed(2) }));
      }
      setShowWithdrawModal(false);
      setWithdrawAmount("");
    } catch (error) {
      console.error("Withdrawal failed:", error);
      alert(`Withdrawal failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatVolume = (volume) => {
    if (volume >= 1e9) return `$${(volume / 1e9).toFixed(1)}B`;
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(1)}M`;
    if (volume >= 1e3) return `$${(volume / 1e3).toFixed(1)}K`;
    return `$${volume.toFixed(0)}`;
  };

  const formatPrice = (price) => {
    if (price >= 1000)
      return price.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    if (price >= 1) return price.toFixed(2);
    if (price >= 0.01) return price.toFixed(4);
    return price.toFixed(6);
  };

  const formatPriceChange = (change) => {
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(2)}%`;
  };

  const formatPriceChangeAmount = (amount) => {
    const sign = amount >= 0 ? "+" : "";
    if (Math.abs(amount) >= 1)
      return `(${sign}$${Math.abs(amount).toFixed(2)})`;
    if (Math.abs(amount) >= 0.01)
      return `(${sign}$${Math.abs(amount).toFixed(4)})`;
    return `(${sign}$${Math.abs(amount).toFixed(6)})`;
  };

  const getCurrentBalance = () => balances[selectedToken] || "0.0000";

  const gainingCoins = cryptoData.filter((coin) => coin.priceChange > 0).length;
  const decliningCoins = cryptoData.filter(
    (coin) => coin.priceChange < 0
  ).length;
  const totalVolume = cryptoData.reduce((sum, coin) => sum + coin.volume, 0);

  if (!isConnected || !rkAddress) {
    return (
      <main className={styles.container}>
        <div className={styles.walletGate}>
          <div className={styles.walletGateContent}>
            <div className={styles.walletGateTitle}>
              <h1>Connect your wallet to view your portfolio</h1>
              <p>
                <a href="/">Go to landing</a> to connect.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <section className={styles.walletSection}>
        <div className={styles.walletCard}>
          <div className={styles.walletHeader}>
            <span className={styles.walletStatus}>
              {rkAddress
                ? userId
                  ? `User ID: ${userId}`
                  : "User ID: Loading..."
                : "No Wallet Connected"}
            </span>
            <div className={styles.welcomeText}>
              Welcome!{" "}
              {currentTime.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}{" "}
              at{" "}
              {currentTime.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>

          <div className={styles.walletBalance}>
            <div className={styles.balanceHeader}>
              <div className={styles.balanceLabel}>Portfolio Balance (USD)</div>
            </div>
            <div className={styles.balanceDisplay}>
              <div className={styles.totalUSD}>
                Total Portfolio Value:{" "}
                <span className={styles.totalUSDValue}>
                  $
                  {typeof backendUser?.balance === "number"
                    ? backendUser.balance.toFixed(2)
                    : typeof authUser?.balance === "number"
                    ? authUser.balance.toFixed(2)
                    : usdBalances.total?.toFixed(2) || "0.00"}
                </span>
              </div>
              {lastPriceUpdate && (
                <div className={styles.priceUpdate}>
                  Last updated: {new Date(lastPriceUpdate).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>

          {/* <div className={styles.walletStats}>
            <div className={styles.stat}>
              <div className={styles.statValue}>
                <span className={styles.statPositive}>+$0.00</span>
                <span className={styles.statArrow}>↗</span>
              </div>
              <div className={styles.statLabel}>Today's P&L (USD)</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>
                <span className={styles.statPositive}>+0.00%</span>
                <span className={styles.statArrow}>↗</span>
              </div>
              <div className={styles.statLabel}>ROI</div>
              <div className={styles.statDate}>
                Today,{" "}
                {currentTime.toLocaleDateString("en-US", {
                  month: "numeric",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
          </div> */}

          <div className={styles.walletActions}>
            <button
              className={styles.actionButton}
              onClick={() => {
                setShowDepositModal(true);
                generateQRCode(getReceivingAddress(selectedToken));
              }}
              disabled={!rkAddress}
            >
              <span className={styles.actionIcon}>↓</span>
              Deposit
            </button>
            <button
              className={styles.actionButton}
              onClick={() => setShowWithdrawModal(true)}
              disabled={(!backendUser && !authUser) || ((backendUser?.balance || authUser?.balance || 0) <= 0)}
            >
              <span className={styles.actionIcon}>✈</span>
              Withdraw
            </button>
          </div>
        </div>
      </section>

      {showDepositModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => !isProcessing && setShowDepositModal(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Deposit Funds</h3>
              <button
                className={styles.modalClose}
                onClick={() => setShowDepositModal(false)}
                disabled={isProcessing}
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.inputGroup}>
                <label>Token</label>
                <select
                  value={selectedToken}
                  onChange={(e) => {
                    setSelectedToken(e.target.value);
                    generateQRCode(getReceivingAddress(e.target.value));
                  }}
                  disabled={isProcessing}
                  className={styles.modalSelect}
                >
                  <option value="ETH">Ethereum (ETH)</option>
                  <option value="BTC">Bitcoin (BTC)</option>
                  <option value="BNB">Binance Coin (BNB)</option>
                  <option value="SOL">Solana (SOL)</option>
                  <option value="USDT">Tether (USDT)</option>
                  <option value="USDC">USD Coin (USDC)</option>
                </select>
              </div>
              <div className={styles.modalInfo}>
                <p>
                  Current Balance: $
                  {typeof backendUser?.balance === "number"
                    ? backendUser.balance.toFixed(2)
                    : "0.00"}{" "}
                  USD
                </p>
                <p>
                  Network: {getNetworkName(selectedToken)}
                </p>
                <div className={styles.receivingAddress}>
                  <label>Receiving Address:</label>
                  <div className={styles.addressDisplay}>
                    <code>{getReceivingAddress(selectedToken)}</code>
                    <button
                      className={styles.copyButton}
                      onClick={() =>
                        copyToClipboard(getReceivingAddress(selectedToken))
                      }
                      title="Copy address"
                    >
                      📋
                    </button>
                  </div>
                  {qrCodeDataUrl && (
                    <div className={styles.qrCodeContainer}>
                      <img
                        src={qrCodeDataUrl}
                        alt="QR Code"
                        className={styles.qrCode}
                      />
                      <p>Scan QR code to get the address</p>
                    </div>
                  )}
                  <p className={styles.addressNote}>
                    Send {selectedToken} to this address to complete your
                    deposit
                  </p>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.modalButtonSecondary}
                onClick={() => setShowDepositModal(false)}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                className={styles.modalButtonPrimary}
                onClick={() => {
                  setShowDepositModal(false);
                  setShowProofModal(true);
                }}
                disabled={isProcessing}
              >
                Submit Proof
              </button>
            </div>
          </div>
        </div>
      )}

      {showProofModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => !isProcessing && setShowProofModal(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Submit Transaction Proof</h3>
              <button
                className={styles.modalClose}
                onClick={() => setShowProofModal(false)}
                disabled={isProcessing}
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.inputGroup}>
                <label>Transaction Hash (Last 6 digits)</label>
                <input
                  type="text"
                  value={transactionHash}
                  onChange={(e) => setTransactionHash(e.target.value)}
                  placeholder="Enter last 6 digits of transaction hash"
                  disabled={isProcessing}
                  className={styles.modalInput}
                />
              </div>
              <div className={styles.inputGroup}>
                <label>Transaction Screenshot</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                  className={styles.modalInput}
                />
                {transactionScreenshot && (
                  <p className={styles.fileSelected}>
                    File selected: {transactionScreenshot.name}
                  </p>
                )}
              </div>
              <div className={styles.modalInfo}>
                <p>
                  <strong>User ID:</strong> {userId}
                </p>
                <p>
                  <strong>Token:</strong> {selectedToken}
                </p>
                <p>
                  <strong>Wallet Address:</strong> {rkAddress}
                </p>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.modalButtonSecondary}
                onClick={() => setShowProofModal(false)}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                className={styles.modalButtonPrimary}
                onClick={handleProofSubmission}
                disabled={
                  isProcessing || !transactionHash || !transactionScreenshot
                }
              >
                {isProcessing ? "Submitting..." : "Submit Proof"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showWithdrawModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => !isProcessing && setShowWithdrawModal(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Withdraw Funds</h3>
              <button
                className={styles.modalClose}
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawToAddress("");
                }}
                disabled={isProcessing}
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.inputGroup}>
                <label>Amount (USD)</label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={backendUser?.balance || 0}
                  disabled={isProcessing}
                  className={styles.modalInput}
                />
              </div>
              <div className={styles.inputGroup}>
                <label>Token</label>
                <select
                  value={selectedToken}
                  onChange={(e) => setSelectedToken(e.target.value)}
                  disabled={isProcessing}
                  className={styles.modalSelect}
                >
                  <option value="ETH">Ethereum (ETH)</option>
                  <option value="BTC">Bitcoin (BTC)</option>
                  <option value="BNB">Binance Coin (BNB)</option>
                  <option value="SOL">Solana (SOL)</option>
                  <option value="USDT">Tether (USDT)</option>
                  <option value="USDC">USD Coin (USDC)</option>
                </select>
              </div>
              <div className={styles.inputGroup}>
                <label>Destination Address</label>
                <input
                  type="text"
                  value={withdrawToAddress}
                  onChange={(e) => setWithdrawToAddress(e.target.value)}
                  placeholder={selectedToken === "BTC" ? "bc1..." : "0x..."}
                  disabled={isProcessing}
                  className={styles.modalInput}
                />
                <small className={styles.inputHelp}>
                  Paste the {selectedToken} address you want to withdraw to
                </small>
              </div>
              {selectedToken === "BTC" && (
                <>
                  <div className={styles.inputGroup}>
                    <label>Transfer Method</label>
                    <select
                      value={transferMethod}
                      onChange={(e) => setTransferMethod(e.target.value)}
                      disabled={isProcessing}
                      className={styles.modalSelect}
                    >
                      {availableTransferMethods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.name}{" "}
                          {method.recommended ? "(Recommended)" : ""}
                        </option>
                      ))}
                    </select>
                    <small className={styles.inputHelp}>
                      Choose how to process your Bitcoin transfer
                    </small>
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Fee Rate</label>
                    <select
                      value={selectedFeeRate}
                      onChange={(e) => setSelectedFeeRate(e.target.value)}
                      disabled={isProcessing}
                      className={styles.modalSelect}
                    >
                      <option value="low">
                        Low ({networkFeeRates.low} sat/byte)
                      </option>
                      <option value="medium">
                        Medium ({networkFeeRates.medium} sat/byte)
                      </option>
                      <option value="high">
                        High ({networkFeeRates.high} sat/byte)
                      </option>
                    </select>
                    <small className={styles.inputHelp}>
                      Higher fees = faster confirmation
                    </small>
                  </div>
                </>
              )}
              <div className={styles.modalInfo}>
                <p>
                  Available Balance: $
                  {typeof backendUser?.balance === "number"
                    ? backendUser.balance.toFixed(2)
                    : "0.00"}{" "}
                  USD
                </p>
                <p>
                  Network: {getNetworkName(selectedToken)}
                </p>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.modalButtonSecondary}
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawToAddress("");
                }}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                className={styles.modalButtonPrimary}
                onClick={handleWithdraw}
                disabled={
                  isProcessing ||
                  !withdrawAmount ||
                  parseFloat(withdrawAmount) <= 0 ||
                  parseFloat(withdrawAmount) >
                    parseFloat(getCurrentBalance()) ||
                  !withdrawToAddress.trim()
                }
              >
                {isProcessing ? "Processing..." : "Withdraw"}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className={styles.chartsSection}>
        <h2>Live Crypto Charts</h2>
        <p>Real-time cryptocurrency prices and market data</p>
      </section>

      <section className={styles.marketSection}>
        <div className={styles.marketHeader}>
          <div>
            <h2>Live Crypto Market</h2>
            <p>Real-time cryptocurrency prices and trading</p>
          </div>
          <button
            className={styles.refreshButton}
            onClick={() => window.location.reload()}
          >
            <span className={styles.refreshIcon}>↻</span>
            Refresh
          </button>
        </div>
        {isLoading ? (
          <div className={styles.loading}>Loading market data...</div>
        ) : (
          <div className={styles.cryptoList}>
            {cryptoData.map((coin) => (
              <div key={coin.id} className={styles.cryptoListItem}>
                <div className={styles.cryptoListHeader}>
                  <div className={styles.cryptoListLeft}>
                    <img
                      src={coin.image}
                      alt={coin.name}
                      className={styles.cryptoIcon}
                    />
                    <div className={styles.cryptoListInfo}>
                      <div className={styles.cryptoSymbol}>{coin.symbol}</div>
                      <div className={styles.cryptoName}>{coin.name}</div>
                    </div>
                  </div>
                  <div className={styles.cryptoListCenter}>
                    <div className={styles.cryptoPrice}>
                      ${formatPrice(coin.price)}
                    </div>
                    <div className={styles.cryptoChange}>
                      <span
                        className={
                          coin.priceChange >= 0
                            ? styles.positive
                            : styles.negative
                        }
                      >
                        {formatPriceChange(coin.priceChange)}{" "}
                        {formatPriceChangeAmount(coin.priceChangeAmount)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.cryptoListRight}>
                    <div className={styles.cryptoVolume}>
                      Volume: {formatVolume(coin.volume)}
                    </div>
                    <div className={styles.cryptoTrend}>
                      <span
                        className={
                          coin.priceChange >= 0 ? styles.bull : styles.bear
                        }
                      >
                        {coin.priceChange >= 0 ? "↗ BULL" : "↘ BEAR"}
                      </span>
                    </div>
                    <button
                      className={styles.tradeButton}
                      onClick={() => router.push(`/trade?symbol=${coin.symbol}`)}
                    >
                      Trade {coin.symbol}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.marketSummary}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Gaining</span>
          <span className={styles.summaryValue}>{gainingCoins}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Declining</span>
          <span className={styles.summaryValue}>{decliningCoins}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Volume</span>
          <span className={styles.summaryValue}>
            {formatVolume(totalVolume)}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Cryptocurrencies</span>
          <span className={styles.summaryValue}>{cryptoData.length}</span>
        </div>
      </section>

      <section className={styles.tradingInfo}>
        <p>
          Click on any cryptocurrency above to start trading. You'll be
          redirected to the trading page where you can place UP/DOWN trades with
          automated 50-50 resolution.
        </p>
      </section>

      <section className={styles.quickActions}>
        <a href="/market" className={styles.quickActionButton}>
          Market Analysis
        </a>
        <a href="/ai-trading" className={styles.quickActionButton}>
          Intelligent AI Trading
        </a>
      </section>
    </main>
  );
}

