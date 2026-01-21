"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";
import { authClient } from "@/lib/auth-client";
import { getCurrentPrices } from "@/lib/price-converter";

const defaultBalanceModalState = {
  open: false,
  user: null,
  mode: "set",
  amount: "",
};

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [depositAddresses, setDepositAddresses] = useState([]);
  const [addressErrors, setAddressErrors] = useState({});
  const [trades, setTrades] = useState([]);
  const [tradeFilter, setTradeFilter] = useState("all"); // all, PENDING, WON, LOST, CLOSED
  const [tradeStats, setTradeStats] = useState({ total: 0, pending: 0, won: 0, lost: 0, closed: 0 });
  const [activeTab, setActiveTab] = useState("users"); // 'users', 'trades', 'deposits', 'withdrawals', 'settings'
  const [currentTime, setCurrentTime] = useState(new Date());
  const [statistics, setStatistics] = useState({
    totalUsers: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalDepositsUSD: 0,
    totalDepositedAllUSD: 0,
    totalWithdrawalsUSD: 0,
    totalCurrentBalanceUSD: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
  });
  const [adminNotes, setAdminNotes] = useState("");
  const [balanceModal, setBalanceModal] = useState(() => ({
    ...defaultBalanceModalState,
  }));
  const [balanceError, setBalanceError] = useState("");
  const [balanceSaving, setBalanceSaving] = useState(false);
  const isBusy = actionLoading || isRefreshing;

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data } = await authClient.getSession();
        if (data?.user) {
          setSession(data);
          setIsAuthLoading(false);
        } else {
          router.push("/admin/sign-in");
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/admin/sign-in");
      } finally {
        setIsAuthLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load admin data when session is available
  useEffect(() => {
    if (session) {
      loadAdminData();
    }
  }, [session]);

  const loadAdminData = async () => {
    try {
      // Fetch all data in parallel (with credentials to send session cookies)
      const [
        usersRes,
        withdrawalsRes,
        depositAddressesRes,
        depositsRes,
        tradesRes,
        transactionsRes,
      ] = await Promise.all([
        fetch("/api/users", { credentials: "include" }),
        fetch("/api/withdraw/requests", { credentials: "include" }),
        fetch("/api/deposit-addresses/", { credentials: "include" }),
        fetch("/api/deposits/", { credentials: "include" }),
        fetch("/api/admin/trades", { credentials: "include" }),
        fetch("/api/transactions", { credentials: "include" }),
      ]);

      const usersData = await usersRes.json();
      const withdrawalsData = await withdrawalsRes.json();
      const depositAddressesData = await depositAddressesRes.json();
      const depositsData = await depositsRes.json();
      const tradesData = await tradesRes.json();
      const transactionsData = await transactionsRes.json();

      const fetchedUsers = usersData.users || [];
      const fetchedWithdrawals = withdrawalsData.withdrawRequests || [];
      const fetchedDepositAddresses = depositAddressesData.addresses || [];
      const fetchedDeposits = depositsData.deposits || [];
      const fetchedTrades = tradesData.trades || [];
      const fetchedTradeStats = tradesData.stats || { total: 0, pending: 0, won: 0, lost: 0, closed: 0 };
      const fetchedTransactions = transactionsData.transactions || [];

      setUsers(fetchedUsers);
      setWithdrawals(fetchedWithdrawals);
      setDepositAddresses(fetchedDepositAddresses);
      setDeposits(fetchedDeposits);
      setTrades(fetchedTrades);
      setTradeStats(fetchedTradeStats);

      // Calculate statistics from user data, deposits, and withdrawals
      const totalCurrentBalanceUSD = fetchedUsers.reduce(
        (sum, user) => sum + (user.balance || 0),
        0
      );
      
      const prices = await getCurrentPrices();
      const toUSD = (amount, token) => {
        const safeAmount = Number(amount) || 0;
        const normalizedToken = (token || "USDT").toUpperCase();
        const price = prices?.[normalizedToken]?.usd;
        return price ? safeAmount * price : safeAmount;
      };

      const depositTransactions = fetchedTransactions.filter(
        (tx) => String(tx.type || "").toLowerCase() === "deposit"
      );

      const isConfirmed = (status) =>
        ["CONFIRMED", "COMPLETED", "APPROVED"].includes(
          String(status || "").toUpperCase()
        );
      const isPending = (status) =>
        String(status || "").toUpperCase() === "PENDING";

      const confirmedDeposits = fetchedDeposits.filter((d) => isConfirmed(d.status));
      const confirmedDepositTxs = depositTransactions.filter((tx) =>
        isConfirmed(tx.status)
      );

      // Calculate total deposits (confirmed only) across deposits + transactions
      const totalDepositsUSD =
        confirmedDeposits.reduce((sum, d) => sum + toUSD(d.amount, d.token), 0) +
        confirmedDepositTxs.reduce((sum, tx) => sum + toUSD(tx.amount, tx.token), 0);

      // Total deposited (all statuses) across deposits + transactions
      const totalDepositedAllUSD =
        fetchedDeposits.reduce((sum, d) => sum + toUSD(d.amount, d.token), 0) +
        depositTransactions.reduce((sum, tx) => sum + toUSD(tx.amount, tx.token), 0);

      const pendingDeposits =
        fetchedDeposits.filter((d) => isPending(d.status)).length +
        depositTransactions.filter((tx) => isPending(tx.status)).length;
      
      // Calculate total withdrawals (approved + pending)
      const totalWithdrawalsUSD = fetchedWithdrawals
        .filter((w) => w.status === "APPROVED" || w.status === "PENDING")
        .reduce((sum, w) => sum + (w.amount || 0), 0);
      
      const pendingWithdrawals = fetchedWithdrawals.filter((w) => w.status === "PENDING").length;

      setStatistics({
        totalUsers: fetchedUsers.length,
        totalDeposits: fetchedDeposits.length + depositTransactions.length,
        totalWithdrawals: fetchedWithdrawals.length,
        totalDepositsUSD: totalDepositsUSD,
        totalDepositedAllUSD: totalDepositedAllUSD,
        totalWithdrawalsUSD: totalWithdrawalsUSD,
        totalCurrentBalanceUSD: totalCurrentBalanceUSD,
        pendingDeposits: pendingDeposits,
        pendingWithdrawals: pendingWithdrawals,
      });

    } catch (error) {
      console.error("Failed to load admin data:", error);
      // Set empty data on error
      setUsers([]);
      setDeposits([]);
      setWithdrawals([]);
      setStatistics({
        totalUsers: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalDepositsUSD: 0,
        totalDepositedAllUSD: 0,
        totalWithdrawalsUSD: 0,
        totalCurrentBalanceUSD: 0,
        pendingDeposits: 0,
        pendingWithdrawals: 0,
      });
    }
  };

  const openBalanceModal = (user) => {
    setBalanceError("");
    setBalanceSaving(false);
    setBalanceModal({
      open: true,
      user,
      mode: "set",
      amount:
        typeof user?.balance === "number"
          ? user.balance.toFixed(2)
          : "",
    });
  };

  const closeBalanceModal = () => {
    setBalanceModal({ ...defaultBalanceModalState });
    setBalanceError("");
    setBalanceSaving(false);
  };

  const submitBalanceUpdate = async () => {
    if (!balanceModal.user?.id) return;
    const value = Number(balanceModal.amount);
    if (!Number.isFinite(value)) {
      setBalanceError("Enter a valid numeric amount.");
      return;
    }

    setBalanceSaving(true);
    setBalanceError("");

    try {
      const res = await fetch(
        `/api/admin/users/${balanceModal.user.id}/balance`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: balanceModal.mode === "delta" ? "delta" : "set",
            amount: value,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to update balance");
      }
      const updatedUser = data?.user;
      alert("Balance updated successfully.");
      if (updatedUser?.id) {
        const previousUser = users.find((user) => user.id === updatedUser.id);
        const previousBalance = previousUser?.balance ?? 0;
        const nextBalance = updatedUser.balance ?? previousBalance;
        const delta = nextBalance - previousBalance;
        setUsers((prev) =>
          prev.map((user) =>
            user.id === updatedUser.id ? { ...user, ...updatedUser } : user
          )
        );
        if (delta !== 0) {
          setStatistics((prev) => ({
            ...prev,
            totalCurrentBalanceUSD: (prev.totalCurrentBalanceUSD || 0) + delta,
          }));
        }
      }
      closeBalanceModal();
    } catch (error) {
      setBalanceError(error.message || "Failed to update balance.");
    } finally {
      setBalanceSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      router.push("/admin/sign-in");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAmount = (amount, token) => {
    if (token === "BTC") {
      return `${parseFloat(amount).toFixed(8)} BTC`;
    } else if (token === "ETH") {
      return `${parseFloat(amount).toFixed(4)} ETH`;
    } else {
      return `${parseFloat(amount).toFixed(2)} ${token}`;
    }
  };

  const getTradeRemainingSeconds = (trade) => {
    const openTime = new Date(trade.priceOpenAt || trade.createdAt).getTime();
    const endTime = openTime + trade.timeframe * 1000;
    const remaining = Math.floor((endTime - currentTime.getTime()) / 1000);
    return Math.max(0, remaining);
  };

  const formatCountdown = (seconds) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleApproveDeposit = async (depositId) => {
    setActionLoading(true);
    try {
      alert("Deposit approval not implemented in this version.");
    } catch (error) {
      console.error("Error approving deposit:", error);
      alert("Error approving deposit");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDeposit = async (depositId) => {
    setActionLoading(true);
    try {
      alert("Deposit rejection not implemented in this version.");
    } catch (error) {
      console.error("Error rejecting deposit:", error);
      alert("Error rejecting deposit");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveWithdrawal = async (withdrawalId) => {
    const existing = withdrawals.find((w) => w.id === withdrawalId);
    setActionLoading(true);
    try {
      const res = await fetch("/api/withdraw/manage", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId: withdrawalId, status: "APPROVED", adminNotes }),
      });
      if (res.ok) {
        alert("Withdrawal approved successfully!");
        setWithdrawals((prev) =>
          prev.map((w) =>
            w.id === withdrawalId
              ? { ...w, status: "APPROVED", resolvedAt: new Date().toISOString() }
              : w
          )
        );
        if (existing?.status === "PENDING") {
          setStatistics((prev) => ({
            ...prev,
            pendingWithdrawals: Math.max(0, (prev.pendingWithdrawals || 0) - 1),
          }));
        }
        setAdminNotes("");
      } else {
        const error = await res.json();
        alert(`Failed to approve withdrawal: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error approving withdrawal:", error);
      alert("Error approving withdrawal");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectWithdrawal = async (withdrawalId) => {
    const existing = withdrawals.find((w) => w.id === withdrawalId);
    setActionLoading(true);
    try {
      const res = await fetch("/api/withdraw/manage", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId: withdrawalId, status: "REJECTED", adminNotes }),
      });
      if (res.ok) {
        alert("Withdrawal rejected successfully!");
        setWithdrawals((prev) =>
          prev.map((w) =>
            w.id === withdrawalId
              ? { ...w, status: "REJECTED", resolvedAt: new Date().toISOString() }
              : w
          )
        );
        if (existing?.status === "PENDING") {
          const amount = Number(existing?.amount) || 0;
          setStatistics((prev) => ({
            ...prev,
            pendingWithdrawals: Math.max(0, (prev.pendingWithdrawals || 0) - 1),
            totalWithdrawalsUSD:
              Math.max(0, (prev.totalWithdrawalsUSD || 0) - amount),
          }));
        }
        setAdminNotes("");
      } else {
        const error = await res.json();
        alert(`Failed to reject withdrawal: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error rejecting withdrawal:", error);
      alert("Error rejecting withdrawal");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateDepositAddresses = async () => {
    // Client-side validation
    const errors = [];
    for (const addr of depositAddresses) {
      if (!addr.address || addr.address.trim() === "") {
        errors.push(`${addr.token}: Address is required`);
      }
      if (!addr.network || addr.network.trim() === "") {
        errors.push(`${addr.token}: Network is required`);
      }
    }

    if (errors.length > 0) {
      alert("Please fix the following errors:\n\n" + errors.join("\n"));
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/deposit-addresses/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ addresses: depositAddresses }),
      });
      
      if (res.ok) {
        alert("✅ Deposit addresses updated successfully!");
      } else {
        const error = await res.json();
        let errorMessage = error.error || "Unknown error";
        if (error.details && Array.isArray(error.details)) {
          errorMessage += "\n\n" + error.details.map(d => 
            d.token ? `${d.token}: ${d.error || d.message}` : JSON.stringify(d)
          ).join("\n");
        }
        alert(`❌ Failed to update deposit addresses:\n\n${errorMessage}`);
      }
    } catch (error) {
      console.error("Error updating deposit addresses:", error);
      alert("❌ Error updating deposit addresses: " + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDepositAddressChange = (token, field, value) => {
    setDepositAddresses((prev) =>
      prev.map((addr) =>
        addr.token === token ? { ...addr, [field]: value } : addr
      )
    );
  };

  const handleExportData = async () => {
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `walletbase-data-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert("Data exported successfully!");
    } catch (error) {
      console.error("Error exporting data:", error);
      alert("Error exporting data");
    }
  };

  const handleClearData = () => {
    alert(
      "Data clearing is not available with MongoDB backend. Data is persistent and secure."
    );
  };

  const handleRefreshData = () => {
    setIsRefreshing(true);
    loadAdminData().finally(() => {
      setIsRefreshing(false);
    });
  };

  const handleResolveTrade = async (tradeId, result) => {
    if (!confirm(`Are you sure you want to mark this trade as ${result}?`)) {
      return;
    }

    const existingTrade = trades.find((trade) => trade.id === tradeId);
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/trades/${tradeId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ result }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message || `Trade resolved as ${result}`);
        if (data?.scheduled) {
          setTrades((prev) =>
            prev.map((trade) =>
              trade.id === tradeId
                ? { ...trade, adminResult: result }
                : trade
            )
          );
        } else if (data?.trade) {
          const nextStatus = data.trade.status || result;
          setTrades((prev) =>
            prev.map((trade) =>
              trade.id === tradeId ? { ...trade, ...data.trade } : trade
            )
          );
          if (existingTrade?.status && existingTrade.status !== nextStatus) {
            setTradeStats((prev) => {
              const next = { ...prev };
              const mapKey = (status) => {
                const key = status?.toLowerCase();
                if (key === "pending") return "pending";
                if (key === "won") return "won";
                if (key === "lost") return "lost";
                if (key === "closed") return "closed";
                return null;
              };
              const fromKey = mapKey(existingTrade.status);
              const toKey = mapKey(nextStatus);
              if (fromKey && typeof next[fromKey] === "number") {
                next[fromKey] = Math.max(0, next[fromKey] - 1);
              }
              if (toKey && typeof next[toKey] === "number") {
                next[toKey] += 1;
              }
              return next;
            });
          }
          if (existingTrade && result === "WON") {
            const amount = Number(existingTrade.amount) || 0;
            const returnPct = Number(existingTrade.returnPct) || 0;
            const returnAmount = amount * (returnPct / 100);
            const balanceChange = amount + returnAmount;
            if (balanceChange > 0) {
              setUsers((prev) =>
                prev.map((user) =>
                  user.id === existingTrade.userId
                    ? { ...user, balance: (user.balance || 0) + balanceChange }
                    : user
                )
              );
              setStatistics((prev) => ({
                ...prev,
                totalCurrentBalanceUSD:
                  (prev.totalCurrentBalanceUSD || 0) + balanceChange,
              }));
            }
          }
        }
      } else {
        const error = await res.json();
        alert(`Failed to resolve trade: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error resolving trade:", error);
      alert("Error resolving trade");
    } finally {
      setActionLoading(false);
    }
  };

  const getFilteredTrades = () => {
    if (tradeFilter === "all") return trades;
    return trades.filter((t) => t.status === tradeFilter);
  };

  // Show loading state while checking authentication
  if (isAuthLoading) {
    return (
      <main className={styles.container}>
        <div className={styles.loginContainer}>
          <div className={styles.loginCard}>
            <div className={styles.loginHeader}>
              <h1>🔐 Admin Panel</h1>
              <p>Loading...</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // If no session, redirect will happen via useEffect
  if (!session) {
    return null;
  }

  // Admin dashboard
  return (
    <>
      <main className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>🔐 Admin Dashboard</h1>
          <p>
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
          </p>
        </div>
        <div className={styles.headerRight}>
          <button
            onClick={handleRefreshData}
            className={styles.refreshButton}
            disabled={isBusy}
          >
            {isRefreshing ? "Refreshing..." : "🔄 Refresh"}
          </button>
          <button onClick={handleExportData} className={styles.exportButton}>
            📊 Export Data
          </button>
          <button onClick={handleClearData} className={styles.clearButton}>
            🗑️ Clear Data
          </button>
          <button onClick={handleLogout} className={styles.logoutButton}>
            Logout
          </button>
        </div>
      </header>

      {/* Statistics Overview */}
      <section className={styles.statisticsSection}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{statistics?.totalUsers ?? 0}</div>
          <div className={styles.statLabel}>Total Users</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            $
            {(statistics?.totalDepositsUSD ?? 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className={styles.statLabel}>Total Deposits (USD)</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            $
            {(statistics?.totalDepositedAllUSD ?? 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className={styles.statLabel}>Total Deposited (USD)</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            $
            {(statistics?.totalWithdrawalsUSD ?? 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className={styles.statLabel}>Total Withdrawals (USD)</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            {statistics?.pendingDeposits ?? 0}
          </div>
          <div className={styles.statLabel}>Pending Deposits</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            {statistics?.pendingWithdrawals ?? 0}
          </div>
          <div className={styles.statLabel}>Pending Withdrawals</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            $
            {(statistics?.totalCurrentBalanceUSD ?? 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className={styles.statLabel}>Total Current Balance (USD)</div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <nav className={styles.tabs}>
        <button
          className={`${styles.tab} ${
            activeTab === "users" ? styles.activeTab : ""
          }`}
          onClick={() => setActiveTab("users")}
        >
          👥 Users ({users?.length ?? 0})
        </button>
        <button
          className={`${styles.tab} ${
            activeTab === "trades" ? styles.activeTab : ""
          }`}
          onClick={() => setActiveTab("trades")}
        >
          📈 Trades ({trades?.length ?? 0})
        </button>
        <button
          className={`${styles.tab} ${
            activeTab === "deposits" ? styles.activeTab : ""
          }`}
          onClick={() => setActiveTab("deposits")}
        >
          📥 Deposits ({deposits?.length ?? 0})
        </button>
        <button
          className={`${styles.tab} ${
            activeTab === "withdrawals" ? styles.activeTab : ""
          }`}
          onClick={() => setActiveTab("withdrawals")}
        >
          📤 Withdrawals ({withdrawals?.length ?? 0})
        </button>
        <button
          className={`${styles.tab} ${
            activeTab === "settings" ? styles.activeTab : ""
          }`}
          onClick={() => setActiveTab("settings")}
        >
          ⚙️ Settings
        </button>
      </nav>

      {/* Content Area */}
      <div className={styles.content}>
        {activeTab === "users" && (
          <section className={styles.usersSection}>
            <div className={styles.sectionHeader}>
              <h2>Registered Users</h2>
              <p>Total users: {users?.length ?? 0}</p>
            </div>
            <div className={styles.tableContainer}>
              {!users || users.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>👥</div>
                  <h3>No Users Registered</h3>
                  <p>
                    No users have registered yet. Users will appear here when
                    they connect their wallets.
                  </p>
                </div>
              ) : (
                <table className={styles.usersTable}>
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Wallet Address</th>
                      <th>Join Date</th>
                      <th>Total Deposits (USD)</th>
                      <th>Total Withdrawals (USD)</th>
                      <th>Current Balance (USD)</th>
                      <th>Last Activity</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr
                        key={user.id || user._id || user.userId}
                        className={styles.tableRow}
                      >
                        <td className={styles.userId} data-label="User ID">
                          {user.id}
                        </td>
                        <td
                          className={styles.walletAddress}
                          data-label="Wallet Address"
                        >
                          {user.ethereumAddress || user.email || "N/A"}
                        </td>
                        <td className={styles.joinDate} data-label="Join Date">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className={styles.deposits} data-label="Total Deposits">
                          $
                          {(user.totalDepositsUSD ?? 0).toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </td>
                        <td
                          className={styles.withdrawals}
                          data-label="Total Withdrawals"
                        >
                          $
                          {(user.totalWithdrawalsUSD ?? 0).toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </td>
                        <td
                          className={styles.currentBalance}
                          data-label="Current Balance"
                        >
                          $
                          {(user.balance ?? 0).toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </td>
                        <td className={styles.lastActivity} data-label="Last Activity">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className={styles.status} data-label="Status">
                          <span
                            className={`${styles.statusBadge} ${styles.active}`}
                          >
                            Active
                          </span>
                        </td>
                        <td className={styles.actions} data-label="Actions">
                          <button
                            className={styles.editButton}
                            onClick={() => openBalanceModal(user)}
                          >
                            Adjust Balance
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {activeTab === "trades" && (
          <section className={styles.tradesSection}>
            <div className={styles.sectionHeader}>
              <h2>Trade Management</h2>
              <p>
                Total: {tradeStats.total} | Pending: {tradeStats.pending} | Won: {tradeStats.won} | Lost: {tradeStats.lost}
              </p>
            </div>

            {/* Trade Filter Buttons */}
            <div className={styles.filterBar}>
              {["all", "PENDING", "WON", "LOST", "CLOSED"].map((filter) => (
                <button
                  key={filter}
                  className={`${styles.filterButton} ${tradeFilter === filter ? styles.activeFilter : ""}`}
                  onClick={() => setTradeFilter(filter)}
                >
                  {filter === "all" ? "All" : filter}
                  {filter === "all" && ` (${tradeStats.total})`}
                  {filter === "PENDING" && ` (${tradeStats.pending})`}
                  {filter === "WON" && ` (${tradeStats.won})`}
                  {filter === "LOST" && ` (${tradeStats.lost})`}
                  {filter === "CLOSED" && ` (${tradeStats.closed})`}
                </button>
              ))}
            </div>

            <div className={styles.tableContainer}>
              {getFilteredTrades().length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>📈</div>
                  <h3>No Trades Found</h3>
                  <p>No trades match the selected filter.</p>
                </div>
              ) : (
                <table className={styles.tradesTable}>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Symbol</th>
                      <th>Direction</th>
                      <th>Amount</th>
                      <th>Return %</th>
                      <th>Entry Price</th>
                      <th>Duration</th>
                      <th>Time Left</th>
                      <th>Created</th>
                      <th>Status</th>
                      <th>P&L</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredTrades().map((trade) => {
                      const remainingSeconds =
                        trade.status === "PENDING"
                          ? getTradeRemainingSeconds(trade)
                          : 0;
                      const isExpired = remainingSeconds <= 0;
                      const isScheduled =
                        trade.status === "PENDING" && trade.adminResult && !isExpired;

                      return (
                        <tr key={trade.id} className={styles.tableRow}>
                          <td className={styles.userId} data-label="User">
                            {trade.user?.email ||
                              trade.user?.name ||
                              trade.userId?.slice(0, 8)}
                          </td>
                          <td className={styles.symbol} data-label="Symbol">
                            {trade.symbol}
                          </td>
                          <td data-label="Direction">
                            <span
                              className={`${styles.directionBadge} ${
                                trade.direction === "UP" ? styles.up : styles.down
                              }`}
                            >
                              {trade.direction === "UP" ? "↑ UP" : "↓ DOWN"}
                            </span>
                          </td>
                          <td className={styles.amount} data-label="Amount">
                            ${trade.amount?.toFixed(2)}
                          </td>
                          <td className={styles.returnPct} data-label="Return %">
                            {trade.returnPct}%
                          </td>
                          <td className={styles.price} data-label="Entry Price">
                            ${trade.priceOpen?.toFixed(2)}
                          </td>
                          <td className={styles.duration} data-label="Duration">
                            {trade.duration}s
                          </td>
                          <td className={styles.countdownCell} data-label="Time Left">
                            {trade.status === "PENDING" ? (
                              <span
                                className={
                                  isExpired
                                    ? styles.expiredBadge
                                    : styles.countdownBadge
                                }
                              >
                                {isExpired
                                  ? "Expired"
                                  : formatCountdown(remainingSeconds)}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className={styles.date} data-label="Created">
                            {formatDate(trade.createdAt)}
                          </td>
                          <td data-label="Status">
                            <span
                              className={`${styles.statusBadge} ${
                                styles[trade.status?.toLowerCase()]
                              }`}
                            >
                              {trade.status}
                            </span>
                          </td>
                          <td
                            className={trade.pnl >= 0 ? styles.profit : styles.loss}
                            data-label="P&L"
                          >
                            {trade.pnl !== null && trade.pnl !== undefined
                              ? `${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toFixed(2)}`
                              : "-"}
                          </td>
                          <td className={styles.actions} data-label="Actions">
                            {trade.status === "PENDING" ? (
                              isScheduled ? (
                                <span className={styles.scheduledBadge}>
                                  Scheduled {trade.adminResult}
                                </span>
                              ) : (
                                <>
                                  <button
                                    className={styles.approveButton}
                                    onClick={() => handleResolveTrade(trade.id, "WON")}
                                    disabled={isBusy}
                                  >
                                    Mark WON
                                  </button>
                                  <button
                                    className={styles.rejectButton}
                                    onClick={() => handleResolveTrade(trade.id, "LOST")}
                                    disabled={isBusy}
                                  >
                                    Mark LOST
                                  </button>
                                </>
                              )
                            ) : (
                              <span className={styles.processedDate}>
                                {trade.resolvedAt ? formatDate(trade.resolvedAt) : "N/A"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {activeTab === "deposits" && (
          <section className={styles.depositsSection}>
            <div className={styles.sectionHeader}>
              <h2>Deposit Requests</h2>
              <p>
                Total deposits: {deposits.length} | Pending:{" "}
                {statistics.pendingDeposits}
              </p>
            </div>

            {/* Admin Notes Input */}
            <div className={styles.adminNotesSection}>
              <label>Admin Notes (for approval/rejection):</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Enter notes for approval/rejection..."
                className={styles.adminNotesInput}
                rows="3"
              />
            </div>

            <div className={styles.tableContainer}>
              {deposits.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>📥</div>
                  <h3>No Deposit Requests</h3>
                  <p>No deposit requests at this time.</p>
                </div>
              ) : (
                <table className={styles.depositsTable}>
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Token</th>
                      <th>Amount</th>
                      <th>USD Value</th>
                      <th>Transaction Hash</th>
                      <th>Wallet Address</th>
                      <th>Submission Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.map((deposit) => (
                      <tr
                        key={deposit.id || deposit._id || deposit.transactionHash}
                        className={styles.tableRow}
                      >
                        <td className={styles.userId} data-label="User ID">
                          {deposit.userId}
                        </td>
                        <td className={styles.token} data-label="Token">
                          {deposit.token}
                        </td>
                        <td className={styles.amount} data-label="Amount">
                          {formatAmount(deposit.amount, deposit.token)}
                        </td>
                        <td className={styles.usdValue} data-label="USD Value">
                          $
                          {(deposit.usdAmount ?? 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className={styles.txHash} data-label="Transaction Hash">
                          {deposit.transactionHash}
                        </td>
                        <td className={styles.walletAddress} data-label="Wallet Address">
                          {deposit.walletAddress}
                        </td>
                        <td className={styles.date} data-label="Submission Date">
                          {formatDate(deposit.submissionDate)}
                        </td>
                        <td data-label="Status">
                          <span
                            className={`${styles.status} ${
                              styles[deposit.status]
                            }`}
                          >
                            {deposit.status.charAt(0).toUpperCase() +
                              deposit.status.slice(1)}
                          </span>
                        </td>
                        <td className={styles.actions} data-label="Actions">
                          {deposit.status === "pending" ? (
                            <>
                              <button
                                className={styles.approveButton}
                                onClick={() =>
                                  handleApproveDeposit(deposit._id)
                                }
                                disabled={isBusy}
                              >
                                Approve
                              </button>
                              <button
                                className={styles.rejectButton}
                                onClick={() => handleRejectDeposit(deposit._id)}
                                disabled={isBusy}
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className={styles.processedDate}>
                              {deposit.processedDate
                                ? formatDate(deposit.processedDate)
                                : "N/A"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {activeTab === "withdrawals" && (
          <section className={styles.withdrawalsSection}>
            <div className={styles.sectionHeader}>
              <h2>Withdrawal Requests</h2>
              <p>
                Total withdrawals: {withdrawals.length} | Pending:{" "}
                {statistics.pendingWithdrawals}
              </p>
            </div>

            {/* Admin Notes Input */}
            <div className={styles.adminNotesSection}>
              <label>Admin Notes (for approval/rejection):</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Enter notes for approval/rejection..."
                className={styles.adminNotesInput}
                rows="3"
              />
            </div>

            <div className={styles.tableContainer}>
              {withdrawals.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>📤</div>
                  <h3>No Withdrawal Requests</h3>
                  <p>No withdrawal requests at this time.</p>
                </div>
              ) : (
                <table className={styles.withdrawalsTable}>
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Token</th>
                      <th>Amount</th>
                      <th>USD Value</th>
                      <th>Destination Address</th>
                      <th>Transfer Method</th>
                      <th>Request Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((withdrawal) => (
                      <tr
                        key={withdrawal.id || withdrawal.toAddress}
                        className={styles.tableRow}
                      >
                        <td className={styles.userId} data-label="User ID">
                          {withdrawal.userId}
                        </td>
                        <td className={styles.token} data-label="Token">
                          USD
                        </td>
                        <td className={styles.amount} data-label="Amount">
                          ${withdrawal.amount?.toFixed(2) || '0.00'}
                        </td>
                        <td className={styles.usdValue} data-label="USD Value">
                          $
                          {(withdrawal.amount ?? 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className={styles.walletAddress} data-label="Destination Address">
                          {withdrawal.toAddress}
                        </td>
                        <td className={styles.transferMethod} data-label="Transfer Method">
                          Simulator
                        </td>
                        <td className={styles.date} data-label="Request Date">
                          {formatDate(withdrawal.createdAt)}
                        </td>
                        <td data-label="Status">
                          <span
                            className={`${styles.status} ${
                              styles[withdrawal.status]
                            }`}
                          >
                            {withdrawal.status.charAt(0).toUpperCase() +
                              withdrawal.status.slice(1)}
                          </span>
                        </td>
                        <td className={styles.actions} data-label="Actions">
                          {withdrawal.status === "PENDING" ? (
                            <>
                              <button
                                className={styles.approveButton}
                                onClick={() =>
                                  handleApproveWithdrawal(withdrawal.id)
                                }
                                disabled={isBusy}
                              >
                                Approve
                              </button>
                              <button
                                className={styles.rejectButton}
                                onClick={() =>
                                  handleRejectWithdrawal(withdrawal.id)
                                }
                                disabled={isBusy}
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className={styles.processedDate}>
                              {withdrawal.resolvedAt
                                ? formatDate(withdrawal.resolvedAt)
                                : "N/A"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {activeTab === "settings" && (
          <section className={styles.settingsSection}>
            <div className={styles.sectionHeader}>
              <h2>⚙️ Settings</h2>
              <p>Manage deposit addresses and system configuration</p>
            </div>

            <div className={styles.settingsContainer}>
              <div className={styles.settingsCard}>
                <h3>💰 Deposit Addresses</h3>
                <p className={styles.settingsDescription}>
                  Configure the wallet addresses where users will send deposits. These addresses will be displayed in QR codes and copy-paste fields.
                </p>

                {depositAddresses.length > 0 ? (
                  <div className={styles.depositAddressesForm}>
                    {depositAddresses.map((addr) => (
                      <div key={addr.token} className={styles.addressFormGroup}>
                        <div className={styles.addressHeader}>
                          <h4>{addr.token}</h4>
                          <span className={styles.networkBadge}>{addr.network}</span>
                        </div>
                        <div className={styles.inputGroup}>
                          <label>Address:</label>
                          <input
                            type="text"
                            value={addr.address}
                            onChange={(e) =>
                              handleDepositAddressChange(addr.token, "address", e.target.value)
                            }
                            className={styles.addressInput}
                            placeholder={`Enter ${addr.token} address`}
                          />
                        </div>
                        <div className={styles.inputGroup}>
                          <label>Network:</label>
                          <select
                            value={addr.network || ""}
                            onChange={(e) =>
                              handleDepositAddressChange(addr.token, "network", e.target.value)
                            }
                            className={styles.networkSelect}
                          >
                            <option value="">Select Network</option>
                            <option value="Bitcoin">Bitcoin</option>
                            <option value="Ethereum">Ethereum</option>
                            <option value="Tron">Tron</option>
                            <option value="Solana">Solana</option>
                            <option value="Polygon">Polygon</option>
                            <option value="BSC">BSC (Binance Smart Chain)</option>
                            <option value="Arbitrum">Arbitrum</option>
                            <option value="Optimism">Optimism</option>
                          </select>
                        </div>
                        <div className={styles.inputGroup}>
                          <label>
                            <input
                              type="checkbox"
                              checked={addr.isActive !== false}
                              onChange={(e) =>
                                handleDepositAddressChange(addr.token, "isActive", e.target.checked)
                              }
                            />
                            Active
                          </label>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={handleUpdateDepositAddresses}
                      className={styles.saveButton}
                      disabled={isBusy}
                    >
                      {isBusy ? "Saving..." : "💾 Save Changes"}
                    </button>
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <p>No deposit addresses configured.</p>
                    <p>Run the seed script to initialize default addresses.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
      </main>

      {balanceModal.open && (
        <div
          className={styles.balanceModalOverlay}
          onClick={closeBalanceModal}
        >
          <div
            className={styles.balanceModal}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={styles.modalTitle}>Adjust Balance</h3>
            <p className={styles.modalSubtitle}>
              {balanceModal.user?.email ||
                balanceModal.user?.ethereumAddress ||
                balanceModal.user?.id}
            </p>

            <div className={styles.modalRow}>
              <label>Mode</label>
              <div className={styles.modeToggleGroup}>
                <button
                  type="button"
                  className={`${styles.modeToggle} ${
                    balanceModal.mode === "set" ? styles.modeToggleActive : ""
                  }`}
                  onClick={() =>
                    setBalanceModal((prev) => ({ ...prev, mode: "set" }))
                  }
                  disabled={balanceSaving}
                >
                  Set exact balance
                </button>
                <button
                  type="button"
                  className={`${styles.modeToggle} ${
                    balanceModal.mode === "delta" ? styles.modeToggleActive : ""
                  }`}
                  onClick={() =>
                    setBalanceModal((prev) => ({ ...prev, mode: "delta" }))
                  }
                  disabled={balanceSaving}
                >
                  Adjust by amount
                </button>
              </div>
            </div>

            <div className={styles.modalRow}>
              <label>
                {balanceModal.mode === "delta"
                  ? "Adjustment Amount (use negative to subtract)"
                  : "New Balance"}
              </label>
              <input
                type="number"
                step="0.01"
                value={balanceModal.amount}
                onChange={(e) =>
                  setBalanceModal((prev) => ({
                    ...prev,
                    amount: e.target.value,
                  }))
                }
                className={styles.balanceInput}
                placeholder="0.00"
                disabled={balanceSaving}
              />
            </div>

            {balanceError && (
              <p className={styles.errorText}>{balanceError}</p>
            )}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalSecondaryButton}
                onClick={closeBalanceModal}
                disabled={balanceSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalPrimaryButton}
                onClick={submitBalanceUpdate}
                disabled={balanceSaving}
              >
                {balanceSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
