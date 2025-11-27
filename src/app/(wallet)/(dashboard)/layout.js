"use client";

import dynamic from "next/dynamic";

const DashboardShell = dynamic(
  () => import("@/components/DashboardShell"),
  { ssr: false }
);

export default function DashboardLayout({ children }) {
  return <DashboardShell>{children}</DashboardShell>;
}
