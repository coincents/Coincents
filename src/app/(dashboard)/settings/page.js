"use client";

import styles from "./settings.module.css";
import { useState, useEffect } from "react";
import { useUser } from "../../../contexts/UserContext";
import { useAccount } from "wagmi";

export default function SettingsPage() {
  const { userId, walletAddress } = useUser();
  const { address, isConnected } = useAccount();
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [balances, setBalances] = useState({
    ETH: "0.0000",
    BTC: "0.00000000",
  });
  const [activeTab, setActiveTab] = useState("profile");
  const [btcAddress, setBtcAddress] = useState("");

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

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

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
                  <label>Username</label>
                  <input
                    type="text"
                    value={settings.profile.username}
                    onChange={(e) =>
                      handleSettingChange("profile", "username", e.target.value)
                    }
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
