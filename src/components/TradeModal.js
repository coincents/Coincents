"use client";

import { useState } from "react";

export default function TradeModal({ isOpen, onClose, coin, userId }) {
  const [amount, setAmount] = useState("");
  const [timeframe, setTimeframe] = useState(60);
  const [message, setMessage] = useState("");
  const [isTrading, setIsTrading] = useState(false);

  const getReturnPercentage = (timeframe) => {
    if (timeframe <= 60) return 20;
    if (timeframe <= 120) return 30;
    if (timeframe <= 180) return 40;
    if (timeframe <= 360) return 50;
    if (timeframe <= 7200) return 60;
    return 80;
  };

  const handleTrade = async (type) => {
    if (!amount || parseFloat(amount) <= 0) {
      setMessage("Please enter a valid amount");
      return;
    }

    if (parseFloat(amount) > 1000) {
      setMessage("Insufficient balance for this trade");
      return;
    }

    setIsTrading(true);
    setMessage("");

    try {
      const response = await fetch("/api/trades/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userId || "1",
          coin: coin?.symbol || coin,
          type: type,
          amount: parseFloat(amount),
          timeframe: parseInt(timeframe),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage(
          `✅ ${type} trade created successfully! Potential return: $${data.potentialReturn?.toFixed(
            2
          )}`
        );
        setAmount("");
      } else {
        setMessage(`❌ Trade failed: ${data.error}`);
      }
    } catch (error) {
      console.error("Binary trade error:", error);
      setMessage("❌ Network error. Please try again.");
    } finally {
      setIsTrading(false);
    }
  };

  const handleClose = () => {
    setAmount("");
    setMessage("");
    setIsTrading(false);
    onClose();
  };

  if (!isOpen) return null;

  const coinSymbol = coin?.symbol || coin || "CRYPTO";

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        className="bg-gray-900 text-white rounded-xl p-6 shadow-xl max-w-md w-full mx-4"
        style={{
          background: "#111111",
          color: "#ffffff",
          borderRadius: 12,
          padding: 24,
          maxWidth: "28rem",
          width: "100%",
          margin: "0 1rem",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        }}
      >
        {/* Modal Header */}
        <div
          className="flex justify-between items-center mb-6"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <h2
            className="text-xl font-bold"
            style={{ fontSize: "1.25rem", fontWeight: 700 }}
          >
            Trade {coinSymbol}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white text-2xl font-bold leading-none"
            style={{
              color: "#9ca3af",
              fontSize: "1.5rem",
              fontWeight: 700,
              lineHeight: 1,
            }}
            disabled={isTrading}
          >
            ×
          </button>
        </div>

        {/* Modal Content */}
        <div className="space-y-4" style={{ display: "grid", gap: 16 }}>
          {/* Amount Input */}
          <div>
            <label
              className="block text-sm font-medium text-gray-300 mb-2"
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 600,
                color: "#d1d5db",
                marginBottom: 8,
              }}
            >
              Amount (USD)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
              style={{
                width: "100%",
                background: "#1f2937",
                color: "#fff",
                borderRadius: 8,
                padding: "8px 12px",
                border: "1px solid #4b5563",
              }}
              disabled={isTrading}
            />
          </div>

          {/* Timeframe Dropdown */}
          <div>
            <label
              className="block text-sm font-medium text-gray-300 mb-2"
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 600,
                color: "#d1d5db",
                marginBottom: 8,
              }}
            >
              Timeframe
            </label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(parseInt(e.target.value))}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
              style={{
                width: "100%",
                background: "#1f2937",
                color: "#fff",
                borderRadius: 8,
                padding: "8px 12px",
                border: "1px solid #4b5563",
              }}
              disabled={isTrading}
            >
              <option value={60}>
                60s ({getReturnPercentage(60)}% return)
              </option>
              <option value={120}>
                120s ({getReturnPercentage(120)}% return)
              </option>
              <option value={180}>
                180s ({getReturnPercentage(180)}% return)
              </option>
              <option value={360}>
                360s ({getReturnPercentage(360)}% return)
              </option>
              <option value={600}>
                600s ({getReturnPercentage(600)}% return)
              </option>
              <option value={1200}>
                1200s ({getReturnPercentage(1200)}% return)
              </option>
              <option value={3600}>
                3600s ({getReturnPercentage(3600)}% return)
              </option>
            </select>
          </div>

          {/* Trade Buttons */}
          <div className="flex space-x-3" style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => handleTrade("UP")}
              disabled={isTrading || !amount}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
              style={{
                flex: 1,
                background: "#16a34a",
                color: "#fff",
                fontWeight: 600,
                padding: "12px 16px",
                borderRadius: 10,
                border: "none",
                cursor: isTrading || !amount ? "not-allowed" : "pointer",
                opacity: isTrading || !amount ? 0.6 : 1,
              }}
            >
              {isTrading ? "Processing..." : "UP ↗"}
            </button>
            <button
              onClick={() => handleTrade("DOWN")}
              disabled={isTrading || !amount}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
              style={{
                flex: 1,
                background: "#dc2626",
                color: "#fff",
                fontWeight: 600,
                padding: "12px 16px",
                borderRadius: 10,
                border: "none",
                cursor: isTrading || !amount ? "not-allowed" : "pointer",
                opacity: isTrading || !amount ? 0.6 : 1,
              }}
            >
              {isTrading ? "Processing..." : "DOWN ↘"}
            </button>
          </div>

          {/* Message Display */}
          {message && (
            <div
              className={`p-3 rounded-lg text-sm ${
                message.includes("✅")
                  ? "bg-green-900 text-green-300 border border-green-700"
                  : "bg-red-900 text-red-300 border border-red-700"
              }`}
              style={{
                padding: 12,
                borderRadius: 10,
                fontSize: 14,
                background: message.includes("✅") ? "#052e16" : "#450a0a",
                color: message.includes("✅") ? "#86efac" : "#fca5a5",
                border: `1px solid ${
                  message.includes("✅") ? "#14532d" : "#7f1d1d"
                }`,
              }}
            >
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
