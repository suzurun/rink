import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "不動産動画自動生成システム | Real Estate Video Generator",
  description: "海外投資家向け不動産紹介動画を自動生成するシステム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased bg-surface-950 text-white min-h-screen">
        <div className="fixed inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="fixed inset-0 bg-gradient-to-br from-primary-950/30 via-transparent to-accent-950/20 pointer-events-none" />
        <main className="relative z-10">
          {children}
        </main>
      </body>
    </html>
  );
}

