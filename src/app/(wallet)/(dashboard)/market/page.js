"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import TradeModal from "@/components/TradeModal";
import styles from "./market.module.css";

export default function MarketPage() {
  const router = useRouter();
  const { userId, walletAddress } = useUser();
  const [cryptoData, setCryptoData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [wishlist, setWishlist] = useState([]);
  const [showWishlistModal, setShowWishlistModal] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState(null);
  const [wishlistNote, setWishlistNote] = useState("");
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeCoin, setTradeCoin] = useState(null);

  // Fetch crypto data on component mount
  useEffect(() => {
    const fetchCryptoData = async () => {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true"
        );
        const data = await response.json();

        const formattedData = data.map((coin) => ({
          id: coin.id,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          price: coin.current_price,
          priceChange: coin.price_change_percentage_24h,
          priceChangeAmount: coin.price_change_24h,
          volume: coin.total_volume,
          marketCap: coin.market_cap,
          image: coin.image,
          sparkline: coin.sparkline_in_7d?.price || [],
          ath: coin.ath,
          athChangePercentage: coin.ath_change_percentage,
          atl: coin.atl,
          atlChangePercentage: coin.atl_change_percentage,
        }));

        setCryptoData(formattedData);
      } catch (error) {
        console.error("Failed to fetch crypto data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCryptoData();
  }, []);

  // Load wishlist from backend API
  useEffect(() => {
    const fetchWishlist = async () => {
      if (!userId) return;

      try {
        const response = await fetch(`/api/wishlist?userId=${userId}`);
        if (response.ok) {
          const data = await response.json();
          setWishlist(data.wishlist || []);
        }
      } catch (error) {
        console.error("Failed to fetch wishlist:", error);
      }
    };

    fetchWishlist();
  }, [userId]);

  const addToWishlist = async (crypto) => {
    if (!userId) {
      alert("Please connect your wallet to add items to wishlist");
      return;
    }

    try {
      const response = await fetch("/api/wishlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          cryptoData: crypto,
          note: wishlistNote,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setWishlist(data.wishlist);
        setWishlistNote("");
        setShowWishlistModal(false);
        setSelectedCrypto(null);
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to add to wishlist");
      }
    } catch (error) {
      console.error("Error adding to wishlist:", error);
      alert("Failed to add to wishlist. Please try again.");
    }
  };

  const removeFromWishlist = async (cryptoId) => {
    try {
      const response = await fetch("/api/wishlist", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          cryptoId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setWishlist(data.wishlist);
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to remove from wishlist");
      }
    } catch (error) {
      console.error("Error removing from wishlist:", error);
      alert("Failed to remove from wishlist. Please try again.");
    }
  };

  const isInWishlist = (cryptoId) => {
    return wishlist.some((item) => item.id === cryptoId);
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
    if (Math.abs(amount) >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
    if (Math.abs(amount) >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
    if (Math.abs(amount) >= 1e3) return `$${(amount / 1e3).toFixed(1)}K`;
    return `$${Math.abs(amount).toFixed(2)}`;
  };

  const formatMarketCap = (marketCap) => {
    if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`;
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`;
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(2)}M`;
    return `$${marketCap.toFixed(0)}`;
  };

  return (
    <main className={styles.container}>
      <div className={styles.content}>
        <div className={styles.pageHeader}>
          <h1>Market Analysis</h1>
          <div className={styles.headerActions}>
            <button
              className={styles.refreshButton}
              onClick={() => window.location.reload()}
              disabled={isLoading}
            >
              🔄 Refresh
            </button>
            <button
              className={styles.wishlistButton}
              onClick={() => setShowWishlistModal(true)}
            >
              📋 Wishlist ({wishlist.length})
            </button>
          </div>
        </div>

        {/* Crypto Market List */}
        <section className={styles.marketSection}>
          <div className={styles.marketHeader}>
            <h2>Cryptocurrency Market</h2>
            <p>Real-time prices and market data for top cryptocurrencies</p>
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
                      <div className={styles.cryptoActions}>
                        <button
                          className={styles.tradeButton}
                          onClick={() => router.push(`/trade?symbol=${coin.symbol}`)}
                        >
                          Trade {coin.symbol}
                        </button>
                        <button
                          className={`${styles.wishlistToggle} ${
                            isInWishlist(coin.id) ? styles.inWishlist : ""
                          }`}
                          onClick={() => {
                            if (isInWishlist(coin.id)) {
                              removeFromWishlist(coin.id);
                            } else {
                              setSelectedCrypto(coin);
                              setShowWishlistModal(true);
                            }
                          }}
                        >
                          {isInWishlist(coin.id) ? "❤️" : "🤍"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Wishlist Modal */}
        {showWishlistModal && selectedCrypto && (
          <div
            className={styles.modalOverlay}
            onClick={() => setShowWishlistModal(false)}
          >
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>Add to Wishlist</h3>
                <button
                  className={styles.modalClose}
                  onClick={() => setShowWishlistModal(false)}
                >
                  ×
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.cryptoInfo}>
                  <img
                    src={selectedCrypto.image}
                    alt={selectedCrypto.name}
                    className={styles.modalCryptoIcon}
                  />
                  <div>
                    <div className={styles.modalCryptoName}>
                      {selectedCrypto.name}
                    </div>
                    <div className={styles.modalCryptoPrice}>
                      ${formatPrice(selectedCrypto.price)}
                    </div>
                    <div
                      className={`${styles.modalCryptoChange} ${
                        selectedCrypto.priceChange >= 0
                          ? styles.positive
                          : styles.negative
                      }`}
                    >
                      {formatPriceChange(selectedCrypto.priceChange)}
                    </div>
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label>Note (optional)</label>
                  <textarea
                    value={wishlistNote}
                    onChange={(e) => setWishlistNote(e.target.value)}
                    placeholder="Add a note about this cryptocurrency..."
                    className={styles.modalTextarea}
                    rows="3"
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  className={styles.modalButtonSecondary}
                  onClick={() => setShowWishlistModal(false)}
                >
                  Cancel
                </button>
                <button
                  className={styles.modalButtonPrimary}
                  onClick={() => addToWishlist(selectedCrypto)}
                >
                  Add to Wishlist
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Wishlist Display Modal */}
        {showWishlistModal && !selectedCrypto && (
          <div
            className={styles.modalOverlay}
            onClick={() => setShowWishlistModal(false)}
          >
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>My Wishlist</h3>
                <button
                  className={styles.modalClose}
                  onClick={() => setShowWishlistModal(false)}
                >
                  ×
                </button>
              </div>
              <div className={styles.modalBody}>
                {wishlist.length === 0 ? (
                  <div className={styles.emptyWishlist}>
                    <p>Your wishlist is empty</p>
                    <p>Add cryptocurrencies to track their prices and trends</p>
                  </div>
                ) : (
                  <div className={styles.wishlistItems}>
                    {wishlist.map((item) => (
                      <div key={item.id} className={styles.wishlistItem}>
                        <div className={styles.wishlistItemLeft}>
                          <img
                            src={item.image}
                            alt={item.name}
                            className={styles.wishlistIcon}
                          />
                          <div>
                            <div className={styles.wishlistSymbol}>
                              {item.symbol}
                            </div>
                            <div className={styles.wishlistName}>
                              {item.name}
                            </div>
                            {item.note && (
                              <div className={styles.wishlistNote}>
                                {item.note}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={styles.wishlistItemRight}>
                          <div className={styles.wishlistPrice}>
                            ${formatPrice(item.price)}
                          </div>
                          <button
                            className={styles.removeWishlistButton}
                            onClick={() => removeFromWishlist(item.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Trade Modal */}
        <TradeModal
          isOpen={showTradeModal}
          onClose={() => setShowTradeModal(false)}
          coin={tradeCoin}
          userId={userId}
        />
      </div>
    </main>
  );
}
