"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../admin.module.css";
import { authClient } from "@/lib/auth-client";

export default function AdminSignInPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const isEmail = identifier.includes("@");
      if (isEmail) {
        const { error } = await authClient.signIn.email({
          email: identifier,
          password,
        });
        if (error) throw new Error(error.message || "Sign-in failed");
      } else {
        const { error } = await authClient.signIn.username({
          username: identifier,
          password,
        });
        if (error) throw new Error(error.message || "Sign-in failed");
      }
      router.replace("/admin");
    } catch (err) {
      setError(err.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.container}>
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <div className={styles.loginHeader}>
            <h1>🔐 Admin Sign In</h1>
            <p>Sign in with your admin email/username and password</p>
          </div>
          <form onSubmit={handleSignIn} className={styles.loginForm}>
            <div className={styles.inputGroup}>
              <label>Email or Username</label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin@example.com or adminuser"
                className={styles.passwordInput}
                required
                autoComplete="username"
              />
            </div>
            <div className={styles.inputGroup}>
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className={styles.passwordInput}
                required
                autoComplete="current-password"
              />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <button type="submit" className={styles.loginButton} disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}


