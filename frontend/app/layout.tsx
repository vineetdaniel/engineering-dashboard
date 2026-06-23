import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CTO Dash",
  description: "Engineering dashboard for a fintech CTO",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-cto-900 text-white">{children}</body>
    </html>
  );
}
