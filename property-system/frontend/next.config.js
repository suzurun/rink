/** @type {import('next').NextConfig} */
const isStaticExport =
  process.env.NODE_ENV === 'production' &&
  (process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true' ||
    process.env.STATIC_EXPORT === 'true');

const baseConfig = {
  // 画像最適化を無効化（静的エクスポートでは使用不可）
  images: {
    unoptimized: true,
  },

  // 環境変数
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_USER_POOL_ID: process.env.NEXT_PUBLIC_USER_POOL_ID || '',
    NEXT_PUBLIC_USER_POOL_CLIENT_ID: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID || '',
    NEXT_PUBLIC_REGION: process.env.NEXT_PUBLIC_REGION || 'ap-northeast-1',
  },
};

const nextConfig = isStaticExport
  ? {
      ...baseConfig,
      // S3静的ホスティング用（本番ビルドのみ）
      output: 'export',
      distDir: 'out',
      trailingSlash: true,
    }
  : baseConfig;

module.exports = nextConfig;




