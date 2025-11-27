"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";
import { authClient } from "@/lib/auth-client";

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
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
    totalWithdrawalsUSD: 0,
    totalCurrentBalanceUSD: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
  });
  const [adminNotes, setAdminNotes] = useState("");

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data } = await authClient.getSession();
        if (data?.user) {
          setSession(data);
          setLoading(false);
        } else {
          router.push("/admin/sign-in");
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/admin/sign-in");
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
      const [usersRes, withdrawalsRes, depositAddressesRes, depositsRes, tradesRes] = await Promise.all([
        fetch("/api/users", { credentials: "include" }),
        fetch("/api/withdraw/requests", { credentials: "include" }),
        fetch("/api/deposit-addresses/", { credentials: "include" }),
        fetch("/api/deposits/", { credentials: "include" }),
        fetch("/api/admin/trades", { credentials: "include" }),
      ]);

      const usersData = await usersRes.json();
      const withdrawalsData = await withdrawalsRes.json();
      const depositAddressesData = await depositAddressesRes.json();
      const depositsData = await depositsRes.json();
      const tradesData = await tradesRes.json();

      const fetchedUsers = usersData.users || [];
      const fetchedWithdrawals = withdrawalsData.withdrawRequests || [];
      const fetchedDepositAddresses = depositAddressesData.addresses || [];
      const fetchedDeposits = depositsData.deposits || [];
      const fetchedTrades = tradesData.trades || [];
      const fetchedTradeStats = tradesData.stats || { total: 0, pending: 0, won: 0, lost: 0, closed: 0 };

      setUsers(fetchedUsers);
      setWithdrawals(fetchedWithdrawals);
      setDepositAddresses(fetchedDepositAddresses);
      setDeposits(fetchedDeposits);
      setTrades(fetchedTrades);
      setTradeStats(fetchedTradeStats);

      // Calculate statistics from user data, deposits, and withdrawals
      const totalCurrentBalanceUSD = fetchedUsers.reduce((sum, user) => sum + (user.balance || 0), 0);
      
      // Calculate total deposits (confirmed only)
      const totalDepositsUSD = fetchedDeposits
        .filter((d) => d.status === "CONFIRMED")
        .reduce((sum, d) => sum + (d.amount || 0), 0);
      
      const pendingDeposits = fetchedDeposits.filter((d) => d.status === "PENDING").length;
      
      // Calculate total withdrawals (approved + pending)
      const totalWithdrawalsUSD = fetchedWithdrawals
        .filter((w) => w.status === "APPROVED" || w.status === "PENDING")
        .reduce((sum, w) => sum + (w.amount || 0), 0);
      
      const pendingWithdrawals = fetchedWithdrawals.filter((w) => w.status === "PENDING").length;

      setStatistics({
        totalUsers: fetchedUsers.length,
        totalDeposits: fetchedDeposits.length,
        totalWithdrawals: fetchedWithdrawals.length,
        totalDepositsUSD: totalDepositsUSD,
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
        totalWithdrawalsUSD: 0,
        totalCurrentBalanceUSD: 0,
        pendingDeposits: 0,
        pendingWithdrawals: 0,
      });
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

  const handleApproveDeposit = async (depositId) => {
    setLoading(true);
    try {
      alert("Deposit approval not implemented in this version.");
    } catch (error) {
      console.error("Error approving deposit:", error);
      alert("Error approving deposit");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectDeposit = async (depositId) => {
    setLoading(true);
    try {
      alert("Deposit rejection not implemented in this version.");
    } catch (error) {
      console.error("Error rejecting deposit:", error);
      alert("Error rejecting deposit");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveWithdrawal = async (withdrawalId) => {
    setLoading(true);
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
        loadAdminData();
        setAdminNotes("");
      } else {
        const error = await res.json();
        alert(`Failed to approve withdrawal: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error approving withdrawal:", error);
      alert("Error approving withdrawal");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectWithdrawal = async (withdrawalId) => {
    setLoading(true);
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
        loadAdminData();
        setAdminNotes("");
      } else {
        const error = await res.json();
        alert(`Failed to reject withdrawal: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error rejecting withdrawal:", error);
      alert("Error rejecting withdrawal");
    } finally {
      setLoading(false);
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

    setLoading(true);
    try {
      const res = await fetch("/api/deposit-addresses/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ addresses: depositAddresses }),
      });
      
      if (res.ok) {
        alert("✅ Deposit addresses updated successfully!");
        loadAdminData();
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
      setLoading(false);
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
    loadAdminData();
  };

  const handleResolveTrade = async (tradeId, result) => {
    if (!confirm(`Are you sure you want to mark this trade as ${result}?`)) {
      return;
    }

    setLoading(true);
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
        loadAdminData();
      } else {
        const error = await res.json();
        alert(`Failed to resolve trade: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error resolving trade:", error);
      alert("Error resolving trade");
    } finally {
      setLoading(false);
    }
  };

  const getFilteredTrades = () => {
    if (tradeFilter === "all") return trades;
    return trades.filter((t) => t.status === tradeFilter);
  };

  // Show loading state while checking authentication
  if (loading) {
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
            disabled={loading}
          >
            {loading ? "Refreshing..." : "🔄 Refresh"}
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
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr
                        key={user._id || user.userId}
                        className={styles.tableRow}
                      >
                        <td className={styles.userId}>{user.id}</td>
                        <td className={styles.walletAddress}>
                          {user.ethereumAddress || user.email || "N/A"}
                        </td>
                        <td className={styles.joinDate}>
                          {formatDate(user.createdAt)}
                        </td>
                        <td className={styles.deposits}>
                          $
                          {(user.totalDepositsUSD ?? 0).toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </td>
                        <td className={styles.withdrawals}>
                          $
                          {(user.totalWithdrawalsUSD ?? 0).toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </td>
                        <td className={styles.currentBalance}>
                          $
                          {(user.balance ?? 0).toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </td>
                        <td className={styles.lastActivity}>
                          {formatDate(user.createdAt)}
                        </td>
                        <td className={styles.status}>
                          <span
                            className={`${styles.statusBadge} ${styles.active}`}
                          >
                            Active
                          </span>
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
                      <th>Created</th>
                      <th>Status</th>
                      <th>P&L</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredTrades().map((trade) => (
                      <tr key={trade.id} className={styles.tableRow}>
                        <td className={styles.userId}>
                          {trade.user?.email || trade.user?.name || trade.userId?.slice(0, 8)}
                        </td>
                        <td className={styles.symbol}>{trade.symbol}</td>
                        <td>
                          <span
                            className={`${styles.directionBadge} ${
                              trade.direction === "UP" ? styles.up : styles.down
                            }`}
                          >
                            {trade.direction === "UP" ? "↑ UP" : "↓ DOWN"}
                          </span>
                        </td>
                        <td className={styles.amount}>${trade.amount?.toFixed(2)}</td>
                        <td className={styles.returnPct}>{trade.returnPct}%</td>
                        <td className={styles.price}>${trade.priceOpen?.toFixed(2)}</td>
                        <td className={styles.duration}>{trade.duration}s</td>
                        <td className={styles.date}>{formatDate(trade.createdAt)}</td>
                        <td>
                          <span
                            className={`${styles.statusBadge} ${styles[trade.status?.toLowerCase()]}`}
                          >
                            {trade.status}
                          </span>
                        </td>
                        <td className={trade.pnl >= 0 ? styles.profit : styles.loss}>
                          {trade.pnl !== null && trade.pnl !== undefined
                            ? `${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toFixed(2)}`
                            : "-"}
                        </td>
                        <td className={styles.actions}>
                          {trade.status === "PENDING" ? (
                            <>
                              <button
                                className={styles.approveButton}
                                onClick={() => handleResolveTrade(trade.id, "WON")}
                                disabled={loading}
                              >
                                Mark WON
                              </button>
                              <button
                                className={styles.rejectButton}
                                onClick={() => handleResolveTrade(trade.id, "LOST")}
                                disabled={loading}
                              >
                                Mark LOST
                              </button>
                            </>
                          ) : (
                            <span className={styles.processedDate}>
                              {trade.resolvedAt ? formatDate(trade.resolvedAt) : "N/A"}
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
                        key={deposit._id || deposit.transactionHash}
                        className={styles.tableRow}
                      >
                        <td className={styles.userId}>{deposit.userId}</td>
                        <td className={styles.token}>{deposit.token}</td>
                        <td className={styles.amount}>
                          {formatAmount(deposit.amount, deposit.token)}
                        </td>
                        <td className={styles.usdValue}>
                          $
                          {(deposit.usdAmount ?? 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className={styles.txHash}>
                          {deposit.transactionHash}
                        </td>
                        <td className={styles.walletAddress}>
                          {deposit.walletAddress}
                        </td>
                        <td className={styles.date}>
                          {formatDate(deposit.submissionDate)}
                        </td>
                        <td>
                          <span
                            className={`${styles.status} ${
                              styles[deposit.status]
                            }`}
                          >
                            {deposit.status.charAt(0).toUpperCase() +
                              deposit.status.slice(1)}
                          </span>
                        </td>
                        <td className={styles.actions}>
                          {deposit.status === "pending" ? (
                            <>
                              <button
                                className={styles.approveButton}
                                onClick={() =>
                                  handleApproveDeposit(deposit._id)
                                }
                                disabled={loading}
                              >
                                Approve
                              </button>
                              <button
                                className={styles.rejectButton}
                                onClick={() => handleRejectDeposit(deposit._id)}
                                disabled={loading}
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
                        <td className={styles.userId}>{withdrawal.userId}</td>
                        <td className={styles.token}>USD</td>
                        <td className={styles.amount}>
                          ${withdrawal.amount?.toFixed(2) || '0.00'}
                        </td>
                        <td className={styles.usdValue}>
                          $
                          {(withdrawal.amount ?? 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className={styles.walletAddress}>
                          {withdrawal.toAddress}
                        </td>
                        <td className={styles.transferMethod}>
                          Simulator
                        </td>
                        <td className={styles.date}>
                          {formatDate(withdrawal.createdAt)}
                        </td>
                        <td>
                          <span
                            className={`${styles.status} ${
                              styles[withdrawal.status]
                            }`}
                          >
                            {withdrawal.status.charAt(0).toUpperCase() +
                              withdrawal.status.slice(1)}
                          </span>
                        </td>
                        <td className={styles.actions}>
                          {withdrawal.status === "PENDING" ? (
                            <>
                              <button
                                className={styles.approveButton}
                                onClick={() =>
                                  handleApproveWithdrawal(withdrawal.id)
                                }
                                disabled={loading}
                              >
                                Approve
                              </button>
                              <button
                                className={styles.rejectButton}
                                onClick={() =>
                                  handleRejectWithdrawal(withdrawal.id)
                                }
                                disabled={loading}
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
                      disabled={loading}
                    >
                      {loading ? "Saving..." : "💾 Save Changes"}
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
  );
}
