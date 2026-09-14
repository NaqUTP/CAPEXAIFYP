import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CAPEX AI RT2026",
  description: "Machine learning cost estimation for upstream oil and gas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
