import type { Metadata } from 'next';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: '物件管理システム',
  description: '不動産建築会社向け施工情報管理システム',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
