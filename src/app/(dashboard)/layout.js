"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import Navigation from "../../components/Navigation";

export default function DashboardLayout({ children }) {
  const { status, isConnected } = useAccount();
  const router = useRouter();
  const [hasSession, setHasSession] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check for Better Auth session (email/password users)
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await authClient.getSession();
        setHasSession(!!data?.session);
      } catch (error) {
        setHasSession(false);
      } finally {
        setIsChecking(false);
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    // Only redirect when clearly disconnected AND no Better Auth session
    if (!isChecking && status === "disconnected" && !hasSession) {
      router.replace("/");
    }
  }, [status, hasSession, isChecking, router]);

  // Allow access if wallet connected OR has Better Auth session
  if (isChecking) {
    return <div>Loading...</div>;
  }

  if (status !== "connected" && !isConnected && !hasSession) {
    return null;
  }

  return (
    <div>
      <Navigation />
      {children}
    </div>
  );
}
