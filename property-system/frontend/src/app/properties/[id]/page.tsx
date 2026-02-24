import PropertyDetail from '../../../pages/PropertyDetail';

// 静的エクスポート用：動的パスを許可（CloudFrontのSPA設定で処理）
export const dynamicParams = true;

// ビルド時に生成するパスを定義
export async function generateStaticParams() {
  // プレースホルダー - CloudFrontのSPA設定で他のIDもルーティング
  return [{ id: 'placeholder' }];
}

export default function PropertyDetailPage() {
  return <PropertyDetail />;
}
