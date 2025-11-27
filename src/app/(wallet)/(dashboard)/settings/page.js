"use client";

import styles from "./settings.module.css";
import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { useAccount } from "wagmi";

export default function SettingsPage() {
  const { userId, walletAddress, backendUser } = useUser();
  const { address, isConnected } = useAccount();
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [balances, setBalances] = useState({
    ETH: "0.0000",
    BTC: "0.00000000",
  });
  const [activeTab, setActiveTab] = useState("profile");
  const [btcAddress, setBtcAddress] = useState("");
  const [withdrawals, setWithdrawals] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  useEffect(() => {
    // Load existing BTC address for convenience
    const load = async () => {
      try {
        const res = await fetch("/api/users");
        const data = await res.json();
        if (data?.success && Array.isArray(data.users) && userId) {
          const me = data.users.find((u) => u.id === userId);
          if (me?.btcAddress) setBtcAddress(me.btcAddress);
        }
      } catch {}
    };
    load();
  }, [userId]);
  const [settings, setSettings] = useState({
    profile: {
      username: "",
      email: "",
      name: "",
      timezone: "UTC",
      language: "English",
      currency: "USD",
    },
    security: {
      twoFactorEnabled: false,
      emailNotifications: true,
      pushNotifications: true,
      sessionTimeout: 30,
      autoLogout: true,
    },
    trading: {
      defaultRiskLevel: "medium",
      autoConfirmTrades: false,
      maxTradeAmount: 1000,
      stopLossEnabled: true,
      takeProfitEnabled: true,
    },
    appearance: {
      theme: "dark",
      compactMode: false,
      showBalances: true,
      showCharts: true,
      refreshInterval: 30,
    },
  });

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // Populate profile settings from backendUser
  useEffect(() => {
    if (backendUser) {
      setSettings((prev) => ({
        ...prev,
        profile: {
          ...prev.profile,
          username: backendUser.username || backendUser.displayUsername || "",
          email: backendUser.email || "",
          name: backendUser.name || "",
        },
      }));
      if (backendUser.btcAddress) {
        setBtcAddress(backendUser.btcAddress);
      }
    }
  }, [backendUser]);

  // Fetch transactions when tab is active
  useEffect(() => {
    if (activeTab !== "transactions") return;

    const fetchTransactions = async () => {
      setLoadingTransactions(true);
      try {
        const [withdrawRes, depositRes] = await Promise.all([
          fetch("/api/withdraw/list", { credentials: "include" }),
          fetch("/api/deposits/list", { credentials: "include" }),
        ]);

        const withdrawData = await withdrawRes.json();
        const depositData = await depositRes.json();

        if (withdrawData.success) {
          setWithdrawals(withdrawData.withdrawRequests || []);
        }
        if (depositData.success) {
          setDeposits(depositData.deposits || []);
        }
      } catch (error) {
        console.error("Error fetching transactions:", error);
      } finally {
        setLoadingTransactions(false);
      }
    };

    fetchTransactions();
  }, [activeTab]);

  // Remove balance fetching - not needed for settings page

  const handleConnect = async () => {
    if (isConnecting) return;

    setIsConnecting(true);
    try {
      const address = await connectWallet();
      setWalletAddress(address);
    } catch (error) {
      console.error("Wallet connection failed:", error);
      let errorMessage = error.message;
      if (error.message.includes("MetaMask is not installed")) {
        errorMessage = "Please install MetaMask browser extension first.";
      } else if (error.message.includes("User rejected")) {
        errorMessage =
          "Connection was cancelled. Please try again and approve the connection.";
      }
      alert(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setWalletAddress(null);
    setBalances({
      ETH: "0.0000",
      BTC: "0.00000000",
    });
  };

  const handleSettingChange = (category, key, value) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
  };

  const handleSaveSettings = async () => {
    try {
      if (userId) {
        await fetch("/api/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, btcAddress }),
        });
      }
      alert("Settings saved successfully!");
    } catch (e) {
      alert("Failed to save settings");
    }
  };

  const handleExportData = () => {
    const data = {
      settings,
      walletAddress,
      balances,
      exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "walletbase-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetSettings = () => {
    if (
      confirm(
        "Are you sure you want to reset all settings to default? This action cannot be undone."
      )
    ) {
      // Reset to default settings
      setSettings({
        profile: {
          username: "CryptoTrader",
          email: "trader@example.com",
          timezone: "UTC",
          language: "English",
          currency: "USD",
        },
        security: {
          twoFactorEnabled: false,
          emailNotifications: true,
          pushNotifications: true,
          sessionTimeout: 30,
          autoLogout: true,
        },
        trading: {
          defaultRiskLevel: "medium",
          autoConfirmTrades: false,
          maxTradeAmount: 1000,
          stopLossEnabled: true,
          takeProfitEnabled: true,
        },
        appearance: {
          theme: "dark",
          compactMode: false,
          showBalances: true,
          showCharts: true,
          refreshInterval: 30,
        },
      });
      alert("Settings reset to default values.");
    }
  };

  return (
    <main className={styles.container}>
      {/* Settings Content */}
      <div className={styles.settingsContainer}>
        {/* Settings Sidebar */}
        <aside className={styles.settingsSidebar}>
          <h2>Settings</h2>
          <nav className={styles.settingsNav}>
            <button
              className={`${styles.settingsTab} ${
                activeTab === "profile" ? styles.active : ""
              }`}
              onClick={() => setActiveTab("profile")}
            >
              👤 Profile
            </button>
            <button
              className={`${styles.settingsTab} ${
                activeTab === "security" ? styles.active : ""
              }`}
              onClick={() => setActiveTab("security")}
            >
              🔒 Security
            </button>
            <button
              className={`${styles.settingsTab} ${
                activeTab === "trading" ? styles.active : ""
              }`}
              onClick={() => setActiveTab("trading")}
            >
              📊 Trading
            </button>
            <button
              className={`${styles.settingsTab} ${
                activeTab === "appearance" ? styles.active : ""
              }`}
              onClick={() => setActiveTab("appearance")}
            >
              🎨 Appearance
            </button>
            <button
              className={`${styles.settingsTab} ${
                activeTab === "notifications" ? styles.active : ""
              }`}
              onClick={() => setActiveTab("notifications")}
            >
              🔔 Notifications
            </button>
            <button
              className={`${styles.settingsTab} ${
                activeTab === "transactions" ? styles.active : ""
              }`}
              onClick={() => setActiveTab("transactions")}
            >
              💸 Transactions
            </button>
          </nav>
        </aside>

        {/* Settings Content */}
        <main className={styles.settingsContent}>
          {/* Profile Settings */}
          {activeTab === "profile" && (
            <div className={styles.settingsSection}>
              <h3>Profile Settings</h3>
              <div className={styles.settingsForm}>
                <div className={styles.formGroup}>
                  <label>Wallet Address</label>
                  <input
                    type="text"
                    value={walletAddress || address || "Not connected"}
                    readOnly
                    className={styles.formInput}
                    style={{ background: "rgba(255,255,255,0.05)", color: "#888" }}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Account Balance</label>
                  <input
                    type="text"
                    value={`$${backendUser?.balance?.toFixed(2) || "0.00"}`}
                    readOnly
                    className={styles.formInput}
                    style={{ background: "rgba(255,255,255,0.05)", color: "#00d4aa", fontWeight: "bold" }}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Username</label>
                  <input
                    type="text"
                    value={settings.profile.username}
                    onChange={(e) =>
                      handleSettingChange("profile", "username", e.target.value)
                    }
                    placeholder="Enter username"
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Display Name</label>
                  <input
                    type="text"
                    value={settings.profile.name}
                    onChange={(e) =>
                      handleSettingChange("profile", "name", e.target.value)
                    }
                    placeholder="Enter display name"
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Email</label>
                  <input
                    type="email"
                    value={settings.profile.email}
                    onChange={(e) =>
                      handleSettingChange("profile", "email", e.target.value)
                    }
                    placeholder="Enter email"
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Timezone</label>
                  <select
                    value={settings.profile.timezone}
                    onChange={(e) =>
                      handleSettingChange("profile", "timezone", e.target.value)
                    }
                    className={styles.formSelect}
                  >
                    <option value="UTC">UTC</option>
                    <option value="EST">Eastern Time</option>
                    <option value="PST">Pacific Time</option>
                    <option value="GMT">GMT</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Language</label>
                  <select
                    value={settings.profile.language}
                    onChange={(e) =>
                      handleSettingChange("profile", "language", e.target.value)
                    }
                    className={styles.formSelect}
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Currency</label>
                  <select
                    value={settings.profile.currency}
                    onChange={(e) =>
                      handleSettingChange("profile", "currency", e.target.value)
                    }
                    className={styles.formSelect}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>BTC Address</label>
                  <input
                    type="text"
                    value={btcAddress}
                    onChange={(e) => setBtcAddress(e.target.value)}
                    placeholder="bc1..."
                    className={styles.formInput}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === "security" && (
            <div className={styles.settingsSection}>
              <h3>Security Settings</h3>
              <div className={styles.settingsForm}>
                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={settings.security.twoFactorEnabled}
                      onChange={(e) =>
                        handleSettingChange(
                          "security",
                          "twoFactorEnabled",
                          e.target.checked
                        )
                      }
                      className={styles.checkbox}
                    />
                    Enable Two-Factor Authentication
                  </label>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={settings.security.emailNotifications}
                      onChange={(e) =>
                        handleSettingChange(
                          "security",
                          "emailNotifications",
                          e.target.checked
                        )
                      }
                      className={styles.checkbox}
                    />
                    Email Notifications
                  </label>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={settings.security.pushNotifications}
                      onChange={(e) =>
                        handleSettingChange(
                          "security",
                          "pushNotifications",
                          e.target.checked
                        )
                      }
                      className={styles.checkbox}
                    />
                    Push Notifications
                  </label>
                </div>
                <div className={styles.formGroup}>
                  <label>Session Timeout (minutes)</label>
                  <input
                    type="number"
                    value={settings.security.sessionTimeout}
                    onChange={(e) =>
                      handleSettingChange(
                        "security",
                        "sessionTimeout",
                        parseInt(e.target.value)
                      )
                    }
                    className={styles.formInput}
                    min="5"
                    max="120"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={settings.security.autoLogout}
                      onChange={(e) =>
                        handleSettingChange(
                          "security",
                          "autoLogout",
                          e.target.checked
                        )
                      }
                      className={styles.checkbox}
                    />
                    Auto Logout on Inactivity
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Trading Settings */}
          {activeTab === "trading" && (
            <div className={styles.settingsSection}>
              <h3>Trading Settings</h3>
              <div className={styles.settingsForm}>
                <div className={styles.formGroup}>
                  <label>Default Risk Level</label>
                  <select
                    value={settings.trading.defaultRiskLevel}
                    onChange={(e) =>
                      handleSettingChange(
                        "trading",
                        "defaultRiskLevel",
                        e.target.value
                      )
                    }
                    className={styles.formSelect}
                  >
                    <option value="low">Low Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="high">High Risk</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={settings.trading.autoConfirmTrades}
                      onChange={(e) =>
                        handleSettingChange(
                          "trading",
                          "autoConfirmTrades",
                          e.target.checked
                        )
                      }
                      className={styles.checkbox}
                    />
                    Auto Confirm Trades
                  </label>
                </div>
                <div className={styles.formGroup}>
                  <label>Maximum Trade Amount ($)</label>
                  <input
                    type="number"
                    value={settings.trading.maxTradeAmount}
                    onChange={(e) =>
                      handleSettingChange(
                        "trading",
                        "maxTradeAmount",
                        parseInt(e.target.value)
                      )
                    }
                    className={styles.formInput}
                    min="10"
                    max="100000"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={settings.trading.stopLossEnabled}
                      onChange={(e) =>
                        handleSettingChange(
                          "trading",
                          "stopLossEnabled",
                          e.target.checked
                        )
                      }
                      className={styles.checkbox}
                    />
                    Enable Stop Loss
                  </label>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={settings.trading.takeProfitEnabled}
                      onChange={(e) =>
                        handleSettingChange(
                          "trading",
                          "takeProfitEnabled",
                          e.target.checked
                        )
                      }
                      className={styles.checkbox}
                    />
                    Enable Take Profit
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Appearance Settings */}
          {activeTab === "appearance" && (
            <div className={styles.settingsSection}>
              <h3>Appearance Settings</h3>
              <div className={styles.settingsForm}>
                <div className={styles.formGroup}>
                  <label>Theme</label>
                  <select
                    value={settings.appearance.theme}
                    onChange={(e) =>
                      handleSettingChange("appearance", "theme", e.target.value)
                    }
                    className={styles.formSelect}
                  >
                    <option value="dark">Dark Theme</option>
                    <option value="light">Light Theme</option>
                    <option value="auto">Auto (System)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={settings.appearance.compactMode}
                      onChange={(e) =>
                        handleSettingChange(
                          "appearance",
                          "compactMode",
                          e.target.checked
                        )
                      }
                      className={styles.checkbox}
                    />
                    Compact Mode
                  </label>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={settings.appearance.showBalances}
                      onChange={(e) =>
                        handleSettingChange(
                          "appearance",
                          "showBalances",
                          e.target.checked
                        )
                      }
                      className={styles.checkbox}
                    />
                    Show Balances
                  </label>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={settings.appearance.showCharts}
                      onChange={(e) =>
                        handleSettingChange(
                          "appearance",
                          "showCharts",
                          e.target.checked
                        )
                      }
                      className={styles.checkbox}
                    />
                    Show Charts
                  </label>
                </div>
                <div className={styles.formGroup}>
                  <label>Refresh Interval (seconds)</label>
                  <input
                    type="number"
                    value={settings.appearance.refreshInterval}
                    onChange={(e) =>
                      handleSettingChange(
                        "appearance",
                        "refreshInterval",
                        parseInt(e.target.value)
                      )
                    }
                    className={styles.formInput}
                    min="5"
                    max="300"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notifications Settings */}
          {activeTab === "notifications" && (
            <div className={styles.settingsSection}>
              <h3>Notification Settings</h3>
              <div className={styles.settingsForm}>
                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={settings.security.emailNotifications}
                      onChange={(e) =>
                        handleSettingChange(
                          "security",
                          "emailNotifications",
                          e.target.checked
                        )
                      }
                      className={styles.checkbox}
                    />
                    Email Notifications
                  </label>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={settings.security.pushNotifications}
                      onChange={(e) =>
                        handleSettingChange(
                          "security",
                          "pushNotifications",
                          e.target.checked
                        )
                      }
                      className={styles.checkbox}
                    />
                    Push Notifications
                  </label>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={true}
                      className={styles.checkbox}
                    />
                    Price Alerts
                  </label>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={true}
                      className={styles.checkbox}
                    />
                    Trade Confirmations
                  </label>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={true}
                      className={styles.checkbox}
                    />
                    Market Updates
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Transactions History */}
          {activeTab === "transactions" && (
            <div className={styles.settingsSection}>
              <h3>Transaction History</h3>
              <p style={{ color: "#888", marginBottom: "1.5rem" }}>
                View your deposits and withdrawal requests
              </p>

              {loadingTransactions ? (
                <div style={{ textAlign: "center", padding: "2rem" }}>
                  Loading transactions...
                </div>
              ) : (
                <>
                  {/* Account Summary */}
                  <div
                    style={{
                      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
                      borderRadius: "12px",
                      padding: "1.5rem",
                      marginBottom: "2rem",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <h4 style={{ margin: "0 0 1rem 0", color: "#fff" }}>
                      Account Summary
                    </h4>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                        gap: "1rem",
                      }}
                    >
                      <div>
                        <div style={{ color: "#888", fontSize: "0.85rem" }}>
                          Current Balance
                        </div>
                        <div
                          style={{
                            color: "#00d4aa",
                            fontSize: "1.5rem",
                            fontWeight: "bold",
                          }}
                        >
                          ${backendUser?.balance?.toFixed(2) || "0.00"}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "#888", fontSize: "0.85rem" }}>
                          Total Deposits
                        </div>
                        <div style={{ color: "#4ade80", fontSize: "1.25rem" }}>
                          {deposits.length}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "#888", fontSize: "0.85rem" }}>
                          Total Withdrawals
                        </div>
                        <div style={{ color: "#f59e0b", fontSize: "1.25rem" }}>
                          {withdrawals.length}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Withdrawals Section */}
                  <div style={{ marginBottom: "2rem" }}>
                    <h4
                      style={{
                        margin: "0 0 1rem 0",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span style={{ color: "#f59e0b" }}>↑</span> Withdrawal Requests
                    </h4>
                    {withdrawals.length === 0 ? (
                      <div
                        style={{
                          color: "#666",
                          padding: "1rem",
                          background: "rgba(255,255,255,0.05)",
                          borderRadius: "8px",
                        }}
                      >
                        No withdrawal requests yet
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {withdrawals.map((w) => (
                          <div
                            key={w.id}
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              borderRadius: "8px",
                              padding: "1rem",
                              border: "1px solid rgba(255,255,255,0.1)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                marginBottom: "0.5rem",
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    color: "#f59e0b",
                                    fontWeight: "bold",
                                    fontSize: "1.1rem",
                                  }}
                                >
                                  ${w.amount?.toFixed(2)}
                                </div>
                                <div style={{ color: "#888", fontSize: "0.8rem" }}>
                                  {new Date(w.createdAt).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                              </div>
                              <span
                                style={{
                                  padding: "0.25rem 0.75rem",
                                  borderRadius: "999px",
                                  fontSize: "0.75rem",
                                  fontWeight: "bold",
                                  background:
                                    w.status === "COMPLETED"
                                      ? "rgba(74, 222, 128, 0.2)"
                                      : w.status === "REJECTED"
                                      ? "rgba(239, 68, 68, 0.2)"
                                      : "rgba(245, 158, 11, 0.2)",
                                  color:
                                    w.status === "COMPLETED"
                                      ? "#4ade80"
                                      : w.status === "REJECTED"
                                      ? "#ef4444"
                                      : "#f59e0b",
                                }}
                              >
                                {w.status}
                              </span>
                            </div>
                            <div style={{ color: "#666", fontSize: "0.8rem" }}>
                              To: {w.toAddress?.slice(0, 10)}...{w.toAddress?.slice(-8)}
                            </div>
                            {w.txHash && (
                              <div style={{ color: "#4ade80", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                                Tx: {w.txHash.slice(0, 10)}...{w.txHash.slice(-8)}
                              </div>
                            )}
                            {w.adminNotes && (
                              <div style={{ color: "#888", fontSize: "0.8rem", marginTop: "0.5rem", fontStyle: "italic" }}>
                                Note: {w.adminNotes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Deposits Section */}
                  <div>
                    <h4
                      style={{
                        margin: "0 0 1rem 0",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span style={{ color: "#4ade80" }}>↓</span> Deposits
                    </h4>
                    {deposits.length === 0 ? (
                      <div
                        style={{
                          color: "#666",
                          padding: "1rem",
                          background: "rgba(255,255,255,0.05)",
                          borderRadius: "8px",
                        }}
                      >
                        No deposits yet
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {deposits.map((d) => (
                          <div
                            key={d.id}
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              borderRadius: "8px",
                              padding: "1rem",
                              border: "1px solid rgba(255,255,255,0.1)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                marginBottom: "0.5rem",
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    color: "#4ade80",
                                    fontWeight: "bold",
                                    fontSize: "1.1rem",
                                  }}
                                >
                                  {d.amount} {d.token}
                                </div>
                                <div style={{ color: "#888", fontSize: "0.8rem" }}>
                                  {new Date(d.createdAt).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                              </div>
                              <span
                                style={{
                                  padding: "0.25rem 0.75rem",
                                  borderRadius: "999px",
                                  fontSize: "0.75rem",
                                  fontWeight: "bold",
                                  background:
                                    d.status === "CONFIRMED"
                                      ? "rgba(74, 222, 128, 0.2)"
                                      : "rgba(245, 158, 11, 0.2)",
                                  color:
                                    d.status === "CONFIRMED" ? "#4ade80" : "#f59e0b",
                                }}
                              >
                                {d.status}
                              </span>
                            </div>
                            {d.transactionHash && (
                              <div style={{ color: "#666", fontSize: "0.8rem" }}>
                                Tx: {d.transactionHash.slice(0, 10)}...
                                {d.transactionHash.slice(-8)}
                              </div>
                            )}
                            {d.usdValue && (
                              <div style={{ color: "#888", fontSize: "0.8rem" }}>
                                Value: ${d.usdValue.toFixed(2)} USD
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className={styles.settingsActions}>
            <button onClick={handleSaveSettings} className={styles.saveButton}>
              Save Settings
            </button>
            <button onClick={handleExportData} className={styles.exportButton}>
              Export Data
            </button>
            <button
              onClick={handleResetSettings}
              className={styles.resetButton}
            >
              Reset to Default
            </button>
          </div>
        </main>
      </div>
    </main>
  );
}
