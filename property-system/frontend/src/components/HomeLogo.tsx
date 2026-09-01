/**
 * 各画面のヘッダー左上に置くロゴ
 *
 * - クリックでトップページ（/home）に戻る
 * - トップページ自身とログイン画面は戻る先が無いため link={false} で使う
 * - 狭い画面では横長ロゴが入りきらないため、左端の丸いマークだけを表示する
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

const LOGO_SRC = '/rink-logo.png';
const LOGO_ALT = '株式会社リンク RINK GROUP';

// 横長ロゴ（640x86）のうち、丸いマークは左端 0〜94px。
// 高さを 28px に揃えたときのマーク幅がこの値になる。
const MARK_WIDTH = '30px';

interface HomeLogoProps {
  /** クリックでトップページに戻すか（既定: 戻す） */
  link?: boolean;
  /** ロゴの右に区切り線を出すか（画面名を並べるとき用） */
  divider?: boolean;
}

export default function HomeLogo({ link = true, divider = false }: HomeLogoProps) {
  const router = useRouter();

  const images = (
    <>
      {/* 狭い画面: ロゴ左端のマークのみ */}
      <span
        aria-hidden="true"
        className="block sm:hidden h-7 bg-no-repeat bg-left"
        style={{
          width: MARK_WIDTH,
          backgroundImage: `url('${LOGO_SRC}')`,
          backgroundSize: 'auto 100%',
        }}
      />
      {/* 通常: 横長ロゴ */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_SRC} alt="" className="hidden sm:block h-7 w-auto" />
    </>
  );

  return (
    <div className="flex items-center gap-3">
      {link ? (
        <button
          type="button"
          onClick={() => router.push('/home')}
          aria-label="トップページへ戻る"
          title="トップページへ戻る"
          className="flex items-center -ml-1.5 px-1.5 py-1 rounded-lg hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
        >
          {images}
        </button>
      ) : (
        <span className="flex items-center" role="img" aria-label={LOGO_ALT}>
          {images}
        </span>
      )}
      {divider && (
        <span aria-hidden="true" className="hidden sm:block w-px h-6 bg-slate-200" />
      )}
    </div>
  );
}
