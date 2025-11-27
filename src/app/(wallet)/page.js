"use client";

import dynamic from "next/dynamic";

const LandingPageContent = dynamic(
  () => import("@/components/LandingPageContent"),
  { ssr: false }
);

export default function LandingPage() {
  return <LandingPageContent />;
}
