export async function createTransaction(userId, walletAddress, token, type, amount, transactionHash) {
  const res = await fetch("/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      walletAddress,
      token,
      type,
      amount: parseFloat(amount),
      transactionHash,
      status: type === "deposit" ? "completed" : "pending",
    }),
  });
  if (!res.ok) {
    throw new Error("Failed to record transaction");
  }
  return res.json();
}

export async function createDeposit(userId, walletAddress, token, amount, transactionHash, screenshot) {
  const res = await fetch("/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      walletAddress,
      token,
      type: "deposit",
      amount: parseFloat(amount),
      transactionHash,
      status: "pending",
      screenshotProvided: Boolean(screenshot),
    }),
  });
  if (!res.ok) {
    throw new Error("Failed to submit deposit proof");
  }
  return res.json();
}

export async function createWithdrawal(userId, walletAddress, token, amount, toAddress, method) {
  const res = await fetch("/api/withdraw/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // Include session cookies for Better Auth
    body: JSON.stringify({
      userId, // Fallback for wallet-based auth
      token,
      amount: parseFloat(amount),
      toAddress,
      method,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create withdrawal request");
  }
  return res.json();
}


