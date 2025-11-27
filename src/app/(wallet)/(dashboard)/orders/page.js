"use client";

import styles from "./orders.module.css";
import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";

export default function OrdersPage() {
  const { userId, walletAddress } = useUser();
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [balances, setBalances] = useState({
    ETH: "0.0000",
    BTC: "0.00000000",
  });
  const [activeTab, setActiveTab] = useState("active"); // 'active', 'history', 'pending'
  const [orders, setOrders] = useState({
    active: [],
    history: [],
    pending: [],
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

  // Remove balance fetching - not needed for orders page

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

  const handleCancelOrder = (orderId) => {
    if (confirm("Are you sure you want to cancel this order?")) {
      setOrders((prev) => ({
        ...prev,
        active: prev.active.filter((order) => order.id !== orderId),
        pending: prev.pending.filter((order) => order.id !== orderId),
      }));
      alert("Order cancelled successfully");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
      case "executed":
        return styles.completed;
      case "pending":
        return styles.pending;
      case "cancelled":
        return styles.cancelled;
      default:
        return styles.pending;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
      case "executed":
        return "✓";
      case "pending":
        return "⏳";
      case "cancelled":
        return "✗";
      default:
        return "⏳";
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getOrderStats = () => {
    const allOrders = [...orders.active, ...orders.history, ...orders.pending];
    const totalOrders = allOrders.length;
    const completedOrders = allOrders.filter(
      (order) => order.status === "completed" || order.status === "executed"
    ).length;
    const pendingOrders = allOrders.filter(
      (order) => order.status === "pending"
    ).length;
    const cancelledOrders = allOrders.filter(
      (order) => order.status === "cancelled"
    ).length;

    return { totalOrders, completedOrders, pendingOrders, cancelledOrders };
  };

  const orderStats = getOrderStats();

  return (
    <main className={styles.container}>
      {/* Orders Overview */}
      <section className={styles.ordersOverview}>
        <div className={styles.overviewCard}>
          <h2>Orders Overview</h2>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Total Orders</span>
              <span className={styles.statValue}>{orderStats.totalOrders}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Completed</span>
              <span className={styles.statValue}>
                {orderStats.completedOrders}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Pending</span>
              <span className={styles.statValue}>
                {orderStats.pendingOrders}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Cancelled</span>
              <span className={styles.statValue}>
                {orderStats.cancelledOrders}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Orders Tabs */}
      <section className={styles.ordersSection}>
        <div className={styles.tabContainer}>
          <button
            className={`${styles.tabButton} ${
              activeTab === "active" ? styles.active : ""
            }`}
            onClick={() => setActiveTab("active")}
          >
            Active Orders ({orders.active.length})
          </button>
          <button
            className={`${styles.tabButton} ${
              activeTab === "pending" ? styles.active : ""
            }`}
            onClick={() => setActiveTab("pending")}
          >
            Pending ({orders.pending.length})
          </button>
          <button
            className={`${styles.tabButton} ${
              activeTab === "history" ? styles.active : ""
            }`}
            onClick={() => setActiveTab("history")}
          >
            History ({orders.history.length})
          </button>
        </div>

        {/* Orders Table */}
        <div className={styles.ordersTable}>
          <div className={styles.tableHeader}>
            <h3>
              {activeTab === "active"
                ? "Active Orders"
                : activeTab === "pending"
                ? "Pending Orders"
                : "Order History"}
            </h3>
            <div className={styles.tableControls}>
              <input
                type="text"
                placeholder="Search orders..."
                className={styles.searchInput}
              />
              <select className={styles.filterSelect}>
                <option value="all">All Types</option>
                <option value="buy">Buy Orders</option>
                <option value="sell">Sell Orders</option>
              </select>
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.ordersTable}>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Type</th>
                  <th>Symbol</th>
                  <th>Amount</th>
                  <th>Price</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders[activeTab].map((order) => (
                  <tr key={order.id} className={styles.tableRow}>
                    <td className={styles.orderId}>{order.id}</td>
                    <td>
                      <span
                        className={`${styles.orderType} ${
                          order.type === "buy"
                            ? styles.buyType
                            : styles.sellType
                        }`}
                      >
                        {order.type.toUpperCase()}
                      </span>
                    </td>
                    <td className={styles.symbol}>{order.symbol}</td>
                    <td className={styles.amount}>{order.amount}</td>
                    <td className={styles.price}>${order.price}</td>
                    <td className={styles.total}>${order.total}</td>
                    <td>
                      <span
                        className={`${styles.status} ${getStatusColor(
                          order.status
                        )}`}
                      >
                        <span className={styles.statusIcon}>
                          {getStatusIcon(order.status)}
                        </span>
                        {order.status}
                      </span>
                    </td>
                    <td className={styles.date}>{formatDate(order.date)}</td>
                    <td className={styles.actions}>
                      {(order.status === "pending" ||
                        activeTab === "pending") && (
                        <button
                          className={styles.cancelButton}
                          onClick={() => handleCancelOrder(order.id)}
                        >
                          Cancel
                        </button>
                      )}
                      <button className={styles.viewButton}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {orders[activeTab].length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📋</div>
              <h3>No {activeTab} orders</h3>
              <p>You don't have any {activeTab} orders at the moment.</p>
              <a href="/market" className={styles.createOrderButton}>
                Create New Order
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Recent Activity */}
      <section className={styles.recentActivity}>
        <div className={styles.activityCard}>
          <h3>Recent Activity</h3>
          <div className={styles.activityList}>
            {orders.history.slice(0, 5).map((order) => (
              <div key={order.id} className={styles.activityItem}>
                <div className={styles.activityIcon}>
                  {order.type === "buy" ? "📈" : "📉"}
                </div>
                <div className={styles.activityContent}>
                  <div className={styles.activityTitle}>
                    {order.type === "buy" ? "Bought" : "Sold"} {order.amount}{" "}
                    {order.symbol}
                  </div>
                  <div className={styles.activityDetails}>
                    ${order.total} • {formatDate(order.date)}
                  </div>
                </div>
                <div className={styles.activityStatus}>
                  <span
                    className={`${styles.status} ${getStatusColor(
                      order.status
                    )}`}
                  >
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
