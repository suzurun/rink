'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Link2, 
  Building2, 
  Languages, 
  TrendingUp, 
  Video, 
  Settings,
  Home
} from 'lucide-react';
import clsx from 'clsx';

const navigation = [
  { name: 'ダッシュボード', href: '/', icon: LayoutDashboard },
  { name: 'URL一括登録', href: '/urls/register', icon: Link2 },
  { name: 'URLステータス', href: '/urls', icon: Home },
  { name: '物件一覧', href: '/properties', icon: Building2 },
  { name: '翻訳管理', href: '/translations', icon: Languages },
  { name: '投資情報', href: '/investments', icon: TrendingUp },
  { name: '動画管理', href: '/videos', icon: Video },
  { name: '設定', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 glass border-r border-white/5 z-50">
      <div className="p-6">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center glow-primary">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight">RE Video</h1>
            <p className="text-xs text-surface-400">Auto Generator</p>
          </div>
        </Link>
      </div>

      <nav className="px-3 mt-4">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                    isActive 
                      ? 'bg-gradient-to-r from-primary-500/20 to-accent-500/10 text-white border-l-2 border-primary-500' 
                      : 'text-surface-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  <item.icon className={clsx(
                    'w-5 h-5',
                    isActive ? 'text-primary-400' : ''
                  )} />
                  <span className="font-medium text-sm">{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="glass rounded-xl p-4 bg-gradient-to-br from-primary-500/10 to-accent-500/10">
          <p className="text-xs text-surface-400 mb-2">システム状態</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium">稼働中</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

